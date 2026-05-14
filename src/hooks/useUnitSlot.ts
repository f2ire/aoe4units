import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { aoe4Units, AoE4Unit, getUnitVariation, getMaxAge, getPrimaryWeapon, getArmorValue, getResistanceValue } from "@/data/unified-units";
import type { UnifiedVariation } from "@/data/unified-units";
import { getTechnologiesForUnit, getActiveTechnologyVariationsWithTiers, applyTechnologyEffects, getAllTiersFromSameLine, allTechnologies, IMPROVED_TECH_PAIRS, IMPROVED_TECH_BASE, type UnitStats } from "@/data/unified-technologies";
import { getAbilitiesForUnit, getActiveAbilityVariations, getAbilityVariation } from "@/data/unified-abilities";
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
  ['ability-maneuver-arrow', 'ability-attack-speed-arrow', 'ability-defense-arrow'],
  ['ability-attack-drums', 'ability-ranged-defense-drums', 'ability-melee-defense-drums']
];

export function categorizeUnit(unit: AoE4Unit, selectedCiv?: string): string {
  const classes = unit.classes.map(c => c.toLowerCase());
  if (classes.includes('jeanne_d_arc')) return 'jeanne';
  if (classes.includes('worker_elephant')) return 'other';
  if (classes.includes('worker')) return 'other'; // trade/support units (e.g. atabeg)
  if (classes.includes('mercenary_byz') && selectedCiv === 'by') return 'mercenary';
  if (classes.includes('khaganate') && selectedCiv === 'mo') return 'khaganate';
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
  jeanne: true,
  melee_infantry: true,
  ranged: true,
  cavalry: true,
  siege: true,
  monk: true,
  ship: true,
  other: true,
  mercenary: false,
  khaganate: false,
};


export function useUnitSlot() {
  const [unit, setUnitInternal] = useState<AoE4Unit | null>(null);
  const [selectedCiv, setSelectedCiv] = useState("ab");
  const [selectedAge, setSelectedAge] = useState(4);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(DEFAULT_OPEN_CATEGORIES);
  const [variation, setVariation] = useState<UnifiedVariation | null>(null);
  const [activeTechnologies, setActiveTechnologies] = useState<Set<string>>(new Set());
  const [activeAbilities, setActiveAbilities] = useState<Set<string>>(new Set());
  const [abilityCounters, setAbilityCounters] = useState<Map<string, number>>(new Map());

  // Stores a preferred weapon ability to activate on the next desert-raider unit load
  const pendingAbilityRef = useRef<string | null>(null);

  const setUnit = useCallback((u: AoE4Unit | null, preferredAbility?: string) => {
    setUnitInternal(u);
    setVariation(null);
    setActiveTechnologies(new Set());
    setActiveAbilities(new Set());
    setAbilityCounters(new Map());
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
    'kt': [
      ['principality-of-antioch', 'kingdom-of-france'],
      ['kingdom-of-castile', 'angevin-empire'],
      ['teutonic-order', 'kingdom-of-poland'],
    ],

  };

  // Ref so toggleTechnology can read selectedCiv without a closure dep
  const selectedCivRef = useRef(selectedCiv);
  selectedCivRef.current = selectedCiv;

  const toggleTechnology = useCallback((techId: string) => {
    const tech = allTechnologies.find(t => t.id === techId);
    if (!tech) return;
    const allTierIds = getAllTiersFromSameLine(tech).map(t => t.id);
    const improvedId = IMPROVED_TECH_PAIRS[techId];
    const baseId = IMPROVED_TECH_BASE[techId]; // defined when techId is an improved ID

    setActiveTechnologies(prev => {
      const next = new Set(prev);

      if (baseId) {
        // Called with an improved ID (from the + badge)
        if (next.has(techId)) {
          // improved active → deactivate improved only (keep base)
          next.delete(techId);
        } else {
          // improved not active → activate both base and improved
          if (!next.has(baseId)) {
            const baseTech = allTechnologies.find(t => t.id === baseId);
            if (baseTech) {
              getAllTiersFromSameLine(baseTech).map(t => t.id).forEach(id => next.delete(id));
              const civGroups = CIV_TECH_EXCLUSIVE_GROUPS[selectedCivRef.current] || [];
              const exclusiveGroup = civGroups.find(g => g.includes(baseId));
              if (exclusiveGroup) exclusiveGroup.forEach(id => next.delete(id));
              next.add(baseId);
            }
          }
          next.add(techId);
        }
      } else if (next.has(techId)) {
        // Base toggle off — also remove improved if present
        next.delete(techId);
        if (improvedId) next.delete(improvedId);
        setActiveAbilities(prevAbi => {
          const nextAbi = new Set(prevAbi);
          Object.entries(ABILITY_TECH_DEPENDENCIES).forEach(([abilityId, reqTech]) => {
            if (reqTech === techId) nextAbi.delete(abilityId);
          });
          return nextAbi;
        });
      } else {
        // Base toggle on
        allTierIds.forEach(id => next.delete(id));
        const civGroups = CIV_TECH_EXCLUSIVE_GROUPS[selectedCivRef.current] || [];
        const exclusiveGroup = civGroups.find(g => g.includes(techId));
        if (exclusiveGroup) exclusiveGroup.forEach(id => next.delete(id));
        next.add(techId);
      }
      return next;
    });
  }, []);

  // Mutually exclusive weapon-swap ability groups — clicking the active one is a no-op
  const WEAPON_SWAP_GROUPS: readonly (readonly string[])[] = [
    ['ability-desert-raider-blade', 'ability-desert-raider-bow'],
    ['ability-swap-weapon-kinetic', 'ability-swap-weapon-incendiary'],
    ['ability-streltsy-berdysh', 'ability-streltsy-handcannon'],
    ['ability-riddari-melee', 'ability-riddari-thrown-axes'],
  ];

  // Default weapon ability per weapon-swap unit (activated on first load)
  const WEAPON_SWAP_DEFAULTS: Record<string, string> = {
    'desert-raider': 'ability-desert-raider-bow',
    'manjaniq': 'ability-swap-weapon-kinetic',
    'streltsy': 'ability-streltsy-handcannon',
    'riddari': 'ability-riddari-melee',
    'hippodrome-riddari': 'ability-riddari-melee',
  };

  // Ability dependencies: a dependent ability can only be active when its required ability is active
  const ABILITY_DEPENDENCIES: Record<string, string> = {
    'ability-royal-knight-charge-damage': 'charge-attack',
    'ability-nehan': 'ability-buddhist-conversion'
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

  const incrementAbility = useCallback((abilityId: string) => {
    const ability = abilitiesRef.current.find(a => a.id === abilityId);
    if (!ability || ability.counterMax === undefined) return;
    setAbilityCounters(prev => {
      const current = prev.get(abilityId) ?? 0;
      if (current >= ability.counterMax!) return prev;
      const next = new Map(prev);
      next.set(abilityId, current + 1);
      return next;
    });
    setActiveAbilities(prev => {
      if (prev.has(abilityId)) return prev;
      const next = new Set(prev);
      next.add(abilityId);
      return next;
    });
  }, []);

  const setAbilityCounter = useCallback((abilityId: string, value: number) => {
    const ability = abilitiesRef.current.find(a => a.id === abilityId);
    if (!ability || ability.counterMax === undefined) return;
    const clamped = Math.max(0, Math.min(ability.counterMax, Math.round(value)));
    setAbilityCounters(prev => {
      const next = new Map(prev);
      if (clamped === 0) next.delete(abilityId); else next.set(abilityId, clamped);
      return next;
    });
    setActiveAbilities(prev => {
      const next = new Set(prev);
      if (clamped === 0) next.delete(abilityId); else next.add(abilityId);
      return next;
    });
  }, []);

  const decrementAbility = useCallback((abilityId: string) => {
    setAbilityCounters(prev => {
      const current = prev.get(abilityId) ?? 0;
      if (current <= 0) return prev;
      const next = new Map(prev);
      const newCount = current - 1;
      if (newCount === 0) {
        next.delete(abilityId);
        setActiveAbilities(prevAbi => {
          const nextAbi = new Set(prevAbi);
          nextAbi.delete(abilityId);
          return nextAbi;
        });
      } else {
        next.set(abilityId, newCount);
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

  // Deactivate technologies whose minAge exceeds the current selected age
  useEffect(() => {
    setActiveTechnologies(prev => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      let changed = false;
      for (const techId of [...next]) {
        const tech = allTechnologies.find(t => t.id === techId);
        if (tech && tech.minAge > selectedAge) {
          next.delete(techId);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selectedAge]);

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
    'earls-retinue',
    'garrison-command',
    'gunpowder-contingent',
    'mansa-musofadi-warrior',
    'mansa-javelineer',
    'khaganate-mangudai',
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

  // Effective classes for weapon-swap units: swap ranged ↔ melee class set based on active weapon
  const DESERT_RAIDER_RANGED_CLASSES = ['ranged', 'archer', 'cavalry_archer', 'ranged_hybrid'];
  const STRELTSY_RANGED_CLASSES = ['ranged', 'ranged_infantry', 'gunpowder', 'handcannon'];
  const effectiveClasses = useMemo(() => {
    const cls = unit?.classes || [];
    if (unit?.id === 'desert-raider' && activeAbilities.has('ability-desert-raider-blade')) {
      const withoutRanged = cls.filter(c => !DESERT_RAIDER_RANGED_CLASSES.includes(c.toLowerCase()));
      return withoutRanged.includes('melee') ? withoutRanged : [...withoutRanged, 'melee'];
    }
    if (unit?.id === 'streltsy' && activeAbilities.has('ability-streltsy-berdysh')) {
      const withoutRanged = cls.filter(c => !STRELTSY_RANGED_CLASSES.includes(c.toLowerCase()));
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

    // Berdysh mode: strip techs that only affect ranged/gunpowder properties
    if (unit.id === 'streltsy' && activeAbilities.has('ability-streltsy-berdysh')) {
      return filtered.filter(t => {
        const allEffects = [
          ...(t.effects || []),
          ...t.variations.flatMap((v: any) => v.effects || []) // eslint-disable-line @typescript-eslint/no-explicit-any
        ];
        const relevant = allEffects.filter((e: any) => e.property && e.property !== 'unknown'); // eslint-disable-line @typescript-eslint/no-explicit-any
        if (relevant.length === 0) return true;
        const RANGED_ONLY_PROPS = new Set(['rangedAttack', 'maxRange', 'siegeAttack', 'gunpowderAttack']);
        return !relevant.every((e: any) => RANGED_ONLY_PROPS.has(e.property)); // eslint-disable-line @typescript-eslint/no-explicit-any
      });
    }

    return filtered;
  }, [unit, effectiveClasses, selectedCiv, selectedAge, activeAbilities]);

  const abilities = useMemo<Ability[]>(() => {
    if (!unit) return [];
    const all = getAbilitiesForUnit(effectiveClasses, selectedCiv, selectedAge, unit.id);
    // Knight types without charge attack
    let filtered = (
      unit.id === 'desert-raider' ||
      unit.id === 'cataphract' ||
      unit.id == "camel-rider" ||
      unit.id == "black-rider" ||
      unit.id === 'shinobi' ||
      unit.id === 'jeanne-darc-markswoman' ||
      unit.id === 'jeanne-darc-mounted-archer' ||
      unit.id === 'jeanne-darc-blast-cannon' ||
      unit.id === 'serjeant' ||
      unit.id === 'streltsy' ||
      unit.id === 'riddari' ||
      unit.id === 'hippodrome-riddari' ||
      unit.id === 'musofadi-warrior' ||
      unit.id === 'warrior-scout' ||
      unit.id === 'sofa'

    )
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
          && !(a.id in ABILITY_DEPENDENCIES)
          && (!a.activeForIds || a.activeForIds.includes(unit.id) || a.activeForIds.includes((unit as any).baseId)))
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
        && !(a.id in ABILITY_DEPENDENCIES)
        && (!a.activeForIds || a.activeForIds.includes(unit.id) || a.activeForIds.includes((unit as any).baseId)))
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

  // Auto-activate and lock technologies for specific unit IDs
  const LOCKED_UNIT_TECHS: Record<string, string[]> = {
    'teutonic-knight': ['teutonic-order'],
    'serjeant': ['principality-of-antioch'],
    'heavy-spearman': ['angevin-empire'],
    'genitour': ['kingdom-of-castile'],
    'chevalier-confrere': ['kingdom-of-france'],
    'szlachta-cavalry': ['kingdom-of-poland'],
  };
  useEffect(() => {
    if (!unit) return;
    const defaults = (LOCKED_UNIT_TECHS[unit.id] || []).filter(id => techs.some(t => t.id === id));
    if (defaults.length === 0) return;
    setActiveTechnologies(prev => new Set([...prev, ...defaults]));
  }, [unit, techs]);

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

    // Streltsy: Handcannon (ranged) vs Berdysh Axe (melee)
    if (unit?.id === 'streltsy') {
      const useBerdysh = activeAbilities.has('ability-streltsy-berdysh');
      const berdyshWeapon = variation.weapons.find(w => w.type === 'melee');
      const handcannonWeapon = variation.weapons.find(w => w.type === 'ranged');
      const activeMainWeapon = useBerdysh ? berdyshWeapon : handcannonWeapon;
      if (!activeMainWeapon) return variation;
      return { ...variation, weapons: [activeMainWeapon] };
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

    // Riddari / Hippodrome-Riddari: Sword (melee) vs Throwing Axe
    if (unit?.id === 'riddari' || unit?.id === 'hippodrome-riddari') {
      const useThrown = activeAbilities.has('ability-riddari-thrown-axes');
      const thrownAxe = variation.weapons.find(w => w.name === 'Throwing Axe');
      const torchWeapon = variation.weapons.find(w => w.type === 'fire');
      const meleeWeapons = variation.weapons.filter(w => w !== thrownAxe && w !== torchWeapon);
      if (useThrown && thrownAxe) {
        return { ...variation, weapons: [thrownAxe, ...(torchWeapon ? [torchWeapon] : [])] };
      }
      return { ...variation, weapons: [...meleeWeapons, ...(torchWeapon ? [torchWeapon] : [])] };
    }

    return variation;
  }, [variation, activeAbilities, unit]);

  const modifiedStats = useMemo(() => {
    const data = effectiveVariation || unit;
    if (!data) return {
      hitpoints: 0, meleeAttack: 0, rangedAttack: 0, siegeAttack: 0,
      meleeArmor: 0, rangedArmor: 0, moveSpeed: 0, attackSpeed: 0, bonusDamage: [], rangedResistance: 0, meleeResistance: 0,
    };

    const weapon = getPrimaryWeapon(data);
    const baseStats: UnitStats = {
      hitpoints: data.hitpoints,
      meleeAttack: weapon?.type === 'melee' ? (weapon.damage || 0) : 0,
      rangedAttack: weapon?.type === 'ranged'
        ? (weapon.damage || 0)
        : ((data as any).secondaryWeapons?.[0]?.damage || 0), // eslint-disable-line @typescript-eslint/no-explicit-any
      siegeAttack: weapon?.type === 'siege' ? (weapon.damage || 0) : 0,
      meleeArmor: getArmorValue(data, "melee"),
      rangedArmor: getArmorValue(data, "ranged"),
      moveSpeed: 'movement' in data ? (data as { movement?: { speed: number } }).movement?.speed || 0 : 0,
      attackSpeed: weapon?.speed || 0,
      maxRange: weapon?.range?.max || 0,
      burst: weapon?.burst?.count || 1,
      bonusDamage: (weapon?.modifiers || []).map((m: any) => ({ ...m, fromWeapon: true })), // eslint-disable-line @typescript-eslint/no-explicit-any
      rangedResistance: getResistanceValue(data, 'ranged'),
      meleeResistance: getResistanceValue(data, 'melee'),
      siegeResistance: getResistanceValue(data, 'siege'),
      healingRate: 0,
      healingRatePerSecond: (data as any).healingRatePerSecond ?? 0, // eslint-disable-line @typescript-eslint/no-explicit-any
      armorPenetration: 0,
      opponentAttackSpeedDebuff: 0,
      versusOpponentDamageDebuff: 1,
      opponentHealingRateDebuff: (data as any).opponentHealingRateDebuff ?? 0, // eslint-disable-line @typescript-eslint/no-explicit-any
    };

    const techVariations = getActiveTechnologyVariationsWithTiers(activeTechnologies, selectedCiv, selectedAge);

    // Counter abilities are handled with a dynamic value — exclude from normal variation flow
    const counterAbilityIds = new Set(abilities.filter(a => a.counterMax !== undefined).map(a => a.id));
    const activeAbilitiesNoCounter = new Set([...activeAbilities].filter(id => !counterAbilityIds.has(id)));
    const abilityVariations = getActiveAbilityVariations(activeAbilitiesNoCounter, selectedCiv, selectedAge);

    // Base-modifying abilities (e.g. Clocktower) produce units with a higher HP base —
    // they are applied in a separate pass AFTER other abilities/techs so their ×HP acts
    // as a final multiplier rather than stacking additively with Ming Dynasty etc.
    const BASE_MODIFYING_ABILITY_IDS = new Set(['ability-astronomical-clocktower']);
    const baseAbilityVariations = abilityVariations.filter(v => BASE_MODIFYING_ABILITY_IDS.has(v.baseId));
    const regularAbilityVariations = abilityVariations.filter(v => !BASE_MODIFYING_ABILITY_IDS.has(v.baseId));

    const withTechs = applyTechnologyEffects(baseStats, effectiveClasses, techVariations, unit?.id, selectedCiv);
    const withAbilities = applyTechnologyEffects(withTechs, effectiveClasses, regularAbilityVariations, unit?.id, selectedCiv);
    let result = applyTechnologyEffects(withAbilities, effectiveClasses, baseAbilityVariations, unit?.id, selectedCiv);

    for (const interaction of techAbilityInteractions) {
      if (
        activeTechnologies.has(interaction.requiredTech) &&
        activeAbilities.has(interaction.requiredAbility) &&
        (!interaction.unitId || unit?.id === interaction.unitId)
      ) {
        result = interaction.apply(result);
      }
    }

    if (unit?.id === 'varangian-guard' && selectedAge === 2 && selectedCiv === 'mac' && activeAbilities.has('ability-berserking')) {
      result = { ...result, meleeAttack: result.meleeAttack - 1 };
    }

    if (
      activeAbilities.has('ability-royal-knight-charge-damage') &&
      activeAbilities.has('charge-attack') &&
      (unit?.id === 'royal-knight' || unit?.id === 'jeanne-darc-knight')
    ) {
      result = { ...result, postChargeMeleeBonus: activeTechnologies.has('cantled-saddles') ? 10 : 3 };
    }

    // yam-network-improved (×1.15) and maneuver-arrow (×1.33) don't stack — take the max (remove the smaller)
    if (activeAbilities.has('ability-yam-network-improved') && activeAbilities.has('ability-maneuver-arrow')) {
      result = { ...result, moveSpeed: result.moveSpeed / 1.15 };
    }

    // HRE infantry passive: +10% move speed (formerly a technology, now a baked-in passive not present in data)
    // Age I: +5% only. Also applies to landsknecht when used as Byzantine mercenary.
    const isHREInfantry = selectedCiv === 'hr' && effectiveClasses.some(c => c === 'infantry' || c.includes('infantry'));
    const isLandsknecht = unit?.id === 'landsknecht' && selectedCiv === 'by';
    if (isHREInfantry || isLandsknecht) {
      result = { ...result, moveSpeed: result.moveSpeed * (selectedAge === 1 ? 1.05 : 1.1) };
    }

    // enlist-mansa-musofadi: age-varying armor delta (+4 base from tech, +1 at age III, +2 at age IV)
    if (unit?.id === 'musofadi-warrior' && activeTechnologies.has('enlist-mansa-musofadi')) {
      const armorDelta = selectedAge >= 4 ? 2 : selectedAge >= 3 ? 1 : 0;
      if (armorDelta > 0) result = { ...result, meleeArmor: result.meleeArmor + armorDelta };
    }

    if (result.moveSpeed > 2) result = { ...result, moveSpeed: 2 };
    if (result.meleeArmor < 0) result = { ...result, meleeArmor: 0 };
    if (result.rangedArmor < 0) result = { ...result, rangedArmor: 0 };

    // Fixed attack speed overrides — ability sets an absolute AS regardless of techs
    if (activeAbilities.has('ability-arrow-volley')) {
      result = { ...result, attackSpeed: 0.6 };
    }

    // Counter abilities: apply with dynamic value 1/(1 + N × step)
    for (const ability of abilities) {
      if (ability.counterMax === undefined) continue;
      if (!activeAbilities.has(ability.id)) continue;
      const count = abilityCounters.get(ability.id) ?? 0;
      if (count === 0) continue;
      const step = (unit?.id ? ability.unitCounterStep?.[unit.id] : undefined) ?? ability.counterStep ?? 0.05;
      const stepsSum = ability.counterSteps !== undefined
        ? ability.counterSteps.slice(0, count).reduce((a, b) => a + b, 0)
        : undefined;
      const effectiveValue = stepsSum !== undefined
        ? (ability.counterDirection === 'additive' ? stepsSum : 1 + stepsSum)
        : ability.counterDirection === 'increase'
          ? 1 + count * step
          : ability.counterDirection === 'additive'
            ? count * step
            : 1 / (1 + count * step);
      const counterVariation = getAbilityVariation(ability.id, selectedCiv, ability.minAge);
      if (!counterVariation) continue;
      const syntheticVariation = {
        ...counterVariation,
        effects: (counterVariation.effects || []).map((e: any) => ({ ...e, value: effectiveValue * (e.counterStepScale ?? 1) })), // eslint-disable-line @typescript-eslint/no-explicit-any
      };
      result = applyTechnologyEffects(result, effectiveClasses, [syntheticVariation], unit?.id, selectedCiv);
    }

    return result;
  }, [unit, variation, effectiveClasses, activeTechnologies, activeAbilities, selectedCiv, selectedAge, abilities, abilityCounters]);

  const activeTimedDuration = useMemo((): number | undefined => {
    let minDuration: number | undefined = undefined;
    for (const abilityId of activeAbilities) {
      const v = getAbilityVariation(abilityId, selectedCiv, selectedAge);
      for (const effect of v?.effects || []) {
        if ('duration' in effect && typeof (effect as any).duration === 'number') { // eslint-disable-line @typescript-eslint/no-explicit-any
          const d = (effect as any).duration as number; // eslint-disable-line @typescript-eslint/no-explicit-any
          if (minDuration === undefined || d < minDuration) minDuration = d;
        }
      }
    }
    return minDuration;
  }, [activeAbilities, selectedCiv, selectedAge]);

  const modifiedStatsNoTimer = useMemo(() => {
    const hasTimedEffects = [...activeAbilities].some(id => {
      const v = getAbilityVariation(id, selectedCiv, selectedAge);
      return v?.effects?.some((e: any) => 'duration' in e); // eslint-disable-line @typescript-eslint/no-explicit-any
    });
    if (!hasTimedEffects) return modifiedStats;
    const timedAbilityIsWeaponSwap = [...activeAbilities].some(id => {
      const isSwap = WEAPON_SWAP_GROUPS.some(g => g.includes(id));
      if (!isSwap) return false;
      const v = getAbilityVariation(id, selectedCiv, selectedAge);
      return v?.effects?.some((e: any) => 'duration' in e); // eslint-disable-line @typescript-eslint/no-explicit-any
    });
    const data = (timedAbilityIsWeaponSwap ? variation : effectiveVariation) || unit;
    if (!data) return modifiedStats;
    const weapon = getPrimaryWeapon(data);
    const baseStats: UnitStats = {
      hitpoints: data.hitpoints,
      meleeAttack: weapon?.type === 'melee' ? (weapon.damage || 0) : 0,
      rangedAttack: weapon?.type === 'ranged'
        ? (weapon.damage || 0)
        : ((data as any).secondaryWeapons?.[0]?.damage || 0), // eslint-disable-line @typescript-eslint/no-explicit-any
      siegeAttack: weapon?.type === 'siege' ? (weapon.damage || 0) : 0,
      meleeArmor: getArmorValue(data, "melee"),
      rangedArmor: getArmorValue(data, "ranged"),
      moveSpeed: 'movement' in data ? (data as { movement?: { speed: number } }).movement?.speed || 0 : 0,
      attackSpeed: weapon?.speed || 0,
      maxRange: weapon?.range?.max || 0,
      burst: weapon?.burst?.count || 1,
      bonusDamage: (weapon?.modifiers || []).map((m: any) => ({ ...m, fromWeapon: true })), // eslint-disable-line @typescript-eslint/no-explicit-any
      rangedResistance: getResistanceValue(data, 'ranged'),
      meleeResistance: getResistanceValue(data, 'melee'),
      siegeResistance: getResistanceValue(data, 'siege'),
      healingRate: 0,
      healingRatePerSecond: (data as any).healingRatePerSecond ?? 0, // eslint-disable-line @typescript-eslint/no-explicit-any
      armorPenetration: 0,
      opponentAttackSpeedDebuff: 0,
      versusOpponentDamageDebuff: 1,
      opponentHealingRateDebuff: (data as any).opponentHealingRateDebuff ?? 0, // eslint-disable-line @typescript-eslint/no-explicit-any
    };
    const techVariations = getActiveTechnologyVariationsWithTiers(activeTechnologies, selectedCiv, selectedAge);
    const counterAbilityIds = new Set(abilities.filter(a => a.counterMax !== undefined).map(a => a.id));
    const activeAbilitiesFiltered = new Set([...activeAbilities].filter(id => !counterAbilityIds.has(id)));
    const abilityVariations = getActiveAbilityVariations(activeAbilitiesFiltered, selectedCiv, selectedAge)
      .map(v => ({ ...v, effects: (v.effects || []).filter((e: any) => !('duration' in e)) })); // eslint-disable-line @typescript-eslint/no-explicit-any
    const BASE_MODIFYING_ABILITY_IDS = new Set(['ability-astronomical-clocktower']);
    const baseAbilityVariations = abilityVariations.filter(v => BASE_MODIFYING_ABILITY_IDS.has(v.baseId));
    const regularAbilityVariations = abilityVariations.filter(v => !BASE_MODIFYING_ABILITY_IDS.has(v.baseId));
    const withTechs = applyTechnologyEffects(baseStats, effectiveClasses, techVariations, unit?.id, selectedCiv);
    const withAbilities = applyTechnologyEffects(withTechs, effectiveClasses, regularAbilityVariations, unit?.id, selectedCiv);
    let result = applyTechnologyEffects(withAbilities, effectiveClasses, baseAbilityVariations, unit?.id, selectedCiv);
    for (const interaction of techAbilityInteractions) {
      if (activeTechnologies.has(interaction.requiredTech) && activeAbilities.has(interaction.requiredAbility) && (!interaction.unitId || unit?.id === interaction.unitId)) {
        const abilityVar = getAbilityVariation(interaction.requiredAbility, selectedCiv, selectedAge);
        if (abilityVar?.effects?.some((e: any) => 'duration' in e)) continue; // eslint-disable-line @typescript-eslint/no-explicit-any
        result = interaction.apply(result);
      }
    }

    if (unit?.id === 'varangian-guard' && selectedAge === 2 && selectedCiv === 'mac' && activeAbilities.has('ability-berserking')) {
      result = { ...result, meleeAttack: result.meleeAttack - 1 };
    }

    const isHREInfantry = selectedCiv === 'hr' && effectiveClasses.some(c => c === 'infantry' || c.includes('infantry'));
    const isLandsknecht = unit?.id === 'landsknecht' && selectedCiv === 'by';
    if (isHREInfantry || isLandsknecht) {
      result = { ...result, moveSpeed: result.moveSpeed * (selectedAge === 1 ? 1.05 : 1.1) };
    }
    if (unit?.id === 'musofadi-warrior' && activeTechnologies.has('enlist-mansa-musofadi')) {
      const armorDelta = selectedAge >= 4 ? 2 : selectedAge >= 3 ? 1 : 0;
      if (armorDelta > 0) result = { ...result, meleeArmor: result.meleeArmor + armorDelta };
    }
    if (result.moveSpeed > 2) result = { ...result, moveSpeed: 2 };
    if (result.meleeArmor < 0) result = { ...result, meleeArmor: 0 };
    if (result.rangedArmor < 0) result = { ...result, rangedArmor: 0 };
    if (activeAbilities.has('ability-arrow-volley')) {
      result = { ...result, attackSpeed: 0.6 };
    }
    for (const ability of abilities) {
      if (ability.counterMax === undefined || !activeAbilities.has(ability.id)) continue;
      const count = abilityCounters.get(ability.id) ?? 0;
      if (count === 0) continue;
      const step = (unit?.id ? ability.unitCounterStep?.[unit.id] : undefined) ?? ability.counterStep ?? 0.05;
      const stepsSum = ability.counterSteps !== undefined
        ? ability.counterSteps.slice(0, count).reduce((a, b) => a + b, 0)
        : undefined;
      const effectiveValue = stepsSum !== undefined
        ? (ability.counterDirection === 'additive' ? stepsSum : 1 + stepsSum)
        : ability.counterDirection === 'increase'
          ? 1 + count * step
          : ability.counterDirection === 'additive'
            ? count * step
            : 1 / (1 + count * step);
      const counterVariation = getAbilityVariation(ability.id, selectedCiv, ability.minAge);
      if (!counterVariation) continue;
      const syntheticVariation = {
        ...counterVariation,
        effects: (counterVariation.effects || []).map((e: any) => ({ ...e, value: effectiveValue * (e.counterStepScale ?? 1) })), // eslint-disable-line @typescript-eslint/no-explicit-any
      };
      result = applyTechnologyEffects(result, effectiveClasses, [syntheticVariation], unit?.id, selectedCiv);
    }
    return result;
  }, [modifiedStats, activeAbilities, unit, variation, effectiveVariation, effectiveClasses, activeTechnologies, selectedCiv, selectedAge, abilities, abilityCounters]);

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
    (DEFAULT_ACTIVE_TECHS[selectedCiv] || []).forEach(id => locked.add(id));
    (LOCKED_UNIT_TECHS[unit?.id ?? ''] || []).forEach(id => locked.add(id));
    return locked;
  }, [selectedCiv, unit]);

  return {
    unit, setUnit,
    selectedCiv, setSelectedCiv,
    selectedAge, setSelectedAge,
    variation: effectiveVariation,
    activeTechnologies, setActiveTechnologies,
    activeAbilities, setActiveAbilities,
    abilityCounters,
    openCategories, toggleCategory,
    filteredUnits,
    categorizedUnits,
    techs,
    abilities,
    modifiedStats,
    modifiedStatsNoTimer,
    activeTimedDuration,
    toggleTechnology,
    toggleAbility,
    incrementAbility,
    decrementAbility,
    setAbilityCounter,
    lockedAbilities,
    lockedTechnologies,
    secondaryWeapons,
  };
}
