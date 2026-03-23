import type { TechnologyPatch } from './types';
import { deepMerge } from './types';
import type { Technology, TechnologyVariation } from '../unified-technologies';

export const technologyPatches: TechnologyPatch<Technology, TechnologyVariation>[] = [
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
    ]
  },

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
    reason: 'aoe4world does not list the bonus damage targets for Chemistry on gunpowder units. In-game, Chemistry grants +25% bonus damage vs war elephants, buildings, naval units and infantry to gunpowder siege and warships.',
    update: {
      effects: [
        {
          property: 'siegeAttack',
          select: { class: [['gunpowder', 'siege'], ['gunpowder', 'warship']] },
          effect: 'multiply',
          value: 1.25,
          type: 'bonus',
          target: { class: [["war", "elephant"]] }
        },
        {
          property: 'siegeAttack',
          select: { class: [['gunpowder', 'siege'], ['gunpowder', 'warship']] },
          effect: 'multiply',
          value: 1.25,
          type: 'bonus',
          target: { class: [['building']] }
        },
        {
          property: 'siegeAttack',
          select: { class: [['gunpowder', 'siege'], ['gunpowder', 'warship']] },
          effect: 'multiply',
          value: 1.25,
          type: 'bonus',
          target: { class: [['naval_unit']] }
        },
        {
          property: 'siegeAttack',
          select: { class: [['gunpowder', 'siege'], ['gunpowder', 'warship']] },
          effect: 'multiply',
          value: 1.25,
          type: 'bonus',
          target: { class: [['war_elephant']] }
        },
        {
          property: 'siegeAttack',
          select: { class: [['gunpowder', 'siege'], ['gunpowder', 'warship']] },
          effect: 'multiply',
          value: 1.25,
          type: 'bonus',
          target: { class: [['infantry']] }
        }
      ]
    }
  }
];

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
