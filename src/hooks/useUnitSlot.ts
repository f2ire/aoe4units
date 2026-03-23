import { useState, useMemo, useEffect, useCallback } from "react";
import { aoe4Units, AoE4Unit, getUnitVariation, getMaxAge, getPrimaryWeapon, getArmorValue } from "@/data/unified-units";
import type { UnifiedVariation } from "@/data/unified-units";
import { getTechnologiesForUnit, getActiveTechnologyVariationsWithTiers, applyTechnologyEffects, getAllTiersFromSameLine, allTechnologies, type UnitStats } from "@/data/unified-technologies";
import { getAbilitiesForUnit, getActiveAbilityVariations } from "@/data/unified-abilities";
import type { Ability, AbilityVariation } from "@/data/unified-abilities";

export function categorizeUnit(unit: AoE4Unit): string {
  const classes = unit.classes.map(c => c.toLowerCase());
  if (classes.includes('worker_elephant')) return 'other';
  if (classes.includes('ballista_elephant')) return 'siege';
  if (classes.includes('infantry') && classes.includes('melee')) return 'melee_infantry';
  if (classes.includes('ranged') && !classes.includes('siege') && !classes.includes('ship') && !classes.includes('naval_unit')) return 'ranged';
  if (classes.includes('monk') || classes.includes('religious') || classes.includes('healer_elephant')) return 'monk';
  if (classes.includes('cavalry')) return 'cavalry';
  if (classes.includes('siege')) return 'siege';
  if (classes.includes('ship') || classes.includes('naval_unit')) return 'ship';
  return 'other';
}

const DEFAULT_OPEN_CATEGORIES: Record<string, boolean> = {
  melee_infantry: true,
  ranged: true,
  cavalry: true,
  siege: true,
  monk: true,
  ship: true,
  other: true,
};

export function useUnitSlot() {
  const [unit, setUnitInternal] = useState<AoE4Unit | null>(null);
  const [selectedCiv, setSelectedCiv] = useState("all");
  const [selectedAge, setSelectedAge] = useState(4);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(DEFAULT_OPEN_CATEGORIES);
  const [variation, setVariation] = useState<UnifiedVariation | null>(null);
  const [activeTechnologies, setActiveTechnologies] = useState<Set<string>>(new Set());
  const [activeAbilities, setActiveAbilities] = useState<Set<string>>(new Set());

  const setUnit = useCallback((u: AoE4Unit | null) => {
    setUnitInternal(u);
    if (!u) {
      setVariation(null);
      setActiveTechnologies(new Set());
      setActiveAbilities(new Set());
    }
  }, []);

  const toggleCategory = useCallback((category: string) => {
    setOpenCategories(prev => ({ ...prev, [category]: !prev[category] }));
  }, []);

  const toggleTechnology = useCallback((techId: string) => {
    const tech = allTechnologies.find(t => t.id === techId);
    if (!tech) return;
    const allTierIds = getAllTiersFromSameLine(tech).map(t => t.id);
    setActiveTechnologies(prev => {
      const next = new Set(prev);
      if (next.has(techId)) {
        next.delete(techId);
      } else {
        allTierIds.forEach(id => next.delete(id));
        next.add(techId);
      }
      return next;
    });
  }, []);

  const toggleAbility = useCallback((abilityId: string) => {
    setActiveAbilities(prev => {
      const next = new Set(prev);
      if (next.has(abilityId)) {
        next.delete(abilityId);
      } else {
        next.add(abilityId);
      }
      return next;
    });
  }, []);

  // Reset unit if civ changes and unit is no longer available
  useEffect(() => {
    if (unit && selectedCiv !== "all" && !unit.civs.includes(selectedCiv)) {
      setUnit(null);
    }
  }, [selectedCiv, unit, setUnit]);

  // Update maxAge when unit or civ changes
  useEffect(() => {
    if (unit) {
      setSelectedAge(getMaxAge(unit.id, selectedCiv));
    }
  }, [unit, selectedCiv]);

  // Update variation when unit, civ, or age changes
  useEffect(() => {
    if (unit) {
      setVariation(getUnitVariation(unit.id, selectedCiv, selectedAge) ?? null);
    }
  }, [unit, selectedCiv, selectedAge]);

  const filteredUnits = useMemo(() => {
    if (selectedCiv === "all") return aoe4Units;
    return aoe4Units.filter(u => u.civs.includes(selectedCiv));
  }, [selectedCiv]);

  const categorizedUnits = useMemo(() => {
    const categories: Record<string, AoE4Unit[]> = {};
    filteredUnits.forEach(u => {
      const category = categorizeUnit(u);
      if (!categories[category]) categories[category] = [];
      categories[category].push(u);
    });
    return categories;
  }, [filteredUnits]);

  const techs = useMemo(() => {
    return unit ? getTechnologiesForUnit(unit.classes, selectedCiv, selectedAge, unit.id) : [];
  }, [unit, selectedCiv, selectedAge]);

  const abilities = useMemo<Ability[]>(() => {
    return unit ? getAbilitiesForUnit(unit.classes, selectedCiv, selectedAge, unit.id) : [];
  }, [unit, selectedCiv, selectedAge]);

  // Auto-activate abilities marked as 'always' active
  useEffect(() => {
    if (!unit) return;
    const defaults = abilities
      .filter(a => a.active === 'always' || a.variations?.some((v: AbilityVariation) => v.active === 'always'))
      .map(a => a.id);
    if (defaults.length === 0) return;
    setActiveAbilities(prev => {
      if (prev.size > 0) return prev;
      return new Set([...prev, ...defaults]);
    });
  }, [unit, selectedCiv, selectedAge, abilities]);

  const modifiedStats = useMemo(() => {
    const data = variation || unit;
    if (!data) return {
      hitpoints: 0, meleeAttack: 0, rangedAttack: 0,
      meleeArmor: 0, rangedArmor: 0, moveSpeed: 0, attackSpeed: 0, bonusDamage: [],
    };

    const weapon = getPrimaryWeapon(data);
    const baseStats: UnitStats = {
      hitpoints: data.hitpoints,
      meleeAttack: weapon?.type === 'melee' ? (weapon.damage || 0) : 0,
      rangedAttack: (weapon?.type === 'ranged' || weapon?.type === 'siege') ? (weapon.damage || 0) : 0,
      meleeArmor: getArmorValue(data, "melee"),
      rangedArmor: getArmorValue(data, "ranged"),
      moveSpeed: 'movement' in data ? (data as { movement?: { speed: number } }).movement?.speed || 0 : 0,
      attackSpeed: weapon?.speed || 0,
      maxRange: weapon?.range?.max || 0,
      burst: weapon?.burst?.count || 1,
      bonusDamage: weapon?.modifiers || [],
    };

    const techVariations = getActiveTechnologyVariationsWithTiers(activeTechnologies, selectedCiv, selectedAge);
    const abilityVariations = getActiveAbilityVariations(activeAbilities, selectedCiv, selectedAge);
    const withTechs = applyTechnologyEffects(baseStats, unit?.classes || [], techVariations, unit?.id);
    return applyTechnologyEffects(withTechs, unit?.classes || [], abilityVariations, unit?.id);
  }, [unit, variation, activeTechnologies, activeAbilities, selectedCiv, selectedAge]);

  return {
    unit, setUnit,
    selectedCiv, setSelectedCiv,
    selectedAge, setSelectedAge,
    variation,
    activeTechnologies, setActiveTechnologies,
    activeAbilities, setActiveAbilities,
    openCategories, toggleCategory,
    filteredUnits,
    categorizedUnits,
    techs,
    abilities,
    modifiedStats,
    toggleTechnology,
    toggleAbility,
  };
}
