// Builds a ReportContext from a useUnitSlot() result: the card's base vs shown
// stats, the upgrades the app resolves for the unit, and a link that reopens it.

import type { useUnitSlot } from '@/hooks/useUnitSlot';
import type { Technology } from '@/data/unified-technologies';
import type { Ability } from '@/data/unified-abilities';
import { getCivilizationName } from '@/data/civilizations';
import { buildShareUrl } from '@/lib/shareUrl';
import { modifierKey } from './toPatch';
import type { EffectSummary, ReportContext, StatValue, UpgradeSummary } from './types';

type Slot = ReturnType<typeof useUnitSlot>;

const round = (v: number) => Math.round(v * 1000) / 1000;

function techSummary(t: Technology, civ: string, active: boolean): UpgradeSummary {
  const top = t.effects ?? [];
  const variation = t.variations.find(v => v.civs.includes(civ)) ?? t.variations[0];
  const effects = (top.length ? top : variation?.effects ?? []) as EffectSummary[];
  return { kind: 'tech', id: t.id, name: t.name, icon: t.icon, description: (t as any).description ?? variation?.description, effects, level: top.length ? 'top' : 'variation', active }; // eslint-disable-line @typescript-eslint/no-explicit-any
}

// getAbilityVariation concatenates both levels, so the summary does too.
function abilitySummary(a: Ability, civ: string, active: boolean, counter?: number): UpgradeSummary {
  const top = a.effects ?? [];
  const variation = a.variations.find(v => v.civs.includes(civ)) ?? a.variations[0];
  const effects = [...top, ...(variation?.effects ?? [])] as EffectSummary[];
  return { kind: 'ability', id: a.id, name: a.name, icon: a.icon, description: (a as any).description ?? variation?.description, effects, level: top.length ? 'top' : 'variation', active, counter }; // eslint-disable-line @typescript-eslint/no-explicit-any
}

function buildStats(slot: Slot): StatValue[] {
  const v: any = slot.variation; // eslint-disable-line @typescript-eslint/no-explicit-any
  const s = slot.modifiedStats;
  if (!v || !s) return [];
  const weapon = v.weapons?.[0];
  const armor = (type: string) => v.armor?.find((a: { type: string }) => a.type === type)?.value ?? 0;
  const costShown = (k: 'food' | 'wood' | 'gold' | 'stone') => {
    const perRes = k === 'food' ? s.foodCostMultiplier : k === 'gold' ? s.goldCostMultiplier : k === 'stone' ? s.stoneCostMultiplier : 1;
    return Math.round((v.costs?.[k] ?? 0) * (s.costMultiplier ?? 1) * (perRes ?? 1));
  };

  const stats: StatValue[] = [{ key: 'hitpoints', label: 'HP', base: v.hitpoints, shown: s.hitpoints }];
  if (weapon) {
    const shownDamage = weapon.type === 'melee' ? s.meleeAttack : weapon.type === 'siege' ? (s.siegeAttack ?? s.rangedAttack) : s.rangedAttack;
    stats.push(
      { key: 'damage', label: `Attack (${weapon.type})`, base: weapon.damage, shown: shownDamage },
      { key: 'attackSpeed', label: 'Attack speed (s)', base: weapon.speed, shown: s.attackSpeed ?? weapon.speed },
      { key: 'maxRange', label: 'Range (tiles)', base: weapon.range?.max ?? 0, shown: s.maxRange ?? weapon.range?.max ?? 0 },
    );
    for (const m of weapon.modifiers ?? []) {
      const key = modifierKey(m);
      if (!key) continue;
      const shown = (s.bonusDamage ?? []).filter((b: any) => modifierKey(b) === key).reduce((sum: number, b: any) => sum + (b.value ?? 0), 0); // eslint-disable-line @typescript-eslint/no-explicit-any
      stats.push({ key: `bonus:${key}`, label: `Bonus vs ${key.replace(/[_|]/g, ' ')}`, base: m.value, shown: shown || m.value });
    }
  }
  stats.push(
    { key: 'meleeArmor', label: 'Melee armor', base: armor('melee'), shown: s.meleeArmor },
    { key: 'rangedArmor', label: 'Ranged armor', base: armor('ranged'), shown: s.rangedArmor },
    { key: 'moveSpeed', label: 'Move speed', base: v.movement?.speed ?? 0, shown: s.moveSpeed },
  );
  for (const k of ['food', 'wood', 'gold', 'stone'] as const) {
    if ((v.costs?.[k] ?? 0) > 0) stats.push({ key: k, label: `Cost — ${k}`, base: v.costs[k], shown: costShown(k) });
  }
  return stats.map(st => ({ ...st, base: round(st.base ?? 0), shown: round(st.shown ?? 0) }));
}

export function buildReportContext(slot: Slot, origin: string): ReportContext | undefined {
  const unit = slot.unit;
  if (!unit) return undefined;
  const civ = slot.selectedCiv;
  const counters: Record<string, number> = {};
  slot.abilityCounters.forEach((n, id) => { if (n > 0) counters[id] = n; });

  const link = buildShareUrl({
    versus: false,
    slot1: { civ, unitId: unit.id, age: slot.selectedAge, techs: [...slot.activeTechnologies], abilities: [...slot.activeAbilities], counters, count: 1 },
    slot2: null,
    kiting: false,
    distancePreset: 'max',
    customDistance: 0,
    model: 'focusFire',
    preset: null,
  }, origin);

  return {
    civ,
    civName: getCivilizationName(civ),
    unitId: unit.id,
    unitName: (slot.variation as any)?.name ?? unit.name, // eslint-disable-line @typescript-eslint/no-explicit-any
    unitIcon: unit.icon,
    age: slot.selectedAge,
    stats: buildStats(slot),
    upgrades: [
      ...slot.techs.map(t => techSummary(t, civ, slot.activeTechnologies.has(t.id))),
      ...slot.abilities.map(a => abilitySummary(a, civ, slot.activeAbilities.has(a.id), slot.abilityCounters.get(a.id))),
    ],
    link,
  };
}
