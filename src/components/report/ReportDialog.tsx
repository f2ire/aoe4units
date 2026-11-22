// Community "Report" dialog. From a unit card: an editable replica of the card whose
// corrections pile up in a basket, sent in one go. From the footer: the "missing" blank card.
// The basket becomes a Report → lib/report/toPatch → Cloudflare Worker → Discord.

import { useCallback, useState, type ReactNode } from "react";
import { Check, ImageIcon, Plus, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PATCH_VERSION } from "@/lib/patchVersion";
import { buildReport } from "@/lib/report/toPatch";
import { REPORT_ENDPOINT, reportingConfigured } from "@/lib/report/config";
import { effectValueText, formatNumber, propertyLabel } from "@/lib/report/format";
import type { Report, ReportBody, ReportContext } from "@/lib/report/types";
import { MissingForm } from "./MissingForm";
import { ReportCard, type ViewMode } from "./ReportCard";
import { Turnstile } from "./Turnstile";

interface ReportDialogProps {
  context?: ReportContext;
  trigger: ReactNode;
}

type View = "card" | "missing" | "sent";
type Entry = { key: string; body: ReportBody };

// Basket line: what the visitor changed, in their words.
function describe(b: ReportBody, ctx?: ReportContext): { icon?: string; title: string; detail: string; tag?: string } {
  if (b.kind === "value") {
    const from = b.withUpgrades ? b.shown : b.base;
    return { icon: ctx?.unitIcon, title: b.statLabel, detail: `${formatNumber(from)} → ${formatNumber(b.expected)}`, tag: b.withUpgrades ? "with upgrades" : "base" };
  }
  if (b.kind === "upgrade") {
    const u = b.upgrade;
    const detail = b.hide
      ? (b.scope === "unit" ? `should not apply to ${b.unitName}` : "should not exist")
      : [...b.changes.map(c => `${propertyLabel(c.property)} ${effectValueText(u.effects[c.index], c.from)} → ${effectValueText(u.effects[c.index], c.to)}`), b.note && `“${b.note}”`].filter(Boolean).join(" · ");
    return { icon: u.icon, title: u.name, detail, tag: b.scope === "unit" ? `only ${b.unitName}` : "all units" };
  }
  if (b.kind === "icon") {
    return { icon: b.newIcon || b.target.currentIcon, title: `Icon — ${b.target.name}`, detail: b.newIcon ? "new image" : "broken icon" };
  }
  return { title: `New ${b.what === "tech" ? "technology" : b.what}: ${b.name}`, detail: `${b.civs.join(", ")} · age ${b.age}${b.effects.length ? ` · ${b.effects.length} effect${b.effects.length > 1 ? "s" : ""}` : ""}` };
}

export function ReportDialog({ context, trigger }: ReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>(context ? "card" : "missing");
  const [mode, setMode] = useState<ViewMode>("upgrades");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [source, setSource] = useState("");
  const [reporter, setReporter] = useState("");
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [token, setToken] = useState<string | null>(null);
  // Turnstile tokens are single-use: bump to remount the widget for a fresh one.
  const [turnstileKey, setTurnstileKey] = useState(0);
  const onToken = useCallback((t: string | null) => setToken(t), []);

  const corrections = new Map(entries.map(e => [e.key, e.body]));
  const upsert = (key: string, body: ReportBody) =>
    setEntries(prev => (prev.some(e => e.key === key) ? prev.map(e => (e.key === key ? { key, body } : e)) : [...prev, { key, body }]));
  const remove = (key: string) => setEntries(prev => prev.filter(e => e.key !== key));

  const freshTurnstile = () => { setToken(null); setTurnstileKey(k => k + 1); };
  const resetAll = () => { setEntries([]); setView(context ? "card" : "missing"); freshTurnstile(); };

  const makeReport = (): Report => ({
    id: Math.random().toString(36).slice(2, 8),
    createdAt: new Date().toISOString(),
    context,
    corrections: entries.map(e => e.body),
    source: source.trim() || undefined,
    reporter: reporter.trim() || undefined,
    appVersion: PATCH_VERSION,
  });

  const copyFallback = async (patch: string, why: string) => {
    try {
      await navigator.clipboard.writeText(patch);
      toast.message("Report copied to your clipboard", { description: `${why} Paste it in the aoe4units Discord.` });
    } catch {
      toast.error(why, { description: "Copying to the clipboard failed too." });
    }
  };

  const send = async () => {
    if (!entries.length) return;
    const report = makeReport();
    const built = buildReport(report);
    if (!reportingConfigured()) { await copyFallback(built.patch, "Sending reports is not switched on yet."); return; }
    if (!token) { toast.error("Please complete the quick anti-bot check above the button."); return; }

    setSending(true);
    try {
      const res = await fetch(REPORT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turnstileToken: token, title: built.title, summary: built.summary, patch: built.patch, report }),
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      setSentCount(entries.length);
      setEntries([]);
      setView("sent");
      window.goatcounter?.count?.({ path: "report-sent", title: "Community report sent", event: true });
    } catch (err) {
      toast.error("Your report could not be sent", {
        description: err instanceof Error ? err.message : String(err),
        action: { label: "Copy it instead", onClick: () => copyFallback(built.patch, "Sending failed.") },
      });
    } finally {
      setSending(false);
      freshTurnstile();
    }
  };

  const n = entries.length;
  return (
    <Dialog open={open} onOpenChange={o => {
      setOpen(o);
      if (o && context) setView("card"); // reopening from a unit card always starts on that unit
      if (!o && view === "sent") resetAll();
    }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-xl grid-cols-[minmax(0,1fr)] gap-0 overflow-y-auto overscroll-contain p-0">
        <DialogHeader className="sticky top-0 z-10 border-b border-border/40 bg-background/95 px-4 pb-3 pt-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
          <DialogTitle className="pr-6 font-serif text-lg">
            {view === "sent" ? "Thank you" : context && view === "card" ? "Correct this unit" : "Something missing?"}
          </DialogTitle>
          {view !== "sent" && (
            <DialogDescription className="text-xs">
              {context && view === "card"
                ? "Click any number, the icon or a technology to fix it. Send everything in one report."
                : "Describe the unit, technology or ability the site does not have yet."}
            </DialogDescription>
          )}
        </DialogHeader>

        {view === "sent" ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center animate-in fade-in-0 zoom-in-95 duration-300">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-primary"><Check className="h-7 w-7" /></span>
            <p className="font-serif text-lg font-semibold">{sentCount} correction{sentCount > 1 ? "s" : ""} sent</p>
            <p className="max-w-xs text-sm text-muted-foreground">It goes to the maintainer as a ready-to-apply data patch and will ship in a future update.</p>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" onClick={resetAll}>Report something else</Button>
              <Button onClick={() => { setOpen(false); resetAll(); }}>Close</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5 px-4 py-4 sm:px-6">
            {view === "card" && context && (
              <>
                <ReportCard context={context} mode={mode} onModeChange={setMode} corrections={corrections} upsert={upsert} remove={remove} />
                <button type="button" onClick={() => setView("missing")} className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground">
                  <Sparkles className="h-3.5 w-3.5" />A unit, technology or ability is missing
                </button>
              </>
            )}
            {view === "missing" && (
              <MissingForm
                defaultCiv={context?.civ}
                defaultAge={context?.age}
                contextUnitName={context?.unitName}
                onAdd={r => { upsert(`missing:${Date.now()}`, r); if (context) setView("card"); else toast.success("Added — add another or send below."); }}
                onCancel={context ? () => setView("card") : undefined}
              />
            )}

            <section aria-label="Your corrections" aria-live="polite">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
                Your corrections
                {n > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 text-primary-foreground tabular-nums">{n}</span>}
              </h4>
              {n === 0 ? (
                <p className="rounded-md border border-dashed border-border/60 px-3 py-3 text-center text-xs text-muted-foreground">
                  {view === "card" ? "Nothing yet. Click a dotted value above to correct it." : "Nothing yet. Fill the card above and add it."}
                </p>
              ) : (
                <ul className="divide-y divide-border/30 rounded-md border border-border/50">
                  {entries.map(({ key, body }) => {
                    const d = describe(body, context);
                    return (
                      <li key={key} className="flex items-center gap-2.5 px-2.5 py-2 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                        {d.icon
                          ? <img src={d.icon} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                          : <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-muted text-muted-foreground">{body.kind === "icon" ? <ImageIcon className="h-4 w-4" /> : <Plus className="h-4 w-4" />}</span>}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{d.title}{d.tag && <span className="ml-1.5 text-[11px] text-muted-foreground">· {d.tag}</span>}</p>
                          <p className="line-clamp-2 text-xs tabular-nums text-primary">{d.detail}</p>
                        </div>
                        <button type="button" onClick={() => remove(key)} aria-label={`Remove: ${d.title}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium">Proof <span className="font-normal text-muted-foreground">(optional)</span></span>
                <Input value={source} onChange={e => setSource(e.target.value)} placeholder="Screenshot or patch-notes link" />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-medium">Your Discord name <span className="font-normal text-muted-foreground">(to credit you)</span></span>
                <Input value={reporter} onChange={e => setReporter(e.target.value)} />
              </label>
            </div>

            {reportingConfigured() && open && n > 0 && <Turnstile key={turnstileKey} onToken={onToken} />}

            <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t border-border/40 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={send} disabled={n === 0 || sending}>
                <Send className="h-4 w-4" />
                {sending ? "Sending…" : n === 0 ? "Send" : `Send ${n} correction${n > 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
