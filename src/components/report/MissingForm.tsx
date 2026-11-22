// "Missing" flow: a blank card to describe a unit, technology or ability the app does not have.

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CIVILIZATIONS } from "@/data/civilizations";
import { cn } from "@/lib/utils";
import type { MissingEffectRow, MissingReport, MissingUnitStats } from "@/lib/report/types";
import { Segmented } from "./Segmented";

const fieldCls = "flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const parse = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(",", ".")));

const EFFECT_STATS: { key: MissingEffectRow["stat"]; label: string }[] = [
  { key: "meleeAttack", label: "Melee damage" },
  { key: "rangedAttack", label: "Ranged damage" },
  { key: "hitpoints", label: "Health" },
  { key: "meleeArmor", label: "Melee armor" },
  { key: "rangedArmor", label: "Ranged armor" },
  { key: "attackSpeed", label: "Attack speed" },
  { key: "moveSpeed", label: "Move speed" },
  { key: "maxRange", label: "Range" },
  { key: "bonus", label: "Bonus damage vs…" },
];

const UNIT_FIELDS: [keyof MissingUnitStats, string, string?][] = [
  ["hitpoints", "Health"], ["damage", "Damage"], ["attackSpeed", "Attack speed", "s"], ["range", "Range", "tiles"],
  ["meleeArmor", "Melee armor"], ["rangedArmor", "Ranged armor"], ["moveSpeed", "Move speed"],
  ["food", "Food", "/resources/food.png"], ["wood", "Wood", "/resources/wood.png"], ["gold", "Gold", "/resources/gold.png"], ["stone", "Stone", "/resources/stone.png"],
];

const newRow = (): MissingEffectRow => ({ stat: "meleeAttack", mode: "flat", value: NaN, appliesTo: "unit", appliesToValue: "" });

function EffectRow({ row, onChange, onRemove, unitLabel }: { row: MissingEffectRow; onChange: (r: MissingEffectRow) => void; onRemove: () => void; unitLabel: string }) {
  return (
    <div className="space-y-2 rounded-md border border-border/50 p-2 animate-in fade-in-0 slide-in-from-top-1 duration-200">
      <div className="flex items-center gap-1.5">
        <select aria-label="Stat" className={cn(fieldCls, "min-w-0 flex-1")} value={row.stat} onChange={e => onChange({ ...row, stat: e.target.value as MissingEffectRow["stat"], mode: e.target.value === "bonus" ? "flat" : row.mode })}>
          {EFFECT_STATS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <button type="button" onClick={onRemove} aria-label="Remove this effect" className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <Segmented label="Amount type" value={row.stat === "bonus" ? "flat" : row.mode} onChange={m => row.stat !== "bonus" && onChange({ ...row, mode: m })}
          className="shrink-0" options={[{ value: "flat", label: "Flat" }, { value: "percent", label: "%" }]} />
        <Input aria-label="Amount" inputMode="decimal" className="h-9 min-w-0 flex-1 text-right tabular-nums" value={Number.isNaN(row.value) ? "" : row.value} placeholder={row.mode === "percent" ? "15" : "2"}
          onChange={e => onChange({ ...row, value: parse(e.target.value) })} />
      </div>
      {row.stat === "bonus" && (
        <Input aria-label="Bonus against" className="h-9" placeholder="Against which class? e.g. cavalry" value={row.bonusVs ?? ""} onChange={e => onChange({ ...row, bonusVs: e.target.value })} />
      )}
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[auto_1fr]">
        <select aria-label="Applies to" className={cn(fieldCls, "sm:w-auto")} value={row.appliesTo} onChange={e => onChange({ ...row, appliesTo: e.target.value as MissingEffectRow["appliesTo"] })}>
          <option value="unit">Applies to {unitLabel}</option>
          <option value="class">Applies to a class</option>
          <option value="ids">Applies to specific units</option>
        </select>
        {row.appliesTo !== "unit" && (
          <Input className="h-9" aria-label="Which units" placeholder={row.appliesTo === "class" ? "e.g. melee infantry, cavalry" : "e.g. Berserker, Hirdman"} value={row.appliesToValue} onChange={e => onChange({ ...row, appliesToValue: e.target.value })} />
        )}
      </div>
    </div>
  );
}

interface MissingFormProps {
  defaultCiv?: string;
  defaultAge?: number;
  contextUnitName?: string;
  onAdd: (r: MissingReport) => void;
  onCancel?: () => void;
}

export function MissingForm({ defaultCiv, defaultAge = 2, contextUnitName, onAdd, onCancel }: MissingFormProps) {
  const [what, setWhat] = useState<MissingReport["what"]>("ability");
  const [name, setName] = useState("");
  const [civs, setCivs] = useState<string[]>(defaultCiv ? [defaultCiv] : []);
  const [age, setAge] = useState(defaultAge);
  const [desc, setDesc] = useState("");
  const [rows, setRows] = useState<MissingEffectRow[]>([]);
  const [stats, setStats] = useState<MissingUnitStats>({ damageType: "melee" });
  const [error, setError] = useState("");

  const add = () => {
    if (!name.trim()) { setError("Give it a name."); return; }
    if (!civs.length) { setError("Pick at least one civilization."); return; }
    if (!desc.trim() && !rows.length && what !== "unit") { setError("Describe what it does or add an effect."); return; }
    if (rows.some(r => Number.isNaN(r.value))) { setError("Every effect needs an amount."); return; }
    onAdd({ kind: "missing", what, name: name.trim(), civs, age, description: desc.trim(), effects: rows, unitStats: what === "unit" ? stats : undefined });
  };

  const whatText = what === "unit" ? "unit" : what === "tech" ? "technology" : "ability";
  const unitLabel = what === "unit" ? (name.trim() || "this unit") : (contextUnitName ?? "the unit");
  return (
    <section aria-label="Something missing" className="space-y-4 rounded-lg border-2 border-dashed border-primary/50 bg-card p-3 sm:p-4">
      <Segmented label="What is missing" value={what} onChange={w => { setWhat(w); setError(""); }} className="w-full"
        options={[{ value: "unit", label: "Unit" }, { value: "tech", label: "Technology" }, { value: "ability", label: "Ability" }]} />

      <input
        aria-label={`Name of the ${whatText}`}
        value={name}
        onChange={e => { setName(e.target.value); setError(""); }}
        placeholder={`Name of the ${whatText}`}
        className="w-full border-b border-border/60 bg-transparent pb-1 font-serif text-lg font-semibold placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none"
      />

      <div className="space-y-1.5">
        <span className="text-xs font-medium">Civilization{civs.length > 1 ? "s" : ""}</span>
        <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
          {CIVILIZATIONS.map(c => {
            const on = civs.includes(c.abbr);
            return (
              <button key={c.abbr} type="button" aria-pressed={on} onClick={() => setCivs(on ? civs.filter(x => x !== c.abbr) : [...civs, c.abbr])}
                className={cn("flex min-h-7 items-center gap-1 rounded border px-1.5 text-[11px] transition-colors", on ? "border-primary bg-primary/15 text-foreground" : "border-border/50 text-muted-foreground hover:text-foreground")}>
                <img src={c.flagPath} alt="" className="h-3 w-5 rounded-[2px] object-cover" />{c.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium">Available from</span>
        <Segmented label="Age" value={String(age)} onChange={a => setAge(Number(a))}
          options={["1", "2", "3", "4"].map(a => ({ value: a, label: `Age ${["I", "II", "III", "IV"][Number(a) - 1]}` }))} />
      </div>

      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium">What does it do?</span>
        <Textarea rows={2} value={desc} onChange={e => { setDesc(e.target.value); setError(""); }} placeholder="Paste the in-game description" />
      </label>

      {what === "unit" && (
        <div className="space-y-1 border-t border-border/40 pt-2">
          {UNIT_FIELDS.map(([k, label, extra]) => (
            <label key={k} className="flex min-h-9 items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                {extra?.startsWith("/") && <img src={extra} alt="" className="h-3.5 w-3.5" />}{label}
                {extra && !extra.startsWith("/") && <span className="text-[11px]">({extra})</span>}
              </span>
              <input inputMode="decimal" aria-label={label} value={stats[k] ?? ""} placeholder="—"
                onChange={e => { const v = parse(e.target.value); setStats({ ...stats, [k]: Number.isNaN(v) ? undefined : v }); }}
                className="h-8 w-24 rounded-md border border-input bg-background px-2 text-right tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
            </label>
          ))}
          <div className="flex min-h-9 items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Damage type</span>
            <Segmented label="Damage type" value={stats.damageType ?? "melee"} onChange={t => setStats({ ...stats, damageType: t })}
              options={[{ value: "melee", label: "Melee" }, { value: "ranged", label: "Ranged" }, { value: "siege", label: "Siege" }]} />
          </div>
          <label className="flex flex-col gap-1 pt-1 text-xs">
            <span className="font-medium">Classes <span className="font-normal text-muted-foreground">(as shown in game, optional)</span></span>
            <Input className="h-9" value={stats.classes ?? ""} onChange={e => setStats({ ...stats, classes: e.target.value })} placeholder="e.g. light melee infantry" />
          </label>
        </div>
      )}

      <div className="space-y-2">
        <span className="text-xs font-medium">{what === "unit" ? "Special effects (optional)" : "Effects"}</span>
        {rows.map((r, i) => (
          <EffectRow key={i} row={r} unitLabel={unitLabel}
            onChange={nr => { setRows(rows.map((x, j) => (j === i ? nr : x))); setError(""); }}
            onRemove={() => setRows(rows.filter((_, j) => j !== i))} />
        ))}
        <button type="button" onClick={() => setRows([...rows, newRow()])}
          className="flex min-h-9 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border/60 text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <Plus className="h-3.5 w-3.5" />Add an effect
        </button>
      </div>

      {error && <p className="text-xs text-red-400" role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Back</Button>}
        <Button type="button" size="sm" onClick={add}>Add to corrections</Button>
      </div>
    </section>
  );
}
