import { logger } from "./logger";

const SITEMAP_URL = "https://www.shoresandislands.com/sitemap.xml";
const USER_AGENT = "Mozilla/5.0 (compatible; WalleyeWire/1.0)";
const FETCH_TIMEOUT_MS = 10_000;
const TARGET_CITY = "Port Clinton";
const CONCURRENCY = 20;

export interface ExternalEvent {
  title: string;
  event_date: string;
  event_end_date: string | null;
  location: string;
  description: string;
  url: string;
}

async function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchEventUrls(): Promise<string[]> {
  const xml = await fetchWithTimeout(SITEMAP_URL);
  const matches = xml.matchAll(/<loc>(https?:\/\/www\.shoresandislands\.com\/event\/[^<]+)<\/loc>/g);
  const urls: string[] = [];
  for (const m of matches) {
    urls.push(m[1]!.trim());
  }
  return urls;
}

function parseEventPage(html: string, url: string, today: string): ExternalEvent | null {
  try {
    const ldMatch = html.match(/application\/ld\+json[^>]*>([\s\S]*?)<\/script/);
    if (!ldMatch) return null;
    const data = JSON.parse(ldMatch[1]!.trim());
    if (data["@type"] !== "Event") return null;

    const loc = data.location as Record<string, unknown> | undefined;
    const addr = (loc?.address as Record<string, string> | undefined) ?? {};
    const city = addr.addressLocality ?? "";
    if (city !== TARGET_CITY) return null;

    const startDate: string = (data.startDate as string) ?? "";
    if (!startDate || startDate.slice(0, 10) < today) return null;

    const endDate: string | null = (data.endDate as string) ?? null;
    const name: string = (data.name as string) ?? "";
    if (!name) return null;

    const venueStr = typeof loc?.name === "string" ? loc.name : "";
    const streetStr = addr.streetAddress ?? "";
    const locationStr = [venueStr, streetStr].filter(Boolean).join(", ");

    const rawDesc: string = (data.description as string) ?? "";
    const description = rawDesc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400);

    return {
      title: name,
      event_date: startDate.slice(0, 10),
      event_end_date: endDate ? endDate.slice(0, 10) : null,
      location: locationStr.slice(0, 200),
      description,
      url,
    };
  } catch {
    return null;
  }
}

async function processBatch(
  urls: string[],
  today: string
): Promise<ExternalEvent[]> {
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const html = await fetchWithTimeout(url, 8_000);
      return parseEventPage(html, url, today);
    })
  );
  return results
    .filter((s): s is PromiseFulfilledResult<ExternalEvent> => s.status === "fulfilled" && s.value !== null)
    .map((s) => s.value);
}

export async function fetchPortClintonEvents(): Promise<ExternalEvent[]> {
  let eventUrls: string[];
  try {
    eventUrls = await fetchEventUrls();
  } catch (err) {
    logger.error({ err }, "Failed to fetch Shores & Islands sitemap");
    return [];
  }

  logger.info({ count: eventUrls.length }, "Shores & Islands event URLs from sitemap");

  const today = new Date().toISOString().slice(0, 10);
  const results: ExternalEvent[] = [];

  for (let i = 0; i < eventUrls.length; i += CONCURRENCY) {
    const batch = eventUrls.slice(i, i + CONCURRENCY);
    const found = await processBatch(batch, today);
    results.push(...found);
  }

  results.sort((a, b) => a.event_date.localeCompare(b.event_date));
  logger.info({ found: results.length }, "Port Clinton upcoming events found");
  return results;
}
