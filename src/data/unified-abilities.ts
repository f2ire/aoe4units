/**
 * Loading and parsing of AoE4 abilities
 * Source: all-optimized_abi.json
 * Abilities are treated as special technologies (separate tab)
 */

import allAbilitiesData from './all-optimized_abi.json';
import { applyAbilityPatches } from './patches/abilities';
import type { Technology, TechnologyVariation, TechnologyEffect } from './unified-technologies';
import { getTechnologiesForUnit } from './unified-technologies';

// Abilities share the same structure as technologies
export interface Ability extends Technology {
  active?: string;
  activeForIds?: string[]; // if set, auto-activates only when unit.id or unit.baseId is in this list
  counterInputMode?: 'type'; // if set, renders a free-text number input instead of +/- buttons
}
export interface AbilityVariation extends TechnologyVariation {
  active?: string;
}
export type AbilityEffect = TechnologyEffect;

interface AllAbilitiesData {
  __note__: string;
  __version__: string;
  data: unknown[];
}

const typedData = allAbilitiesData as AllAbilitiesData;

// Abilities irrelevant to combat simulation (heal, utility, etc.)
const EXCLUDED_ABILITY_IDS = [
  'ability-mass-heal', // AoE heal with no combat stat effect
];

// Apply patches specific to abilities
const allAbilitiesRaw: Ability[] = typedData.data as Ability[];
export const allAbilities: Ability[] = applyAbilityPatches(allAbilitiesRaw)
  .filter(a => !EXCLUDED_ABILITY_IDS.includes(a.id));

// Combat properties (reuses the same list as technologies)
const combatProperties = [
  'meleeAttack',
  'rangedAttack', 
  'meleeArmor',
  'rangedArmor',
  'hitpoints',
  'moveSpeed',
  'maxRange',
  'attackSpeed',
  'bonusDamage',
  'versusOpponentDamageDebuff',
  'costReduction',
  'foodCostReduction',
  'armorPenetration',
  'opponentAttackSpeedDebuff',
];

const nonCombatTargets = [
  'hunt',
  'herdable',
  'wildlife',
  'gaia',
  'building',
  'economic'
];

/**
 * Filters abilities that affect combat stats
 */
export function isCombatAbility(ability: Ability): boolean {
  // Check effects at the ability level
  const abilityLevelEffects = ability.effects;
  if (abilityLevelEffects && abilityLevelEffects.length > 0) {
    const hasCombatEffect = abilityLevelEffects.some(effect => {

      if (effect.select?.id && effect.select.id.length > 0) {
        return true;
      }
      
      if (!combatProperties.includes(effect.property)) return false;
      
      if (effect.target?.class) {
        const targetClasses = effect.target.class.flat();
        const allNonCombat = targetClasses.every((cls: string) => 
          nonCombatTargets.some(nonCombat => cls.includes(nonCombat))
        );
        if (allNonCombat) return false;
      }
      
      return true;
    });
    if (hasCombatEffect) return true;
  }

  // Check effects at the variation level
  return ability.variations.some(variation =>
    variation.effects?.some(effect => {
      // If the ability targets a specific unit (select.id), treat it as a combat ability
      if (effect.select?.id && effect.select.id.length > 0) {
        return true;
      }
      
      if (!combatProperties.includes(effect.property)) return false;
      
      if (effect.target?.class) {
        const targetClasses = effect.target.class.flat();
        const allNonCombat = targetClasses.every((cls: string) => 
          nonCombatTargets.some(nonCombat => cls.includes(nonCombat))
        );
        if (allNonCombat) return false;
      }
      
      return true;
    })
  );
}

export const combatAbilities = allAbilities.filter(isCombatAbility);

/**
 * Checks whether an ability affects a given unit
 */
export function abilityAffectsUnit(
  ability: AbilityVariation,
  unitClasses: string[],
  unitId?: string
): boolean {
  if (!ability.effects || ability.effects.length === 0) return false;

  return ability.effects.some(effect => {
    let matchesById = false;
    let matchesByClass = false;
    let matchesByIdAsClass = false;
    
    // For versus debuff effects, select.id = unit that owns the ability; select.class also checked for ownership
    if (effect.property === 'versusOpponentDamageDebuff') {
      if (unitId && effect.select?.excludeId?.includes(unitId)) return false;
      if (effect.select?.id && unitId) {
        matchesById = effect.select.id.some(id =>
          id.toLowerCase() === unitId.toLowerCase()
        );
      }
      if (effect.select?.class) {
        matchesByClass = effect.select.class.some(classGroup =>
          classGroup.every(className =>
            unitClasses.some(unitClass =>
              unitClass.toLowerCase() === className.toLowerCase()
            )
          )
        );
      }
      return matchesById || matchesByClass;
    }

    // For other effects, normal logic
    if (effect.select?.id && unitId) {
      matchesById = effect.select.id.some(id =>
        id.toLowerCase() === unitId.toLowerCase()
      );

      matchesByIdAsClass = effect.select.id.some(id =>
        unitClasses.some(unitClass =>
          unitClass.toLowerCase() === id.toLowerCase()
        )
      );
    }

    if (effect.select?.class) {
      matchesByClass = effect.select.class.some(classGroup =>
        classGroup.every(className =>
          unitClasses.some(unitClass =>
            unitClass.toLowerCase() === className.toLowerCase()
          )
        )
      );
    }

    if (unitId && effect.select?.excludeId?.includes(unitId)) return false;
    return matchesById || matchesByClass || matchesByIdAsClass;
  });
}

/**
 * Gets the available abilities for a unit
 */
export function getAbilitiesForUnit(
  unitClasses: string[],
  civAbbr: string,
  age: number,
  unitId?: string
): Ability[] {
  const abilities = combatAbilities.filter(ability => {
    // Filter abilities marked as hidden
    if ((ability as any).hidden) return false; // eslint-disable-line @typescript-eslint/no-explicit-any
    
    if (ability.civs.length > 0 && !ability.civs.includes(civAbbr) && civAbbr !== 'all') {
      return false;
    }
    
    // Check effects at the ability level
    if (ability.effects && ability.effects.length > 0) {
      const affectsUnit = ability.effects.some(effect => {
        let matchesById = false;
        let matchesByClass = false;
        let matchesByIdAsClass = false;
        
        // For versus debuff effects, select.id = unit that owns the ability; select.class also checked for ownership
        if (effect.property === 'versusOpponentDamageDebuff') {
          if (unitId && effect.select?.excludeId?.includes(unitId)) return false;
          if (effect.select?.id && unitId) {
            matchesById = effect.select.id.some(id => id.toLowerCase() === unitId.toLowerCase());
          }
          if (effect.select?.class) {
            matchesByClass = effect.select.class.some(classGroup =>
              classGroup.every(className =>
                unitClasses.some(unitClass => unitClass.toLowerCase() === className.toLowerCase())
              )
            );
          }
          return matchesById || matchesByClass;
        }
        
        // For other effects, normal logic
        if (effect.select?.id && unitId) {
          matchesById = effect.select.id.some(id => id.toLowerCase() === unitId.toLowerCase());
          matchesByIdAsClass = effect.select.id.some(id =>
            unitClasses.some(unitClass => unitClass.toLowerCase() === id.toLowerCase())
          );
        }
        
        if (effect.select?.class) {
          matchesByClass = effect.select.class.some(classGroup =>
            classGroup.every(className => 
              unitClasses.some(unitClass => unitClass.toLowerCase() === className.toLowerCase())
            )
          );
        }
        
        if (unitId && effect.select?.excludeId?.includes(unitId)) return false;
        return matchesById || matchesByClass || matchesByIdAsClass;
      });

      if (affectsUnit) return true;
    }
    
    // Check at the variation level
    return ability.variations.some(variation => {
      if (variation.civs.length > 0 && civAbbr !== 'all' && !variation.civs.includes(civAbbr)) return false;

      // If this ability is unlocked by a technology (e.g. "technologies/camel-support")
      // and the technology with the same name/ID already applies to the unit, ignore the ability.
      // Exception: manual abilities are kept visible even when their unlocking tech is present
      // (the tech unlocks it in-game; the app handles locking via ABILITY_TECH_DEPENDENCIES).
      if (variation.unlockedBy && Array.isArray(variation.unlockedBy) && (variation as AbilityVariation).active !== 'manual') {
        const techRefs = variation.unlockedBy
          .map(u => typeof u === 'string' ? u : '')
          .filter(Boolean)
          .filter(u => u.startsWith('technologies/'))
          .map(u => u.split('/').pop());

        if (techRefs.length > 0) {
          const applicableTechs = getTechnologiesForUnit(unitClasses, civAbbr, age, unitId);
          const hasMatchingTech = applicableTechs.some(t => techRefs.includes(t.id));
          if (hasMatchingTech) return false; // ignore ability because tech already covers it
        }
      }

      return abilityAffectsUnit(variation, unitClasses, unitId);
    });
  });
  
  return abilities;
}

/**
 * Gets the correct variation of an ability
 */
export function getAbilityVariation(
  abilityId: string,
  civAbbr: string,
  age: number
): AbilityVariation | null {
  const ability = allAbilities.find(a => a.id === abilityId);
  if (!ability) return null;

  if (ability.minAge > age) return null;

  const variation = ability.variations.find(v => {
    if (v.civs.length > 0 && civAbbr !== 'all' && !v.civs.includes(civAbbr)) return false;
    return true;
  });

  let finalVariation = variation;
  if (!finalVariation) {
    finalVariation = ability.variations.find(v => v.effects && v.effects.length > 0) || ability.variations[0] || null;
  }

  if (!finalVariation) return null;

  // Merge with ability-level effects if present
  if (ability.effects && ability.effects.length > 0) {
    // Keep both the variation's effects AND the ability's effects (concatenation),
    // so that patches applied to variations are not overwritten.
    const variationEffects = finalVariation.effects || [];
    const mergedEffects = [...variationEffects, ...ability.effects];
    return {
      ...finalVariation,
      effects: mergedEffects
    };
  }

  return finalVariation;
}

/**
 * Gets all active ability variations (similar to technologies)
 */
export function getActiveAbilityVariations(
  activeAbilities: Set<string>,
  civAbbr: string,
  age: number
): AbilityVariation[] {
  const variations: AbilityVariation[] = [];

  for (const abilityId of activeAbilities) {
    const ability = allAbilities.find(a => a.id === abilityId);
    if (!ability) continue;

    const variation = getAbilityVariation(abilityId, civAbbr, ability.minAge);
    if (variation) {
      variations.push(variation);
    }
  }

  return variations;
}
