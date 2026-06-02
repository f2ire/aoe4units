import React, { useState } from "react";
import { aoe4Units, AoE4Unit, getAvailableAges, getPrimaryWeapon, getTotalCost } from "@/data/unified-units";
import type { UnifiedVariation } from "@/data/unified-units";
import { CIVILIZATIONS } from "@/data/civilizations";
import { UnitCard } from "@/components/UnitCard";
import { computeVersus, computeVersusAtEqualCost, computeVersusKitingFocusFire, computeVersusAtEqualCostKitingFocusFire, computeVersusKitingBatchesMC, computeVersusAtEqualCostKitingBatchesMC, getVersusDebuffMultiplier, aggregatedDPSModel, focusFireModel, focusFireBatchesMCModel, focusFireBatchesMCAsymmetricModel, focusFireAsymmetricModel, computeLoserUnitsToWin } from "@/lib/combat";
import type { MultiUnitModel } from "@/lib/combat";
import { AgeSelector } from "@/components/AgeSelector";
import { TechnologySelector } from "@/components/TechnologySelector";
import { AbilitySelector } from "@/components/AbilitySelector";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { motion } from "framer-motion";
import { useUnitSlot } from "@/hooks/useUnitSlot";
import { JeanneFormSelector, isJeanneUnit } from "@/components/JeanneFormSelector";
import { GuidedTour } from "@/components/GuidedTour";


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

// Function to calculate the charge bonus for a unit
const getChargeBonus = (unitData: AoE4Unit | UnifiedVariation | undefined, activeAbilities: Set<string>, age: number, activeTechnologies: Set<string> = new Set(), chargeMultiplier?: number, modifiedMeleeAttack?: number, abilityCounters?: Map<string, number>, modifiedRangedAttack?: number, chargeChange?: number): number => {
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

  if (activeAbilities.has('ability-first-strike') && baseId === 'musofadi-warrior') {
    const base = modifiedMeleeAttack || (age >= 4 ? 12 : age >= 3 ? 9 : 8);
    return base * 2;
  }


  if (activeAbilities.has('ability-first-strike') && baseId === 'musofadi-gunner') {
    const base = modifiedMeleeAttack || 41;
    return base;
  }


  if (activeAbilities.has('ability-trample') && baseId === 'cataphract') return 12;

  if (activeAbilities.has('ability-dagger-throw') && baseId === 'earls-guard') {
    const hasDrills = activeTechnologies.has('throwing-dagger-drills');
    const castleBonus = abilityCounters?.get('ability-house-unified') ?? 0;
    const rangedTechBonus = modifiedRangedAttack ?? 0;
    const daggerBase = (age >= 4 ? 22 : 16) + (hasDrills ? 2 : 0) + castleBonus + rangedTechBonus;
    const burstCount = hasDrills ? 2 : 1;
    return daggerBase * burstCount;
  }

  if (activeAbilities.has('javelin-throw') && baseId === 'donso') {
    const rangedTechBonus = modifiedRangedAttack ?? 0;
    const javelinBase = age >= 4 ? 10 : age === 3 ? 8 : age === 2 ? 7 : 5;
    return javelinBase + rangedTechBonus;
  }

  if (activeTechnologies.has('samurai-bow') && baseId === 'naginata-samurai') {
    const rangedTechBonus = modifiedRangedAttack ?? 0;
    const bowBase = age >= 4 ? 13 : age >= 3 ? 11 : age >= 2 ? 9 : 8;
    return bowBase + rangedTechBonus;
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

  let charge_bonus = 0;
  let charge_bonus_mult = 1;
  if (chargeMultiplier && chargeMultiplier > 0) {
    const primaryWeapon = getPrimaryWeapon(unitData as UnifiedVariation);
    charge_bonus = (primaryWeapon?.damage ?? 0) * chargeMultiplier;
    charge_bonus_mult = 1.5;
  }
  charge_bonus += chargeChange ?? 0;


  if (baseId === 'demilancer') {
    switch (age) {
      case 2: return 4 + charge_bonus;
      case 3: return 5 + charge_bonus;
      case 4: return 14 + charge_bonus;
      default: return charge_bonus;
    }
  }

  if (baseId === 'torguud') {
    switch (age) {
      case 2: return 5 + charge_bonus;
      case 3: return 7 + charge_bonus;
      case 4: return 9 + charge_bonus;
      default: return charge_bonus;
    }
  }

  if (baseId === 'batu-khan') {
    switch (age) {
      case 2: return 10 + charge_bonus;
      case 3: return 12 + charge_bonus;
      case 4: return 12 + charge_bonus;
      default: return charge_bonus;
    }
  }

  if (baseId === 'keshik') {
    switch (age) {
      case 2: return 8 + charge_bonus;
      case 3: return 10 + charge_bonus;
      case 4: return 12 + charge_bonus;
      default: return charge_bonus;
    }
  }

  if (baseId === 'chevalier-confrere') {
    switch (age) {
      case 2: return 7 * charge_bonus_mult + charge_bonus;
      case 3: return 9 * charge_bonus_mult + charge_bonus;
      case 4: return 11 * charge_bonus_mult + charge_bonus;
      default: return charge_bonus;
    }
  }
  if (baseId === "szlachta-cavalry") {
    return 15 * charge_bonus_mult + charge_bonus;
  }

  if (baseId === "iron-pagoda") {
    switch (age) {
      case 2: return 8 * charge_bonus_mult + charge_bonus;
      case 3: return 10 * charge_bonus_mult + charge_bonus;
      case 4: return 12 * charge_bonus_mult + charge_bonus;
    }
  }

  if (baseId === "meng-an-mouke-defender") {
    switch (age) {
      case 3: return 10 * charge_bonus_mult + charge_bonus;
      case 4: return 5 * charge_bonus_mult + charge_bonus;
    }
  }

  if (baseId === 'daimyo') {
    switch (age) {
      case 2: return 6 * charge_bonus_mult + charge_bonus;
      case 3: return 14 * charge_bonus_mult + charge_bonus;
      case 4: return 15 * charge_bonus_mult + charge_bonus;
    }
  }


  if (baseId === 'ghulam' || unitClasses.some(c => c.toLowerCase() === 'merc_ghulam')) {
    switch (age) {
      case 3: return 5 + charge_bonus;
      case 4: return 6 + charge_bonus;
      default: return charge_bonus;
    }
  }

  if (baseId === 'fire-lancer') {
    return 4 + charge_bonus;
  }

  // chargeMultiplier: bonus = % of unit's primary melee damage (e.g. Burgrave Palace: ×0.5)

  // If basic knight
  if (isKnight) {
    switch (age) {
      case 2: return 10 * charge_bonus_mult + charge_bonus;
      case 3: return 12 * charge_bonus_mult + charge_bonus;
      case 4: return 14 * charge_bonus_mult + charge_bonus;
      default: return charge_bonus;
    }
  }

  return charge_bonus;
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
  const [multiUnitModelKey, setMultiUnitModelKey] = useState<'aggregated' | 'focusFire' | 'focusFireBatchesMC'>('focusFire');
  const [allowKiting, setAllowKiting] = useState<boolean>(false);
  const [startDistancePreset, setStartDistancePreset] = useState<string>("max");
  const [customDistance, setCustomDistance] = useState<number>(5);

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

  const maxRangeDistance = Math.max(modifiedStats1.maxRange || 0, modifiedStats2.maxRange || 0);
  const startDistance = startDistancePreset === "max" ? maxRangeDistance
    : Math.max(0, Math.min(30, customDistance));

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
    <div className="h-screen overflow-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-w-[1080px] max-w-6xl mx-auto relative"
      >
        <div className="relative text-center mb-8 space-y-4">
          <GuidedTour
            setSelectedCiv1={setSelectedCiv1} setUnit1={setUnit1}
            setSelectedAge1={setSelectedAge1} applyFullUpgrade1={applyFullUpgrade1} toggleAbility1={toggleAbility1}
            setSelectedCiv2={setSelectedCiv2} setUnit2={setUnit2}
            setSelectedAge2={setSelectedAge2} applyFullUpgrade2={applyFullUpgrade2} toggleAbility2={toggleAbility2}
            setIsVersus={setIsVersus} setAtEqualCost={setAtEqualCost} setAllowKiting={setAllowKiting}
            setMultiUnitModelKey={setMultiUnitModelKey}
          />
          <div>
            <h1 className="text-4xl font-serif font-bold text-primary mb-2">Sandbox Mode</h1>
            <p className="text-muted-foreground text-lg">Compare any two units from any civilizations!</p>
          </div>
          {/* Mode Toggle */}
          <div className="flex items-center justify-center gap-4">
            <div id="tour-mode-toggle" className="inline-flex rounded-md border border-border overflow-hidden">
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
              <div id="tour-versus-options" className="inline-flex items-center gap-3">
                {(atEqualCost || allowKiting) && (
                  <div id="tour-model" className="inline-flex items-center rounded-md border border-border overflow-hidden bg-card">
                    <span className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-r border-border">
                      Model
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
                {(() => {
                  const effectiveCost1 = modifiedVariation1 ? getTotalCost(modifiedVariation1) : (stats1?.cost ?? 0);
                  const effectiveCost2 = modifiedVariation2 ? getTotalCost(modifiedVariation2) : (stats2?.cost ?? 0);
                  const sameCost = unit1 && unit2 && effectiveCost1 > 0 && effectiveCost2 > 0 && effectiveCost1 === effectiveCost2;
                  const zeroCost = (!!unit1 && effectiveCost1 === 0) || (!!unit2 && effectiveCost2 === 0);
                  const isEqualCostDisabled = !!sameCost || zeroCost;
                  const disabledTitle = sameCost ? 'Units have the same cost' : zeroCost ? 'A unit has no cost' : undefined;
                  return (
                    <div
                      id="tour-atEqualCost"
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-card ${isEqualCostDisabled ? 'opacity-50' : ''}`}
                      title={disabledTitle}
                    >
                      <input
                        type="checkbox"
                        id="atEqualCost"
                        checked={atEqualCost}
                        onChange={(e) => { if (!isEqualCostDisabled) { setAtEqualCost(e.target.checked); } }}
                        disabled={isEqualCostDisabled}
                        className="w-4 h-4 rounded border-border disabled:cursor-not-allowed"
                      />
                      <label htmlFor="atEqualCost" className={`text-sm font-medium ${isEqualCostDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                        At Equal Cost
                      </label>
                    </div>
                  );
                })()}
                <div id="tour-kiting" className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-card">
                  <input
                    type="checkbox"
                    id="allowKiting"
                    checked={allowKiting}
                    onChange={(e) => { setAllowKiting(e.target.checked); }}
                    className="w-4 h-4 rounded border-border"
                  />
                  <label htmlFor="allowKiting" className="text-sm font-medium cursor-pointer">
                    Allow Kiting
                  </label>
                </div>
                {allowKiting && (
                  <div className="inline-flex items-center rounded-md border border-border overflow-hidden bg-card">
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
            <Select value={selectedCiv1} onValueChange={setSelectedCiv1}>
              <SelectTrigger className="bg-secondary border-border h-14">
                <SelectValue>
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
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-popover border-border max-h-[400px]">
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
            </div>

            <div id="tour-unit1" className="w-full">
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
                      })() : isOpen && categoryKey === 'khaganate' ? (() => {
                        const grouped: Record<string, typeof units> = {};
                        for (const u of units) {
                          const sub = getKhaganateSubCategory(u);
                          if (!grouped[sub]) grouped[sub] = [];
                          grouped[sub].push(u);
                        }
                        return KHAGANATE_SUB_ORDER.filter(sub => grouped[sub]?.length).map(sub => (
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
            <Select value={selectedCiv2} onValueChange={setSelectedCiv2}>
              <SelectTrigger className="bg-secondary border-border h-14">
                <SelectValue>
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
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-popover border-border max-h-[400px]">
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
            </div>

            <div id="tour-unit2" className="w-full">
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
                      })() : isOpen && categoryKey === 'khaganate' ? (() => {
                        const grouped: Record<string, typeof units> = {};
                        for (const u of units) {
                          const sub = getKhaganateSubCategory(u);
                          if (!grouped[sub]) grouped[sub] = [];
                          grouped[sub].push(u);
                        }
                        return KHAGANATE_SUB_ORDER.filter(sub => grouped[sub]?.length).map(sub => (
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
                      maxHpBonusFraction={modifiedStats1.maxHpBonusFraction ?? 0}
                      opponentArmorPenetration={modifiedStats2.armorPenetration ?? 0}
                      opponentAttackSpeedDebuff={modifiedStats2.opponentAttackSpeedDebuff ?? 0}
                      opponentVersusDebuff={(modifiedStats2.versusOpponentDamageDebuff ?? 1) * getVersusDebuffMultiplier(variation1?.classes || unit1?.classes || [], [...activeAbilities2], [...activeTechnologies2], variation2?.baseId || unit2?.id)}
                      opponentBonusDamageReduction={modifiedStats2.bonusDamageReduction ?? 0}
                      opponentClasses={variation2?.classes || unit2?.classes || []}
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
                      maxHpBonusFraction={modifiedStats2.maxHpBonusFraction ?? 0}
                      opponentArmorPenetration={modifiedStats1.armorPenetration ?? 0}
                      opponentAttackSpeedDebuff={modifiedStats1.opponentAttackSpeedDebuff ?? 0}
                      opponentVersusDebuff={(modifiedStats1.versusOpponentDamageDebuff ?? 1) * getVersusDebuffMultiplier(variation2?.classes || unit2?.classes || [], [...activeAbilities1], [...activeTechnologies1], variation1?.baseId || unit1?.id)}
                      opponentBonusDamageReduction={modifiedStats1.bonusDamageReduction ?? 0}
                      opponentClasses={variation1?.classes || unit1?.classes || []}
                    />
                  </div>
                  <div className="flex flex-row flex-wrap sm:flex-col gap-2 sm:gap-3 sm:flex-shrink-0 order-1 sm:order-2">
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
              const charge1 = getChargeBonus(data1, activeAbilities1, selectedAge1, activeTechnologies1, modifiedStats1.chargeMultiplier, modifiedStats1.meleeAttack, abilityCounters1, modifiedStats1.rangedAttack, modifiedStats1.chargeChange);
              const charge2 = getChargeBonus(data2, activeAbilities2, selectedAge2, activeTechnologies2, modifiedStats2.chargeMultiplier, modifiedStats2.meleeAttack, abilityCounters2, modifiedStats2.rangedAttack, modifiedStats2.chargeChange);

              const noTimerData1 = modifiedVariation1NoTimer || modifiedUnit1NoTimer;
              const noTimerData2 = modifiedVariation2NoTimer || modifiedUnit2NoTimer;

              const cost1 = modifiedVariation1 ? getTotalCost(modifiedVariation1) : (stats1?.cost ?? 0);
              const cost2 = modifiedVariation2 ? getTotalCost(modifiedVariation2) : (stats2?.cost ?? 0);

              if (atEqualCost && cost1 > 0 && cost2 > 0) {
                const unit1 = modifiedVariation1 || modifiedUnit1!;
                const unit2 = modifiedVariation2 || modifiedUnit2!;
                if (allowKiting && multiUnitModelKey === 'focusFire') {
                  const result = computeVersusAtEqualCostKitingFocusFire(
                    unit1, unit2, abilitiesArray1, abilitiesArray2, charge1, charge2, startDistance,
                  );
                  versusData = result;
                  multipliers = result.multipliers;
                } else if (allowKiting && multiUnitModelKey === 'focusFireBatchesMC') {
                  const result = computeVersusAtEqualCostKitingBatchesMC(
                    unit1, unit2, abilitiesArray1, abilitiesArray2, charge1, charge2, startDistance,
                  );
                  versusData = result;
                  multipliers = result.multipliers;
                } else {
                  const isRanged1 = getPrimaryWeapon(unit1)?.type === 'ranged';
                  const isRanged2 = getPrimaryWeapon(unit2)?.type === 'ranged';
                  const multiUnitModel: MultiUnitModel =
                    multiUnitModelKey === 'focusFire' ? (isRanged1 !== isRanged2 ? focusFireAsymmetricModel : focusFireModel) :
                      multiUnitModelKey === 'focusFireBatchesMC' ? (isRanged1 !== isRanged2 ? focusFireBatchesMCAsymmetricModel : focusFireBatchesMCModel) :
                        aggregatedDPSModel;
                  const result = computeVersusAtEqualCost(
                    unit1, unit2, abilitiesArray1, abilitiesArray2, charge1, charge2,
                    allowKiting, startDistance, multiUnitModel,
                  );
                  versusData = result;
                  multipliers = result.multipliers;
                }
              } else {
                if (allowKiting && multiUnitModelKey === 'focusFire') {
                  versusData = computeVersusKitingFocusFire(
                    modifiedVariation1 || modifiedUnit1!,
                    modifiedVariation2 || modifiedUnit2!,
                    abilitiesArray1,
                    abilitiesArray2,
                    charge1,
                    charge2,
                    startDistance,
                  );
                } else if (allowKiting && multiUnitModelKey === 'focusFireBatchesMC') {
                  versusData = computeVersusKitingBatchesMC(
                    modifiedVariation1 || modifiedUnit1!,
                    modifiedVariation2 || modifiedUnit2!,
                    abilitiesArray1,
                    abilitiesArray2,
                    charge1,
                    charge2,
                    startDistance,
                  );
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
                    timedDuration1,
                    timedDuration2,
                  );
                }
              }

              // For delta display: also compute without duration correction when a timed ability is active
              const hasActiveDuration = !atEqualCost && (!!timedDuration1 || !!timedDuration2);
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
              let loserUnitsToWin: number | undefined;
              if (!atEqualCost && versusData.winner !== 'draw') {
                loserUnitsToWin = computeLoserUnitsToWin(
                  versusData,
                  modifiedVariation1 || modifiedUnit1!,
                  modifiedVariation2 || modifiedUnit2!,
                );
              }

              const leftMetrics = {
                dps: versusData.attacker.dps,
                dpsPerCost: versusData.attacker.dpsPerCost,
                hitsToKill: versusData.attacker.hitsToKill,
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
                loserUnitsToWin: (!leftIsWinner && !isDraw) ? loserUnitsToWin : undefined,
                opponentName: versusData.defender.name,
              };
              const rightMetrics = {
                dps: versusData.defender.dps,
                dpsPerCost: versusData.defender.dpsPerCost,
                hitsToKill: versusData.defender.hitsToKill,
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
                loserUnitsToWin: (!rightIsWinner && !isDraw) ? loserUnitsToWin : undefined,
                opponentName: versusData.attacker.name,
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
                      <div className="flex-1 min-w-0">
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
                          maxHpBonusFraction={modifiedStats2.maxHpBonusFraction ?? 0}
                          opponentArmorPenetration={modifiedStats1.armorPenetration ?? 0}
                          opponentAttackSpeedDebuff={modifiedStats1.opponentAttackSpeedDebuff ?? 0}
                          opponentVersusDebuff={(modifiedStats1.versusOpponentDamageDebuff ?? 1) * getVersusDebuffMultiplier(unit2?.classes || [], [...activeAbilities1], [...activeTechnologies1], unit1?.id)}
                          opponentBonusDamageReduction={modifiedStats1.bonusDamageReduction ?? 0}
                          opponentClasses={modifiedVariation1?.classes || unit1?.classes || []}
                        />
                      </div>
                      <div className="flex flex-row flex-wrap sm:flex-col gap-2 sm:gap-3 sm:flex-shrink-0 order-1 sm:order-2">
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
                    </div>
                  </motion.div>
                  {versusDataOriginal && (
                    <div className="col-span-2 flex flex-wrap justify-center gap-4 mt-2 text-xs text-muted-foreground">
                      {versusDataOriginal.attacker.timeToKill !== versusData.attacker.timeToKill && (
                        <span className="text-orange-400">
                          Civ 1 TTK: {versusDataOriginal.attacker.timeToKill}s → {versusData.attacker.timeToKill}s ({timedDuration1 ?? timedDuration2}s ability)
                        </span>
                      )}
                      {versusDataOriginal.defender.timeToKill !== versusData.defender.timeToKill && (
                        <span className="text-orange-400">
                          Civ 2 TTK: {versusDataOriginal.defender.timeToKill}s → {versusData.defender.timeToKill}s ({timedDuration2 ?? timedDuration1}s ability)
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
