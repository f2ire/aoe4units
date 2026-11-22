// Turns a community Report into (1) a short human summary for Discord and (2) a
// patch snippet in the shapes used by src/data/patches/*.ts, ready to review and paste.
// Pure module: no React, no data imports — the dialog passes everything in the Report.

import type {
  EffectSummary, IconReport, MissingEffectRow, MissingReport, Report, ReportBody, StatKey,
  UpgradeReport, UpgradeSummary, ValueReport,
} from './types';
import { effectText, effectValueText } from './format';

export interface BuiltReport {
  title: string;
  summary: string[];
  patch: string;
}

const lit = (v: unknown) => JSON.stringify(v);
const num = (v: number) => String(+v.toFixed(4));
const slug = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** "melee infantry, siege" → [["melee","infantry"],["siege"]] (same encoding as select.class / target.class). */
export const parseClassGroups = (text: string): string[][] =>
  text.split(',').map(g => g.trim().toLowerCase().split(/[\s_]+/).filter(Boolean)).filter(g => g.length > 0);

/** Stable key for a weapon modifier, shared with the context builder (`bonus:<key>` stat keys). */
export const modifierKey = (m: { target?: { class?: string[][] } }): string =>
  (m.target?.class ?? []).map(g => g.join('_')).join('|');

const describeEffect = (e: EffectSummary) => {
  const who = [e.select?.id?.length ? `ids ${e.select.id.join('/')}` : '', e.select?.class?.length ? `class ${lit(e.select.class)}` : ''].filter(Boolean).join(' + ') || 'everyone';
  const vs = e.target?.class ? ` vs ${lit(e.target.class)}` : '';
  const dur = e.duration ? ` (${e.duration}s)` : '';
  return `${e.property} ${e.effect} ${num(e.value)}${vs} → ${who}${dur}`;
};

// Which effect properties can move a given card stat — used to name suspects.
const STAT_PROPERTIES: Record<string, string[]> = {
  hitpoints: ['hitpoints'],
  damage: ['meleeAttack', 'rangedAttack', 'siegeAttack', 'gunpowderAttack'],
  attackSpeed: ['attackSpeed'],
  maxRange: ['maxRange'],
  meleeArmor: ['meleeArmor'],
  rangedArmor: ['rangedArmor'],
  moveSpeed: ['moveSpeed'],
  food: ['costReduction', 'foodCostReduction'],
  wood: ['costReduction'],
  gold: ['costReduction', 'goldCostReduction'],
  stone: ['costReduction', 'stoneCostReduction'],
  bonus: ['bonusDamage', 'bonusDamageMultiplier', 'meleeAttack', 'rangedAttack'],
};

const statFamily = (stat: StatKey) => (stat.startsWith('bonus:') ? 'bonus' : stat);

// ── Wrong value ───────────────────────────────────────────────────────────────

function variationChange(stat: StatKey, value: number): string {
  const v = num(value);
  if (stat === 'hitpoints') return `update: { hitpoints: ${v} }`;
  if (stat === 'moveSpeed') return `update: { movement: { speed: ${v} } }`;
  if (stat === 'food' || stat === 'wood' || stat === 'gold' || stat === 'stone') {
    return `after: (v: any) => ({ ...v, costs: { ...v.costs, ${stat}: ${v}, total: v.costs.total - (v.costs.${stat} ?? 0) + ${v} } })`;
  }
  if (stat === 'meleeArmor' || stat === 'rangedArmor') {
    const type = stat === 'meleeArmor' ? 'melee' : 'ranged';
    return `after: (v: any) => ({ ...v, armor: [...(v.armor ?? []).filter((a: any) => a.type !== '${type}'), { type: '${type}', value: ${v} }] })`;
  }
  if (stat === 'damage') return `after: (v: any) => ({ ...v, weapons: v.weapons.map((w: any, i: number) => i === 0 ? { ...w, damage: ${v} } : w) })`;
  if (stat === 'attackSpeed') return `after: (v: any) => ({ ...v, weapons: v.weapons.map((w: any, i: number) => i === 0 ? { ...w, speed: ${v} } : w) })`;
  if (stat === 'maxRange') return `after: (v: any) => ({ ...v, weapons: v.weapons.map((w: any, i: number) => i === 0 ? { ...w, range: { ...w.range, max: ${v} } } : w) })`;
  const key = stat.slice('bonus:'.length);
  return `after: (v: any) => ({ ...v, weapons: v.weapons.map((w: any, i: number) => i === 0 ? { ...w, modifiers: (w.modifiers ?? []).map((m: any) => (m.target?.class ?? []).map((g: string[]) => g.join('_')).join('|') === ${lit(key)} ? { ...m, value: ${v} } : m) } : w) })`;
}

function valuePatch(r: Report, body: ValueReport): BuiltReport {
  const ctx = r.context!;
  const touchesStat = Math.abs(body.shown - body.base) > 0.001;
  const baseFix = !body.withUpgrades || !touchesStat;
  const title = `Wrong value — ${ctx.unitName} (${ctx.civName}, age ${ctx.age}) · ${body.statLabel}`;
  const summary = [
    `**${body.statLabel}**: card shows \`${num(body.shown)}\`, unit data base \`${num(body.base)}\`, in game \`${num(body.expected)}\` (${body.withUpgrades ? 'with the same upgrades' : 'base value, no upgrades'})`,
  ];

  const props = STAT_PROPERTIES[statFamily(body.stat)] ?? [];
  const suspects = ctx.upgrades
    .filter(u => u.active)
    .map(u => ({ u, hits: u.effects.filter(e => props.includes(e.property) || (statFamily(body.stat) === 'bonus' && e.type === 'bonus')) }))
    .filter(s => s.hits.length > 0);

  const block = (comment: boolean) => {
    const c = comment ? '// ' : '';
    return [
      `${c}{`,
      `${c}  id: ${lit(ctx.unitId)},`,
      `${c}  reason: ${lit(`Community report ${r.id}: ${body.statLabel} ${num(body.base)} → ${num(baseFix ? body.expected : Math.round(body.base * body.expected / body.shown * 100) / 100)} at age ${ctx.age} (${ctx.civ}).${r.source ? ` Source: ${r.source}` : ''}`)},`,
      `${c}  variations: [{`,
      `${c}    match: { age: ${ctx.age}, civsIncludes: ${lit(ctx.civ)} },`,
      `${c}    ${variationChange(body.stat, baseFix ? body.expected : Math.round(body.base * body.expected / body.shown * 100) / 100)},`,
      `${c}  }],`,
      `${c}},`,
    ].join('\n');
  };

  if (baseFix) {
    return { title, summary: [...summary, 'Base value fix → `unitPatches` (src/data/patches/units.ts).'], patch: `// → src/data/patches/units.ts › unitPatches (merge into an existing '${ctx.unitId}' entry if there is one)\n${block(false)}` };
  }

  const suspectLines = suspects.length
    ? suspects.flatMap(s => [`//   • ${s.u.kind} ${s.u.id} (${s.u.name})`, ...s.hits.map(e => `//       ${describeEffect(e)}`)])
    : ['//   (no active upgrade touches this stat directly — check techs/abilities applied by the engine, e.g. civ passives)'];
  const patch = [
    '// ⚠ NEEDS REVIEW — the card applied upgrades to this stat, so the error may be in an upgrade OR in the base.',
    `//   base ${num(body.base)} → shown ${num(body.shown)} (app) vs ${num(body.expected)} in game with the same loadout.`,
    '//   Active upgrades touching this stat (suspects):',
    ...suspectLines,
    '//',
    '//   If the BASE is the wrong part (upgrades correct), scaled candidate:',
    block(true),
  ].join('\n');
  return { title, summary: [...summary, `Upgrades active → review. Suspects: ${suspects.map(s => s.u.id).join(', ') || 'none found'}`], patch };
}

// ── Tech / ability ────────────────────────────────────────────────────────────

const fileFor = (u: UpgradeSummary) =>
  u.kind === 'tech' ? 'src/data/patches/technologies.ts › technologyPatches' : 'src/data/patches/abilities.ts › abilityPatches';

const effectsDump = (u: UpgradeSummary) => u.effects.length
  ? u.effects.map((e, i) => `//   [${i}] ${describeEffect(e)}`).join('\n')
  : '//   (no effects in the app)';

// Rewrites matching effects at both levels. Unit scope keeps the original for every other
// unit (excludeId) and adds a copy with the new value restricted to the reported unit.
function effectChangePatch(u: UpgradeSummary, body: UpgradeReport, reason: string): string {
  const unit = body.unitId;
  const changes = body.changes.map(c => `[${lit(c.property)}, ${num(c.from)}, ${num(c.to)}]`).join(', ');
  const replace = body.scope === 'unit' && unit
    ? `[{ ...e, select: { ...e.select, excludeId: [...(e.select?.excludeId ?? []), ${lit(unit)}] } }, { ...e, value: to, select: { id: [${lit(unit)}] } }]`
    : '[{ ...e, value: to }]';
  return [
    '{',
    `  id: ${lit(u.id)},`,
    `  reason: ${reason},`,
    '  after: (x) => {',
    `    const changes: [string, number, number][] = [${changes}];`,
    '    const apply = (effs: TechnologyEffect[] = []) => changes.reduce<TechnologyEffect[]>(',
    `      (acc, [p, from, to]) => acc.flatMap(e => (e.property === p && e.value === from ? ${replace} : [e])), effs);`,
    '    return { ...x, effects: apply(x.effects), variations: x.variations.map(v => ({ ...v, effects: apply(v.effects) })) };',
    '  },',
    '},',
  ].join('\n');
}

function hidePatch(u: UpgradeSummary, body: UpgradeReport, reason: string): string {
  if (body.scope === 'all') {
    return u.kind === 'tech'
      ? `{\n  id: ${lit(u.id)},\n  reason: ${reason},\n  after: (t) => ({ ...t, effects: [], variations: t.variations.map(v => ({ ...v, effects: [] })) }),\n},`
      : `{\n  id: ${lit(u.id)},\n  reason: ${reason},\n  after: (a) => ({ ...a, hidden: true }),\n},`;
  }
  if (u.kind === 'tech') {
    return `// If '${u.id}' already has a patch, add the unit to its excludedUnits instead.\n{\n  id: ${lit(u.id)},\n  reason: ${reason},\n  excludedUnits: [${lit(body.unitId ?? '??')}],\n},`;
  }
  return [
    '{',
    `  id: ${lit(u.id)},`,
    `  reason: ${reason},`,
    '  after: (a) => {',
    `    const ex = (e: TechnologyEffect) => ({ ...e, select: { ...e.select, excludeId: [...(e.select?.excludeId ?? []), ${lit(body.unitId ?? '??')}] } });`,
    '    return { ...a, effects: (a.effects ?? []).map(ex), variations: a.variations.map(v => ({ ...v, effects: (v.effects ?? []).map(ex) })) };',
    '  },',
    '},',
  ].join('\n');
}

function upgradePatch(r: Report, body: UpgradeReport): BuiltReport {
  const u = body.upgrade;
  const scopeText = body.scope === 'unit' ? `only for ${body.unitName ?? body.unitId}` : 'for every unit it affects';
  const kindText = u.kind === 'tech' ? 'Tech' : 'Ability';
  const what = body.hide
    ? (body.scope === 'unit' ? `should not apply to ${body.unitName ?? body.unitId}` : 'should not exist')
    : body.changes.length ? `${body.changes.length} wrong value${body.changes.length > 1 ? 's' : ''}` : 'note';
  const title = `${kindText} — ${u.name}: ${what}`;
  const summary = [
    `\`${u.id}\` · ${scopeText}`,
    ...body.changes.map(c => `• ${effectText(u.effects[c.index] ?? { property: c.property, effect: 'change', value: c.from }, c.from)} → **${effectValueText(u.effects[c.index] ?? { property: c.property, effect: 'change', value: c.to }, c.to)}**`),
    ...(body.note ? [`> ${body.note}`] : []),
  ];
  const reasonText = body.hide ? what : body.changes.map(c => `${c.property} ${num(c.from)} → ${num(c.to)}`).join(', ') || 'see note';
  const reason = lit(`Community report ${r.id}: ${reasonText} (${scopeText}).${r.source ? ` Source: ${r.source}` : ''}`);
  const head = `// → ${fileFor(u)}\n// Current effects in the app (${u.level}-level):\n${effectsDump(u)}`;
  const note = body.note ? `\n// Reporter note:\n${body.note.split('\n').map(l => `//   ${l}`).join('\n')}` : '';
  const code = body.hide ? hidePatch(u, body, reason)
    : body.changes.length ? effectChangePatch(u, body, reason)
      : '// TODO — no structured change, see the note.';
  return { title, summary, patch: `${head}${note}\n${code}` };
}

// ── Icon ──────────────────────────────────────────────────────────────────────

function iconPatch(r: Report, body: IconReport): BuiltReport {
  const t = body.target;
  const title = `Icon — ${t.name} (${t.kind})`;
  const summary = [`\`${t.id}\`: ${body.broken ? 'broken' : 'wrong'} icon${t.currentIcon ? ` (current: ${t.currentIcon})` : ''}`, ...(body.newIcon ? [`New: ${body.newIcon}`] : [])];
  if (!body.newIcon) {
    return { title, summary, patch: `// TODO — icon of ${t.kind} '${t.id}' reported broken, no replacement given.\n// Current: ${t.currentIcon ?? '(none)'}` };
  }
  const reason = lit(`Community report ${r.id}: icon fix.${r.source ? ` Source: ${r.source}` : ''}`);
  const patch = t.kind === 'unit'
    ? `// → src/data/patches/units.ts › unitPatches\n{\n  id: ${lit(t.id)},\n  reason: ${reason},\n  after: (u: any) => ({ ...u, icon: ${lit(body.newIcon)}, variations: u.variations.map((v: any) => ({ ...v, icon: ${lit(body.newIcon)} })) }),\n},`
    : `// → ${t.kind === 'tech' ? 'src/data/patches/technologies.ts › technologyPatches' : 'src/data/patches/abilities.ts › abilityPatches'}\n{\n  id: ${lit(t.id)},\n  reason: ${reason},\n  after: (x) => ({ ...x, icon: ${lit(body.newIcon)}, variations: x.variations.map(v => ({ ...v, icon: ${lit(body.newIcon)} })) }),\n},`;
  return { title, summary, patch };
}

// ── Missing ───────────────────────────────────────────────────────────────────

function effectLiteral(row: MissingEffectRow, type: string, fallbackUnitId: string): string {
  const select = row.appliesTo === 'class'
    ? `{ class: ${lit(parseClassGroups(row.appliesToValue))} }`
    : row.appliesTo === 'ids'
      ? `{ id: ${lit(row.appliesToValue.split(',').map(slug).filter(Boolean))} }`
      : `{ id: [${lit(fallbackUnitId)}] }`;
  if (row.stat === 'bonus') {
    return `{ property: 'meleeAttack' /* or 'rangedAttack' */, select: ${select}, effect: 'change', value: ${num(row.value)}, type: 'bonus', target: { class: ${lit(parseClassGroups(row.bonusVs ?? ''))} } }`;
  }
  if (row.mode === 'flat') {
    return `{ property: '${row.stat}', select: ${select}, effect: 'change', value: ${num(row.value)}, type: '${type}' }`;
  }
  const value = row.stat === 'attackSpeed' ? `1 / ${num(1 + row.value / 100)}` : num(1 + row.value / 100);
  return `{ property: '${row.stat}', select: ${select}, effect: 'multiply', value: ${value}, type: '${type}' }`;
}

function missingPatch(r: Report, body: MissingReport): BuiltReport {
  const id = (body.what === 'ability' ? 'ability-' : '') + slug(body.name);
  const civs = body.civs.length ? body.civs : [r.context?.civ ?? '??'];
  const title = `Missing ${body.what} — ${body.name} (${civs.join(', ')}, age ${body.age})`;
  const summary = [body.description ? `> ${body.description}` : '', ...body.effects.map(e => `• ${e.stat} ${e.mode === 'percent' ? `${e.value}%` : e.value}${e.bonusVs ? ` vs ${e.bonusVs}` : ''} → ${e.appliesTo === 'unit' ? 'this unit' : e.appliesToValue}`)].filter(Boolean);
  const ownerId = body.what === 'unit' ? slug(body.name) : (r.context?.unitId ?? slug(body.name));
  const effects = body.effects.map(e => `    ${effectLiteral(e, body.what === 'ability' ? 'ability' : 'passive', ownerId)},`).join('\n');

  if (body.what === 'ability') {
    return {
      title, summary, patch: [
        '// → src/data/patches/abilities.ts : add the call to applyAbilityPatches()\'s list',
        civs.length > 1 ? `// NOTE: createManualAbility takes one civ — reported civs: ${civs.join(', ')}` : '',
        `createManualAbility({`,
        `  id: ${lit(id)}, name: ${lit(body.name)}, civ: ${lit(civs[0])}, age: ${body.age}, pbgid: 0 /* pick a free 9999xx */,`,
        `  icon: '',`,
        `  description: ${lit(body.description)},`,
        '  effects: [',
        effects,
        '  ],',
        '}),',
      ].filter(Boolean).join('\n'),
    };
  }

  if (body.what === 'tech') {
    return {
      title, summary, patch: [
        '// → src/data/patches/technologies.ts : synthetic Technology (same shape as the other created techs)',
        '{',
        `  id: ${lit(id)}, name: ${lit(body.name)}, type: 'technology', civs: ${lit(civs)}, unique: true,`,
        `  displayClasses: [], classes: [], minAge: ${body.age}, icon: '', description: ${lit(body.description)},`,
        '  effects: [',
        effects,
        '  ] as TechnologyEffect[],',
        `  variations: [{ id: ${lit(`${id}-${body.age}`)}, baseId: ${lit(id)}, pbgid: 0, attribName: '', civs: ${lit(civs)}, costs: { food: 0, wood: 0, stone: 0, gold: 0, vizier: 0, oliveoil: 0, total: 0, popcap: 0, time: 0 }, effects: [] as TechnologyEffect[] }],`,
        '  shared: {},',
        '} as Technology,',
      ].join('\n'),
    };
  }

  const s = body.unitStats ?? {};
  const classes = (s.classes ?? '').split(/[,\s]+/).map(c => c.trim().toLowerCase()).filter(Boolean);
  const cost = (k: 'food' | 'wood' | 'gold' | 'stone') => s[k] ?? 0;
  const total = cost('food') + cost('wood') + cost('gold') + cost('stone');
  return {
    title, summary, patch: [
      '// → src/data/patches/units.ts › newUnits  (classes drive tech/ability matching — double-check them)',
      '{',
      `  id: ${lit(id)}, name: ${lit(body.name)}, type: 'unit', civs: ${lit(civs)}, unique: true,`,
      `  displayClasses: [], classes: ${lit(classes)}, minAge: ${body.age}, icon: '', description: ${lit(body.description)},`,
      '  variations: [{',
      `    id: ${lit(`${id}-${body.age}`)}, baseId: ${lit(id)}, type: 'unit', name: ${lit(body.name)}, pbgid: 0, attribName: '',`,
      `    age: ${body.age}, civs: ${lit(civs)}, description: '', classes: ${lit(classes)}, displayClasses: [], unique: true,`,
      `    costs: { food: ${cost('food')}, wood: ${cost('wood')}, stone: ${cost('stone')}, gold: ${cost('gold')}, total: ${total}, popcap: 1, time: 0 },`,
      `    producedBy: [], icon: '',`,
      `    hitpoints: ${s.hitpoints ?? 0},`,
      `    weapons: [{ name: 'Weapon', type: ${lit(s.damageType ?? 'melee')}, damage: ${s.damage ?? 0}, speed: ${s.attackSpeed ?? 0}, attackSpeed: ${s.attackSpeed ?? 0}, range: { min: 0, max: ${s.range ?? 0.295} }, modifiers: [] }],`,
      `    armor: [{ type: 'melee', value: ${s.meleeArmor ?? 0} }, { type: 'ranged', value: ${s.rangedArmor ?? 0} }],`,
      `    movement: { speed: ${s.moveSpeed ?? 1} },`,
      '  }],',
      '},',
      body.effects.length ? `// Extra effects reported (turn into abilities/techs if conditional):\n${effects.split('\n').map(l => `// ${l.trim()}`).join('\n')}` : '',
    ].filter(Boolean).join('\n'),
  };
}

// ── Entry point ───────────────────────────────────────────────────────────────

function buildOne(r: Report, b: ReportBody): BuiltReport {
  return b.kind === 'value' ? valuePatch(r, b)
    : b.kind === 'upgrade' ? upgradePatch(r, b)
      : b.kind === 'icon' ? iconPatch(r, b)
        : missingPatch(r, b);
}

export function buildReport(r: Report): BuiltReport {
  const pieces = r.corrections.map(b => buildOne(r, b));
  const ctx = r.context;
  const title = pieces.length === 1
    ? pieces[0].title
    : `${pieces.length} corrections — ${ctx ? `${ctx.unitName} (${ctx.civName}, age ${ctx.age})` : 'community report'}`;
  const summary = pieces.length === 1
    ? pieces[0].summary
    : pieces.flatMap((p, i) => [`**${i + 1}. ${p.title}**`, ...p.summary]);

  const header = [
    `// Community report ${r.id} — ${r.createdAt.slice(0, 10)} — app patch ${r.appVersion}`,
    `// ${title}`,
    r.reporter ? `// Reporter: ${r.reporter}` : '',
    r.source ? `// Source: ${r.source}` : '',
    ctx ? `// Open in app: ${ctx.link}` : '',
  ].filter(Boolean).join('\n');
  const body = pieces
    .map((p, i) => (pieces.length > 1 ? `// ━━ ${i + 1}/${pieces.length} — ${p.title} ━━\n${p.patch}` : p.patch))
    .join('\n\n');
  // The raw report is kept so the patch can be regenerated / double-checked; "*/" would close the comment.
  const json = JSON.stringify(r, null, 2).replace(/\*\//g, '*\\/');
  return { title, summary, patch: `${header}\n\n${body}\n\n/* REPORT JSON\n${json}\n*/\n` };
}
