import { useState } from "react";
import { aoe4Units, AoE4Unit, getAvailableAges, getPrimaryWeapon, getTotalCost } from "@/data/unified-units";
import type { UnifiedVariation } from "@/data/unified-units";
import { CIVILIZATIONS } from "@/data/civilizations";
import { UnitCard } from "@/components/UnitCard";
import { computeVersus, computeVersusAtEqualCost, getVersusDebuffMultiplier } from "@/lib/combat";
import { AgeSelector } from "@/components/AgeSelector";
import { TechnologySelector } from "@/components/TechnologySelector";
import { AbilitySelector } from "@/components/AbilitySelector";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { motion } from "framer-motion";
import { useUnitSlot } from "@/hooks/useUnitSlot";


const categoryNames: Record<string, string> = {
  melee_infantry: 'Melee Infantry',
  ranged: 'Ranged Units',
  cavalry: 'Cavalry',
  siege: 'Siege',
  monk: 'Monks',
  ship: 'Ships',
  other: 'Other'
};

const categoryIcons: Record<string, string> = {
  melee_infantry: 'https://data.aoe4world.com/images/buildings/barracks.png',
  ranged: 'https://data.aoe4world.com/images/buildings/archery-range.png',
  cavalry: 'https://data.aoe4world.com/images/buildings/stable.png',
  siege: 'https://data.aoe4world.com/images/buildings/siege-workshop.png',
  monk: 'https://data.aoe4world.com/images/buildings/monastery.png',
  ship: 'https://data.aoe4world.com/images/buildings/dock.png',
  other: 'https://data.aoe4world.com/images/buildings/house.png'
};

const categoryOrder = ['melee_infantry', 'ranged', 'cavalry', 'siege', 'monk', 'ship', 'other'];

// Function to calculate the charge bonus for a unit
const getChargeBonus = (unitData: AoE4Unit | UnifiedVariation | undefined, activeAbilities: Set<string>, age: number): number => {
  if (!activeAbilities.has('charge-attack') || !unitData) return 0;
  
  // Get the base ID for variations
  const baseId = ('baseId' in unitData) ? unitData.baseId : unitData.id;
  const unitClasses = unitData.classes || [];
  
  const isKnight = unitClasses.some(c => c.toLowerCase() === 'knight');
  const isGhulam = baseId === 'ghulam' || unitClasses.some(c => c.toLowerCase() === 'merc_ghulam');
  
  if (!isKnight && !isGhulam) return 0;
  
  // Charge bonus based on age
  if (isKnight) {
    // TODO: To change more precisely — camel-lancer charge damage may differ from standard knight
    switch (age) {
      case 2: return 10; // Early
      case 3: return 12; // Regular
      case 4: return 14; // Elite
      default: return 0;
    }
  }
  
  // Bonus for Ghulam (no Early variant)
  if (isGhulam) {
    switch (age) {
      case 3: return 5;  // Regular
      case 4: return 6;  // Elite
      default: return 0;
    }
  }
  
  return 0;
};

const Sandbox = () => {
  const [isVersus, setIsVersus] = useState<boolean>(false);
  const [atEqualCost, setAtEqualCost] = useState<boolean>(false);
  const [allowKiting, setAllowKiting] = useState<boolean>(false);
  const [startDistancePreset, setStartDistancePreset] = useState<string>("medium");
  const [customDistance, setCustomDistance] = useState<number>(5);
  const startDistance = startDistancePreset === "melee" ? 0
    : startDistancePreset === "medium" ? 5
    : startDistancePreset === "long" ? 9
    : Math.max(0, Math.min(30, customDistance));

  const ally = useUnitSlot();
  const enemy = useUnitSlot();

  const {
    unit: unit1, setUnit: setUnit1,
    selectedCiv: selectedCivAlly, setSelectedCiv: setSelectedCivAlly,
    selectedAge: selectedAgeAlly, setSelectedAge: setSelectedAgeAlly,
    variation: variationAlly,
    activeTechnologies: activeTechnologiesAlly,
    activeAbilities: activeAbilitiesAlly,
    openCategories: openCategoriesAlly, toggleCategory: toggleCategoryAlly,
    filteredUnits: filteredUnitsAlly,
    categorizedUnits: categorizedUnitsAlly,
    techs: techsAlly,
    abilities: abilitiesAlly,
    modifiedStats: modifiedAllyStats,
    toggleTechnology: toggleTechnologyAlly,
    toggleAbility: toggleAbilityAlly,
  } = ally;

  const {
    unit: unit2, setUnit: setUnit2,
    selectedCiv: selectedCivEnemy, setSelectedCiv: setSelectedCivEnemy,
    selectedAge: selectedAgeEnemy, setSelectedAge: setSelectedAgeEnemy,
    variation: variationEnemy,
    activeTechnologies: activeTechnologiesEnemy,
    activeAbilities: activeAbilitiesEnemy,
    openCategories: openCategoriesEnemy, toggleCategory: toggleCategoryEnemy,
    filteredUnits: filteredUnitsEnemy,
    categorizedUnits: categorizedUnitsEnemy,
    techs: techsEnemy,
    abilities: abilitiesEnemy,
    modifiedStats: modifiedEnemyStats,
    toggleTechnology: toggleTechnologyEnemy,
    toggleAbility: toggleAbilityEnemy,
  } = enemy;

  // Build variations with applied technologies
  const modifiedVariationAlly = variationAlly ? (() => {
    const debuffMultiplier = unit2 && activeAbilitiesEnemy.size > 0 
      ? getVersusDebuffMultiplier(variationAlly.classes || [], Array.from(activeAbilitiesEnemy))
      : 1.0;
    
    return {
      ...variationAlly,
      hitpoints: modifiedAllyStats.hitpoints,
      weapons: variationAlly.weapons.map(weapon => ({
        ...weapon,
        damage: (weapon.type === 'melee' ? modifiedAllyStats.meleeAttack : modifiedAllyStats.rangedAttack) * debuffMultiplier,
        speed: modifiedAllyStats.attackSpeed,
        range: weapon.range ? {
          ...weapon.range,
          max: modifiedAllyStats.maxRange || weapon.range.max
        } : undefined,
        modifiers: modifiedAllyStats.bonusDamage,
        burst: modifiedAllyStats.burst ? { count: modifiedAllyStats.burst } : weapon.burst
      })),
      armor: [
        { type: 'melee', value: modifiedAllyStats.meleeArmor },
        { type: 'ranged', value: modifiedAllyStats.rangedArmor }
      ],
      costs: modifiedAllyStats.costMultiplier != null && modifiedAllyStats.costMultiplier !== 1.0 ? {
        ...variationAlly.costs,
        food: Math.round((variationAlly.costs.food || 0) * modifiedAllyStats.costMultiplier),
        wood: Math.round((variationAlly.costs.wood || 0) * modifiedAllyStats.costMultiplier),
        gold: Math.round((variationAlly.costs.gold || 0) * modifiedAllyStats.costMultiplier),
        stone: Math.round((variationAlly.costs.stone || 0) * modifiedAllyStats.costMultiplier),
        oliveoil: Math.round((variationAlly.costs.oliveoil || 0) * modifiedAllyStats.costMultiplier),
      } : variationAlly.costs,
      movement: variationAlly.movement ? {
        ...variationAlly.movement,
        speed: modifiedAllyStats.moveSpeed
      } : undefined
    };
  })() : undefined;

  const modifiedVariationEnemy = variationEnemy ? (() => {
    const debuffMultiplier = unit1 && activeAbilitiesAlly.size > 0 
      ? getVersusDebuffMultiplier(variationEnemy.classes || [], Array.from(activeAbilitiesAlly))
      : 1.0;
    
    return {
      ...variationEnemy,
      hitpoints: modifiedEnemyStats.hitpoints,
      weapons: variationEnemy.weapons.map(weapon => ({
        ...weapon,
        damage: (weapon.type === 'melee' ? modifiedEnemyStats.meleeAttack : modifiedEnemyStats.rangedAttack) * debuffMultiplier,
        speed: modifiedEnemyStats.attackSpeed,
        range: weapon.range ? {
          ...weapon.range,
          max: modifiedEnemyStats.maxRange || weapon.range.max
        } : undefined,
        modifiers: modifiedEnemyStats.bonusDamage,
        burst: modifiedEnemyStats.burst ? { count: modifiedEnemyStats.burst } : weapon.burst
      })),
      armor: [
        { type: 'melee', value: modifiedEnemyStats.meleeArmor },
        { type: 'ranged', value: modifiedEnemyStats.rangedArmor }
      ],
      costs: modifiedEnemyStats.costMultiplier != null && modifiedEnemyStats.costMultiplier !== 1.0 ? {
        ...variationEnemy.costs,
        food: Math.round((variationEnemy.costs.food || 0) * modifiedEnemyStats.costMultiplier),
        wood: Math.round((variationEnemy.costs.wood || 0) * modifiedEnemyStats.costMultiplier),
        gold: Math.round((variationEnemy.costs.gold || 0) * modifiedEnemyStats.costMultiplier),
        stone: Math.round((variationEnemy.costs.stone || 0) * modifiedEnemyStats.costMultiplier),
        oliveoil: Math.round((variationEnemy.costs.oliveoil || 0) * modifiedEnemyStats.costMultiplier),
      } : variationEnemy.costs,
      movement: variationEnemy.movement ? {
        ...variationEnemy.movement,
        speed: modifiedEnemyStats.moveSpeed
      } : undefined
    };
  })() : undefined;
  
  // Compute stats for comparison
  const allyData = modifiedVariationAlly || unit1;
  const enemyData = modifiedVariationEnemy || unit2;
  
  const modifiedUnit1 = unit1 && !variationAlly ? (() => {
    // Compute the versus debuff from enemy abilities
    const debuffMultiplier = unit2 && activeAbilitiesEnemy.size > 0 
      ? getVersusDebuffMultiplier(unit1.classes || [], Array.from(activeAbilitiesEnemy))
      : 1.0;
    
    return {
      ...unit1,
      hitpoints: modifiedAllyStats.hitpoints,
      weapons: unit1.weapons.map(weapon => ({
        ...weapon,
        damage: (weapon.type === 'melee' ? modifiedAllyStats.meleeAttack : modifiedAllyStats.rangedAttack) * debuffMultiplier,
        speed: modifiedAllyStats.attackSpeed,
        range: weapon.range ? {
          ...weapon.range,
          max: modifiedAllyStats.maxRange || weapon.range.max
        } : undefined,
        modifiers: modifiedAllyStats.bonusDamage,
        burst: modifiedAllyStats.burst ? { count: modifiedAllyStats.burst } : weapon.burst
      })),
      armor: [
        { type: 'melee', value: modifiedAllyStats.meleeArmor },
        { type: 'ranged', value: modifiedAllyStats.rangedArmor }
      ],
      movement: unit1.movement ? {
        ...unit1.movement,
        speed: modifiedAllyStats.moveSpeed
      } : undefined
    };
  })() : undefined;
  
  const modifiedUnit2 = unit2 && !variationEnemy ? (() => {
    // Compute the versus debuff from ally abilities
    const debuffMultiplier = unit1 && activeAbilitiesAlly.size > 0 
      ? getVersusDebuffMultiplier(unit2.classes || [], Array.from(activeAbilitiesAlly))
      : 1.0;
    
    return {
      ...unit2,
      hitpoints: modifiedEnemyStats.hitpoints,
      weapons: unit2.weapons.map(weapon => ({
        ...weapon,
        damage: (weapon.type === 'melee' ? modifiedEnemyStats.meleeAttack : modifiedEnemyStats.rangedAttack) * debuffMultiplier,
        speed: modifiedEnemyStats.attackSpeed,
        range: weapon.range ? {
          ...weapon.range,
          max: modifiedEnemyStats.maxRange || weapon.range.max
        } : undefined,
        modifiers: modifiedEnemyStats.bonusDamage,
        burst: modifiedEnemyStats.burst ? { count: modifiedEnemyStats.burst } : weapon.burst
      })),
      armor: [
        { type: 'melee', value: modifiedEnemyStats.meleeArmor },
        { type: 'ranged', value: modifiedEnemyStats.rangedArmor }
      ],
      movement: unit2.movement ? {
        ...unit2.movement,
        speed: modifiedEnemyStats.moveSpeed
      } : undefined
    };
  })() : undefined;
  
  // Final stats with costs
  const allyStats = allyData ? {
    hp: modifiedAllyStats.hitpoints,
    attack: (() => {
      const baseAttack = Math.max(modifiedAllyStats.meleeAttack, modifiedAllyStats.rangedAttack);
      // In versus mode, apply the enemy abilities debuff to the ally's damage
      if (unit1 && unit2 && activeAbilitiesEnemy.size > 0) {
        const debuffMultiplier = getVersusDebuffMultiplier(
          unit1.classes || [],
          Array.from(activeAbilitiesEnemy)
        );
        return baseAttack * debuffMultiplier;
      }
      return baseAttack;
    })(),
    meleeArmor: modifiedAllyStats.meleeArmor,
    rangedArmor: modifiedAllyStats.rangedArmor,
    speed: modifiedAllyStats.moveSpeed,
    attackSpeed: modifiedAllyStats.attackSpeed || 0,
    maxRange: modifiedAllyStats.maxRange || 0,
    bonusDamage: modifiedAllyStats.bonusDamage || [],
    chargeBonus: getChargeBonus(allyData, activeAbilitiesAlly, selectedAgeAlly),
    cost: variationAlly ? getTotalCost(variationAlly) : (unit1 ? getTotalCost(unit1) : 0),
    costs: variationAlly ? variationAlly.costs : (unit1 ? unit1.costs : undefined),
    population: 'costs' in (variationAlly || unit1 || {}) ? (variationAlly || unit1 as any)?.costs?.popcap : undefined, // eslint-disable-line @typescript-eslint/no-explicit-any
    productionTime: 'costs' in (variationAlly || unit1 || {}) ? (variationAlly || unit1 as any)?.costs?.time : undefined // eslint-disable-line @typescript-eslint/no-explicit-any
  } : null;
  
  const enemyStats = enemyData ? {
    hp: modifiedEnemyStats.hitpoints,
    attack: (() => {
      const baseAttack = Math.max(modifiedEnemyStats.meleeAttack, modifiedEnemyStats.rangedAttack);
      // In versus mode, apply the ally abilities debuff to the enemy's damage
      if (unit1 && unit2 && activeAbilitiesAlly.size > 0) {
        const debuffMultiplier = getVersusDebuffMultiplier(
          unit2.classes || [],
          Array.from(activeAbilitiesAlly)
        );
        return baseAttack * debuffMultiplier;
      }
      return baseAttack;
    })(),
    meleeArmor: modifiedEnemyStats.meleeArmor,
    rangedArmor: modifiedEnemyStats.rangedArmor,
    speed: modifiedEnemyStats.moveSpeed,
    attackSpeed: modifiedEnemyStats.attackSpeed || 0,
    maxRange: modifiedEnemyStats.maxRange || 0,
    bonusDamage: modifiedEnemyStats.bonusDamage || [],
    chargeBonus: getChargeBonus(enemyData, activeAbilitiesEnemy, selectedAgeEnemy),
    cost: variationEnemy ? getTotalCost(variationEnemy) : (unit2 ? getTotalCost(unit2) : 0),
    costs: variationEnemy ? variationEnemy.costs : (unit2 ? unit2.costs : undefined),
    population: 'costs' in (variationEnemy || unit2 || {}) ? (variationEnemy || unit2 as any)?.costs?.popcap : undefined, // eslint-disable-line @typescript-eslint/no-explicit-any
    productionTime: 'costs' in (variationEnemy || unit2 || {}) ? (variationEnemy || unit2 as any)?.costs?.time : undefined // eslint-disable-line @typescript-eslint/no-explicit-any
  } : null;

  // Build aligned bonus lists for each unit
  // 1. First the shared bonuses (same target)
  // 2. Then the unique bonuses for each side
  const allyBonuses = allyStats?.bonusDamage || [];
  const enemyBonuses = enemyStats?.bonusDamage || [];
  
  const matchedTargets = new Set<string>();
  const alignedAllyBonuses: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  const alignedEnemyBonuses: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  
  // Phase 0: Add the charge bonus on the first line ONLY if at least one unit has it
  const allyHasChargeBonus = allyStats?.chargeBonus && allyStats.chargeBonus > 0;
  const enemyHasChargeBonus = enemyStats?.chargeBonus && enemyStats.chargeBonus > 0;
  
  let allyChargeLineIndex = -1;
  let enemyChargeLineIndex = -1;
  
  if (allyHasChargeBonus || enemyHasChargeBonus) {
    if (allyHasChargeBonus) {
      alignedAllyBonuses.push({ 
        isChargeBonus: true, 
        value: allyStats?.chargeBonus 
      });
      allyChargeLineIndex = 0;
    } else {
      alignedAllyBonuses.push({ hidden: true });
    }
    
    if (enemyHasChargeBonus) {
      alignedEnemyBonuses.push({ 
        isChargeBonus: true, 
        value: enemyStats?.chargeBonus 
      });
      enemyChargeLineIndex = 0;
    } else {
      alignedEnemyBonuses.push({ hidden: true });
    }
  }
  
  // Phase 1: Add the shared bonuses (aligned)
  allyBonuses.forEach((allyBonus: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const allyTarget = allyBonus.target?.class?.flat().join(' ') || '';
    const enemyBonus = enemyBonuses.find((b: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const enemyTarget = b.target?.class?.flat().join(' ') || '';
      return enemyTarget === allyTarget;
    });
    
    if (enemyBonus) {
      matchedTargets.add(allyTarget);
      alignedAllyBonuses.push(allyBonus);
      alignedEnemyBonuses.push(enemyBonus);
    }
  });
  
  // Phase 2: Add the unmatched bonuses
  const unmatchedAlly = allyBonuses.filter((b: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const target = b.target?.class?.flat().join(' ') || '';
    return !matchedTargets.has(target);
  });
  
  const unmatchedEnemy = enemyBonuses.filter((b: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const target = b.target?.class?.flat().join(' ') || '';
    return !matchedTargets.has(target);
  });
  
  // Phase 3: Fill the empty rows created by the charge bonus with the first unmatched bonuses
  let allyUnmatchedIndex = 0;
  let enemyUnmatchedIndex = 0;
  
  if (allyChargeLineIndex === -1 && alignedAllyBonuses.length > 0 && alignedAllyBonuses[0]?.hidden && unmatchedAlly.length > 0) {
    alignedAllyBonuses[0] = unmatchedAlly[0];
    allyUnmatchedIndex = 1;
  }
  
  if (enemyChargeLineIndex === -1 && alignedEnemyBonuses.length > 0 && alignedEnemyBonuses[0]?.hidden && unmatchedEnemy.length > 0) {
    alignedEnemyBonuses[0] = unmatchedEnemy[0];
    enemyUnmatchedIndex = 1;
  }
  
  // Phase 4: Add the remaining unmatched bonuses with empty rows to preserve alignment
  const remainingUnmatchedAlly = unmatchedAlly.slice(allyUnmatchedIndex);
  const remainingUnmatchedEnemy = unmatchedEnemy.slice(enemyUnmatchedIndex);
  const maxUnmatched = Math.max(remainingUnmatchedAlly.length, remainingUnmatchedEnemy.length);
  
  for (let i = 0; i < maxUnmatched; i++) {
    if (i < remainingUnmatchedAlly.length) {
      alignedAllyBonuses.push(remainingUnmatchedAlly[i]);
    } else {
      alignedAllyBonuses.push({ hidden: true });
    }
    
    if (i < remainingUnmatchedEnemy.length) {
      alignedEnemyBonuses.push(remainingUnmatchedEnemy[i]);
    } else {
      alignedEnemyBonuses.push({ hidden: true });
    }
  }
  
  const maxBonusDamageLines = alignedAllyBonuses.length;

  // If no units are loaded, display a message
  if (!aoe4Units || aoe4Units.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-4">Erreur de chargement</h2>
          <p className="text-muted-foreground">Les données des unités n'ont pas pu être chargées.</p>
          <p className="text-sm text-muted-foreground mt-2">Vérifiez la console pour plus de détails.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-w-[1080px] max-w-6xl mx-auto"
      >
        <div className="text-center mb-8 space-y-4">
          <div>
            <h1 className="text-4xl font-serif font-bold text-primary mb-2">Sandbox Mode</h1>
            <p className="text-muted-foreground text-lg">Compare any two units from any civilizations!</p>
          </div>
          {/* Mode Toggle */}
          <div className="flex items-center justify-center gap-4">
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setIsVersus(false)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  !isVersus ? 'bg-primary text-background' : 'bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                Comparative
              </button>
              <div className="w-px bg-border" />
              <button
                type="button"
                onClick={() => setIsVersus(true)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  isVersus ? 'bg-primary text-background' : 'bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                Versus
              </button>
            </div>
            {isVersus && (
              <div className="inline-flex items-center gap-3">
                {(() => {
                  const sameCost = unit1 && unit2 && allyStats?.cost != null && enemyStats?.cost != null && allyStats.cost === enemyStats.cost;
                  return (
                    <div
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-card ${sameCost ? 'opacity-50' : ''}`}
                      title={sameCost ? 'Units have the same cost' : undefined}
                    >
                      <input
                        type="checkbox"
                        id="atEqualCost"
                        checked={atEqualCost}
                        onChange={(e) => !sameCost && setAtEqualCost(e.target.checked)}
                        disabled={!!sameCost}
                        className="w-4 h-4 rounded border-border disabled:cursor-not-allowed"
                      />
                      <label htmlFor="atEqualCost" className={`text-sm font-medium ${sameCost ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                        At Equal Cost
                      </label>
                    </div>
                  );
                })()}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-card">
                  <input
                    type="checkbox"
                    id="allowKiting"
                    checked={allowKiting}
                    onChange={(e) => setAllowKiting(e.target.checked)}
                    className="w-4 h-4 rounded border-border"
                  />
                  <label htmlFor="allowKiting" className="text-sm font-medium cursor-pointer">
                    Allow Kiting
                  </label>
                </div>
                {allowKiting && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-card">
                    <label className="text-sm font-medium">Start Distance:</label>
                    <select
                      value={startDistancePreset}
                      onChange={(e) => setStartDistancePreset(e.target.value)}
                      className="text-sm bg-transparent border-none outline-none cursor-pointer"
                    >
                      <option value="melee">Melee (0)</option>
                      <option value="medium">Medium (5)</option>
                      <option value="long">Long (9)</option>
                      <option value="custom">Custom</option>
                    </select>
                    {startDistancePreset === "custom" && (
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={customDistance}
                        onChange={(e) => setCustomDistance(Number(e.target.value))}
                        className="w-16 text-sm bg-transparent border border-border rounded px-1 outline-none"
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Ally Column */}
          <div className="space-y-4 flex flex-col items-end">
            <label className="text-sm font-medium text-foreground">Civilization (Ally):</label>
            <Select value={selectedCivAlly} onValueChange={setSelectedCivAlly}>
              <SelectTrigger className="bg-secondary border-border h-14">
                <SelectValue>
                  {selectedCivAlly === "all" ? (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-muted rounded">
                        <span className="text-xl">?</span>
                      </div>
                      <span className="font-medium">All Civilizations</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <img 
                        src={CIVILIZATIONS.find(c => c.abbr === selectedCivAlly)?.flagPath} 
                        alt="" 
                        className="w-8 h-8 object-contain" 
                      />
                      <span className="font-medium">
                        {CIVILIZATIONS.find(c => c.abbr === selectedCivAlly)?.name}
                      </span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-popover border-border max-h-[400px]">
                <SelectItem value="all" className="data-[state=checked]:font-bold py-3 group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center bg-muted rounded">
                      <span className="text-xl text-white group-hover:text-black transition-colors">?</span>
                    </div>
                    <span className="font-medium text-white group-hover:text-black transition-colors">All Civilizations</span>
                  </div>
                </SelectItem>
                {CIVILIZATIONS.map((civ) => (
                  <SelectItem key={civ.abbr} value={civ.abbr} className="data-[state=checked]:font-bold py-3 group">
                    <div className="flex items-center gap-3">
                      <img src={civ.flagPath} alt={civ.name} className="w-8 h-8 object-contain" />
                      <span className="font-medium text-white group-hover:text-black transition-colors">{civ.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <label className="text-sm font-medium text-foreground mt-6 block">Friendly Unit:</label>
            <Select
              value={unit1?.id === 'desert-raider' && activeAbilitiesAlly.has('ability-desert-raider-blade') ? 'desert-raider_cavalry' : (unit1?.id || "")}
              onValueChange={(value) => {
                if (value === 'desert-raider_cavalry') {
                  setUnit1(filteredUnitsAlly.find(u => u.id === 'desert-raider') || null, 'ability-desert-raider-blade');
                } else {
                  setUnit1(filteredUnitsAlly.find(u => u.id === value) || null);
                }
              }}
            >
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Select a unit..." />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border max-h-[500px]">
                {categoryOrder.map(categoryKey => {
                  const units = categorizedUnitsAlly[categoryKey];
                  if (!units || units.length === 0) return null;
                  
                  const isOpen = openCategoriesAlly[categoryKey];
                  
                  return (
                    <SelectGroup key={categoryKey}>
                      <div 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleCategoryAlly(categoryKey);
                        }}
                        className="cursor-pointer hover:bg-accent px-2 py-2 rounded group"
                      >
                        <SelectLabel className="text-primary group-hover:text-background font-semibold flex items-center gap-2 cursor-pointer">
                          <span className="text-xs">{isOpen ? '▼' : '▶'}</span>
                          <img 
                            src={categoryIcons[categoryKey]} 
                            alt="" 
                            className="w-5 h-5 object-contain inline-block" 
                          />
                          <span>{categoryNames[categoryKey]} ({units.length})</span>
                        </SelectLabel>
                      </div>
                      {isOpen && units.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id} className="data-[state=checked]:font-bold pl-8 group">
                          <div className="flex items-center gap-2">
                            <img src={unit.icon} alt={unit.name} className="w-6 h-6 object-contain" />
                            <span className="text-white group-hover:text-black transition-colors">{unit.name}</span>
                            {unit.unique && <span className="text-xs text-primary">(Unique)</span>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{filteredUnitsAlly.length} units available</p>
          </div>

          {/* Enemy Column */}
          <div className="space-y-4 flex flex-col items-start">
            <label className="text-sm font-medium text-foreground">Civilization (Enemy):</label>
            <Select value={selectedCivEnemy} onValueChange={setSelectedCivEnemy}>
              <SelectTrigger className="bg-secondary border-border h-14">
                <SelectValue>
                  {selectedCivEnemy === "all" ? (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 flex items-center justify-center bg-muted rounded">
                        <span className="text-xl">?</span>
                      </div>
                      <span className="font-medium">All Civilizations</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <img 
                        src={CIVILIZATIONS.find(c => c.abbr === selectedCivEnemy)?.flagPath} 
                        alt="" 
                        className="w-8 h-8 object-contain" 
                      />
                      <span className="font-medium">
                        {CIVILIZATIONS.find(c => c.abbr === selectedCivEnemy)?.name}
                      </span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-popover border-border max-h-[400px]">
                <SelectItem value="all" className="data-[state=checked]:font-bold py-3 group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center bg-muted rounded">
                      <span className="text-xl text-white group-hover:text-black transition-colors">?</span>
                    </div>
                    <span className="font-medium text-white group-hover:text-black transition-colors">All Civilizations</span>
                  </div>
                </SelectItem>
                {CIVILIZATIONS.map((civ) => (
                  <SelectItem key={civ.abbr} value={civ.abbr} className="data-[state=checked]:font-bold py-3 group">
                    <div className="flex items-center gap-3">
                      <img src={civ.flagPath} alt={civ.name} className="w-8 h-8 object-contain" />
                      <span className="font-medium text-white group-hover:text-black transition-colors">{civ.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <label className="text-sm font-medium text-foreground mt-6 block">Enemy Unit:</label>
            <Select
              value={unit2?.id === 'desert-raider' && activeAbilitiesEnemy.has('ability-desert-raider-blade') ? 'desert-raider_cavalry' : (unit2?.id || "")}
              onValueChange={(value) => {
                if (value === 'desert-raider_cavalry') {
                  setUnit2(filteredUnitsEnemy.find(u => u.id === 'desert-raider') || null, 'ability-desert-raider-blade');
                } else {
                  setUnit2(filteredUnitsEnemy.find(u => u.id === value) || null);
                }
              }}
            >
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder="Select a unit..." />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border max-h-[500px]">
                {categoryOrder.map(categoryKey => {
                  const units = categorizedUnitsEnemy[categoryKey];
                  if (!units || units.length === 0) return null;
                  
                  const isOpen = openCategoriesEnemy[categoryKey];
                  
                  return (
                    <SelectGroup key={categoryKey}>
                      <div 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleCategoryEnemy(categoryKey);
                        }}
                        className="cursor-pointer hover:bg-accent px-2 py-2 rounded group"
                      >
                        <SelectLabel className="text-primary group-hover:text-background font-semibold flex items-center gap-2 cursor-pointer">
                          <span className="text-xs">{isOpen ? '▼' : '▶'}</span>
                          <img 
                            src={categoryIcons[categoryKey]} 
                            alt="" 
                            className="w-5 h-5 object-contain inline-block" 
                          />
                          <span>{categoryNames[categoryKey]} ({units.length})</span>
                        </SelectLabel>
                      </div>
                      {isOpen && units.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id} className="data-[state=checked]:font-bold pl-8 group">
                          <div className="flex items-center gap-2">
                            <img src={unit.icon} alt={unit.name} className="w-6 h-6 object-contain" />
                            <span className="text-white group-hover:text-black transition-colors">{unit.name}</span>
                            {unit.unique && <span className="text-xs text-primary">(Unique)</span>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{filteredUnitsEnemy.length} units available</p>
          </div>
        </div>

        {/* Comparison / versus area */}
        {!isVersus && (
          <div className="grid grid-cols-2 gap-6 mt-8">
            {/* Ally Unit */}
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="flex justify-center w-full"
              >
              {unit1 && (
                <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4 w-full">
                  <div className="flex flex-row flex-wrap sm:flex-col gap-2 sm:gap-3 sm:flex-shrink-0">
                    <AgeSelector
                      availableAges={getAvailableAges(unit1.id, selectedCivAlly)}
                      selectedAge={selectedAgeAlly}
                      onAgeChange={setSelectedAgeAlly}
                      orientation="left"
                    />
                    <TechnologySelector
                      technologies={techsAlly}
                      activeTechnologies={activeTechnologiesAlly}
                      onToggle={toggleTechnologyAlly}
                      orientation="left"
                    />
                    <AbilitySelector
                      abilities={abilitiesAlly}
                      activeAbilities={activeAbilitiesAlly}
                      onToggle={toggleAbilityAlly}
                      orientation="left"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <UnitCard
                      className="w-full"
                      variation={modifiedVariationAlly!}
                      unit={modifiedUnit1 || unit1}
                      side="left"
                      isSelected={true}
                      compareHp={enemyStats?.hp}
                      compareAttack={enemyStats?.attack}
                      compareMeleeArmor={enemyStats?.meleeArmor}
                      compareRangedArmor={enemyStats?.rangedArmor}
                      compareSpeed={enemyStats?.speed}
                      compareAttackSpeed={enemyStats?.attackSpeed}
                      compareMaxRange={enemyStats?.maxRange}
                      bonusDamage={alignedAllyBonuses}
                      compareBonusDamage={alignedEnemyBonuses}
                      maxBonusDamageLines={maxBonusDamageLines}
                      chargeBonus={allyStats?.chargeBonus}
                      compareChargeBonus={enemyStats?.chargeBonus}
                      compareCost={enemyStats?.cost}
                      comparePopulation={enemyStats?.population}
                      compareProductionTime={enemyStats?.productionTime}
                    />
                  </div>
                </div>
              )}
            </motion.div>
            {/* Enemy Unit */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="flex justify-center w-full"
            >
              {unit2 && (
                <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4 w-full">
                  <div className="flex-1 min-w-0 order-2 sm:order-1">
                    <UnitCard
                      className="w-full"
                      variation={modifiedVariationEnemy!}
                      unit={modifiedUnit2 || unit2}
                      side="right"
                      isSelected={true}
                      compareHp={allyStats?.hp}
                      compareAttack={allyStats?.attack}
                      compareMeleeArmor={allyStats?.meleeArmor}
                      compareRangedArmor={allyStats?.rangedArmor}
                      compareSpeed={allyStats?.speed}
                      compareAttackSpeed={allyStats?.attackSpeed}
                      compareMaxRange={allyStats?.maxRange}
                      bonusDamage={alignedEnemyBonuses}
                      compareBonusDamage={alignedAllyBonuses}
                      maxBonusDamageLines={maxBonusDamageLines}
                      chargeBonus={enemyStats?.chargeBonus}
                      compareChargeBonus={allyStats?.chargeBonus}
                      compareCost={allyStats?.cost}
                      comparePopulation={allyStats?.population}
                      compareProductionTime={allyStats?.productionTime}
                    />
                  </div>
                  <div className="flex flex-row flex-wrap sm:flex-col gap-2 sm:gap-3 sm:flex-shrink-0 order-1 sm:order-2">
                    <AgeSelector
                      availableAges={getAvailableAges(unit2.id, selectedCivEnemy)}
                      selectedAge={selectedAgeEnemy}
                      onAgeChange={setSelectedAgeEnemy}
                      orientation="right"
                    />
                    <TechnologySelector
                      technologies={techsEnemy}
                      activeTechnologies={activeTechnologiesEnemy}
                      orientation="right"
                      onToggle={toggleTechnologyEnemy}
                    />
                    <AbilitySelector
                      abilities={abilitiesEnemy}
                      activeAbilities={activeAbilitiesEnemy}
                      onToggle={toggleAbilityEnemy}
                      orientation="right"
                    />
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
        {isVersus && (
          <div className="grid grid-cols-2 gap-6 mt-8">
            {(() => {
              if (!unit1 || !unit2) return null;
              
              let versusData;
              let multipliers = undefined;
              
              // Convert Sets to arrays to pass to combat functions
              const abilitiesArrayAlly = Array.from(activeAbilitiesAlly);
              const abilitiesArrayEnemy = Array.from(activeAbilitiesEnemy);
              
              // Compute charge bonuses
              const chargeAlly = getChargeBonus(allyData, activeAbilitiesAlly, selectedAgeAlly);
              const chargeEnemy = getChargeBonus(enemyData, activeAbilitiesEnemy, selectedAgeEnemy);
              
                if (atEqualCost) {
                  const result = computeVersusAtEqualCost(
                    modifiedVariationAlly || modifiedUnit1!,
                    modifiedVariationEnemy || modifiedUnit2!,
                    abilitiesArrayAlly,
                    abilitiesArrayEnemy,
                    chargeAlly,
                    chargeEnemy,
                    allowKiting,
                    startDistance,
                  );
                  versusData = result;
                  multipliers = result.multipliers;
                } else {
                  versusData = computeVersus(
                    modifiedVariationAlly || modifiedUnit1!,
                    modifiedVariationEnemy || modifiedUnit2!,
                    abilitiesArrayAlly,
                    abilitiesArrayEnemy,
                    chargeAlly,
                    chargeEnemy,
                    allowKiting,
                    startDistance,
                  );
                }              // Win/loss logic based on weapon ownership
              // A unit without a weapon always loses against a unit with a weapon
              // A draw only occurs when neither unit has a weapon
              const allyHasWeapon = !!getPrimaryWeapon(modifiedVariationAlly || modifiedUnit1);
              const enemyHasWeapon = !!getPrimaryWeapon(modifiedVariationEnemy || modifiedUnit2);
              
              let isDraw = versusData.winner === 'draw';
              let leftIsWinner = false;
              let rightIsWinner = false;
              
              if (allyHasWeapon && !enemyHasWeapon) {
                // Ally has a weapon, Enemy does not -> Ally wins
                leftIsWinner = true;
                isDraw = false;
              } else if (!allyHasWeapon && enemyHasWeapon) {
                // Ally has no weapon, Enemy does -> Enemy wins
                rightIsWinner = true;
                isDraw = false;
              } else if (allyHasWeapon && enemyHasWeapon) {
                // Both have a weapon -> use normal versus logic
                isDraw = versusData.winner === 'draw';
                leftIsWinner = !isDraw && versusData.winner === 'attacker';
                rightIsWinner = !isDraw && versusData.winner === 'defender';
              } else {
                // Neither has a weapon -> Draw
                isDraw = true;
                leftIsWinner = false;
                rightIsWinner = false;
              }
              const leftMetrics = {
                dps: versusData.attacker.dps,
                dpsPerCost: versusData.attacker.dpsPerCost,
                hitsToKill: versusData.attacker.hitsToKill,
                timeToKill: versusData.attacker.timeToKill,
                effectiveDamagePerHit: versusData.attacker.effectiveDamagePerHit,
                bugAttackSpeed: versusData.attacker.bugAttackSpeed,
                formula: versusData.attacker.formula,
                opponentFormula: versusData.defender.formula,
                isWinner: leftIsWinner,
                isLoser: !leftIsWinner && !isDraw,
                isDraw,
                opponentClasses: (modifiedVariationEnemy || modifiedUnit2)?.classes ?? unit2?.classes ?? [],
                opponentDps: versusData.defender.dps,
                opponentDpsPerCost: versusData.defender.dpsPerCost,
                opponentHitsToKill: versusData.defender.hitsToKill,
                opponentTimeToKill: versusData.defender.timeToKill,
                multiplier: multipliers?.multA,
                totalCost: multipliers?.totalCostA,
                opponentMultiplier: multipliers?.multB,
                opponentTotalCost: multipliers?.totalCostB,
                winnerHpRemaining: leftIsWinner ? versusData.winnerHpRemaining : undefined,
                winnerUnitsRemaining: leftIsWinner ? versusData.winnerUnitsRemaining : undefined,
                resourceDifference: leftIsWinner ? versusData.resourceDifference : undefined
              };
              const rightMetrics = {
                dps: versusData.defender.dps,
                dpsPerCost: versusData.defender.dpsPerCost,
                hitsToKill: versusData.defender.hitsToKill,
                timeToKill: versusData.defender.timeToKill,
                effectiveDamagePerHit: versusData.defender.effectiveDamagePerHit,
                bugAttackSpeed: versusData.defender.bugAttackSpeed,
                formula: versusData.defender.formula,
                opponentFormula: versusData.attacker.formula,
                isWinner: rightIsWinner,
                isLoser: !rightIsWinner && !isDraw,
                isDraw,
                opponentClasses: (modifiedVariationAlly || modifiedUnit1)?.classes ?? unit1?.classes ?? [],
                opponentDps: versusData.attacker.dps,
                opponentDpsPerCost: versusData.attacker.dpsPerCost,
                opponentHitsToKill: versusData.attacker.hitsToKill,
                opponentTimeToKill: versusData.attacker.timeToKill,
                multiplier: multipliers?.multB,
                totalCost: multipliers?.totalCostB,
                opponentMultiplier: multipliers?.multA,
                opponentTotalCost: multipliers?.totalCostA,
                winnerHpRemaining: rightIsWinner ? versusData.winnerHpRemaining : undefined,
                winnerUnitsRemaining: rightIsWinner ? versusData.winnerUnitsRemaining : undefined,
                resourceDifference: rightIsWinner ? versusData.resourceDifference : undefined
              };
              return (
                <>
                  <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex justify-center w-full"
                  >
                    <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4 w-full">
                      <div className="flex flex-row flex-wrap sm:flex-col gap-2 sm:gap-3 sm:flex-shrink-0">
                        <AgeSelector
                          availableAges={getAvailableAges(unit1.id, selectedCivAlly)}
                          selectedAge={selectedAgeAlly}
                          onAgeChange={setSelectedAgeAlly}
                          orientation="left"
                        />
                        <TechnologySelector
                          technologies={techsAlly}
                          activeTechnologies={activeTechnologiesAlly}
                          onToggle={toggleTechnologyAlly}
                          orientation="left"
                        />
                        <AbilitySelector
                          abilities={abilitiesAlly}
                          activeAbilities={activeAbilitiesAlly}
                          onToggle={toggleAbilityAlly}
                          orientation="left"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <UnitCard
                          className="w-full"
                          variation={modifiedVariationAlly!}
                          unit={modifiedUnit1 || unit1}
                          side="left"
                          mode="versus"
                          versusMetrics={leftMetrics}
                        />
                      </div>
                    </div>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex justify-center w-full"
                  >
                    <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4 w-full">
                      <div className="flex-1 min-w-0 order-2 sm:order-1">
                        <UnitCard
                          className="w-full"
                          variation={modifiedVariationEnemy!}
                          unit={modifiedUnit2 || unit2}
                          side="right"
                          mode="versus"
                          versusMetrics={rightMetrics}
                        />
                      </div>
                      <div className="flex flex-row flex-wrap sm:flex-col gap-2 sm:gap-3 sm:flex-shrink-0 order-1 sm:order-2">
                        <AgeSelector
                          availableAges={getAvailableAges(unit2.id, selectedCivEnemy)}
                          selectedAge={selectedAgeEnemy}
                          onAgeChange={setSelectedAgeEnemy}
                          orientation="right"
                        />
                        <TechnologySelector
                          technologies={techsEnemy}
                          activeTechnologies={activeTechnologiesEnemy}
                          onToggle={toggleTechnologyEnemy}
                          orientation="right"
                        />
                        <AbilitySelector
                          abilities={abilitiesEnemy}
                          activeAbilities={activeAbilitiesEnemy}
                          onToggle={toggleAbilityEnemy}
                          orientation="right"
                        />
                      </div>
                    </div>
                  </motion.div>
                </>
              );
            })()}
          </div>
        )}

      </motion.div>
    </div>
  );
};

export default Sandbox;
