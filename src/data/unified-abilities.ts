/**
 * Chargement et parsing des abilities d'AoE4
 * Source: all-optimized_abi.json
 * Les abilities sont traitées comme des technologies spéciales (onglet séparé)
 */

import allAbilitiesData from './all-optimized_abi.json';
import { applyAbilityPatches } from './patches/abilities';
import type { Technology, TechnologyVariation, TechnologyEffect } from './unified-technologies';
import { getTechnologiesForUnit } from './unified-technologies';

// Les abilities ont la même structure que les technologies
export interface Ability extends Technology {
  active?: string;
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

// Appliquer les patchs spécifiques aux abilités
const allAbilitiesRaw: Ability[] = typedData.data as Ability[];
export const allAbilities: Ability[] = applyAbilityPatches(allAbilitiesRaw);

// Propriétés de combat (réutilise la même liste que les technologies)
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
  'versusOpponentDamageDebuff'
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
 * Filtre les abilities qui affectent les stats de combat
 */
export function isCombatAbility(ability: Ability): boolean {
  // Vérifier les effects au niveau de l'ability
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

  // Vérifier les effects au niveau des variations
  return ability.variations.some(variation => 
    variation.effects?.some(effect => {
      // Si l'ability cible une unité spécifique (select.id), la considérer comme ability de combat
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
 * Vérifie si une ability affecte une unité donnée
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
    
    // Pour les effets versus debuff, seul select.id compte (l'unité qui possède l'abilité)
    // La partie select.class définit la cible de l'effet, pas qui possède l'abilité
    if (effect.property === 'versusOpponentDamageDebuff') {
      if (effect.select?.id && unitId) {
        matchesById = effect.select.id.some(id => 
          id.toLowerCase() === unitId.toLowerCase()
        );
      }
      return matchesById;
    }
    
    // Pour les autres effets, logique normale
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
    
    return matchesById || matchesByClass || matchesByIdAsClass;
  });
}

/**
 * Obtient les abilities disponibles pour une unité
 */
export function getAbilitiesForUnit(
  unitClasses: string[],
  civAbbr: string,
  age: number,
  unitId?: string
): Ability[] {
  const abilities = combatAbilities.filter(ability => {
    // Filtrer les abilities marquées comme hidden
    if ((ability as any).hidden) return false; // eslint-disable-line @typescript-eslint/no-explicit-any
    
    if (ability.civs.length > 0 && !ability.civs.includes(civAbbr) && civAbbr !== 'all') {
      return false;
    }
    
    // Vérifier les effects au niveau de l'ability
    if (ability.effects && ability.effects.length > 0) {
      const affectsUnit = ability.effects.some(effect => {
        let matchesById = false;
        let matchesByClass = false;
        let matchesByIdAsClass = false;
        
        // Pour les effets versus debuff, seul select.id compte
        if (effect.property === 'versusOpponentDamageDebuff') {
          if (effect.select?.id && unitId) {
            matchesById = effect.select.id.some(id => id.toLowerCase() === unitId.toLowerCase());
          }
          return matchesById;
        }
        
        // Pour les autres effets, logique normale
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
        
        return matchesById || matchesByClass || matchesByIdAsClass;
      });
      
      if (affectsUnit) return true;
    }
    
    // Vérifier au niveau des variations
    return ability.variations.some(variation => {
      if (variation.civs.length > 0 && civAbbr !== 'all' && !variation.civs.includes(civAbbr)) return false;

      // Si cette ability est déverrouillée par une technologie (ex: "technologies/camel-support")
      // et que la technologie du même nom/ID s'applique déjà à l'unité, ignorer l'ability
      if (variation.unlockedBy && Array.isArray(variation.unlockedBy)) {
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
 * Obtient la variation correcte d'une ability
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

  // Fusionner avec les effects au niveau de l'ability si présents
  if (ability.effects && ability.effects.length > 0) {
    // Conserver les effets de la variation ET ceux de l'ability (concaténation),
    // afin de ne pas écraser des patchs appliqués aux variations.
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
 * Obtient toutes les variations actives d'abilities (similaire aux technologies)
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
