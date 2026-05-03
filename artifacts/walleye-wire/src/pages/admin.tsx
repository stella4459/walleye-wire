import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useGetStories, getGetStoriesQueryKey, useGetEvents, getGetEventsQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RichTextEditor, type RichTextEditorRef } from "@/components/shared/RichTextEditor";
import { Lock, Trash2, CheckCircle, RefreshCw, FileText, Send, Sparkles, Upload, Zap } from "lucide-react";

function safeDateFormat(dateStr: string | null | undefined, fmt: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return format(d, fmt);
  } catch {
    return dateStr;
  }
}

export default function Admin() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [manualHeadline, setManualHeadline] = useState("");
  const [manualSummary, setManualSummary] = useState("");
  const [manualBodyHtml, setManualBodyHtml] = useState("");
  const [manualCategory, setManualCategory] = useState("Community");
  const [manualSourceUrl, setManualSourceUrl] = useState("");
  const [directPublish, setDirectPublish] = useState(false);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [manualDate, setManualDate] = useState(() => {
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  });
  const editorRef = useRef<RichTextEditorRef>(null);
  const [isRunningAI, setIsRunningAI] = useState(false);
  const [isCheckingGov, setIsCheckingGov] = useState(false);
  const [isLoadingGov, setIsLoadingGov] = useState(false);
  const [isResettingGov, setIsResettingGov] = useState(false);
  const [isRegeneratingSum, setIsRegeneratingSum] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  
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

  const onRunAIRefresh = async () => {
    setIsRunningAI(true);
    try {
      await adminFetch("/api/stories/fetch");
      queryClient.invalidateQueries({ queryKey: getGetStoriesQueryKey() });
      toast({ title: "AI Refresh Complete", description: "Claude has fetched the latest news." });
    } catch (e) {
      toast({ title: "AI Refresh Failed", description: "News fetch encountered an error.", variant: "destructive" });
    } finally {
      setIsRunningAI(false);
    }
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

  const onCheckGov = async () => {
    setIsCheckingGov(true);
    try {
      const result = await adminFetch("/api/gov/fetch");
      const added = result?.added ?? 0;
      toast({ title: "Gov Check Complete", description: added > 0 ? `${added} new document(s) added.` : "No new documents found." });
      queryClient.invalidateQueries({ queryKey: getGetStoriesQueryKey() });
    } catch (e) {
      toast({ title: "Error", description: "Failed to check for new gov docs", variant: "destructive" });
    } finally {
      setIsCheckingGov(false);
    }
  };

  const onInitialLoadGov = async () => {
    setIsLoadingGov(true);
    try {
      const result = await adminFetch("/api/gov/backfill");
      const added = result?.added ?? 0;
      toast({ title: "Initial Load Complete", description: `${added} document(s) imported from Google Sheet.` });
      queryClient.invalidateQueries({ queryKey: getGetStoriesQueryKey() });
    } catch (e) {
      toast({ title: "Error", description: "Failed to run initial load", variant: "destructive" });
    } finally {
      setIsLoadingGov(false);
    }
  };

  const onRegenerateSum = async () => {
    setIsRegeneratingSum(true);
    try {
      await adminFetch("/api/gov/summary/regenerate", "POST");
      toast({ title: "Summary Updated", description: "60-day gov digest has been regenerated." });
    } catch (e) {
      toast({ title: "Error", description: "Failed to regenerate summary", variant: "destructive" });
    } finally {
      setIsRegeneratingSum(false);
    }
  };

  const onResetGov = async () => {
    if (!window.confirm("This will DELETE all existing government documents and re-import from the Google Sheet. Continue?")) return;
    setIsResettingGov(true);
    try {
      const result = await adminFetch("/api/gov/reset");
      const { deleted = 0, added = 0 } = result ?? {};
      toast({ title: "Reset Complete", description: `Deleted ${deleted} old doc(s), imported ${added} from Google Sheet.` });
      queryClient.invalidateQueries({ queryKey: getGetStoriesQueryKey() });
    } catch (e) {
      toast({ title: "Error", description: "Reset failed", variant: "destructive" });
    } finally {
      setIsResettingGov(false);
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

  const resetManualForm = () => {
    setManualHeadline("");
    setManualSummary("");
    setManualBodyHtml("");
    setManualSourceUrl("");
    setManualDate(new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }));
    editorRef.current?.reset();
  };

  const onSubmitManualStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (directPublish && !manualHeadline.trim()) {
      toast({ title: "Headline required", description: "Enter a headline to publish directly.", variant: "destructive" });
      return;
    }
    setIsSubmittingManual(true);
    try {
      if (directPublish) {
        await adminFetch("/api/stories/submit", "POST", {
          text: "",
          category: manualCategory,
          direct_publish: true,
          headline: manualHeadline.trim(),
          summary: manualSummary.trim(),
          body_html: manualBodyHtml,
          ...(manualSourceUrl.trim() && { source_url: manualSourceUrl.trim() }),
          ...(manualDate && { story_date: manualDate }),
        });
        toast({ title: "Published!", description: "Article published directly without AI." });
      } else {
        const plainText = manualBodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        const fullText = manualHeadline.trim()
          ? `${manualHeadline.trim()}\n\n${plainText}`
          : plainText;
        await adminFetch("/api/stories/submit", "POST", {
          text: fullText,
          category: manualCategory,
          ...(manualSourceUrl.trim() && { source_url: manualSourceUrl.trim() }),
          ...(manualDate && { story_date: manualDate }),
        });
        toast({ title: "Submitted", description: "Story sent to AI for processing." });
      }
      resetManualForm();
      queryClient.invalidateQueries({ queryKey: getGetStoriesQueryKey() });
    } catch {
      toast({ title: "Error", description: "Failed to submit story", variant: "destructive" });
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const onUploadPdf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfFile) return;
    setIsUploadingPdf(true);
    try {
      const formData = new FormData();
      formData.append("pdf", pdfFile);
      const res = await fetch("/api/stories/upload-minutes", {
        method: "POST",
        headers: { "X-Admin-Password": password },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || "Upload failed");
      }
      const data = await res.json();
      toast({ title: "PDF Processed", description: `Story created: ${data.headline}` });
      setPdfFile(null);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: getGetStoriesQueryKey() });
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message || "Could not process PDF", variant: "destructive" });
    } finally {
      setIsUploadingPdf(false);
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
                      <span className="font-mono text-xs text-muted-foreground">{safeDateFormat(story.story_date, "MM/dd/yyyy")}</span>
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
              <Button
                onClick={onRunAIRefresh}
                disabled={isRunningAI}
                className="w-full justify-center rounded-none font-bold tracking-widest uppercase bg-primary hover:bg-primary/85 text-white py-6 text-sm"
              >
                <Sparkles size={16} className={`mr-2 ${isRunningAI ? "animate-spin" : ""}`} />
                {isRunningAI ? "Claude Is Running…" : "Run AI Refresh"}
              </Button>
              <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
                Fetches latest news through Claude and updates all stories.
              </p>
              <div className="pt-2 border-t border-border space-y-3">
                <Button onClick={onFetchNews} variant="outline" className="w-full justify-start rounded-none font-mono text-xs uppercase tracking-widest">
                  <RefreshCw size={14} className="mr-2" /> News Only
                </Button>
              </div>
              <div className="pt-2 border-t border-border space-y-2">
                <p className="font-mono text-[11px] text-muted-foreground leading-relaxed uppercase tracking-widest">Government Documents (Google Sheet)</p>
                <Button
                  onClick={onCheckGov}
                  disabled={isCheckingGov || isLoadingGov}
                  variant="outline"
                  className="w-full justify-start rounded-none font-mono text-xs uppercase tracking-widest"
                >
                  <RefreshCw size={14} className={`mr-2 ${isCheckingGov ? "animate-spin" : ""}`} />
                  {isCheckingGov ? "Checking…" : "Check for New"}
                </Button>
                <Button
                  onClick={onInitialLoadGov}
                  disabled={isCheckingGov || isLoadingGov}
                  variant="outline"
                  className="w-full justify-start rounded-none font-mono text-xs uppercase tracking-widest border-amber-600/50 text-amber-700 hover:bg-amber-50"
                >
                  <FileText size={14} className={`mr-2 ${isLoadingGov ? "animate-spin" : ""}`} />
                  {isLoadingGov ? "Loading All…" : "Initial Load (Full Backfill)"}
                </Button>
                <Button
                  onClick={onResetGov}
                  disabled={isCheckingGov || isLoadingGov || isResettingGov}
                  variant="outline"
                  className="w-full justify-start rounded-none font-mono text-xs uppercase tracking-widest border-red-600/50 text-red-700 hover:bg-red-50"
                >
                  <Trash2 size={14} className={`mr-2 ${isResettingGov ? "animate-spin" : ""}`} />
                  {isResettingGov ? "Resetting…" : "Reset & Reload from Sheet"}
                </Button>
                <Button
                  onClick={onRegenerateSum}
                  disabled={isCheckingGov || isLoadingGov || isResettingGov || isRegeneratingSum}
                  variant="outline"
                  className="w-full justify-start rounded-none font-mono text-xs uppercase tracking-widest"
                >
                  <Sparkles size={14} className={`mr-2 ${isRegeneratingSum ? "animate-spin" : ""}`} />
                  {isRegeneratingSum ? "Regenerating…" : "Regenerate Homepage Digest"}
                </Button>
                <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
                  "Check for New" scans the sheet and stops at the first known doc. "Initial Load" imports every row — skip already-imported ones. "Reset & Reload" deletes all gov docs and re-imports fresh. "Regenerate Homepage Digest" re-runs the 60-day summary shown on the homepage.
                </p>
              </div>
            </div>
          </section>

          <section className="bg-card border border-border p-6">
            <h2 className="font-headline text-2xl mb-4 border-b border-border pb-2 uppercase">Upload PDF</h2>
            <p className="font-mono text-[11px] text-muted-foreground mb-4 leading-relaxed">
              Download a council minutes PDF from portclinton.com, then upload it here. Claude will read the actual content and write a summary.
            </p>
            <form onSubmit={onUploadPdf} className="space-y-4">
              <div
                className="border-2 border-dashed border-border p-6 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => pdfInputRef.current?.click()}
              >
                <Upload size={24} className="mx-auto mb-2 text-muted-foreground" />
                {pdfFile ? (
                  <p className="font-mono text-sm text-foreground font-bold truncate">{pdfFile.name}</p>
                ) : (
                  <p className="font-mono text-sm text-muted-foreground">Click to select a PDF file</p>
                )}
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <Button
                type="submit"
                disabled={!pdfFile || isUploadingPdf}
                className="w-full rounded-none font-bold tracking-widest uppercase"
              >
                {isUploadingPdf ? (
                  <><Sparkles size={16} className="mr-2 animate-spin" /> Claude Is Reading…</>
                ) : (
                  <><Upload size={16} className="mr-2" /> Send to Claude</>
                )}
              </Button>
            </form>
          </section>

          <section className="bg-card border border-border p-6">
            <h2 className="font-headline text-2xl mb-1 uppercase">Manual Entry</h2>
            <p className="font-mono text-xs text-muted-foreground mb-4 border-b border-border pb-4">
              Write or paste your article. Send to AI to generate a polished story, or publish directly as written.
            </p>
            <form onSubmit={onSubmitManualStory} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-sans font-bold text-xs tracking-widest uppercase mb-2 block">Category</label>
                  <select
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    className="w-full border border-border bg-background p-2 font-mono text-sm rounded-none focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option>Community</option>
                    <option>Government</option>
                    <option>Meeting Recap</option>
                    <option>Feature Story</option>
                    <option>General</option>
                  </select>
                </div>
                <div>
                  <label className="font-sans font-bold text-xs tracking-widest uppercase mb-2 block">Story Date</label>
                  <input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full border border-border bg-background p-2 font-mono text-sm rounded-none focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="font-sans font-bold text-xs tracking-widest uppercase mb-2 block">
                  Headline
                  {!directPublish && <span className="font-normal normal-case tracking-normal text-muted-foreground ml-2">(AI generates if left blank)</span>}
                  {directPublish && <span className="text-destructive ml-1">*</span>}
                </label>
                <input
                  type="text"
                  value={manualHeadline}
                  onChange={(e) => setManualHeadline(e.target.value)}
                  placeholder="Enter headline…"
                  required={directPublish}
                  className="w-full border border-border bg-background p-2 font-mono text-sm rounded-none focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {directPublish && (
                <div>
                  <label className="font-sans font-bold text-xs tracking-widest uppercase mb-2 block">
                    Summary <span className="font-normal normal-case tracking-normal text-muted-foreground">(optional — 1–2 sentence teaser)</span>
                  </label>
                  <textarea
                    value={manualSummary}
                    onChange={(e) => setManualSummary(e.target.value)}
                    placeholder="Short summary shown on the story card…"
                    rows={2}
                    className="w-full border border-border bg-background p-2 font-mono text-sm rounded-none focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                  />
                </div>
              )}

              <div>
                <label className="font-sans font-bold text-xs tracking-widest uppercase mb-2 block">
                  {directPublish ? "Article Body" : "Notes / Raw Text"}
                </label>
                <RichTextEditor
                  ref={editorRef}
                  onChange={setManualBodyHtml}
                  placeholder={directPublish ? "Write your article here…" : "Paste raw notes for AI to format into a story…"}
                  minHeight="220px"
                />
              </div>

              <div>
                <label className="font-sans font-bold text-xs tracking-widest uppercase mb-2 block">
                  Source URL <span className="font-normal normal-case tracking-normal text-muted-foreground">(optional)</span>
                </label>
                <input
                  type="url"
                  value={manualSourceUrl}
                  onChange={(e) => setManualSourceUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full border border-border bg-background p-2 font-mono text-sm rounded-none focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <label className="flex items-start gap-3 cursor-pointer p-3 border border-border bg-background hover:bg-accent/30 transition-colors">
                <input
                  type="checkbox"
                  checked={directPublish}
                  onChange={(e) => setDirectPublish(e.target.checked)}
                  className="mt-0.5 accent-primary w-4 h-4 flex-shrink-0"
                />
                <span>
                  <span className="font-sans font-bold text-sm tracking-wide flex items-center gap-2">
                    <Zap size={14} className="text-amber-600" /> Publish directly without AI
                  </span>
                  <span className="font-mono text-xs text-muted-foreground block mt-0.5">
                    Skips Claude — your text is published exactly as written. Headline is required.
                  </span>
                </span>
              </label>

              <Button
                type="submit"
                disabled={isSubmittingManual}
                className="w-full rounded-none font-bold tracking-widest uppercase"
              >
                {isSubmittingManual ? (
                  <><Sparkles size={16} className="mr-2 animate-spin" /> {directPublish ? "Publishing…" : "Processing…"}</>
                ) : directPublish ? (
                  <><Zap size={16} className="mr-2" /> Publish Directly</>
                ) : (
                  <><Send size={16} className="mr-2" /> Send to AI</>
                )}
              </Button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
