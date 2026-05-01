import { useGetStories, getGetStoriesQueryKey } from "@workspace/api-client-react";
import { StoryCard } from "@/components/shared/StoryCard";
import { Skeleton } from "@/components/ui/skeleton";

export default function Community() {
  const { data: stories, isLoading } = useGetStories({ category: "Community,General,Weather" }, { query: { queryKey: getGetStoriesQueryKey({ category: "Community,General,Weather" }) } });

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <header className="mb-12 border-b-2 border-foreground pb-4">
        <h1 className="font-headline text-5xl md:text-6xl font-bold text-foreground tracking-tight uppercase">
          Community
        </h1>
        <p className="font-serif text-lg text-muted-foreground mt-4">
          Local happenings, features, and weather out on the lake.
        </p>
      </header>

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
          <p className="font-serif text-lg text-muted-foreground">No community stories on the wire right now.</p>
        </div>
      )}
    </div>
  );
}
