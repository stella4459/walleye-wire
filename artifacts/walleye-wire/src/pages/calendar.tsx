import { useGetEvents, getGetEventsQueryKey, useSubmitEvent } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock, MapPin } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const eventSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters").max(100),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  event_time: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  submitted_by: z.string().optional(),
});

type EventFormValues = z.infer<typeof eventSchema>;

export default function Calendar() {
  const { data: events, isLoading } = useGetEvents({ all: "0" }, { query: { queryKey: getGetEventsQueryKey({ all: "0" }) } });
  const { toast } = useToast();
  
  const submitEvent = useSubmitEvent();
  
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: "",
      event_date: "",
      event_time: "",
      location: "",
      description: "",
      submitted_by: "",
    },
  });

  function onSubmit(data: EventFormValues) {
    submitEvent.mutate({ data }, {
      onSuccess: () => {
        toast({
          title: "Event Submitted",
          description: "Your event has been submitted and is pending approval by our editors.",
        });
        form.reset();
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to submit event. Please try again.",
          variant: "destructive",
        });
      }
    });
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <header className="mb-12 border-b-2 border-foreground pb-4">
        <h1 className="font-headline text-5xl md:text-6xl font-bold text-foreground tracking-tight uppercase">
          Community Calendar
        </h1>
        <p className="font-serif text-lg text-muted-foreground mt-4">
          Upcoming events around Port Clinton and Ottawa County.
        </p>
      </header>

      <div className="mb-16">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-sm" />
            ))}
          </div>
        ) : events && events.length > 0 ? (
          <div className="space-y-4">
            {events.map((event) => (
              <div key={event.id} className="bg-card border border-border p-6 flex flex-col md:flex-row gap-6 hover:shadow-md transition-shadow">
                <div className="md:w-48 flex-shrink-0 flex flex-col justify-center items-center bg-muted/50 p-4 border border-border text-center">
                  <span className="font-sans font-bold text-sm uppercase tracking-widest text-primary mb-1">
                    {format(new Date(event.event_date), "MMM")}
                  </span>
                  <span className="font-headline text-4xl leading-none">
                    {format(new Date(event.event_date), "dd")}
                  </span>
                </div>
                <div className="flex-grow">
                  {event.url ? (
                    <a
                      href={event.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-headline text-2xl mb-2 text-foreground hover:text-primary transition-colors block"
                    >
                      {event.title}
                    </a>
                  ) : (
                    <h3 className="font-headline text-2xl mb-2 text-foreground">{event.title}</h3>
                  )}

                  <div className="flex flex-wrap gap-4 text-sm font-mono text-muted-foreground mb-4">
                    {event.event_time && (
                      <span className="flex items-center gap-1">
                        <Clock size={14} /> {event.event_time}
                      </span>
                    )}
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={14} /> {event.location}
                      </span>
                    )}
                  </div>
                  
                  {event.description && (
                    <p className="font-serif text-sm text-foreground/80">{event.description}</p>
                  )}
                  {event.source && (
                    <p className="font-sans text-xs font-bold uppercase tracking-widest text-muted-foreground mt-4">
                      {event.url ? (
                        <a href={event.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                          Via {event.source} ↗
                        </a>
                      ) : (
                        <>Source: {event.source}</>
                      )}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-muted/30 border border-border rounded-sm">
            <p className="font-serif text-lg text-muted-foreground">No upcoming events on the calendar.</p>
          </div>
        )}
      </div>

      <div className="max-w-2xl bg-card border-2 border-foreground p-8 rounded-sm">
        <h2 className="font-headline text-3xl mb-2 uppercase">Submit an Event</h2>
        <p className="font-serif text-sm text-muted-foreground mb-6">
          Hosting something? Let the county know. All submissions are reviewed before publishing.
        </p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 font-sans">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase tracking-widest text-xs font-bold">Event Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="Walleye Festival" className="rounded-none border-border focus-visible:ring-primary" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="event_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase tracking-widest text-xs font-bold">Date (YYYY-MM-DD) *</FormLabel>
                    <FormControl>
                      <Input placeholder="2025-05-25" className="rounded-none border-border focus-visible:ring-primary font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="event_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase tracking-widest text-xs font-bold">Time</FormLabel>
                    <FormControl>
                      <Input placeholder="10:00 AM" className="rounded-none border-border focus-visible:ring-primary" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase tracking-widest text-xs font-bold">Location</FormLabel>
                  <FormControl>
                    <Input placeholder="Waterworks Park" className="rounded-none border-border focus-visible:ring-primary" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase tracking-widest text-xs font-bold">Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Details about the event..." className="rounded-none border-border focus-visible:ring-primary min-h-[100px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="submitted_by"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase tracking-widest text-xs font-bold">Your Name / Organization</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" className="rounded-none border-border focus-visible:ring-primary" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              disabled={submitEvent.isPending}
              className="w-full rounded-none font-bold tracking-widest uppercase bg-foreground text-background hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              {submitEvent.isPending ? "Submitting..." : "Submit Event"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
