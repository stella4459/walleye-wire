import { Router } from "express";
import { db } from "@workspace/db";
import { storiesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { GetStoriesQueryParams, SubmitStoryBody } from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/admin";
import { fetchGeneralNews, fetchAllGovDocs } from "../lib/news";
import { callClaude, parseObj } from "../lib/claude";
import { logger } from "../lib/logger";

const router = Router();

router.get("/stories", async (req, res) => {
  try {
    const parsed = GetStoriesQueryParams.safeParse(req.query);
    const params = parsed.success ? parsed.data : {};
    const { category, source_tag } = params;

    let rows = await db
      .select()
      .from(storiesTable)
      .orderBy(desc(storiesTable.created_at))
      .limit(params.limit ?? 100);

    if (category && category !== "All") {
      rows = rows.filter((r) => r.category === category);
    }
    if (source_tag && source_tag !== "all") {
      rows = rows.filter((r) => r.source_tag === source_tag);
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

export default router;
