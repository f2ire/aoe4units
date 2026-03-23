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
  }
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
