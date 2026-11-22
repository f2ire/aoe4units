// Editable replica of the unit card: every number, the unit icon and every
// technology / ability tile is clickable. Corrections are lifted to the dialog's basket.

import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCivilizationByAbbr } from "@/data/civilizations";
import { formatNumber } from "@/lib/report/format";
import type { IconReport, ReportBody, ReportContext, StatValue, UpgradeReport, UpgradeSummary, ValueReport } from "@/lib/report/types";
import { EditableValue } from "./EditableValue";
import { IconEditor } from "./IconEditor";
import { Segmented } from "./Segmented";
import { UpgradeEditor } from "./UpgradeEditor";

export type ViewMode = "upgrades" | "base";

interface ReportCardProps {
  context: ReportContext;
  mode: ViewMode;
  onModeChange: (m: ViewMode) => void;
  corrections: Map<string, ReportBody>;
  upsert: (key: string, body: ReportBody) => void;
  remove: (key: string) => void;
}

type Panel = { type: "icon"; target: IconReport["target"]; back?: string } | { type: "upgrade"; key: string } | null;

const ROMAN = ["I", "II", "III", "IV"];
const RESOURCE_ICON: Record<string, string> = { food: "/resources/food.png", wood: "/resources/wood.png", gold: "/resources/gold.png", stone: "/resources/stone.png" };
const upgradeKey = (u: Pick<UpgradeSummary, "kind" | "id">) => `upgrade:${u.kind}:${u.id}`;
const iconKey = (t: Pick<IconReport["target"], "kind" | "id">) => `icon:${t.kind}:${t.id}`;

function StatRow({ stat, mode, correction, onCommit, onClear }: {
  stat: StatValue; mode: ViewMode; correction?: ValueReport;
  onCommit: (v: number) => void; onClear: () => void;
}) {
  const modified = Math.abs(stat.shown - stat.base) > 0.001;
  const value = mode === "upgrades" ? stat.shown : stat.base;
  const sameMode = correction && (correction.withUpgrades ? mode === "upgrades" : mode === "base" || !modified);
  const resource = RESOURCE_ICON[stat.key];
  const isBonus = stat.key.startsWith("bonus:");
  return (
    <div className="flex min-h-9 items-center justify-between gap-2">
      <span className={cn("flex items-center gap-1.5 text-sm text-muted-foreground", isBonus && "pl-3 text-xs")}>
        {resource && <img src={resource} alt="" className="h-3.5 w-3.5" />}
        {resource ? stat.label.replace("Cost — ", "").replace(/^\w/, c => c.toUpperCase()) : stat.label}
        {correction && !sameMode && <span className="h-1.5 w-1.5 rounded-full bg-primary" title={`Corrected in the ${correction.withUpgrades ? "“with upgrades”" : "“base”"} view`} />}
      </span>
      <EditableValue
        label={stat.label}
        value={value}
        corrected={sameMode ? correction?.expected : undefined}
        onCommit={onCommit}
        onClear={onClear}
        hint={mode === "upgrades" && modified ? () => `base ${formatNumber(stat.base)}` : undefined}
      />
    </div>
  );
}

function UpgradeTile({ u, selected, corrected, onClick }: { u: UpgradeSummary; selected: boolean; corrected: boolean; onClick: () => void }) {
  const tech = u.kind === "tech";
  return (
    <button
      type="button"
      onClick={onClick}
      title={u.name}
      aria-label={`${tech ? "Technology" : "Ability"} ${u.name}${u.active ? ", active" : ""}${corrected ? ", corrected" : ""}`}
      aria-pressed={selected}
      className={cn(
        "relative h-11 w-11 shrink-0 overflow-hidden rounded border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        tech ? (u.active ? "border-green-500 bg-green-500/10" : "border-green-700/40 bg-secondary/50")
          : (u.active ? "border-purple-500 bg-purple-500/10" : "border-purple-700/40 bg-secondary/50"),
        !u.active && "opacity-70 hover:opacity-100",
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background opacity-100",
      )}
    >
      {u.icon ? <img src={u.icon} alt="" className="h-full w-full object-cover" loading="lazy" /> : <span className="p-0.5 text-[8px] leading-tight">{u.name}</span>}
      {corrected && <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border border-background bg-primary" />}
    </button>
  );
}

export function ReportCard({ context: ctx, mode, onModeChange, corrections, upsert, remove }: ReportCardProps) {
  const [panel, setPanel] = useState<Panel>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const civ = getCivilizationByAbbr(ctx.civ);

  useEffect(() => { if (panel) panelRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [panel]);

  const commitStat = (stat: StatValue, v: number) => {
    const modified = Math.abs(stat.shown - stat.base) > 0.001;
    upsert(`value:${stat.key}`, {
      kind: "value", stat: stat.key, statLabel: stat.label, base: stat.base, shown: stat.shown,
      expected: v, withUpgrades: mode === "upgrades" && modified,
    });
  };

  const unitIconTarget: IconReport["target"] = { kind: "unit", id: ctx.unitId, name: ctx.unitName, currentIcon: ctx.unitIcon };
  const openUpgrade = panel?.type === "upgrade" ? ctx.upgrades.find(u => upgradeKey(u) === panel.key) : undefined;
  const closePanel = () => setPanel(p => (p?.type === "icon" && p.back ? { type: "upgrade", key: p.back } : null));

  return (
    <div className="space-y-4">
      <section aria-label={`${ctx.unitName} card`} className="rounded-lg border-2 border-border bg-card p-3 shadow-[0_6px_18px_-10px_rgb(0_0_0/0.6)] sm:p-4">
        <header className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setPanel({ type: "icon", target: unitIconTarget })}
            aria-label={`Fix the icon of ${ctx.unitName}`}
            className="group relative shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {ctx.unitIcon ? <img src={ctx.unitIcon} alt="" className="h-14 w-14 object-contain" /> : <span className="block h-14 w-14 rounded-md bg-muted" />}
            <span className={cn("absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border border-border bg-card", corrections.has(iconKey(unitIconTarget)) ? "text-primary" : "text-muted-foreground group-hover:text-foreground")}>
              <Pencil className="h-3 w-3" />
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <h3 className="break-words font-serif text-base font-semibold leading-tight sm:text-lg">{ctx.unitName}</h3>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              {civ && <img src={civ.flagPath} alt="" className="h-3 w-5 rounded-[2px] object-cover" />}
              {ctx.civName} · Age {ROMAN[ctx.age - 1] ?? ctx.age}
            </p>
          </div>
          <Segmented
            label="Values shown"
            value={mode}
            onChange={onModeChange}
            className="w-full sm:w-auto"
            options={[{ value: "upgrades", label: "With my upgrades" }, { value: "base", label: "Base" }]}
          />
        </header>

        <div className="mt-3 border-t border-border/40 pt-2">
          {ctx.stats.map(stat => {
            const key = `value:${stat.key}`;
            return (
              <StatRow
                key={stat.key}
                stat={stat}
                mode={mode}
                correction={corrections.get(key) as ValueReport | undefined}
                onCommit={v => commitStat(stat, v)}
                onClear={() => remove(key)}
              />
            );
          })}
        </div>
      </section>

      <section aria-label="Technologies and abilities">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h4 className="text-sm font-medium">Technologies & abilities</h4>
          <span className="text-[11px] text-muted-foreground">
            <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-green-500 align-middle" />tech
            <span className="ml-2 mr-1 inline-block h-2 w-2 rounded-sm bg-purple-500 align-middle" />ability
          </span>
        </div>
        {ctx.upgrades.length === 0
          ? <p className="text-xs text-muted-foreground">No technology or ability affects this unit in the app.</p>
          : (
            <div className="flex flex-wrap gap-1.5">
              {ctx.upgrades.map(u => {
                const key = upgradeKey(u);
                return (
                  <UpgradeTile
                    key={key}
                    u={u}
                    selected={panel?.type === "upgrade" && panel.key === key}
                    corrected={corrections.has(key) || corrections.has(iconKey(u))}
                    onClick={() => setPanel(p => (p?.type === "upgrade" && p.key === key ? null : { type: "upgrade", key }))}
                  />
                );
              })}
            </div>
          )}
      </section>

      <div ref={panelRef} className="scroll-mt-4">
        {panel?.type === "icon" && (
          <IconEditor
            key={iconKey(panel.target)}
            target={panel.target}
            existing={corrections.get(iconKey(panel.target)) as IconReport | undefined}
            onSave={r => { upsert(iconKey(panel.target), r); closePanel(); }}
            onRemove={() => { remove(iconKey(panel.target)); closePanel(); }}
            onClose={closePanel}
          />
        )}
        {openUpgrade && (
          <UpgradeEditor
            key={upgradeKey(openUpgrade)}
            upgrade={openUpgrade}
            unitId={ctx.unitId}
            unitName={ctx.unitName}
            existing={corrections.get(upgradeKey(openUpgrade)) as UpgradeReport | undefined}
            iconCorrected={corrections.has(iconKey(openUpgrade))}
            onEditIcon={() => setPanel({ type: "icon", target: { kind: openUpgrade.kind, id: openUpgrade.id, name: openUpgrade.name, currentIcon: openUpgrade.icon }, back: upgradeKey(openUpgrade) })}
            onSave={r => { upsert(upgradeKey(openUpgrade), r); setPanel(null); }}
            onRemove={() => { remove(upgradeKey(openUpgrade)); setPanel(null); }}
            onClose={() => setPanel(null)}
          />
        )}
      </div>
    </div>
  );
}
