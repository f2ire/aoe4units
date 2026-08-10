import type { ReactNode } from "react";

// Frame rendered off-screen and captured to a PNG by the "Copy image" button in
// the Sandbox. It wraps the REAL <UnitCard/> elements (same props as on screen,
// so the image is a faithful copy of the app) and adds what a shared image needs
// on top: the matchup title, the fight conditions, a strip of the selected
// tech/ability icons on the outer edge of each card — mirroring where the
// selectors sit in the app — the verdict and the site watermark.
//
// Interactive-only bits inside the cards are dropped via the
// `#share-image-card [data-hide-in-share]` rule in index.css.

export interface ShareIcon {
  id: string;
  name: string;
  icon: string;
  counter?: number;
}

export interface ShareSidePanel {
  name: string;
  count: number;
  age: number;
  card: ReactNode;
  techs: ShareIcon[];
  abilities: ShareIcon[];
}

const AGE_LABEL = ['', 'I', 'II', 'III', 'IV'];

// Same look as the selected button in AgeSelector.
function AgeBadge({ age }: { age: number }) {
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary font-serif text-base font-bold text-primary-foreground">
      {AGE_LABEL[age] || age}
    </span>
  );
}

interface ShareImageCardProps {
  left: ShareSidePanel | null;
  right: ShareSidePanel | null;
  /** Fight conditions shown as badges (equal cost, kiting, model…). */
  badges: string[];
  winRates?: { a: number; b: number; draw: number };
  patch: string;
}

// Icons stack in a single column and only spill into a second one past this many —
// `grid-auto-flow: column` + a fixed row count fills top-to-bottom, then starts a
// new column, without depending on the (unknown at render time) card height.
const MAX_ICONS_PER_COLUMN = 12;

// Same selected-state colors as the live selectors: green for techs
// (TechnologySelector), purple for abilities (AbilitySelector).
function IconGrid({ icons, tone }: { icons: ShareIcon[]; tone: 'tech' | 'ability' }) {
  if (icons.length === 0) return null;
  return (
    <div
      className="grid gap-1"
      style={{ gridAutoFlow: 'column', gridTemplateRows: `repeat(${Math.min(icons.length, MAX_ICONS_PER_COLUMN)}, auto)` }}
    >
      {icons.map(item => (
        <div
          key={item.id}
          title={item.name}
          className={`relative h-10 w-10 overflow-hidden rounded border-2 ${tone === 'tech' ? 'border-green-500 bg-green-500/10' : 'border-purple-500 bg-purple-500/10'
            }`}
        >
          <img src={item.icon} alt={item.name} crossOrigin="anonymous" className="h-full w-full object-contain" />
          {item.counter ? (
            <span className="absolute bottom-0 right-0 rounded-tl bg-green-600 px-1 text-[10px] font-bold leading-tight text-white">
              {item.counter}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function IconColumn({ side, techs, abilities }: { side: 'left' | 'right'; techs: ShareIcon[]; abilities: ShareIcon[] }) {
  if (techs.length === 0 && abilities.length === 0) return null;
  return (
    <div className={`flex w-max shrink-0 flex-col gap-2 ${side === 'left' ? 'items-end' : 'items-start'}`}>
      <IconGrid icons={techs} tone="tech" />
      {techs.length > 0 && abilities.length > 0 && <div className="h-px w-full bg-border" />}
      <IconGrid icons={abilities} tone="ability" />
    </div>
  );
}

export function ShareImageCard({ left, right, badges, winRates, patch }: ShareImageCardProps) {
  return (
    <div id="share-image-card" className="w-max bg-background p-6 text-foreground">
      <div className="mb-3 flex items-center justify-center gap-3">
        {left && <AgeBadge age={left.age} />}
        <span className="font-serif text-xl font-bold">
          {left?.name ?? '—'}{left && left.count > 1 ? ` ×${left.count}` : ''}
        </span>
        <span className="text-sm font-bold text-muted-foreground">VS</span>
        <span className="font-serif text-xl font-bold">
          {right?.name ?? '—'}{right && right.count > 1 ? ` ×${right.count}` : ''}
        </span>
        {right && <AgeBadge age={right.age} />}
      </div>

      {badges.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
          {badges.map(badge => (
            <span key={badge} className="rounded-full border border-border bg-card px-3 py-1 text-[12px] font-medium text-muted-foreground">
              {badge}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-start justify-center gap-3">
        {left && <IconColumn side="left" techs={left.techs} abilities={left.abilities} />}
        {left && <div className="w-[300px]">{left.card}</div>}
        {right && <div className="w-[300px]">{right.card}</div>}
        {right && <IconColumn side="right" techs={right.techs} abilities={right.abilities} />}
      </div>

      {winRates && (
        <div className="mt-4">
          <div className="flex h-3 overflow-hidden rounded-full border border-border">
            <div className="bg-green-500" style={{ width: `${winRates.a * 100}%` }} />
            <div className="bg-muted" style={{ width: `${winRates.draw * 100}%` }} />
            <div className="bg-orange-500" style={{ width: `${winRates.b * 100}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[12px] text-muted-foreground">
            <span>{Math.round(winRates.a * 100)}% {left?.name}</span>
            <span>{Math.round(winRates.draw * 100)}% draw</span>
            <span>{right?.name} {Math.round(winRates.b * 100)}%</span>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-[12px] text-muted-foreground">
        <span className="font-semibold text-primary">aoe4units.com</span>
        <span>Patch {patch}</span>
      </div>
    </div>
  );
}
