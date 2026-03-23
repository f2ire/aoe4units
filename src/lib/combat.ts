import { AoE4Unit, UnifiedVariation, UnifiedWeapon, UnifiedArmor, UnifiedResistance, getArmorValue, getResistanceValue } from "@/data/unified-units";
import { allAbilities } from "@/data/unified-abilities";

// Type regroupé pour accepter unit ou variation modifiée
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
  activeAbilities?: string[]; // IDs des abilités actives
}

export interface VersusMetrics {
  id: string;
  name: string;
  dps: number | null;
  dpsPerCost: number | null;
  hitsToKill: number | null;
  timeToKill: number | null; // secondes
  effectiveDamagePerHit: number | null;
  bugAttackSpeed: boolean;
  cannotAttackUnits: boolean; // ex: ram — attaque uniquement les bâtiments
  formula: string; // description détaillée pour tooltip
}

export interface VersusResult {
  attacker: VersusMetrics;
  defender: VersusMetrics; // metrics de B vs A
  winner: "draw" | string; // id du gagnant ou draw
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

// Détermine si l'entité est gunpowder (ignore ranged armor sur tir)
function isGunpowder(entity: CombatEntity, weapon?: UnifiedWeapon): boolean {
  if (!weapon) return false;
  // Basé sur classes contenant "gunpowder"
  return entity.classes.some(c => c.toLowerCase().includes("gunpowder"));
}

// Détermine si on ignore l'armure (siege ou gunpowder ou weapon.type === 'siege')
function shouldIgnoreArmor(attacker: CombatEntity, weapon?: UnifiedWeapon): boolean {
  if (!weapon) return false;
  if (weapon.type === "siege") return true;
  // Siege classes communes
  const siegeClasses = ["siege", "siege_range", "siege_tower", "ram", "catapult", "trebuchet_counterweight"]; 
  if (attacker.classes.some(c => siegeClasses.includes(c.toLowerCase()))) return true;
  return false;
}

// Calcule le multiplicateur de debuff versus appliqué par les abilités du défenseur sur l'attaquant
export function getVersusDebuffMultiplier(attackerClasses: string[], defenderAbilities: string[]): number {
  if (!defenderAbilities || defenderAbilities.length === 0) return 1.0;
  
  let multiplier = 1.0;
  const attackerClassesLower = attackerClasses.map(c => c.toLowerCase());
  
  // Pour chaque abilité active du défenseur
  for (const abilityId of defenderAbilities) {
    const ability = allAbilities.find(a => a.id === abilityId);
    if (!ability || !ability.effects) continue;
    
    // Chercher les effets de type versusOpponentDamageDebuff
    for (const effect of ability.effects) {
      if (effect.property !== 'versusOpponentDamageDebuff') continue;
      if (effect.effect !== 'multiply') continue;
      
      // Vérifier si l'attaquant correspond aux classes ciblées
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

// Calcule les dégâts effectifs par coup d'attaquant vers défenseur
function computeEffectiveDamage(attacker: CombatEntity, defender: CombatEntity, chargeBonus: number = 0, isFirstAttack: boolean = false): { value: number; base: number; bonus: number; armorApplied: number; weapon?: UnifiedWeapon; debuffMultiplier?: number; cannotAttack?: boolean; resistanceApplied?: number } {
  // Ram (et assimilés) : peut uniquement attaquer les bâtiments
  const RAM_CLASSES = ["ram", "workshop_ram"];
  if (attacker.classes.some(c => RAM_CLASSES.includes(c.toLowerCase()))) {
    return { value: 0, base: 0, bonus: 0, armorApplied: 0, cannotAttack: true };
  }

  const weapon = attacker.weapons[0];
  if (!weapon) return { value: 1, base: 0, bonus: 0, armorApplied: 0, weapon }; // Pas d'arme -> minimal

  const baseDamage = weapon.damage || 0;
  
  // Nombre de projectiles (burst)
  const burstCount = weapon.burst?.count || 1;
  
  // Ajouter le bonus de charge SEULEMENT au premier attaque
  const chargeBonus_applied = isFirstAttack ? chargeBonus : 0;

  // Bonus applicables : logique AND par groupe. Chaque entrée de mod.target.class:
  // - Si c'est un tableau simple ["infantry","light"] => nécessite toutes ces classes (AND)
  // - Si c'est un tableau de tableaux [["light","gunpowder","infantry"],["cavalry","melee"]] => OR entre groupes, AND à l'intérieur.
  // NOTE: Les bonus "siegeAttack" s'appliquent comme les autres bonus normaux (depuis l'unification des données)
  let bonusDamage = 0;
  if (weapon.modifiers && defender.classes && defender.classes.length > 0) {
    const defenderClassesLower = defender.classes.map(c => c.toLowerCase());
    // Créer un set contenant toutes les classes du défenseur
    const expandedTokens = new Set<string>();
    for (const cls of defenderClassesLower) {
      expandedTokens.add(cls);
    }
    for (const mod of weapon.modifiers) {
      // Appliquer les modifiers normaux et siegeAttack (property est juste un label, pas une raison d'ignorer)
      // if (mod.property === "siegeAttack") continue; // SUPPRIMÉ: siegeAttack doit être appliqué comme les autres
      
      const spec = mod.target?.class;
      if (!spec) continue;

      // Normaliser en tableau de groupes
      const groups: string[][] = Array.isArray(spec) && spec.some(v => Array.isArray(v))
        ? (spec as unknown as string[][])
        : [spec as unknown as string[]];

      const applicable = groups.some(group => {
        if (!Array.isArray(group)) return false;
        return group.every(req => {
          const r = req.toLowerCase();
          // La condition est satisfaite si: toutes les classes requises sont présentes individuellement
          // OU si elles apparaissent comme morceaux d'une classe composite
          return expandedTokens.has(r);
        });
      });
      if (applicable) {
        bonusDamage += mod.value;
      }
    }
  }

  // Détermination de l'armure à appliquer
  let armorValue = 0;
  // Les armes siege ignorent l'armure (elles ne sont pas affectées par melee ou ranged armor)
  if (weapon.type !== "siege" && !shouldIgnoreArmor(attacker, weapon)) {
    if (weapon.type === "melee") {
      armorValue = getArmorValue(defender as unknown as AoE4Unit, "melee");
    } else if (weapon.type === "ranged") {
      // Gunpowder ignore ranged armor
      if (!isGunpowder(attacker, weapon)) {
        armorValue = getArmorValue(defender as unknown as AoE4Unit, "ranged");
      }
    } else {
      // Autres types : appliquer ranged armor sauf si ignoré ci-dessus
      if (!isGunpowder(attacker, weapon)) {
        armorValue = getArmorValue(defender as unknown as AoE4Unit, "ranged");
      }
    }
  }

  // Calcul des dégâts par projectile: (baseDamage + bonus + chargeBonus - armor) * burst
  // L'armure est appliquée à chaque projectile individuellement
  let damagePerProjectile = baseDamage + bonusDamage + chargeBonus_applied - armorValue;

  // Appliquer les debuffs versus (ex: Camel Unease)
  const debuffMultiplier = getVersusDebuffMultiplier(attacker.classes, defender.activeAbilities || []);
  if (debuffMultiplier !== 1.0) {
    damagePerProjectile = damagePerProjectile * debuffMultiplier;
  }

  // Appliquer la résistance du défenseur (ex: Ram résiste à 95% des dégâts ranged)
  // La résistance s'applique après l'armure, avant le clamp à 1
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

  // Cas spécial : l'attaquant ne peut pas attaquer les unités (ex: ram)
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

// Calcule le multiplicateur pour égaliser les coûts (± 10%)
export function calculateEqualCostMultipliers(costA: number, costB: number): { multA: number; multB: number; totalCostA: number; totalCostB: number } {
  if (costA <= 0 || costB <= 0) {
    return { multA: 1, multB: 1, totalCostA: costA, totalCostB: costB };
  }
  
  // Trouver le multiplicateur qui égalise les coûts (avec tolérance 10%)
  // On cherche des entiers multA et multB tels que: |multA * costA - multB * costB| <= 0.10 * max(multA * costA, multB * costB)
  // Stratégie: on cherche la meilleure paire (multA, multB) dans une plage raisonnable
  let bestMultA = 1;
  let bestMultB = 1;
  let bestDiff = Infinity;
  
  // Limiter la recherche à des multiplicateurs raisonnables (1 à 50 par exemple)
  const maxMult = 50;
  
  for (let mA = 1; mA <= maxMult; mA++) {
    const targetCost = mA * costA;
    // Trouver le meilleur mB
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
      
      // Vérifier si c'est dans la tolérance et meilleur que le précédent
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

  // Détermination du gagnant via TTK (plus bas gagne), draw si proche <=5%
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
  
  // Calculer les multiplicateurs
  const costA = totalCost(A);
  const costB = totalCost(B);
  const multipliers = calculateEqualCostMultipliers(costA, costB);
  
  // Calculer les métriques avec multiplicateurs
  // A attaque B: multA attaquants vs multB défenseurs
  const metricsA = computeMetrics(A, B, chargeBonusA, multipliers.multA, multipliers.multB);
  // B attaque A: multB attaquants vs multA défenseurs
  const metricsB = computeMetrics(B, A, chargeBonusB, multipliers.multB, multipliers.multA);

  // Calculer les unités restantes pour les deux camps
  let unitsRemainingA: number = 0;
  let unitsRemainingB: number = 0;
  let hpRemainingA: number = 0;
  let hpRemainingB: number = 0;
  
  // Cas spécial : un camp ne peut pas attaquer les unités (ex: ram)
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
    // Calculer dégâts subis par A pendant son TTK contre B
    const attackDataBA = computeEffectiveDamage(B, A); // B attaque A
    const effectiveDamagePerCycleBA = attackDataBA.value * multipliers.multB;
    const totalAttackerHP_A = A.hitpoints * multipliers.multA;
    const damageTakenByA = effectiveDamagePerCycleBA * metricsA.hitsToKill!;
    hpRemainingA = Math.max(0, totalAttackerHP_A - damageTakenByA);
    unitsRemainingA = Math.floor(hpRemainingA / A.hitpoints);
    
    // Calculer dégâts subis par B pendant son TTK contre A
    const attackDataAB = computeEffectiveDamage(A, B); // A attaque B
    const effectiveDamagePerCycleAB = attackDataAB.value * multipliers.multA;
    const totalAttackerHP_B = B.hitpoints * multipliers.multB;
    const damageTakenByB = effectiveDamagePerCycleAB * metricsB.hitsToKill!;
    hpRemainingB = Math.max(0, totalAttackerHP_B - damageTakenByB);
    unitsRemainingB = Math.floor(hpRemainingB / B.hitpoints);
  }

  // Détermination du gagnant via unités restantes
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
    // Draw si unités restantes égales (incluant 0-0)
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
