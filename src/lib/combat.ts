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
  winner: "draw" | string; // id of the winner or draw
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
function computeEffectiveDamage(attacker: CombatEntity, defender: CombatEntity, chargeBonus: number = 0, isFirstAttack: boolean = false): { value: number; base: number; bonus: number; armorApplied: number; weapon?: UnifiedWeapon; debuffMultiplier?: number; cannotAttack?: boolean; resistanceApplied?: number } {
  // Ram (and similar units): can only attack buildings
  const RAM_CLASSES = ["ram", "workshop_ram"];
  if (attacker.classes.some(c => RAM_CLASSES.includes(c.toLowerCase()))) {
    return { value: 0, base: 0, bonus: 0, armorApplied: 0, cannotAttack: true };
  }

  const weapon = attacker.weapons[0];
  if (!weapon) return { value: 1, base: 0, bonus: 0, armorApplied: 0, weapon }; // No weapon -> minimal

  const baseDamage = weapon.damage || 0;
  
  // Number of projectiles (burst)
  const burstCount = weapon.burst?.count || 1;
  
  // Add charge bonus ONLY on the first attack
  const chargeBonus_applied = isFirstAttack ? chargeBonus : 0;

  // Applicable bonuses: AND logic per group. Each entry of mod.target.class:
  // - If it is a simple array ["infantry","light"] => requires all these classes (AND)
  // - If it is an array of arrays [["light","gunpowder","infantry"],["cavalry","melee"]] => OR between groups, AND within each group.
  // NOTE: "siegeAttack" bonuses apply like all other normal bonuses (since data unification)
  let bonusDamage = 0;
  if (weapon.modifiers && defender.classes && defender.classes.length > 0) {
    const defenderClassesLower = defender.classes.map(c => c.toLowerCase());
    // Build a set containing all defender classes
    const expandedTokens = new Set<string>();
    for (const cls of defenderClassesLower) {
      expandedTokens.add(cls);
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
  }

  // Damage per projectile: (baseDamage + bonus + chargeBonus - armor) * burst
  // Armor is applied to each projectile individually
  let damagePerProjectile = baseDamage + bonusDamage + chargeBonus_applied - armorValue;

  // Apply versus debuffs (e.g. Camel Unease)
  const debuffMultiplier = getVersusDebuffMultiplier(attacker.classes, defender.activeAbilities || []);
  if (debuffMultiplier !== 1.0) {
    damagePerProjectile = damagePerProjectile * debuffMultiplier;
  }

  // Apply the defender's resistance (e.g. Ram resists 95% of ranged damage)
  // Resistance is applied after armor, before clamping to 1
  const resistancePct = getResistanceValue(defender as unknown as AoE4Unit, weapon.type);
  let resistanceApplied: number | undefined;
  if (resistancePct > 0) {
    damagePerProjectile = damagePerProjectile * (1 - resistancePct / 100);
    resistanceApplied = resistancePct;
  }

  const clampedPerProjectile = damagePerProjectile < 1 ? 1 : damagePerProjectile;
  const totalDamage = clampedPerProjectile * burstCount;

  return { value: totalDamage, base: baseDamage * burstCount, bonus: (bonusDamage + chargeBonus_applied) * burstCount, armorApplied: armorValue, weapon, debuffMultiplier: debuffMultiplier !== 1.0 ? debuffMultiplier : undefined, resistanceApplied };
}

function round(value: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
}

function computeMetrics(
  attacker: CombatEntity,
  defender: CombatEntity,
  chargeBonus: number = 0,
  attackerMultiplier: number = 1,
  defenderMultiplier: number = 1
): VersusMetrics {
  const firstAttackData = computeEffectiveDamage(attacker, defender, chargeBonus, true);
  const normalAttackData = computeEffectiveDamage(attacker, defender, 0, false);
  const weapon = normalAttackData.weapon;
  const attackSpeed = weapon?.speed || 0;
  const bugAttackSpeed = attackSpeed <= 0;
  let dps: number | null = null;
  let hitsToKill: number | null = null;
  let timeToKill: number | null = null;
  let dpsPerCost: number | null = null;

  if (!bugAttackSpeed) {
    const totalDefenderHP = defender.hitpoints * defenderMultiplier;

    if (chargeBonus > 0) {
      const firstCycleDamage = firstAttackData.value * attackerMultiplier;
      const normalCycleDamage = normalAttackData.value * attackerMultiplier;

      if (firstCycleDamage >= totalDefenderHP) {
        hitsToKill = 1;
        timeToKill = round(attackSpeed, 1);
      } else {
        const additionalHits = Math.ceil((totalDefenderHP - firstCycleDamage) / normalCycleDamage);
        hitsToKill = 1 + additionalHits;
        timeToKill = round(hitsToKill * attackSpeed, 1);
      }
      const totalDamage = firstCycleDamage + (hitsToKill - 1) * normalCycleDamage;
      dps = round(totalDamage / (hitsToKill * attackSpeed), 2);
    } else {
      const unitDPS = round(normalAttackData.value / attackSpeed, 2);
      dps = round(unitDPS * attackerMultiplier, 2);
      hitsToKill = Math.ceil(totalDefenderHP / (normalAttackData.value * attackerMultiplier));
      timeToKill = round(hitsToKill * attackSpeed, 1);
    }

    const unitDPS = round(normalAttackData.value / attackSpeed, 2);
    const cost = totalCost(attacker);
    dpsPerCost = cost > 0 ? round(unitDPS / cost, 2) : null;
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
  const chargeText = chargeBonus > 0 ? ` + Charge(${chargeBonus})` : '';
  const resistanceText = normalAttackData.resistanceApplied ? ` × (1 - ${normalAttackData.resistanceApplied}% resistance)` : '';
  const formula = attackerMultiplier > 1
    ? `${attackerMultiplier} × [Effective = max(1, (Base(${normalAttackData.base}) + Bonus(${normalAttackData.bonus})${chargeText} - Armor(${normalAttackData.armorApplied}))${resistanceText}) = ${normalAttackData.value}] vs ${defenderMultiplier} defenders` + (weapon ? `; Total DPS = ${dps}` : "")
    : `Effective = max(1, (Base(${normalAttackData.base}) + Bonus(${normalAttackData.bonus})${chargeText} - Armor(${normalAttackData.armorApplied}))${resistanceText}${debuffText}) = ${normalAttackData.value}` + (weapon ? `; DPS = ${dps}` : "");

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
  chargeBonusB: number = 0
): VersusResult {
  const A = toCombatEntity(a, activeAbilitiesA);
  const B = toCombatEntity(b, activeAbilitiesB);
  const metricsA = computeMetrics(A, B, chargeBonusA);
  const metricsB = computeMetrics(B, A, chargeBonusB);

  // Determine winner via TTK (lower wins), draw if within <=5%
  let winner: "draw" | string = "draw";
  if (metricsA.cannotAttackUnits && metricsB.cannotAttackUnits) {
    winner = "draw";
  } else if (metricsA.cannotAttackUnits) {
    winner = metricsB.id;
  } else if (metricsB.cannotAttackUnits) {
    winner = metricsA.id;
  } else if (!metricsA.bugAttackSpeed && !metricsB.bugAttackSpeed && metricsA.timeToKill !== null && metricsB.timeToKill !== null) {
    const tA = metricsA.timeToKill;
    const tB = metricsB.timeToKill;
    const diff = Math.abs(tA - tB);
    const threshold = Math.max(tA, tB) * 0.05; // 5%
    if (diff <= threshold) {
      winner = "draw";
    } else {
      winner = tA < tB ? metricsA.id : metricsB.id;
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
  chargeBonusB: number = 0
): VersusResult & { multipliers: { multA: number; multB: number; totalCostA: number; totalCostB: number } } {
  const A = toCombatEntity(a, activeAbilitiesA);
  const B = toCombatEntity(b, activeAbilitiesB);
  
  // Compute the multipliers
  const costA = totalCost(A);
  const costB = totalCost(B);
  const multipliers = calculateEqualCostMultipliers(costA, costB);
  
  // Compute metrics with multipliers
  // A attacks B: multA attackers vs multB defenders
  const metricsA = computeMetrics(A, B, chargeBonusA, multipliers.multA, multipliers.multB);
  // B attacks A: multB attackers vs multA defenders
  const metricsB = computeMetrics(B, A, chargeBonusB, multipliers.multB, multipliers.multA);

  // Compute remaining units for both sides
  let unitsRemainingA: number = 0;
  let unitsRemainingB: number = 0;
  let hpRemainingA: number = 0;
  let hpRemainingB: number = 0;
  
  // Special case: one side cannot attack units (e.g. ram)
  if (metricsA.cannotAttackUnits || metricsB.cannotAttackUnits) {
    let winner: "draw" | string = "draw";
    if (metricsA.cannotAttackUnits && metricsB.cannotAttackUnits) {
      winner = "draw";
    } else if (metricsA.cannotAttackUnits) {
      winner = metricsB.id;
    } else {
      winner = metricsA.id;
    }
    return { attacker: metricsA, defender: metricsB, winner, multipliers };
  }

  if (!metricsA.bugAttackSpeed && !metricsB.bugAttackSpeed && metricsA.timeToKill !== null && metricsB.timeToKill !== null) {
    // Compute damage taken by A during its TTK against B
    const attackDataBA = computeEffectiveDamage(B, A); // B attacks A
    const effectiveDamagePerCycleBA = attackDataBA.value * multipliers.multB;
    const totalAttackerHP_A = A.hitpoints * multipliers.multA;
    const damageTakenByA = effectiveDamagePerCycleBA * metricsA.hitsToKill!;
    hpRemainingA = Math.max(0, totalAttackerHP_A - damageTakenByA);
    unitsRemainingA = Math.floor(hpRemainingA / A.hitpoints);
    
    // Compute damage taken by B during its TTK against A
    const attackDataAB = computeEffectiveDamage(A, B); // A attacks B
    const effectiveDamagePerCycleAB = attackDataAB.value * multipliers.multA;
    const totalAttackerHP_B = B.hitpoints * multipliers.multB;
    const damageTakenByB = effectiveDamagePerCycleAB * metricsB.hitsToKill!;
    hpRemainingB = Math.max(0, totalAttackerHP_B - damageTakenByB);
    unitsRemainingB = Math.floor(hpRemainingB / B.hitpoints);
  }

  // Determine winner via remaining units
  let winner: "draw" | string = "draw";
  let winnerHpRemaining: number | undefined;
  let winnerUnitsRemaining: number | undefined;
  let resourceDifference: number | undefined;
  
  if (unitsRemainingA > unitsRemainingB) {
    winner = metricsA.id;
    winnerHpRemaining = hpRemainingA;
    winnerUnitsRemaining = unitsRemainingA;
    const costPerUnit = multipliers.totalCostA / multipliers.multA;
    resourceDifference = winnerUnitsRemaining * costPerUnit;
  } else if (unitsRemainingB > unitsRemainingA) {
    winner = metricsB.id;
    winnerHpRemaining = hpRemainingB;
    winnerUnitsRemaining = unitsRemainingB;
    const costPerUnit = multipliers.totalCostB / multipliers.multB;
    resourceDifference = winnerUnitsRemaining * costPerUnit;
  } else {
    // Draw if remaining units are equal (including 0-0)
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
