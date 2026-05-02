import { Router } from "express";
import multer from "multer";
// pdf-parse v1 — CommonJS, required via createRequire
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string; numpages: number }>;
import { db } from "@workspace/db";
import { storiesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { GetStoriesQueryParams, SubmitStoryBody } from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/admin";
import { fetchGeneralNews, runGovMaintenanceCheck, runGovInitialLoad } from "../lib/news";
import { callClaude, callClaudeWithDocs, parseObj } from "../lib/claude";
import { logger } from "../lib/logger";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const router = Router();

router.get("/stories", async (req, res) => {
  try {
    const parsed = GetStoriesQueryParams.safeParse(req.query);
    const params = parsed.success ? parsed.data : {};
    const { category, source_tag } = params;

    // Always fetch a large pool first, then apply category/source_tag filters in JS,
    // then slice to the requested limit. This avoids the SQL LIMIT cutting out records
    // that would have matched the filter (e.g., government stories with older timestamps).
    const fetchLimit = 500;

    let rows = await db
      .select()
      .from(storiesTable)
      .orderBy(desc(storiesTable.created_at))
      .limit(fetchLimit);

    if (category && category !== "All") {
      const cats = category.split(",").map((c) => c.trim().toLowerCase());
      rows = rows.filter((r) => cats.includes((r.category ?? "").toLowerCase()));
    }
    if (source_tag && source_tag !== "all") {
      rows = rows.filter((r) =>
        (r.source_tag ?? "").toLowerCase() === source_tag.toLowerCase()
      );
    }

    // Apply the requested limit after filtering
    if (params.limit) {
      rows = rows.slice(0, params.limit);
    }

    res.json(
      rows.map((r) => ({
        ...r,
        council_votes: r.council_votes ?? [],
      }))
    );
  } catch (e) {
    req.log.error({ err: e }, "Error getting stories");
    res.status(500).json({ error: "Failed to get stories" });
  }
});

router.delete("/stories/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "", 10);
    await db.delete(storiesTable).where(eq(storiesTable.id, id));
    res.json({ ok: true });
  } catch (e) {
    req.log.error({ err: e }, "Error deleting story");
    res.status(500).json({ error: "Failed to delete story" });
  }
});

router.post("/stories/submit", requireAdmin, async (req, res) => {
  try {
    const parsed = SubmitStoryBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "No text provided." });
      return;
    }
    const { text, category } = parsed.data;

    const system = `You are an editor for The Walleye Wire, Port Clinton Ohio. Format raw notes into a polished news story. Return ONLY a single JSON object: headline, category (Community/Local Government/Weather/General), source_tag (same), summary, body (3-5 sentences), story_date (today's date formatted as Month D YYYY), source_name ("Community Submission"), is_council (boolean), council_votes (array or []).`;

    const raw = await callClaude(
      [
        {
          role: "user",
          content: `Category: ${category || "Community"}\n\n${text}`,
        },
      ],
      system
    );

    const s = parseObj(raw);
    if (!s?.headline) {
      res.status(422).json({ error: "Could not format story." });
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const result = await db.insert(storiesTable).values({
      headline: String(s.headline),
      category: String(s.category || category || "General"),
      source_tag: String(s.source_tag || s.category || "General"),
      summary: String(s.summary || ""),
      body: String(s.body || ""),
      story_date: String(s.story_date || ""),
      source_name: String(s.source_name || "Community Submission"),
      is_council: Boolean(s.is_council),
      council_votes: (s.council_votes as Array<{ motion: string; vote: string }>) || [],
      created_at: now,
    }).returning({ id: storiesTable.id });

    res.json({ id: result[0]?.id });
  } catch (e) {
    req.log.error({ err: e }, "Error submitting story");
    res.status(500).json({ error: "Failed to submit story" });
  }
});

router.post("/stories/fetch", requireAdmin, async (req, res) => {
  try {
    const added = await fetchGeneralNews();
    res.json({ added });
  } catch (e) {
    req.log.error({ err: e }, "Error fetching news");
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

// Maintenance check — scans sheet top-to-bottom, stops at first known URL, uses today's date
router.post("/gov/fetch", requireAdmin, async (req, res) => {
  try {
    const result = await runGovMaintenanceCheck();
    res.json(result);
  } catch (e) {
    req.log.error({ err: e }, "Error running gov maintenance check");
    res.status(500).json({ error: "Failed to check for new gov docs" });
  }
});

// Initial load — processes every doc in the sheet, uses the sheet's date column
router.post("/gov/backfill", requireAdmin, async (req, res) => {
  try {
    const result = await runGovInitialLoad();
    res.json(result);
  } catch (e) {
    req.log.error({ err: e }, "Error running gov initial load");
    res.status(500).json({ error: "Failed to run initial load" });
  }
});

// Reset — deletes all Government stories then re-imports from the sheet
router.post("/gov/reset", requireAdmin, async (req, res) => {
  try {
    const deleted = await db.delete(storiesTable).where(eq(storiesTable.category, "Government")).returning({ id: storiesTable.id });
    req.log.info({ deleted: deleted.length }, "[Gov] Deleted all government stories for reset");
    const result = await runGovInitialLoad();
    res.json({ deleted: deleted.length, ...result });
  } catch (e) {
    req.log.error({ err: e }, "Error resetting gov docs");
    res.status(500).json({ error: "Failed to reset government documents" });
  }
});

router.post(
  "/stories/upload-minutes",
  requireAdmin,
  upload.single("pdf"),
  async (req, res) => {
    try {
      const file = (req as any).file as { buffer: Buffer; originalname: string } | undefined;
      if (!file || !file.buffer || file.buffer.length === 0) {
        res.status(400).json({ error: "No PDF file provided." });
        return;
      }

      const magic = file.buffer.slice(0, 5).toString("ascii");
      if (magic !== "%PDF-") {
        res.status(400).json({ error: "File does not appear to be a valid PDF." });
        return;
      }

      const filename = file.originalname || "minutes.pdf";

      const system = `You are an editor for The Walleye Wire, a local news site for Port Clinton, Ohio.
You have been given the extracted text of an official Port Clinton city government document.
Write a plain-English news story based ONLY on the actual content of the document.

IMPORTANT LANGUAGE RULES by document type:
- Council Minutes: Summarize what the council discussed, addressed, or decided at the meeting. You may describe actions taken and votes recorded in the minutes since minutes are a factual record of what occurred.
- Ordinances: Describe what the ordinance covers or proposes. Use neutral language — "A proposed ordinance would...", "An ordinance has been introduced that...", "The ordinance concerns..." — do NOT write that it was passed, adopted, approved, or enacted unless the document's own text explicitly confirms that outcome.
- Resolutions: Describe what the resolution addresses or proposes. Use neutral language — "A resolution has been filed that...", "A resolution proposes...", "The resolution concerns..." — do NOT write that it was passed, adopted, or approved unless the document's own text explicitly confirms that outcome.

Return ONLY a valid JSON object with:
- headline: clear, plain-English headline. For ordinances/resolutions, phrase as a proposal (e.g. "Port Clinton Proposes Ordinance to..."), not a completed action.
- category: "Local Government"
- source_tag: one of "Ordinance", "Resolution", "Council Minutes", "Council Agenda" (match the document type)
- summary: 1-2 sentences describing what the document covers and why it matters to residents
- body: 3-5 sentences with key details from the document. For minutes, include notable decisions and vote tallies if present. For ordinances/resolutions, explain what is being proposed and its potential impact.
- story_date: meeting or document date in "Month D, YYYY" format
- source_name: "Port Clinton City Council"
- is_council: true
- council_votes: array of {motion, vote} objects for any votes explicitly stated in the document, otherwise []`;

      let raw: string;

      // Try extracting text with pdf-parse first (works for text-based PDFs)
      let extractedText: string | null = null;
      try {
        const parsed = await pdfParse(file.buffer);
        const fullText = parsed.text ?? "";
        if (fullText.trim().length > 100) {
          extractedText = fullText.trim().slice(0, 12000); // cap to stay within token limits
          req.log.info({ filename, chars: extractedText.length }, "PDF text extracted with pdf-parse");
        }
      } catch (parseErr) {
        req.log.warn({ err: parseErr, filename }, "pdf-parse failed, will fall back to base64");
      }

      if (extractedText) {
        // Text-based PDF: pass extracted text directly to Claude as a message
        const userPrompt = `Document filename: ${filename}

Extracted text from the PDF:
---
${extractedText}
---

Write a news story based on this document's actual content.`;
        raw = await callClaude([{ role: "user", content: userPrompt }], system);
      } else {
        // Scanned/image PDF: fall back to sending as base64 document
        req.log.info({ filename }, "Falling back to base64 document API for scanned PDF");
        const base64 = file.buffer.toString("base64");
        const userPrompt = `Document filename: ${filename}\nPlease read the attached PDF and write a news story based on its actual content.`;
        raw = await callClaudeWithDocs([{ base64, sourceUrl: filename }], userPrompt, system);
      }

      const s = parseObj(raw);
      if (!s?.headline) {
        res.status(422).json({ error: "Claude could not parse the document." });
        return;
      }

      let createdAt = Math.floor(Date.now() / 1000);
      try {
        const d = new Date(String(s.story_date));
        if (!isNaN(d.getTime())) createdAt = Math.floor(d.getTime() / 1000);
      } catch {}

      const result = await db
        .insert(storiesTable)
        .values({
          headline: String(s.headline),
          category: "Government",
          source_tag: String(s.source_tag || "Council Minutes"),
          summary: String(s.summary || ""),
          body: String(s.body || ""),
          story_date: String(s.story_date || ""),
          source_name: "Port Clinton City Council",
          source_url: filename,
          is_council: true,
          council_votes:
            (s.council_votes as Array<{ motion: string; vote: string }>) || [],
          created_at: createdAt,
        })
        .returning({ id: storiesTable.id });

      req.log.info({ filename, id: result[0]?.id }, "Council doc uploaded and summarized");
      res.json({ id: result[0]?.id, headline: s.headline });
    } catch (e) {
      req.log.error({ err: e }, "Error uploading minutes PDF");
      res.status(500).json({ error: "Failed to process PDF." });
    }
  }
);

export default router;
