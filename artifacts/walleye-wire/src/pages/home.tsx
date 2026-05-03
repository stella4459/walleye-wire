import { useGetStories, getGetStoriesQueryKey, useGetWeather, getGetWeatherQueryKey } from "@workspace/api-client-react";
import { StoryCard } from "@/components/shared/StoryCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Cloud, CloudRain, CloudLightning, Snowflake, Sun } from "lucide-react";
import { Link } from "wouter";

function SectionHeader({ children, href }: { children: React.ReactNode; href?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div className="flex-1">
        <h2 className="font-mono text-xs font-bold tracking-[0.2em] uppercase text-primary">
          {children}
        </h2>
        <div className="h-[2px] bg-primary mt-1.5" />
        <div className="h-px bg-primary/25 mt-0.5" />
      </div>
      {href && (
        <Link
          href={href}
          className="font-mono text-[11px] font-bold tracking-widest uppercase text-white bg-primary hover:bg-primary/85 px-4 py-2 transition-colors shrink-0"
        >
          View All &rarr;
        </Link>
      )}
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
    return <div className="bg-nav text-white font-mono text-sm p-5">Loading weather...</div>;
  }

  if (!weather?.current) {
    return <div className="bg-nav text-white font-mono text-sm p-5">Weather unavailable.</div>;
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
          <div className="mt-2 text-sm text-white/80 uppercase tracking-wider">{label}</div>
          <div className="mt-1 text-xs text-white/70">H: {high}&deg; &nbsp; L: {low}&deg;</div>
          <div className="mt-1 text-xs text-white/70">
            Wind: {weather.current.windspeed_10m} mph &nbsp;&bull;&nbsp; Humidity: {weather.current.relativehumidity_2m}%
          </div>
        </div>
        <Icon size={56} className="text-white/20 mt-1 shrink-0" aria-hidden="true" />
      </div>
      <div className="mt-4 pt-3 border-t border-white/20">
        <Link href="/weather" className="text-[11px] tracking-widest uppercase text-white/70 hover:text-white transition-colors">
          Full Forecast &rarr;
        </Link>
      </div>
    </div>
  );
}

function StorySectionPreview({
  label,
  href,
  category,
}: {
  label: string;
  href: string;
  category: string;
}) {
  const params = { category, limit: 3 };
  const { data: stories, isLoading } = useGetStories(params, {
    query: { queryKey: getGetStoriesQueryKey(params) },
  });

  const items = stories?.slice(0, 3) ?? [];

  return (
    <section aria-labelledby={`section-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <SectionHeader href={href}>
        <span id={`section-${label.toLowerCase().replace(/\s+/g, "-")}`}>{label}</span>
      </SectionHeader>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex flex-col space-y-3">
              <Skeleton className="h-[180px] w-full rounded-sm" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-max">
          {items.map((story, i) => (
            <StoryCard key={story.id} story={story} index={i} />
          ))}
        </div>
      ) : (
        <div className="border border-border py-8 px-6 text-center bg-card">
          <p className="font-mono text-xs text-muted-foreground tracking-wide uppercase">
            No stories yet &mdash; check back soon.
          </p>
        </div>
      )}
    </section>
  );
}

export default function Home() {
  return (
    <div className="w-full">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-14">

        <StorySectionPreview
          label="Local Government"
          href="/government"
          category="Government,Feature"
        />

        <StorySectionPreview
          label="Community News"
          href="/community"
          category="Community,General,Weather"
        />

        <div className="border-t border-border pt-10">
          <SectionHeader>Weather &middot; Port Clinton</SectionHeader>
          <div className="max-w-sm">
            <WeatherWidget />
          </div>
        </div>

      </div>
    </div>
  );
}
