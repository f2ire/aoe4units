import React from 'react';
import { AoE4Unit, getPrimaryWeapon, getArmorValue, getResistanceValue, getTotalCost } from '@/data/unified-units';
import type { UnifiedVariation } from '@/data/unified-units';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { cn, formatClassNames } from '@/lib/utils';
import { useState } from 'react';

interface VersusMetricsProps {
  dps: number | null;
  dpsPerCost: number | null;
  hitsToKill: number | null;
  timeToKill: number | null;
  effectiveDamagePerHit: number | null;
  bugAttackSpeed: boolean;
  formula: string;
  opponentFormula?: string;
  isWinner?: boolean;
  isLoser?: boolean;
  isDraw?: boolean;
  opponentClasses?: string[];
  opponentDps?: number | null;
  opponentDpsPerCost?: number | null;
  opponentHitsToKill?: number | null;
  opponentTimeToKill?: number | null;
  // At Equal Cost mode
  multiplier?: number;
  totalCost?: number;
  opponentMultiplier?: number;
  opponentTotalCost?: number;
  winnerHpRemaining?: number;
  winnerUnitsRemaining?: number;
  resourceDifference?: number;
}

interface UnitCardProps {
  unit?: AoE4Unit;
  variation?: UnifiedVariation;
  side?: "left" | "right";
  onClick?: () => void;
  className?: string;
  isSelected?: boolean;
  mode?: "comparative" | "versus";
  versusMetrics?: VersusMetricsProps;
  // Comparison stats (opponent unit)
  compareHp?: number;
  compareAttack?: number;
  compareMeleeArmor?: number;
  compareRangedArmor?: number;
  compareSpeed?: number;
  compareAttackSpeed?: number;
  compareMaxRange?: number;
  bonusDamage?: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  compareBonusDamage?: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  maxBonusDamageLines?: number; // Maximum number of bonus lines for alignment
  chargeBonus?: number;
  compareChargeBonus?: number;
  compareCost?: number;
  comparePopulation?: number;
  compareProductionTime?: number;
  secondaryWeapons?: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  showSecondaryWeaponRow?: boolean; // true if at least one side has secondary weapons (for alignment)
}

// ── Formula parser ────────────────────────────────────────────────────────────
// Extracts structured data from the formula string produced by combat.ts
interface ParsedFormula {
  base: number | null;
  bonus: number | null;
  armor: number | null;
  effective: number | null;
  resistancePct: number | null;
  chargeWeapon: { name: string; damage: number; speed: number } | null;
  kiting: {
    type: 'never-catches';
    meleeSpeed: number | null;
    rangedSpeed: number | null;
  } | {
    type: 'kiting';
    approachTime: number;
    freeHits: number;
    chargeSpeedBoost: number | null;
    kitingTime: number;
    kitingHits: number;
    contactTime: number;
  } | null;
  movement: { approachTime: number } | null;
  dieBeforeContact: boolean;
  meleeContactTime: number | null;
}

function extractBracketSection(formula: string, marker: string): string | null {
  const idx = formula.indexOf(marker);
  if (idx === -1) return null;
  let depth = 0;
  for (let i = idx; i < formula.length; i++) {
    if (formula[i] === '[') depth++;
    else if (formula[i] === ']') { depth--; if (depth === 0) return formula.slice(idx + 1, i); }
  }
  return null;
}

function parseFormula(formula: string): ParsedFormula {
  const result: ParsedFormula = {
    base: null, bonus: null, armor: null, effective: null, resistancePct: null,
    chargeWeapon: null, kiting: null, movement: null,
    dieBeforeContact: false, meleeContactTime: null,
  };

  // Charge weapon section: [1st hit: Name (X dmg, t=Ys)]
  const chargeSection = extractBracketSection(formula, '[1st hit:');
  if (chargeSection) {
    const m = chargeSection.match(/1st hit: (.+?) \((\d+(?:\.\d+)?) dmg, t=([\d.]+)s\)/);
    if (m) result.chargeWeapon = { name: m[1], damage: parseFloat(m[2]), speed: parseFloat(m[3]) };
  }

  // Kiting section: [Kiting: ...] — may contain nested [...]
  const kitingSection = extractBracketSection(formula, '[Kiting:');
  if (kitingSection) {
    if (kitingSection.includes('cannot catch') || kitingSection.includes('permanently out of reach')) {
      const sm = kitingSection.match(/melee \(([\d.]+) t\/s\) cannot catch ranged kiting at ([\d.]+) t\/s/);
      result.kiting = {
        type: 'never-catches',
        meleeSpeed: sm ? parseFloat(sm[1]) : null,
        rangedSpeed: sm ? parseFloat(sm[2]) : null,
      };
    } else {
      const am = kitingSection.match(/approach ([\d.]+)s \(\+([\d]+) free hits\)/);
      const csm = kitingSection.match(/charge ×([\d.]+) speed/);
      const km = kitingSection.match(/kiting ([\d.]+)s \(\+([\d]+) hits\)/);
      const cm = kitingSection.match(/contact t=([\d.]+)s/);
      result.kiting = {
        type: 'kiting',
        approachTime: am ? parseFloat(am[1]) : 0,
        freeHits: am ? parseInt(am[2]) : 0,
        chargeSpeedBoost: csm ? parseFloat(csm[1]) : null,
        kitingTime: km ? parseFloat(km[1]) : 0,
        kitingHits: km ? parseInt(km[2]) : 0,
        contactTime: cm ? parseFloat(cm[1]) : 0,
      };
    }
  }

  // Movement section: [Movement: +Xs approach] (ranged vs ranged)
  const movSection = extractBracketSection(formula, '[Movement:');
  if (movSection) {
    const m = movSection.match(/\+([\d.]+)s approach/);
    result.movement = { approachTime: m ? parseFloat(m[1]) : 0 };
  }

  // Melee outcome sections
  result.dieBeforeContact = formula.includes('[Dies before contact]');
  const contactSection = extractBracketSection(formula, '[contact at t=');
  if (contactSection) {
    const m = contactSection.match(/t=([\d.]+)s/);
    result.meleeContactTime = m ? parseFloat(m[1]) : null;
  }

  // Main damage params
  result.base = (formula.match(/Base\(([\d.]+)\)/) ?? [])[1] !== undefined ? parseFloat((formula.match(/Base\(([\d.]+)\)/) ?? [])[1]) : null;
  result.bonus = (formula.match(/Bonus\(([\d.]+)\)/) ?? [])[1] !== undefined ? parseFloat((formula.match(/Bonus\(([\d.]+)\)/) ?? [])[1]) : null;
  result.armor = (formula.match(/Armor\(([\d.]+)\)/) ?? [])[1] !== undefined ? parseFloat((formula.match(/Armor\(([\d.]+)\)/) ?? [])[1]) : null;
  result.resistancePct = (formula.match(/1 - ([\d.]+)% resistance/) ?? [])[1] !== undefined ? parseFloat((formula.match(/1 - ([\d.]+)% resistance/) ?? [])[1]) : null;
  // Effective damage: the value after the last ") = " before ";"
  const effM = formula.match(/\) = ([\d.]+)(?:;|\s|$)/);
  result.effective = effM ? parseFloat(effM[1]) : null;

  return result;
}

const round2 = (n: number | null | undefined): string =>
  n == null ? '—' : (Math.round(n * 100) / 100).toString();

export const UnitCard = ({
  unit,
  variation,
  mode = 'comparative',
  versusMetrics,
  compareHp,
  compareAttack,
  compareMeleeArmor,
  compareRangedArmor,
  compareSpeed,
  compareAttackSpeed,
  compareMaxRange,
  bonusDamage,
  compareBonusDamage,
  maxBonusDamageLines,
  chargeBonus,
  compareChargeBonus,
  compareCost,
  comparePopulation,
  compareProductionTime,
  secondaryWeapons,
  showSecondaryWeaponRow,
  className
}: UnitCardProps) => {
  const [showFormula, setShowFormula] = useState(false);
  const displayData = variation || unit;
  if (!displayData) return null;

  const primaryWeapon = getPrimaryWeapon(displayData);
  const meleeArmor = getArmorValue(displayData, 'melee');
  const rangedArmor = getArmorValue(displayData, 'ranged');
  const rangedResistance = getResistanceValue(displayData, 'ranged');
  const meleeVulnerability = getResistanceValue(displayData, 'melee_vulnerability');
  const totalCost = variation ? getTotalCost(variation) : (unit ? getTotalCost(unit) : 0);
  const costs = variation ? variation.costs : unit!.costs;
  const productionTime = (costs as unknown as { time?: number })?.time;
  const movement = 'movement' in displayData ? displayData.movement : undefined;
  const civs = displayData.civs;
  const population = 'costs' in displayData && (displayData as unknown as { costs?: { popcap?: number } }).costs?.popcap;


  const getComparisonColor = (myValue: number, compareValue?: number, higherIsBetter: boolean = true, minDiff: number = 0.05, isAbsoluteThreshold: boolean = false) => {
    if (compareValue === undefined) return { color: '', symbol: '' };
    const diff = myValue - compareValue;
    const threshold = isAbsoluteThreshold ? minDiff : compareValue * minDiff;
    if (Math.abs(diff) <= threshold) return { color: '', symbol: '' };
    const isBetter = higherIsBetter ? diff > 0 : diff < 0;
    return { color: isBetter ? 'text-green-500' : 'text-orange-400', symbol: isBetter ? '△' : '▽' };
  };

  const crown = versusMetrics?.isWinner ? (
    <span className="ml-2 inline-flex items-center text-xs font-semibold text-yellow-500" title="Winner" aria-label="Winner">👑</span>
  ) : null;

  // Build opponent class set for versus mode bonus matching
  const expandedOpp = new Set<string>();
  if (mode === 'versus' && versusMetrics?.opponentClasses) {
    const opp = versusMetrics.opponentClasses.map(c => c.toLowerCase());
    for (const cls of opp) {
      expandedOpp.add(cls);
      if (cls.includes('_')) {
        const parts = cls.split('_');
        const negatedTokens = new Set<string>();
        for (let i = 0; i < parts.length - 1; i++) {
          if (parts[i] === 'non') negatedTokens.add(parts[i + 1]);
        }
        for (const part of parts) {
          if (part && part !== 'non' && !negatedTokens.has(part)) {
            expandedOpp.add(part);
          }
        }
      }
    }
  }

  // Compute the applicable bonus from a modifier list against expandedOpp
  const computeApplicableBonus = (modifiers: any[]): number => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (expandedOpp.size === 0) return 0;
    let bonus = 0;
    for (const mod of modifiers) {
      const spec = mod.target?.class;
      if (!spec) continue;
      const groups: string[][] = Array.isArray(spec) && spec.some(v => Array.isArray(v)) ? (spec as unknown as string[][]) : [spec as unknown as string[]];
      if (groups.some(group => Array.isArray(group) && group.every(req => expandedOpp.has(req.toLowerCase())))) {
        bonus += (mod.value ?? mod.amount ?? 0) as number;
      }
    }
    return bonus;
  };

  // Calculate applicable bonus against the opponent for the primary weapon
  const applicableBonus = primaryWeapon?.modifiers?.length ? computeApplicableBonus(primaryWeapon.modifiers as any[]) : 0; // eslint-disable-line @typescript-eslint/no-explicit-any

  return (
    <Card
      className={cn(
        'relative flex flex-col p-4 border-2 bg-card cursor-pointer transition-all duration-300 overflow-hidden',
        versusMetrics?.isWinner ? 'border-yellow-400' : 'border-border',
        className
      )}
    >
      {mode === 'versus' && versusMetrics && (
        <>
          <div
            className={cn(
              'pointer-events-none absolute inset-0 z-10 rounded-lg',
              versusMetrics.isWinner && 'ring-2 ring-yellow-400 bg-gradient-to-b from-yellow-500/25 to-transparent shadow-[0_0_15px_rgba(255,215,0,0.5)]',
              versusMetrics.isLoser && 'ring-2 ring-zinc-700 bg-gradient-to-b from-zinc-800/40 to-transparent',
              versusMetrics.isDraw && 'ring-2 ring-blue-400 bg-gradient-to-b from-blue-500/20 to-transparent'
            )}
          />
          <div className="absolute top-2 right-2 z-20">
            {versusMetrics.isWinner && <span className="rounded bg-yellow-400 px-2 py-1 text-xs font-semibold text-black shadow">Winner</span>}
            {versusMetrics.isLoser && <span className="rounded bg-zinc-700 px-2 py-1 text-xs font-semibold text-white shadow">Loser</span>}
            {versusMetrics.isDraw && <span className="rounded bg-blue-500 px-2 py-1 text-xs font-semibold text-white shadow">Draw</span>}
          </div>
        </>
      )}
      <div className="relative z-20 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-3 pt-5">
          <img
            src={displayData.icon}
            alt={displayData.name}
            className="w-16 h-16 object-contain"
            onError={(e) => {
              e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="%23333"/><text x="50%" y="50%" fill="%23fff" text-anchor="middle" dy=".3em" font-size="24">?</text></svg>';
            }}
          />
          <div className="flex-1">
            <h3
              className="text-lg font-serif font-semibold break-words"
              title={displayData.name}
              aria-label={displayData.name}
            >
              {displayData.name.length > 20
                ? `${displayData.name.substring(0, 20)}...`
                : displayData.name}
            </h3>
            {mode === 'versus' && versusMetrics?.multiplier && versusMetrics.multiplier > 1 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {versusMetrics.multiplier} × {displayData.name} = {versusMetrics.totalCost} cost
              </p>
            )}
          </div>
        </div>

        {/* Comparative Mode */}
        {mode === 'comparative' && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">HP</span>
              <span className={cn('flex items-center gap-1', getComparisonColor(displayData.hitpoints, compareHp).color)}>
                {getComparisonColor(displayData.hitpoints, compareHp).symbol && <span className="text-xs">{getComparisonColor(displayData.hitpoints, compareHp).symbol}</span>}
                {Math.round(displayData.hitpoints)}
              </span>
            </div>
            {primaryWeapon && (
              <div className="flex flex-col">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Attack</span>
                  <span className={cn('flex items-center gap-1', getComparisonColor((primaryWeapon.damage || 0) * (primaryWeapon.burst?.count || 1), compareAttack).color)}>
                    {getComparisonColor((primaryWeapon.damage || 0) * (primaryWeapon.burst?.count || 1), compareAttack).symbol && <span className="text-xs">{getComparisonColor((primaryWeapon.damage || 0) * (primaryWeapon.burst?.count || 1), compareAttack).symbol}</span>}
                    {Math.round(primaryWeapon.damage || 0)}{primaryWeapon.burst?.count && primaryWeapon.burst.count > 1 ? ` × ${primaryWeapon.burst.count}` : ''} ({primaryWeapon.type})
                  </span>
                </div>
                {showSecondaryWeaponRow && (
                  secondaryWeapons && secondaryWeapons.length > 0 ? (
                    secondaryWeapons.map((w: any, i: number) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                      <div key={i}>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground text-xs italic pl-2">+ {w.name || 'weapon'}</span>
                          <span className="text-xs text-muted-foreground">
                            {(() => {
                              const mods = w.modifiers || [];
                              // Only sum bonus inline if there is a single modifier.
                              const totalBonus = mods.length === 1 ? (mods[0].value || 0) : 0;
                              const hasBurst = w.burst?.count && w.burst.count > 1;
                              const hasBonus = totalBonus > 0;
                              const base = Math.round(w.damage || 0);
                              if (hasBurst && hasBonus) return `(${base} + ${Math.round(totalBonus)}) × ${w.burst.count}`;
                              if (hasBurst) return `${base} × ${w.burst.count}`;
                              if (hasBonus) return `${base} + ${Math.round(totalBonus)}`;
                              return `${base}`;
                            })()} ({w.type})
                          </span>
                        </div>
                        {(w.modifiers || []).length > 1 && (w.modifiers || []).map((mod: any, mi: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                          const targetClasses = mod.target?.class?.flat() || [];
                          const targetName = formatClassNames(targetClasses);
                          return (
                            <div key={mi} className="flex justify-between text-xs pl-4">
                              <span className="text-muted-foreground">+{Math.round(mod.value || 0)} vs</span>
                              <span className="text-muted-foreground capitalize">{targetName}</span>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  ) : (
                    <div className="h-5" />
                  )
                )}
                {(bonusDamage && bonusDamage.length > 0) || maxBonusDamageLines ? (
                  <div className="pl-2 space-y-1">
                    {bonusDamage?.map((modifier: any, idx: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                      if (modifier.hidden) return <div key={idx} className="h-4" />;

                      // Special display for charge bonus
                      if (modifier.isChargeBonus) {
                        const compareModifier = compareBonusDamage?.[idx];
                        const comparison = compareModifier && !compareModifier.hidden && compareModifier.isChargeBonus
                          ? getComparisonColor(modifier.value, compareModifier.value)
                          : { color: '', symbol: '' };
                        return (
                          <div key={idx} className="flex justify-between text-xs">
                            <span className={cn('flex items-center gap-1', comparison.color)}>
                              {comparison.symbol && <span className="text-[10px]">{comparison.symbol}</span>}
                              +{Math.round(modifier.value)} Charge
                            </span>
                          </div>
                        );
                      }

                      const targetClasses = modifier.target?.class?.flat() || [];
                      const targetName = formatClassNames(targetClasses);
                      const compareModifier = compareBonusDamage?.[idx];
                      let comparison = { color: '', symbol: '' };
                      if (compareModifier && !compareModifier.hidden) {
                        const compareClasses = compareModifier.target?.class?.flat() || [];
                        if (compareClasses.join(' ') === targetClasses.join(' ')) {
                          comparison = getComparisonColor(modifier.value, compareModifier.value);
                        }
                      }
                      return (
                        <div key={idx} className="flex justify-between text-xs">
                          <span className={cn('flex items-center gap-1', comparison.color)}>
                            {comparison.symbol && <span className="text-[10px]">{comparison.symbol}</span>}
                            +{Math.round(modifier.value)} vs
                          </span>
                          <span>{targetName}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            )}
            {primaryWeapon && primaryWeapon.speed && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Attack Speed</span>
                <span className={cn('flex items-center gap-1', getComparisonColor(primaryWeapon.speed, compareAttackSpeed, false).color)}>
                  {getComparisonColor(primaryWeapon.speed, compareAttackSpeed, false).symbol && <span className="text-xs">{getComparisonColor(primaryWeapon.speed, compareAttackSpeed, false).symbol}</span>}
                  {primaryWeapon.speed.toFixed(3)}s
                </span>
              </div>
            )}
            {primaryWeapon && primaryWeapon.range?.max && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Range</span>
                <span className="flex items-center gap-1">
                  {primaryWeapon.range.min} - <span className={getComparisonColor(primaryWeapon.range.max, compareMaxRange, true, 0.5, true).color}>{primaryWeapon.range.max}</span>
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Melee Armor</span>
              <span className={cn('flex items-center gap-1', getComparisonColor(meleeArmor, compareMeleeArmor).color)}>
                {getComparisonColor(meleeArmor, compareMeleeArmor).symbol && <span className="text-xs">{getComparisonColor(meleeArmor, compareMeleeArmor).symbol}</span>}
                <span
                  title={meleeVulnerability > 0 ? `+${meleeVulnerability}% melee damage taken (applied after armor)` : undefined}
                  className={meleeVulnerability > 0 ? 'underline decoration-dotted cursor-help text-orange-400' : undefined}>
                  {Math.round(meleeArmor)}
                </span>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ranged Armor</span>
              <span className={cn('flex items-center gap-1', getComparisonColor(rangedArmor, compareRangedArmor).color)}>
                {getComparisonColor(rangedArmor, compareRangedArmor).symbol && <span className="text-xs">{getComparisonColor(rangedArmor, compareRangedArmor).symbol}</span>}
                <span
                  title={rangedResistance > 0 ? `${rangedResistance}% damage resistance vs ranged attacks (applied after armor)` : undefined}
                  className={rangedResistance > 0 ? 'underline decoration-dotted cursor-help' : undefined}>
                  {Math.round(rangedArmor)}
                </span>
              </span>
            </div>
            {movement && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Speed</span>
                <span className={cn('flex items-center gap-1', getComparisonColor(movement.speed, compareSpeed).color)}>
                  {getComparisonColor(movement.speed, compareSpeed).symbol && <span className="text-xs">{getComparisonColor(movement.speed, compareSpeed).symbol}</span>}
                  {movement.speed.toFixed(3)}
                </span>
              </div>
            )}
            <div className="border-t border-border my-2" />
            {population && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Population</span>
                <span className={cn('flex items-center gap-1', getComparisonColor(population, comparePopulation, false, 0.01, true).color)}>
                  {getComparisonColor(population, comparePopulation, false, 0.01, true).symbol && <span className="text-xs">{getComparisonColor(population, comparePopulation, false, 0.01, true).symbol}</span>}
                  {population}
                </span>
              </div>
            )}
            {productionTime && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Production Time</span>
                <span className={cn('flex items-center gap-1', getComparisonColor(productionTime, compareProductionTime, false).color)}>
                  {getComparisonColor(productionTime, compareProductionTime, false).symbol && <span className="text-xs">{getComparisonColor(productionTime, compareProductionTime, false).symbol}</span>}
                  {productionTime}s
                </span>
              </div>
            )}
            <div className="border-t border-border my-2" />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Cost</span>
              <span className={cn('flex items-center gap-1 font-medium', getComparisonColor(totalCost, compareCost, false).color)}>
                {getComparisonColor(totalCost, compareCost, false).symbol && <span className="text-xs">{getComparisonColor(totalCost, compareCost, false).symbol}</span>}
                {Math.round(totalCost)}
              </span>
            </div>
            <div className="space-y-1 text-xs">
              {costs.food > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Food</span><span>{Math.round(costs.food)}</span></div>}
              {costs.wood > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Wood</span><span>{Math.round(costs.wood)}</span></div>}
              {costs.gold > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Gold</span><span>{Math.round(costs.gold)}</span></div>}
              {costs.stone > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Stone</span><span>{Math.round(costs.stone)}</span></div>}
              {(costs.oliveoil ?? 0) > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">{civs.includes('mac') ? 'Silver' : 'Olive Oil'}</span><span>{Math.round(costs.oliveoil ?? 0)}</span></div>
              )}
            </div>
          </div>
        )}

        {mode === 'versus' && versusMetrics && (() => {
          const parsed = parseFormula(versusMetrics.formula);
          const parsedOpp = versusMetrics.opponentFormula ? parseFormula(versusMetrics.opponentFormula) : null;
          // Full kiting breakdown is in whichever side has `type: 'kiting'`
          const kitingData = (parsed.kiting?.type === 'kiting' ? parsed.kiting : null)
            ?? (parsedOpp?.kiting?.type === 'kiting' ? parsedOpp.kiting : null);
          // "never-catches" can appear in either side's formula
          const neverCatches = parsed.kiting?.type === 'never-catches' ? parsed.kiting
            : parsedOpp?.kiting?.type === 'never-catches' ? parsedOpp.kiting : null;
          const movementData = parsed.movement ?? parsedOpp?.movement ?? null;
          const hasMovement = !!(kitingData || neverCatches || movementData);
          // Perspective: am I the ranged (kiting) side or the melee side?
          const isRangedSide = parsed.kiting?.type === 'kiting';
          // Melee outcome comes from own formula (contact / dies) OR opponent's opposite
          const dieBeforeContact = parsed.dieBeforeContact || (isRangedSide && (parsedOpp?.dieBeforeContact ?? false));
          const meleeContactTime = parsed.meleeContactTime ?? (isRangedSide ? (parsedOpp?.meleeContactTime ?? null) : null);

          const defenderTotalHp = displayData.hitpoints * (versusMetrics.opponentMultiplier || 1);
          const attackerTotalDmg = (versusMetrics.effectiveDamagePerHit || 0) * (versusMetrics.multiplier || 1);
          const cycleStr = primaryWeapon?.speed != null ? round2(primaryWeapon.speed) + 's' : '—';
          return (
            <div className="space-y-2">

              {/* ── Perspective-based always-visible summary ── */}
              {hasMovement && (
                <div className="text-[10px] leading-snug">
                  {/* Ranged side: show free hits */}
                  {isRangedSide && kitingData && (
                    <span className="text-blue-400">
                      🏃 {kitingData.freeHits + kitingData.kitingHits} free hit{(kitingData.freeHits + kitingData.kitingHits) !== 1 ? 's' : ''} before contact
                    </span>
                  )}
                  {isRangedSide && neverCatches && (
                    <span className="text-green-400">⛔ Melee never catches you</span>
                  )}
                  {/* Melee side: show contact time */}
                  {!isRangedSide && kitingData && (
                    dieBeforeContact
                      ? <span className="text-red-400">⛔ You die before reaching contact</span>
                      : <span className="text-blue-400">⏱ Contact at t={round2(kitingData.contactTime)}s</span>
                  )}
                  {!isRangedSide && neverCatches && (
                    <span className="text-red-400">⛔ You cannot catch the ranged unit</span>
                  )}
                  {/* RvR: approach penalty on both sides */}
                  {movementData && !kitingData && !neverCatches && (
                    <span className="text-blue-400">🏃 +{round2(movementData.approachTime)}s approach penalty</span>
                  )}
                </div>
              )}

              {/* ── Show Calculation button ── */}
              <button
                onClick={() => setShowFormula(!showFormula)}
                className="w-full text-xs px-2 py-1 rounded bg-primary/10 hover:bg-primary/20 transition-colors text-primary font-medium"
              >
                {showFormula ? '📊 Hide Calculation' : '🔍 Show Calculation'}
              </button>

              {/* ── Detailed calculation panel ── */}
              {showFormula && (
                <div className="text-[10px] leading-relaxed space-y-3 border border-border rounded p-2 bg-muted/30">

                  {/* ── Damage ── */}
                  <div className="space-y-1">
                    <div className="font-semibold text-primary uppercase tracking-wide text-[9px]">
                      ⚔️ Damage{parsed.chargeWeapon ? ' (after 1st hit)' : ''}
                    </div>
                    {parsed.chargeWeapon && (
                      <div className="pl-1 border-l-2 border-amber-400/60 space-y-0.5 mb-1">
                        <div className="font-medium text-amber-400">1st hit — {parsed.chargeWeapon.name}</div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Damage</span>
                          <span>{round2(parsed.chargeWeapon.damage)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cycle</span>
                          <span>{round2(parsed.chargeWeapon.speed)}s</span>
                        </div>
                      </div>
                    )}
                    {parsed.base !== null && (
                      <div className="pl-1 border-l-2 border-primary/40 space-y-0.5">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Base dmg</span>
                          <span>{round2(parsed.base)}</span>
                        </div>
                        {parsed.bonus !== null && parsed.bonus > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Bonus vs target</span>
                            <span className="text-green-400">+{round2(parsed.bonus)}</span>
                          </div>
                        )}
                        {parsed.armor !== null && parsed.armor > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Armor</span>
                            <span className="text-red-400">−{round2(parsed.armor)}</span>
                          </div>
                        )}
                        {parsed.resistancePct !== null && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Resistance</span>
                            <span className="text-red-400">×(1−{round2(parsed.resistancePct)}%)</span>
                          </div>
                        )}
                        <div className="flex justify-between border-t border-border/50 pt-0.5 font-medium">
                          <span>Effective dmg</span>
                          <span>{parsed.effective !== null ? round2(parsed.effective) : '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Attack cycle</span>
                          <span>{cycleStr}</span>
                        </div>
                        {versusMetrics.dps !== null && (
                          <div className="flex justify-between font-medium">
                            <span>DPS</span>
                            <span>{round2(versusMetrics.dps)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── Secondary Weapons ── */}
                  {secondaryWeapons && secondaryWeapons.length > 0 && (
                    <div className="space-y-1">
                      <div className="font-semibold text-primary uppercase tracking-wide text-[9px]">
                        ⚔️ Secondary Weapon{secondaryWeapons.length > 1 ? 's' : ''}
                      </div>
                      {secondaryWeapons.map((w: any, i: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                        const applicableSecBonus = computeApplicableBonus(w.modifiers || []);
                        const burstCount = w.burst?.count && w.burst.count > 1 ? w.burst.count : 1;
                        const armorVal = w.type === 'melee'
                          ? (compareMeleeArmor || 0)
                          : w.type === 'siege'
                            ? 0
                            : (compareRangedArmor || 0);
                        const effectiveDmg = Math.max(0, (w.damage || 0) * burstCount + applicableSecBonus - armorVal);
                        const cycle = w.speed;
                        const dpsContrib = cycle > 0 ? effectiveDmg / cycle : 0;
                        return (
                          <div key={i} className="pl-1 border-l-2 border-primary/20 space-y-0.5">
                            <div className="font-medium text-primary/80">
                              + {w.name}{burstCount > 1 ? ` ×${burstCount}` : ''} ({w.type})
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Base dmg</span>
                              <span>{round2(w.damage || 0)}{burstCount > 1 ? ` × ${burstCount}` : ''}</span>
                            </div>
                            {applicableSecBonus > 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Bonus vs target</span>
                                <span className="text-green-400">+{round2(applicableSecBonus)}</span>
                              </div>
                            )}
                            {armorVal > 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Armor</span>
                                <span className="text-red-400">−{round2(armorVal)}</span>
                              </div>
                            )}
                            <div className="flex justify-between border-t border-border/50 pt-0.5">
                              <span className="text-muted-foreground">≈ Effective dmg</span>
                              <span>{round2(effectiveDmg)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Attack cycle</span>
                              <span>{round2(cycle)}s</span>
                            </div>
                            <div className="flex justify-between font-medium">
                              <span>≈ DPS</span>
                              <span>{round2(dpsContrib)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ── Movement ── */}
                  {hasMovement && (
                    <div className="space-y-1">
                      <div className="font-semibold text-blue-400 uppercase tracking-wide text-[9px]">🏃 Movement</div>

                      {movementData && !kitingData && !neverCatches && (
                        <div className="pl-1 border-l-2 border-blue-400/60 space-y-0.5">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Approach penalty</span>
                            <span>+{round2(movementData.approachTime)}s</span>
                          </div>
                        </div>
                      )}

                      {neverCatches && (
                        <div className="pl-1 border-l-2 border-red-400/60 space-y-0.5">
                          {neverCatches.meleeSpeed !== null && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Melee speed</span>
                                <span>{round2(neverCatches.meleeSpeed)} t/s</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Ranged kite speed</span>
                                <span>{round2(neverCatches.rangedSpeed)} t/s</span>
                              </div>
                            </>
                          )}
                          <div className={isRangedSide ? 'text-green-400' : 'text-red-400'}>
                            {isRangedSide ? '→ You permanently out-range melee' : '→ You never reach ranged unit'}
                          </div>
                        </div>
                      )}

                      {kitingData && (
                        <div className="pl-1 border-l-2 border-blue-400/60 space-y-0.5">
                          {kitingData.approachTime > 0 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Approach phase</span>
                              <span>{round2(kitingData.approachTime)}s (+{kitingData.freeHits} hits)</span>
                            </div>
                          )}
                          {kitingData.chargeSpeedBoost !== null && (
                            <div className="flex justify-between text-amber-400">
                              <span>Melee charge boost</span>
                              <span>×{round2(kitingData.chargeSpeedBoost)}</span>
                            </div>
                          )}
                          {kitingData.kitingTime > 0 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Kiting phase</span>
                              <span>{round2(kitingData.kitingTime)}s (+{kitingData.kitingHits} hits)</span>
                            </div>
                          )}
                          <div className="flex justify-between border-t border-border/50 pt-0.5">
                            <span className="text-muted-foreground">Pre-contact hits</span>
                            <span>{kitingData.freeHits + kitingData.kitingHits}</span>
                          </div>
                          <div className="flex justify-between font-medium">
                            <span>Contact at</span>
                            <span>t={round2(kitingData.contactTime)}s</span>
                          </div>
                          {isRangedSide ? (
                            dieBeforeContact
                              ? <div className="text-green-400">→ Melee dies before reaching you</div>
                              : meleeContactTime !== null
                                ? <div className="flex justify-between"><span className="text-muted-foreground">Melee hits you at</span><span>t={round2(meleeContactTime)}s</span></div>
                                : null
                          ) : (
                            dieBeforeContact
                              ? <div className="text-red-400">→ You die before reaching melee range</div>
                              : meleeContactTime !== null
                                ? <div className="flex justify-between"><span className="text-muted-foreground">You start attacking at</span><span>t={round2(meleeContactTime)}s</span></div>
                                : null
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Equal Cost ── */}
                  {versusMetrics.multiplier && versusMetrics.multiplier > 1 && (
                    <div className="space-y-1">
                      <div className="font-semibold text-primary uppercase tracking-wide text-[9px]">⚖️ Equal Cost</div>
                      <div className="pl-1 border-l-2 border-primary/40 space-y-0.5">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Your units</span>
                          <span>{versusMetrics.multiplier}× (cost {versusMetrics.totalCost})</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Enemy units</span>
                          <span>{versusMetrics.opponentMultiplier}×</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total enemy HP</span>
                          <span>{displayData.hitpoints}×{versusMetrics.opponentMultiplier} = {defenderTotalHp}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total dmg/cycle</span>
                          <span>{round2(versusMetrics.effectiveDamagePerHit)}×{versusMetrics.multiplier} = {round2(attackerTotalDmg)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Outcome ── */}
                  <div className="space-y-1">
                    <div className="font-semibold text-primary uppercase tracking-wide text-[9px]">🎯 Outcome</div>
                    {versusMetrics.hitsToKill !== null ? (
                      <div className="pl-1 border-l-2 border-primary/40 space-y-0.5">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Hits to kill</span>
                          <span>⌈{defenderTotalHp}/{round2(attackerTotalDmg || versusMetrics.effectiveDamagePerHit)}⌉ = {versusMetrics.hitsToKill}</span>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span>TTK{hasMovement && <span className="text-blue-400 font-normal"> (incl. mvt)</span>}</span>
                          <span>{versusMetrics.hitsToKill}×{cycleStr} = {round2(versusMetrics.timeToKill)}s</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-muted-foreground italic pl-1">Cannot deal damage</div>
                    )}
                  </div>

                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">DPS</span>
                    <span
                      className={cn('font-medium', getComparisonColor(
                        versusMetrics.dps ?? 0,
                        versusMetrics.opponentDps ?? undefined,
                        true
                      ).color)}
                      title={versusMetrics.formula}
                    >
                      {versusMetrics.dps ?? '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">DPS/Cost</span>
                    <span
                      className={cn('font-medium', getComparisonColor(
                        versusMetrics.dpsPerCost ?? 0,
                        versusMetrics.opponentDpsPerCost ?? undefined,
                        true
                      ).color)}
                      title={versusMetrics.formula}
                    >
                      {versusMetrics.dpsPerCost ?? '—'}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hits to Kill</span>
                    <span
                      className={cn('font-medium', getComparisonColor(
                        versusMetrics.hitsToKill ?? 0,
                        versusMetrics.opponentHitsToKill ?? undefined,
                        false
                      ).color)}
                      title={versusMetrics.formula}
                    >
                      {versusMetrics.hitsToKill ?? '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">TTK (s)</span>
                    <span
                      className={cn('font-medium', getComparisonColor(
                        versusMetrics.timeToKill ?? 0,
                        versusMetrics.opponentTimeToKill ?? undefined,
                        false
                      ).color)}
                      title={versusMetrics.formula}
                    >
                      {versusMetrics.timeToKill ?? '—'}
                    </span>
                  </div>
                </div>
                {/* Error message removed - base stats always display */}
              </div>

              {/* Additional information for the winner in At Equal Cost mode */}
              {versusMetrics.isWinner && versusMetrics.multiplier && versusMetrics.multiplier > 1 && versusMetrics.winnerHpRemaining !== undefined && (
                <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs space-y-1">
                  <div className="font-semibold text-yellow-700 dark:text-yellow-300">🏆 Winner Stats:</div>
                  {(() => {
                    const totalHp = versusMetrics.multiplier * displayData.hitpoints;
                    const totalUnits = versusMetrics.multiplier;
                    const totalCost = versusMetrics.totalCost || 0;
                    const hpPercentage = totalHp > 0 ? ((versusMetrics.winnerHpRemaining / totalHp) * 100).toFixed(1) : '0';
                    const unitsPercentage = totalUnits > 0 ? ((versusMetrics.winnerUnitsRemaining! / totalUnits) * 100).toFixed(1) : '0';
                    const resourcePercentage = totalCost > 0 ? (((versusMetrics.resourceDifference || 0) / totalCost) * 100).toFixed(1) : '0';

                    return (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">HP Remaining:</span>
                          <span className="font-medium">{Math.round(versusMetrics.winnerHpRemaining)} ({hpPercentage}%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Units Remaining:</span>
                          <span className="font-medium">{versusMetrics.winnerUnitsRemaining} ({unitsPercentage}%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Resource Saved:</span>
                          <span className="font-medium text-green-600">{Math.round(versusMetrics.resourceDifference || 0)} ({resourcePercentage}%)</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })()}
      </div>
      {mode === 'versus' && (
        <CardFooter className="pt-2">
          <div className="w-full rounded-md bg-muted/40 p-2 text-[11px] leading-tight">
            <div className="grid grid-cols-2 gap-2">
              <div>
                {primaryWeapon ? (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">Atk</span><span>{Math.round(primaryWeapon.damage || 0)}{primaryWeapon.burst?.count && primaryWeapon.burst.count > 1 ? `×${primaryWeapon.burst.count}` : ''}{applicableBonus > 0 && ` + ${Math.round(applicableBonus)}`}</span></div>
                    {secondaryWeapons && secondaryWeapons.length > 0 && secondaryWeapons.map((w: any, i: number) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                      <div key={i} className="flex justify-end"><span>{(() => {
                        const applicableSecondaryBonus = computeApplicableBonus(w.modifiers || []);
                        const hasBurst = w.burst?.count && w.burst.count > 1;
                        const hasBonus = applicableSecondaryBonus > 0;
                        const base = Math.round(w.damage || 0);
                        if (hasBurst && hasBonus) return `(${base} + ${Math.round(applicableSecondaryBonus)}) ×${w.burst.count}`;
                        if (hasBurst) return `${base} ×${w.burst.count}`;
                        if (hasBonus) return `${base} + ${Math.round(applicableSecondaryBonus)}`;
                        return `${base}`;
                      })()}</span></div>
                    ))}
                    <div className="flex justify-between"><span className="text-muted-foreground">AS</span><span>{primaryWeapon.speed ? primaryWeapon.speed.toFixed(3) + 's' : '—'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Range</span><span>{primaryWeapon.range.max}</span></div>
                  </>
                ) : (
                  <div className="text-muted-foreground italic">No weapon</div>
                )}
              </div>
              <div>
                <div className="flex justify-between"><span className="text-muted-foreground">HP</span><span>{Math.round(displayData.hitpoints)}</span></div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Melee Armor</span>
                  <span
                    title={meleeVulnerability > 0 ? `+${meleeVulnerability}% melee damage taken (applied after armor)` : undefined}
                    className={meleeVulnerability > 0 ? 'underline decoration-dotted cursor-help text-orange-400' : undefined}>
                    {Math.round(meleeArmor)}
                  </span>
                </div>
                {meleeVulnerability > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Melee Vuln.</span>
                    <span className="text-orange-400">+{meleeVulnerability}%</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ranged Armor</span>
                  <span
                    title={rangedResistance > 0 ? `${rangedResistance}% damage resistance vs ranged attacks (applied after armor)` : undefined}
                    className={rangedResistance > 0 ? 'underline decoration-dotted cursor-help' : undefined}>
                    {Math.round(rangedArmor)}
                  </span>
                </div>
                {movement && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Speed</span>
                    <span className={cn('flex items-center gap-1', getComparisonColor(movement.speed, compareSpeed).color)}>
                      {getComparisonColor(movement.speed, compareSpeed).symbol && <span className="text-[10px]">{getComparisonColor(movement.speed, compareSpeed).symbol}</span>}
                      {movement.speed.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-border my-2" />

            <div className="flex justify-between">
              <span className="text-muted-foreground">Population</span>
              <span>{population ?? '—'}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Cost</span>
              <span>{Math.round(totalCost)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Production Time</span>
              <span>{productionTime ? `${productionTime}s` : '—'}</span>
            </div>

            {/* Bonus integrated into the Atk line, section removed */}
          </div>
        </CardFooter>
      )}
    </Card>
  );
};
