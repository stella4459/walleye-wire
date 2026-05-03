import { logger } from "./logger";

const RSS_URL = "https://www.shoresandislands.com/event/rss/";
const USER_AGENT = "Mozilla/5.0 (compatible; WalleyeWire/1.0)";
const FETCH_TIMEOUT_MS = 10_000;
const TARGET_CITY = "Port Clinton";

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

function parseRssLinks(xml: string): string[] {
  const links: string[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const linkMatch = m[1]!.match(/<link>(https?:\/\/[^<]+)<\/link>/);
    if (linkMatch) links.push(linkMatch[1]!.trim());
  }
  return links;
}

function parseEventPage(html: string, url: string): ExternalEvent | null {
  try {
    const ldMatch = html.match(/application\/ld\+json[^>]*>([\s\S]*?)<\/script/);
    if (!ldMatch) return null;
    const data = JSON.parse(ldMatch[1]!.trim());
    if (data["@type"] !== "Event") return null;

    const loc = data.location as Record<string, unknown> | undefined;
    const addr = (loc?.address as Record<string, string> | undefined) ?? {};
    const city = addr.addressLocality ?? "";

    if (city !== TARGET_CITY) return null;

    const name: string = (data.name as string) ?? "";
    const startDate: string = (data.startDate as string) ?? "";
    const endDate: string | null = (data.endDate as string) ?? null;

    const venueStr = typeof loc?.name === "string" ? loc.name : "";
    const streetStr = addr.streetAddress ?? "";
    const locationStr = [venueStr, streetStr].filter(Boolean).join(", ");

    const rawDesc: string = (data.description as string) ?? "";
    const description = rawDesc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400);

    if (!name || !startDate) return null;

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

export async function fetchPortClintonEvents(): Promise<ExternalEvent[]> {
  let xml: string;
  try {
    xml = await fetchWithTimeout(RSS_URL);
  } catch (err) {
    logger.error({ err }, "Failed to fetch Shores & Islands RSS feed");
    return [];
  }

  const links = parseRssLinks(xml);
  logger.info({ count: links.length }, "Shores & Islands RSS links fetched");

  const CONCURRENCY = 8;
  const results: ExternalEvent[] = [];

  for (let i = 0; i < links.length; i += CONCURRENCY) {
    const batch = links.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(async (link) => {
        const html = await fetchWithTimeout(link, 8_000);
        return parseEventPage(html, link);
      })
    );
    for (const s of settled) {
      if (s.status === "fulfilled" && s.value) {
        results.push(s.value);
      }
    }
  }

  logger.info({ found: results.length }, "Port Clinton events found on Shores & Islands");
  return results;
}
