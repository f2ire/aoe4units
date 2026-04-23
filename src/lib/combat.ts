import { AoE4Unit, UnifiedVariation, UnifiedWeapon, UnifiedArmor, UnifiedResistance, getArmorValue, getResistanceValue } from "@/data/unified-units";
import { allAbilities } from "@/data/unified-abilities";

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
  moveSpeed: number; // tiles/s (movement.speed from unit data)
  healingRate?: number; // HP healed per hit the unit lands (e.g. Keshik: 3 HP/hit)
  armorPenetration?: number; // Enemy armor reduced by this amount on each hit (clamped ≥ 0)
  chargeBonusBurst?: number; // Burst count for first-hit bonus display (e.g. 2 daggers for Earl's Guard)
  chargeArmorType?: 'ranged'; // If set, first-hit charge bonus uses ranged armor/resistance instead of primary weapon armor
  continuousMovement?: boolean; // unit can move throughout entire attack cycle (e.g. Mangudai)
  selfDestructs?: boolean; // unit self-destructs on first hit — if hitsToKill > 1, it can never kill
  secondaryWeapons?: UnifiedWeapon[]; // additional weapons fired simultaneously (e.g. thunderclap-bombs)
}

export interface VersusMetrics {
  id: string;
  name: string;
  dps: number | null;
  dpsPerCost: number | null;
  hitsToKill: number | null;
  timeToKill: number | null; // seconds
  effectiveDamagePerHit: number | null;
  bugAttackSpeed: boolean;
  cannotAttackUnits: boolean; // e.g. ram — attacks buildings only
  formula: string; // detailed description for tooltip
}

export interface VersusResult {
  attacker: VersusMetrics;
  defender: VersusMetrics; // metrics of B vs A
  winner: "draw" | "attacker" | "defender";
  winnerHpRemaining?: number;
  winnerUnitsRemaining?: number;
  resourceDifference?: number;
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
    moveSpeed: source.movement?.speed ?? 0,
    healingRate: (source as any).healingRate ?? 0, // eslint-disable-line @typescript-eslint/no-explicit-any
    armorPenetration: (source as any).armorPenetration ?? 0, // eslint-disable-line @typescript-eslint/no-explicit-any
    chargeBonusBurst: (source as any).chargeBonusBurst ?? 1, // eslint-disable-line @typescript-eslint/no-explicit-any
    chargeArmorType: (source as any).chargeArmorType, // eslint-disable-line @typescript-eslint/no-explicit-any
    continuousMovement: (source as any).continuousMovement ?? false, // eslint-disable-line @typescript-eslint/no-explicit-any
    selfDestructs: (source as any).selfDestructs ?? false, // eslint-disable-line @typescript-eslint/no-explicit-any
    secondaryWeapons: (source as any).secondaryWeapons ?? [], // eslint-disable-line @typescript-eslint/no-explicit-any
  };
}

function totalCost(entity: CombatEntity): number {
  const c = entity.costs;
  return c.food + c.wood + c.gold + c.stone + (c.oliveoil || 0);
}

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

// Computes the versus debuff multiplier applied by the defender's abilities on the attacker
export function getVersusDebuffMultiplier(attackerClasses: string[], defenderAbilities: string[]): number {
  if (!defenderAbilities || defenderAbilities.length === 0) return 1.0;

  let multiplier = 1.0;
  const attackerClassesLower = attackerClasses.map(c => c.toLowerCase());

  // For each active ability of the defender
  for (const abilityId of defenderAbilities) {
    const ability = allAbilities.find(a => a.id === abilityId);
    if (!ability || !ability.effects) continue;

    // Look for effects of type versusOpponentDamageDebuff
    for (const effect of ability.effects) {
      if (effect.property !== 'versusOpponentDamageDebuff') continue;
      if (effect.effect !== 'multiply') continue;

      // Check whether the attacker matches the targeted classes
      if (effect.select?.class) {
        const groups: string[][] = Array.isArray(effect.select.class) && effect.select.class.some(v => Array.isArray(v))
          ? (effect.select.class as unknown as string[][])
          : [effect.select.class as unknown as string[]];

        const matches = groups.some(group => {
          if (!Array.isArray(group)) return false;
          return group.every(req => {
            const r = req.toLowerCase();
            return attackerClassesLower.includes(r);
          });
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
  // Siege weapons ignore armor (they are not affected by melee or ranged armor)
  if (weapon.type !== "siege" && !shouldIgnoreArmor(attacker, weapon)) {
    if (weapon.type === "melee") {
      armorValue = getArmorValue(defender as unknown as AoE4Unit, "melee");
    } else if (weapon.type === "ranged") {
      // Gunpowder ignores ranged armor
      if (!isGunpowder(attacker, weapon)) {
        armorValue = getArmorValue(defender as unknown as AoE4Unit, "ranged");
      }
    } else {
      // Other types: apply ranged armor unless ignored above
      if (!isGunpowder(attacker, weapon)) {
        armorValue = getArmorValue(defender as unknown as AoE4Unit, "ranged");
      }
    }
    // Armor penetration: attacker reduces effective enemy armor (floor at 0)
    if (attacker.armorPenetration) {
      armorValue = Math.max(0, armorValue - attacker.armorPenetration);
    }
  }

  // If chargeArmorType === 'ranged', the charge bonus (e.g. dagger throw) is computed separately
  // using ranged armor and ranged resistance instead of the primary weapon's armor type.
  const isDaggerCharge = chargeBonus_applied > 0 && attacker.chargeArmorType === 'ranged';
  const chargeInPrimary = isDaggerCharge ? 0 : chargeBonus_applied;

  // Damage per projectile: (baseDamage + bonus + chargeBonus - armor) * burst
  // Armor is applied to each projectile individually
  let damagePerProjectile = baseDamage + bonusDamage + chargeInPrimary - armorValue;

  // Apply versus debuffs (e.g. Camel Unease)
  const debuffMultiplier = getVersusDebuffMultiplier(attacker.classes, defender.activeAbilities || []);
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

  const clampedPerProjectile = damagePerProjectile < 1 ? 1 : damagePerProjectile;
  const totalPrimary = clampedPerProjectile * burstCount;

  // Dagger charge: computed separately with ranged armor + ranged resistance (clamped to 0, not 1)
  let daggerExtra = 0;
  if (isDaggerCharge) {
    const daggerBurst = attacker.chargeBonusBurst ?? 1;
    const perDagger = chargeBonus_applied / daggerBurst;
    const rangedArmorVal = getArmorValue(defender as unknown as AoE4Unit, 'ranged');
    const rangedResPct = getResistanceValue(defender as unknown as AoE4Unit, 'ranged');
    const perDaggerEff = Math.max(0, perDagger - rangedArmorVal);
    daggerExtra = perDaggerEff * daggerBurst * (rangedResPct !== 0 ? (1 - rangedResPct / 100) : 1);
  }

  const totalDamage = totalPrimary + daggerExtra;

  return { value: totalDamage, base: baseDamage * burstCount, bonus: (bonusDamage + chargeInPrimary) * burstCount, armorApplied: armorValue, weapon, debuffMultiplier: debuffMultiplier !== 1.0 ? debuffMultiplier : undefined, resistanceApplied };
}

function round(value: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
}

// ─── Movement & Kiting ───────────────────────────────────────────────────────

export const START_DISTANCE = 5; // default starting distance in tiles (configurable later)

function isRangedUnit(entity: CombatEntity): boolean {
  return entity.weapons[0]?.type === 'ranged';
}

function getMaxRange(entity: CombatEntity): number {
  return entity.weapons[0]?.range?.max ?? 0;
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
  const attackCycle = ranged.weapons[0]?.speed ?? 0;

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
  const t_approach = Math.max(0, d0 - rangeMax) / effectiveMeleeSpeed;
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
      newTTKranged = round(contactTime + (hitsToKill - preContactHits) * attackCycle, 1);
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
  discreteTTK: boolean = false
): VersusMetrics {
  const chargeWeapon = getChargeWeapon(attacker);
  const hasChargeWeapon = !!chargeWeapon && (attacker.activeAbilities?.includes('charge-attack') ?? false);
  const firstAttackData = computeEffectiveDamage(attacker, defender, chargeBonus, true);
  const normalAttackData = computeEffectiveDamage(attacker, defender, 0, false);
  const weapon = normalAttackData.weapon;
  const attackSpeed = weapon?.speed || 0;
  // First hit uses the charge weapon's own attack cycle (if present)
  const firstHitSpeed = hasChargeWeapon ? (chargeWeapon!.speed || attackSpeed) : attackSpeed;
  const bugAttackSpeed = attackSpeed <= 0;
  let dps: number | null = null;
  let hitsToKill: number | null = null;
  let timeToKill: number | null = null;
  let dpsPerCost: number | null = null;

  if (!bugAttackSpeed) {
    const totalDefenderHP = defender.hitpoints * defenderMultiplier;

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
      const defenderAttackSpeed = defender.weapons[0]?.speed ?? 0;
      const healPerS = defenderAttackSpeed > 0 ? defenderHealPerHit / defenderAttackSpeed : 0;
      const netDPS = dps - healPerS;
      if (netDPS <= 0) {
        hitsToKill = null;
        timeToKill = null;
      } else {
        const totalDefHP = defender.hitpoints * defenderMultiplier;
        timeToKill = round(totalDefHP / netDPS, 1);
        hitsToKill = Math.ceil(timeToKill / attackSpeed);
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
          const totalDefHP = defender.hitpoints * defenderMultiplier;
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
  const chargeLabel = isBleedUnit ? 'Bleed' : isDaggerUnit ? 'Dagger' : 'Charge';
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
    bugAttackSpeed,
    cannotAttackUnits: false,
    formula,
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

export function computeVersus(
  a: AoE4Unit | UnifiedVariation,
  b: AoE4Unit | UnifiedVariation,
  activeAbilitiesA?: string[],
  activeAbilitiesB?: string[],
  chargeBonusA: number = 0,
  chargeBonusB: number = 0,
  allowKiting: boolean = false,
  startDistance: number = START_DISTANCE,
): VersusResult {
  const A = toCombatEntity(a, activeAbilitiesA);
  const B = toCombatEntity(b, activeAbilitiesB);
  let metricsA = computeMetrics(A, B, chargeBonusA, 1, 1, true);
  let metricsB = computeMetrics(B, A, chargeBonusB, 1, 1, true);

  // Apply movement / kiting adjustments (only when enabled)
  if (allowKiting) {
    ({ adjustedA: metricsA, adjustedB: metricsB } = applyKitingToMetrics(metricsA, metricsB, A, B, startDistance));
  }

  // Determine winner via TTK (lower wins), draw if within <=5%
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
      const diff = Math.abs(tA - tB);
      const threshold = Math.max(tA, tB) * 0.05; // 5%
      winner = diff <= threshold ? "draw" : (tA < tB ? "attacker" : "defender");
    }
  }

  return {
    attacker: metricsA,
    defender: metricsB,
    winner,
  };
}

// Compute versus with equal cost multipliers
export function computeVersusAtEqualCost(
  a: AoE4Unit | UnifiedVariation,
  b: AoE4Unit | UnifiedVariation,
  activeAbilitiesA?: string[],
  activeAbilitiesB?: string[],
  chargeBonusA: number = 0,
  chargeBonusB: number = 0,
  allowKiting: boolean = false,
  startDistance: number = START_DISTANCE,
): VersusResult & { multipliers: { multA: number; multB: number; totalCostA: number; totalCostB: number } } {
  const A = toCombatEntity(a, activeAbilitiesA);
  const B = toCombatEntity(b, activeAbilitiesB);

  // Compute the multipliers
  const costA = totalCost(A);
  const costB = totalCost(B);
  const multipliers = calculateEqualCostMultipliers(costA, costB);

  // Compute metrics with multipliers
  // A attacks B: multA attackers vs multB defenders
  let metricsA = computeMetrics(A, B, chargeBonusA, multipliers.multA, multipliers.multB);
  // B attacks A: multB attackers vs multA defenders
  let metricsB = computeMetrics(B, A, chargeBonusB, multipliers.multB, multipliers.multA);

  // Apply movement / kiting adjustments (timing is per-unit, independent of multipliers)
  if (allowKiting) {
    ({ adjustedA: metricsA, adjustedB: metricsB } = applyKitingToMetrics(metricsA, metricsB, A, B, startDistance));
  }

  // Compute remaining units for both sides
  let unitsRemainingA: number = 0;
  let unitsRemainingB: number = 0;
  let hpRemainingA: number = 0;
  let hpRemainingB: number = 0;

  // Special case: one side cannot attack units (e.g. ram)
  if (metricsA.cannotAttackUnits || metricsB.cannotAttackUnits) {
    let winner: "draw" | "attacker" | "defender" = "draw";
    if (metricsA.cannotAttackUnits && metricsB.cannotAttackUnits) {
      winner = "draw";
    } else if (metricsA.cannotAttackUnits) {
      winner = "defender";
    } else {
      winner = "attacker";
    }
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

  if (!metricsA.bugAttackSpeed && !metricsB.bugAttackSpeed && metricsA.timeToKill !== null && metricsB.timeToKill !== null) {
    // Combat ends when the first side is wiped — duration = min TTK
    const combatDuration = Math.min(metricsA.timeToKill, metricsB.timeToKill);

    const totalAttackerHP_A = A.hitpoints * multipliers.multA;
    const totalAttackerHP_B = B.hitpoints * multipliers.multB;

    // damageTaken = total group DPS × combat duration
    const damageTakenByA = (metricsB.dps ?? 0) * combatDuration;
    hpRemainingA = Math.max(0, totalAttackerHP_A - damageTakenByA);
    unitsRemainingA = Math.floor(hpRemainingA / A.hitpoints);

    const damageTakenByB = (metricsA.dps ?? 0) * combatDuration;
    hpRemainingB = Math.max(0, totalAttackerHP_B - damageTakenByB);
    unitsRemainingB = Math.floor(hpRemainingB / B.hitpoints);
  }

  // Determine winner via remaining units
  let winner: "draw" | "attacker" | "defender" = "draw";
  let winnerHpRemaining: number | undefined;
  let winnerUnitsRemaining: number | undefined;
  let resourceDifference: number | undefined;

  if (unitsRemainingA > unitsRemainingB) {
    winner = "attacker";
    winnerHpRemaining = hpRemainingA;
    winnerUnitsRemaining = unitsRemainingA;
    const costPerUnit = multipliers.totalCostA / multipliers.multA;
    resourceDifference = winnerUnitsRemaining * costPerUnit;
  } else if (unitsRemainingB > unitsRemainingA) {
    winner = "defender";
    winnerHpRemaining = hpRemainingB;
    winnerUnitsRemaining = unitsRemainingB;
    const costPerUnit = multipliers.totalCostB / multipliers.multB;
    resourceDifference = winnerUnitsRemaining * costPerUnit;
  } else if (hpRemainingA > hpRemainingB) {
    // Tiebreaker: same whole-unit count (often 0-0) but A has more HP fragments
    winner = "attacker";
    winnerHpRemaining = hpRemainingA;
    winnerUnitsRemaining = 0;
  } else if (hpRemainingB > hpRemainingA) {
    winner = "defender";
    winnerHpRemaining = hpRemainingB;
    winnerUnitsRemaining = 0;
  } else {
    winner = "draw";
  }

  return {
    attacker: metricsA,
    defender: metricsB,
    winner,
    winnerHpRemaining,
    winnerUnitsRemaining,
    resourceDifference,
    multipliers,
  };
}
