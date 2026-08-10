// Share links encode the whole Sandbox state as readable query params, so a
// matchup can be reproduced from a URL. The app NEVER writes these params into
// the address bar itself — the browsing URL stays `/`. They only exist in links
// produced by the Share button, and are read once on arrival.
//
// Readable ids (rather than an opaque blob) so a link degrades gracefully: a
// tech renamed by a balance patch is simply dropped on restore, the rest of the
// matchup still loads.

export type ShareModelKey = 'aggregated' | 'focusFire' | 'focusFireBatchesMC';

export interface ShareSlot {
  civ: string;
  unitId: string;
  age: number;
  techs: string[];
  abilities: string[];
  /** Ability id → counter stack count (only entries > 0 are carried). */
  counters: Record<string, number>;
  count: number;
}

export interface ShareState {
  versus: boolean;
  slot1: ShareSlot | null;
  slot2: ShareSlot | null;
  kiting: boolean;
  distancePreset: string;
  customDistance: number;
  model: ShareModelKey;
  preset: 'cost' | 'pop' | null;
}

const LIST_SEP = '.';
const COUNTER_SEP = ':';
const MODEL_KEYS: ShareModelKey[] = ['aggregated', 'focusFire', 'focusFireBatchesMC'];
const MAX_COUNT = 100;

// Ids are already URL-safe ([a-z0-9_-]); keep `:` unescaped so counters stay readable.
const encodeValue = (v: string | number) =>
  encodeURIComponent(String(v)).replace(/%3A/g, COUNTER_SEP);

export function encodeShareState(state: ShareState): string {
  const parts: string[] = [];
  const add = (key: string, value: string | number) => parts.push(`${key}=${encodeValue(value)}`);

  if (state.versus) add('vs', 1);

  [state.slot1, state.slot2].forEach((slot, i) => {
    if (!slot) return;
    const n = i + 1;
    add(`c${n}`, slot.civ);
    add(`u${n}`, slot.unitId);
    add(`a${n}`, slot.age);
    if (slot.techs.length) add(`t${n}`, slot.techs.join(LIST_SEP));
    if (slot.abilities.length) {
      const encoded = slot.abilities.map(id => {
        const counter = slot.counters[id];
        return counter ? `${id}${COUNTER_SEP}${counter}` : id;
      });
      add(`b${n}`, encoded.join(LIST_SEP));
    }
    if (slot.count !== 1) add(`n${n}`, slot.count);
  });

  // Simulation options only matter in versus mode.
  if (state.versus) {
    if (state.kiting) add('k', 1);
    if (state.distancePreset === 'custom') add('d', state.customDistance);
    add('m', state.model);
    if (state.preset) add('p', state.preset);
  }

  return parts.join('&');
}

/** Reads a numeric param, falling back when it is absent or unparseable. */
const readNumber = (raw: string | null, min: number, max: number, fallback: number) => {
  if (raw === null || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback;
};

function parseSlot(q: URLSearchParams, n: number): ShareSlot | null {
  const unitId = q.get(`u${n}`);
  if (!unitId) return null;

  const abilities: string[] = [];
  const counters: Record<string, number> = {};
  (q.get(`b${n}`) || '').split(LIST_SEP).filter(Boolean).forEach(entry => {
    const [id, rawCount] = entry.split(COUNTER_SEP);
    if (!id) return;
    abilities.push(id);
    const count = Number(rawCount);
    if (Number.isFinite(count) && count > 0) counters[id] = Math.round(count);
  });

  return {
    civ: q.get(`c${n}`) || '',
    unitId,
    age: readNumber(q.get(`a${n}`), 1, 4, 4),
    techs: (q.get(`t${n}`) || '').split(LIST_SEP).filter(Boolean),
    abilities,
    counters,
    count: readNumber(q.get(`n${n}`), 1, MAX_COUNT, 1),
  };
}

/** Returns null when the query carries no shared matchup (the normal case). */
export function parseShareState(search: string): ShareState | null {
  if (!search) return null;
  const q = new URLSearchParams(search);
  const slot1 = parseSlot(q, 1);
  const slot2 = parseSlot(q, 2);
  if (!slot1 && !slot2) return null;

  const model = q.get('m') as ShareModelKey | null;
  const preset = q.get('p');
  const rawDistance = q.get('d');
  const hasDistance = rawDistance !== null && rawDistance !== '' && Number.isFinite(Number(rawDistance));

  return {
    versus: q.get('vs') === '1',
    slot1,
    slot2,
    kiting: q.get('k') === '1',
    distancePreset: hasDistance ? 'custom' : 'max',
    customDistance: readNumber(rawDistance, 0, 30, 5),
    model: model && MODEL_KEYS.includes(model) ? model : 'focusFire',
    preset: preset === 'cost' || preset === 'pop' ? preset : null,
  };
}

export function buildShareUrl(state: ShareState, origin: string): string {
  return `${origin}/?${encodeShareState(state)}`;
}
