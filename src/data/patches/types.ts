// Utility types and patch schemas (types only)

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

// Patches for Units (UnifiedUnit/UnifiedVariation structure)
export interface UnitVariationMatch {
  id?: string;
  age?: number;
  civsIncludes?: string; // e.g. 'de'
}

export interface UnitVariationPatch<UnifiedVariation> {
  match: UnitVariationMatch;
  update?: DeepPartial<UnifiedVariation>;
  after?: (variation: UnifiedVariation) => UnifiedVariation;
}

export interface UnitUnifiedPatch<UnifiedUnit, UnifiedVariation> {
  id: string; // unit id (e.g. 'spearman')
  reason: string; // why this patch exists (bug source, affected version, modelled behaviour)
  update?: DeepPartial<UnifiedUnit>;
  variations?: UnitVariationPatch<UnifiedVariation>[];
  after?: (unit: UnifiedUnit) => UnifiedUnit; // custom escape hatch if needed
}

// Patches for Technologies
export interface TechVariationMatch {
  id?: string;
  civsIncludes?: string;
}

export interface TechVariationPatch<TechnologyVariation> {
  match: TechVariationMatch;
  update: DeepPartial<TechnologyVariation>;
  // Optionally attach a small UI hint (tooltip) to this variation patch
  uiTooltip?: string;
}

export interface TechnologyPatch<Technology, TechnologyVariation> {
  id: string; // technology id
  reason: string; // why this patch exists (bug source, affected version, modelled behaviour)
  update?: DeepPartial<Technology>;
  variations?: TechVariationPatch<TechnologyVariation>[];
  after?: (tech: Technology) => Technology;
  // Optionally attach a UI tooltip at the technology level
  uiTooltip?: string;
  // Tooltip shown to the native civ (when foreignEngineering is true, uiTooltip is reserved for Byzantine)
  uiTooltipNative?: string;
  // Mark techs only accessible via Byzantine Foreign Engineering Company age-up
  foreignEngineering?: boolean;
  // When foreignEngineering is true, restrict to these unit IDs only (for Byzantine)
  foreignEngineeringUnits?: string[];
  // Unit IDs that should never see this tech (regardless of civ)
  excludedUnits?: string[];
  // Inject a secondary weapon from another unit (e.g. thunderclap-bombs → nest-of-bees)
  injectWeapon?: { unitId: string; weaponIndex?: number };
}

// Small deep-merge utility (non-mutating)
export function deepMerge<T>(base: T, patch: DeepPartial<T>): T {
  if (patch === undefined || patch === null) return base;
  if (typeof base !== 'object' || base === null) return (patch as T) ?? base;
  if (Array.isArray(base)) return (patch as unknown as T) ?? base;

  const result = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(patch as object)) {
    const bVal = (base as Record<string, unknown>)[key];
    const pVal = (patch as Record<string, unknown>)[key];
    if (pVal && typeof pVal === 'object' && !Array.isArray(pVal)) {
      result[key] = deepMerge(bVal, pVal);
    } else if (pVal !== undefined) {
      result[key] = pVal;
    }
  }
  return result as T;
}
