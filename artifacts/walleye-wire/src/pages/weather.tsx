import { useGetWeather, getGetWeatherQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Cloud, Droplets, Wind, Thermometer, Sun, CloudRain, CloudLightning, Snowflake } from "lucide-react";
import { format, parseISO } from "date-fns";

// WMO Weather interpretation codes
function getWeatherInfo(code: number | undefined) {
  if (code === undefined) return { label: "Unknown", icon: Cloud };
  if (code === 0) return { label: "Clear sky", icon: Sun };
  if (code === 1 || code === 2 || code === 3) return { label: "Partly cloudy", icon: Cloud };
  if (code === 45 || code === 48) return { label: "Fog", icon: Cloud };
  if (code >= 51 && code <= 67) return { label: "Drizzle / Rain", icon: CloudRain };
  if (code >= 71 && code <= 77) return { label: "Snow", icon: Snowflake };
  if (code >= 80 && code <= 82) return { label: "Rain showers", icon: CloudRain };
  if (code >= 85 && code <= 86) return { label: "Snow showers", icon: Snowflake };
  if (code >= 95 && code <= 99) return { label: "Thunderstorm", icon: CloudLightning };
  return { label: "Unknown", icon: Cloud };
}

export default function Weather() {
  const { data: weather, isLoading } = useGetWeather({ query: { queryKey: getGetWeatherQueryKey() } });

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <header className="mb-12 border-b-2 border-foreground pb-4">
        <h1 className="font-headline text-5xl md:text-6xl font-bold text-foreground tracking-tight uppercase">
          Lake Conditions
        </h1>
        <p className="font-serif text-lg text-muted-foreground mt-4 flex items-center gap-2">
          <span className="font-mono text-xs font-bold tracking-widest uppercase bg-foreground text-background px-2 py-1 rounded-sm">
            PORT CLINTON, OH
          </span>
          Current conditions and 5-day forecast.
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-8">
          <Skeleton className="h-64 w-full rounded-sm" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-sm" />
            ))}
          </div>
        </div>
      ) : weather && weather.current && weather.daily ? (
        <div className="space-y-12">
          <div className="bg-card border-2 border-foreground p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              {(() => {
                const CurrentIcon = getWeatherInfo(weather.current.weathercode).icon;
                return <CurrentIcon size={200} />;
              })()}
            </div>
            
            <h2 className="font-sans font-bold text-sm tracking-widest uppercase mb-6 border-b border-border pb-2 inline-block">Current</h2>
            
            <div className="flex flex-col md:flex-row gap-12 items-start md:items-center">
              <div>
                <div className="flex items-start gap-4">
                  <span className="font-headline text-8xl md:text-9xl leading-none">
                    {Math.round(weather.current.temperature_2m || 0)}&deg;
                  </span>
                  <div className="flex flex-col pt-4">
                    <span className="font-sans font-bold text-lg uppercase tracking-wider text-primary">
                      {getWeatherInfo(weather.current.weathercode).label}
                    </span>
                    <span className="font-serif text-muted-foreground">
                      Feels like {Math.round(weather.current.temperature_2m || 0)}&deg;F
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-x-12 gap-y-6 font-mono text-sm">
                <div className="flex flex-col">
                  <span className="text-muted-foreground uppercase tracking-widest text-xs flex items-center gap-2 mb-1">
                    <Wind size={14} /> Wind
                  </span>
                  <span className="text-xl">{weather.current.windspeed_10m} mph</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground uppercase tracking-widest text-xs flex items-center gap-2 mb-1">
                    <Droplets size={14} /> Humidity
                  </span>
                  <span className="text-xl">{weather.current.relativehumidity_2m}%</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground uppercase tracking-widest text-xs flex items-center gap-2 mb-1">
                    <Thermometer size={14} /> High / Low
                  </span>
                  <span className="text-xl">
                    {Math.round(weather.daily.temperature_2m_max?.[0] || 0)}&deg; / {Math.round(weather.daily.temperature_2m_min?.[0] || 0)}&deg;
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="font-sans font-bold text-sm tracking-widest uppercase mb-6 border-b border-border pb-2">5-Day Forecast</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {weather.daily.time?.slice(1, 6).map((time, i) => {
                const index = i + 1;
                const date = parseISO(time);
                const info = getWeatherInfo(weather.daily?.weathercode?.[index]);
                const Icon = info.icon;
                
                return (
                  <div key={time} className="bg-card border border-border p-4 flex flex-col items-center text-center hover:border-primary transition-colors">
                    <span className="font-sans font-bold text-sm uppercase tracking-widest mb-1">
                      {format(date, "EEE")}
                    </span>
                    <span className="font-serif text-xs text-muted-foreground mb-4">
                      {format(date, "MMM d")}
                    </span>
                    
                    <div className="text-primary mb-4" aria-label={info.label}>
                      {info.label.includes("Clear") ? "☀️" : 
                       info.label.includes("Rain") ? "🌧️" : 
                       info.label.includes("Snow") ? "❄️" : 
                       info.label.includes("Thunder") ? "⛈️" : "☁️"}
                    </div>
                    
                    <div className="flex gap-3 font-mono text-sm mt-auto">
                      <span className="font-bold">{Math.round(weather.daily?.temperature_2m_max?.[index] || 0)}&deg;</span>
                      <span className="text-muted-foreground">{Math.round(weather.daily?.temperature_2m_min?.[index] || 0)}&deg;</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 bg-muted/30 border border-border rounded-sm">
          <p className="font-serif text-lg text-muted-foreground">Unable to fetch weather data at this time.</p>
        </div>
      )}
    </div>
  );
}
