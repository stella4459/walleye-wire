import { useGetStories, getGetStoriesQueryKey, useGetWeather, getGetWeatherQueryKey } from "@workspace/api-client-react";
import { StoryCard } from "@/components/shared/StoryCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Cloud, CloudRain, CloudLightning, Snowflake, Sun } from "lucide-react";
import { Link } from "wouter";

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="font-mono text-xs font-bold tracking-[0.2em] uppercase text-primary">
        {children}
      </h2>
      <div className="h-[2px] bg-primary mt-1.5" />
      <div className="h-px bg-primary/25 mt-0.5" />
    </div>
  );
}

function getWeatherLabel(code: number | undefined) {
  if (code === undefined) return "Unknown";
  if (code === 0) return "Clear Sky";
  if (code <= 3) return "Partly Cloudy";
  if (code <= 48) return "Foggy";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain Showers";
  if (code <= 86) return "Snow Showers";
  if (code <= 99) return "Thunderstorm";
  return "Unknown";
}

function getWeatherIcon(code: number | undefined) {
  if (code === undefined) return Cloud;
  if (code === 0) return Sun;
  if (code <= 3) return Cloud;
  if (code <= 67) return CloudRain;
  if (code <= 77) return Snowflake;
  if (code <= 82) return CloudRain;
  if (code <= 99) return CloudLightning;
  return Cloud;
}

function WeatherWidget() {
  const { data: weather, isLoading } = useGetWeather({ query: { queryKey: getGetWeatherQueryKey() } });

  if (isLoading) {
    return (
      <div className="bg-nav text-white/60 font-mono text-sm p-5">
        Loading weather...
      </div>
    );
  }

  if (!weather?.current) {
    return (
      <div className="bg-nav text-white/60 font-mono text-sm p-5">
        Weather unavailable.
      </div>
    );
  }

  const label = getWeatherLabel(weather.current.weathercode);
  const Icon = getWeatherIcon(weather.current.weathercode);
  const temp = Math.round(weather.current.temperature_2m ?? 0);
  const high = Math.round(weather.daily?.temperature_2m_max?.[0] ?? 0);
  const low = Math.round(weather.daily?.temperature_2m_min?.[0] ?? 0);

  return (
    <div className="bg-nav text-white p-5 font-mono">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-5xl font-bold leading-none">{temp}&deg;</div>
          <div className="mt-2 text-sm text-white/70 uppercase tracking-wider">{label}</div>
          <div className="mt-1 text-xs text-white/50">
            H: {high}&deg; &nbsp; L: {low}&deg;
          </div>
          <div className="mt-1 text-xs text-white/50">
            Wind: {weather.current.windspeed_10m} mph &nbsp;&bull;&nbsp; Humidity: {weather.current.relativehumidity_2m}%
          </div>
        </div>
        <Icon size={56} className="text-white/20 mt-1 shrink-0" />
      </div>
      <div className="mt-4 pt-3 border-t border-white/15">
        <Link href="/weather" className="text-[11px] tracking-widest uppercase text-white/50 hover:text-white transition-colors">
          Full Forecast &rarr;
        </Link>
      </div>
    </div>
  );
}

export default function Home() {
  const { data: stories, isLoading } = useGetStories({ limit: 12 }, { query: { queryKey: getGetStoriesQueryKey({ limit: 12 }) } });

  return (
    <div className="w-full">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Stories — 2/3 width */}
          <div className="lg:col-span-2">
            <SectionHeader>Latest Stories</SectionHeader>

            {isLoading ? (
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                ))}
              </div>
            ) : stories && stories.length > 0 ? (
              <div className="space-y-5">
                {stories.map((story, i) => (
                  <StoryCard key={story.id} story={story} index={i} />
                ))}
              </div>
            ) : (
              <div className="border border-border py-12 px-6 text-center bg-card">
                <p className="font-mono text-xs text-muted-foreground tracking-wide uppercase">
                  No stories yet &mdash; check back soon.
                </p>
              </div>
            )}
          </div>

          {/* Sidebar — 1/3 width */}
          <div className="lg:col-span-1">
            <SectionHeader>Weather &middot; Port Clinton</SectionHeader>
            <WeatherWidget />
          </div>
        </div>
      </div>
    </div>
  );
}
