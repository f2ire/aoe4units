/**
 * build-twitch-data.mjs — Phase 2 "slim the data" for the Twitch extension.
 *
 * Produces a reduced copy of the three source data files into
 * `extension/src/data/`, keeping ONLY the fields the 1v1 pipeline actually
 * reads (combat.ts + UnitCard.tsx + the data loaders/patches + the tech/ability
 * selectors). The output keeps the exact `{ __version__, data: [...] }` shape and
 * the original filenames so it is a drop-in for the existing loaders — the site's
 * own data loading is left untouched (the extension just points at this folder).
 *
 * It does NOT pre-apply the runtime patches (patches/*.ts) — those still run at
 * load time on this slimmed JSON, so `newUnits`, synthetic abilities/techs,
 * `continuousMovement`, `selfDestructs`, etc. are added by the app as usual.
 *
 * Run:  node scripts/build-twitch-data.mjs
 *
 * ---------------------------------------------------------------------------
 * KEPT vs REMOVED (see console report for live numbers)
 *
 * UNIT (top-level):  id, name, type, civs, unique, displayClasses, classes,
 *                    minAge, icon
 *   removed: description
 * UNIT variation:    id, baseId, age, civs, classes, displayClasses, hitpoints,
 *                    costs, icon, name, weapons, secondaryWeapons?, armor?,
 *                    resistance?, movement?
 *   removed: pbgid, attribName, sight, producedBy, description, unique, type,
 *            garrison
 * WEAPON:            name, type, damage, speed, attackSpeed?, range{min,max}?,
 *                    modifiers (always, may be []), burst?,
 *                    durations{windup,winddown,reload}?
 *   removed: attribName, pbgid, durations.{aim,attack,setup,teardown}
 *
 * TECHNOLOGY (top-level): id, name, type, civs, unique, displayClasses, classes,
 *                    minAge, icon, description, effects?, baseId?, age?,
 *                    counter*?, uiTooltip?, hasMongolUpgrade?
 *   removed: costs, shared, producedBy
 * TECHNOLOGY variation: id, civs, effects?
 *   removed: pbgid, attribName, costs, producedBy, name, icon, description,
 *            classes, displayClasses, unique, type, baseId, age, unlockedBy
 *
 * ABILITY (top-level): same as technology + active?, activeForIds?,
 *                    counterInputMode?
 *   removed: costs, shared, producedBy
 * ABILITY variation: id, civs, effects?, active?, auraRange?, activatedOn?,
 *                    unlockedBy?, description?   (description kept — AbilitySelector reads it)
 *   removed: pbgid, attribName, costs, producedBy, name, icon, classes,
 *            displayClasses, baseId, age
 * ---------------------------------------------------------------------------
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src', 'data');
const OUT = join(ROOT, 'extension', 'src', 'data');

// --- helpers ----------------------------------------------------------------
const KB = (bytes) => (bytes / 1024).toFixed(0) + ' KB';
const rawSize = (obj) => Buffer.byteLength(JSON.stringify(obj), 'utf8');
const gzSize = (obj) => gzipSync(Buffer.from(JSON.stringify(obj), 'utf8')).length;
const readJson = (name) => JSON.parse(readFileSync(join(SRC, name), 'utf8'));

/** Copy only the listed keys that are present (and non-undefined) on `src`. */
function pick(src, keys) {
  const out = {};
  for (const k of keys) if (src[k] !== undefined) out[k] = src[k];
  return out;
}

/**
 * Parse EXCLUDED_UNIT_IDS straight from unified-units.ts so the slim set stays
 * in sync with the app's single source of truth (no hardcoded duplicate).
 */
function parseExcludedUnitIds() {
  const ts = readFileSync(join(SRC, 'unified-units.ts'), 'utf8');
  const m = ts.match(/EXCLUDED_UNIT_IDS\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
  if (!m) throw new Error('Could not parse EXCLUDED_UNIT_IDS from unified-units.ts');
  return new Set([...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]));
}

// --- slimmers ---------------------------------------------------------------
function slimWeapon(w) {
  const o = pick(w, ['name', 'type', 'damage', 'speed', 'attackSpeed']);
  if (w.range) o.range = pick(w.range, ['min', 'max']);
  o.modifiers = w.modifiers || []; // always emit — combat/UI iterate it; empty arrays gzip to ~nothing
  if (w.burst) o.burst = w.burst;
  if (w.durations) {
    const d = pick(w.durations, ['windup', 'winddown', 'reload']);
    if (Object.keys(d).length) o.durations = d;
  }
  return o;
}

function slimUnitVariation(v) {
  const o = pick(v, [
    'id', 'baseId', 'age', 'civs', 'classes', 'displayClasses',
    'hitpoints', 'costs', 'icon', 'name', 'armor', 'resistance', 'movement',
    // Combat fields that today only ever come from patches/units.ts (never from the
    // upstream JSON) — listed anyway so they survive if upstream ever ships them.
    // `pick` skips absent keys, so this costs nothing in the current output.
    'healingRate', 'healingRatePerSecond', 'opponentHealingRateDebuff',
    'maxHpBonusFraction', 'hpStartFraction', 'dpsVsMeleeASCoeff',
    'continuousMovement', 'selfDestructs',
  ]);
  o.weapons = (v.weapons || []).map(slimWeapon);
  if (v.secondaryWeapons) o.secondaryWeapons = v.secondaryWeapons.map(slimWeapon);
  return o;
}

function slimUnit(u) {
  const o = pick(u, [
    'id', 'name', 'type', 'civs', 'unique', 'displayClasses', 'classes',
    'minAge', 'icon',
  ]);
  o.variations = (u.variations || []).map(slimUnitVariation);
  return o;
}

const TECH_TOP_KEYS = [
  'id', 'name', 'type', 'civs', 'unique', 'displayClasses', 'classes',
  'minAge', 'icon', 'description', 'baseId', 'age',
  'counterMax', 'counterStep', 'counterSteps', 'unitCounterStep',
  'counterDirection', 'counterTooltipLabel', 'counterHideMax', 'uiTooltip',
  'hasMongolUpgrade',
];

function slimTech(t) {
  const o = pick(t, TECH_TOP_KEYS);
  if (t.effects) o.effects = t.effects;
  o.variations = (t.variations || []).map((v) => {
    const sv = pick(v, ['id', 'civs']);
    if (v.effects) sv.effects = v.effects;
    return sv;
  });
  return o;
}

function slimAbility(a) {
  const o = pick(a, [...TECH_TOP_KEYS, 'active', 'activeForIds', 'counterInputMode']);
  if (a.effects) o.effects = a.effects;
  o.variations = (a.variations || []).map((v) =>
    pick(v, ['id', 'civs', 'effects', 'active', 'auraRange', 'activatedOn', 'unlockedBy', 'description'])
  );
  return o;
}

// --- build ------------------------------------------------------------------
function build() {
  const excluded = parseExcludedUnitIds();
  mkdirSync(OUT, { recursive: true });

  const jobs = [
    {
      file: 'all-unified.json',
      slim: (src) => ({
        __version__: src.__version__,
        data: src.data
          .filter((u) => u.type === 'unit' && !excluded.has(u.id))
          .map(slimUnit),
      }),
    },
    {
      file: 'all-optimized_tec.json',
      slim: (src) => ({ __version__: src.__version__, data: src.data.map(slimTech) }),
    },
    {
      file: 'all-optimized_abi.json',
      slim: (src) => ({ __version__: src.__version__, data: src.data.map(slimAbility) }),
    },
  ];

  console.log('Building slim Twitch data → extension/src/data/\n');
  let totalBeforeRaw = 0, totalAfterRaw = 0, totalBeforeGz = 0, totalAfterGz = 0;

  for (const job of jobs) {
    const src = readJson(job.file);
    const slim = job.slim(src);

    const beforeRaw = Buffer.byteLength(readFileSync(join(SRC, job.file)));
    const afterRaw = rawSize(slim);
    const beforeGz = gzSize(src);
    const afterGz = gzSize(slim);

    totalBeforeRaw += beforeRaw; totalAfterRaw += afterRaw;
    totalBeforeGz += beforeGz; totalAfterGz += afterGz;

    writeFileSync(join(OUT, job.file), JSON.stringify(slim));

    console.log(
      `${job.file.padEnd(24)} ${String(slim.data.length).padStart(4)} entries` +
      `  raw ${KB(beforeRaw).padStart(8)} → ${KB(afterRaw).padStart(7)}` +
      `  gzip ${KB(beforeGz).padStart(7)} → ${KB(afterGz).padStart(6)}`
    );
  }

  console.log('\n' + '-'.repeat(78));
  console.log(
    `${'TOTAL'.padEnd(24)} ${''.padStart(4)}        ` +
    `  raw ${KB(totalBeforeRaw).padStart(8)} → ${KB(totalAfterRaw).padStart(7)}` +
    `  gzip ${KB(totalBeforeGz).padStart(7)} → ${KB(totalAfterGz).padStart(6)}`
  );
  console.log(
    `\nReduction: raw ${(100 - (totalAfterRaw / totalBeforeRaw) * 100).toFixed(1)}%` +
    `, gzip ${(100 - (totalAfterGz / totalBeforeGz) * 100).toFixed(1)}%` +
    ` (excluded ${excluded.size} unit ids)`
  );
}

build();
