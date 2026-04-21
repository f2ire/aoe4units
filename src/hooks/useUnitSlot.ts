import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { aoe4Units, AoE4Unit, getUnitVariation, getMaxAge, getPrimaryWeapon, getArmorValue, getResistanceValue } from "@/data/unified-units";
import type { UnifiedVariation } from "@/data/unified-units";
import { getTechnologiesForUnit, getActiveTechnologyVariationsWithTiers, applyTechnologyEffects, getAllTiersFromSameLine, allTechnologies, type UnitStats } from "@/data/unified-technologies";
import { getAbilitiesForUnit, getActiveAbilityVariations } from "@/data/unified-abilities";
import { techAbilityInteractions } from "@/data/patches/abilities";
import { foreignEngineeringUnitRestrictions, techUnitExclusions, weaponInjectionMap } from "@/data/patches/technologies";
import type { UnifiedWeapon } from "@/data/unified-units";
import { foreignEngineeringAbilityUnitRestrictions } from "@/data/patches/abilities";
import type { Ability, AbilityVariation } from "@/data/unified-abilities";

// Upgrade groups: ordered arrays where index 0 = tier 1, index 1 = tier 2, etc.
// Only one ability in a group can be active at a time; clicking one deactivates the others.
// Unlike WEAPON_SWAP_GROUPS, clicking the active ability deactivates it.
export const ABILITY_UPGRADE_GROUPS: readonly (readonly string[])[] = [
  ['ability-dynasty-song', 'ability-dynasty-yuan', 'ability-dynasty-ming'],
  ['ability-network-of-castles', 'ability-network-of-citadels'],
  ['ability-khan-warcry-2', 'ability-khan-warcry-3', 'ability-khan-warcry-4'],
];

export function categorizeUnit(unit: AoE4Unit, selectedCiv?: string): string {
  const classes = unit.classes.map(c => c.toLowerCase());
  if (classes.includes('worker_elephant')) return 'other';
  if (classes.includes('worker')) return 'other'; // trade/support units (e.g. atabeg)
  if (classes.includes('mercenary_byz') && selectedCiv === 'by') return 'mercenary';
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
  mercenary: false,
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
    setVariation(null);
    setActiveTechnologies(new Set());
    setActiveAbilities(new Set());
    if (u && preferredAbility) {
      pendingAbilityRef.current = preferredAbility;
    }
  }, []);

  const toggleCategory = useCallback((category: string) => {
    setOpenCategories(prev => ({ ...prev, [category]: !prev[category] }));
  }, []);

  // Tech mutual exclusion per civ: activating one removes the others in the group
  const CIV_TECH_EXCLUSIVE_GROUPS: Record<string, string[][]> = {
    'by': [
      ['biology', 'royal-bloodlines'],
    ],
  };

  // Ref so toggleTechnology can read selectedCiv without a closure dep
  const selectedCivRef = useRef(selectedCiv);
  selectedCivRef.current = selectedCiv;

  const toggleTechnology = useCallback((techId: string) => {
    const tech = allTechnologies.find(t => t.id === techId);
    if (!tech) return;
    const allTierIds = getAllTiersFromSameLine(tech).map(t => t.id);
    setActiveTechnologies(prev => {
      const next = new Set(prev);
      if (next.has(techId)) {
        next.delete(techId);
        // Deactivate abilities that require this tech
        setActiveAbilities(prevAbi => {
          const nextAbi = new Set(prevAbi);
          Object.entries(ABILITY_TECH_DEPENDENCIES).forEach(([abilityId, reqTech]) => {
            if (reqTech === techId) nextAbi.delete(abilityId);
          });
          return nextAbi;
        });
      } else {
        allTierIds.forEach(id => next.delete(id));
        // Remove mutually exclusive techs for the current civ
        const civGroups = CIV_TECH_EXCLUSIVE_GROUPS[selectedCivRef.current] || [];
        const exclusiveGroup = civGroups.find(g => g.includes(techId));
        if (exclusiveGroup) {
          exclusiveGroup.forEach(id => next.delete(id));
        }
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

  // Ability dependencies: a dependent ability can only be active when its required ability is active
  const ABILITY_DEPENDENCIES: Record<string, string> = {
    'ability-royal-knight-charge-damage': 'charge-attack',
  };

  // Tech-gated abilities: a dependent ability can only be active when the required tech is also active
  const ABILITY_TECH_DEPENDENCIES: Record<string, string> = {
    'ability-gallop': 'mounted-training',
  };

  // Ref so toggleAbility can access current abilities/technologies without closure dependencies
  const abilitiesRef = useRef<Ability[]>([]);
  const activeTechnologiesRef = useRef<Set<string>>(new Set());
  activeTechnologiesRef.current = activeTechnologies;

  const toggleAbility = useCallback((abilityId: string) => {
    setActiveAbilities(prev => {
      const next = new Set(prev);
      const swapGroup = WEAPON_SWAP_GROUPS.find(g => g.includes(abilityId));
      if (swapGroup) {
        if (next.has(abilityId)) return prev; // already active: no-op
        swapGroup.forEach(id => next.delete(id));
        next.add(abilityId);
      } else if (ABILITY_UPGRADE_GROUPS.find(g => g.includes(abilityId))) {
        const upgradeGroup = ABILITY_UPGRADE_GROUPS.find(g => g.includes(abilityId))!;
        if (next.has(abilityId)) {
          next.delete(abilityId); // deactivate — unlike swap groups, can toggle off
        } else {
          upgradeGroup.forEach(id => next.delete(id)); // deactivate others in group
          next.add(abilityId);
        }
      } else {
        if (next.has(abilityId)) {
          next.delete(abilityId);
          // Also deactivate abilities that depend on this one
          Object.entries(ABILITY_DEPENDENCIES).forEach(([dep, req]) => {
            if (req === abilityId) next.delete(dep);
          });
        } else {
          // Block if a required ability is not active
          const req = ABILITY_DEPENDENCIES[abilityId];
          if (req && !next.has(req)) return prev; // locked: no-op
          // Block if a required technology is not active
          const reqTech = ABILITY_TECH_DEPENDENCIES[abilityId];
          if (reqTech && !activeTechnologiesRef.current.has(reqTech)) return prev; // locked: no-op
          next.add(abilityId);
          // Auto-activate 'always'-active abilities that depend on this one
          abilitiesRef.current.forEach(a => {
            const depReq = ABILITY_DEPENDENCIES[a.id];
            if (depReq === abilityId && (a.active === 'always' || a.variations?.some((v: AbilityVariation) => v.active === 'always'))) {
              next.add(a.id);
            }
          });
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

  const EXCLUDED_UNIT_IDS = new Set([
    'clocktower-battering-ram',
    'clocktower-bombard',
    'clocktower-counterweight-trebuchet',
    'clocktower-nest-of-bees',
    'clocktower-springald',
    'wynguard-army',
    'wynguard-footmen',
    'wynguard-raiders',
    'wynguard-rangers',
  ]);

  const filteredUnits = useMemo(() => {
    const base = selectedCiv === "all" ? aoe4Units : aoe4Units.filter(u => u.civs.includes(selectedCiv));
    return base.filter(u => !EXCLUDED_UNIT_IDS.has(u.id));
  }, [selectedCiv]);

  const categorizedUnits = useMemo(() => {
    const categories: Record<string, AoE4Unit[]> = {};
    filteredUnits.forEach(u => {
      const category = categorizeUnit(u, selectedCiv);
      if (!categories[category]) categories[category] = [];
      categories[category].push(u);
    });
    // Desert Raider also appears in cavalry (blade mode default).
    // For non-mercenary civs: add to cavalry category.
    // For Byzantine (mercenary): add a blade-mode duplicate inside mercenary category too.
    const desertRaider = filteredUnits.find(u => u.id === 'desert-raider');
    if (desertRaider) {
      const drCategory = categorizeUnit(desertRaider, selectedCiv);
      if (drCategory !== 'mercenary') {
        if (!categories['cavalry']) categories['cavalry'] = [];
        categories['cavalry'].push({ ...desertRaider, id: 'desert-raider_cavalry' });
      } else {
        // Byzantine: add blade-mode duplicate in mercenary category with melee classes
        if (!categories['mercenary']) categories['mercenary'] = [];
        const RANGED_CLASSES = ['ranged', 'archer', 'cavalry_archer', 'ranged_hybrid'];
        const bladeModeClasses = [...desertRaider.classes.filter(c => !RANGED_CLASSES.includes(c)), 'melee'];
        categories['mercenary'].push({ ...desertRaider, id: 'desert-raider_cavalry', classes: bladeModeClasses });
      }
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

    // For Byzantine FEC techs with unit restrictions, only show to the allowed unit IDs
    // Also filter out techs that explicitly exclude this unit
    const filtered = all.filter(t => {
      const excluded = techUnitExclusions.get(t.id);
      if (excluded?.includes(unit.id)) return false;
      if (selectedCiv === 'by') {
        const restriction = foreignEngineeringUnitRestrictions.get(t.id);
        if (restriction && !restriction.includes(unit.id)) return false;
      }
      return true;
    });

    // Blade mode: strip techs whose only relevant effect is rangedAttack or maxRange (e.g. Steeled Arrow, Incendiary Arrows, Silk Bowstrings)
    if (unit.id === 'desert-raider' && activeAbilities.has('ability-desert-raider-blade')) {
      return filtered.filter(t => {
        const allEffects = [
          ...(t.effects || []),
          ...t.variations.flatMap((v: any) => v.effects || []) // eslint-disable-line @typescript-eslint/no-explicit-any
        ];
        const relevant = allEffects.filter((e: any) => e.property && e.property !== 'unknown'); // eslint-disable-line @typescript-eslint/no-explicit-any
        if (relevant.length === 0) return true;
        const RANGED_ONLY_PROPS = new Set(['rangedAttack', 'maxRange']);
        return !relevant.every((e: any) => RANGED_ONLY_PROPS.has(e.property)); // eslint-disable-line @typescript-eslint/no-explicit-any
      });
    }
    return filtered;
  }, [unit, effectiveClasses, selectedCiv, selectedAge, activeAbilities]);

  const abilities = useMemo<Ability[]>(() => {
    if (!unit) return [];
    const all = getAbilitiesForUnit(effectiveClasses, selectedCiv, selectedAge, unit.id);
    // Knight types without charge attack
    let filtered = (unit.id === 'desert-raider' || unit.id === 'cataphract' || unit.id == "camel-rider" || unit.id == "black-rider")
      ? all.filter(a => a.id !== 'charge-attack')
      : all;
    // FEC ability unit restrictions: only show to allowed unit IDs when playing as Byzantine
    if (selectedCiv === 'by') {
      filtered = filtered.filter(a => {
        const restriction = foreignEngineeringAbilityUnitRestrictions.get(a.id);
        if (restriction && !restriction.includes(unit.id)) return false;
        return true;
      });
    }
    return filtered;
  }, [unit, effectiveClasses, selectedCiv, selectedAge]);

  // Keep abilitiesRef current so toggleAbility can access it without closure deps
  abilitiesRef.current = abilities;

  // Derived: abilities that are locked because their required ability is not active
  const lockedAbilities = useMemo(() => {
    const locked = new Set<string>();
    Object.entries(ABILITY_DEPENDENCIES).forEach(([dep, req]) => {
      if (!activeAbilities.has(req)) locked.add(dep);
    });
    Object.entries(ABILITY_TECH_DEPENDENCIES).forEach(([abilityId, reqTech]) => {
      if (!activeTechnologies.has(reqTech)) locked.add(abilityId);
    });
    return locked;
  }, [activeAbilities, activeTechnologies]);

  // Auto-activate abilities marked as 'always' active + weapon-swap unit defaults
  useEffect(() => {
    if (!unit) return;

    // Weapon-swap units (desert-raider, manjaniq): set weapon default + always-active on first load
    if (unit.id in WEAPON_SWAP_DEFAULTS) {
      const defaultAbility = WEAPON_SWAP_DEFAULTS[unit.id];
      const swapGroup = WEAPON_SWAP_GROUPS.find(g => g.includes(defaultAbility)) || ([] as readonly string[]);
      const alwaysDefaults = abilities
        .filter(a => (a.active === 'always' || a.variations?.some((v: AbilityVariation) => v.active === 'always'))
          && !(a.id in ABILITY_DEPENDENCIES)) // skip abilities with unmet dependencies
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
      .filter(a => (a.active === 'always' || a.variations?.some((v: AbilityVariation) => v.active === 'always'))
        && !(a.id in ABILITY_DEPENDENCIES)) // skip abilities with unmet dependencies
      .map(a => a.id);
    if (defaults.length === 0) return;
    setActiveAbilities(prev => {
      if (prev.size > 0) return prev;
      return new Set([...prev, ...defaults]);
    });
  }, [unit, selectedCiv, selectedAge, abilities]);

  // Auto-activate default technologies for specific civs on unit load
  const DEFAULT_ACTIVE_TECHS: Record<string, string[]> = {
    'by': ['howdahs'],
  };
  useEffect(() => {
    if (!unit || !selectedCiv || !(selectedCiv in DEFAULT_ACTIVE_TECHS)) return;
    const defaults = DEFAULT_ACTIVE_TECHS[selectedCiv].filter(id => techs.some(t => t.id === id));
    if (defaults.length === 0) return;
    setActiveTechnologies(prev => new Set([...prev, ...defaults]));
  }, [unit, selectedCiv, techs]);

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
      meleeArmor: 0, rangedArmor: 0, moveSpeed: 0, attackSpeed: 0, bonusDamage: [], rangedResistance: 0, meleeResistance: 0,
    };

    const weapon = getPrimaryWeapon(data);
    const baseStats: UnitStats = {
      hitpoints: data.hitpoints,
      meleeAttack: weapon?.type === 'melee' ? (weapon.damage || 0) : 0,
      rangedAttack: (weapon?.type === 'ranged' || weapon?.type === 'siege')
        ? (weapon.damage || 0)
        : ((data as any).secondaryWeapons?.[0]?.damage || 0), // eslint-disable-line @typescript-eslint/no-explicit-any
      meleeArmor: getArmorValue(data, "melee"),
      rangedArmor: getArmorValue(data, "ranged"),
      moveSpeed: 'movement' in data ? (data as { movement?: { speed: number } }).movement?.speed || 0 : 0,
      attackSpeed: weapon?.speed || 0,
      maxRange: weapon?.range?.max || 0,
      burst: weapon?.burst?.count || 1,
      bonusDamage: (weapon?.modifiers || []).map((m: any) => ({ ...m, fromWeapon: true })), // eslint-disable-line @typescript-eslint/no-explicit-any
      rangedResistance: getResistanceValue(data, 'ranged'),
      meleeResistance: getResistanceValue(data, 'melee'),
      healingRate: 0,
    };

    const techVariations = getActiveTechnologyVariationsWithTiers(activeTechnologies, selectedCiv, selectedAge);
    const abilityVariations = getActiveAbilityVariations(activeAbilities, selectedCiv, selectedAge);

    // Base-modifying abilities (e.g. Clocktower) produce units with a higher HP base —
    // they are applied in a separate pass AFTER other abilities/techs so their ×HP acts
    // as a final multiplier rather than stacking additively with Ming Dynasty etc.
    const BASE_MODIFYING_ABILITY_IDS = new Set(['ability-astronomical-clocktower']);
    const baseAbilityVariations = abilityVariations.filter(v => BASE_MODIFYING_ABILITY_IDS.has(v.baseId));
    const regularAbilityVariations = abilityVariations.filter(v => !BASE_MODIFYING_ABILITY_IDS.has(v.baseId));

    const withTechs = applyTechnologyEffects(baseStats, effectiveClasses, techVariations, unit?.id);
    const withAbilities = applyTechnologyEffects(withTechs, effectiveClasses, regularAbilityVariations, unit?.id);
    let result = applyTechnologyEffects(withAbilities, effectiveClasses, baseAbilityVariations, unit?.id);

    for (const interaction of techAbilityInteractions) {
      if (
        activeTechnologies.has(interaction.requiredTech) &&
        activeAbilities.has(interaction.requiredAbility) &&
        (!interaction.unitId || unit?.id === interaction.unitId)
      ) {
        result = interaction.apply(result);
      }
    }
    // HRE infantry passive: +10% move speed (formerly a technology, now a baked-in passive not present in data)
    // Age I: +5% only. Also applies to landsknecht when used as Byzantine mercenary.
    const isHREInfantry = selectedCiv === 'hr' && effectiveClasses.some(c => c === 'infantry' || c.includes('infantry'));
    const isLandsknecht = unit?.id === 'landsknecht' && selectedCiv === 'by';
    if (isHREInfantry || isLandsknecht) {
      result = { ...result, moveSpeed: result.moveSpeed * (selectedAge === 1 ? 1.05 : 1.1) };
    }

    if (result.moveSpeed > 2) result = { ...result, moveSpeed: 2 };

    // Fixed attack speed overrides — ability sets an absolute AS regardless of techs
    if (activeAbilities.has('ability-arrow-volley')) {
      result = { ...result, attackSpeed: 0.6 };
    }

    return result;
  }, [unit, variation, effectiveClasses, activeTechnologies, activeAbilities, selectedCiv, selectedAge]);

  const secondaryWeapons = useMemo((): UnifiedWeapon[] => {
    const weapons: UnifiedWeapon[] = [];
    // Base secondary weapons from unit variation (always-active, e.g. tower-elephant archers)
    if (variation?.secondaryWeapons) {
      weapons.push(...(variation.secondaryWeapons as UnifiedWeapon[]));
    }
    // Tech-injected secondary weapons (e.g. thunderclap-bombs → nest-of-bees)
    for (const techId of activeTechnologies) {
      const injection = weaponInjectionMap.get(techId);
      if (!injection) continue;
      const sourceUnit = aoe4Units.find(u => u.id === injection.unitId);
      if (!sourceUnit) continue;
      const sourceVariation = sourceUnit.variations[sourceUnit.variations.length - 1];
      let weapon: any = sourceVariation?.weapons?.[injection.weaponIndex]; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!weapon) continue;
      if (injection.burstCount !== undefined) weapon = { ...weapon, burst: { count: injection.burstCount } };
      if (injection.damageMultiplier !== undefined) weapon = { ...weapon, damageMultiplier: injection.damageMultiplier };
      if (injection.maxDamage !== undefined) weapon = { ...weapon, maxDamage: injection.maxDamage };
      weapons.push(weapon);
    }
    return weapons;
  }, [activeTechnologies, variation]);

  const lockedTechnologies = useMemo(() => {
    const locked = new Set<string>();
    const defaults = DEFAULT_ACTIVE_TECHS[selectedCiv] || [];
    defaults.forEach(id => locked.add(id));
    return locked;
  }, [selectedCiv]);

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
    lockedAbilities,
    lockedTechnologies,
    secondaryWeapons,
  };
}
