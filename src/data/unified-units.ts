/**
 * Loading and parsing of unified AoE4 data
 * Source: all-unified.json (official aoe4world data)
 */

import allUnifiedData from './all-unified.json';
import { applyUnitPatches } from './patches/units';

// Interfaces for the all-unified.json structure
interface UnifiedWeaponRange {
  min: number;
  max: number;
}

interface UnifiedWeaponModifier {
  property: string;
  target: {
    class?: string[][];
    id?: string[];
  };
  effect: string;
  value: number;
  type: string;
}

interface UnifiedWeapon {
  name: string;
  type: string;
  damage: number;
  speed: number;
  range: UnifiedWeaponRange;
  modifiers: UnifiedWeaponModifier[];
  attackSpeed?: number;
  attribName?: string; // Internal attribute name, used to detect special weapons (e.g. _charge_)
  burst?: {
    count: number;
    decay?: number; // secondary bolt damage as fraction of base (no bonus damage)
  };
  durations?: {
    aim?: number;
    windup?: number;
    attack?: number;
    winddown?: number;
    reload?: number;
    setup?: number;
    teardown?: number;
  };
}

interface UnifiedArmor {
  type: string;
  value: number;
}

interface UnifiedResistance {
  type: string;
  value: number; // percentage (0-100): reduces incoming damage of that type by value%
}

interface UnifiedCosts {
  food: number;
  wood: number;
  stone: number;
  gold: number;
  vizier?: number;
  oliveoil?: number;
  total: number;
  popcap: number;
  time: number;
}

interface UnifiedVariation {
  id: string;
  baseId: string;
  type: string;
  name: string;
  pbgid: number;
  attribName: string;
  age: number;
  civs: string[];
  description: string;
  classes: string[];
  displayClasses: string[];
  unique: boolean;
  costs: UnifiedCosts;
  producedBy: string[];
  icon: string;
  hitpoints: number;
  weapons: UnifiedWeapon[];
  armor?: UnifiedArmor[];
  resistance?: UnifiedResistance[];
  sight?: {
    line: number;
    height: number;
  };
  movement?: {
    speed: number;
  };
  secondaryWeapons?: UnifiedWeapon[];
}

interface UnifiedUnit {
  id: string;
  name: string;
  type: string;
  civs: string[];
  unique: boolean;
  displayClasses: string[];
  classes: string[];
  minAge: number;
  icon: string;
  description: string;
  variations: UnifiedVariation[];
}

interface AllUnifiedData {
  __note__: string;
  __version__: string;
  data: Array<UnifiedUnit | Record<string, unknown>>; // Units or other types (buildings, techs)
}

// Cast imported data
const typedData = allUnifiedData as AllUnifiedData;

// Filter only units (type === "unit")
const allUnitsRaw = typedData.data.filter(
  (item): item is UnifiedUnit => item.type === 'unit'
);

// Apply local patches (non-destructive)
export const allUnits: UnifiedUnit[] = applyUnitPatches(allUnitsRaw) as UnifiedUnit[];

// Simplified interface for use in the app (compatible with AoE4Unit)
export interface AoE4Unit {
  id: string;
  name: string;
  icon: string;
  hitpoints: number;
  costs: {
    food: number;
    wood: number;
    gold: number;
    stone: number;
    oliveoil?: number;    // Olive oil (Byzantines) or Silver (Macedonians)
  };
  armor: UnifiedArmor[];
  resistance?: UnifiedResistance[];
  weapons: UnifiedWeapon[];
  type: string;
  civs: string[];
  classes: string[];
  displayClasses: string[];
  unique: boolean;
  age: number;
  movement?: {
    speed: number;
  };
  description: string;
  producedBy?: string[];
  variations?: UnifiedVariation[]; // Keep variations for detailed access
}

/**
 * Converts unified units into the simplified format
 * Takes the first variation (minimum age) as the reference
 */
export const aoe4Units: AoE4Unit[] = allUnits.map(unit => {
  // Take the first variation (usually age 2 or minimum)
  const baseVariation = unit.variations[0];
  
  return {
    id: unit.id,
    name: unit.name,
    icon: unit.icon,
    hitpoints: baseVariation.hitpoints,
    costs: {
      food: baseVariation.costs.food,
      wood: baseVariation.costs.wood,
      gold: baseVariation.costs.gold,
      stone: baseVariation.costs.stone,
      oliveoil: baseVariation.costs.oliveoil ?? (baseVariation.costs as any).silver,
    },
    armor: baseVariation.armor || [],
    resistance: baseVariation.resistance,
    weapons: baseVariation.weapons,
    type: unit.type,
    civs: unit.civs,
    classes: unit.classes,
    displayClasses: unit.displayClasses,
    unique: unit.unique,
    age: unit.minAge,
    movement: baseVariation.movement,
    description: unit.description,
    producedBy: baseVariation.producedBy,
    variations: unit.variations, // Keep all variations
  };
});

/**
 * Units globally hidden from the app's unit picker (duplicates, summon stubs,
 * removed/levy variants). Single source of truth — also imported by useUnitSlot.
 */
export const EXCLUDED_UNIT_IDS = new Set([
  "clocktower-battering-ram",
  "clocktower-bombard",
  "clocktower-counterweight-trebuchet",
  "clocktower-nest-of-bees",
  "clocktower-springald",
  "wynguard-army",
  "wynguard-footmen",
  "wynguard-raiders",
  "wynguard-rangers",
  "earls-retinue",
  "garrison-command",
  "gunpowder-contingent",
  "mansa-musofadi-warrior",
  "mansa-javelineer",
  "khaganate-mangudai",
  "mounted-samurai-levy",
  "naginata-samurai-levy",
  "spearman-levy",
  "tanegashima-ashigaru-levy",
  "yari-cavalry-levy",
  "yumi-ashigaru-levy",
  "militia",
]);

/**
 * Units that have real base stats and are worth a standalone SEO page.
 * Mirrors the app's unit picker: drops globally excluded units, plus summon /
 * placeholder units (e.g. Wynguard Army) whose reference variation has no
 * movement speed or hitpoints — UnitCard cannot render those.
 */
export const seoUnits: AoE4Unit[] = aoe4Units.filter((unit) => {
  if (EXCLUDED_UNIT_IDS.has(unit.id)) return false;
  const maxAge = getMaxAge(unit.id, "all");
  const v = getUnitVariation(unit.id, "all", maxAge) ?? unit.variations?.[0];
  return !!v && v.movement?.speed != null && v.hitpoints != null;
});

/**
 * Cross-civ equivalence groups: units that fill the same role but are named
 * differently per civilization (e.g. French "Lancer" ≈ "Knight"). Used to link
 * a unit page to its counterparts on other civs. Units not listed are their own
 * group of one.
 */
export const UNIT_EQUIVALENCE_GROUPS: string[][] = [
  ["knight", "lancer"],
  // Archer ship
  ["dhow", "galley", "hunting-canoe", "junk", "light-junk", "lodya-galley"],
  // Springald ship
  ["baghlah", "hulk", "lodya-attack-ship", "war-canoe", "war-cog", "war-junk"],
  // Incendiary ship
  ["demolition-ship", "explosive-dhow", "explosive-junk", "lodya-demolition-ship"],
  // Warship
  ["baochuan", "carrack", "xebec"],
  ["handcannoneer", "handcannon-ashigaru"],
];

/** Returns the equivalence group containing `unitId` (or just `[unitId]`). */
export function getUnitGroup(unitId: string): string[] {
  return UNIT_EQUIVALENCE_GROUPS.find((g) => g.includes(unitId)) ?? [unitId];
}


/**
 * Retrieves a unit by its ID
 */
export function getUnitById(id: string): AoE4Unit | undefined {
  return aoe4Units.find(unit => unit.id === id);
}

/**
 * Retrieves all units belonging to a civilization
 */
export function getUnitsByCiv(civAbbr: string): AoE4Unit[] {
  return aoe4Units.filter(unit => unit.civs.includes(civAbbr));
}

/**
 * Retrieves units by class
 */
export function getUnitsByClass(className: string): AoE4Unit[] {
  return aoe4Units.filter(unit => 
    unit.classes.some(c => c.toLowerCase().includes(className.toLowerCase()))
  );
}

/**
 * Retrieves the variation of a unit for a specific civ and age
 * If civAbbr is "all", takes the first variation of that age
 */
export function getUnitVariation(
  unitId: string,
  civAbbr: string,
  age: number
): UnifiedVariation | undefined {
  const unit = allUnits.find(u => u.id === unitId);
  if (!unit) return undefined;
  
  // If "all", take the first variation of that age
  if (civAbbr === "all") {
    return unit.variations.find(v => v.age === age);
  }
  
  // Look for the exact variation for this civ and age
  return unit.variations.find(v =>
    v.civs.includes(civAbbr) && v.age === age
  ) || unit.variations.find(v => v.age === age); // Fallback to age only
}

/**
 * Retrieves all variations of a unit
 */
export function getAllVariations(unitId: string): UnifiedVariation[] {
  const unit = allUnits.find(u => u.id === unitId);
  return unit?.variations || [];
}

/**
 * Retrieves available ages for a unit and a civilization
 * If civAbbr is "all", returns all available ages across all civs
 */
export function getAvailableAges(unitId: string, civAbbr: string): number[] {
  const variations = getAllVariations(unitId);
  
  // If "all", return all available ages
  if (civAbbr === "all") {
    const allAges = variations
      .map(v => v.age)
      .filter((age, index, self) => self.indexOf(age) === index)
      .sort((a, b) => a - b);
    return allAges;
  }
  
  // Otherwise filter by civilization
  const ages = variations
    .filter(v => v.civs.includes(civAbbr))
    .map(v => v.age)
    .filter((age, index, self) => self.indexOf(age) === index) // Deduplicate
    .sort((a, b) => a - b);
  
  // Fallback: if no age found for this civ, return all available ages
  return ages.length > 0 ? ages : variations
    .map(v => v.age)
    .filter((age, index, self) => self.indexOf(age) === index)
    .sort((a, b) => a - b);
}

/**
 * Retrieves the maximum available age for a unit
 */
export function getMaxAge(unitId: string, civAbbr: string): number {
  const ages = getAvailableAges(unitId, civAbbr);
  return ages.length > 0 ? Math.max(...ages) : 4;
}

/**
 * Computes the total cost of a unit or variation (including secondary resources)
 */
export function getTotalCost(unit: AoE4Unit | UnifiedVariation): number {
  return unit.costs.food +
         unit.costs.wood +
         unit.costs.gold +
         unit.costs.stone +
         (unit.costs.oliveoil || 0);
}

/**
 * Retrieves the armor value for a specific type
 */
export function getArmorValue(unit: AoE4Unit | UnifiedVariation, armorType: string): number {
  const armor = unit.armor?.find(a => a.type.toLowerCase() === armorType.toLowerCase());
  return armor?.value || 0;
}

/**
 * Retrieves the resistance (%) for a given damage type
 * E.g. getResistanceValue(ram, "ranged") → 95
 */
export function getResistanceValue(unit: AoE4Unit | UnifiedVariation, damageType: string): number {
  const entry = unit.resistance?.find(r => r.type.toLowerCase() === damageType.toLowerCase());
  return entry?.value || 0;
}

/**
 * Retrieves the primary weapon of the unit or variation
 */
export function getPrimaryWeapon(unit: AoE4Unit | UnifiedVariation): UnifiedWeapon | undefined {
  return unit.weapons[0];
}

// Also export raw data for advanced access
export { allUnits as unifiedUnits };
export type { UnifiedUnit, UnifiedVariation, UnifiedWeapon, UnifiedArmor, UnifiedResistance, UnifiedCosts };
