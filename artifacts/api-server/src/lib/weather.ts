import { db } from "@workspace/db";
import { weatherCacheTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=41.5134&longitude=-82.9379" +
  "&current=temperature_2m,weathercode,windspeed_10m,relativehumidity_2m" +
  "&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum" +
  "&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch" +
  "&timezone=America%2FNew_York&forecast_days=5";

export async function refreshWeather(): Promise<void> {
  try {
    const r = await fetch(WEATHER_URL);
    const data = await r.json();
    const now = Math.floor(Date.now() / 1000);

    await db
      .insert(weatherCacheTable)
      .values({ id: 1, data: JSON.stringify(data), updated_at: now })
      .onConflictDoUpdate({
        target: weatherCacheTable.id,
        set: { data: JSON.stringify(data), updated_at: now },
      });

    logger.info("[Weather] Updated.");
  } catch (e) {
    logger.error({ err: e }, "[Weather] Failed to refresh");
  }
}

export async function getWeatherData(): Promise<unknown> {
  const rows = await db
    .select()
    .from(weatherCacheTable)
    .where(eq(weatherCacheTable.id, 1));

  const row = rows[0];
  const now = Math.floor(Date.now() / 1000);

  if (!row || now - (row.updated_at ?? 0) > 3600 || row.data === "{}") {
    await refreshWeather();
    const refreshed = await db
      .select()
      .from(weatherCacheTable)
      .where(eq(weatherCacheTable.id, 1));
    const r = refreshed[0];
    return r ? JSON.parse(r.data ?? "{}") : {};
  }

  return JSON.parse(row.data ?? "{}");
}
