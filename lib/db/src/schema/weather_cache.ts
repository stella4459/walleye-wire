import { pgTable, integer, text } from "drizzle-orm/pg-core";

export const weatherCacheTable = pgTable("weather_cache", {
  id: integer("id").primaryKey().default(1),
  data: text("data").default("{}"),
  updated_at: integer("updated_at").default(0),
});

export type WeatherCache = typeof weatherCacheTable.$inferSelect;
