import { Router } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { storiesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { GetStoriesQueryParams, SubmitStoryBody } from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/admin";
import { fetchGeneralNews, fetchAllGovDocs } from "../lib/news";
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

router.post("/gov/fetch", requireAdmin, async (req, res) => {
  try {
    const result = await fetchAllGovDocs(false);
    res.json(result);
  } catch (e) {
    req.log.error({ err: e }, "Error fetching gov docs");
    res.status(500).json({ error: "Failed to fetch gov docs" });
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

      const base64 = file.buffer.toString("base64");
      const filename = file.originalname || "minutes.pdf";

      const system = `You are an editor for The Walleye Wire, a local news site for Port Clinton, Ohio.
You have been given the actual text of an official Port Clinton City Council document (minutes, ordinance, resolution, or agenda).
Write a plain-English news story based ONLY on the actual content of the document.
Return ONLY a valid JSON object with:
- headline: clear, plain-English headline
- category: "Local Government"
- source_tag: one of "Ordinance", "Resolution", "Council Minutes", "Council Agenda" (match the document type)
- summary: 1-2 sentences summarizing what happened and why it matters to residents
- body: 3-5 sentences with key decisions, votes, or actions from the document
- story_date: meeting date in "Month D, YYYY" format
- source_name: "Port Clinton City Council"
- is_council: true
- council_votes: array of {motion, vote} objects if votes are mentioned, otherwise []`;

      const userPrompt = `Document filename: ${filename}
Please read the attached PDF and write a news story based on its actual content.`;

      const raw = await callClaudeWithDocs(
        [{ base64, sourceUrl: filename }],
        userPrompt,
        system
      );

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
