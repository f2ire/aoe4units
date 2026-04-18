import type { UnitUnifiedPatch } from './types';
import { deepMerge } from './types';

// IMPORTANT: this file does not depend on any runtime values from unified-units.ts to avoid circular imports.
// Structures are manipulated by shape with deepMerge.

// Helper function to transform multi-value class arrays into combined identifiers
function transformMultiClassTargets(value: unknown): unknown {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value;
  if (value === null) return value;

  if (Array.isArray(value)) {
    // Check if it is an array of 2 strings (["archer", "ship"] -> "archer_ship")
    if (
      value.length === 2 &&
      typeof value[0] === 'string' &&
      typeof value[1] === 'string' &&
      !value.some(v => typeof v === 'object')
    ) {
      // This is potentially a multi-class target
      // Transform it into a combined identifier
      return value.join('_');
    }
    // Otherwise, apply the transformation recursively
    return value.map(v => transformMultiClassTargets(v));
  }

  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      result[key] = transformMultiClassTargets(val);
    }
    return result;
  }

  return value;
}

export const unitPatches: UnitUnifiedPatch<unknown, unknown>[] = [


  //_________
  //
  // BASE UNITS
  //
  //_________

  // Demolition ships self-destruct on contact — they can only kill if hitsToKill === 1

  ...((['explosive-dhow', 'demolition-ship', 'explosive-junk', 'lodya-demolition-ship'] as const).map(id => ({
    id,
    reason: 'Self-destructs on first hit: can only kill if target dies in 1 hit.',
    after: (unit: unknown) => {
      const u = unit as Record<string, unknown>;
      return {
        ...u,
        selfDestructs: true,
        variations: (u.variations as Record<string, unknown>[]).map(v => ({ ...v, selfDestructs: true })),
      };
    },
  }))),

  {
    id: 'huihui-pao',
    reason: 'Add mercenary_byz class so the unit appears in the Byzantine mercenary category.',
    after: (unit: unknown) => {
      const u = unit as Record<string, unknown>;
      return {
        ...u,
        classes: [...(u.classes as string[]), 'mercenary_byz'],
      };
    },
  },

  //_________
  //
  // AYYUBIDS
  //
  //_________

  {
    id: 'bedouin-swordsman',
    reason: 'aoe4world data only has a single age-1 variation but the unit is feudal-minimum (age 2). Adding age-3 and age-4 variations with correct HP (160/192/230), attack (11/13/16), melee bonus (3/4/5), and gold cost (75/70/53) per in-game stats.',
    after: (unit: unknown) => {
      const u = unit as Record<string, unknown>;
      const variations = u.variations as Record<string, unknown>[];
      const base = variations[0] as Record<string, unknown>;
      const baseCosts = base.costs as Record<string, unknown>;

      const makeVariation = (age: number, hp: number, damage: number, meleeBonus: number, gold: number) => {
        const weapons = (base.weapons as Record<string, unknown>[]).map((w, i) => {
          if (i === 0) {
            const modifiers = (w.modifiers as Record<string, unknown>[]).map(mod => {
              const m = mod as Record<string, unknown>;
              return m.property === 'meleeAttack' ? { ...m, value: meleeBonus } : m;
            });
            return { ...w, damage, modifiers };
          }
          return w;
        });
        // Raw data has food:60 but unit costs 0 food in-game (pure gold cost)
        const costs = { ...baseCosts, food: 0, gold, total: gold };
        return { ...base, age, id: `bedouin-swordsman-${age}`, hitpoints: hp, weapons, costs };
      };

      return {
        ...u,
        minAge: 2,
        variations: [
          makeVariation(2, 160, 11, 3, 75),
          makeVariation(3, 192, 13, 4, 70),
          makeVariation(4, 230, 16, 5, 53),
        ],
      };
    },
  },
  {
    id: 'bedouin-skirmisher',
    reason: 'aoe4world data only has the age-2 variation. Adding age-3 and age-4 variations with correct HP (90/108/130), attack (8/10/12), ranged bonus vs light infantry (8/10/12), and gold cost (75/70/53) per in-game stats.',
    after: (unit: unknown) => {
      const u = unit as Record<string, unknown>;
      const variations = u.variations as Record<string, unknown>[];
      const base = variations[0] as Record<string, unknown>;
      const baseCosts = base.costs as Record<string, unknown>;

      const makeVariation = (age: number, hp: number, damage: number, rangedBonus: number, gold: number) => {
        const weapons = (base.weapons as Record<string, unknown>[]).map((w, i) => {
          if (i === 0) {
            const modifiers = (w.modifiers as Record<string, unknown>[]).map(mod => {
              const m = mod as Record<string, unknown>;
              // Raw data encodes the target as [['infantry','light']] which fails the combat.ts
              // expandedTokens check — 'light' is not a standalone class. Fix to ['infantry_light'].
              return m.property === 'rangedAttack'
                ? { ...m, value: rangedBonus, target: { class: ['infantry_light'] } }
                : m;
            });
            return { ...w, damage, modifiers };
          }
          return w;
        });
        // Raw data has food:80 but unit costs 0 food in-game (pure gold cost)
        const costs = { ...baseCosts, food: 0, gold, total: gold };
        return { ...base, age, id: `bedouin-skirmisher-${age}`, hitpoints: hp, weapons, costs };
      };

      return {
        ...u,
        variations: [
          makeVariation(2, 90, 8, 8, 75),
          makeVariation(3, 108, 10, 10, 70),
          makeVariation(4, 130, 12, 12, 53),
        ],
      };
    },
  },

  //___________
  //
  // DELHI SULTANATE
  //
  //___________

  {
    id: 'sultans-elite-tower-elephant',
    reason: 'The two Handcannoneers atop the tower fire simultaneously. Handcannon already has burst:2 in raw data — moved to secondaryWeapons.',
    after: (unit: unknown) => {
      const u = unit as Record<string, unknown>;
      return {
        ...u,
        variations: (u.variations as Record<string, unknown>[]).map(v => {
          const vr = v as Record<string, unknown>;
          const weapons = vr.weapons as Record<string, unknown>[] | undefined;
          const handcannonWeapon = weapons?.find((w: any) => w.name === 'Handcannon'); // eslint-disable-line @typescript-eslint/no-explicit-any
          if (!handcannonWeapon) return vr;
          return {
            ...vr,
            secondaryWeapons: [handcannonWeapon],
          };
        }),
      };
    },
  },

  {
    id: 'tower-elephant',
    reason: 'The two archers atop the tower fire simultaneously. Represented as one ranged secondary weapon (Bow) with burst:2.',
    after: (unit: unknown) => {
      const u = unit as Record<string, unknown>;
      return {
        ...u,
        variations: (u.variations as Record<string, unknown>[]).map(v => {
          const vr = v as Record<string, unknown>;
          const weapons = vr.weapons as Record<string, unknown>[] | undefined;
          const bowWeapon = weapons?.find((w: any) => w.name === 'Bow'); // eslint-disable-line @typescript-eslint/no-explicit-any
          if (!bowWeapon) return vr;
          return {
            ...vr,
            secondaryWeapons: [{ ...bowWeapon, burst: { count: 2 } }],
          };
        }),
      };
    },
  },

  {
    id: 'war-elephant',
    reason: 'The mounted Spearman fires simultaneously with the elephant. Represented as a melee secondary weapon (Spear) preserving its vs cavalry/elephant modifiers.',
    after: (unit: unknown) => {
      const u = unit as Record<string, unknown>;
      return {
        ...u,
        variations: (u.variations as Record<string, unknown>[]).map(v => {
          const vr = v as Record<string, unknown>;
          const weapons = vr.weapons as Record<string, unknown>[] | undefined;
          const spearWeapon = weapons?.find((w: any) => w.name === 'Spear'); // eslint-disable-line @typescript-eslint/no-explicit-any
          if (!spearWeapon) return vr;
          return {
            ...vr,
            secondaryWeapons: [spearWeapon],
          };
        }),
      };
    },
  },

  //_________
  //
  // ENGLISH
  //
  //_________

  {
    id: 'king',
    reason: 'Raw data only has one age-2 variation. Adding age-3 and age-4 variations with cumulative stats from upgrade-king-3/4 tech effects (castle: +75 HP, +6 atk, +1 armor; imperial: +100 HP, +8 atk, +1 armor). Techs excluded via techUnitExclusions.',
    after: (unit: any) => {
      const base = unit.variations[0];
      const makeVariation = (age: number, hp: number, swordDmg: number, meleeArmor: number, rangedArmor: number) => ({
        ...base,
        age,
        id: `king-${age}`,
        hitpoints: hp,
        weapons: base.weapons.map((w: any, i: number) => i === 0 ? { ...w, damage: swordDmg } : w),
        armor: [{ type: 'melee', value: meleeArmor }, { type: 'ranged', value: rangedArmor }],
      });
      return {
        ...unit,
        variations: [
          base,
          makeVariation(3, 295, 22, 3, 3),
          makeVariation(4, 395, 30, 4, 4),
        ],
      };
    },
  },

  {
    id: "wynguard-footman",
    reason: "The cost of the unit is wrong.",
    after: (unit: any) => ({
      ...unit,
      variations: unit.variations.map((v: any) =>
        v.age === 4 ? { ...v, costs: { ...v.costs, food: 50, gold: 67, total: 117 } } : v
      )
    })
  },

  {
    id: "wynguard-ranger",
    reason: "The cost of the unit is wrong.",
    after: (unit: any) => ({
      ...unit,
      variations: unit.variations.map((v: any) =>
        v.age === 4 ? { ...v, costs: { ...v.costs, food: 0, wood: 75, gold: 50, total: 125 } } : v
      )
    })
  },


  //_________
  //
  // FRENCH
  //
  //_________

  {
    id: 'royal-cannon',
    reason: 'Add mercenary_byz class so the unit appears in the Byzantine mercenary category.',
    after: (unit: unknown) => {
      const u = unit as Record<string, unknown>;
      return {
        ...u,
        classes: [...(u.classes as string[]), 'mercenary_byz'],
      };
    },
  },


  {
    id: 'manjaniq',
    reason: 'Same as culverin: composite class targets encoded as nested arrays ([["naval","unit"]]) need to be transformed to underscored identifiers ("naval_unit") for combat.ts. Applies to both kinetic and incendiary weapon modifiers.',
    after: (unit: unknown) => transformMultiClassTargets(unit),
  },

  //_________
  //
  // HRE
  //
  //_________

  {
    id: 'landsknecht',
    reason: 'aoe4world data is missing infantry_light class on the hr (Holy Roman) variations. Both by and hr display "Light Melee Infantry" and behave identically — the hr omission is a data error.',
    variations: [
      {
        match: { age: 3, civsIncludes: 'hr' },
        update: { classes: ['annihilation_condition', 'armored', 'formational', 'human', 'included_by_military_hotkeys', 'infantry', 'infantry_light', 'landsknecht', 'light_melee_infantry', 'melee', 'melee_infantry', 'military', 'torch_thrower'] },
      },
      {
        match: { age: 4, civsIncludes: 'hr' },
        update: { classes: ['annihilation_condition', 'armored', 'formational', 'human', 'included_by_military_hotkeys', 'infantry', 'infantry_light', 'landsknecht', 'light_melee_infantry', 'melee', 'melee_infantry', 'military', 'torch_thrower'] },
      },
    ],
  },

  //_________
  //
  // MONGOLS
  //
  //_________
  {
    id: 'mangudai',
    reason: 'Shoots while moving: any melee unit slower than the Mangudai can never catch it in kiting mode.',
    after: (unit: unknown) => {
      const u = unit as Record<string, unknown>;
      if (Array.isArray(u.variations)) {
        u.variations = u.variations.map((v: unknown) => {
          const variation = v as Record<string, unknown>;
          if (Array.isArray(variation.weapons) && variation.weapons[0]) {
            const weapon = { ...(variation.weapons[0] as Record<string, unknown>) };
            const speed = weapon.speed as number;
            weapon.durations = { ...(weapon.durations as object), winddown: speed, reload: 0 };
            variation.weapons = [weapon, ...variation.weapons.slice(1)];
          }
          return { ...variation, continuousMovement: true };
        });
      }
      return u;
    },
  },

  {
    id: 'culverin',
    reason: 'aoe4world encodes composite class targets as nested string arrays (["naval","unit"]) instead of underscored identifiers ("naval_unit"). Applies transformMultiClassTargets to the whole unit, then fixes the remaining edge cases (naval_unit, war_elephant) on the age-4 variation.',
    after: (unit: unknown) => transformMultiClassTargets(unit),
    variations: [
      {
        match: { age: 4 },
        after: (variation: unknown) => {
          const v = variation as Record<string, unknown>;
          if (Array.isArray(v.weapons) && v.weapons[0]) {
            const weapon = v.weapons[0] as Record<string, unknown>;
            if (Array.isArray(weapon.modifiers)) {
              weapon.modifiers = weapon.modifiers.map((mod: unknown) => {
                const m = mod as Record<string, unknown>;
                if (
                  m.property === 'siegeAttack' &&
                  m.target &&
                  typeof m.target === 'object' &&
                  Array.isArray((m.target as Record<string, unknown>).class)
                ) {
                  const target = m.target as Record<string, unknown>;
                  const classArray = target.class as unknown[];
                  if (Array.isArray(classArray[0])) {
                    const classes = classArray[0] as string[];
                    if (classes.includes('naval') && classes.includes('unit')) {
                      return { ...m, target: { class: [['naval_unit']] } };
                    }
                    if (classes.includes('war') && classes.includes('elephant')) {
                      return { ...m, target: { class: [['war_elephant']] } };
                    }
                  }
                }
                return m;
              });
            }
          }
          return variation;
        }
      }
    ]
  },

];

export function applyUnitPatches(unifiedUnits: unknown[]): unknown[] {
  if (!Array.isArray(unifiedUnits) || unitPatches.length === 0) return unifiedUnits;

  return unifiedUnits.map((unit) => {
    const u = unit as Record<string, unknown>;
    const patch = unitPatches.find(p => p.id === u.id);
    if (!patch) return u;

    let updated: unknown = u;

    updated = patch.update ? (deepMerge(updated, patch.update) as Record<string, unknown>) : { ...updated as Record<string, unknown> };

    if (patch.variations?.length && Array.isArray((updated as Record<string, unknown>).variations)) {
      const updatedRecord = updated as Record<string, unknown>;
      updatedRecord.variations = ((updatedRecord.variations) as unknown[]).map((v: unknown) => {
        const vData = v as Record<string, unknown>;
        const vPatch = patch.variations!.find(vp => {
          if (vp.match.id && vp.match.id !== vData.id) return false;
          if (
            typeof vp.match.age === 'number' &&
            typeof vData.age === 'number' &&
            vp.match.age !== vData.age
          ) return false;
          if (vp.match.civsIncludes && Array.isArray(vData.civs) && !vData.civs.includes?.(vp.match.civsIncludes)) return false;
          return true;
        });
        let updated_variation: Record<string, unknown> = vPatch ? (deepMerge(vData, vPatch.update) as Record<string, unknown>) : vData;
        // Apply after function at variation level if provided
        if (vPatch?.after) {
          updated_variation = vPatch.after(updated_variation) as Record<string, unknown>;
        }
        return updated_variation;
      });
    }

    if (patch.after) {
      updated = patch.after(updated) as Record<string, unknown>;
    }

    return updated;
  });
}
