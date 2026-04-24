import { TechnologyPatch, deepMerge } from "./types";
import { Ability, AbilityVariation } from "../unified-abilities";
import type { UnitStats } from "../unified-technologies";

export interface TechAbilityInteraction {
  requiredTech: string;
  requiredAbility: string;
  unitId?: string; // if omitted, applies to any unit
  apply: (stats: UnitStats) => UnitStats;
}

export const techAbilityInteractions: TechAbilityInteraction[] = [
  {
    requiredTech: 'ferocious-speed',
    requiredAbility: 'ability-berserking',
    unitId: 'varangian-guard',
    apply: (stats) => ({ ...stats, moveSpeed: stats.moveSpeed * 1.3 }),
  },
  {
    requiredTech: "cantled-saddles",
    requiredAbility: "ability-royal-knight-charge-damage",
    unitId: "royal-knight",
    apply: (stats) => ({ ...stats, meleeAttack: stats.meleeAttack + 7 }),
  },
  {
    requiredTech: 'enlistment-incentives',
    requiredAbility: 'ability-keep-influence',
    apply: (stats) => ({ ...stats, costMultiplier: (stats.costMultiplier ?? 1) * 0.95 }),
  },

  {
    requiredTech: 'do-maru-armor',
    requiredAbility: 'ability-deflective-armor',
    apply: (stats) => ({ ...stats, moveSpeed: stats.moveSpeed * 1.1 })
  }
];

//_________________
//
// ABBASID DYNASTY
//
//_________________

export const abilityPatches: TechnologyPatch<Ability, AbilityVariation>[] = [
  {
    id: 'ability-quick-strike',
    reason: 'Quick Strike (Ghulam): deals two attacks in rapid succession. Effective cycle = (base + 0.5) × 0.5. Base speed 1.125s → 1.625s → 0.8125s. Applied as top-level effects so combat.ts can apply them via applyAbilityWeaponEffects.',
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
      ],
    },
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
    id: 'ability-camel-unease',
    reason: 'Synthetic gameplay rule: aoe4world does not model the Camel Unease debuff. In-game, camel units passively reduce the attack of nearby horse cavalry by 20%. Modelled here as a versusOpponentDamageDebuff effect (×0.8). Marked active:always so it auto-activates on unit select.',
    update: {
      active: 'always',
      effects: [
        {
          property: 'versusOpponentDamageDebuff',
          select: {
            id: [
              'camel-archer',
              'camel-rider',
              'camel-lancer',
              'desert-raider',
              'atabeg',
              'dervish',
              'trade-caravan',
              'camel'
            ],
            class: [['cavalry', 'horse']]
          },
          effect: 'multiply',
          value: 0.8,
          type: 'ability'
        }
      ]
    },
    after: (tech) => ({
      ...tech,
      civs: [...tech.civs, 'by'],
      variations: tech.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"]
      }))
    }),
  },

  //_________
  //
  // AYYUBIDS
  //
  //_________

  {
    id: 'ability-golden-age-tier-4',
    reason: 'Ayyubid Golden Age Tier 4: siege units cost 20% less. Property "unknown" mapped to "costReduction". minAge fixed from 5 to 4 (no Age V exists).',
    after: (ability: Ability) => ({
      ...ability,
      minAge: 1,
      effects: [
        {
          property: 'costReduction',
          select: { class: [['siege']] },
          effect: 'multiply',
          value: 0.8,
          type: 'ability'
        }
      ],
      variations: ability.variations.map((v: AbilityVariation) => ({
        ...v,
        active: 'manual'
      }))
    })
  },
  {
    id: 'ability-golden-age-tier-5',
    reason: 'Ayyubid Golden Age Tier 5: camel units attack 20% faster. Property "unknown" mapped to "attackSpeed". minAge fixed from 5 to 4 (no Age V exists).',
    after: (ability: Ability) => ({
      ...ability,
      minAge: 1,
      effects: [
        {
          property: 'attackSpeed',
          select: { id: ['camel-lancer', 'desert-raider'] },
          effect: 'multiply',
          value: 1 / 1.23,
          type: 'ability'
        }
      ],
      variations: ability.variations.map((v: AbilityVariation) => ({
        ...v,
        active: 'manual'
      }))
    }),
    uiTooltip: "In reality, it's a 22% attack speed bonus."
  },
  {
    id: 'ability-atabeg-supervision',
    reason: 'Atabeg Supervision: an Atabeg gives +20% HP to nearby land military units it supervises. Raw data has property:unknown targeting only atabeg itself (aoe4world does not model this buff). Patched to property:hitpoints ×1.2 targeting land_military class. Available for Ayyubid (civs:[ay]) only.',
    after: (ability: Ability) => ({
      ...ability,
      minAge: 2,
      effects: [
        {
          property: 'hitpoints',
          select: { class: [['land_military']] },
          effect: 'multiply',
          value: 1.2,
          type: 'ability'
        }
      ]
    })
  },
  {
    id: 'ability-tactical-charge',
    reason: 'Not considered now. The usual knight charge is considered',
    after: (ability: Ability) => ({ ...ability, hidden: true })
  },
  {
    id: 'ability-conversion',
    reason: 'UI-only: Conversion is a monk ability that has no direct impact on unit combat stats. Hidden to avoid confusion in the ability selector.',
    after: (ability: Ability) => ({ ...ability, hidden: true })
  },
  {
    id: 'ability-proselytize',
    reason: 'UI-only: Proselytize is a monk ability that has no direct impact on unit combat stats. Hidden to avoid confusion in the ability selector.',
    after: (ability: Ability) => ({ ...ability, hidden: true })
  },

  {
    id: "ability-desert-raider-blade",
    reason: 'Available for Byzantines after building Foreign Engineering Company. Duration is not yet considered.',
    after: (abilities) => ({
      ...abilities,
      civs: [...abilities.civs, 'by'],
      variations: abilities.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"]
      }))
    }),
  },

  {
    id: "ability-desert-raider-bow",
    reason: 'Available for Byzantines after building Foreign Engineering Company. Duration is not yet considered.',
    after: (abilities) => ({
      ...abilities,
      civs: [...abilities.civs, 'by'],
      variations: abilities.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"]
      }))
    }),
  },


  //___________
  //
  // Byzantines
  //
  //___________

  {
    id: 'ability-shield-wall',
    reason: 'Raw variation effects are wrong: moveSpeed change+25 (would be +25%, should be ×0.75 = −25%), attackSpeed change+30 (adds 30s to cycle, should be ×0.75 = 25% faster), rangedArmor change+30 (adds armor, should be 30% ranged damage resistance). Rewritten to: moveSpeed ×0.75, attackSpeed ×0.75, rangedResistance +30.',
    after: (ability: Ability) => ({
      ...ability,
      variations: ability.variations.map((v: AbilityVariation) => ({
        ...v,
        effects: [
          { property: 'moveSpeed', select: { id: ['limitanei'] }, effect: 'multiply', value: 0.75, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['limitanei'] }, effect: 'multiply', value: 1.25, type: 'ability' },
          { property: 'rangedResistance', select: { id: ['limitanei'] }, effect: 'change', value: 30, type: 'ability' },
        ]
      }))
    })
  },
  {
    id: "ability-berserking",
    reason: 'Raw value was +30 (wrong), correct value is +6.',
    after: (ability) => ({
      ...ability,
      variations: ability.variations.map(v => ({
        ...v,
        effects: [
          { property: 'meleeAttack', select: { id: ["varangian-guard"] }, effect: 'change', value: 6, type: 'ability' },
          { property: 'meleeArmor', select: { id: ["varangian-guard"] }, effect: 'change', value: -4, type: 'ability' },
          { property: 'rangedArmor', select: { id: ["varangian-guard"] }, effect: 'change', value: -4, type: 'ability' },
        ]
      }))
    })
  },
  {
    id: "ability-trample",
    reason: 'Trample is a charge-style ability — +12 bonus on first hit only (handled by getChargeBonus in Sandbox.tsx). Raw meleeAttack +12 zeroed in variations to avoid permanent buff. Speed boost +25% on variations (update.effects alone is ignored by getActiveAbilityVariations).',
    after: (ability: Ability) => ({
      ...ability,
      variations: ability.variations.map((v: AbilityVariation) => ({
        ...v,
        effects: [
          {
            property: 'moveSpeed',
            select: { id: ['cataphract'] },
            effect: 'multiply',
            value: 1.25,
            type: 'ability',
          }
        ]
      }))
    })
  },
  {
    id: "ability-triumph",
    reason: "Duration is not yet considered.",
    uiTooltip: "Duration is not yet considered.",
    after: (ability: Ability) => ({
      ...ability,
      variations: ability.variations.map((v: AbilityVariation) => ({
        ...v,
        effects: [
          ...v.effects.filter((e: any) => e.property !== 'moveSpeed'),
          {
            property: 'rangedAttack',
            select: { class: [['cavalry']] },
            effect: 'change',
            value: 4,
            type: 'ability',
          },
          {
            property: 'moveSpeed',
            select: { class: [['cavalry']] },
            effect: 'multiply',
            value: 1.1,
            type: 'ability',
          }
        ]
      }))
    })
  },

  {
    id: "ability-irrigated",
    reason: "UI-only: Conversion is a monk ability that has no direct impact on unit combat stats. Hidden to avoid confusion in the ability selector.",
    after: (ability: Ability) => ({ ...ability, hidden: true }),
  },

  {
    id: "ability-oil-commerce",
    reason: "UI-only: Useless, hidden to avoid confusion in the ability selector.",
    after: (ability: Ability) => ({ ...ability, hidden: true }),
  },

  {
    id: "ability-field-stones",
    reason: "UI-only: Useless, hidden to avoid confusion in the ability selector.",
    after: (ability: Ability) => ({ ...ability, hidden: true }),
  },

  {
    id: "ability-synergistic-crops",
    reason: "UI-only: Useless, hidden to avoid confusion in the ability selector.",
    after: (ability: Ability) => ({ ...ability, hidden: true }),
  },

  {
    id: "ability-akritoi-defense",
    reason: "Must be implemented for all ages.",
    uiTooltip: "Not yet implemented for all ages",
  },

  //___________
  //
  // CHINESE
  //
  //___________

  {
    id: "ability-the-long-wall",
    reason: "Change active always to manual.",
    after: (ability: Ability) => ({
      ...ability,
      variations: ability.variations.map((v: AbilityVariation) => ({
        ...v,
        active: 'manual'
      }))
    })
  },

  {
    id: "ability-spirit-way",
    reason: "The effect is missing from the aoe4data file. Since the 20% attack speed bonus does not match the in-game UI, each value has been hard-coded.",
    after: (ability: Ability) => ({
      ...ability,
      variations: ability.variations.map((v: AbilityVariation) => ({
        ...v,
        effects: [
          // Fire Lancer (melee): 1.625 → 1.31 observed
          { property: "attackSpeed", select: { id: ["fire-lancer"] }, effect: "multiply", value: 1.31 / 1.625, type: "ability" },
          // Zhuge Nu (ranged): 1.75 → 1.58 observed
          { property: "attackSpeed", select: { id: ["zhuge-nu"] }, effect: "multiply", value: 1.58 / 1.75, type: "ability" },
          // Grenadier (siege): 1.625 → 1.38 observed
          { property: "attackSpeed", select: { id: ["grenadier"] }, effect: "multiply", value: 1.38 / 1.625, type: "ability" },
        ],
        active: "manual",
      }))
    }),
    uiTooltip: "Only the attackSpeed increase is implemented. Furthermore, the 20% bonus annonced is not correct. \n It's a 24% bonus for Fire lancer. 11% bonus for Zhuge Nu and 18% bonus for Grenadier.",
  },

  //___________
  //
  // DELHI SULTANATE
  //
  //___________

  {
    id: "ability-tower-of-victory-aura",
    reason: "Per-unit corrections hard-fixed from in-game measurements (no uniform model found). Average effective buff: −18.4% cycle (+18.4% AS).",
    after: (ability: Ability) => {
      const corrections = [
        { id: 'spearman', value: 1.620 * 1.2 / 1.875 },
        { id: 'man-at-arms', value: 1.120 * 1.2 / 1.375 },
        { id: 'archer', value: 1.370 * 1.2 / 1.625 },
        { id: 'crossbowman', value: 1.830 * 1.2 / 2.125 },
        { id: 'handcannoneer', value: 1.790 * 1.2 / 2.125 },
      ];
      return {
        ...ability,
        description: "Enables Tower of Victory, Mosques, and Madrasas to increase the attack speed of infantry by +20% when produced within their influence.",
        variations: ability.variations.map((v: AbilityVariation) => ({
          ...v,
          effects: [
            ...v.effects,
            ...corrections.map(c => ({
              property: 'attackSpeed',
              select: { id: [c.id] },
              effect: 'multiply',
              value: c.value,
              type: 'ability'
            }))
          ],
          active: "manual",
        }))
      };
    },
    uiTooltip: "The 20% attack speed buff varies per unit (+15.7% Spearman to +22.8% Man-at-Arms). Values hard-fixed from in-game measurements.",
  },

  //___________
  //
  // ENGLISH
  //
  //___________

  {
    id: "ability-arrow-volley",
    reason: 'Available for Byzantines after building Foreign Engineering Company. Duration is not yet considered. wynguard-ranger added to select.id so the ability appears for that unit.',
    after: (abilities) => ({
      ...abilities,
      civs: [...abilities.civs, 'by'],
      variations: abilities.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"],
        effects: (v.effects || []).map((e: any) =>
          e.select?.id?.includes('longbowman')
            ? { ...e, select: { ...e.select, id: [...e.select.id, 'wynguard-ranger'] } }
            : e
        ),
      }))
    }),
    foreignEngineering: true,
    foreignEngineeringUnits: ['longbowman'],
    uiTooltip: 'Available only with Foreign Engineering Company. Duration is not yet considered.',
  },

  {
    id: 'ability-place-palings',
    reason: 'UI-only: Ability that has no direct impact on unit combat stats. Hidden to avoid confusion in the ability selector.',
    after: (ability: Ability) => ({ ...ability, hidden: true })
  },

  {
    id: 'ability-abbey-healing',
    reason: 'UI-only: Ability that has no direct impact on unit combat stats. Hidden to avoid confusion in the ability selector.',
    after: (ability: Ability) => ({ ...ability, hidden: true })
  },

  {
    id: "ability-network-of-castles",
    reason: "Per-unit AS corrections from in-game measurements (2026/04/18). No uniform model — corrections like Zeal.",
    after: (ability: Ability) => ({
      ...ability,
      variations: ability.variations.map((v: AbilityVariation) => ({
        ...v,
        active: "manual",
        effects: [
          { property: 'attackSpeed', select: { id: ['spearman'] }, effect: 'multiply', value: 1.620 / 1.875, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['man-at-arms'] }, effect: 'multiply', value: 1.120 / 1.375, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['wynguard-footman'] }, effect: 'multiply', value: 1.330 / 1.625, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['crossbowman'] }, effect: 'multiply', value: 1.830 / 2.125, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['handcannoneer'] }, effect: 'multiply', value: 1.790 / 2.125, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['longbowman', 'wynguard-ranger'] }, effect: 'multiply', value: 1.370 / 1.625, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['horseman'] }, effect: 'multiply', value: 1.560 / 1.750, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['king'] }, effect: 'multiply', value: 1.950 / 2.375, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['knight'] }, effect: 'multiply', value: 1.230 / 1.500, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['counterweight-trebuchet'] }, effect: 'multiply', value: 9.530 / 11.375, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['mangonel'] }, effect: 'multiply', value: 5.830 / 6.875, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['springald'] }, effect: 'multiply', value: 2.640 / 3.125, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['bombard'] }, effect: 'multiply', value: 4.570 / 5.375, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['ribauldequin'] }, effect: 'multiply', value: 4.570 / 5.250, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['villager'] }, effect: 'multiply', value: 2.910 / 3.375, type: 'ability' },
        ],
      }))
    }),
    uiTooltip: "Real Attackspeed bonus : +18.3% AS with a 12–23% spread "
  },

  {
    id: "ability-network-of-citadels",
    reason: "Per-unit AS corrections from in-game measurements (2026/04/18). No uniform model — corrections like Zeal.",
    after: (ability: Ability) => ({
      ...ability,
      minAge: 3,
      variations: ability.variations.map((v: AbilityVariation) => ({
        ...v,
        active: "manual",
        effects: [
          { property: 'attackSpeed', select: { id: ['spearman'] }, effect: 'multiply', value: 1.580 / 1.875, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['man-at-arms'] }, effect: 'multiply', value: 1.120 / 1.375, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['wynguard-footman'] }, effect: 'multiply', value: 1.320 / 1.625, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['crossbowman'] }, effect: 'multiply', value: 1.720 / 2.125, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['handcannoneer'] }, effect: 'multiply', value: 1.710 / 2.125, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['longbowman', 'wynguard-ranger'] }, effect: 'multiply', value: 1.330 / 1.625, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['horseman'] }, effect: 'multiply', value: 1.490 / 1.750, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['king'] }, effect: 'multiply', value: 1.890 / 2.375, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['knight'] }, effect: 'multiply', value: 1.170 / 1.500, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['counterweight-trebuchet'] }, effect: 'multiply', value: 8.860 / 11.375, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['mangonel'] }, effect: 'multiply', value: 5.330 / 6.875, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['springald'] }, effect: 'multiply', value: 2.510 / 3.125, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['bombard'] }, effect: 'multiply', value: 4.280 / 5.375, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['ribauldequin'] }, effect: 'multiply', value: 4.250 / 5.250, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['villager'] }, effect: 'multiply', value: 2.790 / 3.375, type: 'ability' },
        ],
      }))
    }),
    uiTooltip: "Real Attackspeed bonus : +23.8% AS with a 17–29%% spread "

  },

  //___________
  //
  // FRENCH
  //
  //___________

  {
    id: "ability-royal-knight-charge-damage",
    reason: "Duration is not yet considered.",
    uiTooltip: "Duration is not yet considered."
  },

  {
    id: "ability-deploy-pavise",
    reason: "Duration is not yet considered.",
    uiTooltip: "Duration is not yet considered."
  },

  {
    id: "ability-artillery-shot",
    reason: "UI-only: Conversion is a monk ability that has no direct impact on unit combat stats. Hidden to avoid confusion in the ability selector.",
    after: (ability: Ability) => ({ ...ability, hidden: true }),
  },

  //_________________
  //
  // GOLDEN HORDE
  //
  //_________________


  {
    id: 'ability-defensive-aura-edict',
    reason: 'Raw effects empty; adds +10% HP to military units as described in-game.',
    update: {
      effects: [{
        property: 'hitpoints',
        select: { class: [['annihilation_condition']] },
        effect: 'multiply',
        value: 1.1,
        type: 'passive',
      }],
      active: 'manual',
    },
  },

  {
    id: 'ability-glorious-charge',
    reason: 'Raw effects empty. Models +50% move speed and −15% all damage taken. minAge corrected to 3. Duration (30s) not modelled.',
    update: {
      minAge: 3,
      effects: [
        { property: 'moveSpeed', select: { class: [['military']] }, effect: 'multiply', value: 1.5, type: 'ability' },
        { property: 'rangedResistance', select: { class: [['military']] }, effect: 'change', value: 15, type: 'ability' },
        { property: 'meleeResistance', select: { class: [['military']] }, effect: 'change', value: 15, type: 'ability' },
      ],
    },
    uiTooltip: 'Duration not modelled.',
  },

  {
    id: 'ability-khan-debuff-arrow',
    reason: '...',
    uiTooltip: 'Duration not modelled.',
  },

  //______________________
  //
  // HOLY ROMAN EMPIRE
  //
  //______________________

  {
    id: "ability-inspired-warriors",
    reason: "Change active always to manual.",
    after: (ability: Ability) => ({
      ...ability,
      variations: ability.variations.map((v: AbilityVariation) => ({
        ...v,
        effects: [
          { property: 'meleeAttack', select: { id: ['melee'] }, effect: 'multiply', value: 1.15, type: 'ability' },
          { property: 'rangedAttack', select: { id: ['ranged', 'siege'] }, effect: 'multiply', value: 1.15, type: 'ability' },
          { property: 'siegeAttack', select: { id: ['siege'] }, effect: 'multiply', value: 1, type: 'ability' }
        ],
        active: 'manual'
      }))
    })
  },

  {
    id: 'ability-relic-garrisoned-dock',
    reason: 'Counter ability: 1–5 relics garrisoned in a dock each grant +5% attack speed to naval military. Effective multiplier at N relics = ×1/(1+N×0.05). Raw value 0.95 is replaced by dynamic computation.',
    update: {
      counterMax: 5,
      counterStep: 0.05,
      unitCounterStep: { 'galley': 0.03 },
    },
  },

  //___________
  //
  // HOUSE OF LANCASTER
  //
  //___________
  {
    id: "ability-house-unified",
    reason: "Add Tooltip.",
    uiTooltip: "Max value goes from 4 to 6 only if the Berkshire Palace has been constructed.",
  },
  //___________
  //
  // JAPANESE
  //
  //___________


  {
    id: 'ability-five-mountain-ministries',
    reason: 'Raw effects empty. Debuffs all enemy attackers: −50% damage (base + bonus). Duration 60s not modelled.',
    after: (ability: Ability) => ({
      ...ability,
      effects: [
        {
          property: 'versusOpponentDamageDebuff',
          select: { class: [['annihilation_condition']] },
          effect: 'multiply',
          value: 0.5,
          type: 'ability',
        },
      ],
      minAge: 3,
      variations: ability.variations.map((v: AbilityVariation) => ({ ...v, active: 'manual', age: Math.max(v.age ?? 1, 3) })),
    }),
    uiTooltip: 'Duration not yet modelled.',
  },

  {
    id: 'ability-kabura-ya',
    reason: 'Raw variation effect is change:0 (no-op). Corrected to multiply:1.1. active:manual bypasses unlockedBy suppression (getAbilitiesForUnit line 249 hides abilities with unlockedBy when active !== manual). Duration 10s not modelled.',
    after: (ability: Ability) => ({
      ...ability,
      active: 'manual',
      minAge: 3,
      variations: ability.variations.map((v: AbilityVariation) => ({
        ...v,
        active: 'manual',
        age: Math.max(v.age ?? 1, 3),
        effects: [
          {
            property: 'moveSpeed',
            select: { id: ['onna-musha'] },
            effect: 'multiply',
            value: 1.1,
            type: 'ability',
          },
        ],
      })),
    }),
    uiTooltip: 'Duration 10s not modelled.',
  },

  {
    id: "ability-buddhist-conversion",
    reason: "Add Tooltip.",
    uiTooltip: "Duration not yet modelled.",
  },

  {
    id: "ability-nehan",
    reason: "Add Tooltip.",
    uiTooltip: "Duration not yet modelled.",
  },

  {
    id: "ability-katana-bannerman-aura",
    reason: "Auto-activates only for katana-bannerman via activeForIds. Raw variation already has meleeAttack ×1.15 on melee infantry.",
    update: { active: 'always' },
    after: (ability) => ({
      ...ability,
      activeForIds: ['katana-bannerman'],
      variations: ability.variations.map(v => ({ ...v, active: 'always' }))
    })
  },

  {
    id: "ability-yumi-bannerman-aura",
    reason: "Auto-activates only for yumi-bannerman via activeForIds. Raw variation already has rangedAttack ×1.15 on ranged infantry.",
    update: { active: 'always' },
    after: (ability) => ({
      ...ability,
      activeForIds: ['yumi-bannerman'],
      variations: ability.variations.map(v => ({ ...v, active: 'always' }))
    })
  },

  {
    id: "ability-uma-bannerman-aura",
    reason: "Auto-activates only for uma-bannerman via activeForIds. Raw has meleeAttack ×1.10 on cavalry; rangedAttack ×1.10 added for mounted ranged units.",
    update: { active: 'always' },
    after: (ability) => ({
      ...ability,
      activeForIds: ['uma-bannerman'],
      variations: ability.variations.map(v => ({
        ...v,
        active: 'always',
        effects: [
          ...v.effects,
          {
            property: 'rangedAttack',
            select: { class: [['cavalry']] },
            effect: 'multiply',
            value: 1.10,
            type: 'ability',
          },
        ],
      }))
    })
  },


  {
    id: 'ability-sabotage',
    reason: 'Useless for this app.',
    after: (ability) => ({ ...ability, hidden: true })
  },

  {
    id: 'ability-shunshin',
    reason: 'Useless for this app.',
    after: (ability) => ({ ...ability, hidden: true })
  },

  {
    id: 'ability-spy',
    reason: 'Useless for this app.',
    after: (ability) => ({ ...ability, hidden: true })
  },
  //___________
  //
  // OTTOMANS
  //
  //___________

  {
    id: "ability-fortitude",
    reason: 'Available for Byzantines.',
    after: (abilities) => ({
      ...abilities,
      civs: [...abilities.civs, 'by'],
      variations: abilities.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"],
        effects: [
          {
            property: 'attackSpeed',
            select: { id: ['sipahi'] },
            effect: 'multiply',
            value: 0.645,
            type: 'ability',
            duration: 10
          },
          {
            property: 'meleeResistance',
            select: { id: ['sipahi'] },
            effect: 'change',
            value: -50,
            type: 'ability',
            duration: 10
          }
        ]
      }))
    }),
  },


  //___________
  //
  // MONGOLS
  //
  //___________
  {
    id: "ability-battle-veteran",
    reason: 'Available for Byzantines and Golden Horde (keshik unit shared with Mongols).',
    after: (abilities) => ({
      ...abilities,
      civs: [...abilities.civs, 'by', 'gol'],
      variations: abilities.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by", "gol"]
      }))
    }),
  },


  //___________
  //
  // RUS
  //
  //___________

  {
    id: "ability-static-deployment",
    reason: 'Available for Byzantines.',
    after: (abilities) => ({
      ...abilities,
      civs: [...abilities.civs, 'by'],
      variations: abilities.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"],
      }))
    }),
  },

  {
    id: "ability-gallop",
    reason: 'Available for Byzantines.',
    after: (abilities) => ({
      ...abilities,
      civs: [...abilities.civs, 'by'],
      variations: abilities.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"],
        effects: [
          {
            property: 'moveSpeed',
            select: { id: ['horse-archer'] },
            effect: "change",
            value: 2,
            type: "ability",
            duration: 8
          }
        ]
      }))
    }),
    foreignEngineering: true,
    foreignEngineeringUnits: ['horse-archer'],
    uiTooltip: 'Available only with Foreign Engineering Company. Duration is not yet considered.',
  },

];

export const foreignEngineeringAbilityIds: Set<string> = new Set(
  abilityPatches.filter(p => p.foreignEngineering).map(p => p.id)
);

export const foreignEngineeringAbilityUnitRestrictions: Map<string, string[]> = new Map(
  abilityPatches
    .filter(p => p.foreignEngineering && p.foreignEngineeringUnits)
    .map(p => [p.id, p.foreignEngineeringUnits!])
);

// Synthetic ability — not a patch on existing data.
// ALL melee units can charge: +20% movement speed until the first attack.
// Additional bonus damage on first hit only for: knight (age 2: +10, age 3: +12, age 4: +14)
// and merc_ghulam (age 3: +5, age 4: +6). Per-age bonus applied in Sandbox.tsx.
function createChargeAttackAbility(): Ability {

  //___________
  //
  // BASE GAME
  //
  //___________

  const chargeEffects: Ability['effects'] = [
    // Speed boost for ALL melee units (displayed as moveSpeed effect)
    {
      property: 'moveSpeed',
      select: { class: [['melee']] },
      effect: 'multiply',
      value: 1.2, // +20% speed until first attack
      type: 'ability',
    },
    // Extra damage on first hit — knight only
    {
      property: 'bonusDamage',
      select: { class: [['knight']] },
      effect: 'change',
      value: 10, // representative (age 2); age 3: +12, age 4: +14
      type: 'ability',
    },
    // Extra damage on first hit — ghulam only
    {
      property: 'bonusDamage',
      select: { class: [['merc_ghulam']] },
      effect: 'change',
      value: 5, // representative (age 3); age 4: +6
      type: 'ability',
    },
    {
      property: "bonusDamage",
      select: { class: [['firelancer']] },
      effect: "change",
      value: 4,
      type: "ability",
    },
  ];

  return {
    id: 'charge-attack',
    name: 'Charge Attack',
    type: 'ability',
    civs: [],
    displayClasses: [],
    classes: [],
    minAge: 1,
    icon: 'https://data.aoe4world.com/images/abilities/ability-tactical-charge-1.png',
    description: 'All melee: +20% move speed until first attack. Knights & Ghulams also deal bonus damage on first hit.',
    unique: false,
    effects: chargeEffects,
    variations: [
      {
        id: 'charge-attack-1',
        baseId: 'charge-attack',
        type: 'ability',
        name: 'Charge Attack',
        pbgid: 999001,
        attribName: 'charge_attack_1',
        age: 1,
        civs: [],
        description: 'All melee: +20% move speed until first attack. Knights & Ghulams also deal bonus damage on first hit.',
        classes: [],
        displayClasses: [],
        unique: false,
        costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
        producedBy: [],
        effects: [], // effects live at the ability level only (getAbilityVariation concatenates both)
      }
    ],
    shared: {}
  } as Ability;
}

//___________
//
// CHINESE
//
//___________

// Synthetic ability — Ming Dynasty (Chinese).
// +15% HP to all military units.
// HP multiply uses additive stacking: HP_base × (1 + Σ(value - 1)).
function createMingDynastyAbility(): Ability {
  return {
    id: 'ability-dynasty-ming',
    name: 'Ming Dynasty',
    type: 'ability',
    civs: ['ch'],
    displayClasses: [],
    classes: [],
    minAge: 4,
    icon: '/abilities/AoE4_MingDynasty.png',
    description: 'Ming Dynasty: all military units gain +15% HP.',
    unique: false,
    effects: [
      {
        property: 'hitpoints',
        select: { class: [['land_military']] },
        effect: 'multiply',
        value: 1.15,
        type: 'ability',
      }
    ],
    variations: [
      {
        id: 'ability-dynasty-ming-4',
        baseId: 'ability-dynasty-ming',
        type: 'ability',
        name: 'Ming Dynasty',
        pbgid: 998002,
        attribName: 'ability_dynasty_ming_4',
        age: 4,
        civs: ['ch'],
        description: 'Ming Dynasty: all military units gain +15% HP.',
        classes: [],
        displayClasses: [],
        unique: false,
        costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
        producedBy: [],
        effects: [], // effects live at ability level (getAbilityVariation concatenates both)
      }
    ],
    shared: {}
  } as Ability;
}

// Synthetic ability — Yuan Dynasty (Chinese).
// +15% attack speed (×0.87 cycle) for all cavalry units.
// Yuan = Mongol-inspired → cavalry-focused bonus.
function createYuanDynastyAbility(): Ability {
  return {
    id: 'ability-dynasty-yuan',
    name: 'Yuan Dynasty',
    type: 'ability',
    civs: ['ch'],
    displayClasses: [],
    classes: [],
    minAge: 3,
    icon: '/abilities/AoE4_YuanDynasty.png',
    description: 'Yuan Dynasty: all non-siege units (land + naval) gain +15% movement speed.',
    unique: false,
    effects: [
      {
        property: 'moveSpeed',
        select: { class: [['find_non_siege_land_military'], ['naval_unit']] },
        effect: 'multiply',
        value: 1.15,
        type: 'ability',
      }
    ],
    variations: [
      {
        id: 'ability-dynasty-yuan-3',
        baseId: 'ability-dynasty-yuan',
        type: 'ability',
        name: 'Yuan Dynasty',
        pbgid: 998003,
        attribName: 'ability_dynasty_yuan_3',
        age: 3,
        civs: ['ch'],
        description: 'Yuan Dynasty: all non-siege units (land + naval) gain +15% movement speed.',
        classes: [],
        displayClasses: [],
        unique: false,
        costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
        producedBy: [],
        effects: [], // effects live at ability level (getAbilityVariation concatenates both)
      }
    ],
    shared: {}
  } as Ability;
}

// Synthetic ability — Astronomical Clocktower (Chinese).
// Chinese siege units produced in the Clocktower landmark gain +50% HP.
// Replaces the separate clocktower-* unit variants.
function createClocktowerAbility(): Ability {
  return {
    id: 'ability-astronomical-clocktower',
    name: 'Astronomical Clocktower',
    type: 'ability',
    civs: ['ch'],
    displayClasses: [],
    classes: [],
    minAge: 3,
    icon: 'https://data.aoe4world.com/images/buildings/astronomical-clocktower-2.png',
    description: 'Astronomical Clocktower: siege units gain +50% HP.',
    unique: false,
    effects: [
      {
        property: 'hitpoints',
        select: { class: [['siege']] },
        effect: 'multiply',
        value: 1.5,
        type: 'ability',
      }
    ],
    variations: [
      {
        id: 'ability-astronomical-clocktower-3',
        baseId: 'ability-astronomical-clocktower',
        type: 'ability',
        name: 'Astronomical Clocktower',
        pbgid: 998004,
        attribName: 'ability_astronomical_clocktower_3',
        age: 3,
        civs: ['ch'],
        description: 'Astronomical Clocktower: siege units gain +50% HP.',
        classes: [],
        displayClasses: [],
        unique: false,
        costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
        producedBy: [],
        effects: [], // effects live at ability level
      }
    ],
    shared: {}
  } as Ability;
}

//___________
//
// ENGLISH
//
//___________

function createCouncilHallAbility(): Ability {
  return {
    id: 'ability-council-hall',
    name: 'Council Hall',
    type: 'ability',
    civs: ['en'],
    displayClasses: [],
    classes: [],
    minAge: 2,
    icon: '/abilities/council-hall.png',
    description: 'Longbowmen cost 5% less.',
    unique: false,
    effects: [{
      property: 'costReduction',
      select: { id: ['longbowman'] },
      effect: 'multiply',
      value: 0.95,
      type: 'ability',
    }],
    variations: [{
      id: 'ability-council-hall-2',
      baseId: 'ability-council-hall',
      type: 'ability',
      name: 'Council Hall',
      pbgid: 999010,
      attribName: 'ability_council_hall',
      age: 2,
      civs: ['en'],
      description: 'Longbowmen cost 5% less.',
      classes: [], displayClasses: [], unique: false,
      costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
      producedBy: [],
      effects: [],
    }],
    shared: {}
  } as Ability;
}

//___________
//
// FRENCH
//
//___________

function createFrenchKeepInfluence(): Ability {
  return {
    id: 'ability-keep-influence',
    name: 'Keep Influence',
    type: 'ability',
    civs: ['fr'],
    displayClasses: [],
    classes: [],
    minAge: 3,
    icon: '/abilities/keep-influence.png',
    description: 'All Archery Ranges and Stables within this influence area produce units 20% cheaper.',
    unique: true,
    effects: [{
      property: 'costReduction',
      select: { class: [['ranged_infantry'], ['cavalry']] },
      effect: 'multiply',
      value: 0.8,
      type: 'ability',
    }],
    variations: [{
      id: 'ability-keep-influence-3',
      baseId: 'ability-keep-influence',
      type: 'ability',
      name: 'Keep Influence',
      pbgid: 999011,
      attribName: 'ability_keep_influence',
      age: 3,
      civs: ['fr'],
      description: 'All Archery Ranges and Stables within this influence area produce units 20% cheaper.',
      classes: [], displayClasses: [], unique: false,
      costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
      producedBy: [],
      effects: [],
    }],
    shared: {}
  } as Ability;
}

//___________
//
// GOLDEN HORDE
//
//___________

// Synthetic ability — Kharash Aura (Golden Horde).
// Bonus Armor: +1 melee and +1 ranged armor to all non-siege units.
function createKharashAura(): Ability {
  return {
    id: 'ability-kharash-aura',
    name: 'Kharash Bonus Armor',
    type: 'ability',
    civs: ['gol'],
    displayClasses: [],
    classes: [],
    minAge: 1,
    icon: '/abilities/kharash-aura.png',
    description: 'Kharash Bonus Armor: all non-siege units gain +1 melee and +1 ranged armor.',
    unique: false,
    effects: [
      { property: 'meleeArmor', select: { class: [['annihilation_condition']], excludeId: ['kharash'] }, effect: 'change', value: 1, type: 'ability' },
      { property: 'rangedArmor', select: { class: [['annihilation_condition']], excludeId: ['kharash'] }, effect: 'change', value: 1, type: 'ability' },
    ],
    variations: [{
      id: 'ability-kharash-aura-1',
      baseId: 'ability-kharash-aura',
      type: 'ability',
      name: 'Kharash Bonus Armor',
      pbgid: 999103,
      attribName: 'ability_kharash_aura',
      age: 1,
      civs: ['gol'],
      description: 'Kharash Bonus Armor: all non-siege units gain +1 melee and +1 ranged armor.',
      classes: [], displayClasses: [], unique: false,
      costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
      producedBy: [],
      effects: [],
    }],
    shared: {}
  } as Ability;
}

function createKhanDebuffArrow(): Ability {
  const effects = [
    { property: 'meleeAttack', select: { class: [['annihilation_condition']], excludeId: ['battering-ram', 'trade-ship', 'fishing-boat', 'trader'] }, effect: 'multiply', value: 1.1, type: 'ability' },
    { property: 'rangedAttack', select: { class: [['annihilation_condition']], excludeId: ['battering-ram', 'trade-ship', 'fishing-boat', 'trader'] }, effect: 'multiply', value: 1.1, type: 'ability' },
    { property: 'siegeAttack', select: { class: [['annihilation_condition']], excludeId: ['battering-ram', 'trade-ship', 'fishing-boat', 'trader'] }, effect: 'multiply', value: 1.1, type: 'ability' },
  ];
  return {
    id: 'ability-khan-debuff-arrow',
    name: 'Khan Debuff Arrow (+10%)',
    type: 'ability',
    civs: ['gol'],
    displayClasses: [],
    classes: [],
    minAge: 2,
    icon: 'https://data.aoe4world.com/images/technologies/khan-debuff-arrow-2.png',
    description: 'Khan fires a signal arrow. Enemies in the area take +10% damage for 10s.',
    unique: true,
    effects,
    variations: [{
      id: 'ability-khan-debuff-arrow-v',
      baseId: 'ability-khan-debuff-arrow',
      type: 'ability',
      name: 'Khan Debuff Arrow (+10%)',
      pbgid: 999200,
      attribName: 'ability_khan_debuff_arrow',
      age: 2,
      civs: ['gol'],
      description: 'Khan fires a signal arrow. Enemies in the area take +10% damage for 10s.',
      classes: [], displayClasses: [], unique: true,
      costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
      producedBy: [],
      effects: [],
    }],
    shared: {}
  } as Ability;
}

function createKhanWarcry(age: 2 | 3 | 4, multiplier: number): Ability {
  const pct = Math.round((multiplier - 1) * 100);
  const effects = [
    { property: 'meleeAttack', select: { class: [['annihilation_condition']] }, effect: 'multiply', value: multiplier, type: 'ability' },
    { property: 'rangedAttack', select: { class: [['annihilation_condition']] }, effect: 'multiply', value: multiplier, type: 'ability' },
  ];
  return {
    id: `ability-khan-warcry-${age}`,
    name: `Khan War Cry (+${pct}%)`,
    type: 'ability',
    civs: ['mo', 'gol'],
    displayClasses: [],
    classes: [],
    minAge: age,
    icon: '/abilities/khan-warcry.png',
    description: `Khan War Cry: units gain +${pct}% attack.`,
    unique: false,
    effects,
    variations: [{
      id: `ability-khan-warcry-${age}-v`,
      baseId: `ability-khan-warcry-${age}`,
      type: 'ability',
      name: `Khan War Cry (+${pct}%)`,
      pbgid: 999100 + age,
      attribName: `ability_khan_warcry_${age}`,
      age,
      civs: ['mo', 'gol'],
      description: `Khan War Cry: units gain +${pct}% attack.`,
      classes: [], displayClasses: [], unique: false,
      costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
      producedBy: [],
      effects: [],
    }],
    shared: {}
  } as Ability;
}

//__________________
//
// HOUSE OF LANCASTER
//
//__________________

function createLordOfLancasterInspiration(): Ability {
  return {
    id: 'ability-lord-of-lancaster-inspiration',
    name: 'Lord of Lancaster Inspiration',
    type: 'ability',
    civs: ['hl'],
    displayClasses: [],
    classes: [],
    minAge: 2,
    icon: '/abilities/lord_of_lancaster_inspiration.png',
    description: '+5% HP per stack (up to 4 stacks).',
    unique: false,
    counterMax: 4,
    counterStep: 0.05,
    counterDirection: 'increase' as const,
    counterTooltipLabel: 'HP',
    effects: [{
      property: 'hitpoints',
      select: { class: [['annihilation_condition'], ['military']] },
      effect: 'multiply',
      value: 1.0,
      type: 'ability',
    }],
    variations: [{
      id: 'ability-lord-of-lancaster-inspiration-1',
      baseId: 'ability-lord-of-lancaster-inspiration',
      type: 'ability',
      name: 'Lord of Lancaster Inspiration',
      pbgid: 999200,
      attribName: 'ability_lord_of_lancaster_inspiration',
      age: 1,
      civs: ['en'],
      description: '+5% HP per stack (up to 4 stacks).',
      classes: [], displayClasses: [], unique: false,
      costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
      producedBy: [],
      effects: [],
    }],
    shared: {}
  } as Ability;
}

function createDaggerThrow(): Ability {
  return {
    id: 'ability-dagger-throw',
    name: 'Dagger Throw',
    type: 'ability',
    civs: ['hl'],
    displayClasses: [],
    classes: [],
    minAge: 3,
    active: 'always',
    icon: '/abilities/Dagger_Throw.png',
    description: 'Throws a dagger at the start of combat dealing first-hit bonus damage (melee armor applies).',
    unique: false,
    effects: [{
      property: 'unknown',
      select: { id: ['earls-guard'] },
      effect: 'change',
      value: 0,
      type: 'ability',
    }],
    variations: [{
      id: 'ability-dagger-throw-1',
      baseId: 'ability-dagger-throw',
      type: 'ability',
      name: 'Dagger Throw',
      pbgid: 999201,
      attribName: 'ability_dagger_throw',
      age: 3,
      civs: ['hl'],
      description: 'Throws a dagger at the start of combat dealing first-hit bonus damage (melee armor applies).',
      classes: [], displayClasses: [], unique: false,
      costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
      producedBy: [],
      effects: [],
    }],
    shared: {}
  } as Ability;
}

function createHouseUnified(): Ability {
  return {
    id: 'ability-house-unified',
    name: 'House Unified',
    type: 'ability',
    civs: ['hl'],
    displayClasses: [],
    classes: [],
    minAge: 3,
    active: 'always',
    icon: 'https://data.aoe4world.com/images/buildings/keep-3.png',
    description: "Gains +1 damage for each active Keep (including Keep landmarks), up to a maximum of +4, or +6 if the Berkshire Palace has been constructed. This applies to both melee and dagger throw attacks.",
    unique: true,
    counterMax: 6,
    counterStep: 1,
    counterDirection: 'additive' as const,
    counterTooltipLabel: 'damage',
    effects: [{
      property: 'meleeAttack',
      select: { id: ['earls-guard', 'demilancer'] },
      effect: 'change',
      value: 1,
      type: 'ability',
    }],
    variations: [{
      id: 'ability-house-unified-1',
      baseId: 'ability-house-unified',
      type: 'ability',
      name: 'House Unified',
      pbgid: 999202,
      attribName: 'ability_house_unified',
      age: 3,
      civs: ['hl'],
      description: "Gains +1 damage for each active Keep (including Keep landmarks), up to a maximum of +4, or +6 if the Berkshire Palace has been constructed. This applies to both melee and dagger throw attacks.",
      classes: [], displayClasses: [], unique: true,
      costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
      producedBy: [],
      effects: [],
    }],
    shared: {}
  } as Ability;
}

//__________________
//
// JAPANESE
//
//__________________

function createBuddhistConversion(): Ability {
  const effects = [
    { property: 'meleeAttack', select: { class: [['land_military']] }, effect: 'multiply', value: 1.2, type: 'ability' },
    { property: 'rangedAttack', select: { class: [['land_military']] }, effect: 'multiply', value: 1.2, type: 'ability' },
    { property: 'siegeAttack', select: { class: [['land_military']] }, effect: 'multiply', value: 1.2, type: 'ability' },
  ];
  return {
    id: 'ability-buddhist-conversion',
    name: 'Buddhist Conversion',
    type: 'ability',
    civs: ['ja'],
    displayClasses: [],
    classes: [],
    minAge: 3,
    active: 'manual',
    icon: '/abilities/buddhist-conversion.png',
    description: "When casting Buddhist Conversion, nearby allied units gain +20% damage for 20 seconds.",
    unique: true,
    effects,
    variations: [{
      id: 'ability-buddhist-conversion-v',
      baseId: 'ability-buddhist-conversion',
      type: 'ability',
      name: 'Buddhist Conversion',
      pbgid: 999300,
      attribName: 'ability_buddhist_conversion',
      age: 3,
      civs: ['ja'],
      description: "When casting Buddhist Conversion, nearby allied units gain +20% damage for 20 seconds.",
      classes: [], displayClasses: [], unique: false,
      costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
      producedBy: [],
      effects: [],
    }],
    shared: {}
  } as Ability;
}

function createNehan(): Ability {
  return {
    id: 'ability-nehan',
    name: 'Nehan',
    type: 'ability',
    civs: ['ja'],
    displayClasses: [],
    classes: [],
    minAge: 4,
    active: 'manual',
    icon: 'https://data.aoe4world.com/images/technologies/nehan-4.png',
    description: "When casting Buddhist Conversion, nearby allied units gain +25% movement speed for 20 seconds.",
    unique: false,
    effects: [
      { property: 'moveSpeed', select: { class: [['land_military']] }, effect: 'multiply', value: 1.25, type: 'ability' },
    ],
    variations: [{
      id: 'ability-nehan-v',
      baseId: 'ability-nehan',
      type: 'ability',
      name: 'Nehan',
      pbgid: 999301,
      attribName: 'ability_nehan',
      age: 4,
      civs: ['ja'],
      description: "When casting Buddhist Conversion, nearby allied units gain +20% damage for 20 seconds.",
      classes: [], displayClasses: [], unique: false,
      costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
      producedBy: [],
      effects: [],
    }],
    shared: {}
  } as Ability;
}

// Display row grouping for AbilitySelector.
// Each entry reserves a dedicated row with a short label.
// Abilities not listed here share the default "ABI:" row.
// Order matters: rows render in array order, default row first.
export const ABILITY_ROW_GROUPS: readonly { label: string; ids: readonly string[] }[] = [
  { label: 'WC', ids: ['ability-khan-warcry-2', 'ability-khan-warcry-3', 'ability-khan-warcry-4'] },
  { label: 'CTR', ids: ['ability-house-unified', 'ability-lord-of-lancaster-inspiration'] },
  { label: 'CONV', ids: ['ability-buddhist-conversion', 'ability-nehan'] },
];

export function applyAbilityPatches(abilities: Ability[]): Ability[] {
  // Add the created synthetic abilities
  const chargeAttackAbility = createChargeAttackAbility();
  const abilitiesWithCharge = [
    ...abilities,
    chargeAttackAbility,
    createYuanDynastyAbility(),
    createMingDynastyAbility(),
    createClocktowerAbility(),
    createCouncilHallAbility(),
    createFrenchKeepInfluence(),
    createKhanWarcry(2, 1.1),
    createKhanWarcry(3, 1.2),
    createKhanWarcry(4, 1.3),
    createKhanDebuffArrow(),
    createKharashAura(),
    createLordOfLancasterInspiration(),
    createDaggerThrow(),
    createHouseUnified(),
    createBuddhistConversion(),
    createNehan(),
  ];

  return abilitiesWithCharge.map(ability => {
    const patch = abilityPatches.find(p => p.id === ability.id);
    if (!patch) return ability;

    let updated = { ...ability };

    if (patch.update) {
      updated = deepMerge(updated, patch.update);
    }

    if (patch.after) {
      updated = patch.after(updated);
    }

    return updated;
  });
}
