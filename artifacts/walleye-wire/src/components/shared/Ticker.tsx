import { useGetStories, getGetStoriesQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";

export function Ticker() {
  const { data: stories } = useGetStories({ limit: 8 }, { query: { queryKey: getGetStoriesQueryKey({ limit: 8 }) } });

  const items = stories && stories.length > 0 ? stories : null;

  return (
    <div className="bg-nav w-full flex items-center h-9 overflow-hidden border-t border-white/10 ticker-container">
      <div className="bg-primary text-white font-mono text-[10px] font-bold tracking-[0.2em] uppercase px-4 h-full flex items-center shrink-0 border-r border-white/20">
        LATEST
      </div>

      {items ? (
        <div className="flex-1 overflow-hidden relative">
          <div className="flex whitespace-nowrap animate-ticker">
            {[...items, ...items].map((story, i) => (
              <span key={i} className="inline-flex items-center">
                <span className="mx-3 text-white/30 font-mono text-xs">&#8226;</span>
                <Link
                  href={story.is_council ? "/government" : "/community"}
                  className="font-mono text-[11px] text-white/75 hover:text-white transition-colors"
                >
                  {story.headline}
                </Link>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 px-4">
          <span className="font-mono text-[11px] text-white/40 tracking-wide">
            Port Clinton, Ohio &mdash; Your local news source
          </span>
        </div>
      )}
    </div>
  );
}
