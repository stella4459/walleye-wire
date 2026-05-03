import { pgTable, integer, text } from "drizzle-orm/pg-core";

export const govSummaryTable = pgTable("gov_summary", {
  id: integer("id").primaryKey().default(1),
  content: text("content").notNull(),
  generated_at: integer("generated_at").notNull().default(0),
});
