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
    uiTooltip: 'Versus mode: Reduces enemy horse cavalry damage by 20%',
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
          value: 1 / 1.2,
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
          { property: 'attackSpeed', select: { id: ['limitanei'] }, effect: 'multiply', value: 0.75, type: 'ability' },
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


  //___________
  //
  // ENGLISH
  //
  //___________

  {
    id: "ability-arrow-volley",
    reason: 'Available for Byzantines after building Foreign Engineering Company. Duration is not yet considered.',
    after: (abilities) => ({
      ...abilities,
      civs: [...abilities.civs, 'by'],
      variations: abilities.variations.map(v => ({
        ...v,
        civs: [...(v.civs || []), "by"]
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
            property: 'meleeVulnerability',
            select: { id: ['sipahi'] },
            effect: 'change',
            value: 50,
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
    reason: 'Available for Byzantines.',
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

export function applyAbilityPatches(abilities: Ability[]): Ability[] {
  // Add the created charge ability
  const chargeAttackAbility = createChargeAttackAbility();
  const abilitiesWithCharge = [...abilities, chargeAttackAbility];

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
