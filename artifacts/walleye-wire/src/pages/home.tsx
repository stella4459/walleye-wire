import { useGetStories, getGetStoriesQueryKey, useGetStats, getGetStatsQueryKey } from "@workspace/api-client-react";
import { Ticker } from "@/components/shared/Ticker";
import { StoryCard } from "@/components/shared/StoryCard";
import { Skeleton } from "@/components/ui/skeleton";

function StatsFooter() {
  const { data: stats } = useGetStats({ query: { queryKey: getGetStatsQueryKey() } });
  
  if (!stats) return null;
  
  return (
    <div className="bg-primary text-primary-foreground py-12 mt-12 border-t-4 border-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="font-headline text-3xl mb-8 tracking-wider">The Wire by the Numbers</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 font-mono">
          <div>
            <div className="text-4xl font-bold mb-2">{stats.total}</div>
            <div className="text-sm uppercase tracking-widest opacity-80">Total Stories</div>
          </div>
          <div>
            <div className="text-4xl font-bold mb-2">{stats.recent_count}</div>
            <div className="text-sm uppercase tracking-widest opacity-80">Recent (30 days)</div>
          </div>
          <div>
            <div className="text-4xl font-bold mb-2">{stats.pending_events}</div>
            <div className="text-sm uppercase tracking-widest opacity-80">Pending Events</div>
          </div>
          <div>
            <div className="text-sm uppercase tracking-widest opacity-80 mb-2 border-b border-primary-foreground/30 pb-2">By Category</div>
            <ul className="space-y-1 text-sm">
              {stats.by_category.map(c => (
                <li key={c.category} className="flex justify-between">
                  <span>{c.category || 'Uncategorized'}</span>
                  <span>{c.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { data: stories, isLoading } = useGetStories({ limit: 12 }, { query: { queryKey: getGetStoriesQueryKey({ limit: 12 }) } });

  return (
    <div className="flex flex-col w-full">
      <Ticker />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <header className="mb-12 border-b-2 border-foreground pb-4">
          <h1 className="font-headline text-5xl md:text-7xl font-bold text-foreground tracking-tight uppercase leading-none">
            The Walleye Wire
          </h1>
          <p className="font-serif text-xl text-muted-foreground mt-4 max-w-2xl">
            Independent, AI-powered local news for Port Clinton, Ohio and Ottawa County. Delivered with Lake Erie grit.
          </p>
        </header>

        <div className="flex justify-between items-end mb-8">
          <h2 className="font-sans font-bold text-xl uppercase tracking-widest text-foreground">Latest Dispatches</h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex flex-col space-y-3">
                <Skeleton className="h-[200px] w-full rounded-sm" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : stories && stories.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-max">
            {stories.map((story, i) => (
              <StoryCard key={story.id} story={story} index={i} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-muted/30 border border-border rounded-sm">
            <p className="font-serif text-lg text-muted-foreground">No stories rolling in off the wire just yet.</p>
          </div>
        )}
      </div>
      
      <StatsFooter />
    </div>
  );
}
