import { Router } from "express";
import { db } from "@workspace/db";
import { eventsTable } from "@workspace/db";
import { eq, asc, sql } from "drizzle-orm";
import { SubmitEventBody, AddEventBody } from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/admin";
import { fetchPortClintonEvents } from "../lib/calendar";

const router = Router();

router.get("/events", async (req, res) => {
  try {
    const allEvents = req.query["all"] === "1";
    let rows;

    if (allEvents) {
      rows = await db
        .select()
        .from(eventsTable)
        .orderBy(asc(eventsTable.event_date));
    } else {
      const today = new Date().toISOString().split("T")[0]!;
      rows = await db
        .select()
        .from(eventsTable)
        .where(
          sql`${eventsTable.approved} = true AND ${eventsTable.event_date} >= ${today}`
        )
        .orderBy(asc(eventsTable.event_date))
        .limit(60);
    }

    res.json(rows);
  } catch (e) {
    req.log.error({ err: e }, "Error getting events");
    res.status(500).json({ error: "Failed to get events" });
  }
});

router.post("/events/submit", async (req, res) => {
  try {
    const parsed = SubmitEventBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Title and date required." });
      return;
    }
    const { title, event_date, event_time, location, description, submitted_by } = parsed.data;

    const now = Math.floor(Date.now() / 1000);
    const result = await db
      .insert(eventsTable)
      .values({
        title,
        event_date,
        event_time: event_time || "",
        location: location || "",
        description: description || "",
        submitted_by: submitted_by || "Anonymous",
        source: "Community",
        approved: false,
        created_at: now,
      })
      .returning({ id: eventsTable.id });

    res.json({ id: result[0]?.id, pending: true });
  } catch (e) {
    req.log.error({ err: e }, "Error submitting event");
    res.status(500).json({ error: "Failed to submit event" });
  }
});

router.post("/events/add", requireAdmin, async (req, res) => {
  try {
    const parsed = AddEventBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Title and date required." });
      return;
    }
    const { title, event_date, event_time, location, description, source } = parsed.data;
    const now = Math.floor(Date.now() / 1000);

    const result = await db
      .insert(eventsTable)
      .values({
        title,
        event_date,
        event_time: event_time || "",
        location: location || "",
        description: description || "",
        source: source || "Admin",
        approved: true,
        created_at: now,
      })
      .returning({ id: eventsTable.id });

    res.json({ id: result[0]?.id });
  } catch (e) {
    req.log.error({ err: e }, "Error adding event");
    res.status(500).json({ error: "Failed to add event" });
  }
});

router.post("/events/sync-shores-islands", requireAdmin, async (req, res) => {
  try {
    const events = await fetchPortClintonEvents();

    await db
      .delete(eventsTable)
      .where(sql`${eventsTable.source} = 'Shores & Islands'`);

    if (events.length === 0) {
      res.json({ added: 0 });
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    await db.insert(eventsTable).values(
      events.map((e) => ({
        title: e.title,
        event_date: e.event_date,
        event_time: "",
        location: e.location,
        description: e.description,
        submitted_by: "",
        source: "Shores & Islands",
        url: e.url,
        approved: true,
        created_at: now,
      }))
    );

    req.log.info({ added: events.length }, "Shores & Islands events synced");
    res.json({ added: events.length });
  } catch (e) {
    req.log.error({ err: e }, "Error syncing Shores & Islands events");
    res.status(500).json({ error: "Sync failed" });
  }
});

router.post("/events/approve/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "", 10);
    await db
      .update(eventsTable)
      .set({ approved: true })
      .where(eq(eventsTable.id, id));
    res.json({ ok: true });
  } catch (e) {
    req.log.error({ err: e }, "Error approving event");
    res.status(500).json({ error: "Failed to approve event" });
  }
});

router.delete("/events/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "", 10);
    await db.delete(eventsTable).where(eq(eventsTable.id, id));
    res.json({ ok: true });
  } catch (e) {
    req.log.error({ err: e }, "Error deleting event");
    res.status(500).json({ error: "Failed to delete event" });
  }
});

export default router;
