import React, { useState, useRef, useEffect } from "react";
import { Github, ChevronDown, Coffee, Share2, Check } from "lucide-react";
import { toast } from "sonner";
import { aoe4Units, AoE4Unit, getAvailableAges, getPrimaryWeapon, getTotalCost } from "@/data/unified-units";
import type { UnifiedVariation } from "@/data/unified-units";
import { CIVILIZATIONS } from "@/data/civilizations";
import { UnitCard } from "@/components/UnitCard";
import { computeVersus, computeVersusAtEqualCost, computeVersusKitingFocusFire, computeVersusAtEqualCostKitingFocusFire, computeVersusKitingBatchesMC, computeVersusAtEqualCostKitingBatchesMC, getVersusDebuffMultiplier, aggregatedDPSModel, focusFireModel, focusFireBatchesMCModel, focusFireBatchesMCAsymmetricModel, focusFireAsymmetricModel, calculateEqualCostMultipliers } from "@/lib/combat";
import type { MultiUnitModel, VersusResult } from "@/lib/combat";
import { AgeSelector } from "@/components/AgeSelector";
import { TechnologySelector } from "@/components/TechnologySelector";
import { AbilitySelector } from "@/components/AbilitySelector";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { motion } from "framer-motion";
import { useUnitSlot } from "@/hooks/useUnitSlot";
import { getChargeBonus } from "@/lib/buildVariation";
import { buildShareUrl, parseShareState } from "@/lib/shareUrl";
import type { ShareSlot, ShareState } from "@/lib/shareUrl";
import { JeanneFormSelector, isJeanneUnit } from "@/components/JeanneFormSelector";
import { GuidedTour } from "@/components/GuidedTour";
import { unitNameMatchScore, cn } from "@/lib/utils";


// Game patch version currently modeled. Update this single line each balance patch.
const PATCH_VERSION = "16.2.10604";

const categoryNames: Record<string, string> = {
  jeanne: "Jeanne d'Arc",
  melee_infantry: 'Melee Infantry',
  ranged: 'Ranged Units',
  cavalry: 'Cavalry',
  siege: 'Siege',
  monk: 'Monks',
  ship: 'Ships',
  other: 'Other',
  mercenary: 'Mercenaries',
  khaganate: 'Khaganate',
};

const categoryIcons: Record<string, string> = {
  jeanne: 'https://data.aoe4world.com/images/units/jeanne-darc-peasant-1.png',
  melee_infantry: 'https://data.aoe4world.com/images/buildings/barracks.png',
  ranged: 'https://data.aoe4world.com/images/buildings/archery-range.png',
  cavalry: 'https://data.aoe4world.com/images/buildings/stable.png',
  siege: 'https://data.aoe4world.com/images/buildings/siege-workshop.png',
  monk: 'https://data.aoe4world.com/images/buildings/monastery.png',
  ship: 'https://data.aoe4world.com/images/buildings/dock.png',
  other: 'https://data.aoe4world.com/images/buildings/house.png',
  mercenary: 'https://data.aoe4world.com/images/buildings/barracks.png',
  khaganate: 'https://data.aoe4world.com/images/buildings/khaganate-palace.png',
};

const categoryOrder = ['jeanne', 'melee_infantry', 'ranged', 'cavalry', 'siege', 'mercenary', 'khaganate', 'monk', 'ship', 'other'];

function getMercenarySubCategory(unit: { classes: string[] }): string {
  const cls = unit.classes.map(c => c.toLowerCase());
  if (cls.includes('siege')) return 'Siege';
  if (cls.includes('cavalry') && cls.includes('ranged')) return 'Ranged Cavalry';
  if (cls.includes('cavalry')) return 'Melee Cavalry';
  if (cls.includes('ranged')) return 'Ranged Infantry';
  if (cls.includes('melee')) return 'Melee Infantry';
  return 'Other';
}

const MERCENARY_SUB_ORDER = ['Melee Infantry', 'Ranged Infantry', 'Melee Cavalry', 'Ranged Cavalry', 'Siege', 'Other'];

function getKhaganateSubCategory(unit: { classes: string[] }): string {
  const cls = unit.classes.map(c => c.toLowerCase());
  if (cls.includes('siege')) return 'Siege';
  if (cls.includes('monk')) return 'Monk';
  if (cls.includes('cavalry') && cls.includes('ranged')) return 'Ranged Cavalry';
  if (cls.includes('cavalry')) return 'Cavalry';
  if (cls.includes('melee')) return 'Melee Infantry';
  return 'Other';
}

const KHAGANATE_SUB_ORDER = ['Melee Infantry', 'Ranged Cavalry', 'Cavalry', 'Monk', 'Siege', 'Other'];

// Searchable unit picker. Built on Radix Popover (not Select) on purpose: Radix
// Select closes its content on `window.resize`, which mobile soft keyboards fire
// when they open, and it steals focus from an embedded search input on every
// re-render. Popover does neither, so the input keeps focus and the keyboard
// stays open while typing.
interface UnitPickerProps {
  units: AoE4Unit[];
  categorizedUnits: Record<string, AoE4Unit[]>;
  openCategories: Record<string, boolean>;
  toggleCategory: (key: string) => void;
  selectedUnit: AoE4Unit | null;
  activeAbilities: Set<string>;
  onSelect: (value: string) => void;
}

function UnitPicker({ units, categorizedUnits, openCategories, toggleCategory, selectedUnit, activeAbilities, onSelect }: UnitPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  // Track the visual viewport so the popover stays above the mobile keyboard.
  // The layout viewport (what Radix uses) doesn't shrink when the keyboard opens,
  // so without this the content overflows under/over the keyboard.
  const [viewport, setViewport] = useState<{ height: number; keyboardOpen: boolean }>({ height: 0, keyboardOpen: false });
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    const update = () => {
      const height = vv ? vv.height : window.innerHeight;
      setViewport({ height, keyboardOpen: window.innerHeight - height > 120 });
    };
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
    };
  }, [open]);

  const currentValue = isJeanneUnit(selectedUnit)
    ? 'jeanne-darc-peasant'
    : selectedUnit?.id === 'desert-raider' && activeAbilities.has('ability-desert-raider-blade')
      ? 'desert-raider_cavalry'
      : (selectedUnit?.id || "");

  const handleSelect = (value: string) => {
    onSelect(value);
    setSearch("");
    setOpen(false);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setSearch("");
  };

  const renderRow = (value: string, icon: string, name: string, padClass: string, unique?: boolean) => (
    <button
      key={value}
      type="button"
      onClick={() => handleSelect(value)}
      className={cn(
        "group flex w-full items-center gap-2 rounded-sm pr-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent",
        padClass,
        value === currentValue && "font-bold",
      )}
    >
      <img src={icon} alt={name} className="w-6 h-6 object-contain shrink-0" />
      <span className="text-white group-hover:text-black transition-colors">{name}</span>
      {unique && <span className="text-xs text-primary">(Unique)</span>}
    </button>
  );

  const renderUnits = (catUnits: AoE4Unit[], categoryKey: string) => {
    if (categoryKey === 'mercenary' || categoryKey === 'khaganate') {
      const subCategoryOf = categoryKey === 'mercenary' ? getMercenarySubCategory : getKhaganateSubCategory;
      const subOrder = categoryKey === 'mercenary' ? MERCENARY_SUB_ORDER : KHAGANATE_SUB_ORDER;
      const grouped: Record<string, AoE4Unit[]> = {};
      for (const u of catUnits) {
        const sub = subCategoryOf(u);
        if (!grouped[sub]) grouped[sub] = [];
        grouped[sub].push(u);
      }
      return subOrder.filter(sub => grouped[sub]?.length).map(sub => (
        <React.Fragment key={sub}>
          <div className="pl-8 py-0.5 text-xs text-muted-foreground italic">{sub}</div>
          {grouped[sub].map(unit => renderRow(unit.id, unit.icon, unit.name, "pl-10", unit.unique))}
        </React.Fragment>
      ));
    }
    if (categoryKey === 'jeanne') {
      const peasant = catUnits.find(u => u.id === 'jeanne-darc-peasant');
      if (!peasant) return null;
      return renderRow('jeanne-darc-peasant', peasant.icon, "Jeanne d'Arc", "pl-8");
    }
    return catUnits.map(unit => renderRow(unit.id, unit.icon, unit.name, "pl-8", unit.unique));
  };

  const q = search.trim().toLowerCase();
  const displayName = isJeanneUnit(selectedUnit) ? "Jeanne d'Arc" : selectedUnit?.name;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          {selectedUnit ? (
            <span className="flex min-w-0 items-center gap-2">
              <img src={selectedUnit.icon} alt="" className="w-6 h-6 object-contain shrink-0" />
              <span className="truncate">{displayName}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Select a unit...</span>
          )}
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side={viewport.keyboardOpen ? "top" : "bottom"}
        avoidCollisions={!viewport.keyboardOpen}
        collisionPadding={8}
        className="p-0 bg-popover border-border flex flex-col"
        style={{
          width: 'var(--radix-popover-trigger-width)',
          maxHeight: viewport.height
            ? `min(var(--radix-popover-content-available-height), ${Math.max(160, viewport.height - 16)}px)`
            : 'var(--radix-popover-content-available-height)',
        }}
        onOpenAutoFocus={(e) => { e.preventDefault(); searchRef.current?.focus(); }}
      >
        <div className="p-1 shrink-0">
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search units..."
            className="w-full rounded-sm border border-border bg-secondary px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-1 pb-1">
          {q ? (() => {
            const scored: { score: number; el: JSX.Element }[] = [];
            for (const categoryKey of categoryOrder) {
              const catUnits = categorizedUnits[categoryKey];
              if (!catUnits || catUnits.length === 0) continue;
              if (categoryKey === 'jeanne') {
                const peasant = catUnits.find(u => u.id === 'jeanne-darc-peasant');
                if (!peasant) continue;
                const score = unitNameMatchScore("Jeanne d'Arc", q);
                if (score > 0) scored.push({ score, el: renderRow('jeanne-darc-peasant', peasant.icon, "Jeanne d'Arc", "pl-8") });
                continue;
              }
              for (const unit of catUnits) {
                const score = unitNameMatchScore(unit.name, q);
                if (score <= 0) continue;
                scored.push({ score, el: renderRow(unit.id, unit.icon, unit.name, "pl-8", unit.unique) });
              }
            }
            if (scored.length === 0) {
              return <div className="py-6 text-center text-sm text-muted-foreground">No units found</div>;
            }
            scored.sort((a, b) => b.score - a.score);
            return scored.map(s => s.el);
          })() : categoryOrder.map(categoryKey => {
            const catUnits = categorizedUnits[categoryKey];
            if (!catUnits || catUnits.length === 0) return null;
            const isOpen = openCategories[categoryKey];
            return (
              <div key={categoryKey}>
                <button
                  type="button"
                  onClick={() => toggleCategory(categoryKey)}
                  className="group w-full cursor-pointer rounded px-2 py-2 text-left hover:bg-accent"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary group-hover:text-background">
                    <span className="text-xs">{isOpen ? '▼' : '▶'}</span>
                    <img src={categoryIcons[categoryKey]} alt="" className="w-5 h-5 object-contain inline-block" />
                    <span>{categoryNames[categoryKey]} ({catUnits.length})</span>
                  </div>
                </button>
                {isOpen && renderUnits(catUnits, categoryKey)}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Searchable civilization picker. Same Popover-based approach as UnitPicker (not
// Select) so the mobile soft keyboard doesn't close the dropdown while typing.
// Simpler than UnitPicker: flat list, no categories.
interface CivPickerProps {
  value: string;
  onSelect: (value: string) => void;
}

function CivPicker({ value, onSelect }: CivPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [viewport, setViewport] = useState<{ height: number; keyboardOpen: boolean }>({ height: 0, keyboardOpen: false });
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    const update = () => {
      const height = vv ? vv.height : window.innerHeight;
      setViewport({ height, keyboardOpen: window.innerHeight - height > 120 });
    };
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
    };
  }, [open]);

  const selected = CIVILIZATIONS.find(c => c.abbr === value);

  const handleSelect = (abbr: string) => {
    onSelect(abbr);
    setSearch("");
    setOpen(false);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setSearch("");
  };

  const q = search.trim().toLowerCase();
  const visibleCivs = q
    ? CIVILIZATIONS.map(civ => ({ civ, score: unitNameMatchScore(civ.name, q) }))
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(c => c.civ)
    : CIVILIZATIONS;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-14 w-full items-center justify-between gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          {selected ? (
            <span className="flex min-w-0 items-center gap-3">
              <img src={selected.flagPath} alt="" className="w-8 h-8 object-contain shrink-0" />
              <span className="font-medium truncate">{selected.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Select a civilization...</span>
          )}
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side={viewport.keyboardOpen ? "top" : "bottom"}
        avoidCollisions={!viewport.keyboardOpen}
        collisionPadding={8}
        className="p-0 bg-popover border-border flex flex-col"
        style={{
          width: 'var(--radix-popover-trigger-width)',
          maxHeight: viewport.height
            ? `min(var(--radix-popover-content-available-height), ${Math.max(160, viewport.height - 16)}px)`
            : 'var(--radix-popover-content-available-height)',
        }}
        onOpenAutoFocus={(e) => { e.preventDefault(); searchRef.current?.focus(); }}
      >
        <div className="p-1 shrink-0">
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search civilizations..."
            className="w-full rounded-sm border border-border bg-secondary px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-1 pb-1">
          {visibleCivs.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No civilizations found</div>
          ) : (
            visibleCivs.map(civ => (
              <button
                key={civ.abbr}
                type="button"
                onClick={() => handleSelect(civ.abbr)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-sm px-2 py-3 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent",
                  civ.abbr === value && "font-bold",
                )}
              >
                <img src={civ.flagPath} alt={civ.name} className="w-8 h-8 object-contain shrink-0" />
                <span className="font-medium text-white group-hover:text-black transition-colors">{civ.name}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Function to calculate the charge bonus for a unit
const getChargeBonusBurst = (unitData: AoE4Unit | UnifiedVariation | undefined, activeTechnologies: Set<string> = new Set()): number => {
  if (!unitData) return 1;
  const baseId = ('baseId' in unitData) ? unitData.baseId : unitData.id;
  if (baseId === 'earls-guard' && activeTechnologies.has('throwing-dagger-drills')) return 2;
  return 1;
};

// Unit-count stepper shown above each card in versus mode. count > 1 routes the matchup
// through the multi-unit combat engine and reveals the model selector.
function CountStepper({ count, onChange, labelSide = 'left' }: { count: number; onChange: (n: number) => void; labelSide?: 'left' | 'right' }) {
  const set = (n: number) => onChange(Math.max(1, Math.min(99, Number.isFinite(n) ? n : 1)));
  const label = <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Units</span>;
  return (
    <div className="flex items-center gap-2">
      {labelSide === 'left' && label}
      <div className="inline-flex items-center rounded-md border border-border overflow-hidden bg-card">
        <button
          type="button"
          aria-label="Decrease unit count"
          onClick={() => set(count - 1)}
          disabled={count <= 1}
          className="px-3 py-1.5 text-sm font-bold hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
        >−</button>
        <input
          type="number"
          min={1}
          max={99}
          value={count}
          onChange={(e) => set(parseInt(e.target.value, 10))}
          className="w-12 text-center bg-transparent text-sm font-semibold border-x border-border py-1.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          aria-label="Increase unit count"
          onClick={() => set(count + 1)}
          className="px-3 py-1.5 text-sm font-bold hover:bg-muted"
        >+</button>
      </div>
      {labelSide === 'right' && label}
    </div>
  );
}

// Toggle button that fills both unit counts to an equalized ratio (cost or population).
// `active` = the current counts already match this preset's ratio; clicking it then reverts to 1v1.
function PresetButton({ label, title, disabled, active, onClick, id }: { label: string; title: string; disabled: boolean; active: boolean; onClick: () => void; id?: string }) {
  return (
    <button
      type="button"
      id={id}
      disabled={disabled}
      aria-pressed={active}
      onClick={() => { if (!disabled) onClick(); }}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border transition-colors ${disabled ? 'opacity-50 cursor-not-allowed border-border bg-card' : active ? 'border-primary bg-primary text-primary-foreground cursor-pointer' : 'border-border bg-card hover:bg-muted cursor-pointer'}`}
      title={title}
    >
      <span className="text-sm font-medium whitespace-nowrap">{label}</span>
    </button>
  );
}

// Counter abilities whose stack count tracks the on-field unit count (count1/count2).
// `useN: true` → counter = N (counts itself, e.g. inspiration stacks); otherwise → counter = N−1
// (nearby OTHER units, per the in-game "for every other unit" wording). The sync only fires
// when the resolved target ≥ 1, so N−1 abilities stay fully manual in a 1v1 (target 0).
// Keyed by unit baseId; the ability is only synced when that unit is the active slot unit.
const COUNT_SYNCED_COUNTERS: Record<string, { abilityId: string; useN: boolean }> = {
  'lord-of-lancaster': { abilityId: 'ability-lord-of-lancaster-inspiration', useN: true },
  'chevalier-confrere': { abilityId: 'ability-knightly-brotherhood', useN: false },
  'templar-brother': { abilityId: 'ability-rule-of-templars', useN: false },
  'atgeirmadr': { abilityId: 'ability-stronger-together', useN: false },
};

const Sandbox = () => {
  const [isVersus, setIsVersus] = useState<boolean>(false);
  const [multiUnitModelKey, setMultiUnitModelKey] = useState<'aggregated' | 'focusFire' | 'focusFireBatchesMC'>('focusFire');
  const [allowKiting, setAllowKiting] = useState<boolean>(false);
  const [mobileOptionsOpen, setMobileOptionsOpen] = useState<boolean>(false);
  const [startDistancePreset, setStartDistancePreset] = useState<string>("max");
  const [customDistance, setCustomDistance] = useState<number>(5);
  // Per-slot unit count for multi-unit versus simulation (1 = pure 1v1, >1 routes to the multi-unit engine)
  const [count1, setCount1] = useState<number>(1);
  const [count2, setCount2] = useState<number>(1);
  // Which equal-* preset toggle is currently selected (null = none / manual counts)
  const [activePreset, setActivePreset] = useState<'cost' | 'pop' | null>(null);

  const civ1 = useUnitSlot();
  const civ2 = useUnitSlot();

  const {
    unit: unit1, setUnit: setUnit1,
    selectedCiv: selectedCiv1, setSelectedCiv: setSelectedCiv1,
    selectedAge: selectedAge1, setSelectedAge: setSelectedAge1,
    variation: variation1,
    activeTechnologies: activeTechnologies1,
    activeAbilities: activeAbilities1,
    openCategories: openCategories1, toggleCategory: toggleCategory1,
    filteredUnits: filteredUnits1,
    categorizedUnits: categorizedUnits1,
    techs: techs1,
    abilities: abilities1,
    modifiedStats: modifiedStats1,
    modifiedStatsNoTimer: modifiedStats1NoTimer,
    activeTimedDuration: timedDuration1,
    toggleTechnology: toggleTechnology1,
    toggleAbility: toggleAbility1,
    incrementAbility: incrementAbility1,
    decrementAbility: decrementAbility1,
    setAbilityCounter: setAbilityCounter1,
    abilityCounters: abilityCounters1,
    lockedAbilities: lockedAbilities1,
    lockedTechnologies: lockedTechnologies1,
    secondaryWeapons: secondaryWeapons1,
    unitMinAge: unitMinAge1,
    fullUpgradeAge: fullUpgradeAge1,
    applyFullUpgrade: applyFullUpgrade1,
    resetTechnologies: resetTechnologies1,
  } = civ1;

  const {
    unit: unit2, setUnit: setUnit2,
    selectedCiv: selectedCiv2, setSelectedCiv: setSelectedCiv2,
    selectedAge: selectedAge2, setSelectedAge: setSelectedAge2,
    variation: variation2,
    activeTechnologies: activeTechnologies2,
    activeAbilities: activeAbilities2,
    openCategories: openCategories2, toggleCategory: toggleCategory2,
    filteredUnits: filteredUnits2,
    categorizedUnits: categorizedUnits2,
    techs: techs2,
    abilities: abilities2,
    modifiedStats: modifiedStats2,
    modifiedStatsNoTimer: modifiedStats2NoTimer,
    activeTimedDuration: timedDuration2,
    toggleTechnology: toggleTechnology2,
    toggleAbility: toggleAbility2,
    incrementAbility: incrementAbility2,
    decrementAbility: decrementAbility2,
    setAbilityCounter: setAbilityCounter2,
    abilityCounters: abilityCounters2,
    lockedAbilities: lockedAbilities2,
    lockedTechnologies: lockedTechnologies2,
    secondaryWeapons: secondaryWeapons2,
    unitMinAge: unitMinAge2,
    fullUpgradeAge: fullUpgradeAge2,
    applyFullUpgrade: applyFullUpgrade2,
    resetTechnologies: resetTechnologies2,
  } = civ2;

  // Reset unit counts (and any active preset toggle) to 1v1 whenever the selected unit changes
  // (mirrors setUnit clearing techs/abilities)
  useEffect(() => { setCount1(1); setActivePreset(null); }, [unit1?.id]);
  useEffect(() => { setCount2(1); setActivePreset(null); }, [unit2?.id]);

  const maxRangeDistance = Math.max(modifiedStats1.maxRange || 0, modifiedStats2.maxRange || 0);
  // Kiting only makes sense when at least one unit is ranged. When both units are
  // melee (range <= 1) there is no approach phase to simulate, so disable the toggle.
  const kitingDisabled = maxRangeDistance <= 1;
  // Turn kiting off when both units become melee (range <= 1) — the toggle is disabled there.
  useEffect(() => { if (kitingDisabled && allowKiting) setAllowKiting(false); }, [kitingDisabled, allowKiting]);
  const startDistance = startDistancePreset === "max" ? maxRangeDistance
    : Math.max(0, Math.min(30, customDistance));

  // Multi-unit simulation is active as soon as either side has more than one unit.
  // count1 === count2 === 1 keeps the full-fidelity 1v1 path (computeVersus).
  const isMultiUnit = count1 > 1 || count2 > 1;

  // Default multi-unit model: "Attack move" (focusFireBatchesMC) when both units are melee,
  // but "Target focus" (focusFire) as soon as either unit is ranged. Re-applied only when the
  // ranged makeup of the matchup changes, so a manual model choice persists within a given matchup.
  const hasRangedUnit = (!!unit1 && getPrimaryWeapon(unit1)?.type === 'ranged') || (!!unit2 && getPrimaryWeapon(unit2)?.type === 'ranged');
  useEffect(() => {
    setMultiUnitModelKey(hasRangedUnit ? 'focusFire' : 'focusFireBatchesMC');
  }, [hasRangedUnit]);

  // ---- Share link ---------------------------------------------------------
  // A share link carries the whole matchup in the query string. The app never
  // writes those params itself (the browsing URL stays `/`), so this only runs
  // when the user arrives from a shared link. Restore is staged because
  // `setUnit` clears techs/abilities and a hook effect forces max age on unit
  // change: the loadout can only be applied once units AND ages have settled,
  // which is also when the tech/ability lists match the shared age.
  const [shareRestore] = useState<ShareState | null>(() => {
    if (typeof window === 'undefined') return null;
    const parsed = parseShareState(window.location.search);
    if (!parsed) return null;
    // Drop slots whose unit no longer exists so a stale link still restores the rest.
    const keep = (s: ShareSlot | null) => (s && aoe4Units.some(u => u.id === s.unitId) ? s : null);
    const state = { ...parsed, slot1: keep(parsed.slot1), slot2: keep(parsed.slot2) };
    return state.slot1 || state.slot2 ? state : null;
  });
  const [sharePhase, setSharePhase] = useState<0 | 1 | 2 | 3>(shareRestore ? 1 : 0);

  useEffect(() => {
    if (!shareRestore || sharePhase === 0) return;
    const { slot1: s1, slot2: s2 } = shareRestore;

    // Phase 1 — select civ + unit on each slot.
    if (sharePhase === 1) {
      setIsVersus(shareRestore.versus);
      const applyUnit = (s: ShareSlot | null, setCiv: (c: string) => void, setU: (u: AoE4Unit | null) => void) => {
        if (!s) return;
        const u = aoe4Units.find(x => x.id === s.unitId);
        if (!u) return;
        setCiv(u.civs.includes(s.civ) ? s.civ : u.civs[0]);
        setU(u);
      };
      applyUnit(s1, setSelectedCiv1, setUnit1);
      applyUnit(s2, setSelectedCiv2, setUnit2);
      setSharePhase(2);
      return;
    }

    const unitReady = (s: ShareSlot | null, u: AoE4Unit | null) => !s || u?.id === s.unitId;
    if (!unitReady(s1, unit1) || !unitReady(s2, unit2)) return;

    // Phase 2 — the hook has just forced max age; write the shared age over it.
    if (sharePhase === 2) {
      if (s1) setSelectedAge1(s1.age);
      if (s2) setSelectedAge2(s2.age);
      setSharePhase(3);
      return;
    }

    if ((s1 && selectedAge1 !== s1.age) || (s2 && selectedAge2 !== s2.age)) return;

    // Phase 3 — loadout + global options. Ids the current patch no longer knows
    // are filtered out rather than failing the whole restore.
    const applyLoadout = (
      s: ShareSlot | null,
      slotTechs: { id: string }[],
      slotAbilities: { id: string }[],
      setTechs: (t: Set<string>) => void,
      setAbilities: (a: Set<string>) => void,
      setCounter: (id: string, value: number) => void,
    ) => {
      if (!s) return;
      setTechs(new Set(s.techs.filter(id => slotTechs.some(t => t.id === id))));
      setAbilities(new Set(s.abilities.filter(id => slotAbilities.some(a => a.id === id))));
      Object.entries(s.counters).forEach(([id, value]) => {
        if (slotAbilities.some(a => a.id === id)) setCounter(id, value);
      });
    };
    applyLoadout(s1, techs1, abilities1, civ1.setActiveTechnologies, civ1.setActiveAbilities, setAbilityCounter1);
    applyLoadout(s2, techs2, abilities2, civ2.setActiveTechnologies, civ2.setActiveAbilities, setAbilityCounter2);
    setCount1(s1?.count ?? 1);
    setCount2(s2?.count ?? 1);
    setActivePreset(shareRestore.preset);
    setAllowKiting(shareRestore.kiting);
    setStartDistancePreset(shareRestore.distancePreset);
    setCustomDistance(shareRestore.customDistance);
    setMultiUnitModelKey(shareRestore.model);
    setSharePhase(0);
  }, [shareRestore, sharePhase, unit1, unit2, selectedAge1, selectedAge2, techs1, techs2, abilities1, abilities2,
    civ1, civ2, setSelectedCiv1, setSelectedCiv2, setUnit1, setUnit2, setSelectedAge1, setSelectedAge2,
    setAbilityCounter1, setAbilityCounter2]);

  const [shareCopied, setShareCopied] = useState(false);

  const handleShare = async () => {
    const buildSlot = (
      unit: AoE4Unit | null, civ: string, age: number,
      activeTechs: Set<string>, activeAbis: Set<string>, counters: Map<string, number>, count: number,
    ): ShareSlot | null => {
      if (!unit) return null;
      const abilities = [...activeAbis];
      const counterEntries = abilities
        .map(id => [id, counters.get(id) ?? 0] as const)
        .filter(([, value]) => value > 0);
      return {
        civ, unitId: unit.id, age,
        techs: [...activeTechs],
        abilities,
        counters: Object.fromEntries(counterEntries),
        count,
      };
    };

    const url = buildShareUrl({
      versus: isVersus,
      slot1: buildSlot(unit1, selectedCiv1, selectedAge1, activeTechnologies1, activeAbilities1, abilityCounters1, count1),
      slot2: buildSlot(unit2, selectedCiv2, selectedAge2, activeTechnologies2, activeAbilities2, abilityCounters2, count2),
      kiting: allowKiting,
      distancePreset: startDistancePreset,
      customDistance,
      model: multiUnitModelKey,
      preset: activePreset,
    }, window.location.origin);

    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
      toast.success("Link copied", { description: "Anyone opening it gets this exact matchup." });
    } catch {
      toast.error("Could not copy automatically", { description: url });
    }
  };


  // Filter bonusDamage entries by weapon type — prevents ranged bonuses (e.g. Howdahs) from
  // applying to melee weapons (e.g. Tusks) and vice-versa.
  const filterBonusForWeapon = (bonusDamage: any[], weaponType: string) => // eslint-disable-line @typescript-eslint/no-explicit-any
    weaponType === 'melee'
      ? bonusDamage.filter((b: any) => b.property !== 'rangedAttack') // eslint-disable-line @typescript-eslint/no-explicit-any
      : bonusDamage.filter((b: any) => b.property !== 'meleeAttack'); // eslint-disable-line @typescript-eslint/no-explicit-any

  // Build variations with applied technologies
  const modifiedVariation1 = variation1 ? (() => {
    return {
      ...variation1,
      hitpoints: modifiedStats1.hitpoints,
      weapons: variation1.weapons.map(weapon => ({
        ...weapon,
        damage: weapon.type === 'melee' ? modifiedStats1.meleeAttack : weapon.type === 'siege' ? (modifiedStats1.siegeAttack ?? modifiedStats1.rangedAttack) : modifiedStats1.rangedAttack,
        speed: modifiedStats1.attackSpeed,
        range: weapon.range ? {
          ...weapon.range,
          max: modifiedStats1.maxRange || weapon.range.max
        } : undefined,
        modifiers: filterBonusForWeapon(modifiedStats1.bonusDamage || [], weapon.type),
        burst: modifiedStats1.burst ? { count: modifiedStats1.burst, decay: modifiedStats1.burstDecay ?? weapon.burst?.decay } : weapon.burst
      })),
      armor: [
        { type: 'melee', value: modifiedStats1.meleeArmor },
        { type: 'ranged', value: modifiedStats1.rangedArmor }
      ],
      resistance: [
        ...(variation1.resistance || []).filter((r: { type: string }) => r.type !== 'ranged' && r.type !== 'melee' && r.type !== 'siege'),
        ...((modifiedStats1.rangedResistance ?? 0) > 0 ? [{ type: 'ranged', value: modifiedStats1.rangedResistance! }] : []),
        ...((modifiedStats1.meleeResistance ?? 0) !== 0 ? [{ type: 'melee', value: modifiedStats1.meleeResistance! }] : []),
        ...((modifiedStats1.siegeResistance ?? 0) !== 0 ? [{ type: 'siege', value: modifiedStats1.siegeResistance! }] : []),
      ],
      costs: (modifiedStats1.costMultiplier != null && modifiedStats1.costMultiplier !== 1.0) || (modifiedStats1.stoneCostMultiplier != null && modifiedStats1.stoneCostMultiplier !== 1.0) || (modifiedStats1.foodCostMultiplier != null && modifiedStats1.foodCostMultiplier !== 1.0) || (modifiedStats1.goldCostMultiplier != null && modifiedStats1.goldCostMultiplier !== 1.0) ? {
        ...variation1.costs,
        food: Math.round((variation1.costs.food || 0) * (modifiedStats1.costMultiplier ?? 1) * (modifiedStats1.foodCostMultiplier ?? 1)),
        wood: Math.round((variation1.costs.wood || 0) * (modifiedStats1.costMultiplier ?? 1)),
        gold: Math.round((variation1.costs.gold || 0) * (modifiedStats1.costMultiplier ?? 1) * (modifiedStats1.goldCostMultiplier ?? 1)),
        stone: Math.round((variation1.costs.stone || 0) * (modifiedStats1.costMultiplier ?? 1) * (modifiedStats1.stoneCostMultiplier ?? 1)),
        oliveoil: Math.round((variation1.costs.oliveoil || 0) * (modifiedStats1.costMultiplier ?? 1)),
      } : variation1.costs,
      movement: variation1.movement ? {
        ...variation1.movement,
        speed: modifiedStats1.moveSpeed
      } : undefined,
      healingRate: modifiedStats1.healingRate ?? 0,
      healingRatePerSecond: modifiedStats1.healingRatePerSecond ?? 0,
      armorPenetration: modifiedStats1.armorPenetration ?? 0,
      opponentAttackSpeedDebuff: modifiedStats1.opponentAttackSpeedDebuff ?? 0,
      versusOpponentDamageDebuff: modifiedStats1.versusOpponentDamageDebuff ?? 1,
      opponentHealingRateDebuff: modifiedStats1.opponentHealingRateDebuff ?? 0,
      bonusDamageReduction: modifiedStats1.bonusDamageReduction ?? 0,
      maxHpBonusFraction: modifiedStats1.maxHpBonusFraction ?? 0,
      hpStartFraction: modifiedStats1.hpStartFraction ?? 1,
      dpsVsMeleeASCoeff: modifiedStats1.dpsVsMeleeASCoeff ?? 0,
      postChargeMeleeBonus: modifiedStats1.postChargeMeleeBonus ?? 0,
      _activeTechs: [...activeTechnologies1],
      firstHitBlocked: activeAbilities1.has('ability-deflective-armor') || activeAbilities1.has('ability-deflective-armor-sen'),
      chargeBonusBurst: getChargeBonusBurst(variation1, activeTechnologies1),
      chargeArmorType: variation1.baseId === 'earls-guard' ? 'ranged' as const :
        (variation1.baseId === 'donso' && activeAbilities1.has('javelin-throw')) ? 'ranged' as const :
          (variation1.baseId === 'naginata-samurai' && activeTechnologies1.has('samurai-bow')) ? 'ranged' as const :
            (['jeanne-darc-woman-at-arms', 'jeanne-darc-knight', 'jeanne-darc-blast-cannon'].includes(variation1.baseId) && (abilityCounters1?.get('ability-holy-wrath') ?? 0) > 0) ? 'none' as const :
              (['jeanne-darc-hunter', 'jeanne-darc-mounted-archer', 'jeanne-darc-markswoman'].includes(variation1.baseId) && (abilityCounters1?.get('ability-divine-arrow') ?? 0) > 0) ? 'none' as const :
                (['musofadi-warrior', 'musofadi-gunner'].includes(variation1.baseId) && activeAbilities1.has('ability-first-strike')) ? 'first-strike' as const : undefined,
      chargeModifiers: (variation1.baseId === 'donso' && activeAbilities1.has('javelin-throw'))
        ? [{ target: { class: [['cavalry']] }, value: selectedAge1 >= 4 ? 10 : selectedAge1 === 3 ? 8 : selectedAge1 === 2 ? 7 : 5 }]
        : (variation1.baseId === 'naginata-samurai' && activeTechnologies1.has('samurai-bow'))
          ? [{ target: { class: [['light', 'melee', 'infantry']] }, value: selectedAge1 >= 4 ? 7 : selectedAge1 >= 3 ? 6 : selectedAge1 >= 2 ? 5 : 4 }]
          : undefined,
      secondaryWeapons: (() => {
        const primaryWeapon1 = getPrimaryWeapon(variation1);
        const primaryBaseDamage = primaryWeapon1?.damage || 0;
        const meleeAttackDelta = modifiedStats1.meleeAttack - primaryBaseDamage;
        const isPrimaryRanged1 = primaryWeapon1?.type === 'ranged' || primaryWeapon1?.type === 'siege';
        const rangedBase1 = isPrimaryRanged1 ? primaryBaseDamage : (secondaryWeapons1.find((sw: any) => sw.type === 'ranged' || sw.type === 'siege')?.damage || 0); // eslint-disable-line @typescript-eslint/no-explicit-any
        const rangedMultiplier1 = modifiedStats1.rangedAttackMultiplier ?? 1;
        const rangedFlatDelta1 = modifiedStats1.rangedAttack / rangedMultiplier1 - rangedBase1;
        return secondaryWeapons1.map((w: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
          ...w,
          speed: (modifiedStats1.secondaryWeaponAttackSpeedMultiplier ?? 1) !== 1 ? (w.speed || 0) * modifiedStats1.secondaryWeaponAttackSpeedMultiplier! : w.speed,
          damage: (() => {
            const raw = w.type === 'ranged' || w.type === 'siege'
              ? w.damageMultiplier != null
                ? (rangedBase1 * w.damageMultiplier + rangedFlatDelta1) * rangedMultiplier1
                : (w.injectedWeapon ? w.damage : modifiedStats1.rangedAttack)
              : (w.damage + meleeAttackDelta);
            return w.maxDamage != null ? Math.min(raw, w.maxDamage) : raw;
          })(),
          modifiers: (w.type === 'ranged' || w.type === 'siege')
            ? (w.injectedWeapon && w.damageMultiplier == null ? (w.modifiers || []) : filterBonusForWeapon(modifiedStats1.bonusDamage || [], w.type).filter((m: any) => !m.chargeBonusLabel)) // eslint-disable-line @typescript-eslint/no-explicit-any
            : [...(w.modifiers || []), ...filterBonusForWeapon(modifiedStats1.bonusDamage || [], 'melee').filter((b: any) => !b.fromWeapon)], // eslint-disable-line @typescript-eslint/no-explicit-any
        }));
      })(),
    };
  })() : undefined;

  const modifiedVariation2 = variation2 ? (() => {
    return {
      ...variation2,
      hitpoints: modifiedStats2.hitpoints,
      weapons: variation2.weapons.map(weapon => ({
        ...weapon,
        damage: weapon.type === 'melee' ? modifiedStats2.meleeAttack : weapon.type === 'siege' ? (modifiedStats2.siegeAttack ?? modifiedStats2.rangedAttack) : modifiedStats2.rangedAttack,
        speed: modifiedStats2.attackSpeed,
        range: weapon.range ? {
          ...weapon.range,
          max: modifiedStats2.maxRange || weapon.range.max
        } : undefined,
        modifiers: filterBonusForWeapon(modifiedStats2.bonusDamage || [], weapon.type),
        burst: modifiedStats2.burst ? { count: modifiedStats2.burst, decay: modifiedStats2.burstDecay ?? weapon.burst?.decay } : weapon.burst
      })),
      armor: [
        { type: 'melee', value: modifiedStats2.meleeArmor },
        { type: 'ranged', value: modifiedStats2.rangedArmor }
      ],
      resistance: [
        ...(variation2.resistance || []).filter((r: { type: string }) => r.type !== 'ranged' && r.type !== 'melee' && r.type !== 'siege'),
        ...((modifiedStats2.rangedResistance ?? 0) > 0 ? [{ type: 'ranged', value: modifiedStats2.rangedResistance! }] : []),
        ...((modifiedStats2.meleeResistance ?? 0) !== 0 ? [{ type: 'melee', value: modifiedStats2.meleeResistance! }] : []),
        ...((modifiedStats2.siegeResistance ?? 0) !== 0 ? [{ type: 'siege', value: modifiedStats2.siegeResistance! }] : []),
      ],
      costs: (modifiedStats2.costMultiplier != null && modifiedStats2.costMultiplier !== 1.0) || (modifiedStats2.stoneCostMultiplier != null && modifiedStats2.stoneCostMultiplier !== 1.0) || (modifiedStats2.foodCostMultiplier != null && modifiedStats2.foodCostMultiplier !== 1.0) || (modifiedStats2.goldCostMultiplier != null && modifiedStats2.goldCostMultiplier !== 1.0) ? {
        ...variation2.costs,
        food: Math.round((variation2.costs.food || 0) * (modifiedStats2.costMultiplier ?? 1) * (modifiedStats2.foodCostMultiplier ?? 1)),
        wood: Math.round((variation2.costs.wood || 0) * (modifiedStats2.costMultiplier ?? 1)),
        gold: Math.round((variation2.costs.gold || 0) * (modifiedStats2.costMultiplier ?? 1) * (modifiedStats2.goldCostMultiplier ?? 1)),
        stone: Math.round((variation2.costs.stone || 0) * (modifiedStats2.costMultiplier ?? 1) * (modifiedStats2.stoneCostMultiplier ?? 1)),
        oliveoil: Math.round((variation2.costs.oliveoil || 0) * (modifiedStats2.costMultiplier ?? 1)),
      } : variation2.costs,
      movement: variation2.movement ? {
        ...variation2.movement,
        speed: modifiedStats2.moveSpeed
      } : undefined,
      healingRate: modifiedStats2.healingRate ?? 0,
      healingRatePerSecond: modifiedStats2.healingRatePerSecond ?? 0,
      armorPenetration: modifiedStats2.armorPenetration ?? 0,
      opponentAttackSpeedDebuff: modifiedStats2.opponentAttackSpeedDebuff ?? 0,
      versusOpponentDamageDebuff: modifiedStats2.versusOpponentDamageDebuff ?? 1,
      opponentHealingRateDebuff: modifiedStats2.opponentHealingRateDebuff ?? 0,
      bonusDamageReduction: modifiedStats2.bonusDamageReduction ?? 0,
      maxHpBonusFraction: modifiedStats2.maxHpBonusFraction ?? 0,
      hpStartFraction: modifiedStats2.hpStartFraction ?? 1,
      dpsVsMeleeASCoeff: modifiedStats2.dpsVsMeleeASCoeff ?? 0,
      postChargeMeleeBonus: modifiedStats2.postChargeMeleeBonus ?? 0,
      _activeTechs: [...activeTechnologies2],
      firstHitBlocked: activeAbilities2.has('ability-deflective-armor') || activeAbilities2.has('ability-deflective-armor-sen'),
      chargeBonusBurst: getChargeBonusBurst(variation2, activeTechnologies2),
      chargeArmorType: variation2.baseId === 'earls-guard' ? 'ranged' as const :
        (variation2.baseId === 'donso' && activeAbilities2.has('javelin-throw')) ? 'ranged' as const :
          (variation2.baseId === 'naginata-samurai' && activeTechnologies2.has('samurai-bow')) ? 'ranged' as const :
            (['jeanne-darc-woman-at-arms', 'jeanne-darc-knight', 'jeanne-darc-blast-cannon'].includes(variation2.baseId) && (abilityCounters2?.get('ability-holy-wrath') ?? 0) > 0) ? 'none' as const :
              (['jeanne-darc-hunter', 'jeanne-darc-mounted-archer', 'jeanne-darc-markswoman'].includes(variation2.baseId) && (abilityCounters2?.get('ability-divine-arrow') ?? 0) > 0) ? 'none' as const :
                (['musofadi-warrior', 'musofadi-gunner'].includes(variation2.baseId) && activeAbilities2.has('ability-first-strike')) ? 'first-strike' as const : undefined,
      chargeModifiers: (variation2.baseId === 'donso' && activeAbilities2.has('javelin-throw'))
        ? [{ target: { class: [['cavalry']] }, value: selectedAge2 >= 4 ? 10 : selectedAge2 === 3 ? 8 : selectedAge2 === 2 ? 7 : 5 }]
        : (variation2.baseId === 'naginata-samurai' && activeTechnologies2.has('samurai-bow'))
          ? [{ target: { class: [['light', 'melee', 'infantry']] }, value: selectedAge2 >= 4 ? 7 : selectedAge2 >= 3 ? 6 : selectedAge2 >= 2 ? 5 : 4 }]
          : undefined,
      secondaryWeapons: (() => {
        const primaryWeapon2 = getPrimaryWeapon(variation2);
        const primaryBaseDamage = primaryWeapon2?.damage || 0;
        const meleeAttackDelta = modifiedStats2.meleeAttack - primaryBaseDamage;
        const isPrimaryRanged2 = primaryWeapon2?.type === 'ranged' || primaryWeapon2?.type === 'siege';
        const rangedBase2 = isPrimaryRanged2 ? primaryBaseDamage : (secondaryWeapons2.find((sw: any) => sw.type === 'ranged' || sw.type === 'siege')?.damage || 0); // eslint-disable-line @typescript-eslint/no-explicit-any
        const rangedMultiplier2 = modifiedStats2.rangedAttackMultiplier ?? 1;
        const rangedFlatDelta2 = modifiedStats2.rangedAttack / rangedMultiplier2 - rangedBase2;
        return secondaryWeapons2.map((w: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
          ...w,
          speed: (modifiedStats2.secondaryWeaponAttackSpeedMultiplier ?? 1) !== 1 ? (w.speed || 0) * modifiedStats2.secondaryWeaponAttackSpeedMultiplier! : w.speed,
          damage: (() => {
            const raw = w.type === 'ranged' || w.type === 'siege'
              ? w.damageMultiplier != null
                ? (rangedBase2 * w.damageMultiplier + rangedFlatDelta2) * rangedMultiplier2
                : (w.injectedWeapon ? w.damage : modifiedStats2.rangedAttack)
              : (w.damage + meleeAttackDelta);
            return w.maxDamage != null ? Math.min(raw, w.maxDamage) : raw;
          })(),
          modifiers: (w.type === 'ranged' || w.type === 'siege')
            ? (w.injectedWeapon && w.damageMultiplier == null ? (w.modifiers || []) : filterBonusForWeapon(modifiedStats2.bonusDamage || [], w.type)) // eslint-disable-line @typescript-eslint/no-explicit-any
            : [...(w.modifiers || []), ...filterBonusForWeapon(modifiedStats2.bonusDamage || [], 'melee').filter((b: any) => !b.fromWeapon)], // eslint-disable-line @typescript-eslint/no-explicit-any
        }));
      })(),
    };
  })() : undefined;

  // Compute stats for comparison
  const data1 = modifiedVariation1 || unit1;
  const data2 = modifiedVariation2 || unit2;

  const modifiedUnit1 = unit1 && !variation1 ? (() => {
    return {
      ...unit1,
      hitpoints: modifiedStats1.hitpoints,
      weapons: unit1.weapons.map(weapon => ({
        ...weapon,
        damage: weapon.type === 'melee' ? modifiedStats1.meleeAttack : weapon.type === 'siege' ? (modifiedStats1.siegeAttack ?? modifiedStats1.rangedAttack) : modifiedStats1.rangedAttack,
        speed: modifiedStats1.attackSpeed,
        range: weapon.range ? {
          ...weapon.range,
          max: modifiedStats1.maxRange || weapon.range.max
        } : undefined,
        modifiers: filterBonusForWeapon(modifiedStats1.bonusDamage || [], weapon.type),
        burst: modifiedStats1.burst ? { count: modifiedStats1.burst, decay: modifiedStats1.burstDecay ?? weapon.burst?.decay } : weapon.burst
      })),
      armor: [
        { type: 'melee', value: modifiedStats1.meleeArmor },
        { type: 'ranged', value: modifiedStats1.rangedArmor }
      ],
      resistance: [
        ...(unit1.resistance || []).filter((r: { type: string }) => r.type !== 'ranged' && r.type !== 'melee' && r.type !== 'siege'),
        ...((modifiedStats1.rangedResistance ?? 0) > 0 ? [{ type: 'ranged', value: modifiedStats1.rangedResistance! }] : []),
        ...((modifiedStats1.meleeResistance ?? 0) !== 0 ? [{ type: 'melee', value: modifiedStats1.meleeResistance! }] : []),
        ...((modifiedStats1.siegeResistance ?? 0) !== 0 ? [{ type: 'siege', value: modifiedStats1.siegeResistance! }] : []),
      ],
      movement: unit1.movement ? {
        ...unit1.movement,
        speed: modifiedStats1.moveSpeed
      } : undefined,
      healingRate: modifiedStats1.healingRate ?? 0,
      healingRatePerSecond: modifiedStats1.healingRatePerSecond ?? 0,
      armorPenetration: modifiedStats1.armorPenetration ?? 0,
      opponentAttackSpeedDebuff: modifiedStats1.opponentAttackSpeedDebuff ?? 0,
      versusOpponentDamageDebuff: modifiedStats1.versusOpponentDamageDebuff ?? 1,
      opponentHealingRateDebuff: modifiedStats1.opponentHealingRateDebuff ?? 0,
      bonusDamageReduction: modifiedStats1.bonusDamageReduction ?? 0,
      maxHpBonusFraction: modifiedStats1.maxHpBonusFraction ?? 0,
      hpStartFraction: modifiedStats1.hpStartFraction ?? 1,
      dpsVsMeleeASCoeff: modifiedStats1.dpsVsMeleeASCoeff ?? 0,
      postChargeMeleeBonus: modifiedStats1.postChargeMeleeBonus ?? 0,
      _activeTechs: [...activeTechnologies1],
      firstHitBlocked: activeAbilities1.has('ability-deflective-armor') || activeAbilities1.has('ability-deflective-armor-sen'),
      chargeBonusBurst: getChargeBonusBurst(unit1, activeTechnologies1),
      chargeArmorType: unit1.id === 'earls-guard' ? 'ranged' as const :
        (unit1.id === 'donso' && activeAbilities1.has('javelin-throw')) ? 'ranged' as const :
          (unit1.id === 'naginata-samurai' && activeTechnologies1.has('samurai-bow')) ? 'ranged' as const :
            (['jeanne-darc-woman-at-arms', 'jeanne-darc-knight', 'jeanne-darc-blast-cannon'].includes(unit1.id) && (abilityCounters1?.get('ability-holy-wrath') ?? 0) > 0) ? 'none' as const :
              (['jeanne-darc-hunter', 'jeanne-darc-mounted-archer', 'jeanne-darc-markswoman'].includes(unit1.id) && (abilityCounters1?.get('ability-divine-arrow') ?? 0) > 0) ? 'none' as const :
                (['musofadi-warrior', 'musofadi-gunner'].includes(unit1.id) && activeAbilities1.has('ability-first-strike')) ? 'first-strike' as const : undefined,
      chargeModifiers: (unit1.id === 'donso' && activeAbilities1.has('javelin-throw'))
        ? [{ target: { class: [['cavalry']] }, value: selectedAge1 >= 4 ? 10 : selectedAge1 === 3 ? 8 : selectedAge1 === 2 ? 7 : 5 }]
        : (unit1.id === 'naginata-samurai' && activeTechnologies1.has('samurai-bow'))
          ? [{ target: { class: [['light', 'melee', 'infantry']] }, value: selectedAge1 >= 4 ? 7 : selectedAge1 >= 3 ? 6 : selectedAge1 >= 2 ? 5 : 4 }]
          : undefined,
      secondaryWeapons: (() => {
        const primaryWeaponU1 = getPrimaryWeapon(unit1);
        const primaryBaseDamage = primaryWeaponU1?.damage || 0;
        const meleeAttackDelta = modifiedStats1.meleeAttack - primaryBaseDamage;
        const isPrimaryRangedU1 = primaryWeaponU1?.type === 'ranged' || primaryWeaponU1?.type === 'siege';
        const rangedBaseU1 = isPrimaryRangedU1 ? primaryBaseDamage : (secondaryWeapons1.find((sw: any) => sw.type === 'ranged' || sw.type === 'siege')?.damage || 0); // eslint-disable-line @typescript-eslint/no-explicit-any
        const rangedMultiplierU1 = modifiedStats1.rangedAttackMultiplier ?? 1;
        const rangedFlatDeltaU1 = modifiedStats1.rangedAttack / rangedMultiplierU1 - rangedBaseU1;
        return secondaryWeapons1.map((w: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
          ...w,
          speed: (modifiedStats1.secondaryWeaponAttackSpeedMultiplier ?? 1) !== 1 ? (w.speed || 0) * modifiedStats1.secondaryWeaponAttackSpeedMultiplier! : w.speed,
          damage: (() => {
            const raw = w.type === 'ranged' || w.type === 'siege'
              ? w.damageMultiplier != null
                ? (rangedBaseU1 * w.damageMultiplier + rangedFlatDeltaU1) * rangedMultiplierU1
                : (w.injectedWeapon ? w.damage : modifiedStats1.rangedAttack)
              : (w.damage + meleeAttackDelta);
            return w.maxDamage != null ? Math.min(raw, w.maxDamage) : raw;
          })(),
          modifiers: (w.type === 'ranged' || w.type === 'siege')
            ? (w.injectedWeapon && w.damageMultiplier == null ? (w.modifiers || []) : filterBonusForWeapon(modifiedStats1.bonusDamage || [], w.type).filter((m: any) => !m.chargeBonusLabel)) // eslint-disable-line @typescript-eslint/no-explicit-any
            : [...(w.modifiers || []), ...filterBonusForWeapon(modifiedStats1.bonusDamage || [], 'melee').filter((b: any) => !b.fromWeapon)], // eslint-disable-line @typescript-eslint/no-explicit-any
        }));
      })(),
    };
  })() : undefined;

  const modifiedUnit2 = unit2 && !variation2 ? (() => {
    return {
      ...unit2,
      hitpoints: modifiedStats2.hitpoints,
      weapons: unit2.weapons.map(weapon => ({
        ...weapon,
        damage: weapon.type === 'melee' ? modifiedStats2.meleeAttack : weapon.type === 'siege' ? (modifiedStats2.siegeAttack ?? modifiedStats2.rangedAttack) : modifiedStats2.rangedAttack,
        speed: modifiedStats2.attackSpeed,
        range: weapon.range ? {
          ...weapon.range,
          max: modifiedStats2.maxRange || weapon.range.max
        } : undefined,
        modifiers: filterBonusForWeapon(modifiedStats2.bonusDamage || [], weapon.type),
        burst: modifiedStats2.burst ? { count: modifiedStats2.burst, decay: modifiedStats2.burstDecay ?? weapon.burst?.decay } : weapon.burst
      })),
      armor: [
        { type: 'melee', value: modifiedStats2.meleeArmor },
        { type: 'ranged', value: modifiedStats2.rangedArmor }
      ],
      resistance: [
        ...(unit2.resistance || []).filter((r: { type: string }) => r.type !== 'ranged' && r.type !== 'melee' && r.type !== 'siege'),
        ...((modifiedStats2.rangedResistance ?? 0) > 0 ? [{ type: 'ranged', value: modifiedStats2.rangedResistance! }] : []),
        ...((modifiedStats2.meleeResistance ?? 0) !== 0 ? [{ type: 'melee', value: modifiedStats2.meleeResistance! }] : []),
        ...((modifiedStats2.siegeResistance ?? 0) !== 0 ? [{ type: 'siege', value: modifiedStats2.siegeResistance! }] : []),
      ],
      movement: unit2.movement ? {
        ...unit2.movement,
        speed: modifiedStats2.moveSpeed
      } : undefined,
      healingRate: modifiedStats2.healingRate ?? 0,
      healingRatePerSecond: modifiedStats2.healingRatePerSecond ?? 0,
      armorPenetration: modifiedStats2.armorPenetration ?? 0,
      opponentAttackSpeedDebuff: modifiedStats2.opponentAttackSpeedDebuff ?? 0,
      versusOpponentDamageDebuff: modifiedStats2.versusOpponentDamageDebuff ?? 1,
      opponentHealingRateDebuff: modifiedStats2.opponentHealingRateDebuff ?? 0,
      bonusDamageReduction: modifiedStats2.bonusDamageReduction ?? 0,
      maxHpBonusFraction: modifiedStats2.maxHpBonusFraction ?? 0,
      hpStartFraction: modifiedStats2.hpStartFraction ?? 1,
      dpsVsMeleeASCoeff: modifiedStats2.dpsVsMeleeASCoeff ?? 0,
      postChargeMeleeBonus: modifiedStats2.postChargeMeleeBonus ?? 0,
      _activeTechs: [...activeTechnologies2],
      firstHitBlocked: activeAbilities2.has('ability-deflective-armor') || activeAbilities2.has('ability-deflective-armor-sen'),
      chargeBonusBurst: getChargeBonusBurst(unit2, activeTechnologies2),
      chargeArmorType: unit2.id === 'earls-guard' ? 'ranged' as const :
        (unit2.id === 'donso' && activeAbilities2.has('javelin-throw')) ? 'ranged' as const :
          (unit2.id === 'naginata-samurai' && activeTechnologies2.has('samurai-bow')) ? 'ranged' as const :
            (['jeanne-darc-woman-at-arms', 'jeanne-darc-knight', 'jeanne-darc-blast-cannon'].includes(unit2.id) && (abilityCounters2?.get('ability-holy-wrath') ?? 0) > 0) ? 'none' as const :
              (['jeanne-darc-hunter', 'jeanne-darc-mounted-archer', 'jeanne-darc-markswoman'].includes(unit2.id) && (abilityCounters2?.get('ability-divine-arrow') ?? 0) > 0) ? 'none' as const :
                (['musofadi-warrior', 'musofadi-gunner'].includes(unit2.id) && activeAbilities2.has('ability-first-strike')) ? 'first-strike' as const : undefined,
      chargeModifiers: (unit2.id === 'donso' && activeAbilities2.has('javelin-throw'))
        ? [{ target: { class: [['cavalry']] }, value: selectedAge2 >= 4 ? 10 : selectedAge2 === 3 ? 8 : selectedAge2 === 2 ? 7 : 5 }]
        : (unit2.id === 'naginata-samurai' && activeTechnologies2.has('samurai-bow'))
          ? [{ target: { class: [['light', 'melee', 'infantry']] }, value: selectedAge2 >= 4 ? 7 : selectedAge2 >= 3 ? 6 : selectedAge2 >= 2 ? 5 : 4 }]
          : undefined,
      secondaryWeapons: (() => {
        const primaryWeaponU2 = getPrimaryWeapon(unit2);
        const primaryBaseDamage = primaryWeaponU2?.damage || 0;
        const meleeAttackDelta = modifiedStats2.meleeAttack - primaryBaseDamage;
        const isPrimaryRangedU2 = primaryWeaponU2?.type === 'ranged' || primaryWeaponU2?.type === 'siege';
        const rangedBaseU2 = isPrimaryRangedU2 ? primaryBaseDamage : (secondaryWeapons2.find((sw: any) => sw.type === 'ranged' || sw.type === 'siege')?.damage || 0); // eslint-disable-line @typescript-eslint/no-explicit-any
        const rangedMultiplierU2 = modifiedStats2.rangedAttackMultiplier ?? 1;
        const rangedFlatDeltaU2 = modifiedStats2.rangedAttack / rangedMultiplierU2 - rangedBaseU2;
        return secondaryWeapons2.map((w: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
          ...w,
          speed: (modifiedStats2.secondaryWeaponAttackSpeedMultiplier ?? 1) !== 1 ? (w.speed || 0) * modifiedStats2.secondaryWeaponAttackSpeedMultiplier! : w.speed,
          damage: (() => {
            const raw = w.type === 'ranged' || w.type === 'siege'
              ? w.damageMultiplier != null
                ? (rangedBaseU2 * w.damageMultiplier + rangedFlatDeltaU2) * rangedMultiplierU2
                : (w.injectedWeapon ? w.damage : modifiedStats2.rangedAttack)
              : (w.damage + meleeAttackDelta);
            return w.maxDamage != null ? Math.min(raw, w.maxDamage) : raw;
          })(),
          modifiers: (w.type === 'ranged' || w.type === 'siege')
            ? (w.injectedWeapon && w.damageMultiplier == null ? (w.modifiers || []) : filterBonusForWeapon(modifiedStats2.bonusDamage || [], w.type)) // eslint-disable-line @typescript-eslint/no-explicit-any
            : [...(w.modifiers || []), ...filterBonusForWeapon(modifiedStats2.bonusDamage || [], 'melee').filter((b: any) => !b.fromWeapon)], // eslint-disable-line @typescript-eslint/no-explicit-any
        }));
      })(),
    };
  })() : undefined;

  // noTimer variations: same structure as originals but with duration-tagged ability effects excluded.
  // Built whenever a timed ability is active on that side.
  const modifiedVariation1NoTimer = (timedDuration1 && modifiedVariation1 && variation1) ? (() => {
    const s = modifiedStats1NoTimer;
    return {
      ...modifiedVariation1,
      hitpoints: s.hitpoints,
      weapons: variation1.weapons.map(w => ({
        ...w,
        damage: w.type === 'melee' ? s.meleeAttack : w.type === 'siege' ? (s.siegeAttack ?? s.rangedAttack) : s.rangedAttack,
        speed: s.attackSpeed,
        range: w.range ? { ...w.range, max: s.maxRange || w.range.max } : undefined,
        modifiers: filterBonusForWeapon(s.bonusDamage || [], w.type),
        burst: s.burst ? { count: s.burst, decay: s.burstDecay ?? w.burst?.decay } : w.burst,
      })),
      armor: [{ type: 'melee', value: s.meleeArmor }, { type: 'ranged', value: s.rangedArmor }],
      resistance: [
        ...(variation1.resistance || []).filter((r: any) => r.type !== 'ranged' && r.type !== 'melee' && r.type !== 'siege'), // eslint-disable-line @typescript-eslint/no-explicit-any
        ...((s.rangedResistance ?? 0) > 0 ? [{ type: 'ranged', value: s.rangedResistance! }] : []),
        ...((s.meleeResistance ?? 0) !== 0 ? [{ type: 'melee', value: s.meleeResistance! }] : []),
        ...((s.siegeResistance ?? 0) !== 0 ? [{ type: 'siege', value: s.siegeResistance! }] : []),
      ],
      movement: modifiedVariation1.movement ? { ...modifiedVariation1.movement, speed: s.moveSpeed } : undefined,
      healingRate: s.healingRate ?? 0,
      healingRatePerSecond: s.healingRatePerSecond ?? 0,
      armorPenetration: s.armorPenetration ?? 0,
      opponentAttackSpeedDebuff: s.opponentAttackSpeedDebuff ?? 0,
      opponentHealingRateDebuff: s.opponentHealingRateDebuff ?? 0,
      maxHpBonusFraction: s.maxHpBonusFraction ?? 0,
    };
  })() : undefined;

  const modifiedVariation2NoTimer = (timedDuration2 && modifiedVariation2 && variation2) ? (() => {
    const s = modifiedStats2NoTimer;
    return {
      ...modifiedVariation2,
      hitpoints: s.hitpoints,
      weapons: variation2.weapons.map(w => ({
        ...w,
        damage: w.type === 'melee' ? s.meleeAttack : w.type === 'siege' ? (s.siegeAttack ?? s.rangedAttack) : s.rangedAttack,
        speed: s.attackSpeed,
        range: w.range ? { ...w.range, max: s.maxRange || w.range.max } : undefined,
        modifiers: filterBonusForWeapon(s.bonusDamage || [], w.type),
        burst: s.burst ? { count: s.burst, decay: s.burstDecay ?? w.burst?.decay } : w.burst,
      })),
      armor: [{ type: 'melee', value: s.meleeArmor }, { type: 'ranged', value: s.rangedArmor }],
      resistance: [
        ...(variation2.resistance || []).filter((r: any) => r.type !== 'ranged' && r.type !== 'melee' && r.type !== 'siege'), // eslint-disable-line @typescript-eslint/no-explicit-any
        ...((s.rangedResistance ?? 0) > 0 ? [{ type: 'ranged', value: s.rangedResistance! }] : []),
        ...((s.meleeResistance ?? 0) !== 0 ? [{ type: 'melee', value: s.meleeResistance! }] : []),
        ...((s.siegeResistance ?? 0) !== 0 ? [{ type: 'siege', value: s.siegeResistance! }] : []),
      ],
      movement: modifiedVariation2.movement ? { ...modifiedVariation2.movement, speed: s.moveSpeed } : undefined,
      healingRate: s.healingRate ?? 0,
      healingRatePerSecond: s.healingRatePerSecond ?? 0,
      armorPenetration: s.armorPenetration ?? 0,
      opponentAttackSpeedDebuff: s.opponentAttackSpeedDebuff ?? 0,
      opponentHealingRateDebuff: s.opponentHealingRateDebuff ?? 0,
      maxHpBonusFraction: s.maxHpBonusFraction ?? 0,
    };
  })() : undefined;

  const modifiedUnit1NoTimer = (timedDuration1 && unit1 && !variation1) ? (() => {
    const s = modifiedStats1NoTimer;
    return {
      ...modifiedUnit1!,
      hitpoints: s.hitpoints,
      weapons: unit1.weapons.map(w => ({
        ...w,
        damage: w.type === 'melee' ? s.meleeAttack : w.type === 'siege' ? (s.siegeAttack ?? s.rangedAttack) : s.rangedAttack,
        speed: s.attackSpeed,
        range: w.range ? { ...w.range, max: s.maxRange || w.range.max } : undefined,
        modifiers: filterBonusForWeapon(s.bonusDamage || [], w.type),
        burst: s.burst ? { count: s.burst, decay: s.burstDecay ?? w.burst?.decay } : w.burst,
      })),
      armor: [{ type: 'melee', value: s.meleeArmor }, { type: 'ranged', value: s.rangedArmor }],
      resistance: [
        ...(unit1.resistance || []).filter((r: any) => r.type !== 'ranged' && r.type !== 'melee' && r.type !== 'siege'), // eslint-disable-line @typescript-eslint/no-explicit-any
        ...((s.rangedResistance ?? 0) > 0 ? [{ type: 'ranged', value: s.rangedResistance! }] : []),
        ...((s.meleeResistance ?? 0) !== 0 ? [{ type: 'melee', value: s.meleeResistance! }] : []),
        ...((s.siegeResistance ?? 0) !== 0 ? [{ type: 'siege', value: s.siegeResistance! }] : []),
      ],
      movement: unit1.movement ? { ...unit1.movement, speed: s.moveSpeed } : undefined,
      healingRate: s.healingRate ?? 0,
      healingRatePerSecond: s.healingRatePerSecond ?? 0,
      armorPenetration: s.armorPenetration ?? 0,
      opponentAttackSpeedDebuff: s.opponentAttackSpeedDebuff ?? 0,
      opponentHealingRateDebuff: s.opponentHealingRateDebuff ?? 0,
      maxHpBonusFraction: s.maxHpBonusFraction ?? 0,
    };
  })() : undefined;

  const modifiedUnit2NoTimer = (timedDuration2 && unit2 && !variation2) ? (() => {
    const s = modifiedStats2NoTimer;
    return {
      ...modifiedUnit2!,
      hitpoints: s.hitpoints,
      weapons: unit2.weapons.map(w => ({
        ...w,
        damage: w.type === 'melee' ? s.meleeAttack : w.type === 'siege' ? (s.siegeAttack ?? s.rangedAttack) : s.rangedAttack,
        speed: s.attackSpeed,
        range: w.range ? { ...w.range, max: s.maxRange || w.range.max } : undefined,
        modifiers: filterBonusForWeapon(s.bonusDamage || [], w.type),
        burst: s.burst ? { count: s.burst, decay: s.burstDecay ?? w.burst?.decay } : w.burst,
      })),
      armor: [{ type: 'melee', value: s.meleeArmor }, { type: 'ranged', value: s.rangedArmor }],
      resistance: [
        ...(unit2.resistance || []).filter((r: any) => r.type !== 'ranged' && r.type !== 'melee' && r.type !== 'siege'), // eslint-disable-line @typescript-eslint/no-explicit-any
        ...((s.rangedResistance ?? 0) > 0 ? [{ type: 'ranged', value: s.rangedResistance! }] : []),
        ...((s.meleeResistance ?? 0) !== 0 ? [{ type: 'melee', value: s.meleeResistance! }] : []),
        ...((s.siegeResistance ?? 0) !== 0 ? [{ type: 'siege', value: s.siegeResistance! }] : []),
      ],
      movement: unit2.movement ? { ...unit2.movement, speed: s.moveSpeed } : undefined,
      healingRate: s.healingRate ?? 0,
      healingRatePerSecond: s.healingRatePerSecond ?? 0,
      armorPenetration: s.armorPenetration ?? 0,
      opponentAttackSpeedDebuff: s.opponentAttackSpeedDebuff ?? 0,
      opponentHealingRateDebuff: s.opponentHealingRateDebuff ?? 0,
      maxHpBonusFraction: s.maxHpBonusFraction ?? 0,
    };
  })() : undefined;

  // Final stats with costs
  const stats1 = data1 ? {
    hp: modifiedStats1.hitpoints * (modifiedStats1.hpStartFraction ?? 1),
    attack: (() => {
      const baseAttack = Math.max(modifiedStats1.meleeAttack, modifiedStats1.rangedAttack, modifiedStats1.siegeAttack || 0);
      // In versus mode, apply the civ2 abilities debuff to the civ1's damage
      if (unit1 && unit2 && activeAbilities2.size > 0) {
        const debuffMultiplier = getVersusDebuffMultiplier(
          unit1.classes || [],
          Array.from(activeAbilities2)
        );
        return baseAttack * debuffMultiplier;
      }
      return baseAttack;
    })(),
    meleeArmor: modifiedStats1.meleeArmor,
    rangedArmor: modifiedStats1.rangedArmor,
    speed: modifiedStats1.moveSpeed,
    attackSpeed: modifiedStats1.attackSpeed || 0,
    maxRange: modifiedStats1.maxRange || 0,
    bonusDamage: modifiedStats1.bonusDamage || [],
    chargeBonus: getChargeBonus(data1, activeAbilities1, selectedAge1, activeTechnologies1, modifiedStats1.chargeMultiplier, modifiedStats1.meleeAttack, abilityCounters1, modifiedStats1.rangedAttack, modifiedStats1.chargeChange),
    cost: variation1 ? getTotalCost(variation1) : (unit1 ? getTotalCost(unit1) : 0),
    costs: variation1 ? variation1.costs : (unit1 ? unit1.costs : undefined),
    population: 'costs' in (variation1 || unit1 || {}) ? (variation1 || unit1 as any)?.costs?.popcap : undefined, // eslint-disable-line @typescript-eslint/no-explicit-any
    productionTime: 'costs' in (variation1 || unit1 || {}) ? (variation1 || unit1 as any)?.costs?.time : undefined // eslint-disable-line @typescript-eslint/no-explicit-any
  } : null;

  const stats2 = data2 ? {
    hp: modifiedStats2.hitpoints * (modifiedStats2.hpStartFraction ?? 1),
    attack: (() => {
      const baseAttack = Math.max(modifiedStats2.meleeAttack, modifiedStats2.rangedAttack, modifiedStats2.siegeAttack || 0);
      // In versus mode, apply the civ1 abilities debuff to the civ2's damage
      if (unit1 && unit2 && activeAbilities1.size > 0) {
        const debuffMultiplier = getVersusDebuffMultiplier(
          unit2.classes || [],
          Array.from(activeAbilities1)
        );
        return baseAttack * debuffMultiplier;
      }
      return baseAttack;
    })(),
    meleeArmor: modifiedStats2.meleeArmor,
    rangedArmor: modifiedStats2.rangedArmor,
    speed: modifiedStats2.moveSpeed,
    attackSpeed: modifiedStats2.attackSpeed || 0,
    maxRange: modifiedStats2.maxRange || 0,
    bonusDamage: modifiedStats2.bonusDamage || [],
    chargeBonus: getChargeBonus(data2, activeAbilities2, selectedAge2, activeTechnologies2, modifiedStats2.chargeMultiplier, modifiedStats2.meleeAttack, abilityCounters2, modifiedStats2.rangedAttack, modifiedStats2.chargeChange),
    cost: variation2 ? getTotalCost(variation2) : (unit2 ? getTotalCost(unit2) : 0),
    costs: variation2 ? variation2.costs : (unit2 ? unit2.costs : undefined),
    population: 'costs' in (variation2 || unit2 || {}) ? (variation2 || unit2 as any)?.costs?.popcap : undefined, // eslint-disable-line @typescript-eslint/no-explicit-any
    productionTime: 'costs' in (variation2 || unit2 || {}) ? (variation2 || unit2 as any)?.costs?.time : undefined // eslint-disable-line @typescript-eslint/no-explicit-any
  } : null;

  // Comparative-mode DPS: effective damage per second against the OPPOSING unit (its armor,
  // resistances, bonus-damage matching and debuffs), computed with the same engine as versus mode.
  // startDistance 0 disables the approach phase (it only shifts hpStartFraction — DPS is unaffected —
  // but skipping it keeps this purely a stat comparison).
  const comparativeDps = (!isVersus && unit1 && unit2) ? (() => {
    const mv1 = modifiedVariation1 || modifiedUnit1;
    const mv2 = modifiedVariation2 || modifiedUnit2;
    if (!mv1 || !mv2) return null;
    const res = computeVersus(
      mv1, mv2,
      Array.from(activeAbilities1), Array.from(activeAbilities2),
      stats1?.chargeBonus ?? 0, stats2?.chargeBonus ?? 0,
      false, 0,
      modifiedVariation1NoTimer || modifiedUnit1NoTimer,
      modifiedVariation2NoTimer || modifiedUnit2NoTimer,
      timedDuration1, timedDuration2,
    );
    return { dps1: res.attacker.dps ?? undefined, dps2: res.defender.dps ?? undefined };
  })() : null;

  // Build aligned bonus lists for each unit
  // 1. First the shared bonuses (same target)
  // 2. Then the unique bonuses for each side
  const bonuses1 = stats1?.bonusDamage || [];
  const bonuses2 = stats2?.bonusDamage || [];

  const matchedTargets = new Set<string>();
  const alignedBonuses1: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  const alignedBonuses2: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any

  // Phase 0: Add strike (holy wrath) and charge bonuses as separate rows
  const baseId1 = variation1?.baseId || unit1?.id;
  const baseId2 = variation2?.baseId || unit2?.id;

  // Sync count-driven counter abilities to the on-field unit count. Keyed on [count, unit] so a
  // manual stepper edit on the ability is never overwritten — it only re-fires when the count or
  // unit changes. Always writes the resolved target (clamped to ≥0 by setAbilityCounter): a count
  // drop back to 1 resets the counter (N−1 → 0 deactivates) instead of leaving the old value stale.
  useEffect(() => {
    const sync = COUNT_SYNCED_COUNTERS[baseId1];
    if (!sync) return;
    setAbilityCounter1(sync.abilityId, sync.useN ? count1 : count1 - 1);
  }, [count1, baseId1, setAbilityCounter1]);

  useEffect(() => {
    const sync = COUNT_SYNCED_COUNTERS[baseId2];
    if (!sync) return;
    setAbilityCounter2(sync.abilityId, sync.useN ? count2 : count2 - 1);
  }, [count2, baseId2, setAbilityCounter2]);

  const computeStrikeBonus = (baseId: string, abilityCounters: Map<string, number> | undefined, activeAbilities: Set<string>) => {
    if (activeAbilities.has('charge-attack')) {
      const stacks = abilityCounters?.get('ability-holy-wrath') ?? 0;
      const perStack = baseId === 'jeanne-darc-woman-at-arms' ? 20 : baseId === 'jeanne-darc-knight' ? 30 : baseId === 'jeanne-darc-blast-cannon' ? 50 : 0;
      if (stacks > 0 && perStack > 0) return stacks * perStack;
    }
    const arrowStacks = abilityCounters?.get('ability-divine-arrow') ?? 0;
    const arrowPerStack = baseId === 'jeanne-darc-hunter' ? 40 : baseId === 'jeanne-darc-mounted-archer' ? 100 : baseId === 'jeanne-darc-markswoman' ? 150 : 0;
    return arrowStacks * arrowPerStack;
  };

  const strikeBonus1 = data1 ? computeStrikeBonus(baseId1, abilityCounters1, activeAbilities1) : 0;
  const strikeBonus2 = data2 ? computeStrikeBonus(baseId2, abilityCounters2, activeAbilities2) : 0;
  const chargeOnly1 = Math.max(0, (stats1?.chargeBonus ?? 0) - strikeBonus1);
  const chargeOnly2 = Math.max(0, (stats2?.chargeBonus ?? 0) - strikeBonus2);

  const hasStrike1 = strikeBonus1 > 0;
  const hasChargeOnly1 = chargeOnly1 > 0;
  const hasStrike2 = strikeBonus2 > 0;
  const hasChargeOnly2 = chargeOnly2 > 0;

  let chargeLineIndex1 = -1;
  let chargeLineIndex2 = -1;

  const JD_RANGED_FORM_IDS = ['jeanne-darc-hunter', 'jeanne-darc-mounted-archer', 'jeanne-darc-markswoman'];
  const strikeLabel1 = JD_RANGED_FORM_IDS.includes(baseId1) ? 'Divine arrow' : 'Strike';
  const strikeLabel2 = JD_RANGED_FORM_IDS.includes(baseId2) ? 'Divine arrow' : 'Strike';

  // Strike row (holy wrath / divine arrow) — only pushed if at least one side has it
  if (hasStrike1 || hasStrike2) {
    alignedBonuses1.push(hasStrike1
      ? { isChargeBonus: true, value: strikeBonus1, chargeBonusLabel: strikeLabel1, chargeBonusBurst: 1 }
      : { hidden: true });
    alignedBonuses2.push(hasStrike2
      ? { isChargeBonus: true, value: strikeBonus2, chargeBonusLabel: strikeLabel2, chargeBonusBurst: 1 }
      : { hidden: true });
  }

  // Charge row — only pushed if at least one side has it
  if (hasChargeOnly1 || hasChargeOnly2) {
    const chargeLabel1 = baseId1 === 'earls-guard' ? 'Dagger' : baseId1 === 'donso' ? 'Javelin' : baseId1 === 'naginata-samurai' ? 'Bow' : ['musofadi-warrior', 'musofadi-gunner'].includes(baseId1) ? 'First Strike' : 'Charge';
    const chargeLabel2 = baseId2 === 'earls-guard' ? 'Dagger' : baseId2 === 'donso' ? 'Javelin' : baseId2 === 'naginata-samurai' ? 'Bow' : ['musofadi-warrior', 'musofadi-gunner'].includes(baseId2) ? 'First Strike' : 'Charge';

    alignedBonuses1.push(hasChargeOnly1
      ? { isChargeBonus: true, value: chargeOnly1, chargeBonusLabel: chargeLabel1, chargeBonusBurst: getChargeBonusBurst(data1, activeTechnologies1) }
      : { hidden: true });
    if (hasChargeOnly1) chargeLineIndex1 = alignedBonuses1.length - 1;

    alignedBonuses2.push(hasChargeOnly2
      ? { isChargeBonus: true, value: chargeOnly2, chargeBonusLabel: chargeLabel2, chargeBonusBurst: getChargeBonusBurst(data2, activeTechnologies2) }
      : { hidden: true });
    if (hasChargeOnly2) chargeLineIndex2 = alignedBonuses2.length - 1;
  }

  // Phase 1: Add the shared bonuses (aligned)
  bonuses1.forEach((bonus1: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const target1 = bonus1.target?.class?.flat().join(' ') || '';
    const bonus2 = bonuses2.find((b: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const target2 = b.target?.class?.flat().join(' ') || '';
      return target2 === target1;
    });

    if (bonus2) {
      matchedTargets.add(target1);
      alignedBonuses1.push(bonus1);
      alignedBonuses2.push(bonus2);
    }
  });

  // Phase 2: Add the unmatched bonuses
  const unmatched1 = bonuses1.filter((b: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const target = b.target?.class?.flat().join(' ') || '';
    return !matchedTargets.has(target);
  });

  const unmatched2 = bonuses2.filter((b: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const target = b.target?.class?.flat().join(' ') || '';
    return !matchedTargets.has(target);
  });

  // Phase 3: Fill the empty rows created by the charge bonus with the first unmatched bonuses
  let unmatchedIndex1 = 0;
  let unmatchedIndex2 = 0;

  if (chargeLineIndex1 === -1 && alignedBonuses1.length > 0 && alignedBonuses1[0]?.hidden && unmatched1.length > 0) {
    alignedBonuses1[0] = unmatched1[0];
    unmatchedIndex1 = 1;
  }

  if (chargeLineIndex2 === -1 && alignedBonuses2.length > 0 && alignedBonuses2[0]?.hidden && unmatched2.length > 0) {
    alignedBonuses2[0] = unmatched2[0];
    unmatchedIndex2 = 1;
  }

  // Phase 4: Add the remaining unmatched bonuses with empty rows to preserve alignment
  const remainingUnmatched1 = unmatched1.slice(unmatchedIndex1);
  const remainingUnmatched2 = unmatched2.slice(unmatchedIndex2);
  const maxUnmatched = Math.max(remainingUnmatched1.length, remainingUnmatched2.length);

  for (let i = 0; i < maxUnmatched; i++) {
    if (i < remainingUnmatched1.length) {
      alignedBonuses1.push(remainingUnmatched1[i]);
    } else {
      alignedBonuses1.push({ hidden: true });
    }

    if (i < remainingUnmatched2.length) {
      alignedBonuses2.push(remainingUnmatched2[i]);
    } else {
      alignedBonuses2.push({ hidden: true });
    }
  }

  const maxBonusDamageLines = alignedBonuses1.length;

  // If no units are loaded, display a message
  if (!aoe4Units || aoe4Units.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-4">Erreur de chargement</h2>
          <p className="text-muted-foreground">Les données des unités n'ont pas pu être chargées.</p>
          <p className="text-sm text-muted-foreground mt-2">Vérifiez la console pour plus de détails.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-auto p-2 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-w-0 sm:min-w-[1080px] max-w-6xl mx-auto relative"
      >
        <div className="relative text-center mb-8 space-y-4">
          <GuidedTour
            setSelectedCiv1={setSelectedCiv1} setUnit1={setUnit1}
            setSelectedAge1={setSelectedAge1} applyFullUpgrade1={applyFullUpgrade1} toggleAbility1={toggleAbility1}
            setSelectedCiv2={setSelectedCiv2} setUnit2={setUnit2}
            setSelectedAge2={setSelectedAge2} applyFullUpgrade2={applyFullUpgrade2} toggleAbility2={toggleAbility2}
            setIsVersus={setIsVersus} setCount1={setCount1} setCount2={setCount2} setAllowKiting={setAllowKiting}
            setMultiUnitModelKey={setMultiUnitModelKey}
          />
          <div>
            <h1 className="text-4xl font-serif font-bold text-primary mb-2">AoE4 Units</h1>
            <p className="text-muted-foreground text-lg">Compare any two units from any civilizations!</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span
                className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                title="Game balance patch currently modeled by the simulator"
              >
                Patch {PATCH_VERSION}
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="Simulation assumptions"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    i
                  </button>
                </PopoverTrigger>
                <PopoverContent align="center" className="w-80 text-left">
                  <p className="text-sm font-semibold text-foreground mb-2">Simulation assumptions</p>
                  <ul className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                    <li>
                      <span className="font-medium text-foreground">1v1 (standard):</span> deterministic.
                      No micro — both units attack from contact range until one dies.
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Allow Kiting:</span> the ranged unit
                      fires free shots while the melee unit closes the gap (approach phase), then the
                      contact phase is resolved. Less precise — multi-unit contact is stochastic
                      (Monte Carlo).
                    </li>
                    <li>
                      <span className="font-medium text-foreground">At Equal Cost:</span> costs are
                      normalized, then group sizes are rounded. Less precise due to rounding and
                      group-size approximations.
                    </li>
                  </ul>
                  <p className="mt-3 text-[11px] text-muted-foreground/80">
                    Stats modeled on patch {PATCH_VERSION}.
                  </p>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {/* Mode Toggle */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-4">
            <div id="tour-mode-toggle" className="flex sm:inline-flex w-full sm:w-auto rounded-md border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setIsVersus(false)}
                className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium transition-colors ${!isVersus ? 'bg-primary text-background' : 'bg-card text-muted-foreground hover:text-foreground'
                  }`}
              >
                Comparative
              </button>
              <div className="w-px bg-border" />
              <button
                type="button"
                onClick={() => setIsVersus(true)}
                className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium transition-colors ${isVersus ? 'bg-primary text-background' : 'bg-card text-muted-foreground hover:text-foreground'
                  }`}
              >
                Versus
              </button>
            </div>
            {isVersus && (
              <button
                type="button"
                onClick={() => setMobileOptionsOpen((o) => !o)}
                className="sm:hidden flex items-center justify-between gap-2 w-full px-4 py-2 rounded-md border border-border bg-card text-sm font-medium text-foreground"
              >
                <span>Options</span>
                <span className={`transition-transform ${mobileOptionsOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>
            )}
            {isVersus && (
              <div
                id="tour-versus-options"
                className={`${mobileOptionsOpen ? 'flex' : 'hidden'} sm:inline-flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto`}
              >
                {((isMultiUnit || allowKiting) && count1 > 1 && count2 > 1) && (
                  <div id="tour-model" className="inline-flex items-center rounded-md border border-border overflow-hidden bg-card w-full sm:w-auto">
                    <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-r border-border">
                      Model
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-500 border border-amber-500/40 rounded px-1 py-0.5">
                        approx.
                      </span>
                    </span>
                    {([
                      { key: 'aggregated', label: 'Aggregated DPS', title: 'All units deal and take damage simultaneously as one pool', devOnly: true },
                      { key: 'focusFire', label: 'Target Focus', title: 'Each side concentrates fire on one target at a time. Ranged vs Melee: auto-switches to Asymmetric (ranged concentrates on one melee target; melee distributes in batches round-robin).', devOnly: false },
                      { key: 'focusFireBatchesMC', label: 'Attack move', title: `Batches Monte Carlo: ${200} simulations with random batch assignment per iteration. Both-melee/both-ranged: random batch redistribution. Ranged vs Melee: auto-switches to Batches MC Asymmetric.`, devOnly: false },
                    ] as { key: 'aggregated' | 'focusFire' | 'focusFireBatchesMC'; label: string; title: string; devOnly: boolean }[])
                      .filter(opt => import.meta.env.DEV || !opt.devOnly)
                      .map((opt, i) => (
                        <React.Fragment key={opt.key}>
                          {i > 0 && <div className="w-px bg-border self-stretch" />}
                          <button
                            type="button"
                            title={opt.title}
                            onClick={() => setMultiUnitModelKey(opt.key)}
                            className={`px-3 py-2 text-sm font-medium transition-colors ${multiUnitModelKey === opt.key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground'}`}
                          >
                            {opt.label}
                          </button>
                        </React.Fragment>
                      ))}
                  </div>
                )}
                <div
                  id="tour-kiting"
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-card w-full sm:w-auto ${kitingDisabled ? "opacity-50" : ""}`}
                  title={kitingDisabled
                    ? "Kiting requires at least one ranged unit."
                    : "Ranged units fire free shots during the approach phase, then contact is resolved. Multi-unit contact is stochastic (Monte Carlo) — results are approximate."}
                >
                  <input
                    type="checkbox"
                    id="allowKiting"
                    checked={allowKiting}
                    disabled={kitingDisabled}
                    onChange={(e) => { setAllowKiting(e.target.checked); }}
                    className="w-4 h-4 rounded border-border disabled:cursor-not-allowed"
                  />
                  <label htmlFor="allowKiting" className={`text-sm font-medium ${kitingDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
                    Allow Kiting
                  </label>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-500 border border-amber-500/40 rounded px-1 py-0.5">
                    approx.
                  </span>
                </div>
                {allowKiting && (
                  <div className="inline-flex items-center rounded-md border border-border overflow-hidden bg-card w-full sm:w-auto">
                    <span className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-r border-border">
                      Distance
                    </span>
                    {([
                      { value: "max", label: "Max", desc: maxRangeDistance > 0 ? String(maxRangeDistance) : null },
                      { value: "custom", label: "Custom", desc: null },
                    ] as { value: string; label: string; desc: string | null }[]).map((opt, i) => (
                      <React.Fragment key={opt.value}>
                        {i > 0 && <div className="w-px bg-border self-stretch" />}
                        <button
                          type="button"
                          onClick={() => setStartDistancePreset(opt.value)}
                          className={`px-3 py-2 text-sm font-medium transition-colors ${startDistancePreset === opt.value
                            ? "bg-primary text-background"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                        >
                          {opt.label}
                          {opt.desc && (
                            <span className={`ml-1 text-xs ${startDistancePreset === opt.value ? "opacity-75" : "opacity-50"}`}>
                              ({opt.desc})
                            </span>
                          )}
                        </button>
                      </React.Fragment>
                    ))}
                    {startDistancePreset === "custom" && (
                      <>
                        <div className="w-px bg-border self-stretch" />
                        <input
                          type="number"
                          min={0}
                          max={30}
                          value={customDistance}
                          onChange={(e) => setCustomDistance(Number(e.target.value))}
                          className="w-14 text-sm bg-transparent px-2 py-2 outline-none text-center"
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Civ 1 Column */}
          <div className="space-y-4 flex flex-col items-end">
            <label className="text-sm font-medium text-foreground">Civ 1: <span className="text-xs text-muted-foreground font-normal">({filteredUnits1.length} units)</span></label>
            <div id="tour-civ1" className="w-full">
              <CivPicker value={selectedCiv1} onSelect={setSelectedCiv1} />
            </div>

            <div id="tour-unit1" className="w-full">
              <UnitPicker
                units={filteredUnits1}
                categorizedUnits={categorizedUnits1}
                openCategories={openCategories1}
                toggleCategory={toggleCategory1}
                selectedUnit={unit1}
                activeAbilities={activeAbilities1}
                onSelect={(value) => {
                  if (value === 'desert-raider_cavalry') {
                    setUnit1(filteredUnits1.find(u => u.id === 'desert-raider') || null, 'ability-desert-raider-blade');
                  } else {
                    setUnit1(filteredUnits1.find(u => u.id === value) || null);
                  }
                }}
              />
            </div>
            {isJeanneUnit(unit1) && (
              <JeanneFormSelector
                mode="panel"
                allForms={filteredUnits1}
                currentFormId={unit1?.id}
                onSelect={setUnit1}
              />
            )}
          </div>

          {/* Civ 2 Column */}
          <div className="space-y-4 flex flex-col items-start">
            <label className="text-sm font-medium text-foreground">Civ 2: <span className="text-xs text-muted-foreground font-normal">({filteredUnits2.length} units)</span></label>
            <div id="tour-civ2" className="w-full">
              <CivPicker value={selectedCiv2} onSelect={setSelectedCiv2} />
            </div>

            <div id="tour-unit2" className="w-full">
              <UnitPicker
                units={filteredUnits2}
                categorizedUnits={categorizedUnits2}
                openCategories={openCategories2}
                toggleCategory={toggleCategory2}
                selectedUnit={unit2}
                activeAbilities={activeAbilities2}
                onSelect={(value) => {
                  if (value === 'desert-raider_cavalry') {
                    setUnit2(filteredUnits2.find(u => u.id === 'desert-raider') || null, 'ability-desert-raider-blade');
                  } else {
                    setUnit2(filteredUnits2.find(u => u.id === value) || null);
                  }
                }}
              />
            </div>
            {isJeanneUnit(unit2) && (
              <JeanneFormSelector
                mode="panel"
                allForms={filteredUnits2}
                currentFormId={unit2?.id}
                onSelect={setUnit2}
              />
            )}
          </div>
        </div>

        {/* Comparison / versus area */}
        {!isVersus && (
          <div className="grid grid-cols-2 sm:grid-cols-[auto_1fr_1fr_auto] gap-x-2 gap-y-3 sm:gap-6 mt-8 items-start">
            {/* Civ 1 Unit */}
            {unit1 && (
              <>
                <div className="order-3 sm:order-1 sm:flex-shrink-0 min-w-0 overflow-x-auto sm:overflow-visible">
                  <div className="flex flex-col items-end gap-2 w-max ml-auto sm:w-auto sm:ml-0 sm:items-stretch sm:gap-3">
                    <div id="tour-age1">
                      <AgeSelector
                        availableAges={getAvailableAges(unit1.id, selectedCiv1)}
                        selectedAge={selectedAge1}
                        onAgeChange={setSelectedAge1}
                        orientation="left"
                      />
                    </div>
                    <div id="tour-techs1">
                      <TechnologySelector
                        technologies={techs1}
                        activeTechnologies={activeTechnologies1}
                        onToggle={toggleTechnology1}
                        unitMinAge={unitMinAge1}
                        fullUpgradeAge={fullUpgradeAge1}
                        onApplyFullUpgrade={applyFullUpgrade1}
                        onReset={resetTechnologies1}
                        orientation="left"
                        selectedCiv={selectedCiv1}
                        lockedTechnologies={lockedTechnologies1}
                        unitId={variation1?.baseId ?? unit1?.id}
                        selectedAge={selectedAge1}
                      />
                    </div>
                    <div id="tour-abilities1">
                      <AbilitySelector
                        abilities={abilities1}
                        activeAbilities={activeAbilities1}
                        onToggle={toggleAbility1}
                        orientation="left"
                        selectedCiv={selectedCiv1}
                        lockedAbilities={lockedAbilities1}
                        abilityCounters={abilityCounters1}
                        onIncrement={incrementAbility1}
                        onDecrement={decrementAbility1}
                        onSetCounter={setAbilityCounter1}
                        unitId={variation1?.baseId ?? unit1?.id}
                      />
                    </div>
                  </div>
                </div>
                <motion.div
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  className="order-1 sm:order-2 min-w-0 w-full"
                >
                  <UnitCard
                    className="w-full"
                    variation={modifiedVariation1!}
                    unit={modifiedUnit1 || unit1}
                    side="left"
                    isSelected={true}
                    compareHp={stats2?.hp}
                    compareAttack={stats2?.attack}
                    compareMeleeArmor={stats2?.meleeArmor}
                    compareRangedArmor={stats2?.rangedArmor}
                    compareSpeed={stats2?.speed}
                    compareAttackSpeed={stats2?.attackSpeed}
                    compareMaxRange={stats2?.maxRange}
                    dps={comparativeDps?.dps1}
                    compareDps={comparativeDps?.dps2}
                    bonusDamage={alignedBonuses1}
                    compareBonusDamage={alignedBonuses2}
                    maxBonusDamageLines={maxBonusDamageLines}
                    chargeBonus={stats1?.chargeBonus}
                    compareChargeBonus={stats2?.chargeBonus}
                    compareCost={stats2?.cost}
                    comparePopulation={stats2?.population}
                    compareProductionTime={stats2?.productionTime}
                    secondaryWeapons={modifiedVariation1?.secondaryWeapons ?? secondaryWeapons1}
                    showSecondaryWeaponRow={secondaryWeapons1.length > 0 || secondaryWeapons2.length > 0}
                    maxHpBonusFraction={modifiedStats1.maxHpBonusFraction ?? 0}
                    opponentArmorPenetration={modifiedStats2.armorPenetration ?? 0}
                    opponentAttackSpeedDebuff={modifiedStats2.opponentAttackSpeedDebuff ?? 0}
                    opponentVersusDebuff={(modifiedStats2.versusOpponentDamageDebuff ?? 1) * getVersusDebuffMultiplier(variation1?.classes || unit1?.classes || [], [...activeAbilities2], [...activeTechnologies2], variation2?.baseId || unit2?.id)}
                    opponentBonusDamageReduction={modifiedStats2.bonusDamageReduction ?? 0}
                    opponentClasses={variation2?.classes || unit2?.classes || []}
                  />
                </motion.div>
              </>
            )}
            {/* Civ 2 Unit */}
            {unit2 && (
              <>
                <motion.div
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  className="order-2 sm:order-3 min-w-0 w-full"
                >
                  <UnitCard
                    className="w-full"
                    variation={modifiedVariation2!}
                    unit={modifiedUnit2 || unit2}
                    side="right"
                    isSelected={true}
                    compareHp={stats1?.hp}
                    compareAttack={stats1?.attack}
                    compareMeleeArmor={stats1?.meleeArmor}
                    compareRangedArmor={stats1?.rangedArmor}
                    compareSpeed={stats1?.speed}
                    compareAttackSpeed={stats1?.attackSpeed}
                    compareMaxRange={stats1?.maxRange}
                    dps={comparativeDps?.dps2}
                    compareDps={comparativeDps?.dps1}
                    bonusDamage={alignedBonuses2}
                    compareBonusDamage={alignedBonuses1}
                    maxBonusDamageLines={maxBonusDamageLines}
                    chargeBonus={stats2?.chargeBonus}
                    compareChargeBonus={stats1?.chargeBonus}
                    compareCost={stats1?.cost}
                    comparePopulation={stats1?.population}
                    compareProductionTime={stats1?.productionTime}
                    secondaryWeapons={modifiedVariation2?.secondaryWeapons ?? secondaryWeapons2}
                    showSecondaryWeaponRow={secondaryWeapons1.length > 0 || secondaryWeapons2.length > 0}
                    maxHpBonusFraction={modifiedStats2.maxHpBonusFraction ?? 0}
                    opponentArmorPenetration={modifiedStats1.armorPenetration ?? 0}
                    opponentAttackSpeedDebuff={modifiedStats1.opponentAttackSpeedDebuff ?? 0}
                    opponentVersusDebuff={(modifiedStats1.versusOpponentDamageDebuff ?? 1) * getVersusDebuffMultiplier(variation2?.classes || unit2?.classes || [], [...activeAbilities1], [...activeTechnologies1], variation1?.baseId || unit1?.id)}
                    opponentBonusDamageReduction={modifiedStats1.bonusDamageReduction ?? 0}
                    opponentClasses={variation1?.classes || unit1?.classes || []}
                  />
                </motion.div>
                <div className="order-4 sm:order-4 flex flex-col items-start sm:items-stretch gap-2 sm:gap-3 sm:flex-shrink-0 min-w-0 overflow-x-auto sm:overflow-visible">
                  <div id="tour-age2">
                    <AgeSelector
                      availableAges={getAvailableAges(unit2.id, selectedCiv2)}
                      selectedAge={selectedAge2}
                      onAgeChange={setSelectedAge2}
                      orientation="right"
                    />
                  </div>
                  <div id="tour-techs2">
                    <TechnologySelector
                      technologies={techs2}
                      activeTechnologies={activeTechnologies2}
                      orientation="right"
                      onToggle={toggleTechnology2}
                      selectedCiv={selectedCiv2}
                      lockedTechnologies={lockedTechnologies2}
                      unitId={variation2?.baseId ?? unit2?.id}
                      selectedAge={selectedAge2}
                      unitMinAge={unitMinAge2}
                      fullUpgradeAge={fullUpgradeAge2}
                      onApplyFullUpgrade={applyFullUpgrade2}
                      onReset={resetTechnologies2}
                    />
                  </div>
                  <div id="tour-abilities2">
                    <AbilitySelector
                      abilities={abilities2}
                      activeAbilities={activeAbilities2}
                      onToggle={toggleAbility2}
                      orientation="right"
                      selectedCiv={selectedCiv2}
                      lockedAbilities={lockedAbilities2}
                      abilityCounters={abilityCounters2}
                      onIncrement={incrementAbility2}
                      onDecrement={decrementAbility2}
                      onSetCounter={setAbilityCounter2}
                      unitId={variation2?.baseId ?? unit2?.id}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        {isVersus && unit1 && unit2 && (() => {
          const effectiveCost1 = modifiedVariation1 ? getTotalCost(modifiedVariation1) : (stats1?.cost ?? 0);
          const effectiveCost2 = modifiedVariation2 ? getTotalCost(modifiedVariation2) : (stats2?.cost ?? 0);
          const pop1 = stats1?.population ?? 0;
          const pop2 = stats2?.population ?? 0;
          const costDisabled = effectiveCost1 <= 0 || effectiveCost2 <= 0;
          const popDisabled = pop1 <= 0 || pop2 <= 0;
          // Manual stepper edits drop any active preset selection.
          const setManual1 = (n: number) => { setCount1(n); setActivePreset(null); };
          const setManual2 = (n: number) => { setCount2(n); setActivePreset(null); };
          // Toggle a preset: select it (apply its ratio) or, if already selected, revert to 1v1.
          const togglePreset = (key: 'cost' | 'pop', costA: number, costB: number) => {
            if (activePreset === key) { setCount1(1); setCount2(1); setActivePreset(null); return; }
            const m = calculateEqualCostMultipliers(costA, costB);
            setCount1(m.multA); setCount2(m.multB); setActivePreset(key);
          };
          return (
            <div id="tour-unit-counts" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3 mt-8">
              <div className="hidden sm:block"><CountStepper count={count1} onChange={setManual1} /></div>
              <div className="flex items-center gap-2">
                <PresetButton
                  id="tour-atEqualCost"
                  label="⚖ Equal Cost"
                  disabled={costDisabled}
                  active={activePreset === 'cost'}
                  title={costDisabled ? 'A unit has no cost' : activePreset === 'cost' ? 'Equal-cost ratio applied — click to reset to 1v1.' : 'Fills both unit counts to an equal-cost ratio. You can fine-tune the counts afterwards.'}
                  onClick={() => togglePreset('cost', effectiveCost1, effectiveCost2)}
                />
                <PresetButton
                  label="👥 Equal Pop"
                  disabled={popDisabled}
                  active={activePreset === 'pop'}
                  title={popDisabled ? 'A unit has no population value' : activePreset === 'pop' ? 'Equal-population ratio applied — click to reset to 1v1.' : 'Fills both unit counts so each side uses the same total population (e.g. a 2-pop unit gets half the count of a 1-pop unit).'}
                  onClick={() => togglePreset('pop', pop1, pop2)}
                />
              </div>
              <div className="hidden sm:block"><CountStepper count={count2} onChange={setManual2} labelSide="right" /></div>
            </div>
          );
        })()}
        {isVersus && (
          <div className="grid grid-cols-2 sm:grid-cols-[auto_1fr_1fr_auto] gap-x-2 gap-y-3 sm:gap-6 mt-4 items-start">
            {(() => {
              if (!unit1 || !unit2) return null;

              let versusData;
              let multipliers = undefined;

              // Convert Sets to arrays to pass to combat functions
              const abilitiesArray1 = Array.from(activeAbilities1);
              const abilitiesArray2 = Array.from(activeAbilities2);

              // Compute charge bonuses
              const charge1 = getChargeBonus(data1, activeAbilities1, selectedAge1, activeTechnologies1, modifiedStats1.chargeMultiplier, modifiedStats1.meleeAttack, abilityCounters1, modifiedStats1.rangedAttack, modifiedStats1.chargeChange);
              const charge2 = getChargeBonus(data2, activeAbilities2, selectedAge2, activeTechnologies2, modifiedStats2.chargeMultiplier, modifiedStats2.meleeAttack, abilityCounters2, modifiedStats2.rangedAttack, modifiedStats2.chargeChange);

              const noTimerData1 = modifiedVariation1NoTimer || modifiedUnit1NoTimer;
              const noTimerData2 = modifiedVariation2NoTimer || modifiedUnit2NoTimer;

              // Single source of truth for a matchup at arbitrary unit counts. Both the displayed
              // result and the "units to win" search go through this, so the two can never disagree
              // (approach phase, kiting and model selection are all reproduced identically).
              const computeMatchup = (
                n1: number,
                n2: number,
              ): VersusResult & { multipliers?: { multA: number; multB: number; totalCostA: number; totalCostB: number } } => {
                const mv1 = modifiedVariation1 || modifiedUnit1!;
                const mv2 = modifiedVariation2 || modifiedUnit2!;
                if (n1 > 1 || n2 > 1) {
                  const customMults = { multA: n1, multB: n2 };
                  if (allowKiting && multiUnitModelKey === 'focusFire') {
                    return computeVersusAtEqualCostKitingFocusFire(
                      mv1, mv2, abilitiesArray1, abilitiesArray2, charge1, charge2, startDistance, customMults,
                    );
                  }
                  if (allowKiting && multiUnitModelKey === 'focusFireBatchesMC') {
                    return computeVersusAtEqualCostKitingBatchesMC(
                      mv1, mv2, abilitiesArray1, abilitiesArray2, charge1, charge2, startDistance, customMults,
                    );
                  }
                  const isRanged1 = getPrimaryWeapon(mv1)?.type === 'ranged';
                  const isRanged2 = getPrimaryWeapon(mv2)?.type === 'ranged';
                  const multiUnitModel: MultiUnitModel =
                    multiUnitModelKey === 'focusFire' ? (isRanged1 !== isRanged2 ? focusFireAsymmetricModel : focusFireModel) :
                      multiUnitModelKey === 'focusFireBatchesMC' ? (isRanged1 !== isRanged2 ? focusFireBatchesMCAsymmetricModel : focusFireBatchesMCModel) :
                        aggregatedDPSModel;
                  return computeVersusAtEqualCost(
                    mv1, mv2, abilitiesArray1, abilitiesArray2, charge1, charge2,
                    allowKiting, startDistance, multiUnitModel, customMults,
                  );
                }
                if (allowKiting && multiUnitModelKey === 'focusFire') {
                  return computeVersusKitingFocusFire(
                    mv1, mv2, abilitiesArray1, abilitiesArray2, charge1, charge2, startDistance,
                  );
                }
                if (allowKiting && multiUnitModelKey === 'focusFireBatchesMC') {
                  return computeVersusKitingBatchesMC(
                    mv1, mv2, abilitiesArray1, abilitiesArray2, charge1, charge2, startDistance,
                  );
                }
                return computeVersus(
                  mv1, mv2, abilitiesArray1, abilitiesArray2, charge1, charge2,
                  allowKiting, startDistance, noTimerData1, noTimerData2, timedDuration1, timedDuration2,
                );
              };

              const mainResult = computeMatchup(count1, count2);
              versusData = mainResult;
              multipliers = mainResult.multipliers;

              // Win/loss logic based on weapon ownership
              // A unit without a weapon always loses against a unit with a weapon
              // A draw only occurs when neither unit has a weapon
              const hasWeapon1 = !!getPrimaryWeapon(modifiedVariation1 || modifiedUnit1);
              const hasWeapon2 = !!getPrimaryWeapon(modifiedVariation2 || modifiedUnit2);

              let isDraw = versusData.winner === 'draw';
              let leftIsWinner = false;
              let rightIsWinner = false;

              if (hasWeapon1 && !hasWeapon2) {
                // Civ 1 has a weapon, Civ 2 does not -> Civ 1 wins
                leftIsWinner = true;
                isDraw = false;
              } else if (!hasWeapon1 && hasWeapon2) {
                // Civ 1 has no weapon, Civ 2 does -> Civ 2 wins
                rightIsWinner = true;
                isDraw = false;
              } else if (hasWeapon1 && hasWeapon2) {
                // Both have a weapon -> use normal versus logic
                isDraw = versusData.winner === 'draw';
                leftIsWinner = !isDraw && versusData.winner === 'attacker';
                rightIsWinner = !isDraw && versusData.winner === 'defender';
              } else {
                // Neither has a weapon -> Draw
                isDraw = true;
                leftIsWinner = false;
                rightIsWinner = false;
              }
              let loserUnitsToWin: number | undefined;
              let loserUnitsToWinExceeded = false;
              // Always show "units to win" (1v1, 1vN, Nv1, and NvM). We search the smallest loser
              // count that flips the outcome, re-running the SAME computeMatchup as the display (so
              // approach/kiting/model all stay consistent — no drift vs. manually setting the count).
              // For Monte Carlo ("Attack move") the loser is counted as winning once its win rate
              // exceeds 50%; the deterministic models require an outright win. If the loser can't win
              // within the cap, we flag it as "More than 100" rather than showing a misleading count.
              if (versusData.winner !== 'draw') {
                const loserIsLeft = versusData.winner === 'defender';
                const winnerCount = loserIsLeft ? count2 : count1;
                const loserCount = loserIsLeft ? count1 : count2;
                const useWinRate = multiUnitModelKey === 'focusFireBatchesMC';
                const maxUnitsToWin = 100;
                for (let n = loserCount + 1; n <= maxUnitsToWin; n++) {
                  const r = loserIsLeft ? computeMatchup(n, winnerCount) : computeMatchup(winnerCount, n);
                  const loserWon = useWinRate && r.mcDistribution
                    ? (loserIsLeft ? r.mcDistribution.winRateA : r.mcDistribution.winRateB) > 0.5
                    : r.winner === (loserIsLeft ? 'attacker' : 'defender');
                  if (loserWon) { loserUnitsToWin = n; break; }
                }
                if (loserUnitsToWin === undefined) loserUnitsToWinExceeded = true;
              }

              // Units to one-shot (OS) a single opponent unit = ⌈opponent HP / per-unit first-hit
              // damage⌉ (first hit includes charge bonus; falls back to steady damage per hit).
              const osDmgLeft = versusData.attacker.firstHitDamage ?? versusData.attacker.effectiveDamagePerHit;
              const osHpLeft = (modifiedVariation2 || modifiedUnit2)?.hitpoints ?? unit2?.hitpoints;
              const unitsToOSLeft = osDmgLeft && osDmgLeft > 0 && osHpLeft ? Math.ceil(osHpLeft / osDmgLeft) : undefined;
              const osDmgRight = versusData.defender.firstHitDamage ?? versusData.defender.effectiveDamagePerHit;
              const osHpRight = (modifiedVariation1 || modifiedUnit1)?.hitpoints ?? unit1?.hitpoints;
              const unitsToOSRight = osDmgRight && osDmgRight > 0 && osHpRight ? Math.ceil(osHpRight / osDmgRight) : undefined;

              const leftMetrics = {
                dps: versusData.attacker.dps,
                dpsPerCost: versusData.attacker.dpsPerCost,
                hitsToKill: versusData.attacker.hitsToKill,
                secondaryHitsToKill: versusData.attacker.secondaryHitsToKill,
                killByWeapon: versusData.attacker.killByWeapon,
                secondaryDamage: versusData.attacker.secondaryDamage,
                approachDamage: versusData.attacker.approachDamage,
                killTimeline: versusData.attacker.killTimeline,
                approachTimeline: versusData.attacker.approachTimeline,
                approachShots: versusData.attacker.approachShots,
                timeToKill: versusData.attacker.timeToKill,
                effectiveDamagePerHit: versusData.attacker.effectiveDamagePerHit,
                bugAttackSpeed: versusData.attacker.bugAttackSpeed,
                formula: versusData.attacker.formula,
                opponentFormula: versusData.defender.formula,
                isWinner: leftIsWinner,
                isLoser: !leftIsWinner && !isDraw,
                isDraw,
                opponentClasses: (modifiedVariation2 || modifiedUnit2)?.classes ?? unit2?.classes ?? [],
                opponentDps: versusData.defender.dps,
                opponentDpsPerCost: versusData.defender.dpsPerCost,
                opponentHitsToKill: (versusData.defender.hitsToKill ?? 0) + (versusData.defender.approachShots ?? 0) || null,
                opponentTimeToKill: versusData.defender.timeToKill,
                multiplier: multipliers?.multA,
                totalCost: multipliers?.totalCostA,
                opponentMultiplier: multipliers?.multB,
                opponentTotalCost: multipliers?.totalCostB,
                opponentHp: (modifiedVariation2 || modifiedUnit2)?.hitpoints ?? unit2?.hitpoints,
                winnerHpRemaining: versusData.mcDistribution?.whenAWins?.hpMedian ?? (leftIsWinner ? versusData.winnerHpRemaining : undefined),
                winnerHpStd: versusData.mcDistribution?.whenAWins?.hpStd,
                winnerUnitsRemaining: versusData.mcDistribution?.whenAWins?.unitsMedian ?? (leftIsWinner ? versusData.winnerUnitsRemaining : undefined),
                winnerUnitsStd: versusData.mcDistribution?.whenAWins?.unitsStd,
                resourceDifference: versusData.mcDistribution?.whenAWins?.resourceMedian ?? (leftIsWinner ? versusData.resourceDifference : undefined),
                resourceStd: versusData.mcDistribution?.whenAWins?.resourceStd,
                winRate: versusData.mcDistribution?.winRateA,
                unitsToOS: unitsToOSLeft,
                loserUnitsToWin: (!leftIsWinner && !isDraw) ? loserUnitsToWin : undefined,
                loserUnitsToWinExceeded: (!leftIsWinner && !isDraw) ? loserUnitsToWinExceeded : undefined,
                loserUnitsToWinApprox: (!leftIsWinner && !isDraw) ? (count1 > 1 && count2 > 1) : undefined,
                opponentName: versusData.defender.name,
              };
              const rightMetrics = {
                dps: versusData.defender.dps,
                dpsPerCost: versusData.defender.dpsPerCost,
                hitsToKill: versusData.defender.hitsToKill,
                secondaryHitsToKill: versusData.defender.secondaryHitsToKill,
                killByWeapon: versusData.defender.killByWeapon,
                secondaryDamage: versusData.defender.secondaryDamage,
                approachDamage: versusData.defender.approachDamage,
                killTimeline: versusData.defender.killTimeline,
                approachTimeline: versusData.defender.approachTimeline,
                approachShots: versusData.defender.approachShots,
                timeToKill: versusData.defender.timeToKill,
                effectiveDamagePerHit: versusData.defender.effectiveDamagePerHit,
                bugAttackSpeed: versusData.defender.bugAttackSpeed,
                formula: versusData.defender.formula,
                opponentFormula: versusData.attacker.formula,
                isWinner: rightIsWinner,
                isLoser: !rightIsWinner && !isDraw,
                isDraw,
                opponentClasses: (modifiedVariation1 || modifiedUnit1)?.classes ?? unit1?.classes ?? [],
                opponentDps: versusData.attacker.dps,
                opponentDpsPerCost: versusData.attacker.dpsPerCost,
                opponentHitsToKill: (versusData.attacker.hitsToKill ?? 0) + (versusData.attacker.approachShots ?? 0) || null,
                opponentTimeToKill: versusData.attacker.timeToKill,
                multiplier: multipliers?.multB,
                totalCost: multipliers?.totalCostB,
                opponentMultiplier: multipliers?.multA,
                opponentTotalCost: multipliers?.totalCostA,
                opponentHp: (modifiedVariation1 || modifiedUnit1)?.hitpoints ?? unit1?.hitpoints,
                winnerHpRemaining: versusData.mcDistribution?.whenBWins?.hpMedian ?? (rightIsWinner ? versusData.winnerHpRemaining : undefined),
                winnerHpStd: versusData.mcDistribution?.whenBWins?.hpStd,
                winnerUnitsRemaining: versusData.mcDistribution?.whenBWins?.unitsMedian ?? (rightIsWinner ? versusData.winnerUnitsRemaining : undefined),
                winnerUnitsStd: versusData.mcDistribution?.whenBWins?.unitsStd,
                resourceDifference: versusData.mcDistribution?.whenBWins?.resourceMedian ?? (rightIsWinner ? versusData.resourceDifference : undefined),
                resourceStd: versusData.mcDistribution?.whenBWins?.resourceStd,
                winRate: versusData.mcDistribution?.winRateB,
                unitsToOS: unitsToOSRight,
                loserUnitsToWin: (!rightIsWinner && !isDraw) ? loserUnitsToWin : undefined,
                loserUnitsToWinExceeded: (!rightIsWinner && !isDraw) ? loserUnitsToWinExceeded : undefined,
                loserUnitsToWinApprox: (!rightIsWinner && !isDraw) ? (count1 > 1 && count2 > 1) : undefined,
                opponentName: versusData.attacker.name,
              };
              return (
                <>
                  {/* Mobile-only: per-card unit count steppers above each card (desktop uses the centered strip) */}
                  <div className="order-first sm:hidden flex justify-center">
                    <CountStepper count={count1} onChange={(n) => { setCount1(n); setActivePreset(null); }} />
                  </div>
                  <div className="order-first sm:hidden flex justify-center">
                    <CountStepper count={count2} onChange={(n) => { setCount2(n); setActivePreset(null); }} labelSide="right" />
                  </div>
                  <div className="order-3 sm:order-1 sm:flex-shrink-0 min-w-0 overflow-x-auto sm:overflow-visible">
                    <div className="flex flex-col items-end gap-2 w-max ml-auto sm:w-auto sm:ml-0 sm:items-stretch sm:gap-3">
                      <div id="tour-age1">
                        <AgeSelector
                          availableAges={getAvailableAges(unit1.id, selectedCiv1)}
                          selectedAge={selectedAge1}
                          onAgeChange={setSelectedAge1}
                          orientation="left"
                        />
                      </div>
                      <div id="tour-techs1">
                        <TechnologySelector
                          technologies={techs1}
                          activeTechnologies={activeTechnologies1}
                          onToggle={toggleTechnology1}
                          orientation="left"
                          selectedCiv={selectedCiv1}
                          lockedTechnologies={lockedTechnologies1}
                          unitId={variation1?.baseId ?? unit1?.id}
                          selectedAge={selectedAge1}
                          unitMinAge={unitMinAge1}
                          fullUpgradeAge={fullUpgradeAge1}
                          onApplyFullUpgrade={applyFullUpgrade1}
                          onReset={resetTechnologies1}
                        />
                      </div>
                      <div id="tour-abilities1">
                        <AbilitySelector
                          abilities={abilities1}
                          activeAbilities={activeAbilities1}
                          onToggle={toggleAbility1}
                          orientation="left"
                          selectedCiv={selectedCiv1}
                          lockedAbilities={lockedAbilities1}
                          abilityCounters={abilityCounters1}
                          onIncrement={incrementAbility1}
                          onDecrement={decrementAbility1}
                          onSetCounter={setAbilityCounter1}
                          unitId={variation1?.baseId ?? unit1?.id}
                        />
                      </div>
                    </div>
                  </div>
                  <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="order-1 sm:order-2 min-w-0 w-full"
                  >
                    <UnitCard
                      className="w-full"
                      variation={modifiedVariation1!}
                      unit={modifiedUnit1 || unit1}
                      side="left"
                      mode="versus"
                      versusMetrics={leftMetrics}
                      secondaryWeapons={modifiedVariation1?.secondaryWeapons ?? secondaryWeapons1}
                      maxHpBonusFraction={modifiedStats1.maxHpBonusFraction ?? 0}
                      opponentArmorPenetration={modifiedStats2.armorPenetration ?? 0}
                      opponentAttackSpeedDebuff={modifiedStats2.opponentAttackSpeedDebuff ?? 0}
                      opponentVersusDebuff={(modifiedStats2.versusOpponentDamageDebuff ?? 1) * getVersusDebuffMultiplier(unit1?.classes || [], [...activeAbilities2], [...activeTechnologies2], unit2?.id)}
                      opponentBonusDamageReduction={modifiedStats2.bonusDamageReduction ?? 0}
                      opponentClasses={modifiedVariation2?.classes || unit2?.classes || []}
                    />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="order-2 sm:order-3 min-w-0 w-full"
                  >
                    <UnitCard
                      className="w-full"
                      variation={modifiedVariation2!}
                      unit={modifiedUnit2 || unit2}
                      side="right"
                      mode="versus"
                      versusMetrics={rightMetrics}
                      secondaryWeapons={modifiedVariation2?.secondaryWeapons ?? secondaryWeapons2}
                      maxHpBonusFraction={modifiedStats2.maxHpBonusFraction ?? 0}
                      opponentArmorPenetration={modifiedStats1.armorPenetration ?? 0}
                      opponentAttackSpeedDebuff={modifiedStats1.opponentAttackSpeedDebuff ?? 0}
                      opponentVersusDebuff={(modifiedStats1.versusOpponentDamageDebuff ?? 1) * getVersusDebuffMultiplier(unit2?.classes || [], [...activeAbilities1], [...activeTechnologies1], unit1?.id)}
                      opponentBonusDamageReduction={modifiedStats1.bonusDamageReduction ?? 0}
                      opponentClasses={modifiedVariation1?.classes || unit1?.classes || []}
                    />
                  </motion.div>
                  <div className="order-4 sm:order-4 flex flex-col items-start sm:items-stretch gap-2 sm:gap-3 sm:flex-shrink-0 min-w-0 overflow-x-auto sm:overflow-visible">
                    <div id="tour-age2">
                      <AgeSelector
                        availableAges={getAvailableAges(unit2.id, selectedCiv2)}
                        selectedAge={selectedAge2}
                        onAgeChange={setSelectedAge2}
                        orientation="right"
                      />
                    </div>
                    <div id="tour-techs2">
                      <TechnologySelector
                        technologies={techs2}
                        activeTechnologies={activeTechnologies2}
                        onToggle={toggleTechnology2}
                        orientation="right"
                        selectedCiv={selectedCiv2}
                        lockedTechnologies={lockedTechnologies2}
                        unitId={variation2?.baseId ?? unit2?.id}
                        selectedAge={selectedAge2}
                        unitMinAge={unitMinAge2}
                        fullUpgradeAge={fullUpgradeAge2}
                        onApplyFullUpgrade={applyFullUpgrade2}
                        onReset={resetTechnologies2}
                      />
                    </div>
                    <div id="tour-abilities2">
                      <AbilitySelector
                        abilities={abilities2}
                        activeAbilities={activeAbilities2}
                        onToggle={toggleAbility2}
                        orientation="right"
                        selectedCiv={selectedCiv2}
                        lockedAbilities={lockedAbilities2}
                        abilityCounters={abilityCounters2}
                        onIncrement={incrementAbility2}
                        onDecrement={decrementAbility2}
                        onSetCounter={setAbilityCounter2}
                        unitId={variation2?.baseId ?? unit2?.id}
                      />
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {(unit1 || unit2) && (
          <div className="flex justify-center mt-8">
            <button
              type="button"
              onClick={handleShare}
              title="Copy a link that reopens this exact setup (units, techs, abilities and options)"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-border bg-card text-sm font-medium text-foreground transition-colors hover:bg-muted w-full sm:w-auto"
            >
              {shareCopied ? <Check className="w-4 h-4 text-primary" /> : <Share2 className="w-4 h-4" />}
              {shareCopied ? "Copied!" : "Share the matchup"}
            </button>
          </div>
        )}

        <footer className="mt-12 mb-4 flex flex-col items-center gap-2 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <a
              href="https://discord.gg/VpCwYfRSXp"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/40"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.444.864-.608 1.249a18.27 18.27 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.249.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127c-.598.349-1.22.645-1.873.893a.077.077 0 0 0-.041.105c.36.699.772 1.364 1.225 1.994a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.056c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.029ZM8.02 15.331c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z" />
              </svg>
              Join the Discord
            </a>
            <a
              href="https://github.com/f2ire/aoe4units/issues/new"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/40"
            >
              <Github className="h-4 w-4" />
              Bug report
            </a>
            <a
              href="https://ko-fi.com/aoe4units"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/40"
            >
              <Coffee className="h-4 w-4" />
              Support the project
            </a>
          </div>
          <span className="text-xs text-muted-foreground">
            Found a bug or a wrong stat? Report it on Discord. Code issues can go to GitHub. Enjoying the tool? Support it on Ko-fi.
          </span>
        </footer>

      </motion.div>
    </div>
  );
};

export default Sandbox;
