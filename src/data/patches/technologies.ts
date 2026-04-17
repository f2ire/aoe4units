import type { TechnologyPatch } from './types';
import { deepMerge } from './types';
import type { Technology, TechnologyVariation } from '../unified-technologies';

// Replaces "religious" with "monk" in all effect select classes.
// All monk units (imam, scholar, prelate, shaman, etc.) have class "monk", not "religious".
const replaceReligiousWithMonk = (tech: Technology): Technology => ({
  ...tech,
  effects: (tech.effects || []).map(e => ({
    ...e,
    select: e.select?.class ? {
      ...e.select,
      class: (e.select.class as string[][]).map(group => group.map(c => c === 'religious' ? 'monk' : c))
    } : e.select
  }))
});

export const technologyPatches: TechnologyPatch<Technology, TechnologyVariation>[] = [

  //___________
  //
  // BASE GAME
  //
  //___________

  // Armor techs: raw data targets "religious" class but all monk units use "monk" — corrected.
  ...((['angled-surfaces', 'fitted-leatherwork', 'insulated-helm', 'iron-undermesh', 'master-smiths', 'wedge-rivets'] as const).map(id => ({
    id,
    reason: 'Raw data targets "religious" class but all monk units (imam, scholar, prelate, shaman, etc.) have class "monk". Corrected so these armor techs apply to monks.',
    after: replaceReligiousWithMonk,
  }))),

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
    id: 'extra-hammocks',
    reason: 'aoe4world does not model the burst projectile increase for archer ship. This tech adds +1 projectile per volley in-game, represented here as a burst +1 effect.',
    update: {
      effects: [
        {
          property: 'burst',
          select: {
            id: ["archer_ship"]
          },
          effect: 'change',
          value: 1,
          type: 'passive'
        }
      ]
    }
  },
  {
    id: 'heated-shot',
    reason: 'Aoe4world data are not correct. To patch later.',
    update: {
      effects: [
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

  {
    id: "greased-axles",
    reason: "Must exclude some sieges units that is not really siege units.",
    excludedUnits: ['grenadier'],
  },

  {
    id: 'court-architects',
    reason: 'Villager has class golden_age_tier_3_building_abb which expands to "building" token, falsely matching this tech.',
    excludedUnits: ['villager'],
  },
  {
    id: "silk-bowstrings",
    reason: "Not implemented in data file.",
    after: (tech) => ({
      ...tech,
      variations: tech.variations.map(v => ({
        ...v,
        effects: [
          ...(v.effects || []),
          {
            property: 'maxRange',
            select: {
              "id": [
                "longbowman",
                "wynguard-ranger",
                "zhuge-nu",
                "archer",
                "arbaletrier",
                "crossbowman",
                "longbowman",
                "zhuge-nu",
                "archer",
                "arbaletrier",
                "crossbowman",
                "wynguard-ranger",
                "javelin-thrower",
                "gilded-crossbowman",
                "gilded-archer",
                "yumi-ashigaru",
                "zhuge-nu",
                "bedouin-skirmisher",
                "yumi-bannerman",
              ]
            },
            effect: 'change',
            value: 1.5,
            type: 'passive'
          },
          {
            property: 'maxRange',
            select: {
              "id": [
                "mangudai",
                "khaganate-elite-mangudai",
                "khaganate-horse-archer",
                "horse-archer",
                "camel-archer",
                "khan",
                "desert-raider",
              ]
            },
            effect: 'change',
            value: -0.75,
            type: 'passive'
          },
        ]
      }))
    }),
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
    uiTooltip: 'The actual attack speed reduction is -30%, not -33% as shown in the tooltip.',
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
    reason: 'Byzantine javelin-thrower excluded (not in-game). Raw data has typo tower-elepahnt → fixed to tower-elephant in select.id.',
    excludedUnits: ['javelin-thrower'],
    after: (tech: Technology) => ({
      ...tech,
      effects: (tech.effects || []).map(effect => ({
        ...effect,
        select: effect.select?.id ? {
          ...effect.select,
          id: effect.select.id.map(id => id === 'tower-elepahnt' ? 'tower-elephant' : id)
        } : effect.select
      }))
    }),
  },

  // sultans-elite-tower-elephant has gunpowder class but also ranged+cavalry — these
  // archer/ranged techs match it via [["ranged","cavalry"]] class group, which is incorrect.
  // Chemistry (gunpowder class) is left untouched — it correctly applies to gunpowder units.
  {
    id: 'steeled-arrow',
    reason: 'sultans-elite-tower-elephant has ranged+cavalry classes but fires gunpowder (Handcannon), not arrows.',
    excludedUnits: ['sultans-elite-tower-elephant'],
  },
  {
    id: 'balanced-projectiles',
    reason: 'sultans-elite-tower-elephant has ranged+cavalry classes but fires gunpowder (Handcannon), not arrows.',
    excludedUnits: ['sultans-elite-tower-elephant'],
  },
  {
    id: 'platecutter-point',
    reason: 'sultans-elite-tower-elephant has ranged+cavalry classes but fires gunpowder (Handcannon), not arrows.',
    excludedUnits: ['sultans-elite-tower-elephant'],
  },
  {
    id: 'inspired-warriors',
    reason: 'sultans-elite-tower-elephant has ranged+cavalry classes but fires gunpowder (Handcannon), not arrows.',
    excludedUnits: ['sultans-elite-tower-elephant'],
  },

  //___________
  //
  // CHINESE
  //
  //___________

  {
    id: 'thunderclap-bombs',
    reason: 'Raw data models the Nest of Bees attack as a flat siegeAttack bonus (+21.33). Replaced with weapon injection from nest-of-bees unit (Rocket Arrow: 6 dmg × 7 burst, siege type).',
    update: {
      effects: [
        {
          property: 'siegeAttack',
          select: { class: [['warship']] },
          effect: 'change',
          value: 0,
          type: 'passive'
        }
      ]
    },
    injectWeapon: { unitId: 'nest-of-bees', weaponIndex: 0 },
  },

  {
    id: "reload-drills",
    reason: "Raw value 0.75 = 1/1.333 (+33.3% AS). Corrected to 1/1.28 (+28% AS) to match in-game description.",
    after: (tech: Technology) => ({
      ...tech,
      variations: tech.variations.map(v => ({
        ...v,
        effects: v.effects.map(e =>
          e.property === 'attackSpeed' ? { ...e, value: 1 / 1.28 } : e
        )
      }))
    }),
    uiTooltip: "The actual attack speed reduction is -28%, not -33% as shown in the tooltip."
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

  {
    id: "zeal",
    reason: "Base effect corrected to ×1/1.5. Per-unit corrections hard-fixed from in-game measurements (no uniform model found). Average effective buff: −28.3% cycle (+39.4% AS).",
    excludedUnits: ['scholar'],
    after: (tech: Technology) => {
      const corrections = [
        { id: 'man-at-arms', value: 1.5 / 1.375 },
        { id: 'archer', value: 1.875 / 1.625 },
        { id: 'crossbowman', value: 2.295 / 2.125 },
        { id: 'handcannoneer', value: 2.37 / 2.125 },
        { id: 'tower-elephant', value: 3.0 / 2.875 },
        { id: 'sultans-elite-tower-elephant', value: 3.0 / 2.875 },
        { id: 'lancer', value: 1.08 },
        { id: 'war-elephant', value: 3.0 / 2.875 },
        { id: 'ghazi-raider', value: 0.96 },
      ];
      return {
        ...tech,
        variations: tech.variations.map(v => ({
          ...v,
          effects: [
            ...v.effects.map((e: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
              e.property === 'attackSpeed' ? { ...e, value: 1 / 1.5 } : e
            ),
            ...corrections.map(c => ({
              property: 'attackSpeed',
              select: { id: [c.id] },
              effect: 'multiply',
              value: c.value,
              type: 'passive'
            }))
          ]
        }))
      };
    },
    uiTooltip: "The 50% attack speed buff value is incorrect compared to the in-game UI average. The mean is around 39%, but it varies from 30% (Archer) to 56% (Ghazi).",
  },

  {
    id: "forced-march",
    reason: "Useless tech for UI.",
    after: (tech) => ({
      ...tech,
      variations: tech.variations.map(v => ({ ...v, effects: [] }))
    })
  },

  {
    id: "paiks",
    reason: "Not implemented in data file.",
    after: (tech) => ({
      ...tech,
      variations: tech.variations.map(v => ({
        ...v,
        effects: [
          ...(v.effects || []),
          {
            property: 'maxRange',
            select: { id: ['archer', 'crossbowman'] },
            effect: 'change',
            value: 0.5,
            type: 'passive'
          }
        ]
      }))
    }),
  },

  {
    id: "mahouts",
    reason: "Not implemented in data file.",
    after: (tech) => ({
      ...tech,
      variations: tech.variations.map(v => ({
        ...v,
        effects: [
          ...(v.effects || []),
          {
            property: 'moveSpeed',
            select: { class: [['elephant']] },
            effect: 'multiply',
            value: 1.1,
            type: 'passive'
          }
        ]
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

// Maps tech ID → { unitId, weaponIndex } for secondary weapon injection
export const weaponInjectionMap: Map<string, { unitId: string; weaponIndex: number }> = new Map(
  technologyPatches
    .filter(p => p.injectWeapon)
    .map(p => [p.id, { unitId: p.injectWeapon!.unitId, weaponIndex: p.injectWeapon!.weaponIndex ?? 0 }])
);

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
