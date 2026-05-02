import { useGetStories, getGetStoriesQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";

export function Ticker() {
  const { data: stories } = useGetStories({ limit: 8 }, { query: { queryKey: getGetStoriesQueryKey({ limit: 8 }) } });

  const items = stories && stories.length > 0 ? stories : null;

  return (
    <section
      aria-label="Latest headlines ticker"
      className="bg-nav w-full flex items-center h-9 overflow-hidden border-t border-white/10 ticker-container"
    >
      {/* "LATEST" label */}
      <div
        className="bg-primary text-white font-mono text-[10px] font-bold tracking-[0.2em] uppercase px-4 h-full flex items-center shrink-0 border-r border-white/20"
        aria-hidden="true"
      >
        LATEST
      </div>

      {items ? (
        <>
          {/* Accessible static list for screen readers — hidden visually */}
          <ul className="sr-only" aria-label="Latest headlines">
            {items.map((story) => (
              <li key={story.id}>
                <Link href={story.is_council ? "/government" : "/community"}>
                  {story.headline}
                </Link>
              </li>
            ))}
          </ul>

          {/* Animated ticker — hidden from screen readers to avoid duplicates */}
          <div className="flex-1 overflow-hidden relative" aria-hidden="true">
            <div className="flex whitespace-nowrap animate-ticker">
              {[...items, ...items].map((story, i) => (
                <span key={i} className="inline-flex items-center">
                  <span className="mx-3 text-white/50 font-mono text-xs">&#8226;</span>
                  <span className="font-mono text-[11px] text-white/75">
                    {story.headline}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 px-4">
          <span className="font-mono text-[11px] text-white/70 tracking-wide">
            Port Clinton, Ohio &mdash; Your local news source
          </span>
        </div>
      )}
    </section>
  );
}
