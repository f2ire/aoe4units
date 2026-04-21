// Types pour les technologies
export interface TechnologyEffect {
  property: string; // "meleeAttack", "rangedAttack", "meleeArmor", "rangedArmor", "hitpoints", "moveSpeed", "maxRange", "attackSpeed"
  select?: {
    class?: string[][];
    id?: string[];
    excludeId?: string[];
  };
  effect: string; // "change", "multiply"
  value: number;
  type: string; // "passive", "ability", "bonus"
  target?: { // Pour les bonus de dégâts
    class: string[][];
  };
  duration?: number;
}

export interface TechnologyVariation {
  id: string;
  baseId?: string;
  type?: string;
  name?: string;
  pbgid: number;
  attribName: string;
  age?: number;
  civs: string[];
  description?: string;
  classes?: string[];
  displayClasses?: string[];
  unique?: boolean;
  costs?: {
    food: number;
    wood: number;
    stone: number;
    gold: number;
    vizier: number;
    oliveoil: number;
    total: number;
    popcap: number;
    time: number;
  };
  producedBy?: string[];
  unlockedBy?: string[];
  icon?: string;
  effects?: TechnologyEffect[];
}

export interface Technology {
  id: string;
  name: string;
  type: string;
  civs: string[];
  unique: boolean;
  displayClasses: string[];
  classes: string[];
  minAge: number;
  icon: string;
  description: string;
  variations: TechnologyVariation[];
  effects?: TechnologyEffect[]; // Effects at the technology level (all-optimized_tec.json)
}
import allTechnologiesData from './all-optimized_tec.json';
import { applyTechnologyPatches } from './patches/technologies';

// Parse all technologies from the unified file
const allTechnologiesRaw: Technology[] = allTechnologiesData.data as Technology[];
export const allTechnologies: Technology[] = applyTechnologyPatches(allTechnologiesRaw) as Technology[];

// Filter technologies that affect combat stats
const combatProperties = [
  'meleeAttack',
  'rangedAttack',
  'meleeArmor',
  'rangedArmor',
  'hitpoints',
  'moveSpeed',
  'maxRange',         // Maximum range
  'attackSpeed',      // Attack speed
  'bonusDamage',      // Bonus damage
  'siegeAttack',      // Siege damage (special property for siege weapons)
  'gunpowderAttack',  // Gunpowder damage (special property for gunpowder weapons)
  'burst',            // Number of projectiles
  'costReduction',    // Unit production cost multiplier
  'stoneCostReduction', // Stone-only cost multiplier
  'rangedResistance',    // Ranged damage resistance (%)
  'meleeResistance',     // Melee damage resistance (%, positive = reduction, negative = vulnerability)
  'healingRate',         // HP healed per hit the unit lands
  'chargeMultiplier'     // First-hit bonus = primaryMeleeDamage × value (requires charge-attack)
];

// Non-combatant target classes to exclude
const nonCombatTargets = [
  'hunt',           // Wild animals
  'herdable',       // Sheep, etc.
  'wildlife',       // Fauna
  'gaia',           // Neutral entities
  'building',       // Buildings (unless it is a siege unit)
  'economic'        // Economic units
];

export function isCombatTechnology(tech: Technology): boolean {
  // Check effects at the technology level (all-optimized_tec.json)
  const techLevelEffects = tech.effects;
  if (techLevelEffects && techLevelEffects.length > 0) {
    const hasCombatEffect = techLevelEffects.some(effect => {
      // Check whether it is a combat property
      if (!combatProperties.includes(effect.property)) return false;

      // Exclude effects that target only non-combatants
      if (effect.target?.class) {
        const targetClasses = effect.target.class.flat();
        // If all targets are non-combatants, ignore this effect
        const allNonCombat = targetClasses.every((cls: string) =>
          nonCombatTargets.some(nonCombat => cls.includes(nonCombat))
        );
        if (allNonCombat) return false;
      }

      return true;
    });
    if (hasCombatEffect) return true;
  }

  // Also check effects at the variation level (individual unified_tec/ files)
  return tech.variations.some(variation =>
    variation.effects?.some(effect => {
      // Check whether it is a combat property
      if (!combatProperties.includes(effect.property)) return false;

      // Exclude effects that target only non-combatants
      if (effect.target?.class) {
        const targetClasses = effect.target.class.flat();
        // If all targets are non-combatants, ignore this effect
        const allNonCombat = targetClasses.every((cls: string) =>
          nonCombatTargets.some(nonCombat => cls.includes(nonCombat))
        );
        if (allNonCombat) return false;
      }

      return true;
    })
  );
}

// Get filtered combat technologies
export const combatTechnologies = allTechnologies.filter(isCombatTechnology);

// Check whether a technology affects a unit
export function technologyAffectsUnit(
  tech: TechnologyVariation,
  unitClasses: string[],
  unitId?: string
): boolean {
  if (!tech.effects || tech.effects.length === 0) return false;

  return tech.effects.some(effect => {
    let matchesById = false;
    let matchesByClass = false;
    let matchesByIdAsClass = false;

    // Check selection by ID (exact match with the unit ID)
    if (effect.select?.id && unitId) {
      matchesById = effect.select.id.some(id =>
        id.toLowerCase() === unitId.toLowerCase()
      );

      // NEW: Also check whether a tech ID matches a unit class
      // (e.g. tech has id="archer", unit has class="archer")
      matchesByIdAsClass = effect.select.id.some(id =>
        unitClasses.some(unitClass =>
          unitClass.toLowerCase() === id.toLowerCase()
        )
      );
    }

    // Check by class — expand compound classes (e.g. "archer_ship" → "archer" + "ship")
    if (effect.select?.class) {
      const expandedTokens = new Set<string>();
      for (const cls of unitClasses) {
        const lower = cls.toLowerCase();
        expandedTokens.add(lower);
        const parts = lower.split('_');
        for (let i = 0; i < parts.length; i++) {
          if (parts[i] === 'non') { i++; continue; } // skip token after "non"
          expandedTokens.add(parts[i]);
        }
      }
      matchesByClass = effect.select.class.some(classGroup =>
        classGroup.every(className => expandedTokens.has(className.toLowerCase()))
      );
    }

    // Return true if the unit matches by ID OR by class OR by ID-as-class (OR logic)
    return matchesById || matchesByClass || matchesByIdAsClass;
  });
}

// Get available technologies for a unit
export function getTechnologiesForUnit(
  unitClasses: string[],
  civAbbr: string,
  age: number,
  unitId?: string
): Technology[] {
  const techs = combatTechnologies.filter(tech => {
    // Check whether the civ has access to this tech
    if (!tech.civs.includes(civAbbr) && civAbbr !== 'all') {
      return false;
    }

    // No longer filter by minimum age - all technologies are selectable

    // Check whether the technology-level effects affect this unit (all-optimized_tec.json)
    if (tech.effects && tech.effects.length > 0) {
      const affectsUnit = tech.effects.some(effect => {
        let matchesById = false;
        let matchesByClass = false;
        let matchesByIdAsClass = false;

        if (effect.select?.id && unitId) {
          matchesById = effect.select.id.some(id => id.toLowerCase() === unitId.toLowerCase());
          matchesByIdAsClass = effect.select.id.some(id =>
            unitClasses.some(unitClass => unitClass.toLowerCase() === id.toLowerCase())
          );
        }

        if (effect.select?.class) {
          const expandedTokens = new Set<string>();
          for (const cls of unitClasses) {
            const lower = cls.toLowerCase();
            expandedTokens.add(lower);
            const parts = lower.split('_');
        for (let i = 0; i < parts.length; i++) {
          if (parts[i] === 'non') { i++; continue; } // skip token after "non"
          expandedTokens.add(parts[i]);
        }
          }
          matchesByClass = effect.select.class.some(classGroup =>
            classGroup.every(className => expandedTokens.has(className.toLowerCase()))
          );
        }

        return matchesById || matchesByClass || matchesByIdAsClass;
      });

      if (affectsUnit) return true;
    }

    // Check whether at least one variation affects this unit (individual files)
    return tech.variations.some(variation => {
      if (civAbbr !== 'all' && !variation.civs.includes(civAbbr)) return false;
      return technologyAffectsUnit(variation, unitClasses, unitId);
    });
  });

  return techs;
}

// Get the correct variation of a technology
export function getTechnologyVariation(
  techId: string,
  civAbbr: string,
  age: number
): TechnologyVariation | null {
  const tech = allTechnologies.find(t => t.id === techId);
  if (!tech) return null;

  // Check that the technology is available at this age
  if (tech.minAge > age) return null;

  // Find the variation for this civ
  // Note: In all-optimized_tec.json, variations have no "age" field
  // The age is determined by tech.minAge
  const variation = tech.variations.find(v => {
    if (civAbbr !== 'all' && !v.civs.includes(civAbbr)) return false;
    return true;
  });

  // If no variation found, try to take the first one that has effects
  let finalVariation = variation;
  if (!finalVariation) {
    finalVariation = tech.variations.find(v => v.effects && v.effects.length > 0) || tech.variations[0] || null;
  }

  if (!finalVariation) return null;

  // If effects are at the technology level (all-optimized_tec.json),
  // merge with the variation
  if (tech.effects && tech.effects.length > 0) {
    return {
      ...finalVariation,
      effects: tech.effects
    };
  }

  return finalVariation;
}

// Apply technology effects to stats
export interface UnitStats {
  hitpoints: number;
  meleeAttack: number;
  rangedAttack: number;
  meleeArmor: number;
  rangedArmor: number;
  moveSpeed: number;
  attackSpeed?: number;
  maxRange?: number;
  burst?: number;
  bonusDamage?: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  costMultiplier?: number; // Production cost multiplier (e.g. 0.8 = -20%)
  stoneCostMultiplier?: number; // Stone-only cost multiplier (e.g. 0.8 = -20% stone)
  rangedResistance?: number;   // Ranged damage resistance percentage (0-100), e.g. 30 = 30% reduction
  meleeResistance?: number;    // Melee damage resistance (positive = reduction, negative = vulnerability), e.g. 15 = −15%, −50 = +50% taken
  healingRate?: number;        // HP healed per hit the unit lands (e.g. Keshik: 3 HP/hit)
  rangedAttackMultiplier?: number; // Product of all rangedAttack multiply effects (tracked separately to correctly scale secondary weapons)
  chargeMultiplier?: number;   // First-hit charge bonus = primaryMeleeDamage × chargeMultiplier (requires charge-attack active)
}

export function applyTechnologyEffects(
  baseStats: UnitStats,
  unitClasses: string[],
  activeTechnologies: TechnologyVariation[],
  unitId?: string
): UnitStats {
  // Deep-copy bonusDamage to avoid mutations
  const modifiedStats = {
    ...baseStats,
    bonusDamage: baseStats.bonusDamage ? baseStats.bonusDamage.map((bonus: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      // Deep copy handling different structures
      const copy = { ...bonus };
      if (bonus.classes) copy.classes = [...bonus.classes];
      if (bonus.target?.class) {
        copy.target = {
          ...bonus.target,
          class: bonus.target.class.map((c: any) => Array.isArray(c) ? [...c] : c) // eslint-disable-line @typescript-eslint/no-explicit-any
        };
      }
      return copy;
    }) : []
  };

  // Collect all applicable effects
  interface ApplicableEffect {
    statKey: keyof UnitStats;
    effectType: 'change' | 'multiply';
    value: number;
  }

  interface SpecialEffect {
    property: string;
    effectType: 'change' | 'multiply';
    value: number;
    target?: { class: string[][] };
    type?: string;
  }

  const applicableEffects: ApplicableEffect[] = [];
  const specialEffects: SpecialEffect[] = [];

  for (const tech of activeTechnologies) {
    if (!tech.effects) continue;

    for (const effect of tech.effects) {
      // Check whether the effect applies to this unit
      let matchesById = false;
      let matchesByClass = false;
      let matchesByIdAsClass = false;

      // Check by ID (exact match with the unit ID)
      if (effect.select?.id && unitId) {
        matchesById = effect.select.id.some(id =>
          id.toLowerCase() === unitId.toLowerCase()
        );

        // Also check whether a tech ID matches a unit class
        matchesByIdAsClass = effect.select.id.some(id =>
          unitClasses.some(unitClass =>
            unitClass.toLowerCase() === id.toLowerCase()
          )
        );
      }

      // Check by class
      // Build expanded token set: each class + all underscore-split parts
      // e.g. "archer_ship" adds "archer", "ship" as individual tokens too
      // This mirrors the expandedTokens logic in combat.ts so that
      // ["archer","ship"] correctly matches a unit with class "archer_ship"
      const expandedTokens = new Set<string>();
      for (const cls of unitClasses) {
        const lower = cls.toLowerCase();
        expandedTokens.add(lower);
        for (const part of lower.split('_')) {
          expandedTokens.add(part);
        }
      }
      if (effect.select?.class) {
        matchesByClass = effect.select.class.some(classGroup =>
          classGroup.every(className => expandedTokens.has(className.toLowerCase()))
        );
      }

      // No select = applies to all units
      const noSelect = !effect.select || (!effect.select.id && !effect.select.class);
      // The effect applies if the unit matches by ID OR by class OR by ID-as-class
      const matches = noSelect || matchesById || matchesByClass || matchesByIdAsClass;
      if (!matches) continue;
      // excludeId: explicit unit exclusion even when class/id matches
      if (unitId && effect.select?.excludeId?.includes(unitId)) continue;

      // Determine the relevant property
      const property = effect.property;
      if (!combatProperties.includes(property)) continue;

      // Handle special properties
      if (property === 'maxRange' || property === 'attackSpeed' || property === 'burst' || property === 'costReduction' || property === 'stoneCostReduction' || property === 'rangedResistance' || property === 'meleeResistance' || property === 'healingRate' || property === 'chargeMultiplier') {
        specialEffects.push({
          property,
          effectType: effect.effect as 'change' | 'multiply',
          value: effect.value
        });
        continue;
      }

      // Handle damage bonuses (type: 'bonus')
      if ((property === 'meleeAttack' || property === 'rangedAttack' || property === 'siegeAttack' || property === 'gunpowderAttack') && effect.type === 'bonus') {
        specialEffects.push({
          property,
          effectType: effect.effect as 'change' | 'multiply',
          value: effect.value,
          target: effect.target,
          type: 'bonus'
        });
        continue;
      }

      let statKey: keyof UnitStats;
      switch (property) {
        case 'meleeAttack':
          statKey = 'meleeAttack';
          break;
        case 'rangedAttack':
          statKey = 'rangedAttack';
          break;
        case 'meleeArmor':
          statKey = 'meleeArmor';
          break;
        case 'rangedArmor':
          statKey = 'rangedArmor';
          break;
        case 'hitpoints':
          statKey = 'hitpoints';
          break;
        case 'moveSpeed':
          statKey = 'moveSpeed';
          break;
        case 'siegeAttack':
        case 'gunpowderAttack':
          // Siege/gunpowder weapons store their damage in rangedAttack (same slot)
          statKey = 'rangedAttack';
          break;
        default:
          continue;
      }

      // Add the effect to the list
      applicableEffects.push({
        statKey,
        effectType: effect.effect as 'change' | 'multiply',
        value: effect.value
      });
    }
  }

  // IMPORTANT: Apply effects in the correct order
  // 1. First all "change" (additions)
  // 2. Then all "multiply" (percentages)

  // Phase 1: Apply additions (change)
  for (const effect of applicableEffects) {
    if (effect.effectType === 'change') {
      // Exclude attackSpeed and bonusDamage which are not modifiable here
      if (effect.statKey === 'attackSpeed' || effect.statKey === 'bonusDamage') continue;

      // NOTE: moveSpeed used to be treated as a percentage here (speed *= 1 + value/100).
      // Commented out so "change" is consistently additive (+= value) for all stats.
      // If re-enabling, also check do-maru-armor and kabura-ya-whistling-arrow (value: 10 = +10%).
      // if (effect.statKey === 'moveSpeed') {
      //   (modifiedStats[effect.statKey] as number) *= (1 + effect.value / 100);
      // } else {
        // For all stats, "change" is a pure addition
        (modifiedStats[effect.statKey] as number) += effect.value;
      // }
    }
  }

  // Phase 2: Apply multiplications (multiply)
  // For hitpoints: additive stacking (each % is calculated on the pre-Phase-2 base HP, then summed).
  //   e.g. biology ×1.25 + biology-improved ×1.1 → HP × (1 + 0.25 + 0.10) = HP × 1.35
  // For all other stats: multiplicative chaining (standard).
  const hpBeforePhase2 = modifiedStats.hitpoints;
  let hpMultiplierDelta = 0;
  let rangedAttackMultiplier = 1;

  for (const effect of applicableEffects) {
    if (effect.effectType === 'multiply') {
      // Exclude attackSpeed and bonusDamage which are not modifiable here
      if (effect.statKey === 'attackSpeed' || effect.statKey === 'bonusDamage') continue;

      if (effect.statKey === 'hitpoints') {
        // Accumulate deltas additively on base HP
        hpMultiplierDelta += (effect.value - 1);
      } else {
        (modifiedStats[effect.statKey] as number) *= effect.value;
        if (effect.statKey === 'rangedAttack') rangedAttackMultiplier *= effect.value;
      }
    }
  }

  if (rangedAttackMultiplier !== 1) modifiedStats.rangedAttackMultiplier = rangedAttackMultiplier;

  // Apply accumulated HP multiplier (additive stacking on pre-Phase-2 value)
  if (hpMultiplierDelta !== 0) {
    modifiedStats.hitpoints = hpBeforePhase2 * (1 + hpMultiplierDelta);
  }

  // Phase 3: Apply special effects (maxRange, attackSpeed, bonus damage)

  // Apply maxRange
  for (const effect of specialEffects) {
    if (effect.property === 'maxRange' && typeof modifiedStats.maxRange === 'number') {
      if (effect.effectType === 'change') {
        modifiedStats.maxRange += effect.value;
      } else if (effect.effectType === 'multiply') {
        modifiedStats.maxRange *= effect.value;
      }
    }
  }

  // Apply attackSpeed
  for (const effect of specialEffects) {
    if (effect.property === 'attackSpeed' && typeof modifiedStats.attackSpeed === 'number') {
      if (effect.effectType === 'change') {
        modifiedStats.attackSpeed += effect.value;
      } else if (effect.effectType === 'multiply') {
        modifiedStats.attackSpeed *= effect.value;
      }
    }
  }

  // Apply burst
  for (const effect of specialEffects) {
    if (effect.property === 'burst' && typeof modifiedStats.burst === 'number') {
      if (effect.effectType === 'change') {
        modifiedStats.burst += effect.value;
      } else if (effect.effectType === 'multiply') {
        modifiedStats.burst *= effect.value;
      }
    }
  }

  // Apply costReduction
  for (const effect of specialEffects) {
    if (effect.property === 'costReduction') {
      if (modifiedStats.costMultiplier == null) modifiedStats.costMultiplier = 1.0;
      if (effect.effectType === 'multiply') {
        modifiedStats.costMultiplier *= effect.value;
      } else if (effect.effectType === 'change') {
        modifiedStats.costMultiplier += effect.value;
      }
    }
  }

  // Apply stoneCostReduction
  for (const effect of specialEffects) {
    if (effect.property === 'stoneCostReduction') {
      if (modifiedStats.stoneCostMultiplier == null) modifiedStats.stoneCostMultiplier = 1.0;
      if (effect.effectType === 'multiply') {
        modifiedStats.stoneCostMultiplier *= effect.value;
      } else if (effect.effectType === 'change') {
        modifiedStats.stoneCostMultiplier += effect.value;
      }
    }
  }

  // Apply rangedResistance
  for (const effect of specialEffects) {
    if (effect.property === 'rangedResistance') {
      const current = modifiedStats.rangedResistance ?? 0;
      if (effect.effectType === 'change') {
        modifiedStats.rangedResistance = current + effect.value;
      } else if (effect.effectType === 'multiply') {
        modifiedStats.rangedResistance = current * effect.value;
      }
    }
  }

  // Apply meleeResistance
  for (const effect of specialEffects) {
    if (effect.property === 'meleeResistance') {
      const current = modifiedStats.meleeResistance ?? 0;
      if (effect.effectType === 'change') {
        modifiedStats.meleeResistance = current + effect.value;
      } else if (effect.effectType === 'multiply') {
        modifiedStats.meleeResistance = current * effect.value;
      }
    }
  }

  // Apply healingRate (HP healed per hit the unit lands)
  for (const effect of specialEffects) {
    if (effect.property === 'healingRate') {
      const current = modifiedStats.healingRate ?? 0;
      if (effect.effectType === 'change') {
        modifiedStats.healingRate = current + effect.value;
      } else if (effect.effectType === 'multiply') {
        modifiedStats.healingRate = current * effect.value;
      }
    }
  }

  // Apply chargeMultiplier (first-hit bonus = primaryMeleeDamage × value)
  for (const effect of specialEffects) {
    if (effect.property === 'chargeMultiplier') {
      const current = modifiedStats.chargeMultiplier ?? 0;
      if (effect.effectType === 'change') {
        modifiedStats.chargeMultiplier = current + effect.value;
      } else if (effect.effectType === 'multiply') {
        modifiedStats.chargeMultiplier = current * effect.value;
      }
    }
  }

  // Apply damage bonuses
  if (modifiedStats.bonusDamage && Array.isArray(modifiedStats.bonusDamage)) {
    for (const effect of specialEffects) {
      if (effect.type === 'bonus' && effect.target?.class) {
        // Flatten and normalise the effect targets
        const effectTargetClasses = effect.target.class.flat().map((c: string) => c.toLowerCase());

        const existingBonus = modifiedStats.bonusDamage.find((bonus: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          // Search by classes (for bonuses created by technologies)
          if (bonus.classes && Array.isArray(bonus.classes)) {
            const bonusClasses = bonus.classes.map((c: string) => c.toLowerCase());
            // Sets must be identical
            return effectTargetClasses.length === bonusClasses.length &&
              effectTargetClasses.every(tc => bonusClasses.includes(tc));
          }

          // Search by property and target.class (for original weapon modifiers)
          if (bonus.property && bonus.target?.class) {
            const bonusTargetClasses = bonus.target.class.flat().map((c: string) => c.toLowerCase());
            // Sets must be identical
            return effectTargetClasses.length === bonusTargetClasses.length &&
              effectTargetClasses.every(tc => bonusTargetClasses.includes(tc));
          }
          return false;
        });

        if (existingBonus) {
          // Modify the existing bonus
          if (effect.effectType === 'change') {
            existingBonus.value += effect.value;
          } else if (effect.effectType === 'multiply') {
            existingBonus.value *= effect.value;
          }
        } else {
          // Add a new bonus (only if it is an addition, not a multiplication)
          if (effect.effectType === 'change') {
            modifiedStats.bonusDamage.push({
              value: effect.value,
              property: effect.property,
              target: {
                class: effect.target.class
              }
            });
          }
        }
      }
    }
  }

  return modifiedStats;
}

// Get all technologies from the same line (all tiers)
export function getAllTiersFromSameLine(tech: Technology): Technology[] {
  const tierInfo = getTechnologyTier(tech);
  if (!tierInfo) return [tech]; // Not a tiered technology, return it alone

  const baseName = getTechnologyBaseName(tech.displayClasses[0]);
  const allTiers: Technology[] = [];

  // Search for all tiers from 1 to maxTier
  for (let tier = 1; tier <= tierInfo.maxTier; tier++) {
    const targetPattern = `${baseName} ${tier}/${tierInfo.maxTier}`;
    const tierTech = allTechnologies.find(t => t.displayClasses[0] === targetPattern);

    if (tierTech) {
      allTiers.push(tierTech);
    }
  }

  return allTiers.length > 0 ? allTiers : [tech];
}

// Detect whether a technology belongs to a tiered line
export function getTechnologyTier(tech: Technology): { tier: number; maxTier: number } | null {
  const displayClass = tech.displayClasses[0];
  if (!displayClass) return null;

  // Search for the "X/Y" pattern in displayClasses (e.g. "Melee Damage Technology 2/3")
  const match = displayClass.match(/(\d+)\/(\d+)/);
  if (!match) return null;

  return {
    tier: parseInt(match[1]),
    maxTier: parseInt(match[2])
  };
}

// Extract the base category of a technology (without the tier)
export function getTechnologyBaseName(displayClass: string): string {
  // Remove the "X/Y" pattern to obtain the base name
  return displayClass.replace(/\s*\d+\/\d+\s*$/, '').trim();
}

// Get all preceding technologies from the same line (automatic cumulation)
export function getPreviousTierTechnologies(
  tech: Technology,
  activeTechnologies: Set<string>
): Technology[] {
  const tierInfo = getTechnologyTier(tech);
  if (!tierInfo || tierInfo.tier === 1) return [];

  const baseName = getTechnologyBaseName(tech.displayClasses[0]);
  const previousTechs: Technology[] = [];

  // Search for all lower-tier technologies from the same line
  // IMPORTANT: We do NOT check whether they are active, because a higher tier includes them automatically
  for (let tier = 1; tier < tierInfo.tier; tier++) {
    const targetPattern = `${baseName} ${tier}/${tierInfo.maxTier}`;

    const previousTech = allTechnologies.find(t =>
      t.displayClasses[0] === targetPattern
    );

    if (previousTech) {
      previousTechs.push(previousTech);
    }
  }

  return previousTechs;
}

// Get all active variations including preceding tiers
export function getActiveTechnologyVariationsWithTiers(
  activeTechnologies: Set<string>,
  civAbbr: string,
  age: number
): TechnologyVariation[] {
  const variations: TechnologyVariation[] = [];
  const processedTechs = new Set<string>();

  for (const techId of activeTechnologies) {
    const tech = allTechnologies.find(t => t.id === techId);
    if (!tech || processedTechs.has(techId)) continue;

    // Get lower-tier technologies
    const previousTierTechs = getPreviousTierTechnologies(tech, activeTechnologies);

    // Add preceding tiers first
    for (const prevTech of previousTierTechs) {
      if (!processedTechs.has(prevTech.id)) {
        // Use the minimum age of the preceding technology, not the current age
        const variation = getTechnologyVariation(prevTech.id, civAbbr, prevTech.minAge);
        if (variation) {
          variations.push(variation);
          processedTechs.add(prevTech.id);
        }
      }
    }

    // Then add the current technology
    const variation = getTechnologyVariation(techId, civAbbr, tech.minAge);
    if (variation) {
      variations.push(variation);
      processedTechs.add(techId);
    }
  }

  return variations;
}

// Categorise technologies by main effect type
export function categorizeTechnology(tech: Technology): string {
  // Age-up upgrades always get their own category regardless of effects
  if (tech.classes?.includes('age_up_upgrade')) return 'Age';

  // Use effects at the technology level (all-optimized_tec.json) or at the variation level
  const effects = (tech.effects && tech.effects.length > 0 ? tech.effects : tech.variations[0]?.effects) || [];

  // Check whether the tech belongs to a tiered sequence (X/Y in displayClasses)
  const tierInfo = getTechnologyTier(tech);
  const hasTier = !!tierInfo;

  // A tech is on a separate line if:
  // - It is unique: true OR
  // - It has no tier (no X/Y) and unique: false (standalone)
  const isSeparateTech = tech.unique || !hasTier;

  // If the technology has several different properties, put it in "Other"
  // UNLESS all properties are attacks (meleeAttack, rangedAttack, siegeAttack, gunpowderAttack)
  const uniqueProperties = new Set(effects.map(e => e.property));
  const attackProps = new Set(['meleeAttack', 'rangedAttack', 'siegeAttack', 'gunpowderAttack']);
  const allAttacks = [...uniqueProperties].every(p => attackProps.has(p));

  // If the tech belongs to an X/Y family, use the category of the first tier
  // to ensure the entire family stays in the same category
  if (hasTier && tierInfo.tier > 1) {
    const baseName = getTechnologyBaseName(tech.displayClasses[0]);
    const firstTier = allTechnologies.find(t =>
      t.displayClasses[0] === `${baseName} 1/${tierInfo.maxTier}`
    );
    if (firstTier) {
      return categorizeTechnology(firstTier);
    }
  }

  // If the tech only affects armor properties (meleeArmor and/or rangedArmor),
  // categorise it as Armor (rather than Other). Armor-Ranged is chosen if rangedArmor
  // is present, otherwise Armor-Melee.
  const armorProps = new Set(['meleeArmor', 'rangedArmor']);
  const allArmor = [...uniqueProperties].every(p => armorProps.has(p));
  if (allArmor) {
    return isSeparateTech
      ? (uniqueProperties.has('rangedArmor') ? 'Armor-Ranged-Unique' : 'Armor-Melee-Unique')
      : (uniqueProperties.has('rangedArmor') ? 'Armor-Ranged' : 'Armor-Melee');
  }

  // If multiple properties and not all of them are attacks
  if (uniqueProperties.size > 1 && !allAttacks) {
    return 'Other';
  }

  for (const effect of effects) {
    if (effect.property === 'hitpoints') {
      return isSeparateTech ? 'HP-Unique' : 'HP';
    }
    if (effect.property === 'meleeAttack') {
      return isSeparateTech ? 'Attack-Melee-Unique' : 'Attack-Melee';
    }
    if (effect.property === 'rangedAttack') {
      return isSeparateTech ? 'Attack-Ranged-Unique' : 'Attack-Ranged';
    }
    if (effect.property === 'siegeAttack') {
      return isSeparateTech ? 'Attack-Ranged-Unique' : 'Attack-Ranged';
    }
    if (effect.property === 'gunpowderAttack') {
      return isSeparateTech ? 'Attack-Ranged-Unique' : 'Attack-Ranged';
    }
    if (effect.property === 'meleeArmor') {
      return isSeparateTech ? 'Armor-Melee-Unique' : 'Armor-Melee';
    }
    if (effect.property === 'rangedArmor') {
      return isSeparateTech ? 'Armor-Ranged-Unique' : 'Armor-Ranged';
    }
    if (effect.property === 'moveSpeed') {
      return isSeparateTech ? 'Speed-Unique' : 'Speed';
    }
    if (effect.property === 'maxRange') {
      return isSeparateTech ? 'Range-Unique' : 'Range';
    }
    if (effect.property === 'attackSpeed') {
      return isSeparateTech ? 'AttackSpeed-Unique' : 'AttackSpeed';
    }
  }

  return 'Other';
}
