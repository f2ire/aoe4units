/* eslint-disable @typescript-eslint/no-explicit-any */
import { CIVILIZATIONS } from "@/data/civilizations";
import { getAvailableAges } from "@/data/unified-units";
import type { AoE4Unit } from "@/data/unified-units";
import { useUnitSlot } from "@/hooks/useUnitSlot";
import { buildModifiedVariation } from "@/lib/buildVariation";
import { UnitCard } from "@/components/UnitCard";
import { AgeSelector } from "@/components/AgeSelector";
import { TechnologySelector } from "@/components/TechnologySelector";
import { AbilitySelector } from "@/components/AbilitySelector";

// Category labels for the unit <select> optgroups (mirrors categorizeUnit()'s output).
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

// Single-unit interactive view: pick a civ + unit, toggle age/techs/abilities,
// see the resulting UnitCard with its bonus damage. Owns its own useUnitSlot.
// This is the reusable building block — a future 1v1 view composes two of these.
export default function UnitPanel() {
  const slot = useUnitSlot();
  const unitId = slot.variation?.baseId ?? slot.unit?.id;

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

  return (
    <div className="flex flex-col gap-3">
      <select
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        value={slot.selectedCiv}
        onChange={(e) => {
          slot.setSelectedCiv(e.target.value);
          slot.setUnit(null); // avoid a stale cross-civ unit
        }}
      >
        {CIVILIZATIONS.map((c) => (
          <option key={c.abbr} value={c.abbr}>{c.name}</option>
        ))}
      </select>

      <select
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        value={slot.unit?.id ?? ""}
        onChange={(e) => {
          const value = e.target.value;
          if (!value) { slot.setUnit(null); return; }
          if (value === "desert-raider_cavalry") {
            slot.setUnit(slot.filteredUnits.find((u) => u.id === "desert-raider") || null, "ability-desert-raider-blade");
            return;
          }
          slot.setUnit(slot.filteredUnits.find((u) => u.id === value) || null);
        }}
      >
        <option value="">Select a unit…</option>
        {CATEGORY_ORDER.filter((cat) => slot.categorizedUnits[cat]?.length).map((cat) => (
          <optgroup key={cat} label={CATEGORY_LABELS[cat] ?? cat}>
            {slot.categorizedUnits[cat]
              .slice()
              .sort((a: AoE4Unit, b: AoE4Unit) => a.name.localeCompare(b.name))
              .map((u: AoE4Unit) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
          </optgroup>
        ))}
      </select>

      {slot.unit && modified ? (
        <>
          <AgeSelector
            availableAges={getAvailableAges(slot.unit.id, slot.selectedCiv)}
            selectedAge={slot.selectedAge}
            onAgeChange={slot.setSelectedAge}
            orientation="left"
          />
          <TechnologySelector
            technologies={slot.techs}
            activeTechnologies={slot.activeTechnologies}
            onToggle={slot.toggleTechnology}
            unitMinAge={slot.unitMinAge}
            fullUpgradeAge={slot.fullUpgradeAge}
            onApplyFullUpgrade={slot.applyFullUpgrade}
            onReset={slot.resetTechnologies}
            orientation="left"
            selectedCiv={slot.selectedCiv}
            lockedTechnologies={slot.lockedTechnologies}
            unitId={unitId}
            selectedAge={slot.selectedAge}
          />
          <AbilitySelector
            abilities={slot.abilities}
            activeAbilities={slot.activeAbilities}
            onToggle={slot.toggleAbility}
            orientation="left"
            selectedCiv={slot.selectedCiv}
            lockedAbilities={slot.lockedAbilities}
            abilityCounters={slot.abilityCounters}
            onIncrement={slot.incrementAbility}
            onDecrement={slot.decrementAbility}
            onSetCounter={slot.setAbilityCounter}
            unitId={unitId}
          />
          <UnitCard
            className="w-full"
            variation={isVariation ? (modified as any) : undefined}
            unit={isVariation ? slot.unit! : (modified as any)}
            side="left"
            isSelected
            bonusDamage={slot.modifiedStats.bonusDamage}
            secondaryWeapons={modified.secondaryWeapons ?? slot.secondaryWeapons}
            showSecondaryWeaponRow={slot.secondaryWeapons.length > 0}
            maxHpBonusFraction={slot.modifiedStats.maxHpBonusFraction ?? 0}
          />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Pick a civ and a unit to see its stats.</p>
      )}
    </div>
  );
}
