import { useGetStories, getGetStoriesQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";

export function Ticker() {
  const { data: stories, isLoading } = useGetStories({ limit: 6 }, { query: { queryKey: getGetStoriesQueryKey({ limit: 6 }) } });

  if (isLoading || !stories || stories.length === 0) return null;

  return (
    <div className="bg-primary text-primary-foreground border-b border-primary-foreground/20 overflow-hidden py-2 relative flex items-center ticker-container h-10">
      <div className="absolute left-0 top-0 bottom-0 z-10 bg-primary px-4 flex items-center shadow-[4px_0_12px_rgba(192,0,26,1)] border-r border-primary-foreground/20">
        <span className="font-sans font-bold text-xs tracking-widest uppercase">Latest News</span>
      </div>
      
      <div className="flex whitespace-nowrap pl-32 animate-ticker">
        {stories.map((story, i) => (
          <div key={story.id} className="flex items-center">
            <span className="mx-4 text-primary-foreground/40 font-mono text-xs">&bull;</span>
            <Link 
              href={story.is_council ? `/government` : `/community`} 
              className="font-serif text-sm hover:underline hover:text-white transition-colors"
            >
              {story.headline}
            </Link>
          </div>
        ))}
        {/* Duplicate for infinite effect */}
        {stories.map((story, i) => (
          <div key={`dup-${story.id}`} className="flex items-center">
            <span className="mx-4 text-primary-foreground/40 font-mono text-xs">&bull;</span>
            <span className="font-serif text-sm">{story.headline}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
