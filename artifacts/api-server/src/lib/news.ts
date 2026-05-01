import { db } from "@workspace/db";
import { storiesTable, seenDocsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { callClaude, parseArr } from "./claude";
import { logger } from "./logger";

export async function fetchGeneralNews(): Promise<number> {
  logger.info("[News] Fetching general news...");

  const system = `You are a news editor for The Walleye Wire, Port Clinton Ohio. Search the web for recent community news, tourism, business, and weather stories about Port Clinton OH and Ottawa County OH. Do NOT include city council or government stories.

Return ONLY a JSON array of 3-5 story objects. Each MUST include:
- headline (string)
- category: one of Community, Weather, General
- source_tag: same as category
- summary: 1-2 sentence teaser
- body: 3-4 sentences of article content
- story_date: date in format Month D YYYY
- source_name: publication or website name
- source_url: FULL URL of the original article — REQUIRED. Only include stories where you have the real URL.
- is_council: false
- council_votes: []

IMPORTANT: source_url is mandatory. Only include stories where you have the actual URL. Do not invent URLs.`;

  try {
    const raw = await callClaude(
      [
        {
          role: "user",
          content:
            "Find the latest news from Port Clinton Ohio and Ottawa County — community, tourism, business, weather. Include the full source URL for every story.",
        },
      ],
      system
    );

    const stories = parseArr(raw) as Array<Record<string, unknown>>;
    if (!stories.length) return 0;

    const valid = stories.filter(
      (s) =>
        s.source_url &&
        typeof s.source_url === "string" &&
        s.source_url.startsWith("http")
    );

    if (!valid.length) {
      logger.info("[News] No stories with valid source URLs.");
      return 0;
    }

    const now = Math.floor(Date.now() / 1000);
    await db.insert(storiesTable).values(
      valid.map((s) => ({
        headline: String(s.headline || ""),
        category: String(s.category || "General"),
        source_tag: String(s.source_tag || s.category || "General"),
        summary: String(s.summary || ""),
        body: String(s.body || ""),
        story_date: String(s.story_date || ""),
        source_name: String(s.source_name || ""),
        source_url: String(s.source_url || ""),
        is_council: false,
        council_votes: [],
        created_at: now,
      }))
    );

    logger.info(`[News] Added ${valid.length} stories with source URLs.`);
    return valid.length;
  } catch (e) {
    logger.error({ err: e }, "[News] Failed to fetch general news");
    return 0;
  }
}

export async function fetchPortClintonDocs(
  backfill = false
): Promise<{ added: number; error?: string }> {
  logger.info(`[CityCouncil] Fetching docs (backfill=${backfill})...`);

  try {
    const html = await (
      await fetch(
        "https://www.portclinton.com/document_center/index.php"
      )
    ).text();

    const allMatches = [...html.matchAll(/href="([^"]+\.pdf[^"]*)"/gi)]
      .map((m) => {
        const u = m[1] as string;
        return u.startsWith("http")
          ? u
          : "https://www.portclinton.com" + u;
      })
      .filter((u) => /ordinance|minutes|council|resolution/i.test(u));

    const unique = [...new Set(allMatches)];

    const seenRows = await db.select().from(seenDocsTable);
    const seenUrls = new Set(seenRows.map((r) => r.url));

    let toProcess: string[];
    if (backfill) {
      toProcess = unique.filter(
        (u) =>
          (/2026/i.test(u) ||
            /january.*2026|february.*2026|march.*2026|april.*2026/i.test(
              decodeURIComponent(u)
            )) &&
          !seenUrls.has(u)
      );
      logger.info(
        `[CityCouncil] Backfill: found ${toProcess.length} 2026 docs to process.`
      );
    } else {
      toProcess = unique.filter((u) => !seenUrls.has(u)).slice(0, 5);
    }

    if (!toProcess.length) {
      logger.info("[CityCouncil] No new docs found.");
      return { added: 0 };
    }

    let totalAdded = 0;
    const batchSize = 5;
    for (let i = 0; i < toProcess.length; i += batchSize) {
      const batch = toProcess.slice(i, i + batchSize);
      const added = await processCouncilBatch(batch);
      totalAdded += added;

      await db
        .insert(seenDocsTable)
        .values(
          batch.map((u) => ({ url: u, seen_at: Math.floor(Date.now() / 1000) }))
        )
        .onConflictDoNothing();

      if (i + batchSize < toProcess.length) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    logger.info(`[CityCouncil] Total added: ${totalAdded}`);
    return { added: totalAdded };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error({ err: e }, "[CityCouncil] Error fetching docs");
    return { added: 0, error: msg };
  }
}

async function processCouncilBatch(urls: string[]): Promise<number> {
  const system = `You are a local government reporter for The Walleye Wire in Port Clinton, Ohio.
You will be given URLs to PDF documents from the Port Clinton city website — these are ordinances, resolutions, and meeting minutes from the Port Clinton City Council.

Fetch and read each document, then return a JSON array with one story object per document.

Each story object must have:
- headline: plain English title of what was decided or discussed
- category: "Local Government"
- source_tag: "City Council"
- summary: 1-2 sentences in plain English — what happened and why it matters to Port Clinton residents
- body: 3-5 sentences explaining the decision in plain English. Avoid legal jargon. Include vote counts if available.
- story_date: the date of the meeting or ordinance in format "Month D, YYYY"
- source_name: "Port Clinton City Council"
- source_url: MUST be the exact PDF URL provided — do not change or omit this
- is_council: true
- council_votes: array of objects {motion: "description", vote: "PASSED" or "FAILED" or "TABLED"}

IMPORTANT RULES:
- Write for a general audience — no legalese
- source_url must be the exact URL of the PDF you read
- story_date must come from the actual document
- Return ONLY the JSON array, no markdown, no explanation`;

  try {
    const urlList = urls.map((u, i) => `${i + 1}. ${u}`).join("\n");
    const raw = await callClaude(
      [
        {
          role: "user",
          content: `Please fetch and summarize these Port Clinton City Council documents. Make sure source_url matches each document's URL exactly:\n\n${urlList}`,
        },
      ],
      system
    );

    const stories = parseArr(raw) as Array<Record<string, unknown>>;
    if (!stories.length) return 0;

    let added = 0;
    for (const s of stories) {
      const sUrl = String(s.source_url || "");
      const existing = await db
        .select({ id: storiesTable.id })
        .from(storiesTable)
        .where(eq(storiesTable.source_url, sUrl));

      if (existing.length > 0) continue;

      const validUrl =
        urls.find(
          (u) =>
            sUrl === u ||
            u.includes(sUrl) ||
            sUrl.includes(u.split("/").pop()?.split("?")[0] || "")
        ) || urls[0];

      let createdAt = Math.floor(Date.now() / 1000);
      try {
        const parsed = new Date(String(s.story_date));
        if (!isNaN(parsed.getTime()))
          createdAt = Math.floor(parsed.getTime() / 1000);
      } catch {}

      await db.insert(storiesTable).values({
        headline: String(s.headline || ""),
        category: "Local Government",
        source_tag: "City Council",
        summary: String(s.summary || ""),
        body: String(s.body || ""),
        story_date: String(s.story_date || ""),
        source_name: "Port Clinton City Council",
        source_url: validUrl ?? "",
        is_council: true,
        council_votes: (s.council_votes as Array<{ motion: string; vote: string }>) || [],
        created_at: createdAt,
      });
      added++;
    }

    logger.info(`[CityCouncil] Batch processed: ${added} stories added.`);
    return added;
  } catch (e) {
    logger.error({ err: e }, "[CityCouncil] Batch error");
    return 0;
  }
}

export async function fetchAllGovDocs(
  backfill = false
): Promise<{ portclinton: { added: number; error?: string } }> {
  return { portclinton: await fetchPortClintonDocs(backfill) };
}
