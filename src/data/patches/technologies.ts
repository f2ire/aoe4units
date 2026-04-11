import type { TechnologyPatch } from './types';
import { deepMerge } from './types';
import type { Technology, TechnologyVariation } from '../unified-technologies';

export const technologyPatches: TechnologyPatch<Technology, TechnologyVariation>[] = [

  //___________
  //
  // BASE GAME
  //
  //___________

  {
    id: 'adjustable-crossbars',
    reason: 'aoe4world does not model the burst projectile increase for Mangonel. This tech adds +1 projectile per volley in-game, represented here as a burst +1 effect.',
    update: {
      effects: [
        {
          property: 'burst',
          select: { id: ['mangonel'] },
          effect: 'change',
          value: 1,
          type: 'passive'
        }
      ]
    }
  },

  {
    id: 'geometry',
    reason: 'aoe4world does not include trebuchets in the effect targets for this tech. In-game, Geometry grants +20% ranged attack and +20% bonus damage vs buildings/naval to all trebuchet variants.',
    update: {
      effects: [
        {
          property: 'rangedAttack',
          select: { id: ['huihui-pao', 'counterweight-trebuchet', 'traction-trebuchet'] },
          effect: 'multiply',
          value: 1.2,
          type: 'passive'
        },
        {
          property: 'siegeAttack',
          select: { id: ['huihui-pao', 'counterweight-trebuchet', 'traction-trebuchet'] },
          effect: 'multiply',
          value: 1.2,
          type: 'bonus',
          target: { class: [['building']] }
        },
        {
          property: 'siegeAttack',
          select: { id: ['huihui-pao', 'counterweight-trebuchet', 'traction-trebuchet'] },
          effect: 'multiply',
          value: 1.2,
          type: 'bonus',
          target: { class: [['naval', 'unit']] }
        }
      ]
    }
  },

  {
    id: 'chemistry',
    reason: 'aoe4world does not list the bonus damage targets for Chemistry on gunpowder units. In-game, Chemistry grants +25% bonus damage vs war elephants, buildings, naval units and infantry to gunpowder siege and warships. Warships use class "naval_warship" (not "warship") in aoe4world data.',
    update: {
      effects: [
        {
          property: 'siegeAttack',
          select: { class: [['gunpowder', 'siege'], ['gunpowder', 'naval_warship']] },
          effect: 'multiply',
          value: 1.25,
          type: 'bonus',
          target: { class: [["war", "elephant"]] }
        },
        {
          property: 'siegeAttack',
          select: { class: [['gunpowder', 'siege'], ['gunpowder', 'naval_warship']] },
          effect: 'multiply',
          value: 1.25,
          type: 'bonus',
          target: { class: [['building']] }
        },
        {
          property: 'siegeAttack',
          select: { class: [['gunpowder', 'siege'], ['gunpowder', 'naval_warship']] },
          effect: 'multiply',
          value: 1.25,
          type: 'bonus',
          target: { class: [['naval', 'unit']] }
        },
        {
          property: 'siegeAttack',
          select: { class: [['gunpowder', 'siege'], ['gunpowder', 'naval_warship']] },
          effect: 'multiply',
          value: 1.25,
          type: 'bonus',
          target: { class: [['war_elephant']] }
        },
        {
          property: 'siegeAttack',
          select: { class: [['gunpowder', 'siege'], ['gunpowder', 'naval_warship']] },
          effect: 'multiply',
          value: 1.25,
          type: 'bonus',
          target: { class: [['infantry']] }
        }
      ]
    }
  },


  //_________________
  //
  // ABBASID DYNASTY
  //
  //_________________

  {
    id: 'camel-support',
    reason: 'aoe4world only lists one armor type for this tech; the actual in-game effect grants +2 melee AND +2 ranged armor to infantry. Both effects are declared explicitly here.',
    variations: [
      {
        match: { id: 'camel-support-4' },
        update: {
          effects: [
            {
              property: 'meleeArmor',
              select: { class: [['infantry']] },
              effect: 'change',
              value: 2,
              type: 'ability'
            },
            {
              property: 'rangedArmor',
              select: { class: [['infantry']] },
              effect: 'change',
              value: 2,
              type: 'ability'
            }
          ]
        }
      }
    ],
    after: (tech) => ({
      ...tech,
      civs: [...tech.civs, 'by'],
      variations: tech.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"]
      }))
    }),
    foreignEngineering: true,
    uiTooltip: 'Available only with Foreign Engineering Company',
  },


  {
    id: 'ability-quick-strike',
    reason: 'aoe4world reports this ability with incomplete effects for Ghulam. In-game it reduces attack cycle time by 0.5s then multiplies it by 0.5 — both effects are required to match observed DPS.',
    variations: [
      {
        match: { id: 'ability-quick-strike-1' },
        update: {
          effects: [
            {
              property: 'attackSpeed',
              select: { id: ['ghulam'] },
              effect: 'change',
              value: 0.5,
              type: 'ability'
            },
            {
              property: 'attackSpeed',
              select: { id: ['ghulam'] },
              effect: 'multiply',
              value: 0.5,
              type: 'ability'
            }
          ]
        }
      }
    ]
  },

  {
    id: 'composite-bows',
    reason: 'aoe4world reports the attack speed multiplier as 0.75 (−25%) but in-game testing shows the actual reduction is ~−23% (×0.76923). The tooltip in-game is also misleading (claims −33%).',
    uiTooltip: '⚠️ The actual attack speed reduction is -30%, not -33% as shown in the tooltip.',
    variations: [
      {
        match: { id: 'composite-bows-3' },
        update: {
          effects: [
            {
              property: 'attackSpeed',
              select: { class: [['archer', 'infantry']] },
              effect: 'multiply',
              value: 0.76923,
              type: 'passive'
            }
          ]
        }
      }
    ]
  },

  {
    id: "boot-camp",
    reason: "Available for Byzantines after building Foreign Engineering Company.",
    after: (tech) => ({
      ...tech,
      civs: [...tech.civs, 'by'],
      variations: tech.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"]
      }))
    }),
    foreignEngineering: true,
    foreignEngineeringUnits: ['ghulam'],
    uiTooltip: "Available only with Foreign Engineering Company",
  },

  {
    id: "camel-rider-shields",
    reason: "Available for Byzantines after building Foreign Engineering Company.",
    after: (tech) => ({
      ...tech,
      civs: [...tech.civs, 'by'],
      variations: tech.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"]
      }))
    }),
    foreignEngineering: true,
    foreignEngineeringUnits: ['camel-rider'],
    uiTooltip: "Available only with Foreign Engineering Company",
  },

  {
    id: "camel-rider-barding",
    reason: "Available for Byzantines after building Foreign Engineering Company.",
    after: (tech) => ({
      ...tech,
      civs: [...tech.civs, 'by'],
      variations: tech.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"]
      }))
    }),
    foreignEngineering: true,
    foreignEngineeringUnits: ['camel-rider'],
    uiTooltip: "Available only with Foreign Engineering Company",
  },

  {
    id: "camel-handling",
    reason: "Available for Byzantines after building Foreign Engineering Company. Raw effects only target camel-rider and camel-archer — desert-raider added to variation effects so getTechnologiesForUnit picks it up.",
    after: (tech) => ({
      ...tech,
      civs: [...tech.civs, 'by'],
      variations: tech.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"],
        effects: [
          ...(v.effects || []),
          {
            property: 'moveSpeed',
            select: { id: ['desert-raider'] },
            effect: 'multiply',
            value: 1.15,
            type: 'passive'
          }
        ]
      }))
    }),
    foreignEngineering: true,
    foreignEngineeringUnits: ['camel-rider', 'camel-archer', 'desert-raider'],
    uiTooltip: "Available only with Foreign Engineering Company",
  },

  //_________
  //
  // AYYUBIDS
  //
  //_________

  {
    id: 'sultans-mamluks',
    reason: 'aoe4world effects use effect:"change" (addition) with value 1.25 instead of multiply, have no select targeting infantry, and omit the moveSpeed bonus entirely. Patched to: multiply meleeAttack/rangedAttack ×1.25 and moveSpeed ×1.2 for infantry only.',
    uiTooltip: 'Infantry: +25% damage, +20% move speed (30s after a kill)',
    variations: [
      {
        match: { id: 'sultans-mamluks-3' },
        update: {
          effects: [
            {
              property: 'meleeAttack',
              select: { class: [['infantry']] },
              effect: 'multiply',
              value: 1.25,
              type: 'passive'
            },
            {
              property: 'rangedAttack',
              select: { class: [['infantry']] },
              effect: 'multiply',
              value: 1.25,
              type: 'passive'
            },
            {
              property: 'moveSpeed',
              select: { class: [['infantry']] },
              effect: 'multiply',
              value: 1.2,
              type: 'passive'
            }
          ]
        }
      }
    ]
  },

  //___________
  //
  // Byzantines
  //
  //___________

  {
    id: "ferocious-speed",
    reason: "effects are only during Berserking ability",
    update: {
      effects: [
        {
          property: "moveSpeed",
          select: { id: ["verangian-guard"] },
          effect: "multiply",
          value: 0,
          type: "passive"
        }
      ]
    }
  },
  {
    id: "numeri",
    reason: "effects are only during Berserking ability",
    update: {
      effects: [
        {
          property: "meleeAttack",
          select: { id: ["cataphract"] },
          effect: "multiply",
          value: 1.15,
          type: "passive"
        }
      ]
    }
  },
  {
    id: 'greek-fire-projectiles',
    reason: 'aoe4world does not include trebuchets in the effect targets for this tech. In-game, Geometry grants +30% damage.',
    update: {
      effects: [
        {
          property: 'rangedAttack',
          select: { id: ['huihui-pao', 'counterweight-trebuchet', 'traction-trebuchet'] },
          effect: 'multiply',
          value: 1.3,
          type: 'passive'
        },
        {
          property: 'siegeAttack',
          select: { id: ['huihui-pao', 'counterweight-trebuchet', 'traction-trebuchet'] },
          effect: 'multiply',
          value: 1.3,
          type: 'bonus',
          target: { class: [['building']] }
        },
        {
          property: 'siegeAttack',
          select: { id: ['huihui-pao', 'counterweight-trebuchet', 'traction-trebuchet'] },
          effect: 'multiply',
          value: 1.3,
          type: 'bonus',
          target: { class: [['naval', 'unit']] }
        }
      ]
    }
  },

  {
    id: 'incendiary-arrows',
    reason: 'Byzantine javelin-thrower does not have access to Incendiary Arrows in-game.',
    excludedUnits: ['javelin-thrower'],
  },

  //___________
  //
  // DELHI SULTANATE
  //
  //___________

  {
    id: "armored-beasts",
    reason: "Available for Byzantines after building Foreign Engineering Company.",
    after: (tech) => ({
      ...tech,
      civs: [...tech.civs, 'by'],
      variations: tech.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"]
      }))
    }),
    foreignEngineering: true,
    foreignEngineeringUnits: ['war-elephant'],
    uiTooltip: "Available only with Foreign Engineering Company",
  },

  {
    id: "howdahs",
    reason: "Available for Byzantines after researching Elite Contract.",
    after: (tech) => ({
      ...tech,
      civs: [...tech.civs, 'by'],
      variations: tech.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"]
      }))
    }),
  },
  //___________
  //
  // ENGLISH
  //
  //___________


  //___________
  //
  // FRENCH
  //
  //___________

  {
    id: "gambesons",
    reason: "Available for Byzantines after building Foreign Engineering Company.",
    after: (tech) => ({
      ...tech,
      civs: [...tech.civs, 'by'],
      variations: tech.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"]
      }))
    }),
    foreignEngineering: true,
    foreignEngineeringUnits: ['arbaletrier'],
    uiTooltip: "Available only with Foreign Engineering Company",
  },

  {
    id: "crossbow-stirrups",
    reason: "Available for Byzantines after building Foreign Engineering Company.",
    after: (tech) => ({
      ...tech,
      civs: [...tech.civs, 'by'],
      variations: tech.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"]
      }))
    }),
    foreignEngineering: true,
    foreignEngineeringUnits: ['arbaletrier'],
    uiTooltip: "Available only with Foreign Engineering Company",
  },

  {
    id: "crossbow-stirrups",
    reason: "Available for Byzantines after building Foreign Engineering Company.",
    after: (tech) => ({
      ...tech,
      civs: [...tech.civs, 'by'],
      variations: tech.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"]
      }))
    }),
    foreignEngineering: true,
    foreignEngineeringUnits: ['arbaletrier'],
    uiTooltip: "Available only with Foreign Engineering Company",
  },

  {
    id: "cantled-saddles",
    reason: "Available for Byzantines after building Foreign Engineering Company. Raw +10 bonus vs infantry/cavalry zeroed via value:0 (keeps tech visible in combatTechnologies) — conditional effect handled via techAbilityInteractions (requires charge-attack).",
    update: {
      effects: [
        {
          property: 'meleeAttack',
          select: { id: ['royal-knight'] },
          effect: 'change',
          value: 0,
          type: 'bonus'
        }
      ]
    },
    after: (tech) => ({
      ...tech,
      civs: [...tech.civs, 'by'],
      variations: tech.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"],
      }))
    }),
    foreignEngineering: true,
    foreignEngineeringUnits: ['royal-knight'],
    uiTooltip: "Available only with Foreign Engineering Company",
  },

  {
    id: "royal-bloodlines",
    reason: "Available for Byzantines after building Foreign Engineering Company.",
    after: (tech) => ({
      ...tech,
      civs: [...tech.civs, 'by'],
      variations: tech.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"]
      }))
    }),
    foreignEngineering: true,
    foreignEngineeringUnits: ['royal-knight'],
    uiTooltip: "Available only with Foreign Engineering Company",
  },
  //___________
  //
  // MALIANS
  //
  //___________

  {
    id: "precision-training",
    reason: "Available for Byzantines after building Foreign Engineering Company.",
    after: (tech) => ({
      ...tech,
      civs: [...tech.civs, 'by'],
      variations: tech.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"]
      }))
    }),
    foreignEngineering: true,
    foreignEngineeringUnits: ['javelin-thrower'],
    uiTooltip: "Available only with Foreign Engineering Company",
  },

  {
    id: "local-knowledge",
    reason: "Available for Byzantines after building Foreign Engineering Company.",
    after: (tech) => ({
      ...tech,
      civs: [...tech.civs, 'by'],
      variations: tech.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"]
      }))
    }),
    foreignEngineering: true,
    foreignEngineeringUnits: ['musofadi-warrior'],
    uiTooltip: "Available only with Foreign Engineering Company. And duration is not yet considered",
  },



  //___________
  //
  // MONGOLS
  //
  //___________

  {
    id: "biology-improved",
    reason: "Tier 2 of the Biology line. When selected, the tier system also applies Biology (tier 1) first. Available for Byzantines after building Foreign Engineering Company.",
    update: {
      effects: [
        {
          "property": "hitpoints",
          "select": {
            "class": [["cavalry"]]
          },
          "effect": "multiply",
          "value": 1.1,
          "type": "passive"
        },
      ],
      displayClasses: ['Biology Technology 2/2']
    },
    after: (tech) => ({
      ...tech,
      civs: [...tech.civs, 'by'],
      variations: tech.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"]
      }))
    }),
    foreignEngineering: true,
    foreignEngineeringUnits: ['keshik', 'mangudai'],
    uiTooltip: "Available only with Foreign Engineering Company",
  },
  {
    id: 'biology',
    reason: 'Biology and Biology (Improved) form a tier line: selecting Improved automatically includes Biology effects first.',
    update: { displayClasses: ['Biology Technology 1/2'] },
  },

  {
    id: "steppe-lancers-improved",
    reason: "Available for Byzantines after building Foreign Engineering Company.",
    after: (tech) => ({
      ...tech,
      civs: [...tech.civs, 'by'],
      variations: tech.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"]
      }))
    }),
    foreignEngineering: true,
    foreignEngineeringUnits: ['keshik'],
    uiTooltip: "Available only with Foreign Engineering Company",
  },
  {
    id: "siha-bow-limbs-improved",
    reason: "Tier 2 of the Siha Bow Limbs line. Available for Byzantines after building Foreign Engineering Company.",
    update: {
      displayClasses: ['Siha Bow Limbs Technology 2/2']
    },
    after: (tech) => ({
      ...tech,
      civs: [...tech.civs, 'by'],
      variations: tech.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"]
      }))
    }),
    foreignEngineering: true,
    foreignEngineeringUnits: ['keshik', 'mangudai'],
    uiTooltip: "Available only with Foreign Engineering Company",
  },
  {
    id: 'siha-bow-limbs',
    reason: 'Tier 1 of the Siha Bow Limbs line',
    update: { displayClasses: ['Siha Bow Limbs Technology 1/2'] },
  },


  //___________
  //
  // RUS
  //
  //___________

  {
    id: "mounted-training",
    reason: 'Available for Byzantines.',
    after: (abilities) => ({
      ...abilities,
      civs: [...abilities.civs, 'by'],
      variations: abilities.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"]
      }))
    }),
    foreignEngineering: true,
    foreignEngineeringUnits: ['horse-archer'],
    uiTooltip: "Available only with Foreign Engineering Company",
  },

  {
    id: "boyars-fortitude",
    reason: 'Available for Byzantines.',
    after: (abilities) => ({
      ...abilities,
      civs: [...abilities.civs, 'by'],
      variations: abilities.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"]
      }))
    }),
    foreignEngineering: true,
    foreignEngineeringUnits: ['horse-archer'],
    uiTooltip: "Available only with Foreign Engineering Company",
  },


];

// Maps tech ID → unit IDs that should never see this tech
export const techUnitExclusions: Map<string, string[]> = new Map(
  technologyPatches
    .filter(p => p.excludedUnits)
    .map(p => [p.id, p.excludedUnits!])
);

export const foreignEngineeringTechIds: Set<string> = new Set(
  technologyPatches.filter(p => p.foreignEngineering).map(p => p.id)
);

// Maps tech ID → allowed unit IDs when accessed via FEC by Byzantines (undefined = no restriction)
export const foreignEngineeringUnitRestrictions: Map<string, string[]> = new Map(
  technologyPatches
    .filter(p => p.foreignEngineering && p.foreignEngineeringUnits)
    .map(p => [p.id, p.foreignEngineeringUnits!])
);

export function applyTechnologyPatches(allTechs: Technology[]): Technology[] {
  if (!Array.isArray(allTechs) || technologyPatches.length === 0) return allTechs;

  return allTechs.map((tech) => {
    const patch = technologyPatches.find(p => p.id === tech.id);
    if (!patch) return tech;

    let updated: Technology = patch.update ? deepMerge(tech, patch.update) : { ...tech };

    if (patch.variations?.length && Array.isArray(updated.variations)) {
      updated = {
        ...updated,
        variations: updated.variations.map((v: TechnologyVariation) => {
          const vPatch = patch.variations!.find(vp => {
            if (vp.match.id && vp.match.id !== v.id) return false;
            if (vp.match.civsIncludes && !v.civs?.includes?.(vp.match.civsIncludes)) return false;
            return true;
          });
          return vPatch ? deepMerge(v, vPatch.update) : v;
        })
      };
    }

    if (patch.after) updated = patch.after(updated);
    return updated;
  });
}
