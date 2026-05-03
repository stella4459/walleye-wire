import { useParams, Link } from "wouter";
import { useGetStoryBySlug } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Copy, ExternalLink, Facebook, Share2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}

export default function GovDoc() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const { data: story, isLoading, isError } = useGetStoryBySlug(slug);
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const pageUrl = typeof window !== "undefined" ? window.location.href : "";
  const encodedUrl = encodeURIComponent(pageUrl);
  const encodedHeadline = encodeURIComponent(story?.headline ?? "Port Clinton Government Document — The Walleye Wire");

  function copyLink() {
    navigator.clipboard.writeText(pageUrl).then(() => {
      setCopied(true);
      toast({ title: "Link copied!", description: "Paste it anywhere to share." });
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function shareX() {
    window.open(
      `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedHeadline}`,
      "_blank",
      "noopener,noreferrer,width=600,height=400"
    );
  }

  function shareFacebook() {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      "_blank",
      "noopener,noreferrer,width=600,height=400"
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-3xl">
        <Skeleton className="h-6 w-32 mb-8" />
        <Skeleton className="h-12 w-full mb-4" />
        <Skeleton className="h-4 w-48 mb-8" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !story) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-3xl text-center">
        <p className="font-serif text-lg text-muted-foreground mb-6">Document not found.</p>
        <Link href="/government">
          <Button variant="outline" className="rounded-none font-mono text-xs tracking-widest uppercase">
            <ArrowLeft size={14} className="mr-2" /> Back to Government
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-3xl">
      <Link href="/government" className="inline-flex items-center gap-2 text-xs font-mono tracking-widest uppercase text-muted-foreground hover:text-primary transition-colors mb-10">
        <ArrowLeft size={14} />
        Local Government
      </Link>

      <article>
        <header className="mb-8 border-b-2 border-foreground pb-6">
          <div className="flex flex-wrap gap-2 mb-4">
            {story.source_tag && (
              <Badge
                variant="outline"
                className="font-mono text-[10px] tracking-wide rounded-none bg-accent text-accent-foreground border-border"
              >
                {story.source_tag.toUpperCase()}
              </Badge>
            )}
            {story.category === "Feature" && (
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-800 border-amber-400 font-mono text-[10px] tracking-wide rounded-none font-bold"
              >
                FEATURE
              </Badge>
            )}
          </div>

          <h1 className="font-headline text-4xl md:text-5xl font-bold text-foreground tracking-tight leading-tight mb-4">
            {story.headline}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-sm font-sans text-muted-foreground">
            {story.story_date && <span className="font-mono">{story.story_date}</span>}
            {story.source_name && (
              <>
                <span className="opacity-40">•</span>
                <span className="font-semibold uppercase tracking-wider text-foreground/70 text-xs">{story.source_name}</span>
              </>
            )}
            {story.source_url && (
              <>
                <span className="opacity-40">•</span>
                <a
                  href={story.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-primary transition-colors text-xs"
                >
                  View source <ExternalLink size={11} />
                </a>
              </>
            )}
          </div>
        </header>

        {story.summary && (
          <p className="font-serif text-xl leading-relaxed text-foreground/80 mb-8 border-l-4 border-primary pl-5 italic">
            {story.summary}
          </p>
        )}

        {story.council_votes && story.council_votes.length > 0 && (
          <div className="mb-8 bg-accent/40 border border-border p-5">
            <h2 className="font-sans font-bold text-xs tracking-widest uppercase mb-4 text-foreground border-b border-border pb-2">
              Council Actions
            </h2>
            <ul className="space-y-2">
              {story.council_votes.map((vote: { motion: string; vote: string }, i: number) => (
                <li key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-card p-3 border border-border">
                  <span className="font-serif text-sm">{vote.motion}</span>
                  <Badge
                    className={`rounded-none font-mono text-[10px] tracking-widest self-start sm:self-auto ${
                      vote.vote.toUpperCase() === "PASSED"
                        ? "bg-green-600/10 text-green-700 border-green-600/20"
                        : vote.vote.toUpperCase() === "FAILED"
                        ? "bg-red-600/10 text-red-700 border-red-600/20"
                        : "bg-gray-500/10 text-gray-700 border-gray-500/20"
                    }`}
                    variant="outline"
                  >
                    {vote.vote.toUpperCase()}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}

        {story.body && (
          <div className="prose prose-base prose-p:font-serif prose-headings:font-headline max-w-none text-foreground mb-10">
            {story.body.split("\n\n").map((paragraph: string, i: number) => (
              <p key={i} className="leading-relaxed mb-5 font-serif text-base">{paragraph}</p>
            ))}
          </div>
        )}

        <div className="border-t-2 border-foreground pt-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-sans font-bold text-xs tracking-widest uppercase text-muted-foreground flex items-center gap-2 mr-2">
              <Share2 size={14} /> Share
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={copyLink}
              className="rounded-none font-mono text-xs tracking-wide gap-2"
            >
              <Copy size={13} />
              {copied ? "Copied!" : "Copy link"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={shareX}
              className="rounded-none font-mono text-xs tracking-wide gap-2"
            >
              <XIcon size={13} />
              Post on X
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={shareFacebook}
              className="rounded-none font-mono text-xs tracking-wide gap-2"
            >
              <Facebook size={13} />
              Share on Facebook
            </Button>
          </div>
        </div>
      </article>
    </div>
  );
}
