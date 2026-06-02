import { AoE4Unit, UnifiedVariation, UnifiedWeapon, UnifiedArmor, UnifiedResistance, getArmorValue, getResistanceValue } from "@/data/unified-units";
import { allAbilities } from "@/data/unified-abilities";
import { allTechnologies } from "@/data/unified-technologies";

// Unified type to accept unit or modified variation
export interface CombatEntity {
  id: string;
  name: string;
  hitpoints: number;
  weapons: UnifiedWeapon[];
  armor?: UnifiedArmor[];
  resistance?: UnifiedResistance[];
  costs: {
    food: number;
    wood: number;
    gold: number;
    stone: number;
    oliveoil?: number;
  };
  classes: string[];
  activeAbilities?: string[]; // IDs of active abilities
  activeTechs?: string[];     // IDs of active technologies (for class-conditional debuffs)
  baseId?: string;            // Base unit ID for select.id matching in tech effects
  moveSpeed: number; // tiles/s (movement.speed from unit data)
  healingRate?: number; // HP healed per hit the unit lands (e.g. Keshik: 3 HP/hit)
  healingRatePerSecond?: number; // HP healed per second (e.g. Triumph: 2 HP/s)
  armorPenetration?: number; // Enemy armor reduced by this amount on each hit (clamped ≥ 0)
  opponentAttackSpeedDebuff?: number; // Opponent's attack interval multiplied by (1 + value), e.g. 0.20 = 20% slower
  versusOpponentDamageDebuff?: number; // Multiplier on damage dealt by attackers (e.g. 0.8 = −20%); default 1
  opponentHealingRateDebuff?: number; // HP/s subtracted from opponent's healingRatePerSecond
  bonusDamageReduction?: number;      // Fraction [0,1] — incoming attacker bonus damage × (1 − value), clamped to [0,1]
  chargeBonusBurst?: number; // Burst count for first-hit bonus display (e.g. 2 daggers for Earl's Guard)
  chargeArmorType?: 'ranged' | 'none' | 'first-strike'; // 'ranged': charge uses ranged armor (dagger); 'none': charge ignores armor+resistance entirely (holy wrath); 'first-strike': label only, normal melee damage path
  continuousMovement?: boolean; // unit can move throughout entire attack cycle (e.g. Mangudai)
  selfDestructs?: boolean; // unit self-destructs on first hit — if hitsToKill > 1, it can never kill
  secondaryWeapons?: UnifiedWeapon[]; // additional weapons fired simultaneously (e.g. thunderclap-bombs)
  firstHitBlocked?: boolean; // defender absorbs first attack completely (0 damage, charge also nullified)
  postChargeMeleeBonus?: number; // melee attack bonus active from hit 2 onward only — subtracted from hit 1 (charge hit)
  chargeModifiers?: Array<{ target: { class: string[][] }; value: number }>; // class-specific bonus damage applied to the dagger/javelin hit (before ranged armor)
  maxHpBonusFraction?: number; // Bonus damage per hit = fraction × defender's max HP (bypasses armor/resistance)
  hpStartFraction?: number;    // Fraction of max HP the unit starts combat with (default 1; e.g. 0.9 = starts at 90% HP)
  dpsVsMeleeASCoeff?: number;  // Bonus DPS vs melee attackers = coeff / attacker.attackSpeed (bypasses armor)
}

export interface VersusMetrics {
  id: string;
  name: string;
  dps: number | null;
  dpsPerCost: number | null;
  hitsToKill: number | null;
  timeToKill: number | null; // seconds, rounded for display
  timeToKillExact?: number | null; // unrounded — used for HP-remaining calculation to avoid discrete-hit rounding artifacts
  effectiveDamagePerHit: number | null;
  firstHitDamage?: number; // per-unit first-hit damage (includes charge bonus); omitted when equal to effectiveDamagePerHit
  bugAttackSpeed: boolean;
  cannotAttackUnits: boolean; // e.g. ram — attacks buildings only
  formula: string; // detailed description for tooltip
  dpsContact?: number; // DPS only active during contact (e.g. thorns from dpsVsMeleeASCoeff) — used by kiting to separate pre-contact vs contact phases
  approachShots?: number; // free shots fired by ranged unit during melee approach phase (not included in hitsToKill)
}

export interface VersusResult {
  attacker: VersusMetrics;
  defender: VersusMetrics; // metrics of B vs A
  winner: "draw" | "attacker" | "defender";
  winnerHpRemaining?: number;
  winnerUnitsRemaining?: number;
  resourceDifference?: number;
  mcDistribution?: MCDistribution;
}

export interface MCOutcomeStats {
  unitsMedian: number;
  unitsStd: number;
  hpMedian: number;
  hpStd: number;
  resourceMedian: number;
  resourceStd: number;
}

export interface MCDistribution {
  winRateA: number;
  winRateB: number;
  drawRate: number;
  iterations: number;
  durationMin?: number;
  durationMax?: number;
  whenAWins?: MCOutcomeStats;
  whenBWins?: MCOutcomeStats;
}

export interface MultiUnitModel {
  resolve(
    A: CombatEntity,
    B: CombatEntity,
    metricsA: VersusMetrics,
    metricsB: VersusMetrics,
    multipliers: { multA: number; multB: number; totalCostA: number; totalCostB: number },
  ): Pick<VersusResult, 'winner' | 'winnerHpRemaining' | 'winnerUnitsRemaining' | 'resourceDifference' | 'mcDistribution'>
}

function toCombatEntity(source: AoE4Unit | UnifiedVariation, activeAbilities?: string[]): CombatEntity {
  return {
    id: source.id,
    name: source.name,
    hitpoints: source.hitpoints,
    weapons: source.weapons || [],
    armor: source.armor || [],
    resistance: source.resistance,
    costs: source.costs,
    classes: source.classes || [],
    activeAbilities: activeAbilities || [],
    activeTechs: (source as any)._activeTechs || [],
    baseId: (source as any).baseId || source.id,
    moveSpeed: source.movement?.speed ?? 0,
    healingRate: (source as any).healingRate ?? 0, // eslint-disable-line @typescript-eslint/no-explicit-any
    healingRatePerSecond: (source as any).healingRatePerSecond ?? 0, // eslint-disable-line @typescript-eslint/no-explicit-any
    armorPenetration: (source as any).armorPenetration ?? 0, // eslint-disable-line @typescript-eslint/no-explicit-any
    opponentAttackSpeedDebuff: (source as any).opponentAttackSpeedDebuff ?? 0, // eslint-disable-line @typescript-eslint/no-explicit-any
    versusOpponentDamageDebuff: (source as any).versusOpponentDamageDebuff ?? 1, // eslint-disable-line @typescript-eslint/no-explicit-any
    opponentHealingRateDebuff: (source as any).opponentHealingRateDebuff ?? 0, // eslint-disable-line @typescript-eslint/no-explicit-any
    bonusDamageReduction: (source as any).bonusDamageReduction ?? 0, // eslint-disable-line @typescript-eslint/no-explicit-any
    chargeBonusBurst: (source as any).chargeBonusBurst ?? 1, // eslint-disable-line @typescript-eslint/no-explicit-any
    chargeArmorType: (source as any).chargeArmorType, // eslint-disable-line @typescript-eslint/no-explicit-any
    continuousMovement: (source as any).continuousMovement ?? false, // eslint-disable-line @typescript-eslint/no-explicit-any
    selfDestructs: (source as any).selfDestructs ?? false, // eslint-disable-line @typescript-eslint/no-explicit-any
    secondaryWeapons: (source as any).secondaryWeapons ?? [], // eslint-disable-line @typescript-eslint/no-explicit-any
    firstHitBlocked: (source as any).firstHitBlocked ?? false, // eslint-disable-line @typescript-eslint/no-explicit-any
    postChargeMeleeBonus: (source as any).postChargeMeleeBonus ?? 0, // eslint-disable-line @typescript-eslint/no-explicit-any
    chargeModifiers: (source as any).chargeModifiers, // eslint-disable-line @typescript-eslint/no-explicit-any
    maxHpBonusFraction: (source as any).maxHpBonusFraction ?? 0, // eslint-disable-line @typescript-eslint/no-explicit-any
    hpStartFraction: (source as any).hpStartFraction ?? 1, // eslint-disable-line @typescript-eslint/no-explicit-any
    dpsVsMeleeASCoeff: (source as any).dpsVsMeleeASCoeff ?? 0, // eslint-disable-line @typescript-eslint/no-explicit-any
  };
}

function totalCost(entity: CombatEntity): number {
  const c = entity.costs;
  return c.food + c.wood + c.gold + c.stone + (c.oliveoil || 0);
}

const ARCHER_TRAVEL_TIME = 0.67;

// Determines whether the entity is gunpowder (ignores ranged armor when firing)
function isGunpowder(entity: CombatEntity, weapon?: UnifiedWeapon): boolean {
  if (!weapon) return false;
  return entity.classes.some(c => c.toLowerCase().includes("gunpowder"));
}

function isArcher(entity: CombatEntity): boolean {
  return entity.classes.some(c => c.toLowerCase() === "archer");
}

// Determines whether armor should be ignored (siege, gunpowder, or weapon.type === 'siege')
function shouldIgnoreArmor(attacker: CombatEntity, weapon?: UnifiedWeapon): boolean {
  if (!weapon) return false;
  if (weapon.type === "siege") return true;
  // Common siege classes
  const siegeClasses = ["siege", "siege_range", "siege_tower", "ram", "catapult", "trebuchet_counterweight"];
  if (attacker.classes.some(c => siegeClasses.includes(c.toLowerCase()))) return true;
  return false;
}

// Computes the versus debuff multiplier applied by the defender's abilities/techs on the attacker
export function getVersusDebuffMultiplier(attackerClasses: string[], defenderAbilities: string[], defenderTechs?: string[], defenderBaseId?: string): number {
  if ((!defenderAbilities || defenderAbilities.length === 0) && (!defenderTechs || defenderTechs.length === 0)) return 1.0;

  let multiplier = 1.0;
  const attackerClassesLower = attackerClasses.map(c => c.toLowerCase());

  function applyClassDebuff(effects: any[]) {
    for (const effect of effects) {
      if (effect.property !== 'versusOpponentDamageDebuff') continue;
      if (effect.effect !== 'multiply') continue;
      const raw = effect.attackerClass ?? effect.select?.class;
      if (!raw) continue;

      const groups: string[][] = Array.isArray(raw) && raw.some((v: any) => Array.isArray(v))
        ? raw
        : [raw];

      const matches = groups.some((group: string[]) => {
        if (!Array.isArray(group)) return false;
        return group.every(req => attackerClassesLower.includes(req.toLowerCase()));
      });

      if (matches) {
        multiplier *= effect.value;
      }
    }
  }

  // Ability-based debuffs
  for (const abilityId of defenderAbilities) {
    const ability = allAbilities.find(a => a.id === abilityId);
    if (!ability || !ability.effects) continue;
    applyClassDebuff(ability.effects);
  }

  // Tech-based class-conditional debuffs (attackerClass path)
  if (defenderTechs && defenderTechs.length > 0) {
    for (const techId of defenderTechs) {
      const tech = allTechnologies.find(t => t.id === techId);
      if (!tech || !tech.effects) continue;

      for (const effect of tech.effects as any[]) {
        if (effect.property !== 'versusOpponentDamageDebuff') continue;
        if (effect.effect !== 'multiply') continue;
        if (!effect.attackerClass) continue;

        // When select.id is present, verify the defender unit matches
        if (effect.select?.id && defenderBaseId) {
          if (!effect.select.id.some((id: string) => id.toLowerCase() === defenderBaseId.toLowerCase())) continue;
        }

        // When requiredTech is present, the effect only fires if that tech is also active
        if (effect.requiredTech && !defenderTechs.includes(effect.requiredTech)) continue;

        const groups: string[][] = Array.isArray(effect.attackerClass) && effect.attackerClass.some((v: any) => Array.isArray(v))
          ? effect.attackerClass
          : [effect.attackerClass];

        const matches = groups.some((group: string[]) => {
          if (!Array.isArray(group)) return false;
          return group.every((req: string) => attackerClassesLower.includes(req.toLowerCase()));
        });

        if (matches) {
          multiplier *= effect.value;
        }
      }
    }
  }

  return multiplier;
}

// Computes the effective damage per hit from attacker to defender
function computeEffectiveDamage(attacker: CombatEntity, defender: CombatEntity, chargeBonus: number = 0, isFirstAttack: boolean = false, weaponOverride?: UnifiedWeapon): { value: number; base: number; bonus: number; armorApplied: number; weapon?: UnifiedWeapon; debuffMultiplier?: number; cannotAttack?: boolean; resistanceApplied?: number } {
  // Ram (and similar units): can only attack buildings
  const RAM_CLASSES = ["ram", "workshop_ram"];
  if (attacker.classes.some(c => RAM_CLASSES.includes(c.toLowerCase()))) {
    return { value: 0, base: 0, bonus: 0, armorApplied: 0, cannotAttack: true };
  }

  // On the first attack, use the charge weapon if the unit has one AND charge ability is active
  const hasChargeAbility = attacker.activeAbilities?.includes('charge-attack') ?? false;
  const chargeWeapon = (!weaponOverride && isFirstAttack && hasChargeAbility) ? getChargeWeapon(attacker) : undefined;
  const weapon = weaponOverride ?? chargeWeapon ?? attacker.weapons[0];
  if (!weapon) return { value: 1, base: 0, bonus: 0, armorApplied: 0, weapon }; // No weapon -> minimal

  const baseDamage = weapon.damage || 0;
  // Post-charge buff (royal-knight/jeanne-darc-knight): only active from hit 2 onward — subtract it from the charge hit
  const postChargeBonus = attacker.postChargeMeleeBonus ?? 0;
  const effectiveBaseDamage = (isFirstAttack && chargeBonus > 0 && postChargeBonus > 0 && weapon.type === 'melee')
    ? Math.max(0, baseDamage - postChargeBonus)
    : baseDamage;

  // Number of projectiles (burst)
  const burstCount = weapon.burst?.count || 1;

  // Add charge bonus ONLY on the first attack, and only when NOT using the charge weapon directly
  // (when chargeWeapon is used, its damage already IS the charge — no bonus on top)
  const chargeBonus_applied = (isFirstAttack && !chargeWeapon) ? chargeBonus : 0;

  // Applicable bonuses: AND logic per group. Each entry of mod.target.class:
  // - If it is a simple array ["infantry","light"] => requires all these classes (AND)
  // - If it is an array of arrays [["light","gunpowder","infantry"],["cavalry","melee"]] => OR between groups, AND within each group.
  // NOTE: "siegeAttack" bonuses apply like all other normal bonuses (since data unification)
  let bonusDamage = 0;
  if (weapon.modifiers && defender.classes && defender.classes.length > 0) {
    const defenderClassesLower = defender.classes.map(c => c.toLowerCase());
    // Build a set containing all defender classes plus the individual parts of compound classes.
    // e.g. "light_melee_infantry" also adds "light", "melee", "infantry" so that raw modifier
    // targets encoded as [["light","melee","infantry"]] match correctly.
    const expandedTokens = new Set<string>();
    for (const cls of defenderClassesLower) {
      expandedTokens.add(cls);
      if (cls.includes('_')) {
        const parts = cls.split('_');
        // Identify negated tokens: any token immediately following "non"
        // e.g. "find_non_siege_land_military" → "siege" is negated, must NOT be added
        const negatedTokens = new Set<string>();
        for (let i = 0; i < parts.length - 1; i++) {
          if (parts[i] === 'non') negatedTokens.add(parts[i + 1]);
        }
        for (const part of parts) {
          if (part && part !== 'non' && !negatedTokens.has(part)) {
            expandedTokens.add(part);
          }
        }
      }
    }
    for (const mod of weapon.modifiers) {
      // Apply normal modifiers and siegeAttack (property is just a label, not a reason to ignore)
      // if (mod.property === "siegeAttack") continue; // REMOVED: siegeAttack must be applied like the others

      const spec = mod.target?.class;
      if (!spec) continue;

      // Normalize into an array of groups
      const groups: string[][] = Array.isArray(spec) && spec.some(v => Array.isArray(v))
        ? (spec as unknown as string[][])
        : [spec as unknown as string[]];

      const applicable = groups.some(group => {
        if (!Array.isArray(group)) return false;
        return group.every(req => {
          const r = req.toLowerCase();
          // The condition is satisfied if: all required classes are present individually
          // OR if they appear as parts of a composite class
          return expandedTokens.has(r);
        });
      });
      if (applicable) {
        bonusDamage += mod.value;
      }
    }
  }

  // Determine which armor to apply
  let armorValue = 0;
  // Siege-type weapons ignore all armor; melee/non-siege classes (ram, etc.) also bypass via shouldIgnoreArmor.
  // Ranged-type weapons always apply ranged armor regardless of attacker classes (springald, ribauldequin, gunpowder...).
  if (weapon.type !== "siege" && (weapon.type === "ranged" || !shouldIgnoreArmor(attacker, weapon))) {
    if (weapon.type === "melee") {
      armorValue = getArmorValue(defender as unknown as AoE4Unit, "melee");
    } else {
      armorValue = getArmorValue(defender as unknown as AoE4Unit, "ranged");
    }
    // Armor penetration: attacker reduces effective enemy armor (floor at 0)
    if (attacker.armorPenetration) {
      armorValue = Math.max(0, armorValue - attacker.armorPenetration);
    }
  }

  // chargeArmorType: 'ranged' → dagger path (ranged armor/resistance); 'none' → flat bonus ignoring all armor+resistance
  const isDaggerCharge = chargeBonus_applied > 0 && attacker.chargeArmorType === 'ranged';
  const isStrikeCharge = chargeBonus_applied > 0 && attacker.chargeArmorType === 'none';
  const chargeInPrimary = (isDaggerCharge || isStrikeCharge) ? 0 : chargeBonus_applied;

  // Apply defender's bonus damage reduction (fraction [0,1] — multiplicative, e.g. 0.5 = −50%)
  if (bonusDamage > 0 && (defender.bonusDamageReduction ?? 0) > 0) {
    bonusDamage *= (1 - Math.min(1, defender.bonusDamageReduction!));
  }

  // Damage per projectile: (effectiveBaseDamage + bonus + chargeBonus - armor) * burst
  // Armor is applied to each projectile individually
  let damagePerProjectile = effectiveBaseDamage + bonusDamage + chargeInPrimary - armorValue;

  // Apply versus debuffs (e.g. Camel Unease, Ruinous Blinding)
  const debuffMultiplier = getVersusDebuffMultiplier(attacker.classes, defender.activeAbilities || [], defender.activeTechs, defender.baseId)
    * (defender.versusOpponentDamageDebuff ?? 1);
  if (debuffMultiplier !== 1.0) {
    damagePerProjectile = damagePerProjectile * debuffMultiplier;
  }

  // Apply the defender's resistance (positive = damage reduction, negative = vulnerability)
  const resistancePct = getResistanceValue(defender as unknown as AoE4Unit, weapon.type);
  let resistanceApplied: number | undefined;
  if (resistancePct !== 0) {
    damagePerProjectile = damagePerProjectile * (1 - resistancePct / 100);
    resistanceApplied = resistancePct;
  }

  // Gunpowder-specific resistance: applies when attacker has gunpowder class (e.g. handcannoneer)
  if (isGunpowder(attacker, weapon)) {
    const gpResistance = getResistanceValue(defender as unknown as AoE4Unit, 'gunpowder');
    if (gpResistance !== 0) {
      damagePerProjectile = damagePerProjectile * (1 - gpResistance / 100);
      resistanceApplied = (resistanceApplied ?? 0) + gpResistance;
    }
  }

  const clampedPerProjectile = damagePerProjectile < 1 ? 1 : damagePerProjectile;
  const burstDecay = weapon.burst?.decay;
  let totalPrimary: number;
  if (burstDecay !== undefined && burstCount > 1) {
    // Secondary bolts: base × decay, no bonus damage, same armor + debuff + resistance
    let decayDmg = effectiveBaseDamage * burstDecay - armorValue;
    if (debuffMultiplier !== 1.0) decayDmg *= debuffMultiplier;
    if (resistancePct !== 0) decayDmg *= (1 - resistancePct / 100);
    if (isGunpowder(attacker, weapon)) {
      const gpRes = getResistanceValue(defender as unknown as AoE4Unit, 'gunpowder');
      if (gpRes !== 0) decayDmg *= (1 - gpRes / 100);
    }
    const clampedDecay = decayDmg < 1 ? 1 : decayDmg;
    totalPrimary = clampedPerProjectile + (burstCount - 1) * clampedDecay;
  } else {
    totalPrimary = clampedPerProjectile * burstCount;
  }

  // Dagger charge: computed separately with ranged armor + ranged resistance (clamped to 0, not 1)
  let daggerExtra = 0;
  if (isDaggerCharge) {
    const daggerBurst = attacker.chargeBonusBurst ?? 1;
    const perDagger = chargeBonus_applied / daggerBurst;
    let chargeModBonus = 0;
    if (attacker.chargeModifiers?.length && defender.classes?.length) {
      const defTokens = new Set<string>();
      for (const cls of defender.classes) {
        const lc = cls.toLowerCase();
        defTokens.add(lc);
        const parts = lc.split('_');
        const negated = new Set<string>();
        for (let i = 0; i < parts.length - 1; i++) {
          if (parts[i] === 'non') negated.add(parts[i + 1]);
        }
        for (const p of parts) {
          if (p && p !== 'non' && !negated.has(p)) defTokens.add(p);
        }
      }
      for (const mod of attacker.chargeModifiers) {
        if (mod.target.class.some(g => g.every(r => defTokens.has(r.toLowerCase())))) {
          chargeModBonus += mod.value;
        }
      }
    }
    const rangedArmorVal = getArmorValue(defender as unknown as AoE4Unit, 'ranged');
    const rangedResPct = getResistanceValue(defender as unknown as AoE4Unit, 'ranged');
    const perDaggerEff = Math.max(0, perDagger + chargeModBonus - rangedArmorVal);
    daggerExtra = perDaggerEff * daggerBurst * (rangedResPct !== 0 ? (1 - rangedResPct / 100) : 1);
  }

  // Holy wrath (strike): flat bonus, no armor, no resistance
  const strikeExtra = isStrikeCharge ? chargeBonus_applied : 0;

  // Max-HP bonus damage: bypasses armor and resistance (e.g. Kanabo Samurai +6% enemy max HP)
  const hpBonus = (attacker.maxHpBonusFraction ?? 0) > 0 ? attacker.maxHpBonusFraction! * defender.hitpoints : 0;
  const totalDamage = totalPrimary + daggerExtra + strikeExtra + hpBonus;

  return { value: totalDamage, base: effectiveBaseDamage * burstCount, bonus: (bonusDamage + chargeInPrimary) * burstCount + hpBonus, armorApplied: armorValue, weapon, debuffMultiplier: debuffMultiplier !== 1.0 ? debuffMultiplier : undefined, resistanceApplied };
}

function round(value: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
}

// ─── Seeded PRNG (Mulberry32) ────────────────────────────────────────────────
// Used by all MC models so results are reproducible across runs.
// Call seedRng(MC_SEED) at the start of each resolve() to reset state.

let _rngState = 0;
function seedRng(seed: number): void { _rngState = seed >>> 0; }
function rng(): number {
  _rngState = (_rngState + 0x6D2B79F5) >>> 0;
  let z = Math.imul(_rngState ^ (_rngState >>> 15), 1 | _rngState);
  z = Math.imul(z ^ (z >>> 7), 61 | z) ^ z;
  return ((z ^ (z >>> 14)) >>> 0) / 0x100000000;
}
const MC_SEED = 42;

// ─── Movement & Kiting ───────────────────────────────────────────────────────

export const START_DISTANCE = 5; // default starting distance in tiles (configurable later)

function isRangedUnit(entity: CombatEntity): boolean {
  return entity.weapons[0]?.type === 'ranged';
}

function getMaxRange(entity: CombatEntity): number {
  const allWeapons = [...entity.weapons, ...(entity.secondaryWeapons ?? [])];
  return Math.max(0, ...allWeapons.map(w => w.range?.max ?? 0));
}

function getRetreatTime(entity: CombatEntity): number {
  // The unit can move during winddown (end of attack animation) AND reload.
  const d = entity.weapons[0]?.durations;
  return (d?.winddown ?? 0) + (d?.reload ?? 0);
}

function canPermanentlyKite(ranged: CombatEntity, melee: CombatEntity): boolean {
  const hasMeleeCharge = melee.activeAbilities?.includes('charge-attack') ?? false;
  const effectiveMeleeSpeed = hasMeleeCharge ? melee.moveSpeed * 1.2 : melee.moveSpeed;
  if (ranged.continuousMovement && ranged.moveSpeed > effectiveMeleeSpeed) return true;
  const attackCycle = (ranged.weapons[0]?.speed ?? 0) * (1 + (melee.opponentAttackSpeedDebuff ?? 0));
  if (attackCycle <= 0 || effectiveMeleeSpeed <= 0) return false;
  const delta = ranged.moveSpeed * getRetreatTime(ranged) - effectiveMeleeSpeed * attackCycle;
  return delta >= 0;
}

/**
 * Returns the charge weapon for units that have one (knight, merc_ghulam).
 * Detection: class-based (knight / merc_ghulam) + heuristic — secondary melee weapon
 * with higher damage than the primary (the charge weapon hits harder than normal).
 * Falls back to undefined if no such weapon is found (e.g. ghulam uses chargeBonus instead).
 */
function getChargeWeapon(entity: CombatEntity): UnifiedWeapon | undefined {
  const isChargeClass = entity.classes.some(c => {
    const lc = c.toLowerCase();
    return lc === 'knight' || lc === 'merc_ghulam';
  });
  if (!isChargeClass) return undefined;
  const primary = entity.weapons[0];
  if (!primary) return undefined;
  // Secondary melee weapon with strictly higher damage = charge weapon
  return entity.weapons.slice(1).find(w => w.type === 'melee' && w.damage > primary.damage);
}

/**
 * Adjusts both metrics for movement / kiting based on starting distance d0.
 *
 * Scenarios:
 *   Ranged vs Ranged  → add shared approach time to both TTKs (no kiting).
 *   Melee  vs Melee   → unchanged (existing model kept).
 *   Ranged vs Melee   → kiting: ranged fires then retreats during reload.
 *     - if ranged can permanently out-run melee → melee TTK = null (never reaches).
 *     - otherwise → compute approach + kiting phases, pre-contact hits, contact time.
 */
function applyKitingToMetrics(
  metricsA: VersusMetrics,
  metricsB: VersusMetrics,
  A: CombatEntity,
  B: CombatEntity,
  d0: number = START_DISTANCE,
  AnoTimer?: CombatEntity,
  timedDurationA?: number,
  BnoTimer?: CombatEntity,
  timedDurationB?: number,
): { adjustedA: VersusMetrics; adjustedB: VersusMetrics } {
  const A_isRanged = isRangedUnit(A);
  const B_isRanged = isRangedUnit(B);

  // ── Ranged vs Ranged ──────────────────────────────────────────────────────
  if (A_isRanged && B_isRanged) {
    const closingSpeed = A.moveSpeed + B.moveSpeed;
    if (closingSpeed <= 0) return { adjustedA: metricsA, adjustedB: metricsB };

    const t_approach = Math.max(0, d0 - Math.min(getMaxRange(A), getMaxRange(B))) / closingSpeed;
    if (t_approach <= 0) return { adjustedA: metricsA, adjustedB: metricsB };

    const note = `+${round(t_approach, 1)}s approach`;
    return {
      adjustedA: {
        ...metricsA,
        timeToKill: metricsA.timeToKill !== null ? round(metricsA.timeToKill + t_approach, 1) : null,
        timeToKillExact: metricsA.timeToKillExact !== null && metricsA.timeToKillExact !== undefined ? metricsA.timeToKillExact + t_approach : metricsA.timeToKillExact,
        formula: metricsA.formula + ` [Movement: ${note}]`,
      },
      adjustedB: {
        ...metricsB,
        timeToKill: metricsB.timeToKill !== null ? round(metricsB.timeToKill + t_approach, 1) : null,
        timeToKillExact: metricsB.timeToKillExact !== null && metricsB.timeToKillExact !== undefined ? metricsB.timeToKillExact + t_approach : metricsB.timeToKillExact,
        formula: metricsB.formula + ` [Movement: ${note}]`,
      },
    };
  }

  // ── Melee vs Melee ────────────────────────────────────────────────────────
  if (!A_isRanged && !B_isRanged) {
    return { adjustedA: metricsA, adjustedB: metricsB };
  }

  // ── Ranged vs Melee (or Melee vs Ranged) ──────────────────────────────────
  const isAranged = A_isRanged;
  const ranged = isAranged ? A : B;
  const melee = isAranged ? B : A;
  const mRanged = isAranged ? metricsA : metricsB;
  const mMelee = isAranged ? metricsB : metricsA;

  const rangeMax = getMaxRange(ranged);
  const retreatTime = getRetreatTime(ranged); // winddown + reload: phases where the unit can move
  const speedRanged = ranged.moveSpeed;
  const speedMelee = melee.moveSpeed;
  const attackCycle = (ranged.weapons[0]?.speed ?? 0) * (1 + (melee.opponentAttackSpeedDebuff ?? 0));

  // All melee units with charge ability active get a 20% speed boost until their first attack
  const hasMeleeCharge = melee.activeAbilities?.includes('charge-attack') ?? false;
  const CHARGE_SPEED_MULTIPLIER = 1.2; // +20% speed boost for all melee units with charge ability
  const effectiveMeleeSpeed = hasMeleeCharge ? speedMelee * CHARGE_SPEED_MULTIPLIER : speedMelee;
  // Charge weapon (extra damage on first hit): only for knight / merc_ghulam
  const meleeChargeWeapon = hasMeleeCharge ? getChargeWeapon(melee) : undefined;

  if (attackCycle <= 0 || effectiveMeleeSpeed <= 0) {
    return { adjustedA: metricsA, adjustedB: metricsB };
  }

  // Net gap change per attack cycle (positive = ranged gains distance, negative = melee gains).
  // During one cycle: ranged retreats for (winddown + reload) → +speedRanged*retreatTime
  //                   melee advances for attackCycle          → -effectiveMeleeSpeed*attackCycle
  const delta = speedRanged * retreatTime - effectiveMeleeSpeed * attackCycle;

  // ── Continuous movement override (e.g. Mangudai) ─────────────────────────
  if (ranged.continuousMovement && speedRanged > effectiveMeleeSpeed) {
    const note = `melee (${round(speedMelee, 2)} t/s) cannot catch ${ranged.name} (shoots while moving at ${round(speedRanged, 2)} t/s)`;
    const newMRanged: VersusMetrics = {
      ...mRanged,
      formula: mRanged.formula + ` [Kiting: continuous movement — ${note}]`,
    };
    const newMMelee: VersusMetrics = {
      ...mMelee,
      dps: null,
      dpsPerCost: null,
      hitsToKill: null,
      timeToKill: null,
      effectiveDamagePerHit: null,
      formula: mMelee.formula + ` [Kiting: ${note}]`,
    };
    return isAranged
      ? { adjustedA: newMRanged, adjustedB: newMMelee }
      : { adjustedA: newMMelee, adjustedB: newMRanged };
  }

  // ── Melee can NEVER catch ranged ──────────────────────────────────────────
  if (delta >= 0) {
    const note = `melee (${round(speedMelee, 2)} t/s) cannot catch ranged kiting at ${round(speedRanged, 2)} t/s`;
    const newMRanged: VersusMetrics = {
      ...mRanged,
      formula: mRanged.formula + ` [Kiting: ranged permanently out of reach — ${note}]`,
    };
    // Melee can never deal damage: null out all combat stats
    const newMMelee: VersusMetrics = {
      ...mMelee,
      dps: null,
      dpsPerCost: null,
      hitsToKill: null,
      timeToKill: null,
      effectiveDamagePerHit: null,
      formula: mMelee.formula + ` [Kiting: ${note}]`,
    };
    return isAranged
      ? { adjustedA: newMRanged, adjustedB: newMMelee }
      : { adjustedA: newMMelee, adjustedB: newMRanged };
  }

  // ── Melee can catch ranged ────────────────────────────────────────────────
  const meleeNoTimer = isAranged ? BnoTimer : AnoTimer;
  const timedDurationMelee = isAranged ? timedDurationB : timedDurationA;
  const d_approach = Math.max(0, d0 - rangeMax);
  let t_approach: number;
  if (meleeNoTimer && timedDurationMelee !== undefined && d_approach > 0) {
    const normalMeleeSpeed = meleeNoTimer.moveSpeed;
    const d_in_duration = effectiveMeleeSpeed * timedDurationMelee;
    t_approach = (normalMeleeSpeed > 0 && d_in_duration < d_approach)
      ? timedDurationMelee + (d_approach - d_in_duration) / normalMeleeSpeed
      : d_approach / effectiveMeleeSpeed;
  } else {
    t_approach = d_approach / effectiveMeleeSpeed;
  }
  const wRangedApproach = ranged.weapons[0]?.durations?.windup ?? 0;
  const approachTravelTimeKite = isArcher(ranged) ? ARCHER_TRAVEL_TIME : 0;
  const shotsDeadlineKite = t_approach - approachTravelTimeKite;
  const freeHits = attackCycle > 0 && shotsDeadlineKite >= wRangedApproach
    ? Math.floor((shotsDeadlineKite - wRangedApproach) / attackCycle) + 1
    : 0;
  const d_kite_start = Math.min(d0, rangeMax); // distance at start of kiting
  const absDelta = Math.abs(delta);
  const n_kite = absDelta > 0 ? Math.ceil(d_kite_start / absDelta) : 0;
  const t_kite = n_kite * attackCycle;
  const contactTime = t_approach + t_kite;
  const preContactHits = freeHits + n_kite;

  // Ranged TTK: determine which phase melee dies in
  const hitsToKill = mRanged.hitsToKill;
  let newTTKranged: number | null = mRanged.timeToKill;
  let newTTKrangedExact: number | null = mRanged.timeToKillExact ?? mRanged.timeToKill;
  if (hitsToKill !== null && attackCycle > 0) {
    if (hitsToKill <= freeHits) {
      // Dies during approach
      newTTKrangedExact = hitsToKill * attackCycle;
      newTTKranged = round(newTTKrangedExact, 1);
    } else if (hitsToKill <= preContactHits) {
      // Dies during kiting
      newTTKrangedExact = t_approach + (hitsToKill - freeHits) * attackCycle;
      newTTKranged = round(newTTKrangedExact, 1);
    } else {
      // Dies during close combat
      // When thorns DPS is active (dpsContact > 0), it only applies from contactTime onward.
      // Remaining HP is bolt-damage-based (pre-contact had no thorns); contact phase uses full combined DPS.
      if (mRanged.dpsContact && mRanged.dps && mRanged.effectiveDamagePerHit) {
        const remainingHP = (hitsToKill - preContactHits) * mRanged.effectiveDamagePerHit;
        newTTKrangedExact = contactTime + remainingHP / mRanged.dps;
        newTTKranged = round(newTTKrangedExact, 1);
      } else {
        newTTKrangedExact = contactTime + (hitsToKill - preContactHits) * attackCycle;
        newTTKranged = round(newTTKrangedExact, 1);
      }
    }
  }

  const meleeDiesBeforeContact = hitsToKill !== null && hitsToKill <= preContactHits;

  // Melee TTK: can only deal damage after contact
  // First hit uses charge weapon speed (if any), subsequent hits use primary weapon speed
  const meleAttackCycle = melee.weapons[0]?.speed ?? 0;
  // Charging melee without a charge weapon (spearman, horseman) pre-load windup during sprint → first hit at t=0
  const isMeleeChargingMelee = !meleeChargeWeapon && hasMeleeCharge && (melee.weapons[0]?.type === 'melee');
  const meleeFirstHitSpeed = meleeChargeWeapon ? (meleeChargeWeapon.speed || meleAttackCycle) : isMeleeChargingMelee ? 0 : meleAttackCycle;
  const newTTKmeleeExact: number | null = meleeDiesBeforeContact
    ? null
    : (mMelee.hitsToKill !== null && meleAttackCycle > 0
      ? contactTime + meleeFirstHitSpeed + (mMelee.hitsToKill - 1) * meleAttackCycle
      : null);
  const newTTKmelee: number | null = newTTKmeleeExact !== null ? round(newTTKmeleeExact, 1) : null;

  const chargeSpeedNote = hasMeleeCharge ? ` [charge ×${CHARGE_SPEED_MULTIPLIER} speed]` : '';
  const kitingNote = `approach ${round(t_approach, 1)}s (+${freeHits} free hits)${chargeSpeedNote} · kiting ${round(t_kite, 1)}s (+${n_kite} hits) · contact t=${round(contactTime, 1)}s`;

  const newMRanged: VersusMetrics = {
    ...mRanged,
    timeToKill: newTTKranged,
    timeToKillExact: newTTKrangedExact,
    formula: mRanged.formula + ` [Kiting: ${kitingNote}]`,
  };
  const newMMelee: VersusMetrics = {
    ...mMelee,
    timeToKill: newTTKmelee,
    timeToKillExact: newTTKmeleeExact,
    formula: mMelee.formula + ` [${meleeDiesBeforeContact ? 'Dies before contact' : `contact at t=${round(contactTime, 1)}s`}]`,
  };

  return isAranged
    ? { adjustedA: newMRanged, adjustedB: newMMelee }
    : { adjustedA: newMMelee, adjustedB: newMRanged };
}

function computeMetrics(
  attacker: CombatEntity,
  defender: CombatEntity,
  chargeBonus: number = 0,
  attackerMultiplier: number = 1,
  defenderMultiplier: number = 1,
  discreteTTK: boolean = false,
  attackerNoTimer?: CombatEntity,
  timedDurationAttacker?: number,
  defenderNoTimer?: CombatEntity,
  timedDurationDefender?: number,
): VersusMetrics {
  const chargeWeapon = getChargeWeapon(attacker);
  const hasChargeWeapon = !!chargeWeapon && (attacker.activeAbilities?.includes('charge-attack') ?? false);
  const firstAttackData = computeEffectiveDamage(attacker, defender, chargeBonus, true);
  const normalAttackData = computeEffectiveDamage(attacker, defender, 0, false);
  const weapon = normalAttackData.weapon;
  const rawSpeed = weapon?.speed || 0;
  const asDebuffFactor = 1 + (defender.opponentAttackSpeedDebuff ?? 0);
  const attackSpeed = rawSpeed * asDebuffFactor;
  // Charging melee units without a dedicated charge weapon pre-load their windup during the sprint,
  // so the first hit fires at contact (t=0). Mirror the same logic as computeDamageInTime.
  const isChargingMelee = !hasChargeWeapon && (attacker.activeAbilities?.includes('charge-attack') ?? false) && weapon?.type === 'melee';
  // First hit uses the charge weapon's own attack cycle (if present), or 0 for isChargingMelee
  const firstHitSpeed = (hasChargeWeapon ? (chargeWeapon!.speed || rawSpeed) : isChargingMelee ? 0 : rawSpeed) * asDebuffFactor;
  const bugAttackSpeed = rawSpeed <= 0;
  let dps: number | null = null;
  let hitsToKill: number | null = null;
  let timeToKill: number | null = null;
  let exactTimeToKill: number | null = null;
  let dpsPerCost: number | null = null;
  let thornsDPS = 0;

  // First-hit block (Deflective Armor): defender absorbs first attack completely (0 damage).
  // The charge still executes — post-charge buff activates normally from hit 2 onward.
  if (defender.firstHitBlocked && !bugAttackSpeed) {
    const chargeBlockedNormal = normalAttackData.value;
    const totalDefHP = defender.hitpoints * (defender.hpStartFraction ?? 1) * defenderMultiplier;
    const normalCycle = chargeBlockedNormal * attackerMultiplier;
    let secNormalDPS = 0;
    for (const secWeapon of (attacker.secondaryWeapons || [])) {
      if (!secWeapon.speed || secWeapon.speed <= 0) continue;
      const secData = computeEffectiveDamage(attacker, defender, 0, false, secWeapon);
      secNormalDPS += secData.value / secWeapon.speed;
    }
    const effectiveNormalCycle = normalCycle + secNormalDPS * attackSpeed;
    if (effectiveNormalCycle > 0) {
      const normalHTK = Math.ceil(totalDefHP / effectiveNormalCycle);
      hitsToKill = 1 + normalHTK;
      exactTimeToKill = firstHitSpeed + normalHTK * attackSpeed;
      timeToKill = round(exactTimeToKill, 1);
      dps = round(totalDefHP / timeToKill, 2);
    }
    // Two-phase correction: attacker timed ability (e.g. ability-royal-knight-charge-damage duration:5)
    // expires before the fight ends. Hit 1 is blocked; Phase 1 damage starts from hit 2.
    if (attackerNoTimer && timedDurationAttacker !== undefined && exactTimeToKill !== null && exactTimeToKill > timedDurationAttacker && !attacker.selfDestructs) {
      const noTimerData = computeEffectiveDamage(attackerNoTimer, defender, 0, false);
      const noTimerDmgPerHit = noTimerData.value * attackerMultiplier;
      const noTimerAS = (noTimerData.weapon?.speed ?? rawSpeed) * asDebuffFactor;
      const normalDmgPerHit = chargeBlockedNormal * attackerMultiplier;
      if (noTimerDmgPerHit > 0 && noTimerAS > 0 && (noTimerDmgPerHit !== normalDmgPerHit || noTimerAS !== attackSpeed)) {
        const hitsInDuration = firstHitSpeed <= timedDurationAttacker
          ? 1 + Math.floor((timedDurationAttacker - firstHitSpeed) / attackSpeed)
          : 0;
        const dmgInDuration = Math.max(0, hitsInDuration - 1) * normalDmgPerHit;
        if (dmgInDuration < totalDefHP) {
          const remainingHP = totalDefHP - dmgInDuration;
          const remainingHits = Math.ceil(remainingHP / noTimerDmgPerHit);
          hitsToKill = hitsInDuration + remainingHits;
          exactTimeToKill = (hitsInDuration > 0 ? firstHitSpeed + (hitsInDuration - 1) * attackSpeed : 0)
            + remainingHits * noTimerAS;
          timeToKill = round(exactTimeToKill, 1);
          dps = round(totalDefHP / timeToKill, 2);
        }
      }
    }
    if (attacker.selfDestructs && hitsToKill !== null && hitsToKill > 1) {
      hitsToKill = null; timeToKill = null; exactTimeToKill = null; dps = null;
    }
    const cost = totalCost(attacker);
    dpsPerCost = cost > 0 ? round((chargeBlockedNormal / attackSpeed) / cost, 2) : null;
    const debuffTxt = normalAttackData.debuffMultiplier ? ` × ${normalAttackData.debuffMultiplier} (debuff)` : '';
    return {
      id: attacker.id, name: attacker.name,
      dps, dpsPerCost, hitsToKill, timeToKill, timeToKillExact: exactTimeToKill,
      effectiveDamagePerHit: chargeBlockedNormal,
      firstHitDamage: 0,
      bugAttackSpeed: false, cannotAttackUnits: false,
      formula: `Deflect + Effective = max(1, (Base(${normalAttackData.base}) + Bonus(${normalAttackData.bonus}) - Armor(${normalAttackData.armorApplied}))${debuffTxt}) = ${chargeBlockedNormal}; DPS = ${dps}`,
    };
  }

  if (!bugAttackSpeed) {
    const totalDefenderHP = defender.hitpoints * (defender.hpStartFraction ?? 1) * defenderMultiplier;

    if (chargeBonus > 0 || hasChargeWeapon) {
      const firstCycleDamage = firstAttackData.value * attackerMultiplier;
      const normalCycleDamage = normalAttackData.value * attackerMultiplier;

      if (firstCycleDamage >= totalDefenderHP) {
        hitsToKill = 1;
        exactTimeToKill = firstHitSpeed;
        timeToKill = round(exactTimeToKill, 1);
      } else {
        const additionalHits = Math.ceil((totalDefenderHP - firstCycleDamage) / normalCycleDamage);
        hitsToKill = 1 + additionalHits;
        exactTimeToKill = firstHitSpeed + additionalHits * attackSpeed;
        timeToKill = round(exactTimeToKill, 1);
      }
      const totalDamage = firstCycleDamage + (hitsToKill - 1) * normalCycleDamage;
      const totalTime = firstHitSpeed + (hitsToKill - 1) * attackSpeed;
      dps = round(totalDamage / totalTime, 2);
    } else {
      const unitDPS = round(normalAttackData.value / attackSpeed, 2);
      dps = round(unitDPS * attackerMultiplier, 2);
      hitsToKill = Math.ceil(totalDefenderHP / (normalAttackData.value * attackerMultiplier));
      // isChargingMelee units fire their first hit at t=0 (firstHitSpeed=0), so TTK = (N-1) × AS
      exactTimeToKill = isChargingMelee
        ? firstHitSpeed + (hitsToKill - 1) * attackSpeed
        : hitsToKill * attackSpeed;
      timeToKill = round(exactTimeToKill, 1);
    }

    // Defender self-healing: heals healingRate HP per hit it lands
    const defenderHealPerHit = defender.healingRate ?? 0;
    if (defenderHealPerHit > 0 && dps !== null) {
      const defenderAttackSpeed = (defender.weapons[0]?.speed ?? 0) * (1 + (attacker.opponentAttackSpeedDebuff ?? 0));
      const healPerS = defenderAttackSpeed > 0 ? defenderHealPerHit / defenderAttackSpeed : 0;
      const netDPS = dps - healPerS;
      if (netDPS <= 0) {
        hitsToKill = null;
        timeToKill = null; exactTimeToKill = null;
      } else {
        const totalDefHP = defender.hitpoints * (defender.hpStartFraction ?? 1) * defenderMultiplier;
        hitsToKill = Math.ceil(totalDefHP / (netDPS * attackSpeed));
        exactTimeToKill = firstHitSpeed + (hitsToKill - 1) * attackSpeed;
        timeToKill = round(exactTimeToKill, 1);
      }
    }

    // Secondary weapons
    if (attacker.secondaryWeapons && attacker.secondaryWeapons.length > 0 && attackSpeed > 0) {
      let totalSecDPS = 0;
      for (const secWeapon of attacker.secondaryWeapons) {
        if (!secWeapon.speed || secWeapon.speed <= 0) continue;
        const secData = computeEffectiveDamage(attacker, defender, 0, false, secWeapon);
        totalSecDPS += secData.value / secWeapon.speed;
      }
      if (totalSecDPS > 0) {
        if (discreteTTK) {
          // Discrete model (versus): secondary damage per primary cycle → recompute HTK then TTK = HTK × AS.
          // First cycle may differ when a charge weapon has a different speed.
          // firstAttackData already includes charge/bleed bonus, so the first-hit reduction is preserved.
          const totalDefHP = defender.hitpoints * (defender.hpStartFraction ?? 1) * defenderMultiplier;
          const secPerFirstCycle = totalSecDPS * firstHitSpeed;
          const secPerNormalCycle = totalSecDPS * attackSpeed;
          const effectiveFirstCycle = firstAttackData.value * attackerMultiplier + secPerFirstCycle;
          const effectiveNormalCycle = normalAttackData.value * attackerMultiplier + secPerNormalCycle;
          if (effectiveFirstCycle >= totalDefHP) {
            hitsToKill = 1;
            exactTimeToKill = firstHitSpeed;
            timeToKill = round(exactTimeToKill, 1);
          } else {
            const additionalHits = Math.ceil((totalDefHP - effectiveFirstCycle) / effectiveNormalCycle);
            hitsToKill = 1 + additionalHits;
            exactTimeToKill = firstHitSpeed + additionalHits * attackSpeed;
            timeToKill = round(exactTimeToKill, 1);
          }
          const totalDmg = effectiveFirstCycle + (hitsToKill - 1) * effectiveNormalCycle;
          const totalTime = firstHitSpeed + (hitsToKill - 1) * attackSpeed;
          dps = round(totalDmg / totalTime, 2);
        } else {
          // Continuous model (equal cost): add secondary DPS then TTK = HP / combinedDPS.
          dps = round((dps ?? 0) + totalSecDPS, 2);
          if (dps > 0) {
            exactTimeToKill = (defender.hitpoints * defenderMultiplier) / dps;
            timeToKill = round(exactTimeToKill, 1);
            hitsToKill = Math.ceil(timeToKill / attackSpeed);
          }
        }
      }
    }

    // Attacker's bleed: adds fixed DPS to effective attack (e.g. Zornhau: 2 HP/s)
    const bleedDPS = attacker.opponentHealingRateDebuff ?? 0;
    if (bleedDPS !== 0 && dps !== null) {
      dps = round(dps + bleedDPS, 2);
      const totalDefHP = defender.hitpoints * (defender.hpStartFraction ?? 1) * defenderMultiplier;
      if (dps > 0) {
        hitsToKill = attackSpeed > 0 ? Math.ceil(totalDefHP / (dps * attackSpeed)) : null;
        exactTimeToKill = hitsToKill !== null ? firstHitSpeed + (hitsToKill - 1) * attackSpeed : null;
        timeToKill = exactTimeToKill !== null ? round(exactTimeToKill, 1) : null;
      } else {
        hitsToKill = null;
        timeToKill = null; exactTimeToKill = null;
      }
    }

    // Thorns DPS: bonus damage against melee attackers = coeff / defender.attackSpeed (bypasses armor).
    // hitsToKill intentionally NOT updated — keeps actual projectile count for kiting phase determination.
    // dpsContact carries the thorns component; adjustForKiting uses it to handle pre-contact vs contact phases.
    const thornCoeff = attacker.dpsVsMeleeASCoeff ?? 0;
    if (thornCoeff > 0 && dps !== null) {
      const defenderAS = (defender.weapons[0]?.speed ?? 0) * (1 + (attacker.opponentAttackSpeedDebuff ?? 0));
      if (defenderAS > 0 && defender.classes.some(c => c.toLowerCase() === 'melee')) {
        thornsDPS = thornCoeff / defenderAS;
        dps = round(dps + thornsDPS, 2);
        const totalDefHP = defender.hitpoints * (defender.hpStartFraction ?? 1) * defenderMultiplier;
        if (dps > 0) {
          exactTimeToKill = totalDefHP / dps;
          timeToKill = round(exactTimeToKill, 1);
        }
      }
    }

    // Defender per-second healing/self-damage (Triumph: +2 HP/s; Militia: −1 HP/s)
    const defenderHealPerSecond = defender.healingRatePerSecond ?? 0;
    if (defenderHealPerSecond !== 0 && dps !== null && timeToKill !== null) {
      const totalDefHP = defender.hitpoints * (defender.hpStartFraction ?? 1) * defenderMultiplier;
      const netDPS = dps - defenderHealPerSecond;
      if (netDPS <= 0) {
        hitsToKill = null;
        timeToKill = null; exactTimeToKill = null;
      } else {
        hitsToKill = attackSpeed > 0 ? Math.ceil(totalDefHP / (netDPS * attackSpeed)) : null;
        exactTimeToKill = hitsToKill !== null ? firstHitSpeed + (hitsToKill - 1) * attackSpeed : null;
        timeToKill = exactTimeToKill !== null ? round(exactTimeToKill, 1) : null;
      }
    }

    const unitDPS = round(normalAttackData.value / attackSpeed, 2);
    const cost = totalCost(attacker);
    dpsPerCost = cost > 0 ? round(unitDPS / cost, 2) : null;
  }

  // Special case: self-destructing unit (e.g. demolition ship) — only kills if hitsToKill === 1
  if (attacker.selfDestructs && hitsToKill !== null && hitsToKill > 1) {
    hitsToKill = null;
    timeToKill = null; exactTimeToKill = null;
    dps = null;
  }

  // Phase-based duration correction: attacker ability expires before the fight ends.
  // Phase 1 (0 → timedDurationAttacker): attacker uses full ability stats.
  // Phase 2 (remainder): attacker uses base stats without the timed ability.
  if (attackerNoTimer && timedDurationAttacker !== undefined && timeToKill !== null && timeToKill > timedDurationAttacker && !bugAttackSpeed && !attacker.selfDestructs) {
    const noTimerData = computeEffectiveDamage(attackerNoTimer, defender, 0, false);
    const noTimerDmgPerHit = noTimerData.value * attackerMultiplier;
    const noTimerAttackSpeed = (noTimerData.weapon?.speed ?? rawSpeed) * asDebuffFactor;
    const normalDmgPerHit = normalAttackData.value * attackerMultiplier;
    if (noTimerDmgPerHit > 0 && noTimerAttackSpeed > 0 && (noTimerDmgPerHit !== normalDmgPerHit || noTimerAttackSpeed !== attackSpeed)) {
      const totalDefHP = defender.hitpoints * (defender.hpStartFraction ?? 1) * defenderMultiplier;
      // Account for firstHitSpeed: first hit lands at firstHitSpeed, not attackSpeed
      const hitsInDuration = firstHitSpeed <= timedDurationAttacker
        ? 1 + Math.floor((timedDurationAttacker - firstHitSpeed) / attackSpeed)
        : 0;
      const firstDmgPerHit = firstAttackData.value * attackerMultiplier;
      // Hit 1 carries the charge bonus (includes holy wrath); remaining hits are normal
      const dmgInDuration = hitsInDuration >= 1
        ? firstDmgPerHit + (hitsInDuration - 1) * normalDmgPerHit
        : 0;
      if (dmgInDuration < totalDefHP) {
        const remainingHP = totalDefHP - dmgInDuration;
        const remainingHits = Math.ceil(remainingHP / noTimerDmgPerHit);
        hitsToKill = hitsInDuration + remainingHits;
        // Time = firstHitSpeed + (hitsInDuration-1) normal cycles + remainingHits noTimer cycles
        exactTimeToKill = (hitsInDuration > 0 ? firstHitSpeed + (hitsInDuration - 1) * attackSpeed : 0)
          + remainingHits * noTimerAttackSpeed;
        timeToKill = round(exactTimeToKill, 1);
        dps = round((dmgInDuration + remainingHits * noTimerDmgPerHit) / timeToKill, 2);
      }
    }
  }

  // Phase-based duration correction: defender timed resistance/armor expires before the fight ends.
  // Phase 1 (0 → timedDurationDefender): attacker hits defender with boosted stats (lower damage).
  // Phase 2 (remainder): attacker hits defender without timed stats (higher damage).
  if (defenderNoTimer && timedDurationDefender !== undefined && timeToKill !== null && timeToKill > timedDurationDefender && !bugAttackSpeed && !attacker.selfDestructs) {
    const noTimerDefData = computeEffectiveDamage(attacker, defenderNoTimer, 0, false);
    const noTimerDefDmgPerHit = noTimerDefData.value * attackerMultiplier;
    const phase1DmgPerHit = normalAttackData.value * attackerMultiplier;
    if (noTimerDefDmgPerHit > 0 && attackSpeed > 0 && noTimerDefDmgPerHit !== phase1DmgPerHit) {
      const totalDefHP = defender.hitpoints * (defender.hpStartFraction ?? 1) * defenderMultiplier;
      // Account for firstHitSpeed: first hit lands at firstHitSpeed, not attackSpeed
      const hitsInDuration = firstHitSpeed <= timedDurationDefender
        ? 1 + Math.floor((timedDurationDefender - firstHitSpeed) / attackSpeed)
        : 0;
      const firstDmgPerHit = firstAttackData.value * attackerMultiplier;
      const dmgInDuration = hitsInDuration >= 1
        ? firstDmgPerHit + (hitsInDuration - 1) * phase1DmgPerHit
        : 0;
      if (dmgInDuration < totalDefHP) {
        const remainingHP = totalDefHP - dmgInDuration;
        const remainingHits = Math.ceil(remainingHP / noTimerDefDmgPerHit);
        hitsToKill = hitsInDuration + remainingHits;
        // Attacker speed unchanged across phases — just firstHitSpeed offset
        exactTimeToKill = (hitsInDuration > 0 ? firstHitSpeed + (hitsInDuration - 1) * attackSpeed : 0)
          + remainingHits * attackSpeed;
        timeToKill = round(exactTimeToKill, 1);
        dps = round(totalDefHP / timeToKill, 2);
      }
    }
  }

  // Phase-based duration correction: defender timed healingRate expires before the fight ends.
  // Phase 1 (0 → timedDurationDefender): defender heals at the timed rate (reducing effective attacker DPS).
  // Phase 2 (remainder): defender heals at the base rate (without timed ability).
  if (defenderNoTimer && timedDurationDefender !== undefined && timeToKill !== null && timeToKill > timedDurationDefender && !bugAttackSpeed && !attacker.selfDestructs) {
    const phase1HealRate = defender.healingRate ?? 0;
    const phase2HealRate = defenderNoTimer.healingRate ?? 0;
    if (phase1HealRate !== phase2HealRate && attackSpeed > 0) {
      const defenderAS = (defender.weapons[0]?.speed ?? 0) * (1 + (attacker.opponentAttackSpeedDebuff ?? 0));
      const rawDmgPerHit = normalAttackData.value * attackerMultiplier;
      const totalDefHP = defender.hitpoints * (defender.hpStartFraction ?? 1) * defenderMultiplier;
      const hitsInDuration = firstHitSpeed <= timedDurationDefender
        ? 1 + Math.floor((timedDurationDefender - firstHitSpeed) / attackSpeed)
        : 0;
      const phase1Time = hitsInDuration > 0 ? firstHitSpeed + (hitsInDuration - 1) * attackSpeed : 0;
      const healPerS1 = defenderAS > 0 ? phase1HealRate / defenderAS : 0;
      const healPerS2 = defenderAS > 0 ? phase2HealRate / defenderAS : 0;
      const netDmgPhase1 = hitsInDuration * rawDmgPerHit - phase1Time * healPerS1;
      if (netDmgPhase1 < totalDefHP) {
        const remainingHP = totalDefHP - netDmgPhase1;
        const netDmgPerHitPhase2 = rawDmgPerHit - healPerS2 * attackSpeed;
        if (netDmgPerHitPhase2 > 0) {
          const remainingHits = Math.ceil(remainingHP / netDmgPerHitPhase2);
          hitsToKill = hitsInDuration + remainingHits;
          exactTimeToKill = phase1Time + remainingHits * attackSpeed;
          timeToKill = round(exactTimeToKill, 1);
          dps = round(totalDefHP / timeToKill, 2);
        }
      }
    }
  }

  // Special case: attacker cannot attack units (e.g. ram)
  if (normalAttackData.cannotAttack) {
    return {
      id: attacker.id,
      name: attacker.name,
      dps: null,
      dpsPerCost: null,
      hitsToKill: null,
      timeToKill: null,
      effectiveDamagePerHit: null,
      bugAttackSpeed: false,
      cannotAttackUnits: true,
      formula: 'Cannot attack units (buildings only)',
    };
  }

  const debuffText = normalAttackData.debuffMultiplier ? ` × ${normalAttackData.debuffMultiplier} (debuff)` : '';
  const isBleedUnit = attacker.classes.some(c => c.toLowerCase() === 'kipchak_archer');
  const isDaggerUnit = attacker.classes.some(c => c.toLowerCase() === 'lancaster_champion');
  const isStrikeUnit = attacker.chargeArmorType === 'none';
  const isFirstStrikeUnit = attacker.chargeArmorType === 'first-strike';
  const chargeLabel = isFirstStrikeUnit ? 'First Strike' : isStrikeUnit ? 'Strike' : isBleedUnit ? 'Bleed' : isDaggerUnit ? 'Dagger' : 'Charge';
  const chargeBonusBurst = attacker.chargeBonusBurst ?? 1;
  const chargeBonusDisplay = chargeBonusBurst > 1
    ? `${Math.round(chargeBonus / chargeBonusBurst)}×${chargeBonusBurst}`
    : String(chargeBonus);
  const chargeText = chargeBonus > 0 ? ` + ${chargeLabel}(${chargeBonusDisplay})` : '';
  const chargeWeaponText = hasChargeWeapon
    ? ` [1st hit: ${chargeWeapon!.name} (${firstAttackData.value} dmg, t=${round(firstHitSpeed, 3)}s)]`
    : '';
  const resistanceText = normalAttackData.resistanceApplied ? ` × (1 - ${normalAttackData.resistanceApplied}% resistance)` : '';
  const formula = attackerMultiplier > 1
    ? `${attackerMultiplier} × [Effective = max(1, (Base(${normalAttackData.base}) + Bonus(${normalAttackData.bonus})${chargeText} - Armor(${normalAttackData.armorApplied}))${resistanceText}) = ${normalAttackData.value}] vs ${defenderMultiplier} defenders` + (weapon ? `; Total DPS = ${dps}` : "") + chargeWeaponText
    : `Effective = max(1, (Base(${normalAttackData.base}) + Bonus(${normalAttackData.bonus})${chargeText} - Armor(${normalAttackData.armorApplied}))${resistanceText}${debuffText}) = ${normalAttackData.value}` + (weapon ? `; DPS = ${dps}` : "") + chargeWeaponText;

  return {
    id: attacker.id,
    name: attacker.name,
    dps,
    dpsPerCost,
    hitsToKill,
    timeToKill,
    timeToKillExact: exactTimeToKill,
    effectiveDamagePerHit: normalAttackData.value,
    ...(firstAttackData.value !== normalAttackData.value ? { firstHitDamage: firstAttackData.value } : {}),
    bugAttackSpeed,
    cannotAttackUnits: false,
    formula,
    ...(thornsDPS > 0 ? { dpsContact: thornsDPS } : {}),
  };
}

// Computes the multiplier to equalize costs (± 10%)
export function calculateEqualCostMultipliers(costA: number, costB: number): { multA: number; multB: number; totalCostA: number; totalCostB: number } {
  if (costA <= 0 || costB <= 0) {
    return { multA: 1, multB: 1, totalCostA: costA, totalCostB: costB };
  }

  // Find the multiplier that equalizes costs (with 10% tolerance)
  // We look for integers multA and multB such that: |multA * costA - multB * costB| <= 0.10 * max(multA * costA, multB * costB)
  // Strategy: search for the best pair (multA, multB) within a reasonable range
  let bestMultA = 1;
  let bestMultB = 1;
  let bestDiff = Infinity;

  // Limit the search to reasonable multipliers (1 to 50 for instance)
  const maxMult = 50;

  for (let mA = 1; mA <= maxMult; mA++) {
    const targetCost = mA * costA;
    // Find the best mB
    const idealMB = targetCost / costB;
    const mB1 = Math.floor(idealMB);
    const mB2 = Math.ceil(idealMB);

    for (const mB of [mB1, mB2]) {
      if (mB < 1) continue;
      const totalA = mA * costA;
      const totalB = mB * costB;
      const maxTotal = Math.max(totalA, totalB);
      const diff = Math.abs(totalA - totalB);
      const tolerance = maxTotal * 0.10;

      // Check whether it is within tolerance and better than the previous best
      if (diff <= tolerance && diff < bestDiff) {
        bestDiff = diff;
        bestMultA = mA;
        bestMultB = mB;
      }
    }
  }

  return {
    multA: bestMultA,
    multB: bestMultB,
    totalCostA: bestMultA * costA,
    totalCostB: bestMultB * costB
  };
}

// Returns actual damage dealt by attacker to defender over a given duration,
// modelling hits discretely: first hit (with charge bonus) then normal hits.
// Secondary weapons are approximated as continuous DPS.
// When attackerNoTimer + timedDurationAttacker are provided, applies a two-phase correction:
// Phase 1 (0 → timedDurationAttacker): timed stats; Phase 2: noTimer stats.
function computeDamageInTime(
  attacker: CombatEntity,
  defender: CombatEntity,
  chargeBonus: number,
  duration: number,
  attackerNoTimer?: CombatEntity,
  timedDurationAttacker?: number,
): number {
  const firstData = computeEffectiveDamage(attacker, defender, chargeBonus, true);
  const normalData = computeEffectiveDamage(attacker, defender, 0, false);
  const rawSpeed = normalData.weapon?.speed ?? 0;
  const asDebuffFactor = 1 + (defender.opponentAttackSpeedDebuff ?? 0);
  const attackSpeed = rawSpeed * asDebuffFactor;
  if (attackSpeed <= 0) return 0;
  const chargeWeapon = getChargeWeapon(attacker);
  const hasChargeWeapon = !!chargeWeapon && (attacker.activeAbilities?.includes('charge-attack') ?? false);
  // Charging melee units without a dedicated charge weapon (e.g. spearman, horseman) pre-load
  // their attack windup during the sprint, so the first hit fires at contact (t=0).
  const isChargingMelee = !hasChargeWeapon && (attacker.activeAbilities?.includes('charge-attack') ?? false) && normalData.weapon?.type === 'melee';
  const firstHitSpeed = (hasChargeWeapon ? (chargeWeapon!.speed || rawSpeed) : isChargingMelee ? 0 : rawSpeed) * asDebuffFactor;
  const attackerTravelTime = isArcher(attacker) ? ARCHER_TRAVEL_TIME : 0;
  const effectiveDuration = duration - attackerTravelTime;
  if (effectiveDuration < firstHitSpeed) return 0;
  const totalAdditionalHits = Math.floor((effectiveDuration - firstHitSpeed) / attackSpeed);
  const firstHitDamage = defender.firstHitBlocked ? 0 : firstData.value;
  const normalDmgPerHit = normalData.value;

  // Two-phase correction: attacker's timed ability expires before the fight ends
  if (attackerNoTimer && timedDurationAttacker !== undefined && timedDurationAttacker < duration) {
    const noTimerNormalData = computeEffectiveDamage(attackerNoTimer, defender, 0, false);
    const noTimerDmgPerHit = noTimerNormalData.value;
    if (noTimerDmgPerHit !== normalDmgPerHit) {
      const effTimedDur = timedDurationAttacker - attackerTravelTime;
      // Hits whose shot lands at or before effTimedDur belong to Phase 1
      const hitsP1 = effTimedDur < firstHitSpeed
        ? 0
        : 1 + Math.floor((effTimedDur - firstHitSpeed) / attackSpeed);
      const hitsP2 = Math.max(0, (1 + totalAdditionalHits) - hitsP1);
      let total: number;
      if (hitsP1 >= 1) {
        total = firstHitDamage + (hitsP1 - 1) * normalDmgPerHit + hitsP2 * noTimerDmgPerHit;
      } else {
        // Timed ability expires before first hit — all hits use noTimer stats
        const noTimerFirstData = computeEffectiveDamage(attackerNoTimer, defender, chargeBonus, true);
        const noTimerFirstHitDamage = defender.firstHitBlocked ? 0 : noTimerFirstData.value;
        total = noTimerFirstHitDamage + (hitsP2 - 1) * noTimerDmgPerHit;
      }
      for (const secWeapon of (attacker.secondaryWeapons ?? [])) {
        if (!secWeapon.speed || secWeapon.speed <= 0) continue;
        const secData = computeEffectiveDamage(attacker, defender, 0, false, secWeapon);
        total += (secData.value / secWeapon.speed) * duration;
      }
      return total;
    }
  }

  let total = firstHitDamage + totalAdditionalHits * normalDmgPerHit;
  for (const secWeapon of (attacker.secondaryWeapons ?? [])) {
    if (!secWeapon.speed || secWeapon.speed <= 0) continue;
    const secData = computeEffectiveDamage(attacker, defender, 0, false, secWeapon);
    total += (secData.value / secWeapon.speed) * duration;
  }
  return total;
}

export function computeVersus(
  a: AoE4Unit | UnifiedVariation,
  b: AoE4Unit | UnifiedVariation,
  activeAbilitiesA?: string[],
  activeAbilitiesB?: string[],
  chargeBonusA: number = 0,
  chargeBonusB: number = 0,
  allowKiting: boolean = false,
  startDistance: number = START_DISTANCE,
  aNoTimer?: AoE4Unit | UnifiedVariation,
  bNoTimer?: AoE4Unit | UnifiedVariation,
  timedDurationA?: number,
  timedDurationB?: number,
): VersusResult {
  let A = toCombatEntity(a, activeAbilitiesA);
  let B = toCombatEntity(b, activeAbilitiesB);
  const AnoTimer = aNoTimer ? toCombatEntity(aNoTimer, activeAbilitiesA) : undefined;
  const BnoTimer = bNoTimer ? toCombatEntity(bNoTimer, activeAbilitiesB) : undefined;

  // Approach phase: ranged gets free shots while melee closes the gap
  const isMeleeA_approach = getMaxRange(A) < 1;
  const isMeleeB_approach = getMaxRange(B) < 1;
  let approachShotsForRanged = 0;
  if (isMeleeA_approach !== isMeleeB_approach && startDistance > 0) {
    const meleeEnt = isMeleeA_approach ? A : B;
    const rangedEnt = isMeleeA_approach ? B : A;
    const chargeBonusRanged = isMeleeA_approach ? chargeBonusB : chargeBonusA;
    const prelimMetrics = computeMetrics(rangedEnt, meleeEnt, chargeBonusRanged, 1, 1, false);
    const rangedRange = getMaxRange(rangedEnt);
    const T_free = Math.min(startDistance, rangedRange) / Math.max(0.1, meleeEnt.moveSpeed);
    const asRanged = (rangedEnt.weapons[0]?.speed ?? 0) * (1 + (meleeEnt.opponentAttackSpeedDebuff ?? 0));
    const wRanged = rangedEnt.weapons[0]?.durations?.windup ?? 0;
    // Subtract projectile travel time: only shots whose projectile lands ≤ T_free count as
    // approach damage. Mirrors the ARCHER_TRAVEL_TIME subtraction in computeDamageInTime.
    const approachTravelTime = isArcher(rangedEnt) ? ARCHER_TRAVEL_TIME : 0;
    const shotsDeadline = T_free - approachTravelTime;
    const shots = asRanged > 0 && shotsDeadline >= wRanged
      ? Math.floor((shotsDeadline - wRanged) / asRanged) + 1
      : 0;
    if (shots > 0 && prelimMetrics.effectiveDamagePerHit !== null) {
      const approachDmg = shots * prelimMetrics.effectiveDamagePerHit;
      const currentHp = meleeEnt.hitpoints * (meleeEnt.hpStartFraction ?? 1);
      const newFraction = Math.max(1 / meleeEnt.hitpoints, (currentHp - approachDmg) / meleeEnt.hitpoints);
      if (isMeleeA_approach) A = { ...A, hpStartFraction: newFraction };
      else B = { ...B, hpStartFraction: newFraction };
      approachShotsForRanged = shots;
    }
  }

  let metricsA = computeMetrics(A, B, chargeBonusA, 1, 1, true, AnoTimer, timedDurationA, BnoTimer, timedDurationB);
  let metricsB = computeMetrics(B, A, chargeBonusB, 1, 1, true, BnoTimer, timedDurationB, AnoTimer, timedDurationA);

  // Annotate the ranged unit's metrics with approach shots for display purposes
  if (approachShotsForRanged > 0) {
    if (isMeleeA_approach) metricsB = { ...metricsB, approachShots: approachShotsForRanged };
    else metricsA = { ...metricsA, approachShots: approachShotsForRanged };
  }

  // Apply movement / kiting adjustments (only when enabled)
  if (allowKiting) {
    ({ adjustedA: metricsA, adjustedB: metricsB } = applyKitingToMetrics(metricsA, metricsB, A, B, startDistance, AnoTimer, timedDurationA, BnoTimer, timedDurationB));
  }

  // Determine winner via TTK (lower wins), draw only if TTKs are exactly equal
  let winner: "draw" | "attacker" | "defender" = "draw";
  if (metricsA.cannotAttackUnits && metricsB.cannotAttackUnits) {
    winner = "draw";
  } else if (metricsA.cannotAttackUnits) {
    winner = "defender";
  } else if (metricsB.cannotAttackUnits) {
    winner = "attacker";
  } else if (!metricsA.bugAttackSpeed && !metricsB.bugAttackSpeed) {
    const tA = metricsA.timeToKill;
    const tB = metricsB.timeToKill;
    if (tA !== null && tB === null) {
      winner = "attacker"; // B can never kill A (kiting)
    } else if (tB !== null && tA === null) {
      winner = "defender"; // A can never kill B (kiting)
    } else if (tA !== null && tB !== null) {
      winner = tA === tB ? "draw" : (tA < tB ? "attacker" : "defender");
    }
  }

  let winnerHpRemaining: number | undefined;
  if (winner === "attacker" && metricsA.timeToKill !== null) {
    // Use exact (unrounded) TTK to avoid giving the loser one extra discrete hit due to rounding.
    // Pass B's noTimer + timedDuration so its damage is phase-corrected if it has a timed ability.
    const tA = metricsA.timeToKillExact ?? metricsA.timeToKill;
    const healingA = (metricsA.hitsToKill ?? 0) * (A.healingRate ?? 0)
      + tA * Math.max(0, A.healingRatePerSecond ?? 0);
    const startHpA = A.hitpoints * (A.hpStartFraction ?? 1);
    winnerHpRemaining = Math.min(A.hitpoints, Math.max(0, startHpA - computeDamageInTime(B, A, chargeBonusB, tA, BnoTimer, timedDurationB) + healingA));
  } else if (winner === "defender" && metricsB.timeToKill !== null) {
    const tB = metricsB.timeToKillExact ?? metricsB.timeToKill;
    const healingB = (metricsB.hitsToKill ?? 0) * (B.healingRate ?? 0)
      + tB * Math.max(0, B.healingRatePerSecond ?? 0);
    const startHpB = B.hitpoints * (B.hpStartFraction ?? 1);
    winnerHpRemaining = Math.min(B.hitpoints, Math.max(0, startHpB - computeDamageInTime(A, B, chargeBonusA, tB, AnoTimer, timedDurationA) + healingB));
  }

  return {
    attacker: metricsA,
    defender: metricsB,
    winner,
    winnerHpRemaining,
  };
}

// Compute versus with equal cost multipliers
export const aggregatedDPSModel: MultiUnitModel = {
  resolve(A, B, metricsA, metricsB, { multA, multB, totalCostA, totalCostB }) {
    let unitsRemainingA = 0;
    let unitsRemainingB = 0;
    let hpRemainingA = 0;
    let hpRemainingB = 0;

    if (metricsA.timeToKill !== null && metricsB.timeToKill !== null) {
      const combatDuration = Math.min(metricsA.timeToKill, metricsB.timeToKill);
      const totalHP_A = A.hitpoints * multA;
      const totalHP_B = B.hitpoints * multB;

      hpRemainingA = Math.max(0, totalHP_A - (metricsB.dps ?? 0) * combatDuration);
      unitsRemainingA = Math.floor(hpRemainingA / A.hitpoints);

      hpRemainingB = Math.max(0, totalHP_B - (metricsA.dps ?? 0) * combatDuration);
      unitsRemainingB = Math.floor(hpRemainingB / B.hitpoints);
    }

    let winner: "draw" | "attacker" | "defender" = "draw";
    let winnerHpRemaining: number | undefined;
    let winnerUnitsRemaining: number | undefined;
    let resourceDifference: number | undefined;

    if (unitsRemainingA > unitsRemainingB) {
      winner = "attacker";
      winnerHpRemaining = hpRemainingA;
      winnerUnitsRemaining = unitsRemainingA;
      resourceDifference = unitsRemainingA * (totalCostA / multA);
    } else if (unitsRemainingB > unitsRemainingA) {
      winner = "defender";
      winnerHpRemaining = hpRemainingB;
      winnerUnitsRemaining = unitsRemainingB;
      resourceDifference = unitsRemainingB * (totalCostB / multB);
    } else if (hpRemainingA > hpRemainingB) {
      winner = "attacker";
      winnerHpRemaining = hpRemainingA;
      winnerUnitsRemaining = 0;
    } else if (hpRemainingB > hpRemainingA) {
      winner = "defender";
      winnerHpRemaining = hpRemainingB;
      winnerUnitsRemaining = 0;
    }

    return { winner, winnerHpRemaining, winnerUnitsRemaining, resourceDifference };
  },
};

export function computeVersusAtEqualCost(
  a: AoE4Unit | UnifiedVariation,
  b: AoE4Unit | UnifiedVariation,
  activeAbilitiesA?: string[],
  activeAbilitiesB?: string[],
  chargeBonusA: number = 0,
  chargeBonusB: number = 0,
  allowKiting: boolean = false,
  startDistance: number = START_DISTANCE,
  model: MultiUnitModel = aggregatedDPSModel,
): VersusResult & { multipliers: { multA: number; multB: number; totalCostA: number; totalCostB: number } } {
  const A = toCombatEntity(a, activeAbilitiesA);
  const B = toCombatEntity(b, activeAbilitiesB);

  const costA = totalCost(A);
  const costB = totalCost(B);
  const multipliers = calculateEqualCostMultipliers(costA, costB);

  let metricsA = computeMetrics(A, B, chargeBonusA, multipliers.multA, multipliers.multB);
  let metricsB = computeMetrics(B, A, chargeBonusB, multipliers.multB, multipliers.multA);

  if (allowKiting) {
    ({ adjustedA: metricsA, adjustedB: metricsB } = applyKitingToMetrics(metricsA, metricsB, A, B, startDistance));
  }

  // Special case: one side cannot attack units (e.g. ram)
  if (metricsA.cannotAttackUnits || metricsB.cannotAttackUnits) {
    const winner: "draw" | "attacker" | "defender" =
      metricsA.cannotAttackUnits && metricsB.cannotAttackUnits ? "draw" :
        metricsA.cannotAttackUnits ? "defender" : "attacker";
    return { attacker: metricsA, defender: metricsB, winner, multipliers };
  }

  // Kiting: one side can never deal damage → immediate winner
  if (!metricsA.bugAttackSpeed && !metricsB.bugAttackSpeed) {
    if (metricsA.timeToKill !== null && metricsB.timeToKill === null) {
      return { attacker: metricsA, defender: metricsB, winner: "attacker", multipliers };
    } else if (metricsB.timeToKill !== null && metricsA.timeToKill === null) {
      return { attacker: metricsA, defender: metricsB, winner: "defender", multipliers };
    }
  }

  // Approach phase: when one side is ranged and the other is melee, ranged gets free shots
  // while melee closes the gap. T_free_shots = min(startDistance, rangedRange) / melee.moveSpeed.
  // Damage distributed evenly across melee units; result injected as hpStartFraction.
  let resolveA: CombatEntity = A;
  let resolveB: CombatEntity = B;

  const isMeleeA_approach = getMaxRange(A) < 1;
  const isMeleeB_approach = getMaxRange(B) < 1;

  if (isMeleeA_approach !== isMeleeB_approach && startDistance > 0) {
    const meleeEnt = isMeleeA_approach ? A : B;
    const rangedEnt = isMeleeA_approach ? B : A;
    const metRanged = isMeleeA_approach ? metricsB : metricsA;
    const multMelee = isMeleeA_approach ? multipliers.multA : multipliers.multB;
    const multRanged = isMeleeA_approach ? multipliers.multB : multipliers.multA;

    const rangedRange = getMaxRange(rangedEnt);
    const T_free = Math.min(startDistance, rangedRange) / Math.max(0.1, meleeEnt.moveSpeed ?? 1.5);
    const asRanged = (rangedEnt.weapons[0]?.speed ?? 0) * (1 + (meleeEnt.opponentAttackSpeedDebuff ?? 0));
    const wRanged = rangedEnt.weapons[0]?.durations?.windup ?? 0;
    const approachTravelTimeEc = isArcher(rangedEnt) ? ARCHER_TRAVEL_TIME : 0;
    const shotsDeadlineEc = T_free - approachTravelTimeEc;
    const shots = asRanged > 0 && shotsDeadlineEc >= wRanged
      ? Math.floor((shotsDeadlineEc - wRanged) / asRanged) + 1
      : 0;

    if (shots > 0) {
      const totalApproachDmg = multRanged * shots * metRanged.effectiveDamagePerHit;
      const dmgPerMelee = totalApproachDmg / multMelee;
      const currentHp = meleeEnt.hitpoints * (meleeEnt.hpStartFraction ?? 1);
      const newFraction = Math.max(1 / meleeEnt.hitpoints, (currentHp - dmgPerMelee) / meleeEnt.hitpoints);

      if (isMeleeA_approach) resolveA = { ...A, hpStartFraction: newFraction };
      else resolveB = { ...B, hpStartFraction: newFraction };
    }
  }

  const resolved = model.resolve(resolveA, resolveB, metricsA, metricsB, multipliers);

  return { attacker: metricsA, defender: metricsB, multipliers, ...resolved };
}

// Focus-fire: discrete attack-cycle simulation.
// Both sides fire in synchronized volleys (all units of a side fire together).
// Each side concentrates fire on one target at a time; when it dies the next one is targeted.
// tA / tB advance by attackSpeed each shot — no fractional attacks.
export const focusFireModel: MultiUnitModel = {
  resolve(A, B, metricsA, metricsB, { multA, multB, totalCostA, totalCostB }) {
    const dmgA = metricsA.effectiveDamagePerHit;
    const dmgB = metricsB.effectiveDamagePerHit;
    const asA = (A.weapons[0]?.speed ?? 0) * (1 + (B.opponentAttackSpeedDebuff ?? 0));
    const asB = (B.weapons[0]?.speed ?? 0) * (1 + (A.opponentAttackSpeedDebuff ?? 0));

    if (!dmgA || !dmgB || dmgA <= 0 || dmgB <= 0 || asA <= 0 || asB <= 0) {
      return aggregatedDPSModel.resolve(A, B, metricsA, metricsB, { multA, multB, totalCostA, totalCostB });
    }

    const firstDmgA = metricsA.firstHitDamage ?? dmgA;
    const firstDmgB = metricsB.firstHitDamage ?? dmgB;

    // Travel time: ranged projectiles keep flying even if the shooter dies.
    // When A fires alone and kills B, if B's next shot falls within A's travel time window,
    // B's projectile was already committed (in-flight) and still lands.
    const travelTimeA = isArcher(A) ? ARCHER_TRAVEL_TIME : 0;
    const travelTimeB = isArcher(B) ? ARCHER_TRAVEL_TIME : 0;

    // Windup offset: damage lands at cycle_start + windup, not at cycle_start.
    // Two units with different windups can have their attacks land simultaneously even when
    // their cycle starts are staggered (e.g. horseman windup=0.25s, GK windup=0.5s means
    // a horseman cycle starting 0.25s after a GK cycle still lands at the same time).
    // Priority is determined by when damage actually lands, not when the cycle starts.
    const windupA = A.weapons[0]?.durations?.windup ?? 0;
    const windupB = B.weapons[0]?.durations?.windup ?? 0;

    const startHpA = A.hitpoints * (A.hpStartFraction ?? 1);
    const startHpB = B.hitpoints * (B.hpStartFraction ?? 1);

    let deadA = 0, deadB = 0;
    let remA = multA, remB = multB;
    let hpTargetA = startHpA; // HP of the A unit currently focused by B
    let hpTargetB = startHpB; // HP of the B unit currently focused by A

    // kA / kB = shot index; tA = kA * asA is the time of the next A volley
    let kA = 0, kB = 0;
    let tA = 0, tB = 0;

    // Track when each side's last unit was killed (for tiebreak when both reach 0)
    let tKillOfLastB = Infinity; // time A killed B's last unit
    let tKillOfLastA = Infinity; // time B killed A's last unit
    // HP of the winner's current target (pre-travel-shot) at the decisive kill moment
    let hpWinnerAtKillOfLastB = 0;
    let hpWinnerAtKillOfLastA = 0;
    let remAAtKillOfLastB = 0; // remA (pre-decrement) when B's last unit died
    let remBAtKillOfLastA = 0; // remB (pre-decrement snapshot) when A's last unit died

    // Upper bound: at most (multA + multB) kills, each requiring at most ~200 shots
    const MAX_ITER = (multA + multB) * 200 + 500;
    for (let iter = 0; iter < MAX_ITER; iter++) {
      if (remA <= 0 || remB <= 0) break;

      const tA_adj = tA + windupA;
      const tB_adj = tB + windupB;
      const fireA = tA_adj <= tB_adj;
      const fireB = tB_adj <= tA_adj;

      // Both fire simultaneously when damage lands at the same time; applied before resolving deaths
      if (fireA) hpTargetB -= remA * (kA === 0 ? firstDmgA : dmgA);
      if (fireB) hpTargetA -= remB * (kB === 0 ? firstDmgB : dmgB);

      // Snapshot HP after direct hits, before any in-flight projectile modifies them.
      // Used to recover the winner's HP at the decisive kill moment.
      const hpA_pre = hpTargetA;
      const hpB_pre = hpTargetB;

      // Last projectile in flight: when A fires alone and kills B's target, B's projectile
      // was already committed if B's next shot falls within A's travel time window.
      if (fireA && !fireB && hpTargetB <= 0 && remB > 0 && travelTimeA > 0 && (tB - tA) <= travelTimeA) {
        hpTargetA -= remB * dmgB;
      }
      if (fireB && !fireA && hpTargetA <= 0 && remA > 0 && travelTimeB > 0 && (tA - tB) <= travelTimeB) {
        hpTargetB -= remA * dmgA;
      }

      if (fireA) { kA++; tA = kA * asA; }
      if (fireB) { kB++; tB = kB * asB; }

      // Snapshot rem before deaths are resolved so both blocks see the pre-decrement values.
      const remA_snap = remA;
      const remB_snap = remB;

      // Resolve deaths (simultaneous kills handled correctly — both decrement)
      if (hpTargetB <= 0) {
        deadB++;
        remB = multB - deadB;
        hpTargetB = remB > 0 ? startHpB : 0;
        if (remB === 0) {
          tKillOfLastB = tA_adj;
          hpWinnerAtKillOfLastB = hpA_pre;
          remAAtKillOfLastB = remA_snap;
        }
      }
      if (hpTargetA <= 0) {
        deadA++;
        remA = multA - deadA;
        hpTargetA = remA > 0 ? startHpA : 0;
        if (remA === 0) {
          tKillOfLastA = tB_adj;
          hpWinnerAtKillOfLastA = hpB_pre;
          remBAtKillOfLastA = remB_snap;
        }
      }
    }

    const totalHpA = remA > 0 ? (remA - 1) * startHpA + Math.max(0, hpTargetA) : 0;
    const totalHpB = remB > 0 ? (remB - 1) * startHpB + Math.max(0, hpTargetB) : 0;

    let winner: "draw" | "attacker" | "defender" = "draw";
    let winnerHpRemaining: number | undefined;
    let winnerUnitsRemaining: number | undefined;
    let resourceDifference: number | undefined;

    if (remA > remB) {
      winner = "attacker";
      winnerHpRemaining = totalHpA;
      winnerUnitsRemaining = remA;
      resourceDifference = remA * (totalCostA / multA);
    } else if (remB > remA) {
      winner = "defender";
      winnerHpRemaining = totalHpB;
      winnerUnitsRemaining = remB;
      resourceDifference = remB * (totalCostB / multB);
    } else if (remA === 0 && remB === 0) {
      // Both sides died: winner is whoever killed the opponent's last unit first.
      // HP remaining = winner's HP at the decisive kill moment (before in-flight shot landed).
      if (tKillOfLastB < tKillOfLastA) {
        winner = "attacker";
        winnerHpRemaining = (remAAtKillOfLastB - 1) * startHpA + Math.max(0, hpWinnerAtKillOfLastB);
        winnerUnitsRemaining = remAAtKillOfLastB;
        resourceDifference = remAAtKillOfLastB * (totalCostA / multA);
      } else if (tKillOfLastA < tKillOfLastB) {
        winner = "defender";
        winnerHpRemaining = (remBAtKillOfLastA - 1) * startHpB + Math.max(0, hpWinnerAtKillOfLastA);
        winnerUnitsRemaining = remBAtKillOfLastA;
        resourceDifference = remBAtKillOfLastA * (totalCostB / multB);
      }
      // else: genuinely simultaneous (tA_adj === tB_adj) → draw
    } else if (totalHpA > totalHpB) {
      // MAX_ITER edge case: same units remaining (>0), HP tiebreak
      winner = "attacker";
      winnerHpRemaining = totalHpA;
      winnerUnitsRemaining = 0;
    } else if (totalHpB > totalHpA) {
      winner = "defender";
      winnerHpRemaining = totalHpB;
      winnerUnitsRemaining = 0;
    }

    return { winner, winnerHpRemaining, winnerUnitsRemaining, resourceDifference };
  },
};

// ─── Focus-Fire Batches helpers ──────────────────────────────────────────────

const MC_ITERATIONS = 200;

function createBatchesFF(hpA: number[], hpB: number[]): Array<{ hpA: number[]; hpB: number[] }> {
  const nA = hpA.length, nB = hpB.length;
  const batches: Array<{ hpA: number[]; hpB: number[] }> = [];
  if (nA >= nB) {
    const base = Math.floor(nA / nB), extra = nA % nB;
    let ai = 0;
    for (let i = 0; i < nB; i++) {
      const c = i < extra ? base + 1 : base;
      batches.push({ hpA: hpA.slice(ai, ai + c), hpB: [hpB[i]] });
      ai += c;
    }
  } else {
    const base = Math.floor(nB / nA), extra = nB % nA;
    let bi = 0;
    for (let i = 0; i < nA; i++) {
      const c = i < extra ? base + 1 : base;
      batches.push({ hpA: [hpA[i]], hpB: hpB.slice(bi, bi + c) });
      bi += c;
    }
  }
  return batches;
}

// Uniform random composition of N into k positive-integer parts.
function randomPartition(N: number, k: number): number[] {
  if (k === 1) return [N];
  // Pick k-1 distinct cut points from {1..N-1} via partial Fisher-Yates
  const gaps = Array.from({ length: N - 1 }, (_, i) => i + 1);
  for (let i = 0; i < k - 1; i++) {
    const j = i + Math.floor(rng() * (gaps.length - i));
    [gaps[i], gaps[j]] = [gaps[j], gaps[i]];
  }
  const cuts = gaps.slice(0, k - 1).sort((a, b) => a - b);
  cuts.push(N);
  let prev = 0;
  return cuts.map(c => { const s = c - prev; prev = c; return s; });
}

// Random batch formation: nBatches drawn uniformly from [1, min(nA,nB)];
// both sides independently partitioned into nBatches non-empty groups.
function createBatchesGrouped(hpA: number[], hpB: number[]): Array<{ hpA: number[]; hpB: number[] }> {
  const nA = hpA.length, nB = hpB.length;
  const nBatches = Math.floor(rng() * Math.min(nA, nB)) + 1;
  const sA = [...hpA].sort(() => rng() - 0.5);
  const sB = [...hpB].sort(() => rng() - 0.5);
  const sizesA = randomPartition(nA, nBatches);
  const sizesB = randomPartition(nB, nBatches);
  let offA = 0, offB = 0;
  return Array.from({ length: nBatches }, (_, b) => {
    const batch = { hpA: sA.slice(offA, offA + sizesA[b]), hpB: sB.slice(offB, offB + sizesB[b]) };
    offA += sizesA[b]; offB += sizesB[b];
    return batch;
  });
}

// Returns time of first death in this batch (either side).
// A side fires as a volley of aC units; B side as a volley of bC units.
function batchFirstDeathTime(
  hpA: number[], hpB: number[],
  dmgA: number, dmgB: number,
  fDmgA: number, fDmgB: number,
  asA: number, asB: number,
  wA: number, wB: number,
): number {
  const aC = hpA.length, bC = hpB.length;
  const remB = hpB[0] - aC * fDmgA;
  const T_B = remB <= 0 ? wA : wA + Math.ceil(remB / (aC * dmgA)) * asA;
  const remA = hpA[0] - bC * fDmgB;
  const T_A = remA <= 0 ? wB : wB + Math.ceil(remA / (bC * dmgB)) * asB;
  return Math.min(T_A, T_B);
}

// Advances a batch to time T: returns HP after T seconds of combat.
// Units that die (HP <= 0) are included — caller filters them out.
function advanceBatchFF(
  hpA: number[], hpB: number[],
  T: number,
  dmgA: number, dmgB: number,
  fDmgA: number, fDmgB: number,
  asA: number, asB: number,
  wA: number, wB: number,
): { hpA: number[]; hpB: number[] } {
  const aC = hpA.length, bC = hpB.length;
  const sA = T >= wA ? Math.floor((T - wA) / asA) + 1 : 0;
  const sB = T >= wB ? Math.floor((T - wB) / asB) + 1 : 0;
  const dToA = sB > 0 ? bC * (fDmgB + Math.max(0, sB - 1) * dmgB) : 0;
  const newHpA = [...hpA];
  const newHpB = [...hpB];
  newHpA[0] -= dToA;
  // A-side: shots spill over to the next B target when the current one dies
  let bTarget = 0;
  for (let shot = 0; shot < sA && bTarget < newHpB.length; shot++) {
    newHpB[bTarget] -= (shot === 0 ? fDmgA : dmgA) * aC;
    if (newHpB[bTarget] <= 0) bTarget++;
  }
  return { hpA: newHpA, hpB: newHpB };
}

function buildBatchResult(
  remA: number, remB: number,
  totalHpA: number, totalHpB: number,
  multA: number, multB: number,
  totalCostA: number, totalCostB: number,
): Pick<VersusResult, 'winner' | 'winnerHpRemaining' | 'winnerUnitsRemaining' | 'resourceDifference'> {
  let winner: "draw" | "attacker" | "defender" = "draw";
  let winnerHpRemaining: number | undefined;
  let winnerUnitsRemaining: number | undefined;
  let resourceDifference: number | undefined;
  if (remA > remB) {
    winner = "attacker"; winnerHpRemaining = totalHpA; winnerUnitsRemaining = remA;
    resourceDifference = remA * (totalCostA / multA);
  } else if (remB > remA) {
    winner = "defender"; winnerHpRemaining = totalHpB; winnerUnitsRemaining = remB;
    resourceDifference = remB * (totalCostB / multB);
  } else if (totalHpA > totalHpB) {
    winner = "attacker"; winnerHpRemaining = totalHpA; winnerUnitsRemaining = 0;
  } else if (totalHpB > totalHpA) {
    winner = "defender"; winnerHpRemaining = totalHpB; winnerUnitsRemaining = 0;
  }
  return { winner, winnerHpRemaining, winnerUnitsRemaining, resourceDifference };
}

// Asymmetric simulation: ranged side (conc) concentrates all fire on one melee target at a
// time; melee side (dist) distributes — each unit independently attacks a different ranged
// target (round-robin initial assignment, retargets to next alive on death).
function simulateAsymmetricFF(
  nConc: number, startHpConc: number,
  dmgConc: number, fDmgConc: number, asConc: number, wConc: number,
  nDist: number, startHpDist: number,
  dmgDist: number, fDmgDist: number, asDist: number, wDist: number,
): { hpConc: number[]; hpDist: number[] } {
  const hpConc: number[] = Array(nConc).fill(startHpConc);
  const hpDist: number[] = Array(nDist).fill(startHpDist);
  const aliveConc: boolean[] = Array(nConc).fill(true);
  const aliveDist: boolean[] = Array(nDist).fill(true);
  const distTargets: number[] = Array.from({ length: nDist }, (_, i) => i % nConc);

  let concFocus = 0;
  let remConc = nConc, remDist = nDist;
  let tConc = wConc, tDist = wDist;
  let kConc = 0, kDist = 0;

  function nextAliveConc(fromIdx: number): number {
    for (let c = 1; c <= nConc; c++) {
      const idx = (fromIdx + c) % nConc;
      if (aliveConc[idx]) return idx;
    }
    return -1;
  }

  while (concFocus < nDist && !aliveDist[concFocus]) concFocus++;

  const MAX_ITER = (nConc + nDist) * 300 + 100;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    if (concFocus >= nDist || remConc <= 0) break;

    const fireConc = tConc <= tDist;
    const fireDist = tDist <= tConc;

    if (fireConc) {
      hpDist[concFocus] -= remConc * (kConc === 0 ? fDmgConc : dmgConc);
      kConc++; tConc = wConc + kConc * asConc;
    }

    if (fireDist) {
      const dmg = kDist === 0 ? fDmgDist : dmgDist;
      for (let i = 0; i < nDist; i++) {
        if (!aliveDist[i]) continue;
        const t = distTargets[i];
        if (t >= 0 && aliveConc[t]) hpConc[t] -= dmg;
      }
      kDist++; tDist = wDist + kDist * asDist;
    }

    // Resolve focused dist death
    if (aliveDist[concFocus] && hpDist[concFocus] <= 0) {
      aliveDist[concFocus] = false; remDist--;
      concFocus++;
      while (concFocus < nDist && !aliveDist[concFocus]) concFocus++;
    }

    // Resolve conc deaths and retarget orphaned dist units
    for (let i = 0; i < nConc; i++) {
      if (aliveConc[i] && hpConc[i] <= 0) {
        aliveConc[i] = false; remConc--;
        const next = nextAliveConc(i);
        for (let j = 0; j < nDist; j++) {
          if (distTargets[j] === i) distTargets[j] = next;
        }
      }
    }
  }

  return { hpConc, hpDist };
}


function computeMCWinnerStats(
  results: Array<Pick<VersusResult, 'winner' | 'winnerHpRemaining' | 'winnerUnitsRemaining' | 'resourceDifference'>>,
  side: 'attacker' | 'defender',
): MCOutcomeStats | undefined {
  const sub = results.filter(r => r.winner === side);
  if (!sub.length) return undefined;
  const asc = (arr: number[]) => [...arr].sort((a, b) => a - b);
  const med = (arr: number[]) => arr[Math.floor(arr.length / 2)];
  const std = (arr: number[]) => {
    const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
    return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length);
  };
  const uArr = asc(sub.map(r => r.winnerUnitsRemaining ?? 0));
  const hArr = asc(sub.map(r => r.winnerHpRemaining ?? 0));
  const rArr = asc(sub.map(r => r.resourceDifference ?? 0));
  return {
    unitsMedian: med(uArr), unitsStd: std(uArr),
    hpMedian: med(hArr), hpStd: std(hArr),
    resourceMedian: med(rArr), resourceStd: std(rArr),
  };
}

// Batches Monte Carlo: runs MC_ITERATIONS simulations with random batch assignment.
// Both-melee / Both-ranged: each majority unit is independently assigned to a random batch
// (multinomial), so batch sizes vary across iterations — models the real variance in unit clustering.
// Asymmetric (ranged vs melee): deterministic symmetric batch model — both sides fight via batches
// (no focus-fire distinction; ranged units are distributed across batches like melee).
// Returns the median representative result + mcDistribution with win rates.
export const focusFireBatchesMCModel: MultiUnitModel = {
  resolve(A, B, metricsA, metricsB, { multA, multB, totalCostA, totalCostB }) {
    const dmgA = metricsA.effectiveDamagePerHit;
    const dmgB = metricsB.effectiveDamagePerHit;
    const asA = (A.weapons[0]?.speed ?? 0) * (1 + (B.opponentAttackSpeedDebuff ?? 0));
    const asB = (B.weapons[0]?.speed ?? 0) * (1 + (A.opponentAttackSpeedDebuff ?? 0));

    if (!dmgA || !dmgB || dmgA <= 0 || dmgB <= 0 || asA <= 0 || asB <= 0)
      return aggregatedDPSModel.resolve(A, B, metricsA, metricsB, { multA, multB, totalCostA, totalCostB });

    const isMeleeA = getMaxRange(A) < 1;
    const isMeleeB = getMaxRange(B) < 1;

    const fDmgA = metricsA.firstHitDamage ?? dmgA;
    const fDmgB = metricsB.firstHitDamage ?? dmgB;
    const startHpA = A.hitpoints * (A.hpStartFraction ?? 1);
    const startHpB = B.hitpoints * (B.hpStartFraction ?? 1);

    // Asymmetric (one ranged, one melee): deterministic symmetric batch model — both sides
    // fight via batches, no focus-fire distinction between ranged and melee.
    if (isMeleeA !== isMeleeB) {
      let hpA: number[] = Array(multA).fill(startHpA);
      let hpB: number[] = Array(multB).fill(startHpB);
      const MAX_PHASES = (multA + multB) * 3 + 50;
      for (let phase = 0; phase < MAX_PHASES; phase++) {
        if (!hpA.length || !hpB.length) break;
        const cFA = phase === 0 ? fDmgA : dmgA;
        const cFB = phase === 0 ? fDmgB : dmgB;
        const batches = createBatchesFF(hpA, hpB);
        const T = Math.min(...batches.map(b =>
          batchFirstDeathTime(b.hpA, b.hpB, dmgA, dmgB, cFA, cFB, asA, asB, 0, 0)
        ));
        if (!isFinite(T)) break;
        const nHA: number[] = [], nHB: number[] = [];
        for (const b of batches) {
          const r = advanceBatchFF(b.hpA, b.hpB, T, dmgA, dmgB, cFA, cFB, asA, asB, 0, 0);
          nHA.push(...r.hpA); nHB.push(...r.hpB);
        }
        hpA = nHA.filter(h => h > 0);
        hpB = nHB.filter(h => h > 0);
      }
      const det = buildBatchResult(
        hpA.length, hpB.length,
        hpA.reduce((s, h) => s + h, 0), hpB.reduce((s, h) => s + h, 0),
        multA, multB, totalCostA, totalCostB,
      );
      const single = [det];
      return {
        ...det, mcDistribution: {
          winRateA: det.winner === 'attacker' ? 1 : 0,
          winRateB: det.winner === 'defender' ? 1 : 0,
          drawRate: det.winner === 'draw' ? 1 : 0,
          iterations: 1,
          whenAWins: computeMCWinnerStats(single, 'attacker'),
          whenBWins: computeMCWinnerStats(single, 'defender'),
        }
      };
    }

    // Event-driven MC: batches run in parallel; when one batch finishes, its survivors
    // immediately join a random ongoing batch rather than waiting for all to finish.
    type ActiveBatch = { hpA: number[]; hpB: number[]; firstShotUsed: boolean };
    type IterResult = ReturnType<typeof buildBatchResult>;
    const results: IterResult[] = [];
    const durations: number[] = [];
    const MAX_STEPS = (multA + multB) * 2 + 10;
    seedRng(MC_SEED);

    for (let iter = 0; iter < MC_ITERATIONS; iter++) {
      let timeElapsed = 0;
      const init = createBatchesGrouped(
        Array(multA).fill(startHpA),
        Array(multB).fill(startHpB)
      );

      const active: ActiveBatch[] = init.map(b => ({ hpA: b.hpA.slice(), hpB: b.hpB.slice(), firstShotUsed: false }));
      const pendingA: number[] = [];
      const pendingB: number[] = [];

      for (let step = 0; step < MAX_STEPS && active.length > 0; step++) {
        const T = Math.min(...active.map(b => {
          const cFA = b.firstShotUsed ? dmgA : fDmgA;
          const cFB = b.firstShotUsed ? dmgB : fDmgB;
          return batchFirstDeathTime(b.hpA, b.hpB, dmgA, dmgB, cFA, cFB, asA, asB, 0, 0);
        }));
        if (!isFinite(T)) break;
        timeElapsed += T;

        const nextActive: ActiveBatch[] = [];

        for (const b of active) {
          const cFA = b.firstShotUsed ? dmgA : fDmgA;
          const cFB = b.firstShotUsed ? dmgB : fDmgB;
          const r = advanceBatchFF(b.hpA, b.hpB, T, dmgA, dmgB, cFA, cFB, asA, asB, 0, 0);
          const nA = r.hpA.filter(h => h > 0);
          const nB = r.hpB.filter(h => h > 0);

          if (nA.length > 0 && nB.length > 0) {
            nextActive.push({ hpA: nA, hpB: nB, firstShotUsed: true });
          } else {
            // Batch done: survivors join a random ongoing batch
            for (const hp of nA) {
              if (nextActive.length > 0) nextActive[Math.floor(rng() * nextActive.length)].hpA.push(hp);
              else pendingA.push(hp);
            }
            for (const hp of nB) {
              if (nextActive.length > 0) nextActive[Math.floor(rng() * nextActive.length)].hpB.push(hp);
              else pendingB.push(hp);
            }
          }
        }

        // All batches finished simultaneously: start new batches from pending survivors
        if (nextActive.length === 0 && pendingA.length > 0 && pendingB.length > 0) {
          const newBatches = createBatchesGrouped(pendingA, pendingB);
          pendingA.length = 0;
          pendingB.length = 0;
          for (const b of newBatches)
            nextActive.push({ hpA: b.hpA.slice(), hpB: b.hpB.slice(), firstShotUsed: false });
        }

        // Flush any remaining pending into active batches
        for (const hp of pendingA.splice(0)) {
          if (nextActive.length > 0) nextActive[Math.floor(rng() * nextActive.length)].hpA.push(hp);
          else pendingA.push(hp);
        }
        for (const hp of pendingB.splice(0)) {
          if (nextActive.length > 0) nextActive[Math.floor(rng() * nextActive.length)].hpB.push(hp);
          else pendingB.push(hp);
        }

        active.length = 0;
        active.push(...nextActive);
      }

      const finalA = [...pendingA, ...active.flatMap(b => b.hpA)].filter(h => h > 0);
      const finalB = [...pendingB, ...active.flatMap(b => b.hpB)].filter(h => h > 0);

      results.push(buildBatchResult(
        finalA.length, finalB.length,
        finalA.reduce((s, h) => s + h, 0),
        finalB.reduce((s, h) => s + h, 0),
        multA, multB, totalCostA, totalCostB,
      ));
      if (timeElapsed > 0) durations.push(timeElapsed);
    }

    const nWinA = results.filter(r => r.winner === 'attacker').length;
    const nWinB = results.filter(r => r.winner === 'defender').length;
    const nDraw = results.filter(r => r.winner === 'draw').length;
    const n = results.length;
    const mcDistribution: MCDistribution = {
      winRateA: nWinA / n,
      winRateB: nWinB / n,
      drawRate: nDraw / n,
      iterations: n,
      durationMin: durations.length ? Math.min(...durations) : undefined,
      durationMax: durations.length ? Math.max(...durations) : undefined,
      whenAWins: computeMCWinnerStats(results, 'attacker'),
      whenBWins: computeMCWinnerStats(results, 'defender'),
    };

    // Representative result: median of the modal outcome (by units then HP remaining)
    const modeWinner = nWinA >= nWinB && nWinA >= nDraw ? 'attacker'
      : nWinB > nWinA && nWinB >= nDraw ? 'defender'
        : 'draw';
    const modeResults = results.filter(r => r.winner === modeWinner);
    modeResults.sort((a, b) =>
      (b.winnerUnitsRemaining ?? 0) - (a.winnerUnitsRemaining ?? 0) ||
      (b.winnerHpRemaining ?? 0) - (a.winnerHpRemaining ?? 0)
    );
    const median = modeResults[Math.floor(modeResults.length / 2)];

    return { ...median, mcDistribution };
  },
};

// Batches MC Asymétrique: MC model dedicated to ranged vs melee.
// Melee: floor/ceil across min(5, nMelee) batches (naturally 1–3 per ranged when nMelee ≤ 15).
// Ranged: biased multinomial — each unit independently assigned to a random batch,
//   expected = nRanged / min(5, nMelee) per batch. Batches with 0 ranged: melee idle (survive).
// Symmetric cases fall back to focusFireBatchesMCModel.
export const focusFireBatchesMCAsymmetricModel: MultiUnitModel = {
  resolve(A, B, metricsA, metricsB, { multA, multB, totalCostA, totalCostB }) {
    const dmgA = metricsA.effectiveDamagePerHit;
    const dmgB = metricsB.effectiveDamagePerHit;
    const asA = (A.weapons[0]?.speed ?? 0) * (1 + (B.opponentAttackSpeedDebuff ?? 0));
    const asB = (B.weapons[0]?.speed ?? 0) * (1 + (A.opponentAttackSpeedDebuff ?? 0));

    if (!dmgA || !dmgB || dmgA <= 0 || dmgB <= 0 || asA <= 0 || asB <= 0)
      return aggregatedDPSModel.resolve(A, B, metricsA, metricsB, { multA, multB, totalCostA, totalCostB });

    const isMeleeA = getMaxRange(A) < 1;
    const isMeleeB = getMaxRange(B) < 1;

    if (isMeleeA === isMeleeB)
      return focusFireBatchesMCModel.resolve(A, B, metricsA, metricsB, { multA, multB, totalCostA, totalCostB });

    const fDmgA = metricsA.firstHitDamage ?? dmgA;
    const fDmgB = metricsB.firstHitDamage ?? dmgB;
    const startHpA = A.hitpoints * (A.hpStartFraction ?? 1);
    const startHpB = B.hitpoints * (B.hpStartFraction ?? 1);

    const nMelee = isMeleeA ? multA : multB;
    const nRanged = isMeleeA ? multB : multA;

    type ActiveBatch = { hpA: number[]; hpB: number[]; firstShotUsed: boolean };
    type IterResult = ReturnType<typeof buildBatchResult>;
    const results: IterResult[] = [];
    const durations: number[] = [];
    const MAX_STEPS = (multA + multB) * 2 + 10;
    seedRng(MC_SEED);

    for (let iter = 0; iter < MC_ITERATIONS; iter++) {
      let timeElapsed = 0;

      const hpMeleeAll = Array(nMelee).fill(isMeleeA ? startHpA : startHpB);
      const hpRangedAll = Array(nRanged).fill(isMeleeA ? startHpB : startHpA);
      const groups = createBatchesGrouped(hpMeleeAll, hpRangedAll);
      const active: ActiveBatch[] = groups.map(g => ({
        hpA: isMeleeA ? g.hpA.slice() : g.hpB.slice(),
        hpB: isMeleeA ? g.hpB.slice() : g.hpA.slice(),
        firstShotUsed: false,
      }));

      const pendingA: number[] = [];
      const pendingB: number[] = [];

      for (let step = 0; step < MAX_STEPS && active.length > 0; step++) {
        const T = Math.min(...active.map(b => {
          const cFA = b.firstShotUsed ? dmgA : fDmgA;
          const cFB = b.firstShotUsed ? dmgB : fDmgB;
          return batchFirstDeathTime(b.hpA, b.hpB, dmgA, dmgB, cFA, cFB, asA, asB, 0, 0);
        }));
        if (!isFinite(T)) break;
        timeElapsed += T;

        const nextActive: ActiveBatch[] = [];
        for (const b of active) {
          const cFA = b.firstShotUsed ? dmgA : fDmgA;
          const cFB = b.firstShotUsed ? dmgB : fDmgB;
          const r = advanceBatchFF(b.hpA, b.hpB, T, dmgA, dmgB, cFA, cFB, asA, asB, 0, 0);
          const nA = r.hpA.filter(h => h > 0);
          const nB = r.hpB.filter(h => h > 0);
          if (nA.length > 0 && nB.length > 0) {
            nextActive.push({ hpA: nA, hpB: nB, firstShotUsed: true });
          } else {
            for (const hp of nA) {
              if (nextActive.length > 0) nextActive[Math.floor(rng() * nextActive.length)].hpA.push(hp);
              else pendingA.push(hp);
            }
            for (const hp of nB) {
              if (nextActive.length > 0) nextActive[Math.floor(rng() * nextActive.length)].hpB.push(hp);
              else pendingB.push(hp);
            }
          }
        }

        if (nextActive.length === 0 && pendingA.length > 0 && pendingB.length > 0) {
          const newBatches = createBatchesGrouped(pendingA, pendingB);
          pendingA.length = 0; pendingB.length = 0;
          for (const b of newBatches) {
            if (b.hpA.length > 0 && b.hpB.length > 0)
              nextActive.push({ hpA: b.hpA.slice(), hpB: b.hpB.slice(), firstShotUsed: false });
            else { pendingA.push(...b.hpA); pendingB.push(...b.hpB); }
          }
        }
        for (const hp of pendingA.splice(0)) {
          if (nextActive.length > 0) nextActive[Math.floor(rng() * nextActive.length)].hpA.push(hp);
          else pendingA.push(hp);
        }
        for (const hp of pendingB.splice(0)) {
          if (nextActive.length > 0) nextActive[Math.floor(rng() * nextActive.length)].hpB.push(hp);
          else pendingB.push(hp);
        }
        active.length = 0;
        active.push(...nextActive);
      }

      const finalA = [...pendingA, ...active.flatMap(b => b.hpA)].filter(h => h > 0);
      const finalB = [...pendingB, ...active.flatMap(b => b.hpB)].filter(h => h > 0);

      results.push(buildBatchResult(
        finalA.length, finalB.length,
        finalA.reduce((s, h) => s + h, 0),
        finalB.reduce((s, h) => s + h, 0),
        multA, multB, totalCostA, totalCostB,
      ));
      if (timeElapsed > 0) durations.push(timeElapsed);
    }

    const nWinA = results.filter(r => r.winner === 'attacker').length;
    const nWinB = results.filter(r => r.winner === 'defender').length;
    const nDraw = results.filter(r => r.winner === 'draw').length;
    const n = results.length;
    const mcDistribution: MCDistribution = {
      winRateA: nWinA / n, winRateB: nWinB / n, drawRate: nDraw / n, iterations: n,
      durationMin: durations.length ? Math.min(...durations) : undefined,
      durationMax: durations.length ? Math.max(...durations) : undefined,
      whenAWins: computeMCWinnerStats(results, 'attacker'),
      whenBWins: computeMCWinnerStats(results, 'defender'),
    };
    const modeWinner = nWinA >= nWinB && nWinA >= nDraw ? 'attacker'
      : nWinB > nWinA && nWinB >= nDraw ? 'defender' : 'draw';
    const modeResults = results.filter(r => r.winner === modeWinner);
    modeResults.sort((a, b) =>
      (b.winnerUnitsRemaining ?? 0) - (a.winnerUnitsRemaining ?? 0) ||
      (b.winnerHpRemaining ?? 0) - (a.winnerHpRemaining ?? 0)
    );
    return { ...modeResults[Math.floor(modeResults.length / 2)], mcDistribution };
  },
};

// Asymmetric focus-fire: ranged concentrates all fire on one melee target at a time (focusFireModel
// behavior); melee distributes in batches via round-robin (i % nRanged).
// When nMelee < nRanged × 3, ceil(nMelee/nRanged) ≤ 3 — the max-3 constraint is satisfied
// automatically. When nMelee ≥ nRanged × 3 batches can grow beyond 3 (no explicit cap).
// Symmetric cases (both ranged or both melee) fall back to focusFireModel.
export const focusFireAsymmetricModel: MultiUnitModel = {
  resolve(A, B, metricsA, metricsB, { multA, multB, totalCostA, totalCostB }) {
    const dmgA = metricsA.effectiveDamagePerHit;
    const dmgB = metricsB.effectiveDamagePerHit;
    const asA = (A.weapons[0]?.speed ?? 0) * (1 + (B.opponentAttackSpeedDebuff ?? 0));
    const asB = (B.weapons[0]?.speed ?? 0) * (1 + (A.opponentAttackSpeedDebuff ?? 0));

    if (!dmgA || !dmgB || dmgA <= 0 || dmgB <= 0 || asA <= 0 || asB <= 0)
      return aggregatedDPSModel.resolve(A, B, metricsA, metricsB, { multA, multB, totalCostA, totalCostB });

    const isMeleeA = getMaxRange(A) < 1;
    const isMeleeB = getMaxRange(B) < 1;

    if (isMeleeA === isMeleeB)
      return focusFireModel.resolve(A, B, metricsA, metricsB, { multA, multB, totalCostA, totalCostB });

    const fDmgA = metricsA.firstHitDamage ?? dmgA;
    const fDmgB = metricsB.firstHitDamage ?? dmgB;
    const wA = A.weapons[0]?.durations?.windup ?? 0;
    const wB = B.weapons[0]?.durations?.windup ?? 0;
    const startHpA = A.hitpoints * (A.hpStartFraction ?? 1);
    const startHpB = B.hitpoints * (B.hpStartFraction ?? 1);

    const concIsA = !isMeleeA;
    const { hpConc, hpDist } = simulateAsymmetricFF(
      concIsA ? multA : multB, concIsA ? startHpA : startHpB,
      concIsA ? dmgA : dmgB, concIsA ? fDmgA : fDmgB,
      concIsA ? asA : asB, concIsA ? wA : wB,
      concIsA ? multB : multA, concIsA ? startHpB : startHpA,
      concIsA ? dmgB : dmgA, concIsA ? fDmgB : fDmgA,
      concIsA ? asB : asA, concIsA ? wB : wA,
    );
    const rC = hpConc.filter(h => h > 0).length;
    const rD = hpDist.filter(h => h > 0).length;
    const tC = hpConc.reduce((s, h) => s + Math.max(0, h), 0);
    const tD = hpDist.reduce((s, h) => s + Math.max(0, h), 0);
    return buildBatchResult(
      concIsA ? rC : rD, concIsA ? rD : rC,
      concIsA ? tC : tD, concIsA ? tD : tC,
      multA, multB, totalCostA, totalCostB,
    );
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// KITING FOCUS-FIRE MODELS
// ─────────────────────────────────────────────────────────────────────────────

// Simulates ranged focus fire during the approach phase.
// Ranged fires `totalShots` shots of `dmgPerShot` at melee units sequentially (focus fire).
// Returns: how many melee survive and the HP of the last-targeted unit (partial damage).
function computeApproachFocusFirePhase(
  nMelee: number,
  meleeHpPerUnit: number,
  totalShots: number,
  dmgPerShot: number,
): { survivingMelee: number; lastTargetHp: number } {
  if (dmgPerShot <= 0 || totalShots <= 0 || meleeHpPerUnit <= 0) {
    return { survivingMelee: nMelee, lastTargetHp: meleeHpPerUnit };
  }
  const totalDamage = totalShots * dmgPerShot;
  const killed = Math.min(nMelee, Math.floor(totalDamage / meleeHpPerUnit));
  if (killed >= nMelee) return { survivingMelee: 0, lastTargetHp: 0 };
  const lastTargetHp = meleeHpPerUnit - (totalDamage - killed * meleeHpPerUnit);
  return { survivingMelee: nMelee - killed, lastTargetHp };
}

// Asymmetric focus fire accepting pre-built HP arrays (for mixed-HP approach survivors).
// Ranged (conc) concentrates fire on one melee target at a time; melee (dist) distributes.
// Identical to simulateAsymmetricFF but takes HP arrays instead of (n, startHp) pairs.
function simulateAsymmetricFFMixed(
  hpConcArr: number[],
  dmgConc: number, fDmgConc: number, asConc: number, wConc: number,
  hpDistArr: number[],
  dmgDist: number, fDmgDist: number, asDist: number, wDist: number,
): { hpConc: number[]; hpDist: number[] } {
  const nConc = hpConcArr.length;
  const nDist = hpDistArr.length;
  const hpConc = [...hpConcArr];
  const hpDist = [...hpDistArr];
  const aliveConc: boolean[] = Array(nConc).fill(true);
  const aliveDist: boolean[] = Array(nDist).fill(true);
  const distTargets: number[] = Array.from({ length: nDist }, (_, i) => i % nConc);

  let concFocus = 0;
  let remConc = nConc, remDist = nDist;
  let tConc = wConc, tDist = wDist;
  let kConc = 0, kDist = 0;

  function nextAliveConc(fromIdx: number): number {
    for (let c = 1; c <= nConc; c++) {
      const idx = (fromIdx + c) % nConc;
      if (aliveConc[idx]) return idx;
    }
    return -1;
  }

  while (concFocus < nDist && !aliveDist[concFocus]) concFocus++;

  const MAX_ITER = (nConc + nDist) * 300 + 100;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    if (concFocus >= nDist || remConc <= 0) break;

    const fireConc = tConc <= tDist;
    const fireDist = tDist <= tConc;

    if (fireConc) {
      hpDist[concFocus] -= remConc * (kConc === 0 ? fDmgConc : dmgConc);
      kConc++; tConc = wConc + kConc * asConc;
    }
    if (fireDist) {
      const dmg = kDist === 0 ? fDmgDist : dmgDist;
      for (let i = 0; i < nDist; i++) {
        if (!aliveDist[i]) continue;
        const t = distTargets[i];
        if (t >= 0 && aliveConc[t]) hpConc[t] -= dmg;
      }
      kDist++; tDist = wDist + kDist * asDist;
    }

    if (aliveDist[concFocus] && hpDist[concFocus] <= 0) {
      aliveDist[concFocus] = false; remDist--;
      concFocus++;
      while (concFocus < nDist && !aliveDist[concFocus]) concFocus++;
    }
    for (let i = 0; i < nConc; i++) {
      if (aliveConc[i] && hpConc[i] <= 0) {
        aliveConc[i] = false; remConc--;
        const next = nextAliveConc(i);
        for (let j = 0; j < nDist; j++) {
          if (distTargets[j] === i) distTargets[j] = next;
        }
      }
    }
  }
  return { hpConc, hpDist };
}

// 1v1 kiting with focus-fire approach phase.
// Approach: ranged fires free shots (focus fire). If melee dies → ranged wins immediately.
// Contact: focusFireAsymmetricModel (symmetric cases fall back to focusFireModel).
export function computeVersusKitingFocusFire(
  a: AoE4Unit | UnifiedVariation,
  b: AoE4Unit | UnifiedVariation,
  activeAbilitiesA?: string[],
  activeAbilitiesB?: string[],
  chargeBonusA: number = 0,
  chargeBonusB: number = 0,
  startDistance: number = START_DISTANCE,
): VersusResult {
  const A = toCombatEntity(a, activeAbilitiesA);
  const B = toCombatEntity(b, activeAbilitiesB);

  const isMeleeA = getMaxRange(A) < 1;
  const isMeleeB = getMaxRange(B) < 1;
  const costA = totalCost(A);
  const costB = totalCost(B);
  const mults = { multA: 1, multB: 1, totalCostA: costA, totalCostB: costB };

  // Symmetric or no distance: no approach phase
  if (isMeleeA === isMeleeB || startDistance <= 0) {
    const metricsA = computeMetrics(A, B, chargeBonusA, 1, 1, true);
    const metricsB = computeMetrics(B, A, chargeBonusB, 1, 1, true);
    const model = isMeleeA === isMeleeB ? focusFireModel : focusFireAsymmetricModel;
    return { attacker: metricsA, defender: metricsB, ...model.resolve(A, B, metricsA, metricsB, mults) };
  }

  const meleeIsA = isMeleeA;
  const meleeEnt = meleeIsA ? A : B;
  const rangedEnt = meleeIsA ? B : A;
  const chargeBonusRanged = meleeIsA ? chargeBonusB : chargeBonusA;

  if (canPermanentlyKite(rangedEnt, meleeEnt)) {
    const metricsA = computeMetrics(A, B, chargeBonusA, 1, 1, true);
    const metricsB = computeMetrics(B, A, chargeBonusB, 1, 1, true);
    const winner: "attacker" | "defender" = meleeIsA ? "defender" : "attacker";
    return { attacker: metricsA, defender: metricsB, winner, winnerHpRemaining: rangedEnt.hitpoints * (rangedEnt.hpStartFraction ?? 1) };
  }

  // Full kiting model: approach + kiting cycles (mirrors applyKitingToMetrics)
  const prelimMetrics = computeMetrics(rangedEnt, meleeEnt, chargeBonusRanged, 1, 1, false);
  const rangedRange = getMaxRange(rangedEnt);
  const asRanged = (rangedEnt.weapons[0]?.speed ?? 0) * (1 + (meleeEnt.opponentAttackSpeedDebuff ?? 0));
  const hasMeleeCharge = meleeEnt.activeAbilities?.includes('charge-attack') ?? false;
  const effectiveMeleeSpeed = hasMeleeCharge ? meleeEnt.moveSpeed * 1.2 : meleeEnt.moveSpeed;
  const d_approach = Math.max(0, startDistance - rangedRange);
  const t_approach = effectiveMeleeSpeed > 0 ? d_approach / effectiveMeleeSpeed : 0;
  const wRangedFF = rangedEnt.weapons[0]?.durations?.windup ?? 0;
  const approachTravelTimeFF = isArcher(rangedEnt) ? ARCHER_TRAVEL_TIME : 0;
  const shotsDeadlineFF = t_approach - approachTravelTimeFF;
  const freeHits = asRanged > 0 && shotsDeadlineFF >= wRangedFF
    ? Math.floor((shotsDeadlineFF - wRangedFF) / asRanged) + 1
    : 0;
  const d_kite_start = Math.min(startDistance, rangedRange);
  const retreatTime = getRetreatTime(rangedEnt);
  const absDelta = Math.abs(rangedEnt.moveSpeed * retreatTime - effectiveMeleeSpeed * asRanged);
  const n_kite = asRanged > 0 && absDelta > 0 ? Math.ceil(d_kite_start / absDelta) : 0;
  const t_kite = n_kite * asRanged;
  const contactTimeFull = t_approach + t_kite;
  const preContactShots = freeHits + n_kite;

  const meleeHpFull = meleeEnt.hitpoints;
  const meleeHpStart = meleeHpFull * (meleeEnt.hpStartFraction ?? 1);

  let contactMeleeEnt = meleeEnt;
  let effectiveShots = 0;

  if (preContactShots > 0 && prelimMetrics.effectiveDamagePerHit !== null && prelimMetrics.effectiveDamagePerHit > 0) {
    const { survivingMelee, lastTargetHp } = computeApproachFocusFirePhase(
      1, meleeHpStart, preContactShots, prelimMetrics.effectiveDamagePerHit,
    );
    if (survivingMelee === 0) {
      const kitingNote = `approach ${round(t_approach, 1)}s (+${freeHits} free hits) · kiting ${round(t_kite, 1)}s (+${n_kite} hits) · contact t=${round(contactTimeFull, 1)}s`;
      let metricsA = computeMetrics(A, B, chargeBonusA, 1, 1, true);
      let metricsB = computeMetrics(B, A, chargeBonusB, 1, 1, true);
      if (meleeIsA) {
        metricsA = { ...metricsA, formula: metricsA.formula + ` [Dies before contact]` };
        metricsB = { ...metricsB, formula: metricsB.formula + ` [Kiting: ${kitingNote}]` };
      } else {
        metricsA = { ...metricsA, formula: metricsA.formula + ` [Kiting: ${kitingNote}]` };
        metricsB = { ...metricsB, formula: metricsB.formula + ` [Dies before contact]` };
      }
      const winner: "attacker" | "defender" = meleeIsA ? "defender" : "attacker";
      return { attacker: metricsA, defender: metricsB, winner, winnerHpRemaining: rangedEnt.hitpoints * (rangedEnt.hpStartFraction ?? 1) };
    }
    contactMeleeEnt = { ...meleeEnt, hpStartFraction: Math.max(1 / meleeHpFull, lastTargetHp / meleeHpFull) };
    effectiveShots = preContactShots;
  }

  const contactA = meleeIsA ? contactMeleeEnt : rangedEnt;
  const contactB = meleeIsA ? rangedEnt : contactMeleeEnt;
  let metricsA = computeMetrics(contactA, contactB, chargeBonusA, 1, 1, true);
  let metricsB = computeMetrics(contactB, contactA, chargeBonusB, 1, 1, true);
  if (effectiveShots > 0) {
    const kitingNote = `approach ${round(t_approach, 1)}s (+${freeHits} free hits) · kiting ${round(t_kite, 1)}s (+${n_kite} hits) · contact t=${round(contactTimeFull, 1)}s`;
    if (meleeIsA) {
      metricsA = { ...metricsA, formula: metricsA.formula + ` [contact at t=${round(contactTimeFull, 1)}s]` };
      metricsB = { ...metricsB, approachShots: effectiveShots, formula: metricsB.formula + ` [Kiting: ${kitingNote}]` };
    } else {
      metricsA = { ...metricsA, approachShots: effectiveShots, formula: metricsA.formula + ` [Kiting: ${kitingNote}]` };
      metricsB = { ...metricsB, formula: metricsB.formula + ` [contact at t=${round(contactTimeFull, 1)}s]` };
    }
  }

  return { attacker: metricsA, defender: metricsB, ...focusFireAsymmetricModel.resolve(contactA, contactB, metricsA, metricsB, mults) };
}

// Equal-cost kiting with focus-fire approach phase.
// Approach: ranged focus-fires melee units sequentially; killed units are removed.
// The last-targeted survivor enters contact first (partial HP), others remain at full HP.
// Contact: asymmetric focus fire (simulateAsymmetricFFMixed) with mixed-HP melee array.
export function computeVersusAtEqualCostKitingFocusFire(
  a: AoE4Unit | UnifiedVariation,
  b: AoE4Unit | UnifiedVariation,
  activeAbilitiesA?: string[],
  activeAbilitiesB?: string[],
  chargeBonusA: number = 0,
  chargeBonusB: number = 0,
  startDistance: number = START_DISTANCE,
): VersusResult & { multipliers: { multA: number; multB: number; totalCostA: number; totalCostB: number } } {
  const A = toCombatEntity(a, activeAbilitiesA);
  const B = toCombatEntity(b, activeAbilitiesB);

  const costA = totalCost(A);
  const costB = totalCost(B);
  const multipliers = calculateEqualCostMultipliers(costA, costB);

  const isMeleeA = getMaxRange(A) < 1;
  const isMeleeB = getMaxRange(B) < 1;

  const metricsA = computeMetrics(A, B, chargeBonusA, multipliers.multA, multipliers.multB);
  const metricsB = computeMetrics(B, A, chargeBonusB, multipliers.multB, multipliers.multA);

  // Symmetric or no distance: no approach phase
  if (isMeleeA === isMeleeB || startDistance <= 0) {
    const model = isMeleeA === isMeleeB ? focusFireModel : focusFireAsymmetricModel;
    return { attacker: metricsA, defender: metricsB, multipliers, ...model.resolve(A, B, metricsA, metricsB, multipliers) };
  }

  const meleeIsA = isMeleeA;
  const meleeEnt = meleeIsA ? A : B;
  const rangedEnt = meleeIsA ? B : A;
  const multMelee = meleeIsA ? multipliers.multA : multipliers.multB;
  const multRanged = meleeIsA ? multipliers.multB : multipliers.multA;
  const metRanged = meleeIsA ? metricsB : metricsA;

  if (canPermanentlyKite(rangedEnt, meleeEnt)) {
    const rangedHpStart = rangedEnt.hitpoints * (rangedEnt.hpStartFraction ?? 1);
    const winner: "attacker" | "defender" = meleeIsA ? "defender" : "attacker";
    return {
      attacker: metricsA, defender: metricsB, multipliers, winner,
      winnerHpRemaining: multRanged * rangedHpStart,
      winnerUnitsRemaining: multRanged,
      resourceDifference: multRanged * (meleeIsA ? costB : costA),
    };
  }

  // Approach shots
  const rangedRange = getMaxRange(rangedEnt);
  const T_free = Math.min(startDistance, rangedRange) / Math.max(0.1, meleeEnt.moveSpeed);
  const asRanged = (rangedEnt.weapons[0]?.speed ?? 0) * (1 + (meleeEnt.opponentAttackSpeedDebuff ?? 0));
  const wRanged = rangedEnt.weapons[0]?.durations?.windup ?? 0;
  const shotsDeadline = T_free - (isArcher(rangedEnt) ? ARCHER_TRAVEL_TIME : 0);
  const shots = asRanged > 0 && shotsDeadline >= wRanged
    ? Math.floor((shotsDeadline - wRanged) / asRanged) + 1
    : 0;

  const meleeHpFull = meleeEnt.hitpoints;
  const meleeHpStart = meleeHpFull * (meleeEnt.hpStartFraction ?? 1);
  const rangedHpStart = rangedEnt.hitpoints * (rangedEnt.hpStartFraction ?? 1);

  const dmgPerShot = metRanged.effectiveDamagePerHit;
  if (shots <= 0 || dmgPerShot === null || dmgPerShot <= 0) {
    return { attacker: metricsA, defender: metricsB, multipliers, ...focusFireAsymmetricModel.resolve(A, B, metricsA, metricsB, multipliers) };
  }

  const { survivingMelee, lastTargetHp } = computeApproachFocusFirePhase(
    multMelee, meleeHpStart, multRanged * shots, dmgPerShot,
  );

  if (survivingMelee === 0) {
    const winner: "attacker" | "defender" = meleeIsA ? "defender" : "attacker";
    return {
      attacker: metricsA, defender: metricsB, multipliers, winner,
      winnerHpRemaining: multRanged * rangedHpStart,
      winnerUnitsRemaining: multRanged,
      resourceDifference: multRanged * (meleeIsA ? costB : costA),
    };
  }

  // Mixed HP array: partial-HP unit first (ranged will continue focus-firing it), then full-HP survivors
  const meleeHpArr = [lastTargetHp, ...Array(survivingMelee - 1).fill(meleeHpStart)];
  const rangedHpArr = Array(multRanged).fill(rangedHpStart);

  const concIsA = !meleeIsA; // ranged = conc (concentrates fire)
  const dmgConc = concIsA ? (metricsA.effectiveDamagePerHit ?? 0) : (metricsB.effectiveDamagePerHit ?? 0);
  const dmgDist = concIsA ? (metricsB.effectiveDamagePerHit ?? 0) : (metricsA.effectiveDamagePerHit ?? 0);
  const fDmgConc = concIsA ? (metricsA.firstHitDamage ?? dmgConc) : (metricsB.firstHitDamage ?? dmgConc);
  const fDmgDist = concIsA ? (metricsB.firstHitDamage ?? dmgDist) : (metricsA.firstHitDamage ?? dmgDist);
  const asConc = concIsA
    ? (A.weapons[0]?.speed ?? 0) * (1 + (B.opponentAttackSpeedDebuff ?? 0))
    : (B.weapons[0]?.speed ?? 0) * (1 + (A.opponentAttackSpeedDebuff ?? 0));
  const asDist = concIsA
    ? (B.weapons[0]?.speed ?? 0) * (1 + (A.opponentAttackSpeedDebuff ?? 0))
    : (A.weapons[0]?.speed ?? 0) * (1 + (B.opponentAttackSpeedDebuff ?? 0));
  const wConc = concIsA ? (A.weapons[0]?.durations?.windup ?? 0) : (B.weapons[0]?.durations?.windup ?? 0);
  const wDist = concIsA ? (B.weapons[0]?.durations?.windup ?? 0) : (A.weapons[0]?.durations?.windup ?? 0);

  const { hpConc, hpDist } = simulateAsymmetricFFMixed(
    concIsA ? rangedHpArr : meleeHpArr, dmgConc, fDmgConc, asConc, wConc,
    concIsA ? meleeHpArr : rangedHpArr, dmgDist, fDmgDist, asDist, wDist,
  );

  const rC = hpConc.filter(h => h > 0).length;
  const rD = hpDist.filter(h => h > 0).length;
  const tC = hpConc.reduce((s, h) => s + Math.max(0, h), 0);
  const tD = hpDist.reduce((s, h) => s + Math.max(0, h), 0);
  const rA = concIsA ? rC : rD;
  const rB = concIsA ? rD : rC;
  const tA = concIsA ? tC : tD;
  const tB = concIsA ? tD : tC;

  // Per-unit cost unchanged; adjust counts for resource calculation
  const adjMultA = meleeIsA ? survivingMelee : multRanged;
  const adjMultB = meleeIsA ? multRanged : survivingMelee;
  const resolved = buildBatchResult(rA, rB, tA, tB, adjMultA, adjMultB, adjMultA * costA, adjMultB * costB);

  return { attacker: metricsA, defender: metricsB, multipliers, ...resolved };
}

// 1v1 kiting + Attack Move: approach phase (ranged focus-fires melee), contact via focusFireAsymmetricModel (same as focusFireKiting — 1v1 MC adds no variance).
export function computeVersusKitingBatchesMC(
  a: AoE4Unit | UnifiedVariation,
  b: AoE4Unit | UnifiedVariation,
  activeAbilitiesA?: string[],
  activeAbilitiesB?: string[],
  chargeBonusA: number = 0,
  chargeBonusB: number = 0,
  startDistance: number = START_DISTANCE,
): VersusResult {
  const A = toCombatEntity(a, activeAbilitiesA);
  const B = toCombatEntity(b, activeAbilitiesB);

  const isMeleeA = getMaxRange(A) < 1;
  const isMeleeB = getMaxRange(B) < 1;
  const costA = totalCost(A);
  const costB = totalCost(B);
  const mults = { multA: 1, multB: 1, totalCostA: costA, totalCostB: costB };

  if (isMeleeA === isMeleeB || startDistance <= 0) {
    const metricsA = computeMetrics(A, B, chargeBonusA, 1, 1, true);
    const metricsB = computeMetrics(B, A, chargeBonusB, 1, 1, true);
    const model = isMeleeA === isMeleeB ? focusFireModel : focusFireAsymmetricModel;
    return { attacker: metricsA, defender: metricsB, ...model.resolve(A, B, metricsA, metricsB, mults) };
  }

  const meleeIsA = isMeleeA;
  const meleeEnt = meleeIsA ? A : B;
  const rangedEnt = meleeIsA ? B : A;
  const chargeBonusRanged = meleeIsA ? chargeBonusB : chargeBonusA;

  if (canPermanentlyKite(rangedEnt, meleeEnt)) {
    const metricsA = computeMetrics(A, B, chargeBonusA, 1, 1, true);
    const metricsB = computeMetrics(B, A, chargeBonusB, 1, 1, true);
    const winner: "attacker" | "defender" = meleeIsA ? "defender" : "attacker";
    return { attacker: metricsA, defender: metricsB, winner, winnerHpRemaining: rangedEnt.hitpoints * (rangedEnt.hpStartFraction ?? 1) };
  }

  // Full kiting model: approach + kiting cycles (mirrors applyKitingToMetrics)
  const prelimMetrics = computeMetrics(rangedEnt, meleeEnt, chargeBonusRanged, 1, 1, false);
  const rangedRange = getMaxRange(rangedEnt);
  const asRanged = (rangedEnt.weapons[0]?.speed ?? 0) * (1 + (meleeEnt.opponentAttackSpeedDebuff ?? 0));
  const hasMeleeCharge = meleeEnt.activeAbilities?.includes('charge-attack') ?? false;
  const effectiveMeleeSpeed = hasMeleeCharge ? meleeEnt.moveSpeed * 1.2 : meleeEnt.moveSpeed;
  const d_approach = Math.max(0, startDistance - rangedRange);
  const t_approach = effectiveMeleeSpeed > 0 ? d_approach / effectiveMeleeSpeed : 0;
  const wRangedFF = rangedEnt.weapons[0]?.durations?.windup ?? 0;
  const approachTravelTimeFF = isArcher(rangedEnt) ? ARCHER_TRAVEL_TIME : 0;
  const shotsDeadlineFF = t_approach - approachTravelTimeFF;
  const freeHits = asRanged > 0 && shotsDeadlineFF >= wRangedFF
    ? Math.floor((shotsDeadlineFF - wRangedFF) / asRanged) + 1
    : 0;
  const d_kite_start = Math.min(startDistance, rangedRange);
  const retreatTime = getRetreatTime(rangedEnt);
  const absDelta = Math.abs(rangedEnt.moveSpeed * retreatTime - effectiveMeleeSpeed * asRanged);
  const n_kite = asRanged > 0 && absDelta > 0 ? Math.ceil(d_kite_start / absDelta) : 0;
  const t_kite = n_kite * asRanged;
  const contactTimeFull = t_approach + t_kite;
  const preContactShots = freeHits + n_kite;

  const meleeHpFull = meleeEnt.hitpoints;
  const meleeHpStart = meleeHpFull * (meleeEnt.hpStartFraction ?? 1);

  let contactMeleeEnt = meleeEnt;
  let effectiveShots = 0;

  if (preContactShots > 0 && prelimMetrics.effectiveDamagePerHit !== null && prelimMetrics.effectiveDamagePerHit > 0) {
    const { survivingMelee, lastTargetHp } = computeApproachFocusFirePhase(
      1, meleeHpStart, preContactShots, prelimMetrics.effectiveDamagePerHit,
    );
    if (survivingMelee === 0) {
      const kitingNote = `approach ${round(t_approach, 1)}s (+${freeHits} free hits) · kiting ${round(t_kite, 1)}s (+${n_kite} hits) · contact t=${round(contactTimeFull, 1)}s`;
      let metricsA = computeMetrics(A, B, chargeBonusA, 1, 1, true);
      let metricsB = computeMetrics(B, A, chargeBonusB, 1, 1, true);
      if (meleeIsA) {
        metricsA = { ...metricsA, formula: metricsA.formula + ` [Dies before contact]` };
        metricsB = { ...metricsB, formula: metricsB.formula + ` [Kiting: ${kitingNote}]` };
      } else {
        metricsA = { ...metricsA, formula: metricsA.formula + ` [Kiting: ${kitingNote}]` };
        metricsB = { ...metricsB, formula: metricsB.formula + ` [Dies before contact]` };
      }
      const winner: "attacker" | "defender" = meleeIsA ? "defender" : "attacker";
      return { attacker: metricsA, defender: metricsB, winner, winnerHpRemaining: rangedEnt.hitpoints * (rangedEnt.hpStartFraction ?? 1) };
    }
    contactMeleeEnt = { ...meleeEnt, hpStartFraction: Math.max(1 / meleeHpFull, lastTargetHp / meleeHpFull) };
    effectiveShots = preContactShots;
  }

  const contactA = meleeIsA ? contactMeleeEnt : rangedEnt;
  const contactB = meleeIsA ? rangedEnt : contactMeleeEnt;
  let metricsA = computeMetrics(contactA, contactB, chargeBonusA, 1, 1, true);
  let metricsB = computeMetrics(contactB, contactA, chargeBonusB, 1, 1, true);
  if (effectiveShots > 0) {
    const kitingNote = `approach ${round(t_approach, 1)}s (+${freeHits} free hits) · kiting ${round(t_kite, 1)}s (+${n_kite} hits) · contact t=${round(contactTimeFull, 1)}s`;
    if (meleeIsA) {
      metricsA = { ...metricsA, formula: metricsA.formula + ` [contact at t=${round(contactTimeFull, 1)}s]` };
      metricsB = { ...metricsB, approachShots: effectiveShots, formula: metricsB.formula + ` [Kiting: ${kitingNote}]` };
    } else {
      metricsA = { ...metricsA, approachShots: effectiveShots, formula: metricsA.formula + ` [Kiting: ${kitingNote}]` };
      metricsB = { ...metricsB, formula: metricsB.formula + ` [contact at t=${round(contactTimeFull, 1)}s]` };
    }
  }

  return { attacker: metricsA, defender: metricsB, ...focusFireAsymmetricModel.resolve(contactA, contactB, metricsA, metricsB, mults) };
}

// Equal-cost kiting + Attack Move: approach phase (ranged focus-fires melee), contact via Batches MC
// with mixed-HP melee array (last-targeted unit enters at partial HP).
export function computeVersusAtEqualCostKitingBatchesMC(
  a: AoE4Unit | UnifiedVariation,
  b: AoE4Unit | UnifiedVariation,
  activeAbilitiesA?: string[],
  activeAbilitiesB?: string[],
  chargeBonusA: number = 0,
  chargeBonusB: number = 0,
  startDistance: number = START_DISTANCE,
): VersusResult & { multipliers: { multA: number; multB: number; totalCostA: number; totalCostB: number } } {
  const A = toCombatEntity(a, activeAbilitiesA);
  const B = toCombatEntity(b, activeAbilitiesB);

  const costA = totalCost(A);
  const costB = totalCost(B);
  const multipliers = calculateEqualCostMultipliers(costA, costB);

  const isMeleeA = getMaxRange(A) < 1;
  const isMeleeB = getMaxRange(B) < 1;

  const metricsA = computeMetrics(A, B, chargeBonusA, multipliers.multA, multipliers.multB);
  const metricsB = computeMetrics(B, A, chargeBonusB, multipliers.multB, multipliers.multA);

  if (isMeleeA === isMeleeB || startDistance <= 0) {
    const model = isMeleeA === isMeleeB ? focusFireBatchesMCModel : focusFireBatchesMCAsymmetricModel;
    return { attacker: metricsA, defender: metricsB, multipliers, ...model.resolve(A, B, metricsA, metricsB, multipliers) };
  }

  const meleeIsA = isMeleeA;
  const meleeEnt = meleeIsA ? A : B;
  const rangedEnt = meleeIsA ? B : A;
  const multMelee = meleeIsA ? multipliers.multA : multipliers.multB;
  const multRanged = meleeIsA ? multipliers.multB : multipliers.multA;
  const metRanged = meleeIsA ? metricsB : metricsA;

  if (canPermanentlyKite(rangedEnt, meleeEnt)) {
    const rangedHpStart = rangedEnt.hitpoints * (rangedEnt.hpStartFraction ?? 1);
    const winner: "attacker" | "defender" = meleeIsA ? "defender" : "attacker";
    return {
      attacker: metricsA, defender: metricsB, multipliers, winner,
      winnerHpRemaining: multRanged * rangedHpStart,
      winnerUnitsRemaining: multRanged,
      resourceDifference: multRanged * (meleeIsA ? costB : costA),
    };
  }

  const rangedRange = getMaxRange(rangedEnt);
  const T_free = Math.min(startDistance, rangedRange) / Math.max(0.1, meleeEnt.moveSpeed);
  const asRangedApproach = (rangedEnt.weapons[0]?.speed ?? 0) * (1 + (meleeEnt.opponentAttackSpeedDebuff ?? 0));
  const wRangedApproach = rangedEnt.weapons[0]?.durations?.windup ?? 0;
  const shotsDeadline = T_free - (isArcher(rangedEnt) ? ARCHER_TRAVEL_TIME : 0);
  const shots = asRangedApproach > 0 && shotsDeadline >= wRangedApproach
    ? Math.floor((shotsDeadline - wRangedApproach) / asRangedApproach) + 1
    : 0;

  const meleeHpFull = meleeEnt.hitpoints;
  const meleeHpStart = meleeHpFull * (meleeEnt.hpStartFraction ?? 1);
  const rangedHpStart = rangedEnt.hitpoints * (rangedEnt.hpStartFraction ?? 1);

  const dmgPerShot = metRanged.effectiveDamagePerHit;
  if (shots <= 0 || dmgPerShot === null || dmgPerShot <= 0) {
    return { attacker: metricsA, defender: metricsB, multipliers, ...focusFireBatchesMCAsymmetricModel.resolve(A, B, metricsA, metricsB, multipliers) };
  }

  const { survivingMelee, lastTargetHp } = computeApproachFocusFirePhase(
    multMelee, meleeHpStart, multRanged * shots, dmgPerShot,
  );

  if (survivingMelee === 0) {
    const winner: "attacker" | "defender" = meleeIsA ? "defender" : "attacker";
    return {
      attacker: metricsA, defender: metricsB, multipliers, winner,
      winnerHpRemaining: multRanged * rangedHpStart,
      winnerUnitsRemaining: multRanged,
      resourceDifference: multRanged * (meleeIsA ? costB : costA),
    };
  }

  // Mixed HP: partial-HP unit first (ranged continues focus-firing it), then full-HP survivors
  const meleeHpArr = [lastTargetHp, ...Array(survivingMelee - 1).fill(meleeHpStart)];
  const rangedHpArr = Array(multRanged).fill(rangedHpStart);

  const adjMultA = meleeIsA ? survivingMelee : multRanged;
  const adjMultB = meleeIsA ? multRanged : survivingMelee;

  // Contact phase: MC batch loop with mixed-HP melee array
  const dmgA = metricsA.effectiveDamagePerHit;
  const dmgB = metricsB.effectiveDamagePerHit;
  const asA = (A.weapons[0]?.speed ?? 0) * (1 + (B.opponentAttackSpeedDebuff ?? 0));
  const asB = (B.weapons[0]?.speed ?? 0) * (1 + (A.opponentAttackSpeedDebuff ?? 0));

  if (!dmgA || !dmgB || dmgA <= 0 || dmgB <= 0 || asA <= 0 || asB <= 0) {
    const resolved = buildBatchResult(0, 0, 0, 0, adjMultA, adjMultB, adjMultA * costA, adjMultB * costB);
    return { attacker: metricsA, defender: metricsB, multipliers, ...resolved };
  }

  const fDmgA = metricsA.firstHitDamage ?? dmgA;
  const fDmgB = metricsB.firstHitDamage ?? dmgB;

  type ActiveBatch = { hpA: number[]; hpB: number[]; firstShotUsed: boolean };
  type IterResult = ReturnType<typeof buildBatchResult>;
  const results: IterResult[] = [];
  const durations: number[] = [];
  const MAX_STEPS = (adjMultA + adjMultB) * 2 + 10;
  seedRng(MC_SEED);

  for (let iter = 0; iter < MC_ITERATIONS; iter++) {
    let timeElapsed = 0;
    // Preserve meleeHpArr order (partial-HP unit first) — archer continues targeting same unit as during approach
    const active: ActiveBatch[] = [{
      hpA: meleeIsA ? meleeHpArr.slice() : rangedHpArr.slice(),
      hpB: meleeIsA ? rangedHpArr.slice() : meleeHpArr.slice(),
      firstShotUsed: false,
    }];

    const pendingA: number[] = [];
    const pendingB: number[] = [];

    for (let step = 0; step < MAX_STEPS && active.length > 0; step++) {
      const T = Math.min(...active.map(b => {
        const cFA = b.firstShotUsed ? dmgA : fDmgA;
        const cFB = b.firstShotUsed ? dmgB : fDmgB;
        return batchFirstDeathTime(b.hpA, b.hpB, dmgA, dmgB, cFA, cFB, asA, asB, 0, 0);
      }));
      if (!isFinite(T)) break;
      timeElapsed += T;

      const nextActive: ActiveBatch[] = [];
      for (const b of active) {
        const cFA = b.firstShotUsed ? dmgA : fDmgA;
        const cFB = b.firstShotUsed ? dmgB : fDmgB;
        const r = advanceBatchFF(b.hpA, b.hpB, T, dmgA, dmgB, cFA, cFB, asA, asB, 0, 0);
        const nA = r.hpA.filter(h => h > 0);
        const nB = r.hpB.filter(h => h > 0);
        if (nA.length > 0 && nB.length > 0) {
          nextActive.push({ hpA: nA, hpB: nB, firstShotUsed: true });
        } else {
          for (const hp of nA) {
            if (nextActive.length > 0) nextActive[Math.floor(rng() * nextActive.length)].hpA.push(hp);
            else pendingA.push(hp);
          }
          for (const hp of nB) {
            if (nextActive.length > 0) nextActive[Math.floor(rng() * nextActive.length)].hpB.push(hp);
            else pendingB.push(hp);
          }
        }
      }

      if (nextActive.length === 0 && pendingA.length > 0 && pendingB.length > 0) {
        const newBatches = createBatchesGrouped(pendingA, pendingB);
        pendingA.length = 0; pendingB.length = 0;
        for (const b of newBatches) {
          if (b.hpA.length > 0 && b.hpB.length > 0)
            nextActive.push({ hpA: b.hpA.slice(), hpB: b.hpB.slice(), firstShotUsed: false });
          else { pendingA.push(...b.hpA); pendingB.push(...b.hpB); }
        }
      }
      for (const hp of pendingA.splice(0)) {
        if (nextActive.length > 0) nextActive[Math.floor(rng() * nextActive.length)].hpA.push(hp);
        else pendingA.push(hp);
      }
      for (const hp of pendingB.splice(0)) {
        if (nextActive.length > 0) nextActive[Math.floor(rng() * nextActive.length)].hpB.push(hp);
        else pendingB.push(hp);
      }
      active.length = 0;
      active.push(...nextActive);
    }

    const finalA = [...pendingA, ...active.flatMap(b => b.hpA)].filter(h => h > 0);
    const finalB = [...pendingB, ...active.flatMap(b => b.hpB)].filter(h => h > 0);
    results.push(buildBatchResult(
      finalA.length, finalB.length,
      finalA.reduce((s, h) => s + h, 0), finalB.reduce((s, h) => s + h, 0),
      adjMultA, adjMultB, adjMultA * costA, adjMultB * costB,
    ));
    if (timeElapsed > 0) durations.push(timeElapsed);
  }

  const nWinA = results.filter(r => r.winner === 'attacker').length;
  const nWinB = results.filter(r => r.winner === 'defender').length;
  const nDraw = results.filter(r => r.winner === 'draw').length;
  const n = results.length;
  const mcDistribution: MCDistribution = {
    winRateA: nWinA / n,
    winRateB: nWinB / n,
    drawRate: nDraw / n,
    iterations: n,
    durationMin: durations.length ? Math.min(...durations) : undefined,
    durationMax: durations.length ? Math.max(...durations) : undefined,
    whenAWins: computeMCWinnerStats(results, 'attacker'),
    whenBWins: computeMCWinnerStats(results, 'defender'),
  };

  const modeWinner = nWinA >= nWinB && nWinA >= nDraw ? 'attacker'
    : nWinB > nWinA && nWinB >= nDraw ? 'defender'
      : 'draw';
  const modeResults = results.filter(r => r.winner === modeWinner);
  modeResults.sort((a, b) =>
    (b.winnerUnitsRemaining ?? 0) - (a.winnerUnitsRemaining ?? 0) ||
    (b.winnerHpRemaining ?? 0) - (a.winnerHpRemaining ?? 0)
  );
  const median = modeResults[Math.floor(modeResults.length / 2)];

  return { attacker: metricsA, defender: metricsB, multipliers, ...median, mcDistribution };
}

// ─────────────────────────────────────────────────────────────────────────────

// Find the minimum number of loser units needed to beat 1 winner unit, using focus-fire simulation.
// Uses focusFireAsymmetricModel for ranged-vs-melee fights, focusFireModel otherwise.
export function computeLoserUnitsToWin(
  versusResult: VersusResult,
  unitA: AoE4Unit | UnifiedVariation,
  unitB: AoE4Unit | UnifiedVariation,
  maxN = 25,
): number | undefined {
  if (versusResult.winner === 'draw') return undefined;

  const entityA = toCombatEntity(unitA);
  const entityB = toCombatEntity(unitB);

  const loserIsA = versusResult.winner === 'defender';
  const loserEntity = loserIsA ? entityA : entityB;
  const winnerEntity = loserIsA ? entityB : entityA;
  const metricsLoser = loserIsA ? versusResult.attacker : versusResult.defender;
  const metricsWinner = loserIsA ? versusResult.defender : versusResult.attacker;

  if (!metricsLoser.effectiveDamagePerHit || !metricsWinner.effectiveDamagePerHit) return undefined;

  const isRangedLoser = getMaxRange(loserEntity) >= 1;
  const isRangedWinner = getMaxRange(winnerEntity) >= 1;
  const model = isRangedLoser !== isRangedWinner ? focusFireAsymmetricModel : focusFireModel;

  for (let n = 2; n <= maxN; n++) {
    const r = model.resolve(loserEntity, winnerEntity, metricsLoser, metricsWinner, {
      multA: n, multB: 1, totalCostA: n, totalCostB: 1,
    });
    if (r.winner === 'attacker') return n;
  }

  return maxN;
}
