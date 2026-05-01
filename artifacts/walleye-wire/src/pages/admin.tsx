import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useGetStories, getGetStoriesQueryKey, useGetEvents, getGetEventsQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Lock, Trash2, CheckCircle, RefreshCw, FileText, Send } from "lucide-react";

export default function Admin() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [manualText, setManualText] = useState("");
  const [manualCategory, setManualCategory] = useState("Community");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const savedPassword = sessionStorage.getItem("admin_password");
    if (savedPassword) {
      setPassword(savedPassword);
      verifyPassword(savedPassword);
    }
  }, []);

  const verifyPassword = async (pass: string) => {
    setIsAuthenticating(true);
    try {
      const res = await fetch("/api/healthz", {
        headers: { "X-Admin-Password": pass }
      });
      if (res.ok) {
        setIsAuthenticated(true);
        sessionStorage.setItem("admin_password", pass);
      } else {
        toast({ title: "Auth Failed", description: "Invalid admin password.", variant: "destructive" });
        sessionStorage.removeItem("admin_password");
      }
    } catch (e) {
      toast({ title: "Error", description: "Could not connect to server.", variant: "destructive" });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    verifyPassword(password);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("admin_password");
    setIsAuthenticated(false);
    setPassword("");
  };

  const { data: stories } = useGetStories({}, { query: { enabled: isAuthenticated, queryKey: getGetStoriesQueryKey() } });
  const { data: events } = useGetEvents({ all: "1" }, { query: { enabled: isAuthenticated, queryKey: getGetEventsQueryKey({ all: "1" }) } });

  const adminFetch = async (url: string, method: string = "POST", body?: any) => {
    const res = await fetch(url, {
      method,
      headers: {
        "X-Admin-Password": password,
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw new Error("Request failed");
    return res.json();
  };

  const onFetchNews = async () => {
    try {
      await adminFetch("/api/stories/fetch");
      toast({ title: "Success", description: "Triggered news fetch" });
      queryClient.invalidateQueries({ queryKey: getGetStoriesQueryKey() });
    } catch (e) {
      toast({ title: "Error", description: "Failed to fetch news", variant: "destructive" });
    }
  };

  const onFetchGovDocs = async () => {
    try {
      await adminFetch("/api/gov/fetch");
      toast({ title: "Success", description: "Triggered gov doc fetch" });
      queryClient.invalidateQueries({ queryKey: getGetStoriesQueryKey() });
    } catch (e) {
      toast({ title: "Error", description: "Failed to fetch gov docs", variant: "destructive" });
    }
  };

  const onDeleteStory = async (id: number) => {
    try {
      await adminFetch(`/api/stories/${id}`, "DELETE");
      toast({ title: "Deleted", description: `Story ${id} deleted` });
      queryClient.invalidateQueries({ queryKey: getGetStoriesQueryKey() });
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete story", variant: "destructive" });
    }
  };

  const onApproveEvent = async (id: number) => {
    try {
      await adminFetch(`/api/events/approve/${id}`, "POST");
      toast({ title: "Approved", description: `Event ${id} approved` });
      queryClient.invalidateQueries({ queryKey: getGetEventsQueryKey() });
    } catch (e) {
      toast({ title: "Error", description: "Failed to approve event", variant: "destructive" });
    }
  };

  const onDeleteEvent = async (id: number) => {
    try {
      await adminFetch(`/api/events/${id}`, "DELETE");
      toast({ title: "Deleted", description: `Event ${id} deleted` });
      queryClient.invalidateQueries({ queryKey: getGetEventsQueryKey() });
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete event", variant: "destructive" });
    }
  };

  const onSubmitManualStory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminFetch("/api/stories/submit", "POST", { text: manualText, category: manualCategory });
      toast({ title: "Success", description: "Story submitted for processing" });
      setManualText("");
    } catch (e) {
      toast({ title: "Error", description: "Failed to submit story", variant: "destructive" });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-md">
        <div className="bg-card border-2 border-foreground p-8 text-center">
          <Lock className="mx-auto mb-4 text-muted-foreground" size={32} />
          <h1 className="font-headline text-3xl mb-6 uppercase">Editorial Access</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <Input 
              type="password" 
              placeholder="Admin Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-none text-center font-mono"
            />
            <Button type="submit" disabled={isAuthenticating} className="w-full rounded-none font-bold uppercase tracking-widest">
              {isAuthenticating ? "Verifying..." : "Unlock"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <header className="mb-8 border-b-2 border-foreground pb-4 flex justify-between items-end">
        <div>
          <h1 className="font-headline text-5xl md:text-6xl font-bold text-foreground tracking-tight uppercase">
            Newsroom
          </h1>
          <p className="font-serif text-lg text-muted-foreground mt-4">
            Admin console. Use with caution.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout} className="rounded-none font-mono text-xs uppercase">
          Lock
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-card border border-border p-6">
            <h2 className="font-headline text-2xl mb-4 border-b border-border pb-2">All Stories</h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {stories?.map(story => (
                <div key={story.id} className="flex items-center justify-between p-3 border border-border bg-background hover:bg-muted/30 transition-colors">
                  <div className="min-w-0 flex-1 mr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px] rounded-none font-mono">{story.category}</Badge>
                      <span className="font-mono text-xs text-muted-foreground">{format(new Date(story.story_date || new Date()), "MM/dd/yyyy")}</span>
                    </div>
                    <p className="font-serif text-sm font-bold truncate">{story.headline}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => onDeleteStory(story.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-card border border-border p-6">
            <h2 className="font-headline text-2xl mb-4 border-b border-border pb-2">Event Queue</h2>
            <div className="space-y-2">
              {events?.filter(e => !e.approved).length === 0 ? (
                <p className="font-mono text-sm text-muted-foreground py-4">No pending events.</p>
              ) : (
                events?.filter(e => !e.approved).map(event => (
                  <div key={event.id} className="p-4 border border-warning bg-warning/5">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-serif font-bold">{event.title}</h3>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => onApproveEvent(event.id)} className="h-8 text-green-600 border-green-600 hover:bg-green-50 rounded-none">
                          <CheckCircle size={14} className="mr-1" /> Approve
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => onDeleteEvent(event.id)} className="h-8 text-destructive border-destructive hover:bg-destructive/10 rounded-none">
                          <Trash2 size={14} className="mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">
                      {format(new Date(event.event_date), "MMM d, yyyy")} • {event.submitted_by || "Anonymous"}
                    </p>
                    {event.description && <p className="font-serif text-sm mt-2 line-clamp-2">{event.description}</p>}
                  </div>
                ))
              )}
            </div>
            
            <h3 className="font-sans font-bold text-sm tracking-widest uppercase mt-8 mb-4">Approved Events</h3>
            <div className="space-y-2">
               {events?.filter(e => e.approved).map(event => (
                  <div key={event.id} className="flex items-center justify-between p-3 border border-border bg-background">
                    <div className="min-w-0 flex-1 mr-4">
                      <p className="font-serif text-sm font-bold truncate">{event.title}</p>
                      <span className="font-mono text-xs text-muted-foreground">{format(new Date(event.event_date), "MM/dd/yyyy")}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => onDeleteEvent(event.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="bg-card border-2 border-foreground p-6">
            <h2 className="font-headline text-2xl mb-4 border-b border-border pb-2 uppercase">Triggers</h2>
            <div className="space-y-4">
              <Button onClick={onFetchNews} className="w-full justify-start rounded-none font-bold tracking-widest uppercase">
                <RefreshCw size={16} className="mr-2" /> Fetch News RSS
              </Button>
              <Button onClick={onFetchGovDocs} className="w-full justify-start rounded-none font-bold tracking-widest uppercase">
                <FileText size={16} className="mr-2" /> Fetch Gov Docs
              </Button>
            </div>
          </section>

          <section className="bg-card border border-border p-6">
            <h2 className="font-headline text-2xl mb-4 border-b border-border pb-2 uppercase">Manual Entry</h2>
            <form onSubmit={onSubmitManualStory} className="space-y-4">
              <div>
                <label className="font-sans font-bold text-xs tracking-widest uppercase mb-2 block">Category</label>
                <select 
                  value={manualCategory} 
                  onChange={(e) => setManualCategory(e.target.value)}
                  className="w-full border border-border bg-background p-2 font-mono text-sm rounded-none focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option>Community</option>
                  <option>Government</option>
                  <option>General</option>
                </select>
              </div>
              <div>
                <label className="font-sans font-bold text-xs tracking-widest uppercase mb-2 block">Raw Text / Notes</label>
                <Textarea 
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="Paste raw text here for AI to format into a story..."
                  className="min-h-[200px] rounded-none font-mono text-sm"
                  required
                />
              </div>
              <Button type="submit" className="w-full rounded-none font-bold tracking-widest uppercase">
                <Send size={16} className="mr-2" /> Process Story
              </Button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
