import { db } from "@workspace/db";
import { storiesTable, seenDocsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { callClaude, callClaudeWithDocs, parseArr } from "./claude";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// RSS helpers
// ---------------------------------------------------------------------------

interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractCdata(src: string): string {
  const m = src.match(/<!\[CDATA\[([\s\S]*?)\]\]>/i);
  return m ? m[1].trim() : src.trim();
}

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(re);
  return m ? extractCdata(m[1]) : "";
}

async function fetchRSS(url: string): Promise<RSSItem[]> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "TheWalleyeWire/1.0 (+https://walleyewire.com)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      logger.warn(`[RSS] ${url} returned ${res.status}`);
      return [];
    }
    const xml = await res.text();
    const items: RSSItem[] = [];
    const itemRe = /<item>([\s\S]*?)<\/item>/gi;
    let m: RegExpExecArray | null;
    while ((m = itemRe.exec(xml)) !== null) {
      const chunk = m[1];
      const title = stripTags(extractTag(chunk, "title"));
      // Prefer <link> then <guid isPermaLink="true"> then any guid with http
      let link =
        extractTag(chunk, "link") ||
        (chunk.match(/<guid[^>]*isPermaLink="true"[^>]*>(.*?)<\/guid>/i) ?? [])[1] ||
        (chunk.match(/<guid[^>]*>(https?:\/\/[^<]+)<\/guid>/i) ?? [])[1] ||
        "";
      link = link.trim();
      const description = stripTags(extractTag(chunk, "description")).slice(0, 600);
      const pubDate = extractTag(chunk, "pubDate") || new Date().toUTCString();
      if (title && link.startsWith("http")) {
        items.push({ title, link, description, pubDate });
      }
    }
    return items.slice(0, 15);
  } catch (e) {
    logger.warn({ err: e }, `[RSS] Failed to fetch ${url}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// RSS sources for Port Clinton / Ottawa County news
// ---------------------------------------------------------------------------

const NEWS_FEEDS = [
  // Google News RSS — most reliable, aggregates local Ohio sources
  "https://news.google.com/rss/search?q=%22Port+Clinton%22+Ohio&hl=en-US&gl=US&ceid=US%3Aen",
  "https://news.google.com/rss/search?q=%22Ottawa+County%22+Ohio&hl=en-US&gl=US&ceid=US%3Aen",
  "https://news.google.com/rss/search?q=%22Lake+Erie%22+Ohio+community&hl=en-US&gl=US&ceid=US%3Aen",
];

// ---------------------------------------------------------------------------
// General news fetch
// ---------------------------------------------------------------------------

export async function fetchGeneralNews(): Promise<number> {
  logger.info("[News] Fetching RSS feeds...");

  // Pull all feeds in parallel
  const feedResults = await Promise.all(NEWS_FEEDS.map(fetchRSS));
  const allItems: RSSItem[] = feedResults.flat();

  if (!allItems.length) {
    logger.warn("[News] All RSS feeds returned 0 items.");
    return 0;
  }

  // De-duplicate by URL
  const seen = new Set<string>();
  const unique = allItems.filter((item) => {
    if (seen.has(item.link)) return false;
    seen.add(item.link);
    return true;
  });

  // Check which URLs are already in the DB
  const existingRows = await db
    .select({ source_url: storiesTable.source_url })
    .from(storiesTable);
  const existingUrls = new Set(existingRows.map((r) => r.source_url));

  const fresh = unique.filter((item) => !existingUrls.has(item.link));

  if (!fresh.length) {
    logger.info("[News] No new RSS items since last fetch.");
    return 0;
  }

  logger.info(`[News] ${fresh.length} new RSS items to process.`);

  // Build numbered list so Claude returns the article_index instead of the full URL
  const batchItems = fresh.slice(0, 20);
  const articleList = batchItems
    .map(
      (item, i) =>
        `[${i + 1}] Title: ${item.title}
Published: ${item.pubDate}
Description: ${item.description}`
    )
    .join("\n\n---\n\n");

  const system = `You are a news editor for The Walleye Wire, a community news site for Port Clinton, Ohio. You will be given a numbered list of real news articles from local RSS feeds. Your job is to select the most relevant ones for the Port Clinton / Ottawa County community and format them.

IMPORTANT RULES:
- Only include articles relevant to Port Clinton OH, Ottawa County OH, Lake Erie, or the surrounding area.
- Do NOT include national news, sports scores, obituaries, or unrelated content.
- Do NOT invent facts. All content must come from the provided title and description.
- Return ONLY a valid JSON array, no markdown, no explanation.

Each story object must have:
- article_index: the integer number shown in brackets [N] for the source article — REQUIRED
- headline: rewrite the title in a clear, engaging way
- category: one of "Community", "Weather", "General"
- source_tag: same as category
- summary: 1-2 sentence teaser based on the description
- body: 3-4 sentences expanding on the article based only on what was provided
- story_date: the pubDate rewritten as "Month D, YYYY"
- source_name: the publication name from the article title (e.g. "WTVG", "Port Clinton News Herald")
- is_council: false
- council_votes: []`;

  const userMsg = `Here are today's RSS articles. Select only those relevant to Port Clinton / Ottawa County Ohio, format them per the schema, and return a JSON array:\n\n${articleList}`;

  try {
    const raw = await callClaude([{ role: "user", content: userMsg }], system);
    const stories = parseArr(raw) as Array<Record<string, unknown>>;

    if (!stories.length) {
      logger.info("[News] Claude returned no stories.");
      return 0;
    }

    // Map stories back to real URLs using article_index
    const valid = stories
      .map((s) => {
        const idx = Number(s.article_index);
        const source = batchItems[idx - 1]; // 1-based index
        if (!source) return null;
        return { ...s, source_url: source.link };
      })
      .filter(Boolean) as Array<Record<string, unknown>>;

    if (!valid.length) {
      logger.warn("[News] Claude returned stories but no valid article indices.");
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

    logger.info(`[News] Added ${valid.length} stories.`);
    return valid.length;
  } catch (e) {
    logger.error({ err: e }, "[News] Failed to process news");
    return 0;
  }
}

// ---------------------------------------------------------------------------
// City Council PDF fetch
// ---------------------------------------------------------------------------

export async function fetchPortClintonDocs(
  backfill = false
): Promise<{ added: number; error?: string }> {
  logger.info(`[CityCouncil] Fetching docs (backfill=${backfill})...`);

  try {
    const html = await (
      await fetch("https://www.portclinton.com/document_center/index.php", {
        signal: AbortSignal.timeout(12000),
      })
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
        `[CityCouncil] Backfill: found ${toProcess.length} 2026 docs.`
      );
    } else {
      toProcess = unique.filter((u) => !seenUrls.has(u)).slice(0, 5);
    }

    if (!toProcess.length) {
      logger.info("[CityCouncil] No new docs found.");
      return { added: 0 };
    }

    let totalAdded = 0;
    const batchSize = 3;
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

async function downloadPdf(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "TheWalleyeWire/1.0" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      logger.warn(`[CityCouncil] PDF download failed ${res.status}: ${url}`);
      return null;
    }
    const buf = await res.arrayBuffer();
    return Buffer.from(buf);
  } catch (e) {
    logger.warn({ err: e }, `[CityCouncil] PDF download error: ${url}`);
    return null;
  }
}

async function processCouncilBatch(urls: string[]): Promise<number> {
  const system = `You are a local government reporter for The Walleye Wire in Port Clinton, Ohio.
You will be given PDF documents from the Port Clinton city website — ordinances, resolutions, and meeting minutes.

Read each document and return a JSON array with one story object per document.

Each story object must have:
- headline: plain English title of what was decided or discussed
- category: "Local Government"
- source_tag: "City Council"
- summary: 1-2 sentences in plain English — what happened and why it matters to residents
- body: 3-5 sentences explaining the decision. Avoid legal jargon. Include vote counts if available.
- story_date: date of the meeting or ordinance in format "Month D, YYYY"
- source_name: "Port Clinton City Council"
- source_url: MUST be the document title/URL passed in — do not change it
- is_council: true
- council_votes: array of {motion: string, vote: "PASSED" | "FAILED" | "TABLED"}

Return ONLY the JSON array, no markdown, no explanation.`;

  // Download PDFs in parallel
  const downloads = await Promise.all(
    urls.map(async (url) => ({ url, buf: await downloadPdf(url) }))
  );

  const docs = downloads.filter((d) => d.buf !== null);

  if (!docs.length) {
    logger.warn("[CityCouncil] No PDFs downloaded successfully.");
    return 0;
  }

  try {
    const pdfDocs = docs.map((d) => ({
      base64: d.buf!.toString("base64"),
      sourceUrl: d.url,
    }));

    const urlList = docs.map((d, i) => `Document ${i + 1}: ${d.url}`).join("\n");
    const userPrompt = `Please read each attached PDF document and summarize it as a news story. Use the document URLs listed below as the source_url for each story:\n\n${urlList}\n\nReturn a JSON array with one story per document.`;

    const raw = await callClaudeWithDocs(pdfDocs, userPrompt, system);
    const stories = parseArr(raw) as Array<Record<string, unknown>>;

    if (!stories.length) return 0;

    let added = 0;
    for (const s of stories) {
      // Match back to a real URL from the batch
      const sUrl = String(s.source_url || "");
      const matchedUrl =
        docs.find(
          (d) =>
            sUrl === d.url ||
            d.url.includes(sUrl) ||
            sUrl.includes(d.url.split("/").pop()?.split("?")[0] || "")
        )?.url ?? docs[0].url;

      const existing = await db
        .select({ id: storiesTable.id })
        .from(storiesTable)
        .where(eq(storiesTable.source_url, matchedUrl));

      if (existing.length > 0) continue;

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
        source_url: matchedUrl,
        is_council: true,
        council_votes:
          (s.council_votes as Array<{ motion: string; vote: string }>) || [],
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
