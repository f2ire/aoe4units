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
}

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
  className
}: UnitCardProps) => {
  const [showFormula, setShowFormula] = useState(false);
  const displayData = variation || unit;
  if (!displayData) return null;

  const primaryWeapon = getPrimaryWeapon(displayData);
  const meleeArmor = getArmorValue(displayData, 'melee');
  const rangedArmor = getArmorValue(displayData, 'ranged');
  const rangedResistance = getResistanceValue(displayData, 'ranged');
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

  // Calculate applicable bonus against the opponent (versus mode only)
  let applicableBonus = 0;
  if (mode === 'versus' && versusMetrics?.opponentClasses && primaryWeapon?.modifiers?.length) {
    const opp = versusMetrics.opponentClasses.map(c => c.toLowerCase());
    const expandedOpp = new Set<string>(opp);

    for (const mod of primaryWeapon.modifiers as any[]) { // eslint-disable-line @typescript-eslint/no-explicit-any
      const spec = mod.target?.class;
      if (!spec) continue;

      const groups: string[][] = Array.isArray(spec) && spec.some(v => Array.isArray(v)) ? (spec as unknown as string[][]) : [spec as unknown as string[]];
      const applies = groups.some(group =>
        Array.isArray(group) && group.every(req => expandedOpp.has(req.toLowerCase()))
      );

      if (applies) {
        applicableBonus += (mod.value ?? mod.amount ?? 0) as number;
      }
    }
  }

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
                {Math.round(meleeArmor)}
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

        {mode === 'versus' && versusMetrics && (
          <div className="space-y-3">
            {/* Button to show/hide the formula */}
            {versusMetrics.multiplier && versusMetrics.multiplier > 1 && (
              <button
                onClick={() => setShowFormula(!showFormula)}
                className="w-full text-xs px-2 py-1 rounded bg-primary/10 hover:bg-primary/20 transition-colors text-primary font-medium"
              >
                {showFormula ? '📊 Hide Calculation' : '🔍 Show Calculation'}
              </button>
            )}
            
            {/* Detailed formula display */}
            {showFormula && versusMetrics.multiplier && (
              <div className="text-[10px] leading-relaxed bg-muted/60 p-2 rounded space-y-1 border border-border">
                <div className="font-semibold text-primary mb-1">📐 Math Breakdown:</div>
                <div><span className="text-muted-foreground">Attackers:</span> {versusMetrics.multiplier} × {displayData.name}</div>
                <div><span className="text-muted-foreground">Defenders:</span> {versusMetrics.opponentMultiplier} units</div>
                <div className="border-t border-border pt-1 mt-1">
                  <div><span className="text-muted-foreground">Total Defender HP:</span> {displayData.hitpoints} × {versusMetrics.opponentMultiplier} = {displayData.hitpoints * (versusMetrics.opponentMultiplier || 1)}</div>
                  <div><span className="text-muted-foreground">Dmg/Cycle:</span> {versusMetrics.effectiveDamagePerHit} × {versusMetrics.multiplier} = {(versusMetrics.effectiveDamagePerHit || 0) * (versusMetrics.multiplier || 1)}</div>
                  <div><span className="text-muted-foreground">Hits to Kill All:</span> ⌈{displayData.hitpoints * (versusMetrics.opponentMultiplier || 1)} / {(versusMetrics.effectiveDamagePerHit || 0) * (versusMetrics.multiplier || 1)}⌉ = {versusMetrics.hitsToKill}</div>
                  <div><span className="text-muted-foreground">Time to Kill All:</span> {versusMetrics.hitsToKill} × {primaryWeapon?.speed.toFixed(3)}s = {versusMetrics.timeToKill}s</div>
                </div>
                <div className="border-t border-border pt-1 mt-1 text-[9px] text-muted-foreground italic">
                  {versusMetrics.formula}
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
        )}
      </div>
      {mode === 'versus' && (
        <CardFooter className="pt-2">
          <div className="w-full rounded-md bg-muted/40 p-2 text-[11px] leading-tight">
            <div className="grid grid-cols-2 gap-2">
              <div>
                {primaryWeapon ? (
                  <>
                    <div className="flex justify-between"><span className="text-muted-foreground">Atk</span><span>{Math.round(primaryWeapon.damage || 0)}{primaryWeapon.burst?.count && primaryWeapon.burst.count > 1 ? `×${primaryWeapon.burst.count}` : ''}{applicableBonus > 0 && ` + ${Math.round(applicableBonus)}`}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">AS</span><span>{primaryWeapon.speed ? primaryWeapon.speed.toFixed(3) + 's' : '—'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Range</span><span>{primaryWeapon.range.max}</span></div>
                  </>
                ) : (
                  <div className="text-muted-foreground italic">No weapon</div>
                )}
              </div>
              <div>
                <div className="flex justify-between"><span className="text-muted-foreground">HP</span><span>{Math.round(displayData.hitpoints)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Melee Armor</span><span>{Math.round(meleeArmor)}</span></div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ranged Armor</span>
                  <span
                    title={rangedResistance > 0 ? `${rangedResistance}% damage resistance vs ranged attacks (applied after armor)` : undefined}
                    className={rangedResistance > 0 ? 'underline decoration-dotted cursor-help' : undefined}>
                    {Math.round(rangedArmor)}
                  </span>
                </div>
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
