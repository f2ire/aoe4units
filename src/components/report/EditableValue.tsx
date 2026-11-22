// A number on the report card that turns into an inline field on click.
// Enter / ✓ commits, Esc / ✕ cancels; a corrected value shows "old → new" with an undo.

import { useEffect, useRef, useState } from "react";
import { Check, Pencil, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/report/format";

interface EditableValueProps {
  label: string;
  value: number;
  corrected?: number;
  onCommit: (v: number) => void;
  onClear: () => void;
  /** Rendered under the number (e.g. "+15%"); receives the value being shown. */
  hint?: (v: number) => string;
  className?: string;
}

const parse = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(",", ".")));

export function EditableValue({ label, value, corrected, onCommit, onClear, hint, className }: EditableValueProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) input.current?.select(); }, [editing]);

  const start = () => { setDraft(formatNumber(corrected ?? value)); setEditing(true); };
  const cancel = () => setEditing(false);
  const commit = () => {
    const v = parse(draft);
    setEditing(false);
    if (Number.isNaN(v)) return;
    if (Math.abs(v - value) < 1e-9) { onClear(); return; }
    onCommit(v);
  };

  if (editing) {
    return (
      <span className={cn("flex items-center justify-end gap-1", className)}>
        <input
          ref={input}
          type="text"
          inputMode="decimal"
          aria-label={`New value for ${label}`}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cancel(); } }}
          className="h-8 w-20 rounded-md border border-primary/70 bg-background px-2 text-right text-sm tabular-nums text-foreground outline-none ring-2 ring-primary/25"
        />
        <button type="button" onClick={commit} aria-label="Confirm" className="grid h-8 w-8 place-items-center rounded-md text-primary hover:bg-primary/15">
          <Check className="h-4 w-4" />
        </button>
        <button type="button" onClick={cancel} aria-label="Cancel" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </span>
    );
  }

  const isCorrected = corrected !== undefined;
  const shown = corrected ?? value;
  return (
    <span className={cn("flex flex-col items-end", className)}>
      <span className="flex items-center gap-1">
        {isCorrected && <s className="text-xs tabular-nums text-muted-foreground">{formatNumber(value)}</s>}
        <button
          type="button"
          onClick={start}
          aria-label={`Edit ${label}, currently ${formatNumber(shown)}`}
          className={cn(
            "group/value flex min-h-8 items-center gap-1.5 rounded-md px-1.5 text-sm tabular-nums transition-colors",
            "underline decoration-dotted decoration-muted-foreground/50 underline-offset-4 hover:bg-primary/10 hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            isCorrected ? "font-semibold text-primary" : "text-foreground",
          )}
        >
          {isCorrected && <span aria-hidden className="text-muted-foreground no-underline">→</span>}
          {formatNumber(shown)}
          <Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/value:opacity-100 group-focus-visible/value:opacity-100" aria-hidden />
        </button>
        {isCorrected && (
          <button type="button" onClick={onClear} aria-label={`Undo correction of ${label}`} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
            <Undo2 className="h-3.5 w-3.5" />
          </button>
        )}
      </span>
      {hint && <span className="pr-1.5 text-[11px] text-muted-foreground">{hint(shown)}</span>}
    </span>
  );
}
