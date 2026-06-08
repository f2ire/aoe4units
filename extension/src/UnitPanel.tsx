/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { ChevronDown, ChevronUp, Search, Settings2 } from "lucide-react";
import { getAvailableAges } from "@/data/unified-units";
import type { AoE4Unit } from "@/data/unified-units";
import { useUnitSlot } from "@/hooks/useUnitSlot";
import { buildModifiedVariation } from "@/lib/buildVariation";
import { cn } from "@/lib/utils";
import { CompactUnitCard } from "./CompactUnitCard";
import { CompactLoadout } from "./CompactLoadout";

type Slot = ReturnType<typeof useUnitSlot>;

// Category labels for the unit picker (mirrors categorizeUnit()'s output).
const CATEGORY_LABELS: Record<string, string> = {
  jeanne: "Jeanne d'Arc",
  melee_infantry: "Melee Infantry",
  ranged: "Ranged",
  cavalry: "Cavalry",
  siege: "Siege",
  monk: "Monks",
  ship: "Ships",
  mercenary: "Mercenaries",
  khaganate: "Khaganate",
  other: "Other",
};
const CATEGORY_ORDER = [
  "jeanne", "melee_infantry", "ranged", "cavalry", "siege",
  "mercenary", "khaganate", "monk", "ship", "other",
];

// One unified, semi-transparent overlay panel: the compact stat card (click the
// unit name to change unit) + a collapsible technologies/abilities loadout, all
// in a single box so the stream stays visible behind it. Civ selection lives in
// the Overlay's left rail; `slot` is owned there and passed in.
export default function UnitPanel({ slot }: { slot: Slot }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");

  const source = slot.variation ?? slot.unit;
  const isVariation = !!slot.variation;
  const modified = source
    ? buildModifiedVariation(source, slot.modifiedStats, {
      baseId: isVariation ? (source as any).baseId : (source as any).id,
      activeTechnologies: slot.activeTechnologies,
      activeAbilities: slot.activeAbilities,
      abilityCounters: slot.abilityCounters,
      selectedAge: slot.selectedAge,
      secondaryWeapons: slot.secondaryWeapons,
      applyCostMultiplier: true,
    })
    : null;

  const pickUnit = (id: string) => {
    if (id === "desert-raider_cavalry") {
      slot.setUnit(slot.filteredUnits.find((u) => u.id === "desert-raider") || null, "ability-desert-raider-blade");
    } else {
      slot.setUnit(slot.filteredUnits.find((u) => u.id === id) || null);
    }
    setPickerOpen(false);
    setSearch("");
  };

  const q = search.trim().toLowerCase();

  return (
    <div className="relative w-[300px]">
      <div className="overflow-hidden rounded-lg border border-amber-500/30 bg-zinc-950/65 text-zinc-100 shadow-2xl ring-1 ring-black/30 backdrop-blur-md">
        {slot.unit && modified ? (
          <>
            <CompactUnitCard
              modified={modified}
              base={source}
              name={slot.unit.name}
              icon={(modified as any).icon ?? (slot.unit as any).icon}
              civs={(modified as any).civs ?? slot.unit.civs ?? []}
              availableAges={getAvailableAges(slot.unit.id, slot.selectedCiv)}
              selectedAge={slot.selectedAge}
              onAgeChange={slot.setSelectedAge}
              onNameClick={() => setPickerOpen((v) => !v)}
              pickerOpen={pickerOpen}
              bonusDamage={slot.modifiedStats.bonusDamage}
              secondaryWeapons={modified.secondaryWeapons ?? slot.secondaryWeapons}
              maxHpBonusFraction={slot.modifiedStats.maxHpBonusFraction ?? 0}
            />

            {/* Technologies & abilities — merged into the same panel */}
            <button
              type="button"
              aria-pressed={drawerOpen}
              onClick={() => setDrawerOpen((v) => !v)}
              className={cn(
                "flex w-full items-center justify-between border-t border-amber-500/20 px-3 py-2 text-sm font-semibold transition-colors",
                drawerOpen ? "bg-amber-500/10 text-amber-300" : "text-amber-200 hover:bg-white/5",
              )}
            >
              <span className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-amber-400/80" />
                Technologies &amp; abilities
              </span>
              {drawerOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {drawerOpen && (
              <div className="max-h-[55vh] overflow-y-auto border-t border-amber-500/10 bg-black/20 p-3">
                <CompactLoadout
                  technologies={slot.techs}
                  activeTechnologies={slot.activeTechnologies}
                  onToggleTech={slot.toggleTechnology}
                  lockedTechnologies={slot.lockedTechnologies}
                  selectedCiv={slot.selectedCiv}
                  unitMinAge={slot.unitMinAge}
                  fullUpgradeAge={slot.fullUpgradeAge}
                  onApplyFullUpgrade={slot.applyFullUpgrade}
                  onReset={slot.resetTechnologies}
                  abilities={slot.abilities}
                  activeAbilities={slot.activeAbilities}
                  onToggleAbility={slot.toggleAbility}
                  lockedAbilities={slot.lockedAbilities}
                  abilityCounters={slot.abilityCounters}
                  onIncrement={slot.incrementAbility}
                  onDecrement={slot.decrementAbility}
                />
              </div>
            )}
          </>
        ) : (
          <div className="p-4">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex w-full items-center justify-between rounded-md border border-amber-500/30 bg-black/30 px-3 py-2 text-sm text-amber-200 hover:border-amber-500/60"
            >
              Select a unit
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Unit picker — anchored under the header, opened by clicking the name */}
      {pickerOpen && (
        <div className="absolute inset-x-2 top-14 z-50 flex max-h-[60vh] flex-col overflow-hidden rounded-md border border-amber-500/40 bg-zinc-950/95 shadow-2xl backdrop-blur">
          <div className="flex items-center gap-2 border-b border-amber-500/15 px-2 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search unit…"
              className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
            />
          </div>
          <div className="overflow-y-auto p-1">
            {CATEGORY_ORDER.map((cat) => {
              const units = (slot.categorizedUnits[cat] || [])
                .filter((u: AoE4Unit) => !q || u.name.toLowerCase().includes(q))
                .slice()
                .sort((a: AoE4Unit, b: AoE4Unit) => a.name.localeCompare(b.name));
              if (!units.length) return null;
              return (
                <div key={cat} className="mb-1">
                  <div className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    {CATEGORY_LABELS[cat] ?? cat}
                  </div>
                  {units.map((u: AoE4Unit) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => pickUnit(u.id)}
                      className={cn(
                        "block w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-amber-500/15",
                        slot.unit?.id === u.id ? "text-amber-300" : "text-zinc-200",
                      )}
                    >
                      {u.name}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
