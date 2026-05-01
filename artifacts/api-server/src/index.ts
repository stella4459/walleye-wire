import app from "./app";
import { logger } from "./lib/logger";
import { refreshWeather } from "./lib/weather";
import { fetchPortClintonDocs } from "./lib/news";
import { db } from "@workspace/db";
import { seenDocsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  setTimeout(async () => {
    await refreshWeather();

    const backfillRow = await db
      .select()
      .from(seenDocsTable)
      .where(eq(seenDocsTable.url, "__backfill_2026_done__"));

    if (!backfillRow.length) {
      logger.info("[Startup] Running one-time City Council backfill from Jan 2026...");
      await fetchPortClintonDocs(true);
      await db
        .insert(seenDocsTable)
        .values({ url: "__backfill_2026_done__", seen_at: Math.floor(Date.now() / 1000) })
        .onConflictDoNothing();
      logger.info("[Startup] Backfill complete.");
    } else {
      logger.info("[Startup] Backfill already done, skipping.");
    }
  }, 3000);
});
