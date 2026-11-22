// Inline editor for one technology / ability: its effects are editable numbers,
// plus scope (this unit vs every unit), "should not apply / exist", and a free note.

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { effectTargetText, effectValueText, propertyLabel } from "@/lib/report/format";
import type { EffectChange, UpgradeReport, UpgradeSummary } from "@/lib/report/types";
import { EditableValue } from "./EditableValue";
import { Segmented } from "./Segmented";

interface UpgradeEditorProps {
  upgrade: UpgradeSummary;
  unitId: string;
  unitName: string;
  existing?: UpgradeReport;
  iconCorrected: boolean;
  onEditIcon: () => void;
  onSave: (r: UpgradeReport) => void;
  onRemove: () => void;
  onClose: () => void;
}

export function UpgradeEditor({ upgrade: u, unitId, unitName, existing, iconCorrected, onEditIcon, onSave, onRemove, onClose }: UpgradeEditorProps) {
  const [changes, setChanges] = useState<Map<number, number>>(() => new Map((existing?.changes ?? []).map(c => [c.index, c.to])));
  const [scope, setScope] = useState<UpgradeReport["scope"]>(existing?.scope ?? "unit");
  const [hide, setHide] = useState(existing?.hide ?? false);
  const [note, setNote] = useState(existing?.note ?? "");
  const [error, setError] = useState("");

  const setChange = (i: number, v: number | undefined) => {
    setError("");
    setChanges(prev => {
      const next = new Map(prev);
      if (v === undefined) next.delete(i); else next.set(i, v);
      return next;
    });
  };

  const save = () => {
    if (!hide && changes.size === 0 && !note.trim()) { setError("Change a number, mark it as not applying, or describe the problem."); return; }
    const list: EffectChange[] = [...changes].map(([index, to]) => ({ index, property: u.effects[index].property, from: u.effects[index].value, to }));
    onSave({ kind: "upgrade", upgrade: u, scope, unitId, unitName, changes: hide ? [] : list, hide, note: note.trim() });
  };

  const kindText = u.kind === "tech" ? "Technology" : "Ability";
  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-secondary/40 p-3 animate-in fade-in-0 slide-in-from-top-1 duration-200">
      <div className="flex items-start gap-3">
        <button type="button" onClick={onEditIcon} aria-label={`Fix the icon of ${u.name}`} className="group relative shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          {u.icon ? <img src={u.icon} alt="" className="h-12 w-12 rounded-md border border-border/60 object-cover" /> : <span className="block h-12 w-12 rounded-md border border-border/60" />}
          <span className={cn("absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border border-border bg-card", iconCorrected ? "text-primary" : "text-muted-foreground group-hover:text-foreground")}>
            <Pencil className="h-3 w-3" />
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-sm font-semibold leading-tight">{u.name}</p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{kindText}{u.active ? " · active" : ""}</p>
          {u.description && <p className="mt-1 text-xs text-muted-foreground">{u.description}</p>}
        </div>
      </div>

      {u.effects.length > 0 ? (
        <div className={cn("divide-y divide-border/30 rounded-md border border-border/40", hide && "opacity-40")}>
          {u.effects.map((e, i) => (
            <div key={i} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
              <div className="min-w-0 text-xs">
                <p className="font-medium text-foreground">{propertyLabel(e.property)}{e.target?.class?.length ? ` vs ${e.target.class.map(g => g.join(" ")).join(", ")}` : ""}</p>
                <p className="truncate text-muted-foreground">{effectTargetText(e)}{e.duration ? ` · ${e.duration} s` : ""}</p>
              </div>
              <EditableValue
                label={propertyLabel(e.property)}
                value={e.value}
                corrected={changes.get(i)}
                onCommit={v => setChange(i, v)}
                onClear={() => setChange(i, undefined)}
                hint={v => effectValueText(e, v)}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">This {kindText.toLowerCase()} has no effect in the app yet — describe what it should do below.</p>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium">This correction concerns</span>
        <Segmented
          label="Correction scope"
          value={scope}
          onChange={v => setScope(v as UpgradeReport["scope"])}
          className="w-full"
          options={[{ value: "unit", label: `Only ${unitName}` }, { value: "all", label: "Every unit it affects" }]}
        />
      </div>

      <label className="flex items-center justify-between gap-3 text-xs">
        <span>{scope === "unit" ? `It should not apply to ${unitName}` : `This ${kindText.toLowerCase()} should not exist`}</span>
        <Switch checked={hide} onCheckedChange={setHide} aria-label="Should not apply" />
      </label>

      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium">Anything else? <span className="font-normal text-muted-foreground">(optional)</span></span>
        <Textarea rows={2} value={note} onChange={e => { setNote(e.target.value); setError(""); }} placeholder="e.g. In game it also gives +1 range" />
      </label>

      {error && <p className="text-xs text-red-400" role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        {existing && <Button type="button" variant="ghost" size="sm" onClick={onRemove}>Remove correction</Button>}
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Close</Button>
        <Button type="button" size="sm" onClick={save}>{existing ? "Update" : "Add to corrections"}</Button>
      </div>
    </div>
  );
}
