import { useState, useEffect } from "react";
import { useGetStories, getGetStoriesQueryKey, useGetWeather, getGetWeatherQueryKey } from "@workspace/api-client-react";
import { StoryCard } from "@/components/shared/StoryCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Cloud, CloudRain, CloudLightning, Snowflake, Sun } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

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
      <div className="bg-nav text-white font-mono text-sm p-5">
        Loading weather...
      </div>
    );
  }

  if (!weather?.current) {
    return (
      <div className="bg-nav text-white font-mono text-sm p-5">
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
          <div className="mt-2 text-sm text-white/80 uppercase tracking-wider">{label}</div>
          <div className="mt-1 text-xs text-white/70">
            H: {high}&deg; &nbsp; L: {low}&deg;
          </div>
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

interface GovSummaryData {
  content: string;
  generated_at: number;
}

function GovSummaryBlock() {
  const [summary, setSummary] = useState<GovSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/gov/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { setSummary(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const generatedDate = summary?.generated_at
    ? format(new Date(summary.generated_at * 1000), "MMM d, yyyy")
    : null;

  return (
    <section aria-labelledby="section-government">
      <SectionHeader>
        <span id="section-government">Local Government</span>
      </SectionHeader>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/6" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ) : summary?.content ? (
        <div className="border border-border bg-card p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-3">
            60-Day Activity Digest
          </p>
          <p className="font-serif text-sm text-foreground leading-relaxed whitespace-pre-line">
            {summary.content}
          </p>
          {generatedDate && (
            <p className="font-mono text-[10px] text-muted-foreground mt-3">
              Updated {generatedDate}
            </p>
          )}
        </div>
      ) : (
        <div className="border border-border py-8 px-6 text-center bg-card">
          <p className="font-mono text-xs text-muted-foreground tracking-wide uppercase">
            No summary yet &mdash; check back soon.
          </p>
        </div>
      )}

      <div className="mt-4">
        <Link
          href="/government"
          className="inline-block font-mono text-xs font-bold tracking-widest uppercase text-white bg-primary hover:bg-primary/85 px-5 py-2.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          View All &rarr;
        </Link>
      </div>
    </section>
  );
}

function CommunitySectionPreview() {
  const params = { category: "Community,General,Weather", limit: 1 };
  const { data: stories, isLoading } = useGetStories(params, {
    query: { queryKey: getGetStoriesQueryKey(params) },
  });

  const story = stories?.[0];

  return (
    <section aria-labelledby="section-community">
      <SectionHeader>
        <span id="section-community">Community News</span>
      </SectionHeader>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ) : story ? (
        <StoryCard story={story} index={0} />
      ) : (
        <div className="border border-border py-8 px-6 text-center bg-card">
          <p className="font-mono text-xs text-muted-foreground tracking-wide uppercase">
            No stories yet &mdash; check back soon.
          </p>
        </div>
      )}

      <div className="mt-4">
        <Link
          href="/community"
          className="inline-block font-mono text-xs font-bold tracking-widest uppercase text-white bg-primary hover:bg-primary/85 px-5 py-2.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          View All &rarr;
        </Link>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="w-full">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">

        {/* Local Government digest first, Community News second */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <GovSummaryBlock />
          <CommunitySectionPreview />
        </div>

        {/* Weather — below */}
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
