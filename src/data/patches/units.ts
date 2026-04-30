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
    id: 'galleass',
    reason: 'Raw weapon type is "ranged" but the Bombard fires siege/gunpowder projectiles. Corrected to "siege" so armor and damage calculations apply correctly.',
    after: (unit: unknown) => {
      const u = unit as any;
      return {
        ...u,
        variations: u.variations.map((v: any) => ({
          ...v,
          weapons: v.weapons.map((w: any) => ({ ...w, type: 'siege' })),
        })),
      };
    },
  },

  {
    id: 'royal-cannon',
    reason: 'Add mercenary_byz class so the unit appears in the Byzantine mercenary category. Scale all damage sources ×1.3 to match in-game values.',
    after: (unit: unknown) => {
      const u = unit as any;
      return {
        ...u,
        classes: [...u.classes, 'mercenary_byz'],
        variations: u.variations.map((v: any) => ({
          ...v,
          weapons: v.weapons.map((w: any, wi: number) => wi === 0 ? {
            ...w,
            damage: Math.round(w.damage * 1.3),
            modifiers: w.modifiers.map((m: any) => ({
              ...m,
              value: Math.round(m.value * 1.3),
            })),
          } : w),
        })),
      };
    },
  },


  {
    id: 'royal-culverin',
    reason: 'Raw data undervalues all damage by ~30%.',
    after: (unit: unknown) => {
      const u = unit as any;
      return {
        ...u,
        variations: u.variations.map((v: any) => ({
          ...v,
          weapons: v.weapons.map((w: any, wi: number) => wi === 0 ? {
            ...w,
            damage: Math.round(w.damage * 1.3),
            modifiers: w.modifiers.map((m: any) => ({ ...m, value: Math.round(m.value * 1.3) })),
          } : w),
        })),
      };
    },
  },

  {
    id: 'royal-ribauldequin',
    reason: 'Raw data undervalues all damage by ~30%.',
    after: (unit: unknown) => {
      const u = unit as any;
      return {
        ...u,
        variations: u.variations.map((v: any) => ({
          ...v,
          weapons: v.weapons.map((w: any, wi: number) => wi === 0 ? {
            ...w,
            damage: Math.round(w.damage * 1.3),
            modifiers: w.modifiers.map((m: any) => ({ ...m, value: Math.round(m.value * 1.3) })),
          } : w),
        })),
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
  // HOLY ROMAN EMPIRE
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
  // GOLDEN HORDE
  //
  //_________

  {
    id: 'rus-tribute',
    reason: 'The age-4 variation stats are granted by the stone-armies tech, not by normal age-up. Remove age-4 variation so the tech controls the upgrade.',
    after: (unit: unknown) => {
      const u = unit as Record<string, unknown>;
      return {
        ...u,
        variations: (u.variations as Record<string, unknown>[]).filter(v => v.id !== 'rus-tribute-4'),
      };
    },
  },

  //_____________________
  //
  // HOUSE OF LANCASTER
  //
  //_____________________

  {
    id: 'lord-of-lancaster',
    reason: 'aoe4world only has the age-2 variation with wrong HP (170→178). Adding age-3 and age-4 variations. Stats per in-game: HP (178/210/247), attack (14/16/18), armor (2/3/4 melee+ranged).',
    after: (unit: unknown) => {
      const u = unit as Record<string, unknown>;
      const variations = u.variations as Record<string, unknown>[];
      const base = variations[0] as Record<string, unknown>;
      const baseCosts = base.costs as Record<string, unknown>;

      const makeVariation = (age: number, hp: number, damage: number, armor: number) => {
        const weapons = (base.weapons as Record<string, unknown>[]).map((w, i) =>
          i === 0 ? { ...w, damage } : w
        );
        const armorArr = [{ type: 'melee', value: armor }, { type: 'ranged', value: armor }];
        return {
          ...base,
          age,
          id: `lord-of-lancaster-${age}`,
          icon: `https://data.aoe4world.com/images/units/lord-of-lancaster-2.png`,
          hitpoints: hp,
          weapons,
          armor: armorArr,
          costs: { ...baseCosts },
        };
      };

      return {
        ...u,
        variations: [
          makeVariation(2, 178, 14, 2),
          makeVariation(3, 210, 16, 3),
          makeVariation(4, 247, 18, 4),
        ],
      };
    },
  },

  {
    id: 'demilancer',
    reason: 'Raw data is a placeholder with no stats (age-1 dummy). Adding age-2/3/4 variations per in-game: HP (130/150/190), attack (8/9/14), torch (13/17/21), armor (2/3/5 melee+ranged). Classes corrected to match knight.',
    after: (unit: unknown) => {
      const u = unit as Record<string, unknown>;
      const variations = u.variations as Record<string, unknown>[];
      const base = variations[0] as Record<string, unknown>;

      const knightClasses = ['annihilation_condition', 'armored', 'cavalry', 'cavalry_armored', 'find_non_siege_land_military', 'formational', 'heavy', 'horse', 'human', 'included_by_military_hotkeys', 'knight', 'land_military', 'melee', 'military', 'military_cavalry', 'torch_thrower'];

      const makeWeapons = (damage: number, torchDamage: number) => [
        {
          name: 'Lance', type: 'melee', damage, speed: 1.5,
          range: { min: 0, max: 0.29 }, modifiers: [],
          durations: { aim: 0, windup: 0.5, attack: 0.125, winddown: 0, reload: 0, setup: 0, teardown: 0, cooldown: 0.875 },
        },
        {
          name: 'Torch', type: 'fire', damage: torchDamage, speed: 2.125,
          range: { min: 0, max: 1.25 }, modifiers: [],
          durations: { aim: 0, windup: 0.75, attack: 0.125, winddown: 0, reload: 0, setup: 0, teardown: 0, cooldown: 1.25 },
        },
      ];

      const makeVariation = (age: number, name: string, hp: number, damage: number, torchDamage: number, armor: number) => ({
        ...base,
        age, id: `demilancer-${age}`, name, hitpoints: hp,
        classes: knightClasses,
        displayClasses: ['Heavy Melee Cavalry'],
        weapons: makeWeapons(damage, torchDamage),
        armor: [{ type: 'melee', value: armor }, { type: 'ranged', value: armor }],
        costs: { food: 0, wood: 0, stone: 0, gold: 0, total: 0, popcap: 1 },
        movement: { speed: 1.62 },
      });

      return {
        ...u,
        name: 'Demilancer',
        minAge: 2,
        classes: knightClasses,
        displayClasses: ['Heavy Melee Cavalry'],
        variations: [
          makeVariation(2, 'Regular Demilancer', 130, 8, 13, 2),
          makeVariation(3, 'Veteran Demilancer', 150, 9, 17, 3),
          makeVariation(4, 'Elite Demilancer', 190, 14, 21, 5),
        ],
      };
    },
  },

  ...(['galley', 'hulk', 'carrack', 'demolition-ship', 'transport-ship', 'fishing-boat'] as const).map(id => ({
    id,
    reason: 'Lord of Lancaster (hl) ships cost 10% less, matching the English civ passive. Raw data lacks this discount for hl variations.',
    after: (unit: unknown) => {
      const u = unit as Record<string, unknown>;
      return {
        ...u,
        variations: (u.variations as Record<string, unknown>[]).map(v => {
          if (!(v.civs as string[])?.includes('hl')) return v;
          const c = v.costs as Record<string, number>;
          return {
            ...v,
            costs: {
              ...c,
              food: Math.round((c.food || 0) * 0.9),
              wood: Math.round((c.wood || 0) * 0.9),
              gold: Math.round((c.gold || 0) * 0.9),
              stone: Math.round((c.stone || 0) * 0.9),
              oliveoil: Math.round((c.oliveoil || 0) * 0.9),
              total: Math.round((c.total || 0) * 0.9),
            },
          };
        }),
      };
    },
  })),

  //_________
  //
  // JAPANESE
  //
  //_________

  {
    id: 'shinobi',
    reason: 'Only age-2 variation in raw data. upgrade-shinobi-3/4 scaling techs (×1.15 per age) baked into age-3 and age-4 variations. Techs excluded via techUnitExclusions.',
    after: (unit: any) => {
      const base = unit.variations[0];
      const makeVariation = (age: number, hp: number, wakizashiDmg: number, torchDmg: number) => ({
        ...base,
        age,
        id: `shinobi-${age}`,
        hitpoints: hp,
        weapons: base.weapons.map((w: any, i: number) => i === 0
          ? { ...w, damage: wakizashiDmg }
          : i === 1 ? { ...w, damage: torchDmg } : w
        ),
      });
      return {
        ...unit,
        variations: [
          base,
          makeVariation(3, 92, 23, 12),
          makeVariation(4, 106, 26, 13),
        ],
      };
    },
  },

  {
    id: 'katana-bannerman',
    reason: 'Raw data is a placeholder with no stats. Adding age-1/3/4 variations per in-game.',
    after: (unit: any) => {
      const base = unit.variations[0];
      const makeVariation = (age: number, hp: number, swordDmg: number, meleeArmor: number, rangedArmor: number) => ({
        ...base,
        age,
        id: `katana-bannerman-${age}`,
        hitpoints: hp,
        weapons: base.weapons.map((w: any, i: number) => i === 0 ? { ...w, damage: swordDmg } : w),
        armor: [{ type: 'melee', value: meleeArmor }, { type: 'ranged', value: rangedArmor }],
      });
      return {
        ...unit,
        variations: [
          base,
          makeVariation(1, 155, 8, 3, 3),
          makeVariation(3, 180, 10, 4, 4),
          makeVariation(4, 215, 12, 5, 6),
        ],
      };
    },
  },

  {
    id: 'yumi-bannerman',
    reason: 'Raw data is a placeholder with no stats. Adding age -3/4 variations per in-game.',
    after: (unit: any) => {
      const base = unit.variations[0];
      const makeVariation = (age: number, hp: number, bowDmg: number, meleeArmor: number, rangedArmor: number) => ({
        ...base,
        age,
        id: `yumi-bannerman-${age}`,
        hitpoints: hp,
        weapons: base.weapons.map((w: any, i: number) => i === 0 ? { ...w, damage: bowDmg } : w),
        armor: [{ type: 'melee', value: meleeArmor }, { type: 'ranged', value: rangedArmor }],
      });
      return {
        ...unit,
        variations: [
          base,
          makeVariation(3, 170, 7, 2, 3),
          makeVariation(4, 205, 8, 2, 3),
        ],
      };
    },
  },

  {
    id: 'uma-bannerman',
    reason: 'Raw data is a placeholder with no stats. Adding age -3/4 variations per in-game.',
    after: (unit: any) => {
      const base = unit.variations[0];
      const makeVariation = (age: number, hp: number, swordDmg: number, meleeArmor: number, rangedArmor: number) => ({
        ...base,
        age,
        id: `yumi-bannerman-${age}`,
        hitpoints: hp,
        weapons: base.weapons.map((w: any, i: number) => i === 0 ? { ...w, damage: swordDmg } : w),
        armor: [{ type: 'melee', value: meleeArmor }, { type: 'ranged', value: rangedArmor }],
      });
      return {
        ...unit,
        variations: [
          base,
          makeVariation(3, 270, 19, 4, 5),
          makeVariation(4, 325, 24, 4, 5),
        ],
      };
    },
  },

  //____________
  //
  // JEANNE D'ARC
  //
  //____________

  {
    id: 'jeanne-darc-hunter',
    reason: 'Raw JSON has Bow damage 5 and range 5. Corrected to damage 8, range 8 per in-game stats.',
    after: (unit: any) => ({
      ...unit,
      variations: unit.variations.map((v: any) => ({
        ...v,
        weapons: v.weapons.map((w: any) =>
          w.type === 'ranged' ? { ...w, damage: 8, range: { ...w.range, max: 8 } } : w
        ),
      })),
    }),
  },

  {
    id: 'jeanne-darc-markswoman',
    reason: 'Handcannon fires through armor (siege damage). Changing weapon type ranged → siege so shouldIgnoreArmor fires and siegeAttack stat is used, preventing stacking with ranged-only buffs like steeled-arrow.',
    after: (unit: any) => ({
      ...unit,
      variations: unit.variations.map((v: any) => ({
        ...v,
        weapons: v.weapons.map((w: any) =>
          w.name === 'Handcannon' ? { ...w, type: 'siege' } : w
        ),
      })),
    }),
  },

  {
    id: 'jeanne-darc-knight',
    reason: 'Jeanne Lv3 forms have 45% ranged resistance per in-game stats.',
    after: (unit: any) => ({
      ...unit,
      variations: unit.variations.map((v: any) => ({
        ...v,
        resistance: [...(v.resistance || []), { type: 'ranged', value: 45 }],
      })),
    }),
  },

  {
    id: 'jeanne-darc-mounted-archer',
    reason: 'Jeanne Lv3 forms have 45% ranged resistance per in-game stats.',
    after: (unit: any) => ({
      ...unit,
      variations: unit.variations.map((v: any) => ({
        ...v,
        resistance: [...(v.resistance || []), { type: 'ranged', value: 45 }],
      })),
    }),
  },

  {
    id: 'jeanne-darc-blast-cannon',
    reason: 'Jeanne Lv4 forms have 60% ranged resistance per in-game stats.',
    after: (unit: any) => ({
      ...unit,
      variations: unit.variations.map((v: any) => ({
        ...v,
        resistance: [...(v.resistance || []), { type: 'ranged', value: 60 }],
      })),
    }),
  },

  {
    id: 'jeanne-darc-markswoman',
    reason: 'Jeanne Lv4 forms have 60% ranged resistance per in-game stats.',
    after: (unit: any) => ({
      ...unit,
      variations: unit.variations.map((v: any) => ({
        ...v,
        resistance: [...(v.resistance || []), { type: 'ranged', value: 60 }],
      })),
    }),
  },

  //_________________
  //
  // KNIGHTS TEMPLAR
  //
  //_________________


  {
    id: 'condottiero',
    reason: 'Condottiero takes 33% less damage from gunpowder/siege attacks per in-game stats.',
    after: (unit: any) => ({
      ...unit,
      variations: unit.variations.map((v: any) => ({
        ...v,
        resistance: [...(v.resistance || []), { type: 'gunpowder', value: 33 }],
      })),
    }),
  },

  ...(['battering-ram', 'counterweight-trebuchet', 'mangonel', 'springald', 'siege-tower'] as const).map(id => ({
    id,
    reason: 'Knights templer siege cost 25% less wood.',
    after: (unit: unknown) => {
      const u = unit as Record<string, unknown>;
      return {
        ...u,
        variations: (u.variations as Record<string, unknown>[]).map(v => {
          if (!(v.civs as string[])?.includes('kt')) return v;
          const c = v.costs as Record<string, number>;
          return {
            ...v,
            costs: {
              ...c,
              food: Math.round((c.food || 0) * 1),
              wood: Math.round((c.wood || 0) * 0.75),
              gold: Math.round((c.gold || 0) * 1),
              stone: Math.round((c.stone || 0) * 1),
              oliveoil: Math.round((c.oliveoil || 0) * 1),
              total: Math.round((c.total || 0) * 1),
            },
          };
        }),
      };
    },
  })),

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

];

export function applyUnitPatches(unifiedUnits: unknown[]): unknown[] {
  if (!Array.isArray(unifiedUnits) || unitPatches.length === 0) return unifiedUnits;

  return unifiedUnits.map((unit) => {
    const u = unit as Record<string, unknown>;
    const patches = unitPatches.filter(p => p.id === u.id);
    if (patches.length === 0) return u;

    let updated: unknown = u;

    for (const patch of patches) {
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
          if (vPatch?.after) {
            updated_variation = vPatch.after(updated_variation) as Record<string, unknown>;
          }
          return updated_variation;
        });
      }

      if (patch.after) {
        updated = patch.after(updated) as Record<string, unknown>;
      }
    }

    return updated;
  });
}
