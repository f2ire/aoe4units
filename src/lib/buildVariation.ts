/* eslint-disable @typescript-eslint/no-explicit-any */
import { getPrimaryWeapon } from "@/data/unified-units";
import type { AoE4Unit, UnifiedVariation } from "@/data/unified-units";

// Age-aware charge / special-strike bonus damage for a unit. Extracted verbatim
// from Sandbox so the Sandbox cards, the unit pages and the Twitch extension all
// compute charge identically (per-unit charge overrides live here, not in ability data).
export const getChargeBonus = (unitData: AoE4Unit | UnifiedVariation | undefined, activeAbilities: Set<string>, age: number, activeTechnologies: Set<string> = new Set(), chargeMultiplier?: number, modifiedMeleeAttack?: number, abilityCounters?: Map<string, number>, modifiedRangedAttack?: number, chargeChange?: number): number => {
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


  if (activeAbilities.has('ability-trample') && baseId === 'cataphract') return 10;

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

// Filters bonusDamage entries by weapon type — prevents ranged bonuses from
// applying to melee weapons and vice-versa. (Mirrors Sandbox.filterBonusForWeapon.)
export function filterBonusForWeapon(bonusDamage: any[], weaponType: string) {
  return weaponType === "melee"
    ? bonusDamage.filter((b: any) => b.property !== "rangedAttack")
    : bonusDamage.filter((b: any) => b.property !== "meleeAttack");
}

// HP-burst on the charge hit for specific unit/tech combos (Earl's Guard).
export function getChargeBonusBurst(
  unitData: any,
  activeTechnologies: Set<string> = new Set(),
): number {
  if (!unitData) return 1;
  const baseId = "baseId" in unitData ? unitData.baseId : unitData.id;
  if (baseId === "earls-guard" && activeTechnologies.has("throwing-dagger-drills")) return 2;
  return 1;
}

export interface BuildVariationCtx {
  baseId: string;
  activeTechnologies: Set<string>;
  activeAbilities: Set<string>;
  abilityCounters?: Map<string, number>;
  selectedAge: number;
  secondaryWeapons: any[];
  // versus / comparative blocks apply cost multipliers; equal-cost blocks do not.
  applyCostMultiplier: boolean;
}

/**
 * Assembles a combat-ready variation object from a source unit/variation and its
 * computed `modifiedStats`. Extracted verbatim from Sandbox's modifiedVariation /
 * modifiedUnit IIFEs so the same logic feeds the Sandbox cards and the unit pages.
 */
export function buildModifiedVariation(source: any, stats: any, ctx: BuildVariationCtx) {
  const {
    baseId,
    activeTechnologies,
    activeAbilities,
    abilityCounters,
    selectedAge,
    secondaryWeapons,
    applyCostMultiplier,
  } = ctx;

  return {
    ...source,
    hitpoints: stats.hitpoints,
    weapons: source.weapons.map((weapon: any) => ({
      ...weapon,
      damage:
        weapon.type === "melee"
          ? stats.meleeAttack
          : weapon.type === "siege"
            ? stats.siegeAttack ?? stats.rangedAttack
            : stats.rangedAttack,
      speed: stats.attackSpeed,
      range: weapon.range ? { ...weapon.range, max: stats.maxRange || weapon.range.max } : undefined,
      modifiers: filterBonusForWeapon(stats.bonusDamage || [], weapon.type),
      burst: stats.burst
        ? { count: stats.burst, decay: stats.burstDecay ?? weapon.burst?.decay }
        : weapon.burst,
    })),
    armor: [
      { type: "melee", value: stats.meleeArmor },
      { type: "ranged", value: stats.rangedArmor },
    ],
    resistance: [
      ...(source.resistance || []).filter(
        (r: { type: string }) => r.type !== "ranged" && r.type !== "melee" && r.type !== "siege",
      ),
      ...((stats.rangedResistance ?? 0) > 0 ? [{ type: "ranged", value: stats.rangedResistance! }] : []),
      ...((stats.meleeResistance ?? 0) !== 0 ? [{ type: "melee", value: stats.meleeResistance! }] : []),
      ...((stats.siegeResistance ?? 0) !== 0 ? [{ type: "siege", value: stats.siegeResistance! }] : []),
    ],
    costs:
      applyCostMultiplier &&
      ((stats.costMultiplier != null && stats.costMultiplier !== 1.0) ||
        (stats.stoneCostMultiplier != null && stats.stoneCostMultiplier !== 1.0) ||
        (stats.foodCostMultiplier != null && stats.foodCostMultiplier !== 1.0) ||
        (stats.goldCostMultiplier != null && stats.goldCostMultiplier !== 1.0))
        ? {
            ...source.costs,
            food: Math.round(
              (source.costs.food || 0) * (stats.costMultiplier ?? 1) * (stats.foodCostMultiplier ?? 1),
            ),
            wood: Math.round((source.costs.wood || 0) * (stats.costMultiplier ?? 1)),
            gold: Math.round(
              (source.costs.gold || 0) * (stats.costMultiplier ?? 1) * (stats.goldCostMultiplier ?? 1),
            ),
            stone: Math.round(
              (source.costs.stone || 0) * (stats.costMultiplier ?? 1) * (stats.stoneCostMultiplier ?? 1),
            ),
            oliveoil: Math.round((source.costs.oliveoil || 0) * (stats.costMultiplier ?? 1)),
          }
        : source.costs,
    movement: source.movement ? { ...source.movement, speed: stats.moveSpeed } : undefined,
    healingRate: stats.healingRate ?? 0,
    healingRatePerSecond: stats.healingRatePerSecond ?? 0,
    armorPenetration: stats.armorPenetration ?? 0,
    opponentAttackSpeedDebuff: stats.opponentAttackSpeedDebuff ?? 0,
    versusOpponentDamageDebuff: stats.versusOpponentDamageDebuff ?? 1,
    opponentHealingRateDebuff: stats.opponentHealingRateDebuff ?? 0,
    bonusDamageReduction: stats.bonusDamageReduction ?? 0,
    maxHpBonusFraction: stats.maxHpBonusFraction ?? 0,
    hpStartFraction: stats.hpStartFraction ?? 1,
    dpsVsMeleeASCoeff: stats.dpsVsMeleeASCoeff ?? 0,
    postChargeMeleeBonus: stats.postChargeMeleeBonus ?? 0,
    _activeTechs: [...activeTechnologies],
    firstHitBlocked:
      activeAbilities.has("ability-deflective-armor") ||
      activeAbilities.has("ability-deflective-armor-sen"),
    chargeBonusBurst: getChargeBonusBurst(source, activeTechnologies),
    chargeArmorType:
      baseId === "earls-guard"
        ? ("ranged" as const)
        : baseId === "donso" && activeAbilities.has("javelin-throw")
          ? ("ranged" as const)
          : baseId === "naginata-samurai" && activeTechnologies.has("samurai-bow")
            ? ("ranged" as const)
            : ["jeanne-darc-woman-at-arms", "jeanne-darc-knight", "jeanne-darc-blast-cannon"].includes(
                  baseId,
                ) && (abilityCounters?.get("ability-holy-wrath") ?? 0) > 0
              ? ("none" as const)
              : ["jeanne-darc-hunter", "jeanne-darc-mounted-archer", "jeanne-darc-markswoman"].includes(
                    baseId,
                  ) && (abilityCounters?.get("ability-divine-arrow") ?? 0) > 0
                ? ("none" as const)
                : ["musofadi-warrior", "musofadi-gunner"].includes(baseId) &&
                    activeAbilities.has("ability-first-strike")
                  ? ("first-strike" as const)
                  : undefined,
    chargeModifiers:
      baseId === "donso" && activeAbilities.has("javelin-throw")
        ? [
            {
              target: { class: [["cavalry"]] },
              value: selectedAge >= 4 ? 10 : selectedAge === 3 ? 8 : selectedAge === 2 ? 7 : 5,
            },
          ]
        : baseId === "naginata-samurai" && activeTechnologies.has("samurai-bow")
          ? [
              {
                target: { class: [["light", "melee", "infantry"]] },
                value: selectedAge >= 4 ? 7 : selectedAge >= 3 ? 6 : selectedAge >= 2 ? 5 : 4,
              },
            ]
          : undefined,
    secondaryWeapons: (() => {
      const primaryWeapon = getPrimaryWeapon(source);
      const primaryBaseDamage = primaryWeapon?.damage || 0;
      const meleeAttackDelta = stats.meleeAttack - primaryBaseDamage;
      const isPrimaryRanged = primaryWeapon?.type === "ranged" || primaryWeapon?.type === "siege";
      const rangedBase = isPrimaryRanged
        ? primaryBaseDamage
        : secondaryWeapons.find((sw: any) => sw.type === "ranged" || sw.type === "siege")?.damage || 0;
      const rangedMultiplier = stats.rangedAttackMultiplier ?? 1;
      const rangedFlatDelta = stats.rangedAttack / rangedMultiplier - rangedBase;
      return secondaryWeapons.map((w: any) => ({
        ...w,
        speed:
          (stats.secondaryWeaponAttackSpeedMultiplier ?? 1) !== 1
            ? (w.speed || 0) * stats.secondaryWeaponAttackSpeedMultiplier!
            : w.speed,
        damage: (() => {
          const raw =
            w.type === "ranged" || w.type === "siege"
              ? w.damageMultiplier != null
                ? (rangedBase * w.damageMultiplier + rangedFlatDelta) * rangedMultiplier
                : w.injectedWeapon
                  ? w.damage
                  : stats.rangedAttack
              : w.damage + meleeAttackDelta;
          return w.maxDamage != null ? Math.min(raw, w.maxDamage) : raw;
        })(),
        modifiers:
          w.type === "ranged" || w.type === "siege"
            ? w.injectedWeapon && w.damageMultiplier == null
              ? w.modifiers || []
              : filterBonusForWeapon(stats.bonusDamage || [], w.type).filter((m: any) => !m.chargeBonusLabel)
            : [
                ...(w.modifiers || []),
                ...filterBonusForWeapon(stats.bonusDamage || [], "melee").filter((b: any) => !b.fromWeapon),
              ],
      }));
    })(),
  };
}
