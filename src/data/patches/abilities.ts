import { TechnologyPatch, deepMerge } from "./types";
import { Ability, AbilityVariation } from "../unified-abilities";

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
      ]
    }
  },
  {
    id: 'ability-camel-unease',
    reason: 'Synthetic gameplay rule: aoe4world does not model the Camel Unease debuff. In-game, camel units passively reduce the attack of nearby horse cavalry by 20%. Modelled here as a versusOpponentDamageDebuff effect (×0.8).',
    uiTooltip: 'Versus mode: Reduces enemy horse cavalry damage by 20%',
    update: {
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
    }
  },
  {
    id: 'ability-golden-age-tier-4',
    reason: 'Ayyubid Golden Age Tier 4: siege units cost 20% less. Property "unknown" mapped to "costReduction". minAge fixed from 5 to 4 (no Age V exists).',
    uiTooltip: 'Siege units cost 20% less to produce',
    after: (ability: Ability) => ({
      ...ability,
      minAge: 4,
      effects: [
        {
          property: 'costReduction',
          select: { class: [['siege']] },
          effect: 'multiply',
          value: 0.8,
          type: 'ability'
        }
      ]
    })
  },
  {
    id: 'ability-golden-age-tier-5',
    reason: 'Ayyubid Golden Age Tier 5: camel units attack 20% faster. Property "unknown" mapped to "attackSpeed". minAge fixed from 5 to 4 (no Age V exists).',
    uiTooltip: 'Camel units attack 20% faster',
    after: (ability: Ability) => ({
      ...ability,
      minAge: 4,
      effects: [
        {
          property: 'attackSpeed',
          select: { id: ['camel-lancer', 'desert-raider'] },
          effect: 'multiply',
          value: 1 / 1.2,
          type: 'ability'
        }
      ]
    })
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
  }
];

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
      effect: 'change',
      value: 0.2, // +20% speed until first attack
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
    active: 'always',
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
        effects: chargeEffects,
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
