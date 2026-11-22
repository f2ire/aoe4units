// Human wording for effects and values — shared by the report UI and the Discord summary.

import type { EffectSummary } from './types';

const PROPERTY_LABELS: Record<string, string> = {
  meleeAttack: 'Melee damage',
  rangedAttack: 'Ranged damage',
  siegeAttack: 'Siege damage',
  gunpowderAttack: 'Gunpowder damage',
  fireAttack: 'Torch damage',
  hitpoints: 'Health',
  meleeArmor: 'Melee armor',
  rangedArmor: 'Ranged armor',
  attackSpeed: 'Attack speed',
  moveSpeed: 'Move speed',
  maxRange: 'Range',
  burst: 'Projectiles',
  bonusDamageMultiplier: 'Bonus damage',
  healingRate: 'Heal per hit',
  healingRatePerSecond: 'Regeneration (HP/s)',
  chargeMultiplier: 'Charge damage',
  chargeChange: 'Charge damage',
  costReduction: 'Cost',
  foodCostReduction: 'Food cost',
  goldCostReduction: 'Gold cost',
  stoneCostReduction: 'Stone cost',
  rangedResistance: 'Ranged resistance %',
  meleeResistance: 'Melee resistance %',
  armorPenetration: 'Armor penetration',
};

export const propertyLabel = (p: string) => PROPERTY_LABELS[p] ?? p;

const fmt = (v: number) => String(+v.toFixed(3));
const classText = (groups?: string[][]) => (groups ?? []).map(g => g.join(' ')).join(', ');

/** "×1.15 (+15%)", "×0.833 (+20% faster)", "+3". */
export function effectValueText(e: Pick<EffectSummary, 'property' | 'effect' | 'value'>, value = e.value): string {
  if (e.effect !== 'multiply') return `${value >= 0 ? '+' : ''}${fmt(value)}`;
  if (e.property === 'attackSpeed') {
    const pct = Math.round((1 / value - 1) * 100);
    return `×${fmt(value)} (${pct >= 0 ? '+' : ''}${pct}% ${pct >= 0 ? 'faster' : 'slower'})`;
  }
  const pct = Math.round((value - 1) * 100);
  return `×${fmt(value)} (${pct >= 0 ? '+' : ''}${pct}%)`;
}

/** Who the effect lands on, in game words. */
export function effectTargetText(e: EffectSummary): string {
  const parts: string[] = [];
  if (e.select?.class?.length) parts.push(classText(e.select.class));
  if (e.select?.id?.length) parts.push(e.select.id.join(', '));
  return parts.join(' + ') || 'all units';
}

/** One-line human description: "Melee damage ×1.15 (+15%) · melee infantry · 10 s". */
export function effectText(e: EffectSummary, value = e.value): string {
  const vs = e.target?.class?.length ? ` vs ${classText(e.target.class)}` : '';
  const dur = e.duration ? ` · ${e.duration} s` : '';
  return `${propertyLabel(e.property)} ${effectValueText(e, value)}${vs} · ${effectTargetText(e)}${dur}`;
}

export const formatNumber = fmt;
