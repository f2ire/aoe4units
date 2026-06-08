import {
  categorizeTechnology,
  getTechnologyTier,
  getTechnologyBaseName,
  IMPROVED_TECH_BASE,
} from "@/data/unified-technologies";
import type { Technology } from "@/data/unified-technologies";
import { foreignEngineeringTechIds } from "@/data/patches/technologies";
import type { Ability } from "@/data/unified-abilities";
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
  active,
  locked,
  onClick,
}: {
  src: string;
  name: string;
  active: boolean;
  locked?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={name}
      disabled={locked}
      onClick={onClick}
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
    </button>
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
          byAge[clampAge(tech.minAge)].push(
            <IconToggle
              key={tech.id}
              src={techIconPath(tech.icon)}
              name={tech.name}
              active={activeTechnologies.has(tech.id)}
              locked={lockedTechnologies?.has(tech.id)}
              onClick={() => onToggleTech(tech.id)}
            />,
          );
        }
      }
    }
  }

  // --- Abilities: simple toggles + counter cells, bucketed by age. ---
  const abilityByAge = emptyBuckets();
  abilities.forEach((a) => {
    if (a.counterMax !== undefined) {
      const count = abilityCounters?.get(a.id) ?? 0;
      abilityByAge[clampAge(a.minAge)].push(
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
      abilityByAge[clampAge(a.minAge)].push(
        <IconToggle
          key={a.id}
          src={a.icon}
          name={a.name}
          active={activeAbilities.has(a.id)}
          locked={lockedAbilities?.has(a.id)}
          onClick={() => onToggleAbility(a.id)}
        />,
      );
    }
  });
  const hasAbilities = AGES.some((age) => abilityByAge[age].length > 0);

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

      {/* Abilities — same age columns */}
      {hasAbilities && <div className="mt-0.5 border-t border-zinc-800 pt-1.5" />}
      {hasAbilities && renderColumns(abilityByAge, "ABI", "text-purple-400/80")}
    </div>
  );
}
