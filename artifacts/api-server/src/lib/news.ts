import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string; numpages: number }>;
import { db } from "@workspace/db";
import { storiesTable, seenDocsTable, govSummaryTable } from "@workspace/db";
import { eq, gte } from "drizzle-orm";
import { callClaude, parseArr, parseObj } from "./claude";
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

    // Map stories back to real URLs and pubDates using article_index
    const now = Math.floor(Date.now() / 1000);
    const valid = stories
      .map((s) => {
        const idx = Number(s.article_index);
        const source = batchItems[idx - 1]; // 1-based index
        if (!source) return null;
        // Use the article's own pubDate for created_at so sort order matches visible dates
        let createdAt = now;
        try {
          const parsed = new Date(source.pubDate);
          if (!isNaN(parsed.getTime())) createdAt = Math.floor(parsed.getTime() / 1000);
        } catch {}
        return { ...s, source_url: source.link, _created_at: createdAt };
      })
      .filter(Boolean) as Array<Record<string, unknown>>;

    if (!valid.length) {
      logger.warn("[News] Claude returned stories but no valid article indices.");
      return 0;
    }

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
        created_at: Number(s._created_at ?? now),
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
// Port Clinton government documents — Google Sheet → PDF pipeline
// Only Ordinances and Resolutions (no council minutes).
// ---------------------------------------------------------------------------

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1LBgYjObNAUICyw52PUDlJX-v1HG5AzRxptwtqS9_uDM/export?format=csv&gid=0";

interface SheetDoc {
  url: string;
  type: "Ordinance" | "Resolution";
  number: string;
  date: string; // e.g. "April 28, 2026"
}

/** Public alias used by the slug backfill route. */
export { fetchSheetDocs as fetchSheetDocsPublic };

/** Parse the Google Sheet CSV and return rows newest-first (as listed in the sheet). */
async function fetchSheetDocs(): Promise<SheetDoc[]> {
  const res = await fetch(SHEET_CSV_URL, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
  const csv = await res.text();

  const lines = csv.trim().split(/\r?\n/);
  // Skip header row
  const dataLines = lines.slice(1);

  const docs: SheetDoc[] = [];
  for (const line of dataLines) {
    // Parse CSV — handle quoted fields containing commas
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());

    const [url, rawType, number, date] = fields;
    if (!url || !rawType) continue;

    const type = rawType.trim() as "Ordinance" | "Resolution";
    if (type !== "Ordinance" && type !== "Resolution") continue;

    docs.push({ url: url.trim(), type, number: (number ?? "").trim(), date: (date ?? "").trim() });
  }

  return docs; // already newest-first from the sheet
}

/** Download a PDF and extract its text content using pdf-parse. Returns null on failure. */
async function downloadPdfText(url: string): Promise<string | null> {
  try {
    logger.info({ url }, "[Gov] Downloading PDF");
    const res = await fetch(url, {
      headers: { "User-Agent": "TheWalleyeWire/1.0" },
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) {
      logger.warn({ url, status: res.status }, "[Gov] PDF download failed");
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const parsed = await pdfParse(buffer);
    const text = parsed.text?.trim() ?? "";
    if (text.length < 50) {
      logger.warn({ url, chars: text.length }, "[Gov] PDF text too short");
      return null;
    }
    logger.info({ url, chars: text.length }, "[Gov] PDF text extracted");
    return text;
  } catch (e) {
    logger.warn({ err: e, url }, "[Gov] PDF extraction error");
    return null;
  }
}

/** Extract the document title from the first meaningful line of extracted PDF text. */
function extractPdfTitle(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 4);
  return lines[0] ?? "";
}

/** Extract the body text (everything after the first meaningful line). */
function extractPdfBody(text: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const titleIdx = lines.findIndex((l) => l.length >= 4);
  if (titleIdx === -1) return text.trim();
  return lines
    .slice(titleIdx + 1)
    .join("\n")
    .trim();
}

const GOV_SYSTEM = `You are a local government reporter for The Walleye Wire, Port Clinton Ohio's community news site.
You have been given the text of a government document — either an Ordinance or a Resolution — from Port Clinton.

Write a plain-English summary for everyday residents. Rules:
- Use language that an average person can understand. No legal jargon.
- Use neutral, descriptive language. Do NOT say the document was "passed," "approved," "adopted," or "enacted."
  Use phrasing like: "proposes," "would," "concerns," "addresses," "is intended to," "calls for," "aims to."
- Base everything ONLY on the text provided. Do not invent details.
- Be factual and concise.

Return ONLY a valid JSON object with exactly two fields:
- summary: 1-2 plain-English sentences describing what the document is about and why it matters to residents.
- body: 3-5 plain-English sentences expanding on the key provisions or intent of the document.`;

/**
 * Process a single sheet doc: download PDF, extract text, call Claude, store in DB.
 * publishDate is the story_date shown to readers ("April 28, 2026" or today's date string).
 * createdAtTs is the Unix timestamp used for sorting.
 */
async function processSheetDoc(
  doc: SheetDoc,
  publishDate: string,
  createdAtTs: number
): Promise<boolean> {
  const pdfText = await downloadPdfText(doc.url);
  if (!pdfText) return false;

  const rawTitle = extractPdfTitle(pdfText);
  const bodyText = extractPdfBody(pdfText).slice(0, 10000);

  const userPrompt = `Document type: ${doc.type}
Document number: ${doc.number}
Date: ${doc.date}

Full document text:
---
${pdfText.slice(0, 12000)}
---

Write a plain-English summary as described in your instructions.`;

  try {
    const raw = await callClaude([{ role: "user", content: userPrompt }], GOV_SYSTEM);
    const s = parseObj(raw);
    if (!s?.summary) {
      logger.warn({ url: doc.url }, "[Gov] Claude returned no summary");
      return false;
    }

    // Headline: use PDF first line, fall back to doc number + type if empty
    const headline =
      rawTitle ||
      `${doc.type} ${doc.number}${doc.date ? ` — ${doc.date}` : ""}`;

    const govSlug = `${doc.type.toLowerCase()}-${(doc.number || "").replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/(^-|-$)/g, "")}`;

    await db.insert(storiesTable).values({
      headline: headline.slice(0, 300),
      category: "Government",
      source_tag: doc.type,
      summary: String(s.summary),
      body: String(s.body ?? bodyText.slice(0, 1000)),
      story_date: publishDate,
      source_name: "Port Clinton City Council",
      source_url: doc.url,
      slug: govSlug || null,
      is_council: true,
      council_votes: [],
      created_at: createdAtTs,
    });

    logger.info({ url: doc.url, headline }, "[Gov] Story stored");
    return true;
  } catch (e) {
    logger.error({ err: e, url: doc.url }, "[Gov] Claude/DB error");
    return false;
  }
}

/**
 * INITIAL LOAD — processes all documents from the Google Sheet.
 * Uses the date from the sheet as the story_date.
 * Skips documents already in the DB by source_url.
 */
export async function runGovInitialLoad(): Promise<{ added: number; skipped: number; errors: number }> {
  logger.info("[Gov] Starting initial load from Google Sheet...");

  let docs: SheetDoc[];
  try {
    docs = await fetchSheetDocs();
  } catch (e) {
    logger.error({ err: e }, "[Gov] Failed to fetch Google Sheet");
    return { added: 0, skipped: 0, errors: 1 };
  }

  logger.info(`[Gov] Sheet has ${docs.length} ordinances/resolutions`);

  // Get all existing source_urls from DB
  const existingRows = await db.select({ source_url: storiesTable.source_url }).from(storiesTable);
  const existingUrls = new Set(existingRows.map((r) => r.source_url));

  let added = 0, skipped = 0, errors = 0;

  for (const doc of docs) {
    if (existingUrls.has(doc.url)) {
      skipped++;
      continue;
    }

    // Use the sheet date as publish date; parse it for created_at sorting
    const publishDate = doc.date;
    let createdAtTs = Math.floor(Date.now() / 1000);
    try {
      const d = new Date(doc.date);
      if (!isNaN(d.getTime())) createdAtTs = Math.floor(d.getTime() / 1000);
    } catch {}

    const ok = await processSheetDoc(doc, publishDate, createdAtTs);
    if (ok) { added++; existingUrls.add(doc.url); }
    else errors++;

    // Brief pause between PDF downloads to be kind to the server
    await new Promise((r) => setTimeout(r, 1000));
  }

  logger.info(`[Gov] Initial load complete: added=${added} skipped=${skipped} errors=${errors}`);
  if (added > 0) {
    await regenerateGovSummary().catch((e) =>
      logger.error({ err: e }, "[Gov] Failed to regenerate summary after initial load")
    );
  }
  return { added, skipped, errors };
}

/**
 * MAINTENANCE CHECK — scans the sheet from newest to oldest.
 * Stops at the first URL already in the DB.
 * New items use today's date as the story_date.
 */
export async function runGovMaintenanceCheck(): Promise<{ added: number; stopped: boolean; errors: number }> {
  logger.info("[Gov] Running maintenance check from Google Sheet...");

  let docs: SheetDoc[];
  try {
    docs = await fetchSheetDocs();
  } catch (e) {
    logger.error({ err: e }, "[Gov] Failed to fetch Google Sheet");
    return { added: 0, stopped: false, errors: 1 };
  }

  const existingRows = await db.select({ source_url: storiesTable.source_url }).from(storiesTable);
  const existingUrls = new Set(existingRows.map((r) => r.source_url));

  const today = new Date();
  const todayStr = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const nowTs = Math.floor(today.getTime() / 1000);

  let added = 0, errors = 0, stopped = false;

  for (const doc of docs) {
    if (existingUrls.has(doc.url)) {
      logger.info({ url: doc.url }, "[Gov] Hit known doc — stopping maintenance scan");
      stopped = true;
      break;
    }

    // New doc — use today's date as the published date
    const ok = await processSheetDoc(doc, todayStr, nowTs);
    if (ok) { added++; existingUrls.add(doc.url); }
    else errors++;

    await new Promise((r) => setTimeout(r, 1000));
  }

  logger.info(`[Gov] Maintenance done: added=${added} stopped=${stopped} errors=${errors}`);
  if (added > 0) {
    await regenerateGovSummary().catch((e) =>
      logger.error({ err: e }, "[Gov] Failed to regenerate summary after maintenance check")
    );
  }
  return { added, stopped, errors };
}

// ---------------------------------------------------------------------------
// GOV SUMMARY — 60-day Claude digest
// ---------------------------------------------------------------------------

const GOV_SUMMARY_SYSTEM = `You are a local government reporter for The Walleye Wire, Port Clinton Ohio's community news site.
Write a plain-English digest of recent Port Clinton government activity for everyday residents.
Rules:
- 2–3 concise paragraphs. No bullet points, no headings.
- Use neutral, descriptive language. Do NOT say documents were "passed," "approved," or "enacted."
  Use phrasing like: "proposes," "would," "concerns," "addresses," "calls for," "aims to."
- Cover the most significant or interesting items first.
- If there is only one item, one solid paragraph is fine.
- Write in third person. Do not mention "The Walleye Wire" in the body.
Return ONLY the plain text digest — no JSON, no markdown.`;

export async function regenerateGovSummary(): Promise<void> {
  const sixtyDaysAgo = Math.floor(Date.now() / 1000) - 60 * 24 * 60 * 60;

  const recent = await db
    .select({
      headline: storiesTable.headline,
      summary: storiesTable.summary,
      source_tag: storiesTable.source_tag,
      story_date: storiesTable.story_date,
    })
    .from(storiesTable)
    .where(
      gte(storiesTable.created_at, sixtyDaysAgo)
    );

  const govDocs = recent.filter(
    (r) => (r.source_tag ?? "").toLowerCase() === "ordinance" ||
            (r.source_tag ?? "").toLowerCase() === "resolution"
  );

  if (govDocs.length === 0) {
    logger.info("[Gov] No recent docs for summary generation, skipping.");
    return;
  }

  const docList = govDocs
    .map((d) => `• ${d.source_tag ?? ""} — ${d.headline}: ${d.summary ?? ""}`)
    .join("\n");

  const prompt = `The following ordinances and resolutions have come before Port Clinton City Council in the past 60 days:\n\n${docList}\n\nWrite the digest as instructed.`;

  const content = await callClaude([{ role: "user", content: prompt }], GOV_SUMMARY_SYSTEM);
  const nowTs = Math.floor(Date.now() / 1000);

  await db
    .insert(govSummaryTable)
    .values({ id: 1, content: content.trim(), generated_at: nowTs })
    .onConflictDoUpdate({
      target: govSummaryTable.id,
      set: { content: content.trim(), generated_at: nowTs },
    });

  logger.info(`[Gov] Summary regenerated (${govDocs.length} docs, ${content.length} chars)`);
}
