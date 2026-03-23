import { TechnologyPatch, deepMerge } from "./types";
import { Ability, AbilityVariation } from "../unified-abilities";

export const abilityPatches: TechnologyPatch<Ability, AbilityVariation>[] = [
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
// aoe4world does not model the charge attack mechanic. In-game, knights and ghulams
// deal bonus damage on their first attack after a charge. The bonus scales with age
// (knight: +10/+12/+14, ghulam: +5/+6) and is applied separately in combat.ts.
function createChargeAttackAbility(): Ability {
  return {
    id: 'charge-attack',
    name: 'Charge Attack',
    type: 'ability',
    civs: [],
    displayClasses: [],
    classes: [],
    minAge: 1,
    icon: 'https://data.aoe4world.com/images/abilities/ability-tactical-charge-1.png',
    description: 'Charge before attacking when unit is far enough',
    unique: false,
    active: 'always',
    effects: [
      {
        property: 'bonusDamage',
        select: {
          class: [['knight'], ['merc_ghulam']]
        },
        effect: 'change',
        value: 10,
        type: 'ability'
      }
    ],
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
        description: 'Charge before attacking when unit is far enough',
        classes: [],
        displayClasses: [],
        unique: false,
        costs: {
          food: 0,
          wood: 0,
          stone: 0,
          gold: 0,
          vizier: 0,
          oliveoil: 0,
          total: 0,
          popcap: 0,
          time: 0
        },
        producedBy: [],
        effects: [
          {
            property: 'bonusDamage',
            select: {
              class: [['knight'], ['merc_ghulam']]
            },
            effect: 'change',
            value: 10,
            type: 'ability'
          }
        ]
      }
    ],
    shared: {}
  } as Ability;
}

export function applyAbilityPatches(abilities: Ability[]): Ability[] {
  // Ajouter l'ability de charge créée
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
