import { db } from "@workspace/db";
import { storiesTable, seenDocsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { callClaude, parseArr } from "./claude";
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
// Port Clinton government documents (Ordinances, Resolutions, Council Minutes)
// ---------------------------------------------------------------------------

const DOC_CENTER_PAGE =
  "https://www.portclinton.com/document_center/index.php";

interface GovDoc {
  label: string;   // visible text, e.g. "Ordinance 17-26"
  title: string;   // descriptive title from href filename
  fullUrl: string; // resolved absolute URL for source_url / linking
  section: "Ordinances" | "Resolutions" | "CouncilMinutes";
  sectionLabel: string;
}

function extractTitle(href: string): string {
  // Pull the filename from the path, strip extension and cache param
  const raw = href.split("?")[0].split("/").pop() ?? href;
  return decodeURIComponent(raw).replace(/\.pdf$/i, "").trim();
}

async function parseDocumentCenter(): Promise<GovDoc[]> {
  const html = await (
    await fetch(DOC_CENTER_PAGE, {
      headers: { "User-Agent": "TheWalleyeWire/1.0" },
      signal: AbortSignal.timeout(15000),
    })
  ).text();

  const sections: Array<{
    id: string;
    section: GovDoc["section"];
    label: string;
  }> = [
    { id: "sub-739", section: "Ordinances", label: "Ordinance" },
    { id: "sub-730", section: "Resolutions", label: "Resolution" },
    { id: "sub-448", section: "CouncilMinutes", label: "Council Meeting" },
  ];

  const docs: GovDoc[] = [];

  for (const { id, section, label: sectionLabel } of sections) {
    // Find the <ul class="file-group sub-XXX"> block
    const start = html.indexOf(`name="${id}"`);
    if (start === -1) continue;
    const ulStart = html.indexOf("<ul", start);
    if (ulStart === -1) continue;
    const ulEnd = html.indexOf("</ul>", ulStart);
    const block = ulEnd !== -1 ? html.slice(ulStart, ulEnd + 5) : html.slice(ulStart, ulStart + 50000);

    // Extract all PDF links in this block
    const linkRe = /<a\s+href="([^"]+\.pdf[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(block)) !== null) {
      const href = m[1] as string;
      // Skip non-document-center files (e.g. deep subdirectory paths for other services)
      if (href.startsWith("Documents/")) continue;

      const visibleText = (m[2] as string)
        .replace(/<[^>]+>/g, "")
        .trim();

      let fullUrl: string;
      try {
        fullUrl = new URL(href, DOC_CENTER_PAGE).href;
      } catch {
        continue;
      }

      docs.push({
        label: visibleText || extractTitle(href),
        title: extractTitle(href),
        fullUrl,
        section,
        sectionLabel,
      });
    }
  }

  return docs;
}

async function processGovDocBatch(batch: GovDoc[]): Promise<number> {
  const system = `You are a local government reporter for The Walleye Wire, the community news site for Port Clinton, Ohio.
You will be given a list of city government documents (ordinances, resolutions, or council meeting minutes) from the Port Clinton city website.
Each entry has a document number/label, a descriptive title, and the document type.

For each document, produce a plain-English news story based solely on the title and document type.
Do NOT invent specific vote counts, dollar amounts, or people's names unless they are clearly stated in the title.

Return ONLY a valid JSON array with one object per document, no markdown, no explanation.

Each object must have:
- doc_index: integer (1-based, matching the [N] prefix in the input)
- headline: clear, plain-English headline (not legal jargon)
- category: "Local Government"
- source_tag: one of "Ordinance", "Resolution", "Council Minutes"
- summary: 1-2 sentence plain-English summary of what the document is about and why it matters to residents
- body: 2-3 sentences expanding on the summary. Stay factual; don't pad.
- story_date: infer the date from the title/filename if possible (format "Month D, YYYY"); otherwise use current year
- source_name: "Port Clinton City Council"
- is_council: true
- council_votes: [] (empty array; we don't have vote data from titles alone)`;

  const docList = batch
    .map(
      (d, i) =>
        `[${i + 1}] Type: ${d.sectionLabel}\nLabel: ${d.label}\nTitle: ${d.title}`
    )
    .join("\n\n---\n\n");

  const userPrompt = `Below are ${batch.length} Port Clinton government document(s). Summarize each as a plain-English news story.\n\n${docList}\n\nReturn a JSON array with one object per document.`;

  try {
    const raw = await callClaude([{ role: "user", content: userPrompt }], system);
    const stories = parseArr(raw) as Array<Record<string, unknown>>;
    if (!stories.length) return 0;

    let added = 0;
    for (const s of stories) {
      const idx = Number(s.doc_index ?? 1) - 1;
      const doc = batch[Math.max(0, Math.min(idx, batch.length - 1))];

      const existing = await db
        .select({ id: storiesTable.id })
        .from(storiesTable)
        .where(eq(storiesTable.source_url, doc.fullUrl));
      if (existing.length > 0) continue;

      let createdAt = Math.floor(Date.now() / 1000);
      try {
        const parsed = new Date(String(s.story_date));
        if (!isNaN(parsed.getTime()))
          createdAt = Math.floor(parsed.getTime() / 1000);
      } catch {}

      await db.insert(storiesTable).values({
        headline: String(s.headline || doc.title),
        category: "Government",
        source_tag: String(s.source_tag || "City Council"),
        summary: String(s.summary || ""),
        body: String(s.body || ""),
        story_date: String(s.story_date || ""),
        source_name: "Port Clinton City Council",
        source_url: doc.fullUrl,
        is_council: true,
        council_votes: [],
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

export async function fetchPortClintonDocs(
  backfill = false
): Promise<{ added: number; error?: string }> {
  logger.info(`[CityCouncil] Fetching docs (backfill=${backfill})...`);

  try {
    const allDocs = await parseDocumentCenter();
    logger.info(
      `[CityCouncil] Found ${allDocs.length} total docs on page (ordinances + resolutions + minutes).`
    );

    // Which URLs have we already stored?
    const existingRows = await db
      .select({ source_url: storiesTable.source_url })
      .from(storiesTable);
    const existingUrls = new Set(existingRows.map((r) => r.source_url));

    const isNew = (d: GovDoc) => !existingUrls.has(d.fullUrl);

    let toProcess: GovDoc[];
    if (backfill) {
      // Take up to 10 recent docs per section
      const bySection = ["Ordinances", "Resolutions", "CouncilMinutes"] as const;
      toProcess = bySection.flatMap((sec) =>
        allDocs.filter((d) => d.section === sec && isNew(d)).slice(0, 10)
      );
      logger.info(`[CityCouncil] Backfill: ${toProcess.length} new docs.`);
    } else {
      // Normal run: up to 5 most recent per section
      const bySection = ["Ordinances", "Resolutions", "CouncilMinutes"] as const;
      toProcess = bySection.flatMap((sec) =>
        allDocs.filter((d) => d.section === sec && isNew(d)).slice(0, 5)
      );
    }

    if (!toProcess.length) {
      logger.info("[CityCouncil] No new docs found.");
      return { added: 0 };
    }

    logger.info(`[CityCouncil] Processing ${toProcess.length} new docs...`);

    let totalAdded = 0;
    const batchSize = 5;
    for (let i = 0; i < toProcess.length; i += batchSize) {
      const batch = toProcess.slice(i, i + batchSize);
      const added = await processGovDocBatch(batch);
      totalAdded += added;
      if (i + batchSize < toProcess.length) {
        await new Promise((r) => setTimeout(r, 1500));
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

export async function fetchAllGovDocs(
  backfill = false
): Promise<{ portclinton: { added: number; error?: string } }> {
  return { portclinton: await fetchPortClintonDocs(backfill) };
}
