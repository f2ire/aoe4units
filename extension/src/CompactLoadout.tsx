import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  categorizeTechnology,
  getTechnologyTier,
  getTechnologyBaseName,
  IMPROVED_TECH_BASE,
  IMPROVED_TECH_PAIRS,
  allTechnologies,
} from "@/data/unified-technologies";
import type { Technology } from "@/data/unified-technologies";
import { foreignEngineeringTechIds } from "@/data/patches/technologies";
import type { Ability } from "@/data/unified-abilities";
import { ABILITY_ROW_GROUPS } from "@/data/patches/abilities";
import { cn } from "@/lib/utils";
import { assetUrl } from "./assetUrl";

// Dense, overlay-oriented replacement for TechnologySelector + AbilitySelector.
// Drops the 4-age-column grid (lots of empty cells) in favour of a flex-wrap of
// the icons that actually exist, one row per stat category. Reuses the exact slot
// data + toggle/counter handlers, so behaviour matches the full selectors.

interface CompactLoadoutProps {
  // Technologies
  technologies: Technology[];
  activeTechnologies: Set<string>;
  onToggleTech: (techId: string) => void;
  lockedTechnologies?: Set<string>;
  selectedCiv?: string;
  unitMinAge?: number;
  fullUpgradeAge?: number | null;
  onApplyFullUpgrade?: (age: number) => void;
  onReset?: () => void;
  // Abilities
  abilities: Ability[];
  activeAbilities: Set<string>;
  onToggleAbility: (abilityId: string) => void;
  lockedAbilities?: Set<string>;
  abilityCounters?: Map<string, number>;
  onIncrement?: (abilityId: string) => void;
  onDecrement?: (abilityId: string) => void;
}

const techIconPath = (icon: string) =>
  icon.startsWith("http") ? icon : `/technologies/${icon.split("/").pop() || ""}`;

const FALLBACK_ICON =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30"><rect width="30" height="30" fill="%23333"/><text x="50%" y="50%" fill="%23eab308" text-anchor="middle" dy=".3em" font-size="14">?</text></svg>';

const CATEGORY_ORDER = [
  "HP", "HP-Unique",
  "Attack-Melee", "Attack-Ranged", "Attack-Melee-Unique", "Attack-Ranged-Unique",
  "Armor-Melee", "Armor-Ranged", "Armor-Melee-Unique", "Armor-Ranged-Unique",
  "Range", "Range-Unique",
  "AttackSpeed", "AttackSpeed-Unique",
  "Speed", "Speed-Unique",
  "Age", "Other",
];
const CATEGORY_LABEL: Record<string, string> = {
  HP: "HP", "HP-Unique": "HP",
  "Attack-Melee": "ATK", "Attack-Ranged": "ATK", "Attack-Melee-Unique": "ATK", "Attack-Ranged-Unique": "ATK",
  "Armor-Melee": "ARM", "Armor-Ranged": "ARM", "Armor-Melee-Unique": "ARM", "Armor-Ranged-Unique": "ARM",
  Range: "RNG", "Range-Unique": "RNG",
  AttackSpeed: "AS", "AttackSpeed-Unique": "AS",
  Speed: "SPD", "Speed-Unique": "SPD",
  Age: "AGE", Other: "MISC",
};
const AGE_LABELS = ["I", "II", "III", "IV"];
const AGES = [1, 2, 3, 4];

type AgeBuckets = Record<number, React.ReactNode[]>;
const emptyBuckets = (): AgeBuckets => ({ 1: [], 2: [], 3: [], 4: [] });

// One square icon, gold ring when active. Icons stay full-colour for legibility;
// the active state reads from the gold ring/fill, not from dimming the others.
function IconToggle({
  src,
  name,
  description,
  active,
  locked,
  isAlways,
  onClick,
  mongol,
}: {
  src: string;
  name: string;
  description?: string;
  active: boolean;
  locked?: boolean;
  isAlways?: boolean;
  onClick: () => void;
  mongol?: { active: boolean; name: string; onToggle: () => void };
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null);

  const showTip = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setTipPos({ x: r.left + r.width / 2, y: r.top });
  };

  return (
    <>
      <div className="relative">
        <button
          ref={btnRef}
          type="button"
          disabled={locked}
          onClick={onClick}
          onMouseEnter={showTip}
          onMouseLeave={() => setTipPos(null)}
          className={cn(
            "relative h-[34px] w-[34px] shrink-0 overflow-hidden rounded border transition-all",
            locked && !active
              ? "cursor-not-allowed border-zinc-700 bg-zinc-800/60 opacity-50"
              : active
                ? "border-amber-500 bg-amber-500/20 ring-1 ring-amber-500/50"
                : "border-zinc-600 bg-zinc-800 hover:border-amber-400/60 active:scale-95",
          )}
        >
          <img
            src={assetUrl(src)}
            alt={name}
            className="h-full w-full object-contain p-0.5"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = FALLBACK_ICON;
            }}
          />
          {isAlways && (
            <span className="absolute bottom-0 right-0 rounded-tl bg-green-600 px-0.5 text-[8px] leading-3 text-white">
              auto
            </span>
          )}
        </button>
        {mongol && (
          <button
            type="button"
            title={mongol.name}
            onClick={(e) => { e.stopPropagation(); mongol.onToggle(); }}
            className={cn(
              "absolute -right-1 -top-1 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[8px] font-bold transition-all hover:scale-110 active:scale-90",
              mongol.active
                ? "border-green-500 bg-green-900/80 text-green-400"
                : active
                  ? "border-orange-500 bg-orange-900/80 text-orange-400"
                  : "border-orange-500/40 bg-orange-900/30 text-orange-400/50",
            )}
          >
            {mongol.active ? "✓" : "+"}
          </button>
        )}
      </div>
      {tipPos &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[99999] w-48 -translate-x-1/2 rounded-md border border-amber-500/40 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur"
            style={{ left: tipPos.x, top: tipPos.y - 8, transform: "translate(-50%, -100%)" }}
          >
            <p className="text-[11px] font-semibold text-amber-200">{name}</p>
            {description && <p className="mt-0.5 text-[10px] leading-snug text-zinc-400">{description}</p>}
          </div>,
          document.body,
        )}
    </>
  );
}

// Icon + count badge + tiny −/+ stepper (tiered/counter techs & abilities).
function CounterCell({
  src,
  name,
  count,
  max,
  hideMax,
  onInc,
  onDec,
}: {
  src: string;
  name: string;
  count: number;
  max: number;
  hideMax?: boolean;
  onInc: () => void;
  onDec: () => void;
}) {
  const active = count > 0;
  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5">
      <button
        type="button"
        title={name}
        onClick={onInc}
        className={cn(
          "relative h-[34px] w-[34px] overflow-hidden rounded border transition-all active:scale-95",
          active ? "border-amber-500 bg-amber-500/20 ring-1 ring-amber-500/50" : "border-zinc-600 bg-zinc-800 hover:border-amber-400/60",
        )}
      >
        <img
          src={assetUrl(src)}
          alt={name}
          className="h-full w-full object-contain p-0.5"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = FALLBACK_ICON;
          }}
        />
        {active && (
          <span className="absolute left-0 top-0 rounded-br bg-amber-500 px-1 text-[9px] font-bold leading-3 text-black">
            {count}
          </span>
        )}
      </button>
      <div className="flex w-[34px] items-center justify-between">
        <button
          type="button"
          onClick={onDec}
          disabled={count === 0}
          className="flex h-3.5 w-3.5 items-center justify-center rounded border border-zinc-700 bg-zinc-800 text-[10px] leading-none text-zinc-300 disabled:opacity-20"
        >
          −
        </button>
        <span className="text-[8px] tabular-nums text-zinc-500">{hideMax ? count : `${count}/${max}`}</span>
        <button
          type="button"
          onClick={onInc}
          disabled={count >= max}
          className="flex h-3.5 w-3.5 items-center justify-center rounded border border-zinc-700 bg-zinc-800 text-[10px] leading-none text-zinc-300 disabled:opacity-20"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function CompactLoadout({
  technologies,
  activeTechnologies,
  onToggleTech,
  lockedTechnologies,
  selectedCiv,
  unitMinAge = 1,
  fullUpgradeAge,
  onApplyFullUpgrade,
  onReset,
  abilities,
  activeAbilities,
  onToggleAbility,
  lockedAbilities,
  abilityCounters,
  onIncrement,
  onDecrement,
}: CompactLoadoutProps) {
  // --- Technologies: group by category → tier-line (mirrors TechnologySelector). ---
  const visible = technologies.filter(
    (t) => !IMPROVED_TECH_BASE[t.id] || (selectedCiv === "by" && foreignEngineeringTechIds.has(t.id)),
  );

  const grouped: Record<string, Record<string, Technology[]>> = {};
  CATEGORY_ORDER.forEach((c) => (grouped[c] = {}));
  visible.forEach((tech) => {
    const category = categorizeTechnology(tech);
    if (!grouped[category]) return;
    const lineKey = getTechnologyTier(tech)
      ? `family:${getTechnologyBaseName(tech.displayClasses[0])}`
      : category;
    (grouped[category][lineKey] ||= []).push(tech);
  });

  // Collapse into rows keyed by the short label (ATK/ARM/HP…), category order
  // preserved. Each row buckets its icons into the 4 age columns.
  const clampAge = (age: number) => Math.min(4, Math.max(1, age || 1));
  const rows: { label: string; byAge: AgeBuckets }[] = [];
  const rowIndex = new Map<string, number>();
  for (const category of CATEGORY_ORDER) {
    const lines = grouped[category];
    if (!lines) continue;
    const label = CATEGORY_LABEL[category] ?? category;
    for (const lineKey of Object.keys(lines)) {
      const techs = lines[lineKey]
        .slice()
        .sort((a, b) => (getTechnologyTier(a)?.tier ?? 0) - (getTechnologyTier(b)?.tier ?? 0));
      if (!techs.length) continue;

      let ri = rowIndex.get(label);
      if (ri === undefined) {
        ri = rows.length;
        rowIndex.set(label, ri);
        rows.push({ label, byAge: emptyBuckets() });
      }
      const byAge = rows[ri].byAge;

      const first = techs[0];
      if (first.counterMax !== undefined) {
        const activeIdx = techs.findIndex((t) => activeTechnologies.has(t.id));
        const count = activeIdx === -1 ? 0 : activeIdx + 1;
        const max = first.counterMax ?? techs.length;
        const cur = count > 0 ? techs[count - 1] : first;
        byAge[clampAge(first.minAge)].push(
          <CounterCell
            key={lineKey}
            src={techIconPath(cur.icon)}
            name={cur.name}
            count={count}
            max={max}
            hideMax={first.counterHideMax}
            onInc={() => count < max && onToggleTech(techs[count].id)}
            onDec={() => count > 0 && onToggleTech(techs[count - (count === 1 ? 1 : 2)].id)}
          />,
        );
      } else {
        for (const tech of techs) {
          const improvedId = (IMPROVED_TECH_PAIRS as Record<string, string>)[tech.id];
          const improvedTech = improvedId ? allTechnologies.find((t) => t.id === improvedId) : undefined;
          byAge[clampAge(tech.minAge)].push(
            <IconToggle
              key={tech.id}
              src={techIconPath(tech.icon)}
              name={tech.name}
              description={(tech as any).uiTooltip || tech.description}
              active={activeTechnologies.has(tech.id)}
              locked={lockedTechnologies?.has(tech.id)}
              onClick={() => onToggleTech(tech.id)}
              mongol={
                (tech as any).hasMongolUpgrade && selectedCiv === "mo" && improvedId
                  ? { active: activeTechnologies.has(improvedId), name: improvedTech?.name ?? "Improved", onToggle: () => onToggleTech(improvedId) }
                  : undefined
              }
            />,
          );
        }
      }
    }
  }

  // --- Abilities: grouped by ABILITY_ROW_GROUPS (mirrors AbilitySelector). ---
  const buildAbilityBuckets = (groupAbilities: Ability[]): AgeBuckets => {
    const byAge = emptyBuckets();
    groupAbilities.forEach((a) => {
      if (a.counterMax !== undefined) {
        const count = abilityCounters?.get(a.id) ?? 0;
        byAge[clampAge(a.minAge)].push(
          <CounterCell
            key={a.id}
            src={a.icon}
            name={a.name}
            count={count}
            max={a.counterMax}
            hideMax={a.counterHideMax}
            onInc={() => onIncrement?.(a.id)}
            onDec={() => onDecrement?.(a.id)}
          />,
        );
      } else {
        const isAlways =
          (a as any).active === "always" ||
          (a.variations?.some(
            (v: any) =>
              v.active === "always" &&
              (v.civs.length === 0 || !selectedCiv || v.civs.includes(selectedCiv)),
          ) ?? false);
        const abilityDesc =
          (selectedCiv && a.variations?.find((v: any) => v.civs?.length > 0 && v.civs?.includes(selectedCiv))?.description)
          || (a as any).uiTooltip
          || a.description;
        byAge[clampAge(a.minAge)].push(
          <IconToggle
            key={a.id}
            src={a.icon}
            name={a.name}
            description={abilityDesc}
            active={activeAbilities.has(a.id)}
            locked={lockedAbilities?.has(a.id)}
            isAlways={isAlways}
            onClick={() => onToggleAbility(a.id)}
          />,
        );
      }
    });
    return byAge;
  };

  const namedIds = new Set(ABILITY_ROW_GROUPS.flatMap((g) => g.ids));
  const abilityGroupRows = [
    { label: "ABI", abilities: abilities.filter((a) => !namedIds.has(a.id)) },
    ...ABILITY_ROW_GROUPS.map((g) => ({
      label: g.label,
      abilities: abilities.filter((a) => g.ids.includes(a.id)),
    })),
  ]
    .filter((g) => g.abilities.length > 0)
    .map((g) => ({ label: g.label, byAge: buildAbilityBuckets(g.abilities) }));

  const hasAbilities = abilityGroupRows.length > 0;

  // One label + 4 age columns. Shared by category rows and the abilities row.
  const renderColumns = (byAge: AgeBuckets, label: string, labelColor: string) => (
    <div className="flex items-start gap-1">
      <span className={cn("w-8 shrink-0 pt-1.5 text-[10px] font-bold uppercase", labelColor)}>{label}</span>
      {AGES.map((age) => (
        <div key={age} className="flex w-9 shrink-0 flex-col items-center gap-1">
          {byAge[age]}
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-1.5 text-zinc-100">
      {/* Age column header doubles as the full-upgrade row (click an age to fully
          upgrade up to it; the roman numeral labels the column below). */}
      <div className="flex items-center gap-1">
        <span className="w-8 shrink-0 text-[9px] font-semibold uppercase text-zinc-500">All</span>
        {AGES.map((age, i) => {
          const disabled = age < unitMinAge || !onApplyFullUpgrade;
          const isActive = fullUpgradeAge === age;
          return (
            <button
              key={age}
              type="button"
              disabled={disabled}
              onClick={() => onApplyFullUpgrade?.(age)}
              title={`Full upgrade to age ${AGE_LABELS[i]}`}
              className={cn(
                "h-5 w-9 shrink-0 rounded border text-center text-[11px] font-bold transition-colors",
                isActive
                  ? "border-amber-400 bg-amber-500 text-black"
                  : disabled
                    ? "cursor-not-allowed border-zinc-800 text-zinc-600"
                    : "border-zinc-700 text-amber-400/80 hover:border-amber-500/60 hover:bg-zinc-800 hover:text-amber-300",
              )}
            >
              {AGE_LABELS[i]}
            </button>
          );
        })}
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="ml-1 shrink-0 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:text-red-400"
          >
            Reset
          </button>
        )}
      </div>

      {/* Upgrades — one row per category, split into age columns */}
      {rows.map((row) => (
        <div key={row.label}>{renderColumns(row.byAge, row.label, "text-amber-400/70")}</div>
      ))}

      {/* Abilities — one row per group (ABI default + named groups like KHAN) */}
      {hasAbilities && <div className="mt-0.5 border-t border-zinc-800 pt-1.5" />}
      {abilityGroupRows.map((row) => (
        <div key={row.label}>{renderColumns(row.byAge, row.label, "text-purple-400/80")}</div>
      ))}
    </div>
  );
}
