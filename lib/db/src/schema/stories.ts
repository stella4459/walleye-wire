import { pgTable, serial, text, integer, boolean, json, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const storiesTable = pgTable("stories", {
  id: serial("id").primaryKey(),
  headline: text("headline").notNull(),
  category: text("category").notNull(),
  source_tag: text("source_tag").default("General"),
  summary: text("summary"),
  body: text("body"),
  story_date: text("story_date"),
  source_name: text("source_name"),
  source_url: text("source_url"),
  slug: text("slug"),
  is_council: boolean("is_council").default(false),
  council_votes: json("council_votes").$type<Array<{ motion: string; vote: string }>>().default([]),
  created_at: integer("created_at").default(0),
});

export const insertStorySchema = createInsertSchema(storiesTable).omit({ id: true });
export type InsertStory = z.infer<typeof insertStorySchema>;
export type Story = typeof storiesTable.$inferSelect;
