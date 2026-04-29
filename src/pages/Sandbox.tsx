import React, { useState } from "react";
import { aoe4Units, AoE4Unit, getAvailableAges, getPrimaryWeapon, getTotalCost } from "@/data/unified-units";
import type { UnifiedVariation } from "@/data/unified-units";
import { CIVILIZATIONS } from "@/data/civilizations";
import { UnitCard } from "@/components/UnitCard";
import { computeVersus, computeVersusAtEqualCost, getVersusDebuffMultiplier } from "@/lib/combat";
import { AgeSelector } from "@/components/AgeSelector";
import { TechnologySelector } from "@/components/TechnologySelector";
import { AbilitySelector } from "@/components/AbilitySelector";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { motion } from "framer-motion";
import { useUnitSlot } from "@/hooks/useUnitSlot";
import { JeanneFormSelector, isJeanneUnit } from "@/components/JeanneFormSelector";


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
};

const categoryOrder = ['jeanne', 'melee_infantry', 'ranged', 'cavalry', 'siege', 'mercenary', 'monk', 'ship', 'other'];

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

// Function to calculate the charge bonus for a unit
const getChargeBonus = (unitData: AoE4Unit | UnifiedVariation | undefined, activeAbilities: Set<string>, age: number, activeTechnologies: Set<string> = new Set(), chargeMultiplier?: number, modifiedMeleeAttack?: number, abilityCounters?: Map<string, number>, modifiedRangedAttack?: number): number => {
  if (!unitData) return 0;

  // Get the base ID for variations
  const baseId = ('baseId' in unitData) ? unitData.baseId : unitData.id;
  const unitClasses = unitData.classes || [];
  const isKnight = unitClasses.some(c => c.toLowerCase() === 'knight');

  const holyWrathStacks = abilityCounters?.get('ability-holy-wrath') ?? 0;

  let strikeBonus = 0;
  if (holyWrathStacks > 0) {
    const perStack =
      baseId === 'jeanne-darc-woman-at-arms' ? 20 :
        baseId === 'jeanne-darc-knight' ? 30 :
          baseId === 'jeanne-darc-blast-cannon' ? 50 : 0;
    if (perStack > 0) strikeBonus = holyWrathStacks * perStack;
  }

  const divineArrowStacks = abilityCounters?.get('ability-divine-arrow') ?? 0;
  let divineArrowBonus = 0;
  if (divineArrowStacks > 0) {
    const perStack =
      baseId === 'jeanne-darc-hunter' ? 40 :
        baseId === 'jeanne-darc-mounted-archer' ? 100 :
          baseId === 'jeanne-darc-markswoman' ? 150 : 0;
    if (perStack > 0) divineArrowBonus = divineArrowStacks * perStack;
  }

  // Way to manage charge + special charge
  if (baseId === 'jeanne-darc-woman-at-arms' || baseId === 'jeanne-darc-blast-cannon') return strikeBonus;
  if (baseId === 'jeanne-darc-knight' && activeAbilities.has('charge-attack')) return strikeBonus + 8;
  if (baseId === 'jeanne-darc-knight' && !activeAbilities.has('charge-attack')) return strikeBonus;
  if (baseId === 'jeanne-darc-hunter' || baseId === 'jeanne-darc-mounted-archer' || baseId === 'jeanne-darc-markswoman') return divineArrowBonus;

  // ________________________________
  //
  // Special ability used like charge 
  // ________________________________

  if (activeAbilities.has('ability-trample') && baseId === 'cataphract') return 12;
  if (baseId === 'kipchak-archer') return 12 + (activeTechnologies.has('incendiary-arrows') ? 7.2 : 0);

  if (activeAbilities.has('ability-dagger-throw') && baseId === 'earls-guard') {
    const hasDrills = activeTechnologies.has('throwing-dagger-drills');
    const castleBonus = abilityCounters?.get('ability-house-unified') ?? 0;
    const rangedTechBonus = modifiedRangedAttack ?? 0;
    const daggerBase = (age >= 4 ? 22 : 16) + (hasDrills ? 2 : 0) + castleBonus + rangedTechBonus;
    const burstCount = hasDrills ? 2 : 1;
    return daggerBase * burstCount;
  }
  // ________________________________
  //
  // Remove charge when inactive
  // ________________________________

  if (!activeAbilities.has('charge-attack')) return 0;

  // _________________________________
  //
  // Set up special unit charge damage 
  // _________________________________


  if (baseId === 'demilancer') {
    switch (age) {
      case 2: return 4;
      case 3: return 5;
      case 4: return 14;
      default: return 0;
    }
  }

  if (baseId === 'torguud') {
    switch (age) {
      case 2: return 5;
      case 3: return 7;
      case 4: return 9;
      default: return 0;
    }
  }

  if (baseId === 'batu-khan') {
    switch (age) {
      case 2: return 10;
      case 3: return 12;
      case 4: return 12;
      default: return 0;
    }
  }

  if (baseId === 'keshik') {
    switch (age) {
      case 2: return 8;
      case 3: return 10;
      case 4: return 12;
      default: return 0;
    }
  }
  if (baseId === 'ghulam' || unitClasses.some(c => c.toLowerCase() === 'merc_ghulam')) {
    switch (age) {
      case 3: return 5;
      case 4: return 6;
      default: return 0;
    }
  }

  if (baseId === 'fire-lancer') {
    return 4;
  }



  // chargeMultiplier: bonus = % of unit's primary melee damage (e.g. Burgrave Palace: ×0.5)
  if (chargeMultiplier && chargeMultiplier > 0) {
    const primaryWeapon = getPrimaryWeapon(unitData as UnifiedVariation);
    return (primaryWeapon?.damage ?? 0) * chargeMultiplier;
  }

  // If basic knight

  if (isKnight) {
    switch (age) {
      case 2: return 10;
      case 3: return 12;
      case 4: return 14;
      default: return 0;
    }
  }


  return 0;
};

const getChargeBonusBurst = (unitData: AoE4Unit | UnifiedVariation | undefined, activeTechnologies: Set<string> = new Set()): number => {
  if (!unitData) return 1;
  const baseId = ('baseId' in unitData) ? unitData.baseId : unitData.id;
  if (baseId === 'earls-guard' && activeTechnologies.has('throwing-dagger-drills')) return 2;
  return 1;
};

const Sandbox = () => {
  const [isVersus, setIsVersus] = useState<boolean>(false);
  const [atEqualCost, setAtEqualCost] = useState<boolean>(false);
  const [allowKiting, setAllowKiting] = useState<boolean>(false);
  const [showDurationEffect, setShowDurationEffect] = useState<boolean>(false);
  const [startDistancePreset, setStartDistancePreset] = useState<string>("medium");
  const [customDistance, setCustomDistance] = useState<number>(5);
  const startDistance = startDistancePreset === "melee" ? 0
    : startDistancePreset === "medium" ? 5
      : startDistancePreset === "long" ? 9
        : Math.max(0, Math.min(30, customDistance));

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
    abilityCounters: abilityCounters1,
    lockedAbilities: lockedAbilities1,
    lockedTechnologies: lockedTechnologies1,
    secondaryWeapons: secondaryWeapons1,
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
    abilityCounters: abilityCounters2,
    lockedAbilities: lockedAbilities2,
    lockedTechnologies: lockedTechnologies2,
    secondaryWeapons: secondaryWeapons2,
  } = civ2;

  // Filter bonusDamage entries by weapon type — prevents ranged bonuses (e.g. Howdahs) from
  // applying to melee weapons (e.g. Tusks) and vice-versa.
  const filterBonusForWeapon = (bonusDamage: any[], weaponType: string) => // eslint-disable-line @typescript-eslint/no-explicit-any
    weaponType === 'melee'
      ? bonusDamage.filter((b: any) => b.property !== 'rangedAttack') // eslint-disable-line @typescript-eslint/no-explicit-any
      : bonusDamage.filter((b: any) => b.property !== 'meleeAttack'); // eslint-disable-line @typescript-eslint/no-explicit-any

  // Build variations with applied technologies
  const modifiedVariation1 = variation1 ? (() => {
    const debuffMultiplier = unit2 && activeAbilities2.size > 0
      ? getVersusDebuffMultiplier(variation1.classes || [], Array.from(activeAbilities2))
      : 1.0;

    return {
      ...variation1,
      hitpoints: modifiedStats1.hitpoints,
      weapons: variation1.weapons.map(weapon => ({
        ...weapon,
        damage: (weapon.type === 'melee' ? modifiedStats1.meleeAttack : weapon.type === 'siege' ? (modifiedStats1.siegeAttack ?? modifiedStats1.rangedAttack) : modifiedStats1.rangedAttack) * debuffMultiplier,
        speed: modifiedStats1.attackSpeed,
        range: weapon.range ? {
          ...weapon.range,
          max: modifiedStats1.maxRange || weapon.range.max
        } : undefined,
        modifiers: filterBonusForWeapon(modifiedStats1.bonusDamage || [], weapon.type),
        burst: modifiedStats1.burst ? { count: modifiedStats1.burst } : weapon.burst
      })),
      armor: [
        { type: 'melee', value: modifiedStats1.meleeArmor },
        { type: 'ranged', value: modifiedStats1.rangedArmor }
      ],
      resistance: [
        ...(variation1.resistance || []).filter((r: { type: string }) => r.type !== 'ranged' && r.type !== 'melee'),
        ...((modifiedStats1.rangedResistance ?? 0) > 0 ? [{ type: 'ranged', value: modifiedStats1.rangedResistance! }] : []),
        ...((modifiedStats1.meleeResistance ?? 0) !== 0 ? [{ type: 'melee', value: modifiedStats1.meleeResistance! }] : []),
      ],
      costs: (modifiedStats1.costMultiplier != null && modifiedStats1.costMultiplier !== 1.0) || (modifiedStats1.stoneCostMultiplier != null && modifiedStats1.stoneCostMultiplier !== 1.0) || (modifiedStats1.foodCostMultiplier != null && modifiedStats1.foodCostMultiplier !== 1.0) ? {
        ...variation1.costs,
        food: Math.round((variation1.costs.food || 0) * (modifiedStats1.costMultiplier ?? 1) * (modifiedStats1.foodCostMultiplier ?? 1)),
        wood: Math.round((variation1.costs.wood || 0) * (modifiedStats1.costMultiplier ?? 1)),
        gold: Math.round((variation1.costs.gold || 0) * (modifiedStats1.costMultiplier ?? 1)),
        stone: Math.round((variation1.costs.stone || 0) * (modifiedStats1.costMultiplier ?? 1) * (modifiedStats1.stoneCostMultiplier ?? 1)),
        oliveoil: Math.round((variation1.costs.oliveoil || 0) * (modifiedStats1.costMultiplier ?? 1)),
      } : variation1.costs,
      movement: variation1.movement ? {
        ...variation1.movement,
        speed: modifiedStats1.moveSpeed
      } : undefined,
      healingRate: modifiedStats1.healingRate ?? 0,
      armorPenetration: modifiedStats1.armorPenetration ?? 0,
      postChargeMeleeBonus: modifiedStats1.postChargeMeleeBonus ?? 0,
      firstHitBlocked: activeAbilities1.has('ability-deflective-armor'),
      chargeBonusBurst: getChargeBonusBurst(variation1, activeTechnologies1),
      chargeArmorType: variation1.baseId === 'earls-guard' ? 'ranged' as const :
        (['jeanne-darc-woman-at-arms', 'jeanne-darc-knight', 'jeanne-darc-blast-cannon'].includes(variation1.baseId) && (abilityCounters1?.get('ability-holy-wrath') ?? 0) > 0) ? 'none' as const :
        (['jeanne-darc-hunter', 'jeanne-darc-mounted-archer', 'jeanne-darc-markswoman'].includes(variation1.baseId) && (abilityCounters1?.get('ability-divine-arrow') ?? 0) > 0) ? 'none' as const : undefined,
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
          damage: (() => {
            const raw = w.type === 'ranged' || w.type === 'siege'
              ? w.damageMultiplier != null
                ? (rangedBase1 * w.damageMultiplier + rangedFlatDelta1) * rangedMultiplier1 * debuffMultiplier
                : modifiedStats1.rangedAttack * debuffMultiplier
              : (w.damage + meleeAttackDelta) * debuffMultiplier;
            return w.maxDamage != null ? Math.min(raw, w.maxDamage) : raw;
          })(),
          modifiers: (w.type === 'ranged' || w.type === 'siege')
            ? filterBonusForWeapon(modifiedStats1.bonusDamage || [], w.type).filter((m: any) => !m.chargeBonusLabel) // eslint-disable-line @typescript-eslint/no-explicit-any
            : [...(w.modifiers || []), ...filterBonusForWeapon(modifiedStats1.bonusDamage || [], 'melee').filter((b: any) => !b.fromWeapon)], // eslint-disable-line @typescript-eslint/no-explicit-any
        }));
      })(),
    };
  })() : undefined;

  const modifiedVariation2 = variation2 ? (() => {
    const debuffMultiplier = unit1 && activeAbilities1.size > 0
      ? getVersusDebuffMultiplier(variation2.classes || [], Array.from(activeAbilities1))
      : 1.0;

    return {
      ...variation2,
      hitpoints: modifiedStats2.hitpoints,
      weapons: variation2.weapons.map(weapon => ({
        ...weapon,
        damage: (weapon.type === 'melee' ? modifiedStats2.meleeAttack : weapon.type === 'siege' ? (modifiedStats2.siegeAttack ?? modifiedStats2.rangedAttack) : modifiedStats2.rangedAttack) * debuffMultiplier,
        speed: modifiedStats2.attackSpeed,
        range: weapon.range ? {
          ...weapon.range,
          max: modifiedStats2.maxRange || weapon.range.max
        } : undefined,
        modifiers: filterBonusForWeapon(modifiedStats2.bonusDamage || [], weapon.type),
        burst: modifiedStats2.burst ? { count: modifiedStats2.burst } : weapon.burst
      })),
      armor: [
        { type: 'melee', value: modifiedStats2.meleeArmor },
        { type: 'ranged', value: modifiedStats2.rangedArmor }
      ],
      resistance: [
        ...(variation2.resistance || []).filter((r: { type: string }) => r.type !== 'ranged' && r.type !== 'melee'),
        ...((modifiedStats2.rangedResistance ?? 0) > 0 ? [{ type: 'ranged', value: modifiedStats2.rangedResistance! }] : []),
        ...((modifiedStats2.meleeResistance ?? 0) !== 0 ? [{ type: 'melee', value: modifiedStats2.meleeResistance! }] : []),
      ],
      costs: (modifiedStats2.costMultiplier != null && modifiedStats2.costMultiplier !== 1.0) || (modifiedStats2.stoneCostMultiplier != null && modifiedStats2.stoneCostMultiplier !== 1.0) || (modifiedStats2.foodCostMultiplier != null && modifiedStats2.foodCostMultiplier !== 1.0) ? {
        ...variation2.costs,
        food: Math.round((variation2.costs.food || 0) * (modifiedStats2.costMultiplier ?? 1) * (modifiedStats2.foodCostMultiplier ?? 1)),
        wood: Math.round((variation2.costs.wood || 0) * (modifiedStats2.costMultiplier ?? 1)),
        gold: Math.round((variation2.costs.gold || 0) * (modifiedStats2.costMultiplier ?? 1)),
        stone: Math.round((variation2.costs.stone || 0) * (modifiedStats2.costMultiplier ?? 1) * (modifiedStats2.stoneCostMultiplier ?? 1)),
        oliveoil: Math.round((variation2.costs.oliveoil || 0) * (modifiedStats2.costMultiplier ?? 1)),
      } : variation2.costs,
      movement: variation2.movement ? {
        ...variation2.movement,
        speed: modifiedStats2.moveSpeed
      } : undefined,
      healingRate: modifiedStats2.healingRate ?? 0,
      armorPenetration: modifiedStats2.armorPenetration ?? 0,
      postChargeMeleeBonus: modifiedStats2.postChargeMeleeBonus ?? 0,
      firstHitBlocked: activeAbilities2.has('ability-deflective-armor'),
      chargeBonusBurst: getChargeBonusBurst(variation2, activeTechnologies2),
      chargeArmorType: variation2.baseId === 'earls-guard' ? 'ranged' as const :
        (['jeanne-darc-woman-at-arms', 'jeanne-darc-knight', 'jeanne-darc-blast-cannon'].includes(variation2.baseId) && (abilityCounters2?.get('ability-holy-wrath') ?? 0) > 0) ? 'none' as const :
        (['jeanne-darc-hunter', 'jeanne-darc-mounted-archer', 'jeanne-darc-markswoman'].includes(variation2.baseId) && (abilityCounters2?.get('ability-divine-arrow') ?? 0) > 0) ? 'none' as const : undefined,
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
          damage: (() => {
            const raw = w.type === 'ranged' || w.type === 'siege'
              ? w.damageMultiplier != null
                ? (rangedBase2 * w.damageMultiplier + rangedFlatDelta2) * rangedMultiplier2 * debuffMultiplier
                : modifiedStats2.rangedAttack * debuffMultiplier
              : (w.damage + meleeAttackDelta) * debuffMultiplier;
            return w.maxDamage != null ? Math.min(raw, w.maxDamage) : raw;
          })(),
          modifiers: (w.type === 'ranged' || w.type === 'siege')
            ? filterBonusForWeapon(modifiedStats2.bonusDamage || [], w.type)
            : [...(w.modifiers || []), ...filterBonusForWeapon(modifiedStats2.bonusDamage || [], 'melee').filter((b: any) => !b.fromWeapon)], // eslint-disable-line @typescript-eslint/no-explicit-any
        }));
      })(),
    };
  })() : undefined;

  // Compute stats for comparison
  const data1 = modifiedVariation1 || unit1;
  const data2 = modifiedVariation2 || unit2;

  const modifiedUnit1 = unit1 && !variation1 ? (() => {
    // Compute the versus debuff from civ2 abilities
    const debuffMultiplier = unit2 && activeAbilities2.size > 0
      ? getVersusDebuffMultiplier(unit1.classes || [], Array.from(activeAbilities2))
      : 1.0;

    return {
      ...unit1,
      hitpoints: modifiedStats1.hitpoints,
      weapons: unit1.weapons.map(weapon => ({
        ...weapon,
        damage: (weapon.type === 'melee' ? modifiedStats1.meleeAttack : weapon.type === 'siege' ? (modifiedStats1.siegeAttack ?? modifiedStats1.rangedAttack) : modifiedStats1.rangedAttack) * debuffMultiplier,
        speed: modifiedStats1.attackSpeed,
        range: weapon.range ? {
          ...weapon.range,
          max: modifiedStats1.maxRange || weapon.range.max
        } : undefined,
        modifiers: filterBonusForWeapon(modifiedStats1.bonusDamage || [], weapon.type),
        burst: modifiedStats1.burst ? { count: modifiedStats1.burst } : weapon.burst
      })),
      armor: [
        { type: 'melee', value: modifiedStats1.meleeArmor },
        { type: 'ranged', value: modifiedStats1.rangedArmor }
      ],
      resistance: [
        ...(unit1.resistance || []).filter((r: { type: string }) => r.type !== 'ranged' && r.type !== 'melee'),
        ...((modifiedStats1.rangedResistance ?? 0) > 0 ? [{ type: 'ranged', value: modifiedStats1.rangedResistance! }] : []),
        ...((modifiedStats1.meleeResistance ?? 0) !== 0 ? [{ type: 'melee', value: modifiedStats1.meleeResistance! }] : []),
      ],
      movement: unit1.movement ? {
        ...unit1.movement,
        speed: modifiedStats1.moveSpeed
      } : undefined,
      healingRate: modifiedStats1.healingRate ?? 0,
      armorPenetration: modifiedStats1.armorPenetration ?? 0,
      postChargeMeleeBonus: modifiedStats1.postChargeMeleeBonus ?? 0,
      firstHitBlocked: activeAbilities1.has('ability-deflective-armor'),
      chargeBonusBurst: getChargeBonusBurst(unit1, activeTechnologies1),
      chargeArmorType: unit1.id === 'earls-guard' ? 'ranged' as const :
        (['jeanne-darc-woman-at-arms', 'jeanne-darc-knight', 'jeanne-darc-blast-cannon'].includes(unit1.id) && (abilityCounters1?.get('ability-holy-wrath') ?? 0) > 0) ? 'none' as const :
        (['jeanne-darc-hunter', 'jeanne-darc-mounted-archer', 'jeanne-darc-markswoman'].includes(unit1.id) && (abilityCounters1?.get('ability-divine-arrow') ?? 0) > 0) ? 'none' as const : undefined,
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
          damage: (() => {
            const raw = w.type === 'ranged' || w.type === 'siege'
              ? w.damageMultiplier != null
                ? (rangedBaseU1 * w.damageMultiplier + rangedFlatDeltaU1) * rangedMultiplierU1 * debuffMultiplier
                : modifiedStats1.rangedAttack * debuffMultiplier
              : (w.damage + meleeAttackDelta) * debuffMultiplier;
            return w.maxDamage != null ? Math.min(raw, w.maxDamage) : raw;
          })(),
          modifiers: (w.type === 'ranged' || w.type === 'siege')
            ? filterBonusForWeapon(modifiedStats1.bonusDamage || [], w.type).filter((m: any) => !m.chargeBonusLabel) // eslint-disable-line @typescript-eslint/no-explicit-any
            : [...(w.modifiers || []), ...filterBonusForWeapon(modifiedStats1.bonusDamage || [], 'melee').filter((b: any) => !b.fromWeapon)], // eslint-disable-line @typescript-eslint/no-explicit-any
        }));
      })(),
    };
  })() : undefined;

  const modifiedUnit2 = unit2 && !variation2 ? (() => {
    // Compute the versus debuff from civ1 abilities
    const debuffMultiplier = unit1 && activeAbilities1.size > 0
      ? getVersusDebuffMultiplier(unit2.classes || [], Array.from(activeAbilities1))
      : 1.0;

    return {
      ...unit2,
      hitpoints: modifiedStats2.hitpoints,
      weapons: unit2.weapons.map(weapon => ({
        ...weapon,
        damage: (weapon.type === 'melee' ? modifiedStats2.meleeAttack : weapon.type === 'siege' ? (modifiedStats2.siegeAttack ?? modifiedStats2.rangedAttack) : modifiedStats2.rangedAttack) * debuffMultiplier,
        speed: modifiedStats2.attackSpeed,
        range: weapon.range ? {
          ...weapon.range,
          max: modifiedStats2.maxRange || weapon.range.max
        } : undefined,
        modifiers: filterBonusForWeapon(modifiedStats2.bonusDamage || [], weapon.type),
        burst: modifiedStats2.burst ? { count: modifiedStats2.burst } : weapon.burst
      })),
      armor: [
        { type: 'melee', value: modifiedStats2.meleeArmor },
        { type: 'ranged', value: modifiedStats2.rangedArmor }
      ],
      resistance: [
        ...(unit2.resistance || []).filter((r: { type: string }) => r.type !== 'ranged' && r.type !== 'melee'),
        ...((modifiedStats2.rangedResistance ?? 0) > 0 ? [{ type: 'ranged', value: modifiedStats2.rangedResistance! }] : []),
        ...((modifiedStats2.meleeResistance ?? 0) !== 0 ? [{ type: 'melee', value: modifiedStats2.meleeResistance! }] : []),
      ],
      movement: unit2.movement ? {
        ...unit2.movement,
        speed: modifiedStats2.moveSpeed
      } : undefined,
      healingRate: modifiedStats2.healingRate ?? 0,
      armorPenetration: modifiedStats2.armorPenetration ?? 0,
      postChargeMeleeBonus: modifiedStats2.postChargeMeleeBonus ?? 0,
      firstHitBlocked: activeAbilities2.has('ability-deflective-armor'),
      chargeBonusBurst: getChargeBonusBurst(unit2, activeTechnologies2),
      chargeArmorType: unit2.id === 'earls-guard' ? 'ranged' as const :
        (['jeanne-darc-woman-at-arms', 'jeanne-darc-knight', 'jeanne-darc-blast-cannon'].includes(unit2.id) && (abilityCounters2?.get('ability-holy-wrath') ?? 0) > 0) ? 'none' as const :
        (['jeanne-darc-hunter', 'jeanne-darc-mounted-archer', 'jeanne-darc-markswoman'].includes(unit2.id) && (abilityCounters2?.get('ability-divine-arrow') ?? 0) > 0) ? 'none' as const : undefined,
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
          damage: (() => {
            const raw = w.type === 'ranged' || w.type === 'siege'
              ? w.damageMultiplier != null
                ? (rangedBaseU2 * w.damageMultiplier + rangedFlatDeltaU2) * rangedMultiplierU2 * debuffMultiplier
                : modifiedStats2.rangedAttack * debuffMultiplier
              : (w.damage + meleeAttackDelta) * debuffMultiplier;
            return w.maxDamage != null ? Math.min(raw, w.maxDamage) : raw;
          })(),
          modifiers: (w.type === 'ranged' || w.type === 'siege')
            ? filterBonusForWeapon(modifiedStats2.bonusDamage || [], w.type)
            : [...(w.modifiers || []), ...filterBonusForWeapon(modifiedStats2.bonusDamage || [], 'melee').filter((b: any) => !b.fromWeapon)], // eslint-disable-line @typescript-eslint/no-explicit-any
        }));
      })(),
    };
  })() : undefined;

  // noTimer variations: same structure as originals but with duration-tagged ability effects excluded.
  // Only built when showDurationEffect is ON and a timed ability is active on that side.
  const modifiedVariation1NoTimer = (showDurationEffect && timedDuration1 && modifiedVariation1 && variation1) ? (() => {
    const s = modifiedStats1NoTimer;
    const debuffMult = unit2 && activeAbilities2.size > 0 ? getVersusDebuffMultiplier(variation1.classes || [], Array.from(activeAbilities2)) : 1.0;
    return {
      ...modifiedVariation1,
      hitpoints: s.hitpoints,
      weapons: variation1.weapons.map(w => ({
        ...w,
        damage: (w.type === 'melee' ? s.meleeAttack : w.type === 'siege' ? (s.siegeAttack ?? s.rangedAttack) : s.rangedAttack) * debuffMult,
        speed: s.attackSpeed,
        range: w.range ? { ...w.range, max: s.maxRange || w.range.max } : undefined,
        modifiers: filterBonusForWeapon(s.bonusDamage || [], w.type),
        burst: s.burst ? { count: s.burst } : w.burst,
      })),
      armor: [{ type: 'melee', value: s.meleeArmor }, { type: 'ranged', value: s.rangedArmor }],
      resistance: [
        ...(variation1.resistance || []).filter((r: any) => r.type !== 'ranged' && r.type !== 'melee'), // eslint-disable-line @typescript-eslint/no-explicit-any
        ...((s.rangedResistance ?? 0) > 0 ? [{ type: 'ranged', value: s.rangedResistance! }] : []),
        ...((s.meleeResistance ?? 0) !== 0 ? [{ type: 'melee', value: s.meleeResistance! }] : []),
      ],
      movement: modifiedVariation1.movement ? { ...modifiedVariation1.movement, speed: s.moveSpeed } : undefined,
      healingRate: s.healingRate ?? 0,
      armorPenetration: s.armorPenetration ?? 0,
    };
  })() : undefined;

  const modifiedVariation2NoTimer = (showDurationEffect && timedDuration2 && modifiedVariation2 && variation2) ? (() => {
    const s = modifiedStats2NoTimer;
    const debuffMult = unit1 && activeAbilities1.size > 0 ? getVersusDebuffMultiplier(variation2.classes || [], Array.from(activeAbilities1)) : 1.0;
    return {
      ...modifiedVariation2,
      hitpoints: s.hitpoints,
      weapons: variation2.weapons.map(w => ({
        ...w,
        damage: (w.type === 'melee' ? s.meleeAttack : w.type === 'siege' ? (s.siegeAttack ?? s.rangedAttack) : s.rangedAttack) * debuffMult,
        speed: s.attackSpeed,
        range: w.range ? { ...w.range, max: s.maxRange || w.range.max } : undefined,
        modifiers: filterBonusForWeapon(s.bonusDamage || [], w.type),
        burst: s.burst ? { count: s.burst } : w.burst,
      })),
      armor: [{ type: 'melee', value: s.meleeArmor }, { type: 'ranged', value: s.rangedArmor }],
      resistance: [
        ...(variation2.resistance || []).filter((r: any) => r.type !== 'ranged' && r.type !== 'melee'), // eslint-disable-line @typescript-eslint/no-explicit-any
        ...((s.rangedResistance ?? 0) > 0 ? [{ type: 'ranged', value: s.rangedResistance! }] : []),
        ...((s.meleeResistance ?? 0) !== 0 ? [{ type: 'melee', value: s.meleeResistance! }] : []),
      ],
      movement: modifiedVariation2.movement ? { ...modifiedVariation2.movement, speed: s.moveSpeed } : undefined,
      healingRate: s.healingRate ?? 0,
      armorPenetration: s.armorPenetration ?? 0,
    };
  })() : undefined;

  const modifiedUnit1NoTimer = (showDurationEffect && timedDuration1 && unit1 && !variation1) ? (() => {
    const s = modifiedStats1NoTimer;
    const debuffMult = unit2 && activeAbilities2.size > 0 ? getVersusDebuffMultiplier(unit1.classes || [], Array.from(activeAbilities2)) : 1.0;
    return {
      ...modifiedUnit1!,
      hitpoints: s.hitpoints,
      weapons: unit1.weapons.map(w => ({
        ...w,
        damage: (w.type === 'melee' ? s.meleeAttack : w.type === 'siege' ? (s.siegeAttack ?? s.rangedAttack) : s.rangedAttack) * debuffMult,
        speed: s.attackSpeed,
        range: w.range ? { ...w.range, max: s.maxRange || w.range.max } : undefined,
        modifiers: filterBonusForWeapon(s.bonusDamage || [], w.type),
        burst: s.burst ? { count: s.burst } : w.burst,
      })),
      armor: [{ type: 'melee', value: s.meleeArmor }, { type: 'ranged', value: s.rangedArmor }],
      resistance: [
        ...(unit1.resistance || []).filter((r: any) => r.type !== 'ranged' && r.type !== 'melee'), // eslint-disable-line @typescript-eslint/no-explicit-any
        ...((s.rangedResistance ?? 0) > 0 ? [{ type: 'ranged', value: s.rangedResistance! }] : []),
        ...((s.meleeResistance ?? 0) !== 0 ? [{ type: 'melee', value: s.meleeResistance! }] : []),
      ],
      movement: unit1.movement ? { ...unit1.movement, speed: s.moveSpeed } : undefined,
      healingRate: s.healingRate ?? 0,
      armorPenetration: s.armorPenetration ?? 0,
    };
  })() : undefined;

  const modifiedUnit2NoTimer = (showDurationEffect && timedDuration2 && unit2 && !variation2) ? (() => {
    const s = modifiedStats2NoTimer;
    const debuffMult = unit1 && activeAbilities1.size > 0 ? getVersusDebuffMultiplier(unit2.classes || [], Array.from(activeAbilities1)) : 1.0;
    return {
      ...modifiedUnit2!,
      hitpoints: s.hitpoints,
      weapons: unit2.weapons.map(w => ({
        ...w,
        damage: (w.type === 'melee' ? s.meleeAttack : w.type === 'siege' ? (s.siegeAttack ?? s.rangedAttack) : s.rangedAttack) * debuffMult,
        speed: s.attackSpeed,
        range: w.range ? { ...w.range, max: s.maxRange || w.range.max } : undefined,
        modifiers: filterBonusForWeapon(s.bonusDamage || [], w.type),
        burst: s.burst ? { count: s.burst } : w.burst,
      })),
      armor: [{ type: 'melee', value: s.meleeArmor }, { type: 'ranged', value: s.rangedArmor }],
      resistance: [
        ...(unit2.resistance || []).filter((r: any) => r.type !== 'ranged' && r.type !== 'melee'), // eslint-disable-line @typescript-eslint/no-explicit-any
        ...((s.rangedResistance ?? 0) > 0 ? [{ type: 'ranged', value: s.rangedResistance! }] : []),
        ...((s.meleeResistance ?? 0) !== 0 ? [{ type: 'melee', value: s.meleeResistance! }] : []),
      ],
      movement: unit2.movement ? { ...unit2.movement, speed: s.moveSpeed } : undefined,
      healingRate: s.healingRate ?? 0,
      armorPenetration: s.armorPenetration ?? 0,
    };
  })() : undefined;

  // Final stats with costs
  const stats1 = data1 ? {
    hp: modifiedStats1.hitpoints,
    attack: (() => {
      const baseAttack = Math.max(modifiedStats1.meleeAttack, modifiedStats1.rangedAttack);
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
    chargeBonus: getChargeBonus(data1, activeAbilities1, selectedAge1, activeTechnologies1, modifiedStats1.chargeMultiplier, modifiedStats1.meleeAttack, abilityCounters1, modifiedStats1.rangedAttack),
    cost: variation1 ? getTotalCost(variation1) : (unit1 ? getTotalCost(unit1) : 0),
    costs: variation1 ? variation1.costs : (unit1 ? unit1.costs : undefined),
    population: 'costs' in (variation1 || unit1 || {}) ? (variation1 || unit1 as any)?.costs?.popcap : undefined, // eslint-disable-line @typescript-eslint/no-explicit-any
    productionTime: 'costs' in (variation1 || unit1 || {}) ? (variation1 || unit1 as any)?.costs?.time : undefined // eslint-disable-line @typescript-eslint/no-explicit-any
  } : null;

  const stats2 = data2 ? {
    hp: modifiedStats2.hitpoints,
    attack: (() => {
      const baseAttack = Math.max(modifiedStats2.meleeAttack, modifiedStats2.rangedAttack);
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
    chargeBonus: getChargeBonus(data2, activeAbilities2, selectedAge2, activeTechnologies2, modifiedStats2.chargeMultiplier, modifiedStats2.meleeAttack, abilityCounters2, modifiedStats2.rangedAttack),
    cost: variation2 ? getTotalCost(variation2) : (unit2 ? getTotalCost(unit2) : 0),
    costs: variation2 ? variation2.costs : (unit2 ? unit2.costs : undefined),
    population: 'costs' in (variation2 || unit2 || {}) ? (variation2 || unit2 as any)?.costs?.popcap : undefined, // eslint-disable-line @typescript-eslint/no-explicit-any
    productionTime: 'costs' in (variation2 || unit2 || {}) ? (variation2 || unit2 as any)?.costs?.time : undefined // eslint-disable-line @typescript-eslint/no-explicit-any
  } : null;

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
    const chargeLabel1 = baseId1 === 'kipchak-archer' ? 'Bleed' : baseId1 === 'earls-guard' ? 'Dagger' : 'Charge';
    const chargeLabel2 = baseId2 === 'kipchak-archer' ? 'Bleed' : baseId2 === 'earls-guard' ? 'Dagger' : 'Charge';

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
    <div className="h-screen overflow-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-w-[1080px] max-w-6xl mx-auto"
      >
        <div className="text-center mb-8 space-y-4">
          <div>
            <h1 className="text-4xl font-serif font-bold text-primary mb-2">Sandbox Mode</h1>
            <p className="text-muted-foreground text-lg">Compare any two units from any civilizations!</p>
          </div>
          {/* Mode Toggle */}
          <div className="flex items-center justify-center gap-4">
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setIsVersus(false)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${!isVersus ? 'bg-primary text-background' : 'bg-card text-muted-foreground hover:text-foreground'
                  }`}
              >
                Comparative
              </button>
              <div className="w-px bg-border" />
              <button
                type="button"
                onClick={() => setIsVersus(true)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${isVersus ? 'bg-primary text-background' : 'bg-card text-muted-foreground hover:text-foreground'
                  }`}
              >
                Versus
              </button>
            </div>
            {isVersus && (
              <div className="inline-flex items-center gap-3">
                {(() => {
                  const effectiveCost1 = modifiedVariation1 ? getTotalCost(modifiedVariation1) : (stats1?.cost ?? 0);
                  const effectiveCost2 = modifiedVariation2 ? getTotalCost(modifiedVariation2) : (stats2?.cost ?? 0);
                  const sameCost = unit1 && unit2 && effectiveCost1 > 0 && effectiveCost2 > 0 && effectiveCost1 === effectiveCost2;
                  return (
                    <div
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-card ${sameCost ? 'opacity-50' : ''}`}
                      title={sameCost ? 'Units have the same cost' : undefined}
                    >
                      <input
                        type="checkbox"
                        id="atEqualCost"
                        checked={atEqualCost}
                        onChange={(e) => !sameCost && setAtEqualCost(e.target.checked)}
                        disabled={!!sameCost}
                        className="w-4 h-4 rounded border-border disabled:cursor-not-allowed"
                      />
                      <label htmlFor="atEqualCost" className={`text-sm font-medium ${sameCost ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                        At Equal Cost
                      </label>
                    </div>
                  );
                })()}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-card">
                  <input
                    type="checkbox"
                    id="allowKiting"
                    checked={allowKiting}
                    onChange={(e) => setAllowKiting(e.target.checked)}
                    className="w-4 h-4 rounded border-border"
                  />
                  <label htmlFor="allowKiting" className="text-sm font-medium cursor-pointer">
                    Allow Kiting
                  </label>
                </div>
                {allowKiting && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-card">
                    <label className="text-sm font-medium">Start Distance:</label>
                    <select
                      value={startDistancePreset}
                      onChange={(e) => setStartDistancePreset(e.target.value)}
                      className="text-sm bg-transparent border-none outline-none cursor-pointer"
                    >
                      <option value="melee">Melee (0)</option>
                      <option value="medium">Medium (5)</option>
                      <option value="long">Long (9)</option>
                      <option value="custom">Custom</option>
                    </select>
                    {startDistancePreset === "custom" && (
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={customDistance}
                        onChange={(e) => setCustomDistance(Number(e.target.value))}
                        className="w-16 text-sm bg-transparent border border-border rounded px-1 outline-none"
                      />
                    )}
                  </div>
                )}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-card">
                  <input
                    type="checkbox"
                    id="showDurationEffect"
                    checked={showDurationEffect}
                    onChange={(e) => setShowDurationEffect(e.target.checked)}
                    className="w-4 h-4 rounded border-border"
                  />
                  <label htmlFor="showDurationEffect" className="text-sm font-medium cursor-pointer">
                    ⏱ Duration
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Civ 1 Column */}
          <div className="space-y-4 flex flex-col items-end">
            <label className="text-sm font-medium text-foreground">Civ 1:</label>
            <Select value={selectedCiv1} onValueChange={setSelectedCiv1}>
              <SelectTrigger className="bg-secondary border-border h-14">
                <SelectValue>
                  {selectedCiv1 === "all" ? (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-muted rounded">
                        <span className="text-xl">?</span>
                      </div>
                      <span className="font-medium">All Civilizations</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <img
                        src={CIVILIZATIONS.find(c => c.abbr === selectedCiv1)?.flagPath}
                        alt=""
                        className="w-8 h-8 object-contain"
                      />
                      <span className="font-medium">
                        {CIVILIZATIONS.find(c => c.abbr === selectedCiv1)?.name}
                      </span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-popover border-border max-h-[400px]">
                <SelectItem value="all" className="data-[state=checked]:font-bold py-3 group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center bg-muted rounded">
                      <span className="text-xl text-white group-hover:text-black transition-colors">?</span>
                    </div>
                    <span className="font-medium text-white group-hover:text-black transition-colors">All Civilizations</span>
                  </div>
                </SelectItem>
                {CIVILIZATIONS.map((civ) => (
                  <SelectItem key={civ.abbr} value={civ.abbr} className="data-[state=checked]:font-bold py-3 group">
                    <div className="flex items-center gap-3">
                      <img src={civ.flagPath} alt={civ.name} className="w-8 h-8 object-contain" />
                      <span className="font-medium text-white group-hover:text-black transition-colors">{civ.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <label className="text-sm font-medium text-foreground mt-6 block">Friendly Unit:</label>
            <Select
              value={isJeanneUnit(unit1) ? 'jeanne-darc-peasant' : unit1?.id === 'desert-raider' && activeAbilities1.has('ability-desert-raider-blade') ? 'desert-raider_cavalry' : (unit1?.id || "")}
              onValueChange={(value) => {
                if (value === 'desert-raider_cavalry') {
                  setUnit1(filteredUnits1.find(u => u.id === 'desert-raider') || null, 'ability-desert-raider-blade');
                } else {
                  setUnit1(filteredUnits1.find(u => u.id === value) || null);
                }
              }}
            >
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Select a unit..." />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border max-h-[500px]">
                {categoryOrder.map(categoryKey => {
                  const units = categorizedUnits1[categoryKey];
                  if (!units || units.length === 0) return null;

                  const isOpen = openCategories1[categoryKey];

                  return (
                    <SelectGroup key={categoryKey}>
                      <div
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleCategory1(categoryKey);
                        }}
                        className="cursor-pointer hover:bg-accent px-2 py-2 rounded group"
                      >
                        <SelectLabel className="text-primary group-hover:text-background font-semibold flex items-center gap-2 cursor-pointer">
                          <span className="text-xs">{isOpen ? '▼' : '▶'}</span>
                          <img
                            src={categoryIcons[categoryKey]}
                            alt=""
                            className="w-5 h-5 object-contain inline-block"
                          />
                          <span>{categoryNames[categoryKey]} ({units.length})</span>
                        </SelectLabel>
                      </div>
                      {isOpen && categoryKey === 'mercenary' ? (() => {
                        const grouped: Record<string, typeof units> = {};
                        for (const u of units) {
                          const sub = getMercenarySubCategory(u);
                          if (!grouped[sub]) grouped[sub] = [];
                          grouped[sub].push(u);
                        }
                        return MERCENARY_SUB_ORDER.filter(sub => grouped[sub]?.length).map(sub => (
                          <React.Fragment key={sub}>
                            <div className="pl-8 py-0.5 text-xs text-muted-foreground italic">{sub}</div>
                            {grouped[sub].map((unit) => (
                              <SelectItem key={unit.id} value={unit.id} className="data-[state=checked]:font-bold pl-10 group">
                                <div className="flex items-center gap-2">
                                  <img src={unit.icon} alt={unit.name} className="w-6 h-6 object-contain" />
                                  <span className="text-white group-hover:text-black transition-colors">{unit.name}</span>
                                  {unit.unique && <span className="text-xs text-primary">(Unique)</span>}
                                </div>
                              </SelectItem>
                            ))}
                          </React.Fragment>
                        ));
                      })() : isOpen && categoryKey === 'jeanne' ? (() => {
                        const peasant = units.find(u => u.id === 'jeanne-darc-peasant');
                        if (!peasant) return null;
                        return (
                          <SelectItem key="jeanne-darc" value="jeanne-darc-peasant" className="data-[state=checked]:font-bold pl-8 group">
                            <div className="flex items-center gap-2">
                              <img src={peasant.icon} alt="Jeanne d'Arc" className="w-6 h-6 object-contain" />
                              <span className="text-white group-hover:text-black transition-colors">Jeanne d'Arc</span>
                            </div>
                          </SelectItem>
                        );
                      })() : isOpen && units.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id} className="data-[state=checked]:font-bold pl-8 group">
                          <div className="flex items-center gap-2">
                            <img src={unit.icon} alt={unit.name} className="w-6 h-6 object-contain" />
                            <span className="text-white group-hover:text-black transition-colors">{unit.name}</span>
                            {unit.unique && <span className="text-xs text-primary">(Unique)</span>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  );
                })}
              </SelectContent>
            </Select>
            {isJeanneUnit(unit1) && (
              <JeanneFormSelector
                mode="panel"
                allForms={filteredUnits1}
                currentFormId={unit1?.id}
                onSelect={setUnit1}
              />
            )}
            <p className="text-xs text-muted-foreground">{filteredUnits1.length} units available</p>
          </div>

          {/* Civ 2 Column */}
          <div className="space-y-4 flex flex-col items-start">
            <label className="text-sm font-medium text-foreground">Civ 2:</label>
            <Select value={selectedCiv2} onValueChange={setSelectedCiv2}>
              <SelectTrigger className="bg-secondary border-border h-14">
                <SelectValue>
                  {selectedCiv2 === "all" ? (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-muted rounded">
                        <span className="text-xl">?</span>
                      </div>
                      <span className="font-medium">All Civilizations</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <img
                        src={CIVILIZATIONS.find(c => c.abbr === selectedCiv2)?.flagPath}
                        alt=""
                        className="w-8 h-8 object-contain"
                      />
                      <span className="font-medium">
                        {CIVILIZATIONS.find(c => c.abbr === selectedCiv2)?.name}
                      </span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-popover border-border max-h-[400px]">
                <SelectItem value="all" className="data-[state=checked]:font-bold py-3 group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center bg-muted rounded">
                      <span className="text-xl text-white group-hover:text-black transition-colors">?</span>
                    </div>
                    <span className="font-medium text-white group-hover:text-black transition-colors">All Civilizations</span>
                  </div>
                </SelectItem>
                {CIVILIZATIONS.map((civ) => (
                  <SelectItem key={civ.abbr} value={civ.abbr} className="data-[state=checked]:font-bold py-3 group">
                    <div className="flex items-center gap-3">
                      <img src={civ.flagPath} alt={civ.name} className="w-8 h-8 object-contain" />
                      <span className="font-medium text-white group-hover:text-black transition-colors">{civ.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <label className="text-sm font-medium text-foreground mt-6 block">Civ 2 Unit:</label>
            <Select
              value={isJeanneUnit(unit2) ? 'jeanne-darc-peasant' : unit2?.id === 'desert-raider' && activeAbilities2.has('ability-desert-raider-blade') ? 'desert-raider_cavalry' : (unit2?.id || "")}
              onValueChange={(value) => {
                if (value === 'desert-raider_cavalry') {
                  setUnit2(filteredUnits2.find(u => u.id === 'desert-raider') || null, 'ability-desert-raider-blade');
                } else {
                  setUnit2(filteredUnits2.find(u => u.id === value) || null);
                }
              }}
            >
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Select a unit..." />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border max-h-[500px]">
                {categoryOrder.map(categoryKey => {
                  const units = categorizedUnits2[categoryKey];
                  if (!units || units.length === 0) return null;

                  const isOpen = openCategories2[categoryKey];

                  return (
                    <SelectGroup key={categoryKey}>
                      <div
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleCategory2(categoryKey);
                        }}
                        className="cursor-pointer hover:bg-accent px-2 py-2 rounded group"
                      >
                        <SelectLabel className="text-primary group-hover:text-background font-semibold flex items-center gap-2 cursor-pointer">
                          <span className="text-xs">{isOpen ? '▼' : '▶'}</span>
                          <img
                            src={categoryIcons[categoryKey]}
                            alt=""
                            className="w-5 h-5 object-contain inline-block"
                          />
                          <span>{categoryNames[categoryKey]} ({units.length})</span>
                        </SelectLabel>
                      </div>
                      {isOpen && categoryKey === 'mercenary' ? (() => {
                        const grouped: Record<string, typeof units> = {};
                        for (const u of units) {
                          const sub = getMercenarySubCategory(u);
                          if (!grouped[sub]) grouped[sub] = [];
                          grouped[sub].push(u);
                        }
                        return MERCENARY_SUB_ORDER.filter(sub => grouped[sub]?.length).map(sub => (
                          <React.Fragment key={sub}>
                            <div className="pl-8 py-0.5 text-xs text-muted-foreground italic">{sub}</div>
                            {grouped[sub].map((unit) => (
                              <SelectItem key={unit.id} value={unit.id} className="data-[state=checked]:font-bold pl-10 group">
                                <div className="flex items-center gap-2">
                                  <img src={unit.icon} alt={unit.name} className="w-6 h-6 object-contain" />
                                  <span className="text-white group-hover:text-black transition-colors">{unit.name}</span>
                                  {unit.unique && <span className="text-xs text-primary">(Unique)</span>}
                                </div>
                              </SelectItem>
                            ))}
                          </React.Fragment>
                        ));
                      })() : isOpen && categoryKey === 'jeanne' ? (() => {
                        const peasant = units.find(u => u.id === 'jeanne-darc-peasant');
                        if (!peasant) return null;
                        return (
                          <SelectItem key="jeanne-darc" value="jeanne-darc-peasant" className="data-[state=checked]:font-bold pl-8 group">
                            <div className="flex items-center gap-2">
                              <img src={peasant.icon} alt="Jeanne d'Arc" className="w-6 h-6 object-contain" />
                              <span className="text-white group-hover:text-black transition-colors">Jeanne d'Arc</span>
                            </div>
                          </SelectItem>
                        );
                      })() : isOpen && units.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id} className="data-[state=checked]:font-bold pl-8 group">
                          <div className="flex items-center gap-2">
                            <img src={unit.icon} alt={unit.name} className="w-6 h-6 object-contain" />
                            <span className="text-white group-hover:text-black transition-colors">{unit.name}</span>
                            {unit.unique && <span className="text-xs text-primary">(Unique)</span>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  );
                })}
              </SelectContent>
            </Select>
            {isJeanneUnit(unit2) && (
              <JeanneFormSelector
                mode="panel"
                allForms={filteredUnits2}
                currentFormId={unit2?.id}
                onSelect={setUnit2}
              />
            )}
            <p className="text-xs text-muted-foreground">{filteredUnits2.length} units available</p>
          </div>
        </div>

        {/* Comparison / versus area */}
        {!isVersus && (
          <div className="grid grid-cols-2 gap-6 mt-8">
            {/* Civ 1 Unit */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="flex justify-center w-full"
            >
              {unit1 && (
                <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4 w-full">
                  <div className="flex flex-row flex-wrap sm:flex-col gap-2 sm:gap-3 sm:flex-shrink-0">
                    <AgeSelector
                      availableAges={getAvailableAges(unit1.id, selectedCiv1)}
                      selectedAge={selectedAge1}
                      onAgeChange={setSelectedAge1}
                      orientation="left"
                    />
                    <TechnologySelector
                      technologies={techs1}
                      activeTechnologies={activeTechnologies1}
                      onToggle={toggleTechnology1}
                      orientation="left"
                      selectedCiv={selectedCiv1}
                      lockedTechnologies={lockedTechnologies1}
                      unitId={variation1?.baseId ?? unit1?.id}
                    />
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
                      unitId={variation1?.baseId ?? unit1?.id}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
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
                    />
                  </div>
                </div>
              )}
            </motion.div>
            {/* Civ 2 Unit */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="flex justify-center w-full"
            >
              {unit2 && (
                <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4 w-full">
                  <div className="flex-1 min-w-0 order-2 sm:order-1">
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
                    />
                  </div>
                  <div className="flex flex-row flex-wrap sm:flex-col gap-2 sm:gap-3 sm:flex-shrink-0 order-1 sm:order-2">
                    <AgeSelector
                      availableAges={getAvailableAges(unit2.id, selectedCiv2)}
                      selectedAge={selectedAge2}
                      onAgeChange={setSelectedAge2}
                      orientation="right"
                    />
                    <TechnologySelector
                      technologies={techs2}
                      activeTechnologies={activeTechnologies2}
                      orientation="right"
                      onToggle={toggleTechnology2}
                      selectedCiv={selectedCiv2}
                      lockedTechnologies={lockedTechnologies2}
                      unitId={variation2?.baseId ?? unit2?.id}
                    />
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
                      unitId={variation2?.baseId ?? unit2?.id}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
        {isVersus && (
          <div className="grid grid-cols-2 gap-6 mt-8">
            {(() => {
              if (!unit1 || !unit2) return null;

              let versusData;
              let multipliers = undefined;

              // Convert Sets to arrays to pass to combat functions
              const abilitiesArray1 = Array.from(activeAbilities1);
              const abilitiesArray2 = Array.from(activeAbilities2);

              // Compute charge bonuses
              const charge1 = getChargeBonus(data1, activeAbilities1, selectedAge1, activeTechnologies1, modifiedStats1.chargeMultiplier, modifiedStats1.meleeAttack, abilityCounters1, modifiedStats1.rangedAttack);
              const charge2 = getChargeBonus(data2, activeAbilities2, selectedAge2, activeTechnologies2, modifiedStats2.chargeMultiplier, modifiedStats2.meleeAttack, abilityCounters2, modifiedStats2.rangedAttack);

              const noTimerData1 = showDurationEffect ? (modifiedVariation1NoTimer || modifiedUnit1NoTimer) : undefined;
              const noTimerData2 = showDurationEffect ? (modifiedVariation2NoTimer || modifiedUnit2NoTimer) : undefined;

              if (atEqualCost) {
                const result = computeVersusAtEqualCost(
                  modifiedVariation1 || modifiedUnit1!,
                  modifiedVariation2 || modifiedUnit2!,
                  abilitiesArray1,
                  abilitiesArray2,
                  charge1,
                  charge2,
                  allowKiting,
                  startDistance,
                );
                versusData = result;
                multipliers = result.multipliers;
              } else {
                versusData = computeVersus(
                  modifiedVariation1 || modifiedUnit1!,
                  modifiedVariation2 || modifiedUnit2!,
                  abilitiesArray1,
                  abilitiesArray2,
                  charge1,
                  charge2,
                  allowKiting,
                  startDistance,
                  noTimerData1,
                  noTimerData2,
                  showDurationEffect ? timedDuration1 : undefined,
                  showDurationEffect ? timedDuration2 : undefined,
                );
              }

              // For delta display: also compute without duration correction when toggle is ON
              const hasActiveDuration = showDurationEffect && !atEqualCost && (!!timedDuration1 || !!timedDuration2);
              const versusDataOriginal = hasActiveDuration ? computeVersus(
                modifiedVariation1 || modifiedUnit1!,
                modifiedVariation2 || modifiedUnit2!,
                abilitiesArray1,
                abilitiesArray2,
                charge1,
                charge2,
                allowKiting,
                startDistance,
              ) : undefined;

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
              const leftMetrics = {
                dps: versusData.attacker.dps,
                dpsPerCost: versusData.attacker.dpsPerCost,
                hitsToKill: versusData.attacker.hitsToKill,
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
                opponentHitsToKill: versusData.defender.hitsToKill,
                opponentTimeToKill: versusData.defender.timeToKill,
                multiplier: multipliers?.multA,
                totalCost: multipliers?.totalCostA,
                opponentMultiplier: multipliers?.multB,
                opponentTotalCost: multipliers?.totalCostB,
                winnerHpRemaining: leftIsWinner ? versusData.winnerHpRemaining : undefined,
                winnerUnitsRemaining: leftIsWinner ? versusData.winnerUnitsRemaining : undefined,
                resourceDifference: leftIsWinner ? versusData.resourceDifference : undefined
              };
              const rightMetrics = {
                dps: versusData.defender.dps,
                dpsPerCost: versusData.defender.dpsPerCost,
                hitsToKill: versusData.defender.hitsToKill,
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
                opponentHitsToKill: versusData.attacker.hitsToKill,
                opponentTimeToKill: versusData.attacker.timeToKill,
                multiplier: multipliers?.multB,
                totalCost: multipliers?.totalCostB,
                opponentMultiplier: multipliers?.multA,
                opponentTotalCost: multipliers?.totalCostA,
                winnerHpRemaining: rightIsWinner ? versusData.winnerHpRemaining : undefined,
                winnerUnitsRemaining: rightIsWinner ? versusData.winnerUnitsRemaining : undefined,
                resourceDifference: rightIsWinner ? versusData.resourceDifference : undefined
              };
              return (
                <>
                  <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex justify-center w-full"
                  >
                    <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4 w-full">
                      <div className="flex flex-row flex-wrap sm:flex-col gap-2 sm:gap-3 sm:flex-shrink-0">
                        <AgeSelector
                          availableAges={getAvailableAges(unit1.id, selectedCiv1)}
                          selectedAge={selectedAge1}
                          onAgeChange={setSelectedAge1}
                          orientation="left"
                        />
                        <TechnologySelector
                          technologies={techs1}
                          activeTechnologies={activeTechnologies1}
                          onToggle={toggleTechnology1}
                          orientation="left"
                          selectedCiv={selectedCiv1}
                          lockedTechnologies={lockedTechnologies1}
                          unitId={variation1?.baseId ?? unit1?.id}
                        />
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
                          unitId={variation1?.baseId ?? unit1?.id}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <UnitCard
                          className="w-full"
                          variation={modifiedVariation1!}
                          unit={modifiedUnit1 || unit1}
                          side="left"
                          mode="versus"
                          versusMetrics={leftMetrics}
                          secondaryWeapons={modifiedVariation1?.secondaryWeapons ?? secondaryWeapons1}
                        />
                      </div>
                    </div>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex justify-center w-full"
                  >
                    <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4 w-full">
                      <div className="flex-1 min-w-0 order-2 sm:order-1">
                        <UnitCard
                          className="w-full"
                          variation={modifiedVariation2!}
                          unit={modifiedUnit2 || unit2}
                          side="right"
                          mode="versus"
                          versusMetrics={rightMetrics}
                          secondaryWeapons={modifiedVariation2?.secondaryWeapons ?? secondaryWeapons2}
                        />
                      </div>
                      <div className="flex flex-row flex-wrap sm:flex-col gap-2 sm:gap-3 sm:flex-shrink-0 order-1 sm:order-2">
                        <AgeSelector
                          availableAges={getAvailableAges(unit2.id, selectedCiv2)}
                          selectedAge={selectedAge2}
                          onAgeChange={setSelectedAge2}
                          orientation="right"
                        />
                        <TechnologySelector
                          technologies={techs2}
                          activeTechnologies={activeTechnologies2}
                          onToggle={toggleTechnology2}
                          orientation="right"
                          selectedCiv={selectedCiv2}
                          lockedTechnologies={lockedTechnologies2}
                          unitId={variation2?.baseId ?? unit2?.id}
                        />
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
                          unitId={variation2?.baseId ?? unit2?.id}
                        />
                      </div>
                    </div>
                  </motion.div>
                  {versusDataOriginal && (
                    <div className="col-span-2 flex flex-wrap justify-center gap-4 mt-2 text-xs text-muted-foreground">
                      {timedDuration1 && versusDataOriginal.attacker.timeToKill !== versusData.attacker.timeToKill && (
                        <span className="text-orange-400">
                          Civ 1 TTK: {versusDataOriginal.attacker.timeToKill}s → {versusData.attacker.timeToKill}s ({timedDuration1}s ability)
                        </span>
                      )}
                      {timedDuration2 && versusDataOriginal.defender.timeToKill !== versusData.defender.timeToKill && (
                        <span className="text-orange-400">
                          Civ 2 TTK: {versusDataOriginal.defender.timeToKill}s → {versusData.defender.timeToKill}s ({timedDuration2}s ability)
                        </span>
                      )}
                      {!timedDuration1 && !timedDuration2 && (
                        <span>No timed ability active — duration correction has no effect.</span>
                      )}
                      {(timedDuration1 || timedDuration2) &&
                        versusDataOriginal.attacker.timeToKill === versusData.attacker.timeToKill &&
                        versusDataOriginal.defender.timeToKill === versusData.defender.timeToKill && (
                        <span>Duration ({timedDuration1 ?? timedDuration2}s) covers full fight — no correction needed.</span>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

      </motion.div>
    </div>
  );
};

export default Sandbox;
