import { TechnologyPatch, deepMerge } from "./types";
import { Ability, AbilityVariation } from "../unified-abilities";
import type { UnitStats } from "../unified-technologies";



// Display row grouping for AbilitySelector.
// Each entry reserves a dedicated row with a short label.
// Abilities not listed here share the default "ABI:" row.
// Order matters: rows render in array order, default row first.
export const ABILITY_ROW_GROUPS: readonly { label: string; ids: readonly string[] }[] = [
  { label: 'KHAN', ids: ['ability-khan-warcry-2', 'ability-khan-warcry-3', 'ability-khan-warcry-4', 'ability-maneuver-arrow', 'ability-attack-speed-arrow', 'ability-defense-arrow'] },
  { label: 'CTR', ids: ['ability-house-unified', 'ability-lord-of-lancaster-inspiration'] },
  { label: 'CONV', ids: ['ability-buddhist-conversion', 'ability-nehan'] },
  { label: 'WPN', ids: ['ability-streltsy-berdysh', 'ability-streltsy-handcannon'] },
  { label: 'AGE', ids: ['ability-high-armory-production-bonus', 'ability-abbey-of-the-trinity', 'ability-kurultai-aura', 'ability-tower-of-victory-aura', 'ability-burgrave-palace'] },
  { label: 'CHAR', ids: ['charge-attack', 'ability-royal-knight-charge-damage'] },
  { label: 'MEHT', ids: ['ability-attack-drums', 'ability-ranged-defense-drums', 'ability-melee-defense-drums'] },
  { label: 'DYN', ids: ['ability-dynasty-yuan', 'ability-dynasty-ming'] },
  { label: 'AURA', ids: ['ability-network-of-castles', 'ability-network-of-citadels'] },
];


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
    requiredTech: "cantled-saddles",
    requiredAbility: "ability-royal-knight-charge-damage",
    unitId: "jeanne-darc-knight",
    apply: (stats) => ({ ...stats, meleeAttack: stats.meleeAttack + 7 }),
  },
  {
    requiredTech: 'enlistment-incentives',
    requiredAbility: 'ability-keep-influence',
    apply: (stats) => ({ ...stats, costMultiplier: (stats.costMultiplier ?? 1) * 0.95 }),
  },
  {
    requiredTech: 'ordinance-company',
    requiredAbility: 'ability-consecrate',
    apply: (stats) => ({
      ...stats,
      foodCostMultiplier: 1.0,
      costMultiplier: (stats.costMultiplier ?? 1) * 0.75,
    }),
  },

  {
    requiredTech: 'do-maru-armor',
    requiredAbility: 'ability-deflective-armor',
    apply: (stats) => ({ ...stats, moveSpeed: stats.moveSpeed * 1.1 })
  },

  {
    requiredTech: 'desert-citadels',
    requiredAbility: 'ability-desert-citadels',
    apply: (stats) => ({ ...stats, meleeArmor: stats.meleeArmor + 1, rangedArmor: stats.rangedArmor + 1, })
  },

  {
    requiredTech: 'fervor',
    requiredAbility: 'ability-saints-blessing',
    apply: (stats) => ({ ...stats, meleeAttack: stats.meleeAttack + 1, rangedAttack: stats.rangedAttack + 1, siegeAttack: stats.siegeAttack + 1 })
  },

  {
    requiredTech: 'mounted-training',
    requiredAbility: 'ability-gallop',
    apply: (stats) => ({ ...stats, maxRange: stats.maxRange + 1 })
  }
];

//_________________
//
// ABBASID DYNASTY
//
//_________________

const JD_FORM_IDS = ['jeanne-darc-peasant', 'jeanne-darc-woman-at-arms', 'jeanne-darc-hunter', 'jeanne-darc-knight', 'jeanne-darc-mounted-archer', 'jeanne-darc-blast-cannon', 'jeanne-darc-markswoman'];

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
      activeForIds: [
        'camel-archer',
        'camel-rider',
        'camel-lancer',
        'desert-raider',
        'atabeg',
        'dervish',
        'trade-caravan',
        'camel'
      ],
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
    reason: 'Available for Byzantines after building Foreign Engineering Company.',
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
    reason: 'Available for Byzantines after building Foreign Engineering Company.',
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
          { property: 'moveSpeed', select: { id: ['limitanei'] }, effect: 'multiply', value: 0.75, type: 'ability', duration: 25 },
          { property: 'attackSpeed', select: { id: ['limitanei'] }, effect: 'multiply', value: 1.25, type: 'ability', duration: 25 },
          { property: 'rangedResistance', select: { id: ['limitanei'] }, effect: 'change', value: 30, type: 'ability', duration: 25 },
        ]
      }))
    })
  },
  {
    id: "ability-berserking",
    reason: 'Raw value was +30 (wrong), correct value is +6. Duration 30s (description).',
    after: (ability) => ({
      ...ability,
      civs: [...ability.civs, 'mac'],
      variations: ability.variations.map(v => ({
        ...v,
        civs: [...(v.civs ?? []), 'mac'],
        effects: [
          { property: 'meleeAttack', select: { id: ["varangian-guard"] }, effect: 'change', value: 6, type: 'ability', duration: 30 },
          { property: 'meleeArmor', select: { id: ["varangian-guard"] }, effect: 'change', value: -4, type: 'ability', duration: 30 },
          { property: 'rangedArmor', select: { id: ["varangian-guard"] }, effect: 'change', value: -4, type: 'ability', duration: 30 },
        ]
      }))
    })
  },

  {
    id: "ability-trample",
    reason: 'Trample is a charge-style ability — +12 bonus on first hit only (handled by getChargeBonus in Sandbox.tsx). Raw meleeAttack +12 zeroed in variations to avoid permanent buff. Speed boost +25% on variations (update.effects alone is ignored by getActiveAbilityVariations).',
    after: (ability: Ability) => ({
      ...ability,
      civs: [...ability.civs, 'mac'],
      variations: ability.variations.map((v: AbilityVariation) => ({
        ...v,
        civs: [...(v.civs ?? []), 'mac'],
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
    reason: "Patch.",
    after: (ability: Ability) => ({
      ...ability,
      variations: ability.variations.map((v: AbilityVariation) => ({
        ...v,
        effects: [
          ...v.effects.filter((e: any) => e.property !== 'moveSpeed' && e.property !== 'healingRate'),
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
          },
          {
            property: 'healingRatePerSecond',
            select: { class: [['cavalry']] },
            effect: 'change',
            value: 2,
            type: 'ability',
          },
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
    uiTooltip: "Model: attack speed only. Game shows +20%; model uses +24% (Fire Lancer), +18% (Grenadier), +11% (Zhuge Nu).",
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
    uiTooltip: "The 20% attack speed buff varies per unit (+15.7% Spearman to +22.8% Man-at-Arms).",
  },

  //___________
  //
  // ENGLISH
  //
  //___________

  {
    id: "ability-arrow-volley",
    reason: 'Available for Byzantines after building Foreign Engineering Company. wynguard-ranger added to select.id so the ability appears for that unit.',
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
    uiTooltip: 'Available only with Foreign Engineering Company.',
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
    reason: "jeanne-darc-knight gets +3 same as royal-knight (raw JSON only has royal-knight). Duration 5s (from description).",
    after: (ability: Ability) => ({
      ...ability,
      effects: [
        ...(ability.effects || []),
        {
          property: 'meleeAttack',
          select: { id: ['jeanne-darc-knight'] },
          effect: 'change',
          value: 3,
          type: 'ability',
          duration: 5,
        }
      ]
    })
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
    reason: 'Raw effects empty. Models +50% move speed and −15% all damage taken. minAge corrected to 3. Duration 30s.',
    update: {
      minAge: 3,
      effects: [
        { property: 'moveSpeed', select: { class: [['military']] }, effect: 'multiply', value: 1.5, type: 'ability', duration: 30 },
        { property: 'rangedResistance', select: { class: [['military']] }, effect: 'change', value: 15, type: 'ability', duration: 30 },
        { property: 'meleeResistance', select: { class: [['military']] }, effect: 'change', value: 15, type: 'ability', duration: 30 },
      ],
    },
  },

  {
    id: 'ability-khan-debuff-arrow',
    reason: 'Duration 10s annotated on synthetic effects.',
  },

  //______________________
  //
  // HOLY ROMAN EMPIRE
  //
  //______________________

  {
    id: "ability-inspired-warriors",
    reason: "Change active always to manual. Duration 60s. Added civ 'od'.",
    after: (ability: Ability) => ({
      ...ability,
      civs: [...ability.civs, 'od'],
      variations: ability.variations.map((v: AbilityVariation) => ({
        ...v,
        civs: [...(v.civs || []), 'od'],
        effects: [
          { property: 'meleeArmor', select: { class: [['infantry'], ['cavalry', 'melee'], ['cavalry', 'ranged'], ['siege']] }, effect: 'change', value: 1, type: 'ability', duration: 60 },
          { property: 'rangedArmor', select: { class: [['infantry'], ['cavalry', 'melee'], ['cavalry', 'ranged'], ['siege']] }, effect: 'change', value: 1, type: 'ability', duration: 60 },
          { property: 'meleeAttack', select: { id: ['melee'] }, effect: 'multiply', value: 1.15, type: 'ability', duration: 60 },
          { property: 'rangedAttack', select: { id: ['ranged', 'siege'] }, effect: 'multiply', value: 1.15, type: 'ability', duration: 60 },
          { property: 'siegeAttack', select: { id: ['siege'] }, effect: 'multiply', value: 1, type: 'ability', duration: 60 }
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
  //___________
  //
  // JAPANESE
  //
  //___________


  {
    id: 'ability-five-mountain-ministries',
    reason: 'Raw effects empty. Debuffs all enemy attackers: −50% damage (base + bonus). Duration 60s.',
    after: (ability: Ability) => ({
      ...ability,
      effects: [
        {
          property: 'versusOpponentDamageDebuff',
          select: { class: [['annihilation_condition']], excludeId: ['shinto-priest'] },
          effect: 'multiply',
          value: 0.5,
          type: 'ability',
          duration: 60,
        },
      ],
      minAge: 3,
      variations: ability.variations.map((v: AbilityVariation) => ({ ...v, active: 'manual', age: Math.max(v.age ?? 1, 3) })),
    }),
  },

  {
    id: 'ability-kabura-ya',
    reason: 'Raw variation effect is change:0 (no-op). Corrected to multiply:1.1. active:manual bypasses unlockedBy suppression (getAbilitiesForUnit line 249 hides abilities with unlockedBy when active !== manual). Duration 10s.',
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
            duration: 10,
          },
        ],
      })),
    }),
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

  //_______________
  //
  // JEANNE D'ARC
  //
  //_______________

  {
    id: 'ability-valorous-inspiration',
    reason: 'Per-unit AS corrections from in-game measurements (2026/04/25). No uniform model.',
    after: (ability: Ability) => ({
      ...ability,
      minAge: 4,
      variations: ability.variations.map((v: AbilityVariation) => ({
        ...v,
        active: 'manual',
        effects: [
          { property: 'attackSpeed', select: { id: ['spearman'] }, effect: 'multiply', value: 1.310 / 1.875, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['man-at-arms', 'jeannes-champion'] }, effect: 'multiply', value: 1.000 / 1.375, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['archer'], excludeId: ['jeanne-darc-hunter', 'jeanne-darc-mounted-archer'] }, effect: 'multiply', value: 1.310 / 1.625, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['handcannoneer'], excludeId: ['jeanne-darc-markswoman'] }, effect: 'multiply', value: 1.690 / 2.125, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['arbaletrier'] }, effect: 'multiply', value: 1.670 / 2.125, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['horseman', 'jeannes-rider'], excludeId: ['jeanne-darc-mounted-archer'] }, effect: 'multiply', value: 1.210 / 1.750, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['royal-knight'] }, effect: 'multiply', value: 1.150 / 1.500, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['counterweight-trebuchet'] }, effect: 'multiply', value: 8.660 / 11.375, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['mangonel'] }, effect: 'multiply', value: 5.210 / 6.875, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['springald'] }, effect: 'multiply', value: 2.320 / 3.125, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['cannon'] }, effect: 'multiply', value: 4.100 / 5.375, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['royal-culverin'] }, effect: 'multiply', value: 2.790 / 3.625, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['ribauldequin'] }, effect: 'multiply', value: 4.160 / 5.250, type: 'ability' },
          { property: 'attackSpeed', select: { id: ['jeanne-darc-markswoman'] }, effect: 'multiply', value: 1.62 / 2.12, type: 'ability' },
          { property: 'attackSpeed', select: { class: [['land_military']], excludeId: ['spearman', 'man-at-arms', 'jeannes-champion', 'archer', 'handcannoneer', 'arbaletrier', 'horseman', 'jeannes-rider', 'royal-knight', 'counterweight-trebuchet', 'mangonel', 'springald', 'cannon', 'royal-culverin', 'ribauldequin', 'jeanne-darc-peasant', 'jeanne-darc-woman-at-arms', 'jeanne-darc-hunter', 'jeanne-darc-knight', 'jeanne-darc-mounted-archer', 'jeanne-darc-blast-cannon', 'jeanne-darc-markswoman'] }, effect: 'multiply', value: 1 / 1.35, type: 'ability' },
        ],
      }))
    }),
    uiTooltip: 'Real Attackspeed bonus: ~+33% avg (24–45% spread).',
  },

  {
    id: 'ability-construct-the-kingdom',
    reason: 'Useless for this app.',
    after: (ability) => ({ ...ability, hidden: true })
  },

  {
    id: "ability-honorable-heart",
    reason: 'Useless for this app.',
    after: (ability) => ({ ...ability, hidden: true })
  },

  {
    id: "ability-journey-of-a-hero",
    reason: 'Useless for this app.',
    after: (ability) => ({ ...ability, hidden: true })
  },

  {
    id: "ability-talented-builder",
    reason: 'Useless for this app.',
    after: (ability) => ({ ...ability, hidden: true })
  },

  {
    id: "ability-divine-restoration",
    reason: 'Useless for this app.',
    after: (ability) => ({ ...ability, hidden: true })
  },

  {
    id: "ability-riders-ready",
    reason: 'Useless for this app.',
    after: (ability) => ({ ...ability, hidden: true })
  },

  {
    id: "ability-to-arms-men",
    reason: 'Useless for this app.',
    after: (ability) => ({ ...ability, hidden: true })
  },

  {
    id: 'ability-galvanize-the-righteous',
    reason: 'Raw variation effects target wrong units (JD forms). Corrected to jeannes-champion + jeannes-rider with +1/1 armor and ×1.1 attack. Forced active:manual (was always).',
    after: (ability: any) => ({
      ...ability,
      active: 'manual',
      variations: ability.variations.map((v: any) => ({
        ...v,
        active: 'manual',
        effects: [
          { property: 'meleeArmor', select: { id: ['jeannes-champion', 'jeannes-rider'] }, effect: 'change', value: 1, type: 'ability' },
          { property: 'rangedArmor', select: { id: ['jeannes-champion', 'jeannes-rider'] }, effect: 'change', value: 1, type: 'ability' },
          { property: 'meleeAttack', select: { id: ['jeannes-champion', 'jeannes-rider'] }, effect: 'multiply', value: 1.1, type: 'ability' },
        ]
      }))
    })
  },

  {
    id: 'ability-consecrate',
    reason: 'Raw effect is unknown. Patched to foodCostReduction ×0.75 targeting annihilation_condition, excluding all Jeanne forms.',
    after: (ability: any) => {
      const effect = {
        property: 'foodCostReduction',
        select: { id: ['annihilation_condition'], excludeId: JD_FORM_IDS },
        effect: 'multiply',
        value: 0.75,
        type: 'passive',
      };
      return {
        ...ability,
        minAge: 2,
        civs: [('je')],
        effects: [effect],
        variations: ability.variations.map((v: any) => ({ ...v, civs: [], effects: [] })),
      };
    },
  },

  {
    id: 'ability-holy-wrath',
    reason: 'Jeanne d\'Arc holy wrath: counter ability (max 4 stacks). Each stack adds armor-ignoring first-hit strike damage based on JD melee form level (Lv2/woman-at-arms: +20/stack, Lv3/knight: +30/stack, Lv4/blast-cannon: +50/stack). Computed in getChargeBonus via abilityCounters.',
    after: (ability: any) => ({
      ...ability,
      minAge: 2,
      civs: ['je'],
      counterMax: 4,
      counterDirection: 'additive',
      counterStep: 30,
      unitCounterStep: {
        'jeanne-darc-woman-at-arms': 20,
        'jeanne-darc-knight': 30,
        'jeanne-darc-blast-cannon': 50,
      },
      counterTooltipLabel: 'Strike',
      effects: [
        {
          property: 'unknown',
          select: { id: ['jeanne-darc-woman-at-arms', 'jeanne-darc-knight', 'jeanne-darc-blast-cannon'] },
          effect: 'multiply',
          value: 1.0,
          type: 'passive',
        }
      ],
      variations: ability.variations.map((v: any) => ({ ...v, civs: ['je'], effects: [] })),
    }),
  },

  {
    id: 'ability-divine-arrow',
    reason: 'Jeanne d\'Arc divine arrow: counter ability (max 4 stacks). Each stack adds armor-ignoring first-shot damage based on JD ranged form level (Lv2/hunter: +40/stack, Lv3/mounted-archer: +100/stack, Lv4/markswoman: +150/stack). Computed in getChargeBonus via abilityCounters. Range matches weapon max (7).',
    after: (ability: any) => ({
      ...ability,
      minAge: 2,
      civs: ['je'],
      counterMax: 4,
      counterDirection: 'additive',
      counterStep: 40,
      unitCounterStep: {
        'jeanne-darc-hunter': 40,
        'jeanne-darc-mounted-archer': 100,
        'jeanne-darc-markswoman': 150,
      },
      counterTooltipLabel: 'Divine arrow',
      effects: [
        {
          property: 'unknown',
          select: { id: ['jeanne-darc-hunter', 'jeanne-darc-mounted-archer', 'jeanne-darc-markswoman'] },
          effect: 'multiply',
          value: 1.0,
          type: 'passive',
        }
      ],
      variations: ability.variations.map((v: any) => ({ ...v, civs: ['je'], effects: [] })),
    }),
  },

  {
    id: 'ability-strength-of-heaven',
    reason: 'Raw variation effect is a dummy (property:unknown). Real effects per description: ×3 all damage, +300 HP, +4 armor on infantry/cavalry. JD forms excluded (ability blesses others, not Jeanne).',
    update: {
      effects: [
        { property: 'meleeAttack', select: { class: [['infantry'], ['cavalry']], excludeId: JD_FORM_IDS }, effect: 'multiply', value: 3, type: 'ability' },
        { property: 'rangedAttack', select: { class: [['infantry'], ['cavalry']], excludeId: JD_FORM_IDS }, effect: 'multiply', value: 3, type: 'ability' },
        { property: 'siegeAttack', select: { class: [['infantry'], ['cavalry']], excludeId: JD_FORM_IDS }, effect: 'multiply', value: 3, type: 'ability' },
        { property: 'bonusDamageMultiplier', select: { class: [['infantry'], ['cavalry']], excludeId: JD_FORM_IDS }, effect: 'multiply', value: 3, type: 'ability' },
        { property: 'hitpoints', select: { class: [['infantry'], ['cavalry']], excludeId: JD_FORM_IDS }, effect: 'change', value: 300, type: 'ability' },
        { property: 'meleeArmor', select: { class: [['infantry'], ['cavalry']], excludeId: JD_FORM_IDS }, effect: 'change', value: 4, type: 'ability' },
        { property: 'rangedArmor', select: { class: [['infantry'], ['cavalry']], excludeId: JD_FORM_IDS }, effect: 'change', value: 4, type: 'ability' },
      ],
    },
    after: (ability: Ability) => ({
      ...ability,
      minAge: 4,
      variations: ability.variations.map(v => ({ ...v, effects: [] })),
    }),
  },

  //___________________
  //
  // KNIGHTS TEMPLAR
  //
  //___________________


  {
    id: "ability-desert-citadels",
    reason: "Raw effect corrected.",
    update: {
      effects: [
        { property: "maxRange", select: { class: [["ranged", "infantry"], ["axe_thrower"], ["ranged", "ship"]] }, effect: "multiply", value: 1.15, type: "passive" },
        { property: 'meleeArmor', select: { class: [['human']] }, effect: 'multiply', value: 1, type: 'passive' },
        { property: 'rangedArmor', select: { class: [['human']] }, effect: 'multiply', value: 1, type: 'passive' },
      ]

    },
    after: (ability: Ability) => ({
      ...ability,
      minAge: 2,
      variations: ability.variations.map(v => ({ ...v, active: 'manual', effects: [] })),
    }),
  },

  {
    id: "ability-teutonic-wrath",
    reason: "Always active for Teutonic Knight.",
    after: (ability: Ability) => ({
      ...ability,
      activeForIds: ["teutonic-knight"],
    }),
  },


  //___________
  //
  // OTTOMANS
  //
  //___________

  {
    id: "ability-attack-drums",
    reason: "The +15% attack speed bonus is non-uniform across units. Values hard-coded per measurement (2026/05/14).",
    after: (ability: Ability) => ({
      ...ability,
      minAge: 2,
      variations: ability.variations.map((v: AbilityVariation) => ({
        ...v,
        effects: [
          // Infantry
          { property: "attackSpeed", select: { id: ["spearman"] }, effect: "multiply", value: 1.65 / 1.875, type: "ability" },
          { property: "attackSpeed", select: { id: ["man-at-arms"] }, effect: "multiply", value: 1.12 / 1.375, type: "ability" },
          { property: "attackSpeed", select: { id: ["archer"] }, effect: "multiply", value: 1.4 / 1.625, type: "ability" },
          { property: "attackSpeed", select: { id: ["crossbowman"] }, effect: "multiply", value: 1.9 / 2.125, type: "ability" },
          { property: "attackSpeed", select: { id: ["akinji"] }, effect: "multiply", value: 2.27 / 2.625, type: "ability" },
          { property: "attackSpeed", select: { id: ["janissary"] }, effect: "multiply", value: 1.35 / 1.5, type: "ability" },
          // Cavalry
          { property: "attackSpeed", select: { id: ["lancer"] }, effect: "multiply", value: 1.26 / 1.5, type: "ability" },
          { property: "attackSpeed", select: { id: ["sipahi"] }, effect: "multiply", value: 1.6 / 1.75, type: "ability" },
          // Siege
          { property: "attackSpeed", select: { id: ["trebuchet"] }, effect: "multiply", value: 9.89 / 11.375, type: "ability" },
          { property: "attackSpeed", select: { id: ["great-bombard"] }, effect: "multiply", value: 6.15 / 7, type: "ability" },
          { property: "attackSpeed", select: { id: ["springald"] }, effect: "multiply", value: 2.72 / 3.125, type: "ability" },
          { property: "attackSpeed", select: { id: ["mangonel"] }, effect: "multiply", value: 5.98 / 6.875, type: "ability" },
          { property: "attackSpeed", select: { id: ["ribauldequin"] }, effect: "multiply", value: 4.7 / 5.25, type: "ability" },
          // Naval
          { property: "attackSpeed", select: { id: ["carrack"] }, effect: "multiply", value: 4.97 / 5.615, type: "ability" },
          { property: "attackSpeed", select: { id: ["hulk"] }, effect: "multiply", value: 1.28 / 1.5, type: "ability" },
          { property: "attackSpeed", select: { id: ["grand-galley"] }, effect: "multiply", value: 3.61 / 4, type: "ability" },
          // Fallback for unmeasured units
          { property: "attackSpeed", select: { class: [["infantry"], ["cavalry", "melee"], ["cavalry", "ranged"], ["siege"]], excludeId: ["spearman", "man-at-arms", "archer", "crossbowman", "akinji", "janissary", "lancer", "sipahi", "trebuchet", "great-bombard", "springald", "mangonel", "ribauldequin"] }, effect: "multiply", value: 1 / 1.15, type: "ability" },
        ]
      }))
    }),
    uiTooltip: "The announced +15% bonus is represented by an average measured: +14.4%.",
  },

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

  {
    id: 'ability-trade-protection',
    reason: 'active:always → manual so the ability can be toggled in the selector.',
    after: (ability) => ({
      ...ability,
      active: 'manual' as const,
      minAge: 4,
      variations: ability.variations.map(v => ({ ...v, active: 'manual' as const })),
    }),
  },

  {
    id: 'ability-ranged-defense-drums',
    reason: 'minAge lowered to 2 so the ability is accessible at the mehter available ages.',
    after: (ability) => ({ ...ability, minAge: 2 }),
  },

  {
    id: 'ability-melee-defense-drums',
    reason: 'minAge lowered to 2 so the ability is accessible at the mehter available ages.',
    after: (ability) => ({ ...ability, minAge: 2 }),
  },

  {
    id: 'ability-mehter-speed-bonus',
    reason: 'active:always → manual so the ability can be toggled in the selector. Mehter added to select so it benefits from its own aura.',
    after: (ability) => ({
      ...ability,
      active: 'manual' as const,
      minAge: 2,
      variations: ability.variations.map(v => ({
        ...v,
        active: 'manual' as const,
        effects: v.effects.map(e => ({
          ...e,
          select: { ...e.select, id: ['mehter'] },
        })),
      })),
    }),
  },



  //___________
  //
  // MALIAN
  //
  //___________


  {
    id: "ability-first-strike",
    reason: "Charge-style ability — 3× base melee on first hit only for musofadi-warrior (getChargeBonus in Sandbox.tsx). Raw multiply-2 effects replaced by zero-change placeholder to keep selector visibility without permanent buff. Active set to manual.",
    after: (ability: Ability) => ({
      ...ability,
      active: "manual",
      variations: ability.variations.map((v: AbilityVariation) => ({
        ...v,
        active: "manual",
        effects: [
          {
            property: 'meleeAttack',
            select: { id: ['musofadi-warrior', 'musofadi-gunner'] },
            effect: 'change',
            value: 0,
            type: 'ability',
          }
        ]
      }))
    })
  },

  {
    id: "ability-activate-stealth",
    reason: 'Useless for this app.',
    after: (ability) => ({ ...ability, hidden: true })
  },

  {
    id: "ability-military-festival",
    reason: 'Useless for this app.',
    after: (ability) => ({ ...ability, hidden: true })
  },

  {
    id: "ability-siege-festival",
    reason: "First effect select was wrong (melee/cavalry/villager). Fix to target siege_range class.",
    after: (ability) => ({
      ...ability,
      variations: ability.variations.map(v => ({
        ...v,
        effects: v.effects.map((e, i) =>
          i === 0
            ? { ...e, select: { class: [['siege_range']] } }
            : e
        ),
      })),
    }),
  },

  {
    id: "ability-local-knowledge",
    reason: "Available for Byzantines after building Foreign Engineering Company",
    foreignEngineering: true,
    foreignEngineeringUnits: ['musofadi-warrior'],
    uiTooltip: 'Available only with Foreign Engineering Company.',
    after: (ability) => ({ ...ability, civs: [...ability.civs, 'by'], variations: ability.variations.map(v => ({ ...v, civs: [...v.civs, 'by'] })) }),
  },

  {
    id: 'ability-coastal-navigation',
    reason: 'Set to manual so the ability can be toggled in the selector.',
    after: (ability) => ({ ...ability, variations: ability.variations.map(v => ({ ...v, active: 'manual' })) }),
  },

  //___________
  //
  // MONGOLS
  //

  {
    id: 'ability-yam',
    reason: 'active:always → manual so the ability can be toggled in the selector. select extended to include ship and monk.',
    after: (ability) => ({
      ...ability,
      variations: ability.variations.map(v => ({
        ...v,
        active: 'manual' as const,
        effects: v.effects.map(e => ({
          ...e,
          select: {
            ...e.select,
            class: [...(e.select?.class ?? []), ['ship'], ['monk']],
          },
        })),
      })),
    }),
  },

  {
    id: "ability-kurultai-aura",
    reason: "Raw variation has empty effects and active:always. Kurultai grants +1 HP/s and +20% damage (melee/ranged/siege/bonus) to nearby military units.",
    after: (ability) => ({
      ...ability,
      variations: ability.variations.map(v => ({
        ...v,
        active: "manual" as const,
        effects: [
          { property: 'healingRatePerSecond', select: { class: [['military']], excludeId: ['fishing-boat'] }, effect: 'change', value: 1, type: 'passive' },
          { property: 'meleeAttack', select: { class: [['military']], excludeId: ['fishing-boat'] }, effect: 'multiply', value: 1.2, type: 'passive' },
          { property: 'rangedAttack', select: { class: [['military']], excludeId: ['fishing-boat'] }, effect: 'multiply', value: 1.2, type: 'passive' },
          { property: 'siegeAttack', select: { class: [['military']], excludeId: ['fishing-boat'] }, effect: 'multiply', value: 1.2, type: 'passive' },
          { property: 'bonusDamageMultiplier', select: { class: [['military']], excludeId: ['fishing-boat'] }, effect: 'multiply', value: 1.2, type: 'passive' },
        ],
      })),
    }),
  },

  {
    id: 'ability-yam-network-improved',
    reason: 'Improved version applies to all military units except cavalry (cavalry gets the buff from ability-yam, not both).',
    after: (ability) => ({
      ...ability,
      name: 'Yam Network',
      variations: ability.variations.map(v => ({
        ...v,
        name: 'Yam Network',
        unlockedBy: [],
        active: 'manual' as const,
        effects: v.effects.map(e => ({
          ...e,
          select: { class: [['infantry']] },
          value: 1.15,
        })),
      })),
    }),
  },

  {
    id: 'ability-maneuver-arrow',
    reason: 'Raw select targets specific classes — replaced with annihilation_condition to apply to all units.',
    after: (ability) => ({
      ...ability,
      variations: ability.variations.map(v => ({
        ...v,
        effects: v.effects.map(e => ({
          ...e,
          select: { class: [['annihilation_condition']] },
        })),
      })),
    }),
  },

  {
    id: 'ability-defense-arrow',
    reason: 'Raw select targets specific classes — replaced with annihilation_condition to apply to all units.',
    after: (ability) => ({
      ...ability,
      variations: ability.variations.map(v => ({
        ...v,
        effects: v.effects.map(e => ({
          ...e,
          select: { class: [['annihilation_condition']] },
        })),
      })),
    }),
  },

  {
    id: 'ability-attack-speed-arrow',
    reason: 'Per-unit AS corrections from in-game measurements (no uniform model). Average: +33.2% vs +50% announced.',
    after: (ability) => {
      const corrections = [
        { id: 'archer', value: 1.148 },
        { id: 'crossbowman', value: 1.117 },
        { id: 'handcannoneer', value: 1.089 },
        { id: 'mangudai', value: 1.211 },
        { id: 'khan', value: 1.090 },
        { id: 'khans-hunter', value: 1.090 },
        { id: 'khaganate-horse-archer', value: 1.109 },
        { id: 'baochuan', value: 1.057 },
        { id: 'war-junk', value: 1.076 },
        { id: 'light-junk', value: 1.124 },
      ];
      return {
        ...ability,
        variations: ability.variations.map(v => ({
          ...v,
          effects: [
            ...v.effects.map(e =>
              e.select?.class ? { ...e, select: { ...e.select, excludeId: ['battering-ram', 'fishing-boat'] } } : e
            ),
            ...corrections.map(c => ({
              property: 'attackSpeed',
              select: { id: [c.id] },
              effect: 'multiply' as const,
              value: c.value,
              type: 'ability' as const,
              duration: 5,
            })),
          ],
        })),
      };
    },
  },



  //___________
  //
  // RUS
  //
  //___________

  {
    id: "ability-static-deployment",
    reason: 'Available for Byzantines. Duration 10s (description).',
    after: (abilities) => ({
      ...abilities,
      civs: [...abilities.civs, 'by'],
      variations: abilities.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"],
        effects: (v.effects || []).map(e => ({ ...e, duration: 10, active: "manual" })),
      }))
    }),
  },

  {
    id: "ability-gallop",
    reason: 'Available for Byzantines and Mongols. Extended to khaganate-horse-archer.',
    after: (abilities) => ({
      ...abilities,
      civs: [...abilities.civs, 'by', 'mo'],
      variations: abilities.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by", "mo"],
        effects: [
          {
            property: 'moveSpeed',
            select: { id: ['horse-archer', 'khaganate-horse-archer'] },
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
    uiTooltip: 'Available only with Foreign Engineering Company.',
  },

  {
    id: "ability-saints-blessing",
    reason: "Not always active. Duration stripped — effect is considered permanent.",
    after: (ability: Ability) => ({
      ...ability,
      active: 'manual',
      variations: ability.variations.map(v => ({
        ...v,
        active: 'manual',
        effects: (v.effects || []).map(({ duration: _, ...e }) => e),
      })),
    }),
  },

  {
    id: "ability-high-armory-production-bonus",
    reason: "goldCost/woodCost mapped to costReduction (special property covering all costs).",
    after: (ability: Ability) => ({
      ...ability,
      active: 'manual',
      variations: ability.variations.map(v => ({
        ...v,
        active: 'manual',
        effects: [{
          property: 'costReduction',
          select: { class: [['siege']] },
          effect: 'multiply',
          value: 0.8,
          type: 'ability'
        }]
      }))
    }),
  },

  //___________
  //
  // ZHU XI
  //
  //___________

  {
    id: 'ability-divine-haste',
    reason: 'Raw effect uses change:15 (adds 15 tiles/s). Replaced with multiply:1.15 (+15% speed).',
    after: (ability) => ({
      ...ability,
      variations: ability.variations.map(v => ({
        ...v,
        effects: [
          { property: 'moveSpeed', select: { class: [['infantry']] }, effect: 'multiply', value: 1.15, type: 'ability' },
        ],
      })),
    }),
  },

  {
    id: 'ability-divine-charge',
    reason: 'minAge corrected from 1 to 4 (Imperial Age only).',
    update: { minAge: 4 },
  },

  {
    id: 'ability-divine-defense',
    reason: 'minAge corrected from 1 to 4 (Imperial Age only).',
    update: { minAge: 4 },
  },

  {
    id: 'ability-divine-haste',
    reason: 'minAge corrected from 1 to 4 (Imperial Age only).',
    update: { minAge: 4 },
  },

  {
    id: 'ability-ascetic-recovery',
    reason: 'Removed from UI — out-of-combat healing is not modelled in the simulator.',
    after: (ability) => ({ ...ability, hidden: true }),
  },

  {
    id: 'ability-divine-vitality',
    reason: 'Removed from UI — out-of-combat healing is not modelled in the simulator.',
    after: (ability) => ({ ...ability, hidden: true }),
  },

  {
    id: 'ability-supervise',
    reason: 'Removed from UI — building supervision has no combat relevance.',
    after: (ability) => ({ ...ability, hidden: true }),
  },

  {
    id: 'ability-body-of-iron',
    reason: 'Body of Iron: Shaolin Monk reduces incoming ranged damage by 50% for 15 seconds.',
    after: (ability) => ({
      ...ability,
      variations: ability.variations.map((v: AbilityVariation) => ({
        ...v,
        effects: [
          { property: 'rangedResistance', select: { id: ['shaolin-monk'] }, effect: 'change', value: 50, type: 'ability', duration: 15 },
        ]
      }))
    })
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
      select: { class: [['melee']], id: ["warrior-monk"] },
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

function createMingDynastyAbility(): Ability {
  return {
    id: 'ability-dynasty-ming',
    name: 'Ming Dynasty',
    type: 'ability',
    civs: ['ch', 'zx'],
    displayClasses: [],
    classes: [],
    minAge: 4,
    icon: '/abilities/AoE4_MingDynasty.png',
    description: 'Ming Dynasty.',
    unique: false,
    effects: [], // per-civ effects live in variations
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
        effects: [
          { property: 'hitpoints', select: { class: [['land_military']] }, effect: 'multiply', value: 1.15, type: 'ability' },
        ],
      },
      {
        id: 'ability-dynasty-ming-zx-4',
        baseId: 'ability-dynasty-ming',
        type: 'ability',
        name: 'Ming Dynasty',
        pbgid: 998005,
        attribName: 'ability_dynasty_ming_zx_4',
        age: 4,
        civs: ['zx'],
        description: 'Ming Dynasty: Palace Guards gain +20% attack and bonus damage.',
        classes: [],
        displayClasses: [],
        unique: false,
        costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
        producedBy: [],
        effects: [
          { property: 'meleeAttack', select: { id: ['palace-guard', 'grenadier', 'zhuge-nu', 'imperial-guard', 'yuan-raider', 'nest-of-bees', 'shaolin-monk'] }, effect: 'multiply', value: 1.2, type: 'ability' },
          { property: 'siegeAttack', select: { id: ['palace-guard', 'grenadier', 'zhuge-nu', 'imperial-guard', 'yuan-raider', 'nest-of-bees', 'shaolin-monk'] }, effect: 'multiply', value: 1.2, type: 'ability' },
          { property: 'rangedAttack', select: { id: ['palace-guard', 'grenadier', 'zhuge-nu', 'imperial-guard', 'yuan-raider', 'nest-of-bees', 'shaolin-monk'] }, effect: 'multiply', value: 1.2, type: 'ability' },
          { property: 'bonusDamageMultiplier', select: { id: ['palace-guard', 'grenadier', 'zhuge-nu', 'imperial-guard', 'yuan-raider', 'nest-of-bees', 'shaolin-monk'] }, effect: 'multiply', value: 1.2, type: 'ability' },
        ],
      },
    ],
    shared: {}
  } as Ability;
}


function createYuanDynastyAbility(): Ability {
  return {
    id: 'ability-dynasty-yuan',
    name: 'Yuan Dynasty',
    type: 'ability',
    civs: ['ch', 'zx'],
    displayClasses: [],
    classes: [],
    minAge: 3,
    icon: '/abilities/AoE4_YuanDynasty.png',
    description: 'Yuan Dynasty.',
    unique: false,
    effects: [], // per-civ effects live in variations
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
        description: 'Yuan Dynasty: all non-siege units gain +15% movement speed.',
        classes: [],
        displayClasses: [],
        unique: false,
        costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
        producedBy: [],
        effects: [
          { property: 'moveSpeed', select: { class: [['find_non_siege_land_military'], ['naval_unit']] }, effect: 'multiply', value: 1.15, type: 'ability' },
        ],
      },
      {
        id: 'ability-dynasty-yuan-zx-3',
        baseId: 'ability-dynasty-yuan',
        type: 'ability',
        name: 'Yuan Dynasty',
        pbgid: 998004,
        attribName: 'ability_dynasty_yuan_zx_3',
        age: 3,
        civs: ['zx'],
        description: 'Yuan Dynasty: all military units cost 10% less.',
        classes: [],
        displayClasses: [],
        unique: false,
        costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
        producedBy: [],
        effects: [
          { property: 'costReduction', select: { class: [['annihilation_condition']] }, effect: 'multiply', value: 0.9, type: 'ability' },
        ],
      },
    ],
    shared: {}
  } as Ability;
}

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
    { property: 'meleeAttack', select: { class: [['annihilation_condition']], excludeId: ['battering-ram', 'trade-ship', 'fishing-boat', 'trader'] }, effect: 'multiply', value: 1.1, type: 'ability', duration: 10 },
    { property: 'rangedAttack', select: { class: [['annihilation_condition']], excludeId: ['battering-ram', 'trade-ship', 'fishing-boat', 'trader'] }, effect: 'multiply', value: 1.1, type: 'ability', duration: 10 },
    { property: 'siegeAttack', select: { class: [['annihilation_condition']], excludeId: ['battering-ram', 'trade-ship', 'fishing-boat', 'trader'] }, effect: 'multiply', value: 1.1, type: 'ability', duration: 10 },
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
    civs: ['gol'],
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
      civs: ['gol'],
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
    uiTooltip: "Max value goes from 4 to 6 only if the Berkshire Palace has been constructed.",
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
    { property: 'meleeAttack', select: { class: [['land_military']], excludeId: ['shinto-priest'] }, effect: 'multiply', value: 1.2, type: 'ability', duration: 20 },
    { property: 'rangedAttack', select: { class: [['land_military']], excludeId: ['shinto-priest'] }, effect: 'multiply', value: 1.2, type: 'ability', duration: 20 },
    { property: 'siegeAttack', select: { class: [['land_military']], excludeId: ['shinto-priest'] }, effect: 'multiply', value: 1.2, type: 'ability', duration: 20 },
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
      { property: 'moveSpeed', select: { class: [['land_military']], excludeId: ['shinto-priest'] }, effect: 'multiply', value: 1.25, type: 'ability', duration: 20 },
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

// Synthetic ability — Teutonic Wrath (Knights Templar).
// Teutonic Knight reduces the opponent's melee and ranged armor by 2.
function createTeutonicWrath(): Ability {
  return {
    id: 'ability-teutonic-wrath',
    name: 'Teutonic Wrath',
    type: 'ability',
    civs: ['kt'],
    displayClasses: [],
    classes: [],
    minAge: 4,
    active: 'always',
    icon: 'public/abilities/TeutonicWrath.png',
    description: 'Teutonic Knight reduces the opponent\'s melee and ranged armor by 2.',
    unique: true,
    effects: [
      {
        property: 'armorPenetration',
        select: { class: [['human', 'military']], excludeId: ['monk'] },
        effect: 'change',
        value: 2,
        type: 'ability',
      },
    ],
    variations: [{
      id: 'ability-teutonic-wrath-4',
      baseId: 'ability-teutonic-wrath',
      type: 'manual',
      name: 'Teutonic Wrath',
      pbgid: 999400,
      attribName: 'ability_teutonic_wrath',
      age: 4,
      civs: ['kt'],
      description: 'Teutonic Knight reduces the opponent\'s melee and ranged armor by 2.',
      classes: [], displayClasses: [], unique: true,
      costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
      producedBy: [],
      effects: [],
    }],
    shared: {}
  } as Ability;
}

function createBattleGlory(): Ability {
  return {
    id: 'ability-battle-glory',
    name: 'Battle Glory',
    type: 'ability',
    civs: ['kt'],
    displayClasses: [],
    classes: [],
    minAge: 4,
    active: 'manual',
    icon: 'public/abilities/battleglory.png',
    description: 'Teutonic Knight reduces the opponent\'s melee and ranged armor by 2.',
    unique: true,
    uiTooltip: "Max is set to 999 but has no limit in game.",
    counterMax: 999,
    counterHideMax: true,
    counterStep: 1,
    counterDirection: 'additive' as const,
    counterTooltipLabel: 'kills',
    effects: [
      {
        property: 'hitpoints',
        select: { id: ['teutonic-knight'] },
        effect: 'change',
        value: 5,
        counterStepScale: 5,
        type: 'ability',
      },
      {
        property: 'meleeAttack',
        select: { id: ['teutonic-knight'] },
        effect: 'change',
        value: 1,
        counterStepScale: 1,
        type: 'ability',
      },
    ],
    variations: [{
      id: 'ability-battle-glory-4',
      baseId: 'ability-battle-glory',
      type: 'ability',
      name: 'Battle Glory',
      pbgid: 999401,
      attribName: 'ability-battle-glory',
      age: 4,
      civs: ['kt'],
      description: 'The Teutonic Knight permanently gains 5 health and 1 damage for each enemy unit it kills.',
      classes: [], displayClasses: [], unique: true,
      costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
      producedBy: [],
      effects: [],
    }],
    shared: {}
  } as Ability;
}

function createKnightlyBrotherhood(): Ability {
  return {
    id: 'ability-knightly-brotherhood',
    name: 'Knightly Brotherhood',
    type: 'ability',
    civs: ['kt'],
    displayClasses: [],
    classes: [],
    minAge: 2,
    active: 'manual',
    icon: 'public/abilities/Knightly_brotherhood.png',
    description: 'Teutonic Knight reduces the opponent\'s melee and ranged armor by 2.',
    unique: true,
    counterMax: 200,
    counterHideMax: true,
    counterStep: 1,
    counterDirection: 'additive' as const,
    counterTooltipLabel: 'Knights',
    effects: [
      {
        property: 'hitpoints',
        select: { id: ['chevalier-confrere'] },
        effect: 'change',
        value: 1,
        counterStepScale: 1,
        type: 'ability',
      },
    ],
    variations: [{
      id: 'ability-knightly-brotherhood-2',
      baseId: 'ability-knightly-brotherhood',
      type: 'ability',
      name: 'Knightly Brotherhood',
      pbgid: 999401,
      attribName: 'ability-knightly-brotherhood',
      age: 4,
      civs: ['kt'],
      description: 'The Teutonic Knight permanently gains 5 health and 1 damage for each enemy unit it kills.',
      classes: [], displayClasses: [], unique: true,
      costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
      producedBy: [],
      effects: [],
    }],
    shared: {}
  } as Ability;
}

// Synthetic ability — Bludgeoning Attacks (Szlachta Cavalry).
// Szlachta Cavalry reduces the opponent's attack speed by 20%.
function createBludgeoningAttacks(): Ability {
  return {
    id: 'ability-bludgeoning-attacks',
    name: 'Bludgeoning Attacks',
    type: 'ability',
    civs: ['kt'],
    displayClasses: [],
    classes: [],
    minAge: 4,
    active: 'always',
    icon: 'public/abilities/Bludgeoning-attacks.png',
    description: 'Szlachta Cavalry reduces the opponent\'s attack speed by 20%.',
    unique: true,
    effects: [
      {
        property: 'opponentAttackSpeedDebuff',
        select: { id: ['szlachta-cavalry'] },
        effect: 'change',
        value: 0.20,
        type: 'ability',
      },
    ],
    variations: [{
      id: 'ability-bludgeoning-attacks-4',
      baseId: 'ability-bludgeoning-attacks',
      type: 'ability',
      name: 'Bludgeoning Attacks',
      pbgid: 999500,
      attribName: 'ability_bludgeoning_attacks',
      age: 4,
      civs: ['kt'],
      description: 'Szlachta Cavalry reduces the opponent\'s attack speed by 20%.',
      classes: [], displayClasses: [], unique: true,
      costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
      producedBy: [],
      effects: [],
    }],
    shared: {}
  } as Ability;
}

function createRuleOfTemplars(): Ability {
  return {
    id: 'ability-rule-of-templars',
    name: 'Rule of Templars',
    type: 'ability',
    civs: ['kt'],
    displayClasses: [],
    classes: [],
    minAge: 3,
    active: 'always',
    icon: 'https://data.aoe4world.com/images/technologies/rule-of-templars-3.png',
    description: 'Gain +2 charge damage per nearby charging Heavy Cavalry.',
    unique: true,
    counterMax: 200,
    counterHideMax: true,
    counterStep: 1,
    counterDirection: 'additive' as const,
    counterTooltipLabel: 'Charging knights',
    effects: [
      {
        property: 'chargeChange',
        select: { id: ['templar-brother'] },
        effect: 'change',
        value: 2,
        counterStepScale: 2,
        type: 'ability',
      },
    ],
    variations: [{
      id: 'ability-rule-of-templars-3',
      baseId: 'ability-rule-of-templars',
      type: 'ability',
      name: 'Rule of Templars',
      pbgid: 999501,
      attribName: 'ability-rule-of-templars',
      age: 4,
      civs: ['kt'],
      description: 'Gain +2 charge damage per nearby charging Heavy Cavalry.',
      classes: [], displayClasses: [], unique: true,
      costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
      producedBy: [],
      effects: [],
    }],
    shared: {}
  } as Ability;
}

function createHarborAura(): Ability {
  return {
    id: 'ability-harbor-aura',
    name: 'Harbor Aura',
    type: 'ability',
    civs: ['kt'],
    displayClasses: [],
    classes: [],
    minAge: 1,
    active: 'manual',
    icon: 'public/abilities/templar_harbor.png',
    description: 'Increase the hit points of nearby naval units by 15%.',
    unique: true,
    effects: [
      {
        property: 'hitpoints',
        select: { class: [['naval_unit']] },
        effect: 'multiply',
        value: 1.15,
        type: 'ability',
      },
    ],
    variations: [{
      id: 'ability-harbor-aura-1',
      baseId: 'ability-harbor-aurars',
      type: 'ability',
      name: 'Harbor Aura',
      pbgid: 999502,
      attribName: 'ability-rule-of-templars',
      age: 4,
      civs: ['kt'],
      description: 'Increase the hit points of nearby naval units by 15%.',
      classes: [], displayClasses: [], unique: true,
      costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
      producedBy: [],
      effects: [],
    }],
    shared: {}
  } as Ability;
}

// Synthetic abilities — Streltsy weapon swap (Berdysh Axe ↔ Handcannon).
function createStreltsyBerdysh(): Ability {
  return {
    id: 'ability-streltsy-berdysh',
    name: 'Berdysh Axe',
    type: 'ability',
    civs: ['ru', 'by'],
    displayClasses: [],
    classes: [],
    minAge: 4,
    active: 'manual',
    icon: 'https://data.aoe4world.com/images/abilities/ability-desert-raider-blade-1.png',
    description: 'Switch to melee Berdysh Axe.',
    unique: false,
    effects: [],
    variations: [{
      id: 'ability-streltsy-berdysh-4',
      baseId: 'ability-streltsy-berdysh',
      type: 'ability',
      name: 'Berdysh Axe',
      pbgid: 999600,
      attribName: 'ability_streltsy_berdysh',
      age: 4,
      civs: ['ru', 'by'],
      description: 'Switch to melee Berdysh Axe.',
      classes: [], displayClasses: [], unique: false,
      costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
      producedBy: [],
      effects: [{
        property: 'unknown',
        select: { id: ['streltsy'] },
        effect: 'change',
        value: 0,
        type: 'ability',
      }],
    }],
    shared: {}
  } as Ability;
}

function createStreltsyHandcannon(): Ability {
  return {
    id: 'ability-streltsy-handcannon',
    name: 'Handcannon',
    type: 'ability',
    civs: ['ru', 'by'],
    displayClasses: [],
    classes: [],
    minAge: 4,
    active: 'manual',
    icon: 'https://data.aoe4world.com/images/units/streltsy-4.png',
    description: 'Switch to ranged Handcannon.',
    unique: false,
    effects: [],
    variations: [{
      id: 'ability-streltsy-handcannon-4',
      baseId: 'ability-streltsy-handcannon',
      type: 'ability',
      name: 'Handcannon',
      pbgid: 999601,
      attribName: 'ability_streltsy_handcannon',
      age: 4,
      civs: ['ru', 'by'],
      description: 'Switch to ranged Handcannon.',
      classes: [], displayClasses: [], unique: false,
      costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
      producedBy: [],
      effects: [{
        property: 'unknown',
        select: { id: ['streltsy'] },
        effect: 'change',
        value: 0,
        type: 'ability',
      }],
    }],
    shared: {}
  } as Ability;
}

function createAbbeyOfTheTrinityAbility(): Ability {
  return {
    id: 'ability-abbey-of-the-trinity',
    name: 'Abbey of the Trinity',
    type: 'ability',
    civs: ['ru'],
    displayClasses: [],
    classes: [],
    minAge: 3,
    active: 'manual',
    icon: 'https://data.aoe4world.com/images/buildings/abbey-of-the-trinity-2.png',
    description: 'Reduces the food and gold cost of Warrior Monks by 50%.',
    unique: true,
    effects: [
      {
        property: 'foodCostReduction',
        select: { id: ['warrior-monk'] },
        effect: 'multiply',
        value: 0.5,
        type: 'ability',
      },
      {
        property: 'goldCostReduction',
        select: { id: ['warrior-monk'] },
        effect: 'multiply',
        value: 0.5,
        type: 'ability',
      },
    ],
    variations: [{
      id: 'ability-abbey-of-the-trinity-3',
      baseId: 'ability-abbey-of-the-trinity',
      type: 'ability',
      name: 'Abbey of the Trinity',
      pbgid: 999602,
      attribName: 'ability_abbey_of_the_trinity',
      age: 3,
      civs: ['ru'],
      description: 'Reduces the food and gold cost of Warrior Monks by 50%.',
      classes: [], displayClasses: [], unique: true,
      costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
      producedBy: [],
      effects: [],
    }],
    shared: {}
  } as Ability;
}


//_____________________
//
// MACEDONIAN DYNASTY
//
//_____________________

function createRunestones(): Ability {
  return {
    id: 'ability-runestones',
    name: 'Runestones',
    type: 'ability',
    civs: ['mac'],
    displayClasses: [],
    classes: [],
    minAge: 1,
    active: 'manual',
    icon: 'https://data.aoe4world.com/images/buildings/runestones-1.png',
    description: 'Melee units gain +1 attack, ranged infantry gain +1 range, all units gain +15% movement speed.',
    unique: true,
    effects: [
      { property: 'meleeAttack', select: { id: ['atgeirmadr', 'varangian-guard', 'hippodrome-riddari', 'riddari'] }, effect: 'change', value: 1, type: 'ability' },
      { property: 'maxRange', select: { id: ['bogmadr'] }, effect: 'change', value: 1, type: 'ability' },
      { property: 'moveSpeed', select: { id: ['atgeirmadr', 'bogmadr', 'varangian-guard', 'hippodrome-riddari', 'riddari'] }, effect: 'multiply', value: 1.15, type: 'ability' },
    ],
    variations: [{
      id: 'ability-runestones-1',
      baseId: 'ability-runestones',
      type: 'ability',
      name: 'Runestones',
      pbgid: 999500,
      attribName: 'ability-runestones',
      age: 1,
      civs: ['mac'],
      description: 'Melee units gain +1 attack, ranged infantry gain +1 range, all units gain +15% movement speed.',
      classes: [], displayClasses: [], unique: true,
      costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
      producedBy: [],
      effects: [],
    }],
    shared: {}
  } as Ability;
}

function createStrongerTogether(): Ability {
  return {
    id: 'ability-stronger-together',
    name: 'Stronger Together',
    type: 'ability',
    civs: ['mac'],
    displayClasses: [],
    classes: [],
    minAge: 1,
    active: 'manual',
    icon: 'public/abilities/Stronger_Together.png',
    description: 'The attack speed of the Atgeirmaðr is increased by 2% for every other Varangian unit within a 1-tile radius.',
    unique: true,
    counterMax: 18,
    counterSteps: [-0.01, -0.01, -0.01, -0.01, -0.01, -0.20, -0.01, -0.01, -0.01, -0.01, -0.01, -0.01, -0.01, -0.01, -0.01, -0.01, -0.28],
    counterDirection: 'additive' as const,
    counterTooltipLabel: 'stacks',
    uiTooltip: "Gains are uneven: −0.01s per stack normally, −0.20s at stack 6, −0.28s at stack 17. No further gain beyond stack 17.",
    effects: [
      { property: 'attackSpeed', select: { id: ['atgeirmadr'] }, effect: 'change', value: -1, type: 'ability' },
    ],
    variations: [{
      id: 'ability-stronger-together-1',
      baseId: 'ability-stronger-together',
      type: 'ability',
      name: 'Stronger Together',
      pbgid: 999501,
      attribName: 'ability-stronger-together',
      age: 1,
      civs: ['mac'],
      description: 'Atgeirmadr gains +0.2% attack speed per stack (up to 100 stacks).',
      classes: [], displayClasses: [], unique: true,
      costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
      producedBy: [],
      effects: [],
    }],
    shared: {}
  } as Ability;
}

function createCheirosiphonGarrison(): Ability {
  return {
    id: 'ability-cheirosiphon-garrison',
    name: 'Garrison Varangian Guards',
    type: 'ability',
    civs: ['mac'],
    displayClasses: [], classes: [],
    minAge: 2, active: 'manual',
    icon: 'https://data.aoe4world.com/images/units/varangian-guard-3.png',
    description: 'Cheirosiphon gains +1 melee and +1 ranged armor for every garrisoned Varangian Guard (up to 16).',
    unique: true,
    counterMax: 16,
    counterStep: 1,
    counterDirection: 'additive' as const,
    counterTooltipLabel: 'Varangian Guards',
    effects: [
      { property: 'meleeArmor', select: { id: ['cheirosiphon'] }, effect: 'change', value: 1, type: 'ability' },
      { property: 'rangedArmor', select: { id: ['cheirosiphon'] }, effect: 'change', value: 1, type: 'ability' },
    ],
    variations: [{
      id: 'ability-cheirosiphon-garrison-2',
      baseId: 'ability-cheirosiphon-garrison',
      type: 'ability',
      name: 'Garrison Varangian Guards',
      pbgid: 999630,
      attribName: 'ability-cheirosiphon-garrison',
      age: 2, civs: ['mac'],
      description: 'Cheirosiphon gains +1 melee and +1 ranged armor for every garrisoned Varangian Guard (up to 16).',
      classes: [], displayClasses: [], unique: true,
      costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
      producedBy: [],
      effects: [],
    }],
    shared: {}
  } as Ability;
}

function createProlongedSiege(): Ability {
  return {
    id: 'ability-prolonged-siege',
    name: 'Prolonged Siege',
    type: 'ability',
    civs: ['mac'],
    displayClasses: [], classes: [],
    minAge: 4, active: 'manual',
    icon: 'https://data.aoe4world.com/images/technologies/prolonged-siege-4.png',
    description: 'Siege units deal 10% additional damage per stack, up to a maximum of 50%.',
    unique: true,
    counterMax: 5,
    counterStep: 0.1,
    counterDirection: 'increase' as const,
    counterTooltipLabel: 'stacks',
    effects: [
      { property: 'siegeAttack', select: { class: [['siege']] }, effect: 'multiply', value: 1, type: 'ability' },
    ],
    variations: [{
      id: 'ability-prolonged-siege-4',
      baseId: 'ability-prolonged-siege',
      type: 'ability',
      name: 'Prolonged Siege',
      pbgid: 999620,
      attribName: 'ability-prolonged-siege',
      age: 4, civs: ['mac'],
      description: 'Siege units deal 10% additional damage per stack, up to a maximum of 50%.',
      classes: [], displayClasses: [], unique: true,
      costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
      producedBy: [],
      effects: [],
    }],
    shared: {}
  } as Ability;
}

// Synthetic abilities — Riddari weapon swap (Melee ↔ Thrown Axes).
function createRiddariMelee(): Ability {
  return {
    id: 'ability-riddari-melee',
    name: 'Melee',
    type: 'ability',
    civs: ['mac'],
    displayClasses: [], classes: [],
    minAge: 2, active: 'manual',
    icon: 'https://data.aoe4world.com/images/units/riddari-3.png',
    description: 'Switch to melee Sword.',
    unique: false,
    effects: [],
    variations: [{
      id: 'ability-riddari-melee-2',
      baseId: 'ability-riddari-melee',
      type: 'ability',
      name: 'Melee',
      pbgid: 999610,
      attribName: 'ability-riddari-melee',
      age: 2, civs: ['mac'],
      description: 'Switch to melee Sword.',
      classes: [], displayClasses: [], unique: false,
      costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
      producedBy: [],
      effects: [{
        property: 'unknown',
        select: { id: ['riddari', 'hippodrome-riddari'] },
        effect: 'change',
        value: 0,
        type: 'ability',
      }],
    }],
    shared: {}
  } as Ability;
}

function createRiddariThrownAxes(): Ability {
  return {
    id: 'ability-riddari-thrown-axes',
    name: 'Thrown Axes',
    type: 'ability',
    civs: ['mac'],
    displayClasses: [], classes: [],
    minAge: 2, active: 'manual',
    icon: 'public/abilities/Thrown_Axes.png',
    description: 'Switch to ranged Throwing Axe attack.',
    unique: false,
    effects: [],
    variations: [{
      id: 'ability-riddari-thrown-axes-2',
      baseId: 'ability-riddari-thrown-axes',
      type: 'ability',
      name: 'Thrown Axes',
      pbgid: 999611,
      attribName: 'ability-riddari-thrown-axes',
      age: 2, civs: ['mac'],
      description: 'Switch to ranged Throwing Axe attack.',
      classes: [], displayClasses: [], unique: false,
      costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
      producedBy: [],
      effects: [{
        property: 'unknown',
        select: { id: ['riddari', 'hippodrome-riddari'] },
        effect: 'change',
        value: 0,
        type: 'ability',
        duration: 10,
      }],
    }],
    shared: {}
  } as Ability;
}

function createRiddariChampionAura(): Ability {
  return {
    id: 'ability-riddari-champion-aura',
    name: 'Riddari Champion Aura',
    type: 'ability',
    civs: ['mac'],
    displayClasses: [], classes: [],
    minAge: 2, active: 'manual',
    icon: 'public/abilities/Riddari_Champion_Aura.png',
    description: 'Increases move speed of all infantry within a 5-tile radius by +10%.',
    unique: true,
    effects: [
      { property: 'moveSpeed', select: { class: [['infantry']] }, effect: 'multiply', value: 1.1, type: 'ability' },
    ],
    variations: [{
      id: 'ability-riddari-champion-aura-1',
      baseId: 'ability-riddari-champion-aura',
      type: 'ability',
      name: 'Riddari Champion Aura',
      pbgid: 999502,
      attribName: 'ability-riddari-champion-aura',
      age: 2, civs: ['mac'],
      description: 'Increases move speed of all infantry within a 5-tile radius by +10%.',
      classes: [], displayClasses: [], unique: true,
      costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
      producedBy: [], effects: [],
    }],
    shared: {}
  } as Ability;
}

function createHorsemanChampionAura(): Ability {
  return {
    id: 'ability-horseman-champion-aura',
    name: 'Horseman Champion Aura',
    type: 'ability',
    civs: ['mac'],
    displayClasses: [], classes: [],
    minAge: 2, active: 'manual',
    icon: 'public/abilities/Horseman_Champion_Aura.png',
    description: 'Increases the melee attack damage of all cavalry within a 5-tile radius by +2.',
    unique: true,
    effects: [
      { property: 'meleeAttack', select: { class: [['cavalry']], excludeId: ['hippodrome-horseman'] }, effect: 'change', value: 2, type: 'ability' },
    ],
    variations: [{
      id: 'ability-horseman-champion-aura-1',
      baseId: 'ability-horseman-champion-aura',
      type: 'ability',
      name: 'Horseman Champion Aura',
      pbgid: 999502,
      attribName: 'ability-horseman-champion-aura',
      age: 2, civs: ['mac'],
      description: 'Increases the melee attack damage of all cavalry within a 5-tile radius by +2.',
      classes: [], displayClasses: [], unique: true,
      costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
      producedBy: [], effects: [],
    }],
    shared: {}
  } as Ability;
}

function createUnwaveringFocus(): Ability {
  return {
    id: 'ability-unwavering-focus',
    name: 'Unwavering Focus',
    type: 'ability',
    civs: ['mac'],
    displayClasses: [], classes: [],
    minAge: 2, active: 'manual',
    icon: 'public/abilities/Unwavering_Focus_AoE4.png',
    description: 'Attacks ignore 2 armor, but move speed is reduced by 50% for 10 seconds. Unwavering Focus has a 30 second cooldown for each individual Bogmaðr.',
    unique: true,
    effects: [
      { property: 'armorPenetration', select: { id: ['bogmadr'] }, effect: 'change', value: 2, type: 'ability', duration: 10 },
      { property: 'moveSpeed', select: { id: ['bogmadr'] }, effect: 'multiply', value: 0.5, type: 'ability', duration: 10 },
    ],
    variations: [{
      id: 'ability-unwavering-focus-2',
      baseId: 'ability-unwavering-focus',
      type: 'ability',
      name: 'Unwavering Focus',
      pbgid: 999503,
      attribName: 'ability-unwavering-focus',
      age: 2, civs: ['mac'],
      description: 'Attacks ignore 2 armor, but move speed is reduced by 50% for 10 seconds.',
      classes: [], displayClasses: [], unique: true,
      costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
      producedBy: [], effects: [],
    }],
    shared: {}
  } as Ability;
}

//_____________________
//
// MONGOL
//
//_____________________

function createKhanHunterRangeAura(): Ability {
  const makeVariation = (age: number, baseValue: number) => ({
    id: `ability-khan-hunter-range-aura-${age}`,
    baseId: 'ability-khan-hunter-range-aura',
    type: 'ability' as const,
    name: 'Range Aura',
    pbgid: 0,
    attribName: '',
    age,
    civs: ['mo'],
    description: `Increases the range of nearby ranged units by +${baseValue}. Cavalry Archers gain an additional +0.5.`,
    classes: [],
    displayClasses: [],
    costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
    producedBy: [],
    effects: [
      { property: 'maxRange', select: { class: [['archer']] }, effect: 'change', value: baseValue, type: 'ability' },
      { property: 'maxRange', select: { class: [['ranged', 'cavalry']] }, effect: 'change', value: 0.5, type: 'ability' },
    ],
  });

  return {
    id: 'ability-khan-hunter-range-aura',
    name: 'Range Aura',
    type: 'ability',
    civs: ['mo'],
    displayClasses: [],
    classes: [],
    minAge: 2,
    active: 'manual',
    icon: '/abilities/AoE4_RangeAura_KhanHunter.png',
    description: 'Increases the range of ranged units within a 4-tile radius by +0.5/+0.8/+1 in the Feudal/Castle/Imperial Age. Cavalry Archers gain an additional +0.5.',
    unique: false,
    effects: [],
    variations: [
      makeVariation(2, 0.5),
      makeVariation(3, 0.8),
      makeVariation(4, 1),
    ],
    shared: {},
  } as Ability;
}

//_____________________
//
// MALIAN
//
//_____________________

function createFarimaLeadershipAbility(): Ability {
  return {
    id: 'ability-farima-leadership',
    name: 'Farima Leadership',
    type: 'ability',
    civs: ['ma'],
    displayClasses: [],
    classes: [],
    minAge: 4,
    active: 'manual',
    icon: 'https://data.aoe4world.com/images/technologies/farima-leadership-4.png',
    description: 'Sofa increase the movement speed of nearby infantry by +15%.',
    unique: true,
    effects: [
      {
        property: 'moveSpeed',
        select: { class: [['infantry']] },
        effect: 'multiply',
        value: 1.15,
        type: 'ability',
      }
    ],
    variations: [
      {
        id: 'ability-farima-leadership-4',
        baseId: 'ability-farima-leadership',
        type: 'ability',
        name: 'Farima Leadership',
        pbgid: 0,
        attribName: '',
        age: 4,
        civs: ['ma'],
        description: 'Sofa increase the movement speed of nearby infantry by +15%.',
        classes: [],
        displayClasses: [],
        unique: true,
        costs: { food: 250, wood: 0, stone: 0, gold: 500, vizier: 0, oliveoil: 0, total: 750, popcap: 0, time: 60 },
        producedBy: ['stable'],
        effects: [],
      }
    ],
    shared: {}
  } as Ability;
}

function createLocalKnowledgeAbility(): Ability {
  return {
    id: 'ability-local-knowledge',
    name: 'Local Knowledge',
    type: 'ability',
    civs: ['ma'],
    displayClasses: [],
    classes: [],
    minAge: 2,
    active: 'manual',
    icon: 'https://data.aoe4world.com/images/technologies/local-knowledge-2.png',
    description: 'Musofadi Warriors and Musofadi Gunners gain +5 healing per attack for 5 seconds after coming out of stealth.',
    unique: false,
    effects: [
      {
        property: 'healingRate',
        select: { id: ['musofadi-warrior', 'musofadi-gunner'] },
        effect: 'change',
        value: 5,
        type: 'ability',
        duration: 5,
      }
    ],
    variations: [
      {
        id: 'ability-local-knowledge-2',
        baseId: 'ability-local-knowledge',
        type: 'ability',
        name: 'Local Knowledge',
        pbgid: 0,
        attribName: '',
        age: 2,
        civs: ['ma'],
        description: 'Musofadi Warriors and Musofadi Gunners gain +5 healing per attack for 5 seconds after coming out of stealth.',
        classes: [],
        displayClasses: [],
        unique: false,
        costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
        producedBy: [],
        effects: [],
      }
    ],
    shared: {}
  } as Ability;
}

function createJavelinThrow(): Ability {
  return {
    id: 'javelin-throw',
    name: 'Javelin Throw',
    type: 'ability',
    civs: ['ma'],
    displayClasses: [],
    classes: [],
    minAge: 1,
    active: 'always',
    icon: '/abilities/AoE4_JavelinThrow.png',
    description: 'If the target enemy unit is further than 2.5 tiles away, the Donso will throw a javelin at it and then immediately move in to engage in melee mode. The ability has a 15 second cooldown. To throw another javelin, the Donso must then move out of its minimum range again.',
    unique: false,
    effects: [{
      property: 'unknown',
      select: { id: ['donso'] },
      effect: 'change',
      value: 0,
      type: 'ability',
    }],
    variations: [{
      id: 'javelin-throw-1',
      baseId: 'javelin-throw',
      type: 'ability',
      name: 'Javelin Throw',
      pbgid: 999301,
      attribName: 'ability_javelin_throw',
      age: 1,
      civs: ['ma'],
      description: 'If the target enemy unit is further than 2.5 tiles away, the Donso will throw a javelin at it and then immediately move in to engage in melee mode. The ability has a 15 second cooldown. To throw another javelin, the Donso must then move out of its minimum range again.',
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
// ORDER OF THE DRAGON
//
//___________

function createBurgravePalaceAbility(): Ability {
  return {
    id: 'ability-burgrave-palace',
    name: 'Burgrave Palace',
    type: 'ability',
    civs: ['od'],
    displayClasses: [],
    classes: [],
    minAge: 3,
    icon: 'https://data.aoe4world.com/images/buildings/burgrave-palace-2.png',
    description: 'The Burgrave Palace produces units at a 35% discount.',
    unique: true,
    effects: [{
      property: 'costReduction',
      select: { class: [['melee', 'infantry']] },
      effect: 'multiply',
      value: 0.65,
      type: 'ability',
    }],
    variations: [{
      id: 'ability-burgrave-palace-3',
      baseId: 'ability-burgrave-palace',
      type: 'ability',
      name: 'Burgrave Palace',
      pbgid: 999302,
      attribName: 'ability_burgrave_palace',
      age: 3,
      civs: ['od'],
      description: 'The Burgrave Palace produces units at a 35% discount.',
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
// ZHU XI
//
//___________


function createHardCasedBombs(): Ability {
  return {
    id: 'ability-hard-cased-bombs',
    name: 'Hard Cased Bombs',
    type: 'ability',
    civs: ['zx'],
    displayClasses: [],
    classes: [],
    minAge: 3,
    active: 'manual',
    icon: 'https://data.aoe4world.com/images/technologies/hard-cased-bombs-3.png',
    description: 'Units receive +15% Ranged and Melee damage for 5 seconds when hit by a Grenade.',
    unique: true,
    effects: [
      { property: 'meleeAttack', select: { class: [['land_military', 'human']], excludeId: ['grenadier', 'monk'] }, effect: 'multiply', value: 1.15, type: 'ability' },
      { property: 'rangedAttack', select: { class: [['land_military', 'human']], excludeId: ['grenadier', 'monk'] }, effect: 'multiply', value: 1.15, type: 'ability' },
    ],
    variations: [{
      id: 'ability-hard-cased-bombs-3',
      baseId: 'ability-hard-cased-bombs',
      type: 'ability',
      name: 'Hard Cased Bombs',
      pbgid: 999601,
      attribName: 'ability-hard-cased-bombs',
      age: 3,
      civs: ['zx'],
      description: 'Units receive +15% Ranged and Melee damage for 5 seconds when hit by a Grenade.',
      classes: [], displayClasses: [], unique: true,
      costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 },
      producedBy: [],
      effects: [],
    }],
    shared: {}
  } as Ability;
}

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
    createJavelinThrow(),
    createHouseUnified(),
    createBuddhistConversion(),
    createNehan(),
    createTeutonicWrath(),
    createBattleGlory(),
    createKnightlyBrotherhood(),
    createBludgeoningAttacks(),
    createRuleOfTemplars(),
    createHarborAura(),
    createStreltsyBerdysh(),
    createStreltsyHandcannon(),
    createAbbeyOfTheTrinityAbility(),
    createRunestones(),
    createStrongerTogether(),
    createRiddariChampionAura(),
    createHorsemanChampionAura(),
    createUnwaveringFocus(),
    createRiddariMelee(),
    createRiddariThrownAxes(),
    createProlongedSiege(),
    createCheirosiphonGarrison(),
    createLocalKnowledgeAbility(),
    createFarimaLeadershipAbility(),
    createKhanHunterRangeAura(),
    createBurgravePalaceAbility(),
    createHardCasedBombs(),
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
