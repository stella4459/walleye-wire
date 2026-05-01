import { pgTable, text, integer } from "drizzle-orm/pg-core";

export const seenDocsTable = pgTable("seen_docs", {
  url: text("url").primaryKey(),
  seen_at: integer("seen_at").default(0),
});

export type SeenDoc = typeof seenDocsTable.$inferSelect;
