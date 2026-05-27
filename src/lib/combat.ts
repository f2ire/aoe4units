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
  timeToKill: number | null; // seconds
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
  // Based on classes containing "gunpowder"
  return entity.classes.some(c => c.toLowerCase().includes("gunpowder"));
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
        formula: metricsA.formula + ` [Movement: ${note}]`,
      },
      adjustedB: {
        ...metricsB,
        timeToKill: metricsB.timeToKill !== null ? round(metricsB.timeToKill + t_approach, 1) : null,
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
  const freeHits = Math.floor(t_approach / attackCycle);
  const d_kite_start = Math.min(d0, rangeMax); // distance at start of kiting
  const absDelta = Math.abs(delta);
  const n_kite = absDelta > 0 ? Math.ceil(d_kite_start / absDelta) : 0;
  const t_kite = n_kite * attackCycle;
  const contactTime = t_approach + t_kite;
  const preContactHits = freeHits + n_kite;

  // Ranged TTK: determine which phase melee dies in
  const hitsToKill = mRanged.hitsToKill;
  let newTTKranged: number | null = mRanged.timeToKill;
  if (hitsToKill !== null && attackCycle > 0) {
    if (hitsToKill <= freeHits) {
      // Dies during approach
      newTTKranged = round(hitsToKill * attackCycle, 1);
    } else if (hitsToKill <= preContactHits) {
      // Dies during kiting
      newTTKranged = round(t_approach + (hitsToKill - freeHits) * attackCycle, 1);
    } else {
      // Dies during close combat
      // When thorns DPS is active (dpsContact > 0), it only applies from contactTime onward.
      // Remaining HP is bolt-damage-based (pre-contact had no thorns); contact phase uses full combined DPS.
      if (mRanged.dpsContact && mRanged.dps && mRanged.effectiveDamagePerHit) {
        const remainingHP = (hitsToKill - preContactHits) * mRanged.effectiveDamagePerHit;
        newTTKranged = round(contactTime + remainingHP / mRanged.dps, 1);
      } else {
        newTTKranged = round(contactTime + (hitsToKill - preContactHits) * attackCycle, 1);
      }
    }
  }

  const meleeDiesBeforeContact = hitsToKill !== null && hitsToKill <= preContactHits;

  // Melee TTK: can only deal damage after contact
  // First hit uses charge weapon speed (if any), subsequent hits use primary weapon speed
  const meleAttackCycle = melee.weapons[0]?.speed ?? 0;
  const meleeFirstHitSpeed = meleeChargeWeapon ? (meleeChargeWeapon.speed || meleAttackCycle) : meleAttackCycle;
  const newTTKmelee: number | null = meleeDiesBeforeContact
    ? null
    : (mMelee.hitsToKill !== null && meleAttackCycle > 0
      ? round(contactTime + meleeFirstHitSpeed + (mMelee.hitsToKill - 1) * meleAttackCycle, 1)
      : null);

  const chargeSpeedNote = hasMeleeCharge ? ` [charge ×${CHARGE_SPEED_MULTIPLIER} speed]` : '';
  const kitingNote = `approach ${round(t_approach, 1)}s (+${freeHits} free hits)${chargeSpeedNote} · kiting ${round(t_kite, 1)}s (+${n_kite} hits) · contact t=${round(contactTime, 1)}s`;

  const newMRanged: VersusMetrics = {
    ...mRanged,
    timeToKill: newTTKranged,
    formula: mRanged.formula + ` [Kiting: ${kitingNote}]`,
  };
  const newMMelee: VersusMetrics = {
    ...mMelee,
    timeToKill: newTTKmelee,
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
  // First hit uses the charge weapon's own attack cycle (if present)
  const firstHitSpeed = (hasChargeWeapon ? (chargeWeapon!.speed || rawSpeed) : rawSpeed) * asDebuffFactor;
  const bugAttackSpeed = rawSpeed <= 0;
  let dps: number | null = null;
  let hitsToKill: number | null = null;
  let timeToKill: number | null = null;
  let dpsPerCost: number | null = null;
  let thornsDPS = 0;

  // First-hit block (Deflective Armor): defender absorbs first attack completely.
  // Charge consumed but blocked. Attacker spends firstHitSpeed, then all normal hits.
  if (defender.firstHitBlocked && !bugAttackSpeed) {
    const totalDefHP = defender.hitpoints * (defender.hpStartFraction ?? 1) * defenderMultiplier;
    const normalCycle = normalAttackData.value * attackerMultiplier;
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
      timeToKill = round(firstHitSpeed + normalHTK * attackSpeed, 1);
      dps = round(totalDefHP / timeToKill, 2);
    }
    if (attacker.selfDestructs && hitsToKill !== null && hitsToKill > 1) {
      hitsToKill = null; timeToKill = null; dps = null;
    }
    const cost = totalCost(attacker);
    dpsPerCost = cost > 0 ? round((normalAttackData.value / attackSpeed) / cost, 2) : null;
    const debuffTxt = normalAttackData.debuffMultiplier ? ` × ${normalAttackData.debuffMultiplier} (debuff)` : '';
    return {
      id: attacker.id, name: attacker.name,
      dps, dpsPerCost, hitsToKill, timeToKill,
      effectiveDamagePerHit: normalAttackData.value,
      firstHitDamage: 0,
      bugAttackSpeed: false, cannotAttackUnits: false,
      formula: `Deflect + Effective = max(1, (Base(${normalAttackData.base}) + Bonus(${normalAttackData.bonus}) - Armor(${normalAttackData.armorApplied}))${debuffTxt}) = ${normalAttackData.value}; DPS = ${dps}`,
    };
  }

  if (!bugAttackSpeed) {
    const totalDefenderHP = defender.hitpoints * (defender.hpStartFraction ?? 1) * defenderMultiplier;

    if (chargeBonus > 0 || hasChargeWeapon) {
      const firstCycleDamage = firstAttackData.value * attackerMultiplier;
      const normalCycleDamage = normalAttackData.value * attackerMultiplier;

      if (firstCycleDamage >= totalDefenderHP) {
        hitsToKill = 1;
        timeToKill = round(firstHitSpeed, 1);
      } else {
        const additionalHits = Math.ceil((totalDefenderHP - firstCycleDamage) / normalCycleDamage);
        hitsToKill = 1 + additionalHits;
        timeToKill = round(firstHitSpeed + additionalHits * attackSpeed, 1);
      }
      const totalDamage = firstCycleDamage + (hitsToKill - 1) * normalCycleDamage;
      const totalTime = firstHitSpeed + (hitsToKill - 1) * attackSpeed;
      dps = round(totalDamage / totalTime, 2);
    } else {
      const unitDPS = round(normalAttackData.value / attackSpeed, 2);
      dps = round(unitDPS * attackerMultiplier, 2);
      hitsToKill = Math.ceil(totalDefenderHP / (normalAttackData.value * attackerMultiplier));
      timeToKill = round(hitsToKill * attackSpeed, 1);
    }

    // Defender self-healing: heals healingRate HP per hit it lands
    const defenderHealPerHit = defender.healingRate ?? 0;
    if (defenderHealPerHit > 0 && dps !== null) {
      const defenderAttackSpeed = (defender.weapons[0]?.speed ?? 0) * (1 + (attacker.opponentAttackSpeedDebuff ?? 0));
      const healPerS = defenderAttackSpeed > 0 ? defenderHealPerHit / defenderAttackSpeed : 0;
      const netDPS = dps - healPerS;
      if (netDPS <= 0) {
        hitsToKill = null;
        timeToKill = null;
      } else {
        const totalDefHP = defender.hitpoints * (defender.hpStartFraction ?? 1) * defenderMultiplier;
        hitsToKill = Math.ceil(totalDefHP / (netDPS * attackSpeed));
        timeToKill = round(hitsToKill * attackSpeed, 1);
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
            timeToKill = round(firstHitSpeed, 1);
          } else {
            const additionalHits = Math.ceil((totalDefHP - effectiveFirstCycle) / effectiveNormalCycle);
            hitsToKill = 1 + additionalHits;
            timeToKill = round(firstHitSpeed + additionalHits * attackSpeed, 1);
          }
          const totalDmg = effectiveFirstCycle + (hitsToKill - 1) * effectiveNormalCycle;
          const totalTime = firstHitSpeed + (hitsToKill - 1) * attackSpeed;
          dps = round(totalDmg / totalTime, 2);
        } else {
          // Continuous model (equal cost): add secondary DPS then TTK = HP / combinedDPS.
          dps = round((dps ?? 0) + totalSecDPS, 2);
          if (dps > 0) {
            timeToKill = round((defender.hitpoints * defenderMultiplier) / dps, 1);
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
        timeToKill = round(totalDefHP / dps, 1);
        hitsToKill = attackSpeed > 0 ? Math.ceil(timeToKill / attackSpeed) : null;
      } else {
        hitsToKill = null;
        timeToKill = null;
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
          timeToKill = round(totalDefHP / dps, 1);
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
        timeToKill = null;
      } else {
        timeToKill = round(totalDefHP / netDPS, 1);
        hitsToKill = attackSpeed > 0 ? Math.ceil(timeToKill / attackSpeed) : null;
      }
    }

    const unitDPS = round(normalAttackData.value / attackSpeed, 2);
    const cost = totalCost(attacker);
    dpsPerCost = cost > 0 ? round(unitDPS / cost, 2) : null;
  }

  // Special case: self-destructing unit (e.g. demolition ship) — only kills if hitsToKill === 1
  if (attacker.selfDestructs && hitsToKill !== null && hitsToKill > 1) {
    hitsToKill = null;
    timeToKill = null;
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
      const hitsInDuration = Math.floor(timedDurationAttacker / attackSpeed);
      const firstDmgPerHit = firstAttackData.value * attackerMultiplier;
      // Hit 1 carries the charge bonus (includes holy wrath); remaining hits are normal
      const dmgInDuration = hitsInDuration >= 1
        ? firstDmgPerHit + (hitsInDuration - 1) * normalDmgPerHit
        : 0;
      if (dmgInDuration < totalDefHP) {
        const remainingHP = totalDefHP - dmgInDuration;
        const remainingHits = Math.ceil(remainingHP / noTimerDmgPerHit);
        hitsToKill = hitsInDuration + remainingHits;
        timeToKill = round(hitsInDuration * attackSpeed + remainingHits * noTimerAttackSpeed, 1);
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
      const hitsInDuration = Math.floor(timedDurationDefender / attackSpeed);
      const dmgInDuration = hitsInDuration * phase1DmgPerHit;
      if (dmgInDuration < totalDefHP) {
        const remainingHP = totalDefHP - dmgInDuration;
        const remainingHits = Math.ceil(remainingHP / noTimerDefDmgPerHit);
        hitsToKill = hitsInDuration + remainingHits;
        timeToKill = round((hitsInDuration + remainingHits) * attackSpeed, 1);
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
      const hitsInDuration = Math.floor(timedDurationDefender / attackSpeed);
      const phase1Time = hitsInDuration * attackSpeed;
      const healPerS1 = defenderAS > 0 ? phase1HealRate / defenderAS : 0;
      const healPerS2 = defenderAS > 0 ? phase2HealRate / defenderAS : 0;
      const netDmgPhase1 = hitsInDuration * rawDmgPerHit - phase1Time * healPerS1;
      if (netDmgPhase1 < totalDefHP) {
        const remainingHP = totalDefHP - netDmgPhase1;
        const netDmgPerHitPhase2 = rawDmgPerHit - healPerS2 * attackSpeed;
        if (netDmgPerHitPhase2 > 0) {
          const remainingHits = Math.ceil(remainingHP / netDmgPerHitPhase2);
          hitsToKill = hitsInDuration + remainingHits;
          timeToKill = round(phase1Time + remainingHits * attackSpeed, 1);
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
function computeDamageInTime(attacker: CombatEntity, defender: CombatEntity, chargeBonus: number, duration: number): number {
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
  // Non-gunpowder ranged attackers have projectile travel time: only count shots whose
  // projectile arrives within `duration` (i.e. fired at most ARCHER_TRAVEL_TIME before deadline).
  const weapon = normalData.weapon;
  const attackerTravelTime = (weapon?.type === 'ranged' && !isGunpowder(attacker, weapon)) ? ARCHER_TRAVEL_TIME : 0;
  const effectiveDuration = duration - attackerTravelTime;
  if (effectiveDuration < firstHitSpeed) return 0;
  const additionalHits = Math.floor((effectiveDuration - firstHitSpeed) / attackSpeed);
  const firstHitDamage = defender.firstHitBlocked ? 0 : firstData.value;
  let total = firstHitDamage + additionalHits * normalData.value;
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
    const meleeEnt          = isMeleeA_approach ? A : B;
    const rangedEnt         = isMeleeA_approach ? B : A;
    const chargeBonusRanged = isMeleeA_approach ? chargeBonusB : chargeBonusA;
    const prelimMetrics     = computeMetrics(rangedEnt, meleeEnt, chargeBonusRanged, 1, 1, false);
    const rangedRange       = getMaxRange(rangedEnt);
    const T_free            = Math.min(startDistance, rangedRange) / Math.max(0.1, meleeEnt.moveSpeed);
    const asRanged          = (rangedEnt.weapons[0]?.speed ?? 0) * (1 + (meleeEnt.opponentAttackSpeedDebuff ?? 0));
    const wRanged           = rangedEnt.weapons[0]?.durations?.windup ?? 0;
    // Subtract projectile travel time: only shots whose projectile lands ≤ T_free count as
    // approach damage. Mirrors the ARCHER_TRAVEL_TIME subtraction in computeDamageInTime.
    const rangedW0          = rangedEnt.weapons[0];
    const approachTravelTime = (rangedW0?.type === 'ranged' && !isGunpowder(rangedEnt, rangedW0)) ? ARCHER_TRAVEL_TIME : 0;
    const shotsDeadline     = T_free - approachTravelTime;
    const shots             = asRanged > 0 && shotsDeadline >= wRanged
      ? Math.floor((shotsDeadline - wRanged) / asRanged) + 1
      : 0;
    if (shots > 0 && prelimMetrics.effectiveDamagePerHit !== null) {
      const approachDmg  = shots * prelimMetrics.effectiveDamagePerHit;
      const currentHp    = meleeEnt.hitpoints * (meleeEnt.hpStartFraction ?? 1);
      const newFraction  = Math.max(1 / meleeEnt.hitpoints, (currentHp - approachDmg) / meleeEnt.hitpoints);
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
    const healingA = (metricsA.hitsToKill ?? 0) * (A.healingRate ?? 0)
      + metricsA.timeToKill * Math.max(0, A.healingRatePerSecond ?? 0);
    const startHpA = A.hitpoints * (A.hpStartFraction ?? 1);
    winnerHpRemaining = Math.min(A.hitpoints, Math.max(0, startHpA - computeDamageInTime(B, A, chargeBonusB, metricsA.timeToKill) + healingA));
  } else if (winner === "defender" && metricsB.timeToKill !== null) {
    const healingB = (metricsB.hitsToKill ?? 0) * (B.healingRate ?? 0)
      + metricsB.timeToKill * Math.max(0, B.healingRatePerSecond ?? 0);
    const startHpB = B.hitpoints * (B.hpStartFraction ?? 1);
    winnerHpRemaining = Math.min(B.hitpoints, Math.max(0, startHpB - computeDamageInTime(A, B, chargeBonusA, metricsB.timeToKill) + healingB));
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
    const meleeEnt   = isMeleeA_approach ? A : B;
    const rangedEnt  = isMeleeA_approach ? B : A;
    const metRanged  = isMeleeA_approach ? metricsB : metricsA;
    const multMelee  = isMeleeA_approach ? multipliers.multA : multipliers.multB;
    const multRanged = isMeleeA_approach ? multipliers.multB : multipliers.multA;

    const rangedRange  = getMaxRange(rangedEnt);
    const T_free       = Math.min(startDistance, rangedRange) / Math.max(0.1, meleeEnt.moveSpeed ?? 1.5);
    const asRanged     = (rangedEnt.weapons[0]?.speed ?? 0) * (1 + (meleeEnt.opponentAttackSpeedDebuff ?? 0));
    const wRanged      = rangedEnt.weapons[0]?.durations?.windup ?? 0;
    const rangedW0ec   = rangedEnt.weapons[0];
    const approachTravelTimeEc = (rangedW0ec?.type === 'ranged' && !isGunpowder(rangedEnt, rangedW0ec)) ? ARCHER_TRAVEL_TIME : 0;
    const shotsDeadlineEc = T_free - approachTravelTimeEc;
    const shots        = asRanged > 0 && shotsDeadlineEc >= wRanged
      ? Math.floor((shotsDeadlineEc - wRanged) / asRanged) + 1
      : 0;

    if (shots > 0) {
      const totalApproachDmg = multRanged * shots * metRanged.effectiveDamagePerHit;
      const dmgPerMelee      = totalApproachDmg / multMelee;
      const currentHp        = meleeEnt.hitpoints * (meleeEnt.hpStartFraction ?? 1);
      const newFraction      = Math.max(1 / meleeEnt.hitpoints, (currentHp - dmgPerMelee) / meleeEnt.hitpoints);

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
    const travelTimeA = A.weapons[0]?.type === 'ranged' ? ARCHER_TRAVEL_TIME : 0;
    const travelTimeB = B.weapons[0]?.type === 'ranged' ? ARCHER_TRAVEL_TIME : 0;

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

      // Resolve deaths (simultaneous kills handled correctly — both decrement)
      if (hpTargetB <= 0) {
        deadB++;
        remB = multB - deadB;
        hpTargetB = remB > 0 ? startHpB : 0;
      }
      if (hpTargetA <= 0) {
        deadA++;
        remA = multA - deadA;
        hpTargetA = remA > 0 ? startHpA : 0;
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
    } else if (totalHpA > totalHpB) {
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

// Focus-fire batches: applies space-constraint batching only where physically relevant.
// Melee vs Melee   → symmetric batch model (phase redistribution).
// Ranged vs Ranged → standard focus-fire (no batch needed).
// Ranged vs Melee  → ranged concentrates all fire on one melee at a time;
//                    each melee unit independently attacks a different ranged target.
export const focusFireBatchesModel: MultiUnitModel = {
  resolve(A, B, metricsA, metricsB, { multA, multB, totalCostA, totalCostB }) {
    const dmgA = metricsA.effectiveDamagePerHit;
    const dmgB = metricsB.effectiveDamagePerHit;
    const asA = (A.weapons[0]?.speed ?? 0) * (1 + (B.opponentAttackSpeedDebuff ?? 0));
    const asB = (B.weapons[0]?.speed ?? 0) * (1 + (A.opponentAttackSpeedDebuff ?? 0));

    if (!dmgA || !dmgB || dmgA <= 0 || dmgB <= 0 || asA <= 0 || asB <= 0)
      return aggregatedDPSModel.resolve(A, B, metricsA, metricsB, { multA, multB, totalCostA, totalCostB });

    const isMeleeA = getMaxRange(A) < 1;
    const isMeleeB = getMaxRange(B) < 1;

    // Both ranged: no space constraint → standard focus-fire
    if (!isMeleeA && !isMeleeB)
      return focusFireModel.resolve(A, B, metricsA, metricsB, { multA, multB, totalCostA, totalCostB });

    const fDmgA = metricsA.firstHitDamage ?? dmgA;
    const fDmgB = metricsB.firstHitDamage ?? dmgB;
    const wA = A.weapons[0]?.durations?.windup ?? 0;
    const wB = B.weapons[0]?.durations?.windup ?? 0;
    const startHpA = A.hitpoints * (A.hpStartFraction ?? 1);
    const startHpB = B.hitpoints * (B.hpStartFraction ?? 1);

    // Asymmetric: one ranged (concentrates), one melee (distributes across targets)
    if (!isMeleeA || !isMeleeB) {
      const concIsA = !isMeleeA;
      const { hpConc, hpDist } = simulateAsymmetricFF(
        concIsA ? multA  : multB,  concIsA ? startHpA : startHpB,
        concIsA ? dmgA   : dmgB,   concIsA ? fDmgA    : fDmgB,
        concIsA ? asA    : asB,    concIsA ? wA       : wB,
        concIsA ? multB  : multA,  concIsA ? startHpB : startHpA,
        concIsA ? dmgB   : dmgA,   concIsA ? fDmgB    : fDmgA,
        concIsA ? asB    : asA,    concIsA ? wB       : wA,
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
    }

    // Both melee: phase-based symmetric batch model
    let hpA: number[] = Array(multA).fill(startHpA);
    let hpB: number[] = Array(multB).fill(startHpB);
    const MAX_PHASES = (multA + multB) * 3 + 50;

    for (let phase = 0; phase < MAX_PHASES; phase++) {
      if (!hpA.length || !hpB.length) break;
      const cFA = phase === 0 ? fDmgA : dmgA;
      const cFB = phase === 0 ? fDmgB : dmgB;
      const batches = createBatchesFF(hpA, hpB);
      const T = Math.min(...batches.map(b =>
        batchFirstDeathTime(b.hpA, b.hpB, dmgA, dmgB, cFA, cFB, asA, asB, wA, wB)
      ));
      if (!isFinite(T)) break;
      const nHA: number[] = [], nHB: number[] = [];
      for (const b of batches) {
        const r = advanceBatchFF(b.hpA, b.hpB, T, dmgA, dmgB, cFA, cFB, asA, asB, wA, wB);
        nHA.push(...r.hpA); nHB.push(...r.hpB);
      }
      hpA = nHA.filter(h => h > 0);
      hpB = nHB.filter(h => h > 0);
    }

    return buildBatchResult(
      hpA.length, hpB.length,
      hpA.reduce((s, h) => s + h, 0), hpB.reduce((s, h) => s + h, 0),
      multA, multB, totalCostA, totalCostB,
    );
  },
};

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
    const wA = A.weapons[0]?.durations?.windup ?? 0;
    const wB = B.weapons[0]?.durations?.windup ?? 0;
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
          batchFirstDeathTime(b.hpA, b.hpB, dmgA, dmgB, cFA, cFB, asA, asB, wA, wB)
        ));
        if (!isFinite(T)) break;
        const nHA: number[] = [], nHB: number[] = [];
        for (const b of batches) {
          const r = advanceBatchFF(b.hpA, b.hpB, T, dmgA, dmgB, cFA, cFB, asA, asB, wA, wB);
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
      return { ...det, mcDistribution: {
        winRateA: det.winner === 'attacker' ? 1 : 0,
        winRateB: det.winner === 'defender' ? 1 : 0,
        drawRate: det.winner === 'draw' ? 1 : 0,
        iterations: 1,
        whenAWins: computeMCWinnerStats(single, 'attacker'),
        whenBWins: computeMCWinnerStats(single, 'defender'),
      } };
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
          return batchFirstDeathTime(b.hpA, b.hpB, dmgA, dmgB, cFA, cFB, asA, asB, wA, wB);
        }));
        if (!isFinite(T)) break;
        timeElapsed += T;

        const nextActive: ActiveBatch[] = [];

        for (const b of active) {
          const cFA = b.firstShotUsed ? dmgA : fDmgA;
          const cFB = b.firstShotUsed ? dmgB : fDmgB;
          const r = advanceBatchFF(b.hpA, b.hpB, T, dmgA, dmgB, cFA, cFB, asA, asB, wA, wB);
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
    const wA = A.weapons[0]?.durations?.windup ?? 0;
    const wB = B.weapons[0]?.durations?.windup ?? 0;
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
          return batchFirstDeathTime(b.hpA, b.hpB, dmgA, dmgB, cFA, cFB, asA, asB, wA, wB);
        }));
        if (!isFinite(T)) break;
        timeElapsed += T;

        const nextActive: ActiveBatch[] = [];
        for (const b of active) {
          const cFA = b.firstShotUsed ? dmgA : fDmgA;
          const cFB = b.firstShotUsed ? dmgB : fDmgB;
          const r = advanceBatchFF(b.hpA, b.hpB, T, dmgA, dmgB, cFA, cFB, asA, asB, wA, wB);
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
          const newBatches = createBatchesFFRandom(pendingA, pendingB);
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
      concIsA ? multA  : multB,  concIsA ? startHpA : startHpB,
      concIsA ? dmgA   : dmgB,   concIsA ? fDmgA    : fDmgB,
      concIsA ? asA    : asB,    concIsA ? wA       : wB,
      concIsA ? multB  : multA,  concIsA ? startHpB : startHpA,
      concIsA ? dmgB   : dmgA,   concIsA ? fDmgB    : fDmgA,
      concIsA ? asB    : asA,    concIsA ? wB       : wA,
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

// Same as focusFireBatchesModel but without the "both ranged → fall back to focusFireModel" shortcut.
// Ranged units are treated like melee for space-constraint purposes (each attacks a different target).
export const focusFireBatchesPureModel: MultiUnitModel = {
  resolve(A, B, metricsA, metricsB, { multA, multB, totalCostA, totalCostB }) {
    const dmgA = metricsA.effectiveDamagePerHit;
    const dmgB = metricsB.effectiveDamagePerHit;
    const asA = (A.weapons[0]?.speed ?? 0) * (1 + (B.opponentAttackSpeedDebuff ?? 0));
    const asB = (B.weapons[0]?.speed ?? 0) * (1 + (A.opponentAttackSpeedDebuff ?? 0));

    if (!dmgA || !dmgB || dmgA <= 0 || dmgB <= 0 || asA <= 0 || asB <= 0)
      return aggregatedDPSModel.resolve(A, B, metricsA, metricsB, { multA, multB, totalCostA, totalCostB });

    const fDmgA = metricsA.firstHitDamage ?? dmgA;
    const fDmgB = metricsB.firstHitDamage ?? dmgB;
    const wA = A.weapons[0]?.durations?.windup ?? 0;
    const wB = B.weapons[0]?.durations?.windup ?? 0;
    const startHpA = A.hitpoints * (A.hpStartFraction ?? 1);
    const startHpB = B.hitpoints * (B.hpStartFraction ?? 1);

    const isMeleeA = getMaxRange(A) < 1;
    const isMeleeB = getMaxRange(B) < 1;

    // Asymmetric: one ranged (concentrates), one melee (distributes across targets)
    if (!isMeleeA || !isMeleeB) {
      const concIsA = !isMeleeA;
      const { hpConc, hpDist } = simulateAsymmetricFF(
        concIsA ? multA  : multB,  concIsA ? startHpA : startHpB,
        concIsA ? dmgA   : dmgB,   concIsA ? fDmgA    : fDmgB,
        concIsA ? asA    : asB,    concIsA ? wA       : wB,
        concIsA ? multB  : multA,  concIsA ? startHpB : startHpA,
        concIsA ? dmgB   : dmgA,   concIsA ? fDmgB    : fDmgA,
        concIsA ? asB    : asA,    concIsA ? wB       : wA,
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
    }

    // Both melee (or both ranged treated as melee): phase-based symmetric batch model
    let hpA: number[] = Array(multA).fill(startHpA);
    let hpB: number[] = Array(multB).fill(startHpB);
    const MAX_PHASES = (multA + multB) * 3 + 50;

    for (let phase = 0; phase < MAX_PHASES; phase++) {
      if (!hpA.length || !hpB.length) break;
      const cFA = phase === 0 ? fDmgA : dmgA;
      const cFB = phase === 0 ? fDmgB : dmgB;
      const batches = createBatchesFF(hpA, hpB);
      const T = Math.min(...batches.map(b =>
        batchFirstDeathTime(b.hpA, b.hpB, dmgA, dmgB, cFA, cFB, asA, asB, wA, wB)
      ));
      if (!isFinite(T)) break;
      const nHA: number[] = [], nHB: number[] = [];
      for (const b of batches) {
        const r = advanceBatchFF(b.hpA, b.hpB, T, dmgA, dmgB, cFA, cFB, asA, asB, wA, wB);
        nHA.push(...r.hpA); nHB.push(...r.hpB);
      }
      hpA = nHA.filter(h => h > 0);
      hpB = nHB.filter(h => h > 0);
    }

    return buildBatchResult(
      hpA.length, hpB.length,
      hpA.reduce((s, h) => s + h, 0), hpB.reduce((s, h) => s + h, 0),
      multA, multB, totalCostA, totalCostB,
    );
  },
};

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
