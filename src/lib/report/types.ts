// Community report system — data shapes shared by the dialog, the patch generator
// and (as plain JSON) the Cloudflare Worker in worker/report/.

/** Stats a visitor can flag on a unit card. `bonus:<class>` = primary-weapon bonus vs that class. */
export type StatKey =
  | 'hitpoints'
  | 'damage'
  | 'attackSpeed'
  | 'maxRange'
  | 'meleeArmor'
  | 'rangedArmor'
  | 'moveSpeed'
  | 'food'
  | 'wood'
  | 'gold'
  | 'stone'
  | `bonus:${string}`;

export interface StatValue {
  key: StatKey;
  label: string;
  /** Value in the unit data for this age/civ, before any tech or ability. */
  base: number;
  /** Value the card currently shows (with active techs/abilities). */
  shown: number;
}

export interface EffectSummary {
  property: string;
  effect: string;
  value: number;
  type?: string;
  select?: { class?: string[][]; id?: string[]; excludeId?: string[] };
  target?: { class: string[][] };
  duration?: number;
}

/** A tech or ability as the app resolves it for this unit. */
export interface UpgradeSummary {
  kind: 'tech' | 'ability';
  id: string;
  name: string;
  icon?: string;
  description?: string;
  /** Effects the app applies; `level` says where they live in the data (matters for the patch shape). */
  effects: EffectSummary[];
  level: 'top' | 'variation';
  active: boolean;
  counter?: number;
}

/** Everything a report needs to know about the card it was opened from. */
export interface ReportContext {
  civ: string;
  civName: string;
  unitId: string;
  unitName: string;
  unitIcon?: string;
  age: number;
  stats: StatValue[];
  upgrades: UpgradeSummary[];
  /** Link that reopens the Sandbox on this exact unit + loadout. */
  link: string;
}

export type ReportKind = 'value' | 'upgrade' | 'icon' | 'missing';

export interface ValueReport {
  kind: 'value';
  stat: StatKey;
  statLabel: string;
  base: number;
  shown: number;
  expected: number;
  /** true = "the in-game value WITH my current upgrades is `expected`"; false = base value. */
  withUpgrades: boolean;
}

/** One effect whose number is wrong: matched in the data by property + old value. */
export interface EffectChange {
  index: number;
  property: string;
  from: number;
  to: number;
}

export interface UpgradeReport {
  kind: 'upgrade';
  upgrade: UpgradeSummary;
  /** 'unit' = the fix only concerns the unit the report was opened from; 'all' = every unit the upgrade affects. */
  scope: 'unit' | 'all';
  /** Unit id the 'unit' scope refers to. */
  unitId?: string;
  unitName?: string;
  changes: EffectChange[];
  /** scope 'unit': should not apply to this unit · scope 'all': should not exist at all. */
  hide: boolean;
  note: string;
}

export interface IconReport {
  kind: 'icon';
  target: { kind: 'unit' | 'tech' | 'ability'; id: string; name: string; currentIcon?: string };
  newIcon: string;
  broken: boolean;
}

/** One effect row of the "missing" builder, in visitor terms. */
export interface MissingEffectRow {
  stat: 'meleeAttack' | 'rangedAttack' | 'hitpoints' | 'meleeArmor' | 'rangedArmor' | 'attackSpeed' | 'moveSpeed' | 'maxRange' | 'bonus';
  mode: 'flat' | 'percent';
  value: number;
  /** Who gets it: this unit, a class (e.g. "melee infantry"), or unit ids. */
  appliesTo: 'unit' | 'class' | 'ids';
  appliesToValue: string;
  /** bonus rows: target class, e.g. "cavalry". */
  bonusVs?: string;
}

export interface MissingUnitStats {
  hitpoints?: number;
  damage?: number;
  damageType?: 'melee' | 'ranged' | 'siege';
  attackSpeed?: number;
  range?: number;
  meleeArmor?: number;
  rangedArmor?: number;
  moveSpeed?: number;
  food?: number;
  wood?: number;
  gold?: number;
  stone?: number;
  classes?: string;
}

export interface MissingReport {
  kind: 'missing';
  what: 'unit' | 'tech' | 'ability';
  name: string;
  civs: string[];
  age: number;
  description: string;
  effects: MissingEffectRow[];
  unitStats?: MissingUnitStats;
}

export type ReportBody = ValueReport | UpgradeReport | IconReport | MissingReport;

export interface Report {
  id: string;
  createdAt: string;
  /** Context of the card the dialog was opened from (absent for a footer "missing" report). */
  context?: ReportContext;
  /** Everything the visitor corrected in one go (the dialog's basket). */
  corrections: ReportBody[];
  source?: string;
  reporter?: string;
  appVersion: string;
}

/** What the dialog POSTs to the Worker. */
export interface ReportSubmission {
  turnstileToken: string;
  title: string;
  summary: string[];
  patch: string;
  report: Report;
}
