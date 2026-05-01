import { Router } from "express";
import { db } from "@workspace/db";
import { storiesTable, eventsTable } from "@workspace/db";
import { eq, sql, count } from "drizzle-orm";

const router = Router();

router.get("/stats", async (req, res) => {
  try {
    const totalRows = await db
      .select({ count: count() })
      .from(storiesTable);
    const total = totalRows[0]?.count ?? 0;

    const byCategory = await db
      .select({
        category: storiesTable.category,
        count: count(),
      })
      .from(storiesTable)
      .groupBy(storiesTable.category);

    const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
    const recentRows = await db
      .select({ count: count() })
      .from(storiesTable)
      .where(sql`${storiesTable.created_at} >= ${sevenDaysAgo}`);
    const recent_count = recentRows[0]?.count ?? 0;

    const pendingRows = await db
      .select({ count: count() })
      .from(eventsTable)
      .where(eq(eventsTable.approved, false));
    const pending_events = pendingRows[0]?.count ?? 0;

    res.json({
      total,
      by_category: byCategory.map((r) => ({
        category: r.category,
        count: r.count,
      })),
      recent_count,
      pending_events,
    });
  } catch (e) {
    req.log.error({ err: e }, "Error getting stats");
    res.status(500).json({ total: 0, by_category: [], recent_count: 0, pending_events: 0 });
  }
});

export default router;
