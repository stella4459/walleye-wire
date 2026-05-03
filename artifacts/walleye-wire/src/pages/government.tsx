import { useState, useEffect } from "react";
import { useGetStories, getGetStoriesQueryKey } from "@workspace/api-client-react";
import { StoryCard } from "@/components/shared/StoryCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ChevronDown, ChevronUp } from "lucide-react";

type FilterOption = "All" | "Ordinance" | "Resolution" | "Netting Recap" | "Feature Story";

const FILTER_OPTIONS: FilterOption[] = ["All", "Ordinance", "Resolution", "Netting Recap", "Feature Story"];

function getQueryParams(filter: FilterOption) {
  if (filter === "Feature Story") return { category: "Feature" };
  if (filter === "All") return { category: "Government,Feature" };
  return { category: "Government", source_tag: filter };
}

interface GovSummaryData {
  content: string;
  generated_at: number;
}

function GovDigest() {
  const [summary, setSummary] = useState<GovSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch("/api/gov/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { setSummary(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mb-10 border border-border bg-card p-5 space-y-2">
        <Skeleton className="h-3 w-40 mb-3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    );
  }

  if (!summary?.content) return null;

  // Split into paragraphs — show only first, expand for rest
  const paragraphs = summary.content.split(/\n\n+/).filter(Boolean);
  const firstPara = paragraphs[0] ?? "";
  const restParas = paragraphs.slice(1);
  const hasMore = restParas.length > 0;

  const generatedDate = summary.generated_at
    ? format(new Date(summary.generated_at * 1000), "MMM d, yyyy")
    : null;

  return (
    <div className="mb-10 border border-border bg-card p-5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-3">
        60-Day Activity Digest
      </p>

      <p className="font-serif text-sm text-foreground leading-relaxed">
        {firstPara}
      </p>

      {hasMore && expanded && (
        <div className="mt-3 space-y-3">
          {restParas.map((para, i) => (
            <p key={i} className="font-serif text-sm text-foreground leading-relaxed">
              {para}
            </p>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
        {generatedDate && (
          <span className="font-mono text-[10px] text-muted-foreground">
            Updated {generatedDate}
          </span>
        )}
        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 font-mono text-[11px] font-bold tracking-widest uppercase text-primary hover:text-primary/80 transition-colors ml-auto"
          >
            {expanded ? (
              <><ChevronUp size={13} /> Read less</>
            ) : (
              <><ChevronDown size={13} /> Read more</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Government() {
  const [filter, setFilter] = useState<FilterOption>("All");

  const queryParams = getQueryParams(filter);

  const { data: stories, isLoading } = useGetStories(queryParams, {
    query: { queryKey: getGetStoriesQueryKey(queryParams) },
  });

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <header className="mb-8 border-b-2 border-foreground pb-4">
        <h1 className="font-headline text-5xl md:text-6xl font-bold text-foreground tracking-tight uppercase">
          Local Government
        </h1>
        <p className="font-serif text-lg text-muted-foreground mt-4">
          Ordinances, resolutions, and feature coverage from Port Clinton City Hall — summarized in plain English. Click "View source" on any item to read the original document.
        </p>
      </header>

      <GovDigest />

      <div className="flex flex-wrap gap-2 mb-8">
        {FILTER_OPTIONS.map((option) => (
          <Button
            key={option}
            variant={filter === option ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(option)}
            className={`rounded-none font-mono tracking-wide text-xs uppercase ${
              option === "Feature Story" && filter !== option
                ? "border-amber-600/50 text-amber-700 hover:bg-amber-50"
                : ""
            }`}
          >
            {option}
          </Button>
        ))}
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
          <p className="font-serif text-lg text-muted-foreground">
            {filter === "Feature Story"
              ? "No feature stories yet. Add one from the admin panel."
              : "No documents found. Use \"Initial Load\" in the admin panel to import ordinances and resolutions from the Google Sheet."}
          </p>
        </div>
      )}
    </div>
  );
}
