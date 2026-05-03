import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  event_date: text("event_date").notNull(),
  event_time: text("event_time").default(""),
  location: text("location").default(""),
  description: text("description").default(""),
  submitted_by: text("submitted_by").default(""),
  source: text("source").default("Community"),
  url: text("url").default(""),
  approved: boolean("approved").default(false),
  created_at: integer("created_at").default(0),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({ id: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
