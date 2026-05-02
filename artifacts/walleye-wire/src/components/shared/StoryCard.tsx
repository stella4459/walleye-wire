import { useState } from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, ExternalLink, Calendar as CalendarIcon, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Story } from "@workspace/api-client-react";

interface StoryCardProps {
  story: Story;
  index?: number;
}

export function StoryCard({ story, index = 0 }: StoryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const panelId = `story-panel-${story.id}`;
  const formattedDate = story.story_date ? format(new Date(story.story_date), "MMM d, yyyy") : "";

  return (
    <motion.article 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="group relative flex flex-col bg-card rounded-sm border border-border overflow-hidden hover:shadow-md transition-shadow duration-300"
    >
      <div className="p-6 flex-grow flex flex-col">
        <div className="flex justify-between items-start mb-3 gap-4">
          <div className="flex flex-wrap gap-2">
            {story.source_tag && (
              <Badge
                variant="outline"
                className={
                  story.is_council
                    ? "bg-primary/10 text-primary hover:bg-primary/20 font-mono text-[10px] tracking-wide border-primary/20 rounded-none"
                    : "font-mono text-[10px] tracking-wide rounded-none bg-accent text-accent-foreground border-border"
                }
              >
                {story.source_tag.toUpperCase()}
              </Badge>
            )}
          </div>
          {formattedDate && (
            <span className="text-xs font-mono text-muted-foreground whitespace-nowrap flex items-center gap-1">
              <CalendarIcon size={12} aria-hidden="true" />
              {formattedDate}
            </span>
          )}
        </div>

        <h2 className="font-headline text-2xl leading-tight mb-3 text-foreground group-hover:text-primary transition-colors">
          {story.headline}
        </h2>

        {story.summary && (
          <p className="font-serif text-sm text-muted-foreground leading-relaxed mb-4 flex-grow">
            {story.summary}
          </p>
        )}

        <div className="mt-auto pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-border/50">
          <div className="flex items-center gap-2 text-xs font-sans text-muted-foreground">
            {story.source_name && (
              <span className="font-semibold uppercase tracking-wider text-foreground/80">{story.source_name}</span>
            )}
            {story.source_url && (
              <>
                <span className="opacity-50">•</span>
                <a 
                  href={story.source_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-primary inline-flex items-center gap-1 transition-colors"
                >
                  View source <ExternalLink size={10} />
                </a>
              </>
            )}
          </div>

          {(story.body || (story.council_votes && story.council_votes.length > 0)) && (
            <button 
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              aria-controls={panelId}
              aria-label={expanded ? `Collapse: ${story.headline}` : `Read full story: ${story.headline}`}
              className="text-xs font-sans font-bold tracking-widest uppercase text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
            >
              {expanded ? "Close" : "Read"} 
              <span aria-hidden="true">
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </span>
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            id={panelId}
            role="region"
            aria-label={story.headline}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden bg-accent/30 border-t border-border"
          >
            <div className="p-6">
              {story.council_votes && story.council_votes.length > 0 && (
                <div className="mb-6 space-y-3">
                  <h3 className="font-sans font-bold text-sm tracking-widest uppercase text-foreground border-b border-border pb-2">Council Actions</h3>
                  <ul className="space-y-2">
                    {story.council_votes.map((vote: { motion: string; vote: string }, i: number) => (
                      <li key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-card p-3 border border-border rounded-sm">
                        <span className="font-serif text-sm font-medium">{vote.motion}</span>
                        <Badge 
                          className={`rounded-none font-mono text-[10px] tracking-widest self-start sm:self-auto ${
                            vote.vote.toUpperCase() === 'PASSED' ? 'bg-green-600/10 text-green-700 hover:bg-green-600/20 border-green-600/20' :
                            vote.vote.toUpperCase() === 'FAILED' ? 'bg-red-600/10 text-red-700 hover:bg-red-600/20 border-red-600/20' :
                            'bg-gray-500/10 text-gray-700 hover:bg-gray-500/20 border-gray-500/20'
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
                <div className="prose prose-sm md:prose-base prose-p:font-serif prose-headings:font-headline max-w-none text-foreground prose-a:text-primary">
                  {story.body.split('\n\n').map((paragraph: string, i: number) => (
                    <p key={i} className="leading-relaxed mb-4">{paragraph}</p>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
