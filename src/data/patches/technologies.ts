import type { TechnologyPatch } from './types';
import { deepMerge } from './types';
import type { Technology, TechnologyVariation, TechnologyEffect } from '../unified-technologies';

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
    id: 'serpentine-powder',
    reason: 'Raw effects empty. Handcannoneers gain +5 bonus damage vs melee infantry.',
    update: {
      effects: [{
        property: 'rangedAttack',
        select: { class: [['handcannon']] },
        effect: 'change',
        value: 5,
        type: 'bonus',
        target: { class: [['melee', 'infantry']] },
      }],
    },
  },

  {
    id: "elite-army-tactics",
    reason: "Streltsy is a gunpowder unit — this melee infantry tech should not apply in either weapon mode.",
    excludedUnits: ['streltsy'],
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
    excludedUnits: ['batu-khan'],
    update: {
      effects: [
        {
          property: 'maxRange',
          select: { id: ['longbowman', 'wynguard-ranger', 'archer', 'gilded-archer', 'yumi-ashigaru', 'yumi-bannerman'] },
          effect: 'change',
          value: 1.5,
          type: 'passive'
        },
        {
          property: 'maxRange',
          select: { id: ['mangudai', 'khaganate-elite-mangudai', 'khaganate-horse-archer', 'horse-archer', 'camel-archer', 'khan', 'desert-raider'] },
          effect: 'change',
          value: -0.75,
          type: 'passive'
        },
      ]
    }
  },

  {
    id: 'incendiary-arrows',
    reason: 'Byzantine javelin-thrower excluded (not in-game). Raw data has typo tower-elepahnt → fixed. kipchak-archer added so triple-shot secondary arrows also scale with this tech.',
    excludedUnits: ['javelin-thrower', 'batu-khan'],
    unitTooltips: { 'kipchak-archer': 'For an unknown reason, incendiary arrows first reduce attack by 1 (both normal and triple attack) after applying the 20% bonus damage.' },
    after: (tech: Technology) => ({
      ...tech,
      effects: [
        ...(tech.effects || []).map(effect => ({
          ...effect,
          select: effect.select?.id ? {
            ...effect.select,
            id: [
              ...effect.select.id.map(id => id === 'tower-elepahnt' ? 'tower-elephant' : id),
              ...(!effect.select.id.includes('kipchak-archer') ? ['kipchak-archer'] : [])
            ]
          } : effect.select
        })),
        // kipchak-archer in-game loses 1 base damage before the ×1.2 is applied
        { property: 'rangedAttack', select: { id: ['kipchak-archer'] }, effect: 'change', value: -1, type: 'passive' }
      ]
    }),
  },

  // Bloomery melee upgrade family — jeanne-darc-mounted-archer is ranged-only; warrior-monk has melee weapon but no 'melee' class.
  ...(['bloomery', 'decarbonization', 'damascus-steel'] as const).map(id => ({
    id,
    reason: "jeanne-darc-mounted-archer excluded (ranged only). Warrior Monk added by ID: has melee weapon but lacks 'melee' class.",
    excludedUnits: ['jeanne-darc-mounted-archer'],
    after: (tech: Technology) => ({
      ...tech,
      effects: [
        ...tech.effects,
        { property: 'meleeAttack', select: { id: ['warrior-monk'] }, effect: 'change', value: 1, type: 'passive' }
      ]
    })
  })),

  {
    id: 'steeled-arrow',
    reason: "Gunpowder units don't shot arrow arrows.",
    excludedUnits: ['sultans-elite-tower-elephant', 'black-rider', 'jeanne-darc-markswoman'],
    after: (tech: any) => ({
      ...tech,
      effects: [...(tech.effects || []), { property: 'rangedAttack', select: { id: ['earls-guard'] }, effect: 'change', value: 1, type: 'passive' }],
    }),
  },
  {
    id: 'balanced-projectiles',
    reason: "Gunpowder units don't shot arrow arrows.",
    excludedUnits: ['sultans-elite-tower-elephant', 'black-rider', 'jeanne-darc-markswoman'],
    after: (tech: any) => ({
      ...tech,
      effects: [...(tech.effects || []), { property: 'rangedAttack', select: { id: ['earls-guard'] }, effect: 'change', value: 1, type: 'passive' }],
    }),
  },
  {
    id: 'platecutter-point',
    reason: "Gunpowder units don't shot arrow arrows.",
    excludedUnits: ['sultans-elite-tower-elephant', 'black-rider', 'jeanne-darc-markswoman'],
    after: (tech: any) => ({
      ...tech,
      effects: [...(tech.effects || []), { property: 'rangedAttack', select: { id: ['earls-guard'] }, effect: 'change', value: 1, type: 'passive' }],
    }),
  },

  {
    id: "herbal-medicine",
    reason: "Useless tech for UI.",
    after: (tech) => ({
      ...tech,
      effects: [],
      variations: tech.variations.map((v: any) => ({ ...v, effects: [] })),
    }),
  },

  {
    id: "piety",
    reason: "Add combat_monk class to select so Hospitaller Knight (class: combat_monk) is also affected.",
    after: (tech) => ({
      ...tech,
      effects: (tech.effects || []).map((e: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        ...e,
        select: { ...e.select, class: [['combat_monk']] }
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
    uiTooltip: 'The actual attack speed buff is 30%.',
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
    reason: "Available for Byzantines after building Foreign Engineering Company. Raw effects are in variation.effects (tech.effects undefined) — promoted to top-level and desert-raider added.",
    after: (tech) => ({
      ...tech,
      civs: [...tech.civs, 'by'],
      effects: [
        ...(tech.variations[0]?.effects || []),
        { property: 'moveSpeed', select: { id: ['desert-raider'] }, effect: 'multiply', value: 1.15, type: 'passive' },
      ],
      variations: tech.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"],
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

  {
    id: 'infantry-support',
    reason: 'Raw effects empty. Adds +3 melee and +3 ranged armor to camels.',
    update: {
      effects: [
        { property: 'meleeArmor', select: { class: [['camel']] }, effect: 'change', value: 3, type: 'passive' },
        { property: 'rangedArmor', select: { class: [['camel']] }, effect: 'change', value: 3, type: 'passive' },
      ]
    }
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
    },
    after: (tech) => ({ ...tech, civs: [...tech.civs, 'mac'], variations: tech.variations.map(v => ({ ...v, civs: [...v.civs, 'mac'] })) }),
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
    update: {
      effects: [
        {
          property: 'maxRange',
          select: { id: ['archer', 'crossbowman'] },
          effect: 'change',
          value: 0.5,
          type: 'passive'
        }
      ]
    }
  },

  {
    id: "mahouts",
    reason: "Not implemented in data file.",
    update: {
      effects: [
        {
          property: 'moveSpeed',
          select: { class: [['elephant']] },
          effect: 'multiply',
          value: 1.1,
          type: 'passive'
        }
      ]
    }
  },
  //___________
  //
  // ENGLISH
  //
  //___________


  {
    id: 'admiralty',
    reason: 'Raw data has empty effects. Adds +1 range to Galley, Hulk, and Carrack per in-game description.',
    update: {
      effects: [
        {
          property: 'maxRange',
          select: { id: ['galley', 'hulk', 'carrack'] },
          effect: 'change',
          value: 1,
          type: 'passive',
        }
      ]
    }
  },

  {
    id: "network-of-citadels",
    reason: "Useless tech for UI.",
    after: (tech) => ({
      ...tech,
      variations: tech.variations.map(v => ({ ...v, effects: [] }))
    })
  },

  {
    id: 'upgrade-king-3',
    reason: 'Castle Age King stats are baked into the age-3 variation of the king unit (units.ts patch). Tech excluded so age selection drives the correct stats.',
    excludedUnits: ['king'],
  },
  {
    id: 'upgrade-king-4',
    reason: 'Imperial Age King stats are baked into the age-4 variation of the king unit (units.ts patch). Tech excluded so age selection drives the correct stats.',
    excludedUnits: ['king'],
  },

  {
    id: "armor-clad",
    reason: "Extend to Wynguard Footman.",
    after: (tech: any) => ({
      ...tech,
      variations: tech.variations.map((v: any) => ({
        ...v,
        effects: v.effects.map((e: any) => ({
          ...e,
          select: {
            ...e.select,
            id: [...(e.select?.id || []), "wynguard-footman"]
          }
        }))
      }))
    })
  },

  {
    id: "arrow-volley",
    reason: "Useless tech for UI.",
    after: (tech) => ({
      ...tech,
      effects: [],
      variations: tech.variations.map((v: any) => ({ ...v, effects: [] })),
    }),
  },

  //___________
  //
  // FRENCH
  //
  //___________

  {
    id: 'long-guns',
    reason: 'Raw uses rangedAttack but naval cannons deal siege damage — corrected to siegeAttack.',
    update: {
      effects: [{
        property: 'siegeAttack',
        select: { class: [['warship']], id: ['galleass'] },
        effect: 'multiply',
        value: 1.15,
        type: 'passive',
      }],
    },
  },

  {
    id: 'enlistment-incentives',
    reason: 'Raw effect is property:unknown type:influence — no-op. Effect moved to techAbilityInteractions (requires ability-keep-influence to apply). Value 1.0 keeps the tech visible in isCombatTechnology.',
    update: {
      effects: [
        {
          property: 'costReduction',
          select: { class: [['cavalry'], ['ranged_infantry']] },
          effect: 'multiply',
          value: 1.0,
          type: 'passive',
        }
      ]
    }
  },

  {
    id: "gambesons",
    reason: "Available for Byzantines after building Foreign Engineering Company. Adds attackSpeed ×(1/1.2) on arbaletrier (raw data only has meleeArmor +5).",
    after: (tech) => ({
      ...tech,
      civs: [...tech.civs, 'by'],
      variations: tech.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"],
      })),
    }),
    foreignEngineering: true,
    foreignEngineeringUnits: ['arbaletrier'],
    uiTooltip: "Available only with Foreign Engineering Company",
  },

  {
    id: "crossbow-stirrups",
    reason: "Available for Byzantines after building Foreign Engineering Company. Raw value 0.8 corrected to ×(1/1.2) to match in-game.",
    after: (tech) => ({
      ...tech,
      civs: [...tech.civs, 'by'],
      effects: [
        { property: 'attackSpeed', select: { id: ['arbaletrier'] }, effect: 'multiply', value: 1 / 1.2, type: 'passive' },
      ],
      variations: tech.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"],
      })),
    }),
    foreignEngineering: true,
    foreignEngineeringUnits: ['arbaletrier'],
    uiTooltip: "Available only with Foreign Engineering Company",
    uiTooltipNative: "The actual attackspeed buff is 20%.",
  },

  {
    id: "cantled-saddles",
    reason: "Available for Byzantines after building Foreign Engineering Company. Raw +10 bonus vs infantry/cavalry zeroed via value:0 (keeps tech visible in combatTechnologies) — conditional effect handled via techAbilityInteractions (requires charge-attack).",
    update: {
      effects: [
        {
          property: 'meleeAttack',
          select: { id: ['royal-knight', 'jeanne-darc-knight'] },
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

  {
    id: "chivalry",
    reason: "Useless tech for UI.",
    update: { effects: [] }
  },

  //___________
  //
  // GOLDEN HORDE
  //
  //___________


  {
    id: 'triple-shot',
    reason: 'Kipchak Archer fires 2 extra arrows at 30% damage. Raw effects are generic +2 attack with no select — replaced with a zeroed no-op targeting kipchak-archer so the tech stays visible. Secondary weapon injection handles the actual DPS (burst=2, damageMultiplier=0.3).',
    update: { effects: [{ property: 'rangedAttack', select: { id: ['kipchak-archer'] }, effect: 'change', value: 0, type: 'passive' }] },
    injectWeapon: { unitId: 'kipchak-archer', weaponIndex: 0, damageMultiplier: 0.3, burstCount: 2, maxDamage: 10 },
    uiTooltip: "For an unknown reason, the secondary weapon from Triple Shot can't reach over 10, even if it should.",
  },

  {
    id: 'khan-and-torguuds',
    reason: 'Raw hitpoints effect has no select (applies to all). Patched to target batu-khan and torguud. Cost reduction (-20%) missing from raw data — added.',
    update: {
      unique: true,
      effects: [
        { property: 'hitpoints', select: { id: ['batu-khan', 'torguud'] }, effect: 'change', value: 30, type: 'passive' },
        { property: 'costReduction', select: { id: ['batu-khan', 'torguud'] }, effect: 'multiply', value: 0.8, type: 'passive' },
      ]
    }
  },

  {
    id: 'stone-armies',
    reason: 'Raw effects empty. Torguud: −20% stone cost. Rus Tribute: the age-4 variation stats are granted by this tech (age-4 variation removed from unit data). +30 HP, +4 melee attack, +5 vs cavalry bonus (3→8), +1 melee armor, +1 ranged armor.',
    update: {
      unique: true,
      effects: [
        { property: 'stoneCostReduction', select: { id: ['torguud'] }, effect: 'multiply', value: 0.8, type: 'passive' },
        { property: 'hitpoints', select: { id: ['rus-tribute'] }, effect: 'change', value: 30, type: 'passive' },
        { property: 'meleeAttack', select: { id: ['rus-tribute'] }, effect: 'change', value: 4, type: 'passive' },
        { property: 'meleeAttack', select: { id: ['rus-tribute'] }, target: { class: [['cavalry']] }, effect: 'change', value: 5, type: 'bonus' },
        { property: 'meleeArmor', select: { id: ['rus-tribute'] }, effect: 'change', value: 1, type: 'passive' },
        { property: 'rangedArmor', select: { id: ['rus-tribute'] }, effect: 'change', value: 1, type: 'passive' },
      ]
    }
  },

  {
    id: 'sarai-lancers',
    reason: 'Raw effects empty. Keshik: -10% attack cycle (×1/1.1) and +1 healingRate. Torguud gains +1 healingRate (same healing as Keshik per description).',
    update: {
      effects: [
        { property: 'attackSpeed', select: { id: ['keshik'] }, effect: 'multiply', value: 1 / 1.1, type: 'passive' },
        { property: 'healingRate', select: { id: ['keshik'] }, effect: 'change', value: 1, type: 'passive' },
        { property: 'healingRate', select: { id: ['torguud'] }, effect: 'change', value: 4, type: 'passive' },
      ]
    }
  },

  {
    id: 'padded-armor',
    reason: 'Raw hitpoints effect has no select (would apply to all units). Patched to target horseman and torguud only. Armor effects (+1 melee, +1 ranged) missing from raw data — added.',
    update: {
      effects: [
        { property: 'hitpoints', select: { id: ['horseman', 'torguud'] }, effect: 'change', value: 20, type: 'passive' },
        { property: 'meleeArmor', select: { id: ['horseman', 'torguud'] }, effect: 'change', value: 1, type: 'passive' },
        { property: 'rangedArmor', select: { id: ['horseman', 'torguud'] }, effect: 'change', value: 1, type: 'passive' },
      ]
    }
  },

  {
    id: 'battlefield-salvage',
    reason: 'Raw variation effects have no select — tech invisible for all units. Patched top-level effects targeting kharash.',
    update: {
      effects: [
        { property: 'meleeArmor', select: { id: ['kharash'] }, effect: 'change', value: 2, type: 'passive' },
        { property: 'rangedArmor', select: { id: ['kharash'] }, effect: 'change', value: 2, type: 'passive' },
        { property: 'hitpoints', select: { id: ['kharash'] }, effect: 'change', value: 25, type: 'passive' },
      ]
    }
  },

  {
    id: 'muscovy-yasak',
    reason: 'Raw effects empty. +2 ranged armor for heavy infantry and heavy cavalry.',
    update: {
      unique: true,
      effects: [
        { property: 'rangedArmor', select: { class: [['heavy']] }, effect: 'change', value: 2, type: 'passive' },
      ],
    }
  },

  //___________
  //
  // HOLY ROMAN EMPIRE
  //
  //___________

  {
    id: 'awl-pikes',
    reason: 'Raw effects have no select — apply to all units. Restricted to spearman and horseman per description.',
    update: {
      effects: [
        { property: 'meleeAttack', select: { id: ['spearman', 'horseman'] }, effect: 'change', value: 2, type: 'passive' },
      ]
    }
  },

  {
    id: 'inspired-warriors',
    reason: 'Useless for UI. Only show the linked ability.',
    after: (tech) => ({
      ...tech,
      effects: [],
      variations: tech.variations.map((v: any) => ({ ...v, effects: [] })),
    })
  },

  {
    id: "fire-stations",
    reason: "Useless tech for UI.",
    after: (tech) => ({
      ...tech,
      effects: [],
      variations: tech.variations.map((v: any) => ({ ...v, effects: [] })),
    }),
  },
  //__________________
  //
  // HOUSE OF LANCASTER
  //
  //__________________

  {
    id: 'padded-jack',
    reason: 'Raw effects have no select — apply to all units. Restricted to spearman and horseman per description.',
    update: {
      effects: [
        { property: 'meleeArmor', select: { id: ['spearman', 'yeoman'] }, effect: 'change', value: 3, type: 'passive' },
      ]
    }
  },

  {
    id: 'billmen',
    reason: 'Raw effects (meleeArmor/rangedArmor ×0) target the spearman itself — wrong. Actual effect: spearman reduces enemy armor by 1 on each hit. Replaced with armorPenetration +1 targeting spearman by ID.',
    update: {
      effects: [{
        property: 'armorPenetration',
        select: { id: ['spearman'] },
        effect: 'change',
        value: 1,
        type: 'passive',
      }],
    },
  },

  {
    id: 'military-tactics-training',
    reason: 'Lord of Lancaster unique tech: +20% all bonus damage for all units. Raw effects empty — replaced with bonusDamageMultiplier ×1.2 targeting annihilation_condition (all units).',
    update: {
      effects: [{
        property: 'bonusDamageMultiplier',
        select: { class: [['annihilation_condition']] },
        effect: 'multiply',
        value: 1.2,
        type: 'passive',
      }],
    },
    excludedUnits: ['handcannoneer', 'monk', 'villager', 'trader', 'fishing-boat', 'trade-ship'],
  },

  {
    id: 'throwing-dagger-drills',
    reason: 'Earl\'s Guard dagger throw now hurls 2 daggers (+2 dmg each). Raw effects empty — kept as no-op (value 0) so the tech is visible; burst×damage logic is hardcoded in getChargeBonus (activeTechnologies.has).',
    update: {
      effects: [{
        property: 'meleeAttack',
        select: { id: ['earls-guard'] },
        effect: 'change',
        value: 0,
        type: 'passive',
      }],
    },
  },

  {
    id: 'burgundian-imports',
    reason: 'Raw effect is empty.',
    update: {
      effects: [
        {
          property: 'costReduction',
          select: { id: ['handcannoneer'] },
          effect: 'multiply',
          value: 0.75,
          type: 'passive',
        }
      ]
    }
  },

  {
    id: 'hill-training',
    reason: 'Raw effects empty. Grants hobelar charge damage = 125% of primary weapon damage via chargeMultiplier.',
    update: {
      effects: [{
        property: 'chargeMultiplier',
        select: { id: ['hobelar'] },
        effect: 'change',
        value: 1.25,
        type: 'passive',
      }],
    },
  },

  {
    id: 'ships-of-the-crown',
    reason: 'Raw effects missing select (tech hidden) and use wrong effect type (change→multiply). Corrected: siegeAttack ×1.2, hitpoints ×1.15, maxRange +0.9 (+10% of base 9).',
    update: {
      effects: [
        {
          property: 'siegeAttack',
          select: { id: ['carrack'] },
          effect: 'multiply',
          value: 1.2,
          type: 'passive',
        },
        {
          property: 'hitpoints',
          select: { id: ['carrack'] },
          effect: 'multiply',
          value: 1.15,
          type: 'passive',
        },
        {
          property: 'maxRange',
          select: { id: ['carrack'] },
          effect: 'multiply',
          value: 1.09,
          type: 'passive',
        },
      ],
    },
  },

  {
    id: 'warwolf-trebuchet',
    reason: 'Raw effect has no select (tech hidden) and wrong effect type (change→multiply for HP). Adding select + missing +2 range effect.',
    update: {
      effects: [
        {
          property: 'hitpoints',
          select: { id: ['counterweight-trebuchet'] },
          effect: 'multiply',
          value: 1.5,
          type: 'passive',
        },
        {
          property: 'maxRange',
          select: { id: ['counterweight-trebuchet'] },
          effect: 'change',
          value: 2,
          type: 'passive',
        },
      ],
    },
  },

  {
    id: 'collar-of-esses',
    reason: 'Raw effects empty. +5 bonus damage vs heavy for demilancer.',
    update: {
      effects: [{
        property: 'meleeAttack',
        select: { id: ['demilancer', 'knight'] },
        effect: 'change',
        value: 5,
        type: 'bonus',
        target: { class: [['heavy']] },
      }],
    },
  },
  //___________
  //
  // JAPANESE
  //
  //___________

  {
    id: 'upgrade-shinobi-3',
    reason: 'Castle Age Shinobi scaling stats baked into the age-3 variation of shinobi (units.ts patch). Tech excluded so age selection drives the correct stats.',
    excludedUnits: ['shinobi'],
  },
  {
    id: 'upgrade-shinobi-4',
    reason: 'Imperial Age Shinobi scaling stats baked into the age-4 variation of shinobi (units.ts patch). Tech excluded so age selection drives the correct stats.',
    excludedUnits: ['shinobi'],
  },

  {
    id: 'copper-plating',
    reason: 'Raw uses multiply 1.02 (wrong). Corrected to change +2 for fire and ranged armor on ships.',
    update: {
      effects: [
        {
          property: 'fireArmor',
          select: { class: [['ship'], ['warship']] },
          effect: 'change',
          value: 2,
          type: 'passive',
        },
        {
          property: 'rangedArmor',
          select: { class: [['ship'], ['warship']] },
          effect: 'change',
          value: 2,
          type: 'passive',
        },
      ],
    },
  },

  {
    id: 'odachi',
    reason: 'Raw effect type is passive (flat +4 melee attack). Corrected to bonus vs infantry only. katana-bannerman excluded.',
    update: {
      effects: [{
        property: 'meleeAttack',
        select: { id: ['samurai'] },
        effect: 'change',
        value: 4,
        type: 'bonus',
        target: { class: [['infantry']] },
      }],
    },
    excludedUnits: ['katana-bannerman'],
  },

  {
    id: 'do-maru-armor',
    reason: 'Effect changed in techAbilityInteractions.',
    update: {
      effects: [
        { property: 'moveSpeed', select: { id: ['mounted-samurai'] }, effect: 'multiply', value: 1, type: 'ability' },
      ],
    },
  },

  {
    id: 'kabura-ya-whistling-arrow',
    reason: 'No UI value, covered by ability.',
    after: (tech) => ({
      ...tech,
      effects: [],
      variations: tech.variations.map((v: any) => ({ ...v, effects: [] })),
    })
  },

  {
    id: 'daimyo-manor',
    reason: 'No UI value, covered by ability.',
    after: (tech) => ({
      ...tech,
      effects: [],
      variations: tech.variations.map((v: any) => ({ ...v, effects: [] })),
    })
  },

  {
    id: 'daimyo-palace',
    reason: 'No UI value, covered by ability.',
    after: (tech) => ({
      ...tech,
      effects: [],
      variations: tech.variations.map((v: any) => ({ ...v, effects: [] })),
    })
  },

  {
    id: 'shogunate-castle',
    reason: 'No UI value, covered by ability.',
    after: (tech) => ({
      ...tech,
      effects: [],
      variations: tech.variations.map((v: any) => ({ ...v, effects: [] })),
    })
  },
  {
    id: 'tawara',
    reason: 'Raw effects empty. Villager move speed +7% (tier 1/3 of the Tawara/Takezaiku/Fudasashi line).',
    update: {
      effects: [{
        property: 'moveSpeed',
        select: { id: ['villager'] },
        effect: 'multiply',
        value: 1.07,
        type: 'passive',
      }],
      displayClasses: ['Villager Speed Technology 1/3'],
    },
  },

  {
    id: 'takezaiku',
    reason: 'Raw effects empty. Villager move speed +7% (tier 2/3 of the Tawara/Takezaiku/Fudasashi line). Selecting this tier also applies Tawara first.',
    update: {
      effects: [{
        property: 'moveSpeed',
        select: { id: ['villager'] },
        effect: 'multiply',
        value: 1.07,
        type: 'passive',
      }],
      displayClasses: ['Villager Speed Technology 2/3'],
    },
  },

  {
    id: 'fudasashi',
    reason: 'Raw effects empty. Villager move speed +7% (tier 3/3 of the Tawara/Takezaiku/Fudasashi line). Selecting this tier also applies Tawara and Takezaiku first.',
    update: {
      effects: [{
        property: 'moveSpeed',
        select: { id: ['villager'] },
        effect: 'multiply',
        value: 1.07,
        type: 'passive',
      }],
      displayClasses: ['Villager Speed Technology 3/3'],
    },
  },

  //_____________
  //
  // JEANNE D'ARC
  //
  //_____________


  {
    id: 'ordinance-company',
    reason: 'Raw effects empty. Dummy costReduction (value 1.0) to stay visible in isCombatTechnology. Real effect in techAbilityInteractions (requires ability-consecrate active): resets foodCostMultiplier and applies costMultiplier ×0.75, effectively changing consecrate\'s food-only reduction to an all-cost reduction.',
    update: {
      effects: [
        {
          property: 'meleeArmor',
          select: { id: ['annihilation_condition'] },
          effect: 'multiply',
          value: 1.0,
          type: 'passive',
        }
      ]
    }
  },

  {
    id: 'companion-equipment',
    reason: 'Raw data typo: meleeAttack effect targets "jeannes-companion" (does not exist) instead of "jeannes-champion". Fixed via after.',
    after: (tech) => ({
      ...tech,
      variations: tech.variations.map((v: any) => ({
        ...v,
        effects: (v.effects || []).map((e: any) =>
          e.select?.id?.includes('jeannes-companion')
            ? { ...e, select: { ...e.select, id: e.select.id.map((id: string) => id === 'jeannes-companion' ? 'jeannes-champion' : id) } }
            : e
        ),
      })),
    }),
  },


  //___________________
  //
  // KNIGHTS TEMPLAR
  //
  //___________________

  {
    id: 'desert-citadels',
    reason: 'Raw effects empty. Dummy value (1.0) to stay visible in isCombatTechnology. Real effect in techAbilityInteractions',
    update: {
      effects: [
        { property: 'meleeArmor', select: { class: [['annihilation_condition']] }, effect: 'multiply', value: 1, type: 'passive' },
        { property: 'rangedArmor', select: { class: [['annihilation_condition']] }, effect: 'multiply', value: 1, type: 'passive' },
      ]
    }
  },

  {
    id: 'fanaticism',
    reason: 'Variation effects have no select. Restricted to templar-brother and commanderie_unit. Bonus is conditional on HP % in-game — approximated as fixed ×1.1 here.',
    excludedUnits: ["venetian-galley"],
    after: (tech) => ({
      ...tech,
      variations: tech.variations.map(v => ({
        ...v,
        effects: (v.effects || []).map((e: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
          ...e,
          select: { id: ['templar-brother'], class: [['commanderie_unit']] }
        }))
      }))
    }),
    uiTooltip: "Approximation: ×1.1 applied permanently. In-game: ×1.1 below 50% HP, ×1.3 below 25% HP."
  },

  {
    id: 'principality-of-antioch',
    reason: 'Raw variation effects have no select. Restricted to annihilation-condition class.',
    excludedUnits: ["hospitaller-knight", "chevalier-confrere"],
    after: (tech) => ({
      ...tech,
      minAge: 2,
      unique: true,
      variations: tech.variations.map(v => ({
        ...v,
        effects: (v.effects || []).map((e: any) => ({
          ...e,
          select: { id: ['melee'] }
        }))
      }))
    })
  },

  {
    id: 'kingdom-of-france',
    reason: 'Raw variation effects have no select. Restricted to annihilation-condition class.',
    excludedUnits: ["hospitaller-knight", "serjeant"],
    update: {
      minAge: 2,
      unique: true,
      effects: [
        { property: 'goldCostReduction', select: { class: [['heavy', 'military']], id: ["condottiero", "crossbowman", "counterweight-trebuchet", "mangonel", "springald"] }, effect: 'multiply', value: 0.95, type: 'passive' },
      ]
    }
  },

  {
    id: 'kingdom-of-castile',
    excludedUnits: ['heavy-spearman', 'genoese-crossbowman'],
    reason: 'Raw variation effects have no select. Restricted to annihilation-condition class.',
    update: {
      minAge: 3,
      unique: true,
      effects: [
        { property: 'meleeAttack', select: { class: [['human', 'military']] }, effect: 'multiply', value: 1.2, type: 'passive' },
        { property: 'rangedAttack', select: { class: [['human', 'military']] }, effect: 'multiply', value: 1.2, type: 'passive' },
        { property: 'healingRate', select: { class: [['human', 'military']] }, effect: 'change', value: 1, type: 'passive' },
      ]
    }
  },

  {
    id: 'angevin-empire',
    reason: 'Raw variation effects have no select. Restricted to annihilation-condition class. Also manage Angevin Durability Ability.',
    update: {
      description: "Fortresses and Docks gain +30% Health. Increasesf the damage and hit points of Heavy Spearmen within desert citadels range.",
      minAge: 3,
      unique: true,
      effects: [
        { property: 'meleeAttack', select: { id: ['heavy-spearman'] }, effect: 'multiply', value: 1.2, type: 'passive' },
        { property: 'hitpoints', select: { id: ['heavy-spearman'] }, effect: 'multiply', value: 1.2, type: 'passive' },
      ]
    }
  },

  {
    id: 'teutonic-order',
    excludedUnits: ["szlachta-cavalry"],
    reason: 'Raw variation effects have no select.',
    update: {
      minAge: 4,
      unique: true,
      effects: [
        { property: 'meleeArmor', select: { class: [['human', 'heavy']], id: ["crossbowman", "monk"] }, effect: 'change', value: 2, type: 'passive' },
      ]
    }
  },

  {
    id: 'kingdom-of-poland',
    reason: 'Raw variation has no effect.',
    after: (tech) => ({
      ...tech,
      minAge: 4,
      unique: true,
      variations: tech.variations.map(v => ({
        ...v,
        effects: [
          { property: 'hitpoints', select: { class: [["cavalry"]] }, effect: 'multiply', value: 1.1, type: 'passive' },
          { property: 'chargeMultiplier', select: { class: [["cavalry"]] }, effect: 'change', value: 0.5, type: 'passive' },
        ],
      }))
    })
  },

  {
    id: 'cranequins',
    reason: 'Raw variation effects have no select. Restricted to crossbowman unitId.',
    after: (tech) => ({
      ...tech,
      minAge: 4,
      unique: true,
      variations: tech.variations.map(v => ({
        ...v,
        effects: [
          ...(v.effects || []).map((e: any) => ({
            ...e,
            select: { id: ['crossbowman'] },
          })),
          { property: 'maxRange', effect: 'change', value: 0.5, type: 'passive', select: { id: ['crossbowman'] } },
        ],
      }))
    })
  },

  {
    id: 'brigandine',
    reason: 'Raw variation has no effect.',
    after: (tech) => ({
      ...tech,
      minAge: 4,
      unique: true,
      variations: tech.variations.map(v => ({
        ...v,
        effects: [
          { property: 'meleeArmor', select: { id: ["horseman", "genitour"] }, effect: 'change', value: 2, type: 'passive' },
          { property: 'rangedArmor', select: { id: ["horseman", "genitour"] }, effect: 'change', value: 2, type: 'passive' },
        ],
      }))
    })
  },

  {
    id: 'counterweight-defenses',
    reason: 'Raw variation has no effect.',
    after: (tech) => ({
      ...tech,
      minAge: 4,
      unique: true,
      variations: tech.variations.map(v => ({
        ...v,
        effects: [
          { property: 'burst', select: { id: ["counterweight-trebuchet", "venetian-galley"] }, effect: 'change', value: 1, type: 'passive' },
        ],
      }))
    })
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
    reason: "Converted to ability-local-knowledge (duration-based). Tech hidden.",
    after: (tech) => ({
      ...tech,
      effects: [],
      variations: tech.variations.map(v => ({ ...v, effects: [] }))
    }),
    excludedUnits: ['musofadi-warrior', 'musofadi-gunner'],
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
    after: (tech) => ({
      ...tech,
      civs: [...tech.civs, 'by'],
      variations: tech.variations.map(v => ({
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
    after: (tech) => ({
      ...tech,
      civs: [...tech.civs, 'by'],
      variations: tech.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"]
      }))
    }),
    foreignEngineering: true,
    foreignEngineeringUnits: ['horse-archer'],
    uiTooltip: "Available only with Foreign Engineering Company",
  },

  {
    id: "fervor",
    reason: 'Make it null to able interaction with Saints Blessing ability.',
    after: (tech) => ({
      ...tech,
      variations: tech.variations.map(v => ({
        ...v, effects: [
          { property: 'meleeAttack', select: { class: [["land", "military"]], excludeId: ['warrior-monk'] }, effect: 'multiply', value: 1, type: 'passive' },
          { property: 'rangedAttack', select: { class: [["land", "military"]], excludeId: ['warrior-monk'] }, effect: 'multiply', value: 1, type: 'passive' },
          { property: 'siegeAttack', select: { class: [["land", "military"]], excludeId: ['warrior-monk'] }, effect: 'multiply', value: 1, type: 'passive' }
        ]
      }))
    }),
  },

  {
    id: 'upgrade-miltia-3',
    reason: 'No UI value, age up covered automatically.',
    after: (tech) => ({
      ...tech,
      effects: [],
      variations: tech.variations.map((v: any) => ({ ...v, effects: [] })),
    })
  },

  {
    id: 'upgrade-militia-4',
    reason: 'No UI value, age up covered automatically.',
    after: (tech) => ({
      ...tech,
      effects: [],
      variations: tech.variations.map((v: any) => ({ ...v, effects: [] })),
    })
  },

  {
    id: "siege-crew-training",
    reason: "Useless for UI",
    after: (tech) => ({
      ...tech,
      effects: [],
      variations: tech.variations.map((v: any) => ({ ...v, effects: [] })),
    })
  },

  {
    id: "fine-tuned-guns",
    reason: "Raw data uses multiply 0.8 and multiply 0.7 — corrected to multiply 1.2 (+20%) and change +50 vs infantry.",
    after: (tech) => ({
      ...tech,
      variations: tech.variations.map((v: any) => ({
        ...v,
        effects: [
          {
            property: "siegeAttack",
            select: { id: ["bombard"] },
            effect: "multiply",
            value: 1.2,
            type: "passive"
          },
          {
            property: "siegeAttack",
            select: { id: ["bombard"] },
            target: { class: [["infantry"]] },
            effect: "change",
            value: 50,
            type: "bonus"
          }
        ]
      }))
    })
  },

  //_____________________
  //
  // MACEDONIAN DYNASTY
  //
  //_____________________


  // 6-stack counter line for melee infantry (mac). Each stack: +1 meleeArmor, +1 rangedArmor, ×1.05 HP.
  // counterMax on tier1 signals TechnologySelector to render the whole line as a counter widget.
  // Max available at runtime is age-limited: 2 stacks at age II, 4 at age III, 6 at age IV.
  ...(['butted-chainmail-tier1', 'butted-chainmail-tier2', 'butted-chainmail-tier3',
    'butted-chainmail-tier4', 'butted-chainmail-tier5', 'butted-chainmail-tier6'] as const).map((id, i) => ({
      id,
      reason: `Raw effects empty. Tier ${i + 1}/6: +1 meleeArmor, +1 rangedArmor, ×1.05 HP for melee infantry.${i === 0 ? ' counterMax on tier1 signals counter widget rendering.' : ''}`,
      update: {
        displayClasses: [`Butted Chainmail ${i + 1}/6`],
        counterMax: i === 0 ? 6 : undefined,
        effects: [
          { property: 'meleeArmor', select: { class: [['melee', 'infantry']] }, effect: 'change', value: 1, type: 'passive' },
          { property: 'rangedArmor', select: { class: [['melee', 'infantry']] }, effect: 'change', value: 1, type: 'passive' },
          { property: 'hitpoints', select: { class: [['melee', 'infantry']] }, effect: 'multiply', value: 1.05, type: 'passive' },
        ] as any
      }
    })),

  ...(['lamellar-armor-tier1', 'lamellar-armor-tier2', 'lamellar-armor-tier3',
    'lamellar-armor-tier4', 'lamellar-armor-tier5', 'lamellar-armor-tier6'] as const).map((id, i) => ({
      id,
      reason: `Raw effects empty. Tier ${i + 1}/6: +1 meleeArmor, +1 rangedArmor, ×1.05 HP for ranged infantry.${i === 0 ? ' counterMax on tier1 signals counter widget rendering.' : ''}`,
      update: {
        displayClasses: [`Lamellar Armor ${i + 1}/6`],
        counterMax: i === 0 ? 6 : undefined,
        effects: [
          { property: 'meleeArmor', select: { class: [['ranged', 'infantry']] }, effect: 'change', value: 1, type: 'passive' },
          { property: 'rangedArmor', select: { class: [['ranged', 'infantry']] }, effect: 'change', value: 1, type: 'passive' },
          { property: 'hitpoints', select: { class: [['ranged', 'infantry']] }, effect: 'multiply', value: 1.05, type: 'passive' },
        ] as any
      }
    })),

  ...(['scale-barding-tier1', 'scale-barding-tier2', 'scale-barding-tier3',
    'scale-barding-tier4', 'scale-barding-tier5', 'scale-barding-tier6'] as const).map((id, i) => ({
      id,
      reason: `Raw effects empty. Tier ${i + 1}/6: +1 meleeArmor, +1 rangedArmor, ×1.05 HP for cavalry.${i === 0 ? ' counterMax on tier1 signals counter widget rendering.' : ''}`,
      update: {
        displayClasses: [`Scale Barding ${i + 1}/6`],
        counterMax: i === 0 ? 6 : undefined,
        effects: [
          { property: 'meleeArmor', select: { class: [['cavalry']] }, effect: 'change', value: 1, type: 'passive' },
          { property: 'rangedArmor', select: { class: [['cavalry']] }, effect: 'change', value: 1, type: 'passive' },
          { property: 'hitpoints', select: { class: [['cavalry']] }, effect: 'multiply', value: 1.05, type: 'passive' },
        ] as any
      }
    })),

  ...(['pattern-welding-tier1', 'pattern-welding-tier2', 'pattern-welding-tier3',
    'pattern-welding-tier4', 'pattern-welding-tier5', 'pattern-welding-tier6'] as const).map((id, i) => ({
      id,
      reason: `Raw effects empty. Tier ${i + 1}/6: +1 meeleAttack.${i === 0 ? ' counterMax on tier1 signals counter widget rendering.' : ''}`,
      update: {
        displayClasses: [`Pattern Welding ${i + 1}/6`],
        counterMax: i === 0 ? 6 : undefined,
        effects: [
          { property: 'meleeAttack', select: { class: [['melee', 'infantry']] }, effect: 'change', value: 1, type: 'passive' },
        ] as any
      }
    })),

  ...(['sharpening-stones-tier1', 'sharpening-stones-tier2', 'sharpening-stones-tier3',
    'sharpening-stones-tier4', 'sharpening-stones-tier5', 'sharpening-stones-tier6'] as const).map((id, i) => ({
      id,
      reason: `Raw effects empty. Tier ${i + 1}/6: +1 meeleAttack.${i === 0 ? ' counterMax on tier1 signals counter widget rendering.' : ''}`,
      update: {
        displayClasses: [`Sharpening Stones ${i + 1}/6`],
        counterMax: i === 0 ? 6 : undefined,
        effects: [
          { property: 'rangedAttack', select: { class: [['ranged', 'infantry']], id: ['galley', 'dromon'] }, effect: 'change', value: 1, type: 'passive' },
          { property: 'siegeAttack', select: { id: ['dromon'] }, effect: 'change', value: 1, type: 'passive' },
        ] as any
      }
    })),

  ...(['blade-inlaying-tier1', 'blade-inlaying-tier2', 'blade-inlaying-tier3',
    'blade-inlaying-tier4', 'blade-inlaying-tier5', 'blade-inlaying-tier6'] as const).map((id, i) => ({
      id,
      reason: `Raw effects empty. Tier ${i + 1}/6: +1 meeleAttack.${i === 0 ? ' counterMax on tier1 signals counter widget rendering.' : ''}`,
      update: {
        displayClasses: [`Blade Inlaying ${i + 1}/6`],
        counterMax: i === 0 ? 6 : undefined,
        effects: [
          { property: 'meleeAttack', select: { class: [['cavalry']] }, effect: 'change', value: 1, type: 'passive' },
        ] as any
      }
    })),

  ...(['iron-fittings-tier1', 'iron-fittings-tier2', 'iron-fittings-tier3',
    'iron-fittings-tier4', 'iron-fittings-tier5', 'iron-fittings-tier6'] as const).map((id, i) => ({
      id,
      reason: `Raw effects empty. Tier ${i + 1}/6: ×1.05 HP for cavalry.${i === 0 ? ' counterMax on tier1 signals counter widget rendering.' : ''}`,
      update: {
        displayClasses: [`Iron Fittings ${i + 1}/6`],
        counterMax: i === 0 ? 6 : undefined,
        effects: [
          { property: 'hitpoints', select: { class: [['siege_range']], id: ['cheirosiphon'] }, effect: 'multiply', value: 1.05, type: 'passive' },
        ] as any
      }
    })),

  {
    id: 'ruinous-blinding',
    reason: 'Raw effects empty. Models −20% damage debuff on any opponent hit by Bogmaðr for 5s.',
    update: {
      effects: [
        { property: 'versusOpponentDamageDebuff', select: { id: ['bogmadr'] }, effect: 'multiply', value: 0.8, type: 'passive', duration: 5 },
      ] as any
    }
  },

  {
    id: 'rhomphaia',
    reason: 'Raw effects empty. +3 bonus melee damage vs infantry for Varangian Guard.',
    update: {
      effects: [
        { property: 'meleeAttack', select: { id: ['varangian-guard', 'riddari', 'hippodrome-riddari'] }, effect: 'change', value: 3, type: 'bonus', target: { class: [['infantry']] } },
      ] as any
    }
  },

  {
    id: 'prolonged-siege',
    reason: 'Replaced by ability-prolonged-siege counter ability in AbilitySelector.',
    after: (tech: any) => ({ ...tech, effects: [], variations: tech.variations.map((v: any) => ({ ...v, effects: [] })) })
  },

  {
    id: 'roman-fire',
    reason: 'Raw effects empty. Springalds gain 15% attack speed (cycle ×1/1.15).',
    update: {
      effects: [
        { property: 'attackSpeed', select: { id: ['springald'] }, effect: 'multiply', value: 1 / 1.15, type: 'passive' },
      ] as any
    }
  },

  //___________
  //
  // MALIAN
  //
  //___________

  {
    id: 'farima-leadership',
    reason: 'Converted to ability (ability-farima-leadership). Clear tech effects to avoid double-application.',
    after: (tech) => ({ ...tech, effects: [], variations: tech.variations.map(v => ({ ...v, effects: [] })) }),
  },

  {
    id: 'canoe-tactics',
    reason: 'Bonus target corrected from [incendiary,ship] to [naval,fireship]. Secondary weapon: hunting-canoe bow ×(4/6) damage, burst 2.',
    after: (tech) => ({
      ...tech,
      variations: tech.variations.map(v => ({
        ...v,
        effects: v.effects.map(e =>
          e.type === 'bonus' && (e.target?.class ?? []).some(c => c.includes('incendiary'))
            ? { ...e, target: { class: [['naval', 'fireship']] } }
            : e
        ),
      })),
    }),
    injectWeapon: { unitId: 'hunting-canoe', weaponIndex: 0, damageMultiplier: 4 / 6, burstCount: 2 },
  },


];

//__________________
//
// HOLY ROMAN EMPIRE
//
//__________________


function createBurgravePalaceAgeUp(): Technology {
  return {
    id: 'burgrave-palace-age-up',
    name: 'Burgrave Palace',
    type: 'technology',
    civs: ['hr'],
    classes: ['age_up_upgrade'],
    displayClasses: [],
    minAge: 3,
    icon: 'https://data.aoe4world.com/images/buildings/burgrave-palace-2.png',
    description: 'Infantry gain +50% charge damage.',
    unique: true,
    effects: [
      {
        property: 'chargeMultiplier',
        select: { class: [['melee_infantry']] },
        effect: 'change',
        value: 0.5,
        type: 'passive'
      }
    ] as TechnologyEffect[],
    variations: [
      {
        id: 'burgrave-palace-age-up-3',
        baseId: 'burgrave-palace-age-up',
        pbgid: 0,
        attribName: '',
        civs: ['hr'],
        costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
        effects: [] as TechnologyEffect[],
      }
    ],
    shared: {}
  } as Technology;
}

function createCrusaderFleets(): Technology {
  return {
    id: 'crusader-fleets',
    name: 'Crusader Fleets',
    type: 'technology',
    civs: ['kt'],
    classes: [],
    displayClasses: [],
    minAge: 4,
    icon: 'public/technologies/crusader-fleets.png',
    description: 'It increases the range and attack of the springald ships by +1.5 and +25% respectively.',
    unique: true,
    effects: [
      {
        property: 'maxRange',
        select: { id: ['hulk'] },
        effect: 'change',
        value: 1.5,
        type: 'passive'
      },
      {
        property: 'rangedAttack',
        select: { id: ['hulk'] },
        effect: 'multiply',
        value: 1.25,
        type: 'passive'
      }
    ] as TechnologyEffect[],
    variations: [
      {
        id: 'crusader-fleets-4',
        baseId: 'crusader-fleets',
        pbgid: 58852,
        attribName: '',
        civs: ['kt'],
        costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
        effects: [] as TechnologyEffect[],
      }
    ],
    shared: {}
  } as Technology;
}

//__________________
//
// MALIAN
//
//__________________

function createEnlistMansaMusofadi(): Technology {
  return {
    id: 'enlist-mansa-musofadi',
    name: 'Enlist Mansa Musofadi',
    type: 'technology',
    civs: ['ma'],
    classes: [],
    displayClasses: [],
    minAge: 3,
    icon: 'public/abilities/AoE4_EnlistMansaMusofadi.png',
    description: 'Musofadi Warriors gain +1 melee attack, +10 HP, and +4/+5/+6 melee armor (age II/III/IV).',
    unique: true,
    effects: [
      {
        property: 'meleeAttack',
        select: { id: ['musofadi-warrior'] },
        effect: 'change',
        value: 1,
        type: 'passive',
      },
      {
        property: 'hitpoints',
        select: { id: ['musofadi-warrior'] },
        effect: 'change',
        value: 10,
        type: 'passive',
      },
      {
        property: 'meleeArmor',
        select: { id: ['musofadi-warrior'] },
        effect: 'change',
        value: 4,
        type: 'passive',
      },
    ] as TechnologyEffect[],
    variations: [
      {
        id: 'enlist-mansa-musofadi-3',
        baseId: 'enlist-mansa-musofadi',
        pbgid: 0,
        attribName: '',
        civs: ['ma'],
        costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
        effects: [] as TechnologyEffect[],
      }
    ],
    shared: {}
  } as Technology;
}

function createEnlistMansaJavelineers(): Technology {
  return {
    id: 'enlist-mansa-javelineers',
    name: 'Enlist Mansa Javelineers',
    type: 'technology',
    civs: ['ma'],
    classes: [],
    displayClasses: [],
    minAge: 3,
    icon: 'public/technologies/AoE4_EnlistMansaJavelineers.png',
    description: 'This increases their speed by ~5% (up to 1.31) and grants them poison tipped javelins that inflict a poison effect of 3 damage over 6 seconds.',
    unique: true,
    effects: [
      {
        property: 'moveSpeed',
        select: { id: ['javelin-thrower'] },
        effect: 'multiply',
        value: 1.05,
        type: 'passive',
      },
      {
        property: 'rangedAttack',
        select: { id: ['javelin-thrower'] },
        effect: 'change',
        value: 3,
        type: 'passive',
      },
    ] as TechnologyEffect[],
    variations: [
      {
        id: 'enlist-mansa-javelineers-3',
        baseId: 'enlist-mansa-javelineers',
        pbgid: 0,
        attribName: '',
        civs: ['ma'],
        costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
        effects: [] as TechnologyEffect[],
      }
    ],
    shared: {}
  } as Technology;
}

// Maps tech ID → { unitId, weaponIndex, damageMultiplier?, burstCount? } for secondary weapon injection
export const weaponInjectionMap: Map<string, { unitId: string; weaponIndex: number; damageMultiplier?: number; burstCount?: number; maxDamage?: number }> = new Map(
  technologyPatches
    .filter(p => p.injectWeapon)
    .map(p => [p.id, {
      unitId: p.injectWeapon!.unitId,
      weaponIndex: p.injectWeapon!.weaponIndex ?? 0,
      damageMultiplier: p.injectWeapon!.damageMultiplier,
      burstCount: p.injectWeapon!.burstCount,
      maxDamage: p.injectWeapon!.maxDamage,
    }])
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

  const allWithSynthetic = [
    ...allTechs,
    createBurgravePalaceAgeUp(),
    createCrusaderFleets(),
    createEnlistMansaMusofadi(),
    createEnlistMansaJavelineers(),
  ];

  return allWithSynthetic.map((tech) => {
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
