import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { aoe4Units, AoE4Unit, getUnitVariation, getMaxAge, getPrimaryWeapon, getArmorValue } from "@/data/unified-units";
import type { UnifiedVariation } from "@/data/unified-units";
import { getTechnologiesForUnit, getActiveTechnologyVariationsWithTiers, applyTechnologyEffects, getAllTiersFromSameLine, allTechnologies, type UnitStats } from "@/data/unified-technologies";
import { getAbilitiesForUnit, getActiveAbilityVariations } from "@/data/unified-abilities";
import type { Ability, AbilityVariation } from "@/data/unified-abilities";

export function categorizeUnit(unit: AoE4Unit): string {
  const classes = unit.classes.map(c => c.toLowerCase());
  if (classes.includes('worker_elephant')) return 'other';
  if (classes.includes('worker')) return 'other'; // trade/support units (e.g. atabeg)
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

  // Stores a preferred weapon ability to activate on the next desert-raider unit load
  const pendingAbilityRef = useRef<string | null>(null);

  const setUnit = useCallback((u: AoE4Unit | null, preferredAbility?: string) => {
    setUnitInternal(u);
    if (!u) {
      setVariation(null);
      setActiveTechnologies(new Set());
      setActiveAbilities(new Set());
    } else if (preferredAbility) {
      pendingAbilityRef.current = preferredAbility;
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

  // Mutually exclusive weapon-swap ability groups — clicking the active one is a no-op
  const WEAPON_SWAP_GROUPS: readonly (readonly string[])[] = [
    ['ability-desert-raider-blade', 'ability-desert-raider-bow'],
    ['ability-swap-weapon-kinetic', 'ability-swap-weapon-incendiary'],
  ];

  // Default weapon ability per weapon-swap unit (activated on first load)
  const WEAPON_SWAP_DEFAULTS: Record<string, string> = {
    'desert-raider': 'ability-desert-raider-bow',
    'manjaniq': 'ability-swap-weapon-kinetic',
  };

  const toggleAbility = useCallback((abilityId: string) => {
    setActiveAbilities(prev => {
      const next = new Set(prev);
      const swapGroup = WEAPON_SWAP_GROUPS.find(g => g.includes(abilityId));
      if (swapGroup) {
        if (next.has(abilityId)) return prev; // already active: no-op
        swapGroup.forEach(id => next.delete(id));
        next.add(abilityId);
      } else {
        if (next.has(abilityId)) {
          next.delete(abilityId);
        } else {
          next.add(abilityId);
        }
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
    // Desert Raider also appears in cavalry (with sword/blade as default)
    const desertRaider = filteredUnits.find(u => u.id === 'desert-raider');
    if (desertRaider) {
      if (!categories['cavalry']) categories['cavalry'] = [];
      categories['cavalry'].push({ ...desertRaider, id: 'desert-raider_cavalry' });
    }
    return categories;
  }, [filteredUnits]);

  // Effective classes for desert-raider: swap ranged ↔ melee class set based on active weapon
  const DESERT_RAIDER_RANGED_CLASSES = ['ranged', 'archer', 'cavalry_archer', 'ranged_hybrid'];
  const effectiveClasses = useMemo(() => {
    if (unit?.id !== 'desert-raider') return unit?.classes || [];
    const cls = unit.classes || [];
    if (activeAbilities.has('ability-desert-raider-blade')) {
      // Blade mode: strip ranged classes, add 'melee'
      const withoutRanged = cls.filter(c => !DESERT_RAIDER_RANGED_CLASSES.includes(c.toLowerCase()));
      return withoutRanged.includes('melee') ? withoutRanged : [...withoutRanged, 'melee'];
    }
    return cls;
  }, [unit, activeAbilities]);

  const techs = useMemo(() => {
    if (!unit) return [];
    const all = getTechnologiesForUnit(effectiveClasses, selectedCiv, selectedAge, unit.id);
    // Blade mode: strip techs whose only relevant effect is rangedAttack (e.g. Steeled Arrow, Incendiary Arrows)
    if (unit.id === 'desert-raider' && activeAbilities.has('ability-desert-raider-blade')) {
      return all.filter(t => {
        const allEffects = [
          ...(t.effects || []),
          ...t.variations.flatMap((v: any) => v.effects || []) // eslint-disable-line @typescript-eslint/no-explicit-any
        ];
        const relevant = allEffects.filter((e: any) => e.property && e.property !== 'unknown'); // eslint-disable-line @typescript-eslint/no-explicit-any
        if (relevant.length === 0) return true;
        return !relevant.every((e: any) => e.property === 'rangedAttack'); // eslint-disable-line @typescript-eslint/no-explicit-any
      });
    }
    return all;
  }, [unit, effectiveClasses, selectedCiv, selectedAge, activeAbilities]);

  const abilities = useMemo<Ability[]>(() => {
    if (!unit) return [];
    const all = getAbilitiesForUnit(effectiveClasses, selectedCiv, selectedAge, unit.id);
    // Desert Raider has no charge attack (neither bow nor blade mode)
    if (unit.id === 'desert-raider') return all.filter(a => a.id !== 'charge-attack');
    return all;
  }, [unit, effectiveClasses, selectedCiv, selectedAge]);

  // Auto-activate abilities marked as 'always' active + weapon-swap unit defaults
  useEffect(() => {
    if (!unit) return;

    // Weapon-swap units (desert-raider, manjaniq): set weapon default + always-active on first load
    if (unit.id in WEAPON_SWAP_DEFAULTS) {
      const defaultAbility = WEAPON_SWAP_DEFAULTS[unit.id];
      const swapGroup = WEAPON_SWAP_GROUPS.find(g => g.includes(defaultAbility)) || ([] as readonly string[]);
      const alwaysDefaults = abilities
        .filter(a => a.active === 'always' || a.variations?.some((v: AbilityVariation) => v.active === 'always'))
        .map(a => a.id);
      setActiveAbilities(prev => {
        if (!swapGroup.some(id => prev.has(id))) {
          const preferred = (pendingAbilityRef.current && swapGroup.includes(pendingAbilityRef.current))
            ? pendingAbilityRef.current
            : defaultAbility;
          pendingAbilityRef.current = null;
          return new Set([...prev, preferred, ...alwaysDefaults]);
        }
        return prev;
      });
      return;
    }

    const defaults = abilities
      .filter(a => a.active === 'always' || a.variations?.some((v: AbilityVariation) => v.active === 'always'))
      .map(a => a.id);
    if (defaults.length === 0) return;
    setActiveAbilities(prev => {
      if (prev.size > 0) return prev;
      return new Set([...prev, ...defaults]);
    });
  }, [unit, selectedCiv, selectedAge, abilities]);

  // Weapon-swap units: reorder weapons so the active weapon is at index 0
  const effectiveVariation = useMemo<UnifiedVariation | null>(() => {
    if (!variation) return null;

    // Desert Raider: sword (melee) vs bow (ranged)
    if (unit?.id === 'desert-raider') {
      const useBlade = activeAbilities.has('ability-desert-raider-blade');
      const swordWeapon = variation.weapons.find(w => w.type === 'melee');
      const bowWeapon = variation.weapons.find(w => w.type === 'ranged');
      const supportWeapons = variation.weapons.filter(w => w !== swordWeapon && w !== bowWeapon);
      const activeMainWeapon = useBlade ? swordWeapon : bowWeapon;
      if (!activeMainWeapon) return variation;
      return { ...variation, weapons: [activeMainWeapon, ...supportWeapons] };
    }

    // Manjaniq: kinetic (siege) vs incendiary (fire→retyped as siege for stats)
    if (unit?.id === 'manjaniq') {
      const useIncendiary = activeAbilities.has('ability-swap-weapon-incendiary');
      const kineticWeapon = variation.weapons.find(w => w.type === 'siege');
      const incendiaryWeaponRaw = variation.weapons.find(w => w.type === 'fire');
      const supportWeapons = variation.weapons.filter(w => w !== kineticWeapon && w !== incendiaryWeaponRaw);
      if (useIncendiary && incendiaryWeaponRaw) {
        // Retype fire → siege so modifiedStats treats it as siegeAttack (ignores ranged armor)
        const incendiaryWeapon = { ...incendiaryWeaponRaw, type: 'siege' as const };
        return { ...variation, weapons: [incendiaryWeapon, ...supportWeapons] };
      }
      if (!useIncendiary && kineticWeapon) {
        return { ...variation, weapons: [kineticWeapon, ...supportWeapons] };
      }
      return variation;
    }

    return variation;
  }, [variation, activeAbilities, unit]);

  const modifiedStats = useMemo(() => {
    const data = effectiveVariation || unit;
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
    const withTechs = applyTechnologyEffects(baseStats, effectiveClasses, techVariations, unit?.id);
    return applyTechnologyEffects(withTechs, effectiveClasses, abilityVariations, unit?.id);
  }, [unit, variation, effectiveClasses, activeTechnologies, activeAbilities, selectedCiv, selectedAge]);

  return {
    unit, setUnit,
    selectedCiv, setSelectedCiv,
    selectedAge, setSelectedAge,
    variation: effectiveVariation,
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
