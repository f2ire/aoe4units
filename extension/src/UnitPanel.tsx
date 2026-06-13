/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight, ChevronUp, GripHorizontal, Lock, LockOpen, Search, Settings2 } from "lucide-react";
import { getAvailableAges, getTotalCost } from "@/data/unified-units";
import type { AoE4Unit } from "@/data/unified-units";
import { getTechnologyTier, getTechnologyBaseName } from "@/data/unified-technologies";
import { CIVILIZATIONS } from "@/data/civilizations";
import { useUnitSlot } from "@/hooks/useUnitSlot";
import { buildModifiedVariation } from "@/lib/buildVariation";
import { cn } from "@/lib/utils";
import { CompactUnitCard, type CompareStats, type VSSlotInfo } from "./CompactUnitCard";
import type { ResizeHandle } from "./useDraggablePanel";
import { CompactLoadout } from "./CompactLoadout";
import { assetUrl } from "./assetUrl";

type Slot = ReturnType<typeof useUnitSlot>;

const CATEGORY_LABELS: Record<string, string> = {
  jeanne: "Jeanne d'Arc",
  melee_infantry: "Melee Infantry",
  ranged: "Ranged",
  cavalry: "Cavalry",
  siege: "Siege",
  monk: "Monks",
  ship: "Ships",
  mercenary: "Mercenaries",
  khaganate: "Khaganate",
  other: "Other",
};

const CATEGORY_ICONS: Record<string, string> = {
  jeanne: "https://data.aoe4world.com/images/units/jeanne-darc-peasant-1.png",
  melee_infantry: "https://data.aoe4world.com/images/buildings/barracks.png",
  ranged: "https://data.aoe4world.com/images/buildings/archery-range.png",
  cavalry: "https://data.aoe4world.com/images/buildings/stable.png",
  siege: "https://data.aoe4world.com/images/buildings/siege-workshop.png",
  monk: "https://data.aoe4world.com/images/buildings/monastery.png",
  ship: "https://data.aoe4world.com/images/buildings/dock.png",
  mercenary: "https://data.aoe4world.com/images/buildings/barracks.png",
  khaganate: "https://data.aoe4world.com/images/buildings/khaganate-palace.png",
  other: "https://data.aoe4world.com/images/buildings/house.png",
};

const CATEGORY_ORDER = [
  "jeanne", "melee_infantry", "ranged", "cavalry", "siege",
  "mercenary", "khaganate", "monk", "ship", "other",
];

const DRAWER_HEIGHT_KEY = "aoe4-overlay-drawer-h";
const DRAWER_MIN_HEIGHT = 80;
const DRAWER_MAX_HEIGHT = 1200;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ---------------------------------------------------------------------------
// SlotPanel — one slot's full UI: stat card + pickers + optional drawer.
// ---------------------------------------------------------------------------

export interface VSResultData {
  winner: "attacker" | "defender" | "draw";
  unit1Name: string;
  unit2Name: string;
  /** Time (s) for slot1 to kill slot2. */
  ttk1: number | null;
  /** Time (s) for slot2 to kill slot1. */
  ttk2: number | null;
  dps1: number | null;
  dps2: number | null;
  hitsToKill1: number | null;
  hitsToKill2: number | null;
  dpsPerCost1: number | null;
  dpsPerCost2: number | null;
  winnerHp?: number;
  winnerMaxHp?: number;
  loserUnitsToWin?: number;
  /** Equal-cost group sizes — present only in equal-cost mode. */
  multA?: number;
  multB?: number;
  /** Winner group units remaining (equal-cost mode; MC median when available). */
  winnerUnits?: number;
  /** Monte-Carlo win rates (Attack move model / capped melee crowds). */
  winRateA?: number;
  winRateB?: number;
  drawRate?: number;
}

export type MultiUnitModelKey = "aggregated" | "focusFire" | "focusFireBatchesMC";

/** Toggle/selector state rendered inside the VS card (equal cost, kiting, model). */
export interface VSCardControls {
  atEqualCost: boolean;
  onToggleEqualCost: () => void;
  /** Same cost or zero cost — equal-cost mode is a no-op, toggle disabled. */
  equalCostDisabled?: boolean;
  equalCostDisabledTitle?: string;
  allowKiting: boolean;
  onToggleKiting: () => void;
  modelKey: MultiUnitModelKey;
  onModelChange: (key: MultiUnitModelKey) => void;
}

// "aggregated" stays a valid key for the combat plumbing but is not exposed
// in the Twitch UI — viewers only choose between Target focus and Attack move.
const MODEL_OPTIONS: Array<{ key: MultiUnitModelKey; label: string; title: string }> = [
  { key: "focusFire", label: "Focus", title: "Target focus model" },
  { key: "focusFireBatchesMC", label: "Atk move", title: "Attack move model (Monte Carlo)" },
];

export { type VSSlotInfo };

function vsStatColors(v1: number | null, v2: number | null, higherIsBetter: boolean) {
  if (v1 == null || v2 == null || Math.abs(v1 - v2) < 1e-4) return { c1: "text-zinc-300", c2: "text-zinc-300" };
  const slot1Better = higherIsBetter ? v1 > v2 : v1 < v2;
  return {
    c1: slot1Better ? "text-green-400 font-semibold" : "text-zinc-400",
    c2: slot1Better ? "text-zinc-400" : "text-green-400 font-semibold",
  };
}

function fmtN(v: number | null, precision = 1): string {
  return v == null ? "—" : v.toFixed(precision);
}

// Integer percentages that sum to exactly 100 (largest-remainder method) —
// independent rounding of each rate can total 99 or 101.
function pctSplit(parts: number[]): number[] {
  const total = parts.reduce((a, b) => a + b, 0) || 1;
  const exact = parts.map((p) => (p / total) * 100);
  const floors = exact.map(Math.floor);
  let rest = 100 - floors.reduce((a, b) => a + b, 0);
  const byFrac = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < byFrac.length && rest > 0; k++, rest--) floors[byFrac[k].i]++;
  return floors;
}

// Corner resize grip — diagonal rounded strokes instead of a filled triangle,
// so it sits inside the cards' rounded corners without a hard edge.
export function ResizeGrip({ onPointerDown, title, className, gripRef }: {
  onPointerDown: (e: React.PointerEvent) => void;
  title: string;
  className?: string;
  gripRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={gripRef}
      onPointerDown={onPointerDown}
      title={title}
      className={cn("absolute bottom-0 right-0 z-20 flex h-4 w-4 cursor-nwse-resize touch-none items-end justify-end p-[3px]", className)}
    >
      <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
        <path d="M9 2.5 L2.5 9" stroke="rgba(245,158,11,0.7)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M9 6.5 L6.5 9" stroke="rgba(245,158,11,0.7)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// Small lock toggle sitting just left of the resize grip. When active, both
// unit panels are kept at the same size (resizing either one resizes both).
export function SizeLockButton({ locked, onToggle, className }: {
  locked: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onToggle}
      title={locked ? "Unlock panel sizes" : "Lock both unit panels to the same size"}
      className={cn(
        "absolute bottom-0 right-4 z-20 flex h-3 w-3 items-center justify-center rounded-sm border shadow-sm backdrop-blur-sm transition-colors",
        locked
          ? "border-amber-400/70 bg-amber-500/90 text-black"
          : "border-amber-500/40 bg-zinc-900/85 text-amber-300/90 hover:border-amber-500/70 hover:bg-zinc-800/90",
        className,
      )}
    >
      {locked ? <Lock className="h-1.5 w-1.5" /> : <LockOpen className="h-1.5 w-1.5" />}
    </button>
  );
}

// Invisible resize hit areas along all four edges and corners — straddling the
// panel border so they're easy to grab without covering much content. Edges
// stop short of the corners so corner handles keep their diagonal cursor.
const RESIZE_HANDLE_AREAS: Array<{ handle: ResizeHandle; className: string }> = [
  { handle: "n", className: "-top-1 left-3 right-3 h-2 cursor-ns-resize" },
  { handle: "w", className: "-left-1 top-3 bottom-3 w-2 cursor-ew-resize" },
  { handle: "e", className: "-right-1 top-3 bottom-3 w-2 cursor-ew-resize" },
  { handle: "nw", className: "-top-1 -left-1 h-4 w-4 cursor-nwse-resize" },
  { handle: "ne", className: "-top-1 -right-1 h-4 w-4 cursor-nesw-resize" },
  { handle: "sw", className: "-bottom-1 -left-1 h-4 w-4 cursor-nesw-resize" },
  { handle: "se", className: "-bottom-1 -right-1 h-4 w-4 cursor-nwse-resize" },
];

// Resize hit areas on every edge/corner of a panel. Must be rendered inside a
// `relative` container; forwards the grabbed handle to startResize.
export function ResizeHandles({ onResizeStart, className }: {
  onResizeStart: (e: React.PointerEvent, handle: ResizeHandle) => void;
  className?: string;
}) {
  return (
    <>
      {RESIZE_HANDLE_AREAS.map(({ handle, className: pos }) => (
        <div
          key={handle}
          onPointerDown={(e) => onResizeStart(e, handle)}
          title="Resize panel"
          className={cn("absolute z-20 touch-none", pos, className)}
        />
      ))}
    </>
  );
}

// Small amber soldier pictogram used to visualize unit counts.
function SoldierChip({ size = 14 }: { size?: number }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: 2,
        background: "rgba(245,158,11,0.13)", border: "1px solid rgba(245,158,11,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <svg width={Math.round(size * 0.57)} height={Math.round(size * 0.57)} viewBox="0 0 10 10" fill="none">
        <circle cx="5" cy="3" r="2" fill="rgba(245,158,11,0.85)" />
        <rect x="1" y="5.5" width="8" height="4.5" rx="1" fill="rgba(245,158,11,0.85)" />
      </svg>
    </div>
  );
}

// One side of the equal-cost unit-count display: just the unit count.
function UnitCountSide({ count }: { count: number }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-base font-bold leading-none tabular-nums text-amber-300">{count}</span>
    </div>
  );
}

export function VSCard({ winner, unit1Name, unit2Name, dps1, dps2, hitsToKill1, hitsToKill2, dpsPerCost1, dpsPerCost2, ttk1, ttk2, winnerHp, winnerMaxHp, loserUnitsToWin, multA, multB, winnerUnits, winRateA, winRateB, drawRate, controls }: VSResultData & { controls?: VSCardControls }) {
  const dpsCols = vsStatColors(dps1, dps2, true);
  const htkCols = vsStatColors(hitsToKill1, hitsToKill2, false);
  const dpcCols = vsStatColors(dpsPerCost1, dpsPerCost2, true);
  const ttkCols = vsStatColors(ttk1, ttk2, false);

  const rows: Array<{ label: string; v1: string; v2: string; c1: string; c2: string; tip: string }> = [
    { label: "DPS", v1: fmtN(dps1), v2: fmtN(dps2), ...dpsCols, tip: "Damage per second" },
    { label: "HTK", v1: hitsToKill1 == null ? "—" : String(hitsToKill1), v2: hitsToKill2 == null ? "—" : String(hitsToKill2), ...htkCols, tip: "Hit to kill" },
    { label: "DPS/Cost", v1: fmtN(dpsPerCost1, 3), v2: fmtN(dpsPerCost2, 3), ...dpcCols, tip: "Damage per second / cost" },
    { label: "TTK", v1: ttk1 == null ? "—" : `${ttk1.toFixed(1)}s`, v2: ttk2 == null ? "—" : `${ttk2.toFixed(1)}s`, ...ttkCols, tip: "Time to kill" },
  ];

  const slot1Wins = winner === "attacker";
  const slot2Wins = winner === "defender";
  const isDraw = winner === "draw";
  const hpPct = winnerHp != null && winnerMaxHp ? Math.max(0, Math.round((winnerHp / winnerMaxHp) * 100)) : null;
  const loserName = slot1Wins ? unit2Name : unit1Name;

  return (
    <div className="w-[185px] rounded-lg border border-amber-500/30 bg-zinc-950/65 text-zinc-100 shadow-2xl ring-1 ring-black/30 backdrop-blur-md">
      <div className="border-b border-amber-500/15 bg-zinc-900/70 px-2 py-1 text-center font-serif text-[13px] font-semibold tracking-wide text-amber-400/80">
        ⚔ VS Stats
      </div>
      {controls && (
        <div className="pointer-events-auto border-b border-amber-500/15 px-2 py-1.5 space-y-1">
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => { if (!controls.equalCostDisabled) controls.onToggleEqualCost(); }}
              disabled={controls.equalCostDisabled}
              title={controls.equalCostDisabledTitle ?? "Compare equal-cost groups (approx.)"}
              className={cn(
                "rounded border px-1.5 py-0.5 text-[10px] font-bold transition-colors",
                controls.equalCostDisabled
                  ? "cursor-not-allowed border-zinc-700 bg-black/40 text-zinc-600"
                  : controls.atEqualCost
                    ? "border-amber-500 bg-amber-500 text-black"
                    : "border-amber-500/40 bg-black/40 text-amber-400 hover:border-amber-500/70 hover:bg-amber-500/10",
              )}
            >
              = Cost
            </button>
            <button
              type="button"
              onClick={controls.onToggleKiting}
              title="Ranged units kite while melee closes the gap"
              className={cn(
                "rounded border px-1.5 py-0.5 text-[10px] font-bold transition-colors",
                controls.allowKiting
                  ? "border-amber-500 bg-amber-500 text-black"
                  : "border-amber-500/40 bg-black/40 text-amber-400 hover:border-amber-500/70 hover:bg-amber-500/10",
              )}
            >
              Kiting
            </button>
          </div>
          {(controls.atEqualCost || controls.allowKiting) && (
            <div className="flex items-center justify-center">
              <div className="flex overflow-hidden rounded border border-amber-500/30">
                {MODEL_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => controls.onModelChange(opt.key)}
                    title={opt.title}
                    className={cn(
                      "px-1.5 py-0.5 text-[9px] font-semibold transition-colors",
                      controls.modelKey === opt.key
                        ? "bg-amber-500 text-black"
                        : "bg-black/40 text-zinc-300 hover:bg-amber-500/10",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {(controls.atEqualCost || controls.allowKiting) && (
            <div className="flex items-center justify-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300">
              <span aria-hidden>⚠</span>
              May be imprecise
            </div>
          )}
        </div>
      )}
      {multA != null && multB != null && (
        <div className="border-b border-amber-500/15 px-2 py-1.5">
          <div className="mb-1 text-center text-[9px] font-semibold uppercase tracking-widest text-zinc-500">
            Units per side
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
            <UnitCountSide count={multA} />
            <span className="text-[10px] font-semibold uppercase text-zinc-500">vs</span>
            <UnitCountSide count={multB} />
          </div>
        </div>
      )}
      <div className="pointer-events-auto px-2 py-2 space-y-1.5">
        {rows.map(({ label, v1, v2, c1, c2, tip }) => (
          <div key={label} className="group relative flex cursor-help items-center gap-0.5 text-[12px]">
            <span className={cn("w-[44px] text-right tabular-nums leading-none", c1)}>{v1}</span>
            <span className="mx-1 min-w-[56px] text-center text-[11px] uppercase tracking-wide text-zinc-400 underline decoration-dotted decoration-zinc-600 underline-offset-2">{label}</span>
            <span className={cn("w-[44px] text-left tabular-nums leading-none", c2)}>{v2}</span>
            <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-0.5 hidden -translate-x-1/2 whitespace-nowrap rounded border border-amber-500/40 bg-zinc-950/95 px-1.5 py-0.5 text-[10px] font-medium text-zinc-200 shadow-xl backdrop-blur group-hover:block">
              {tip}
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-amber-500/15 px-2 py-1.5 space-y-1">
        {winRateA != null && winRateB != null && (() => {
          const [pctA, pctDraw, pctB] = pctSplit([winRateA, drawRate ?? 0, winRateB]);
          // Green = winner, orange = loser (neutral when the overall result is a draw).
          const aTextColor = slot1Wins ? "text-green-400" : slot2Wins ? "text-orange-400" : "text-zinc-300";
          const bTextColor = slot2Wins ? "text-green-400" : slot1Wins ? "text-orange-400" : "text-zinc-300";
          const aBarColor = slot1Wins ? "bg-green-500/70" : slot2Wins ? "bg-orange-500/70" : "bg-zinc-500/70";
          const bBarColor = slot2Wins ? "bg-green-500/70" : slot1Wins ? "bg-orange-500/70" : "bg-zinc-500/70";
          return (
            <>
              <div className="text-center text-[9px] font-semibold uppercase tracking-widest text-zinc-500">
                Win rate
              </div>
              <div className="flex items-end justify-between gap-1 text-[11px]">
                <span className="flex min-w-0 items-baseline gap-1">
                  <span className={cn("font-bold tabular-nums", aTextColor)}>{pctA}%</span>
                  <span className="truncate text-[10px] text-zinc-400">{unit1Name}</span>
                </span>
                <span className="flex min-w-0 items-baseline gap-1">
                  <span className="truncate text-right text-[10px] text-zinc-400">{unit2Name}</span>
                  <span className={cn("font-bold tabular-nums", bTextColor)}>{pctB}%</span>
                </span>
              </div>
              <div className="relative flex h-2 overflow-hidden rounded-full bg-zinc-800">
                <div className={cn("h-full", aBarColor)} style={{ width: `${pctA}%` }} />
                <div className="h-full bg-zinc-600/70" style={{ width: `${pctDraw}%` }} />
                <div className={cn("h-full", bBarColor)} style={{ width: `${pctB}%` }} />
              </div>
              {pctDraw > 0 && (
                <div className="text-center text-[9px] tabular-nums text-zinc-500">
                  {pctDraw}% draw
                </div>
              )}
            </>
          );
        })()}
        {isDraw ? (
          <div className="text-center text-[12px] font-semibold text-yellow-500/80">Draw</div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-1 text-[12px]">
              <span className={cn("truncate", slot1Wins ? "font-semibold text-green-400" : "text-zinc-400")}>
                {slot1Wins && "🏆 "}{unit1Name}
              </span>
              <span className={cn("truncate text-right", slot2Wins ? "font-semibold text-green-400" : "text-zinc-400")}>
                {unit2Name}{slot2Wins && " 🏆"}
              </span>
            </div>
            {winnerUnits != null && (
              <div className="text-center text-[11px] text-zinc-400">
                <span className="font-medium text-green-400">{winnerUnits}</span>
                {(slot1Wins ? multA : multB) != null && (
                  <span> of {slot1Wins ? multA : multB}</span>
                )}{" "}
                units left
              </div>
            )}
            {hpPct != null && (
              <>
                <div className="text-center text-[9px] font-semibold uppercase tracking-widest text-zinc-500">
                  HP remaining
                </div>
                <div className="flex items-end justify-between gap-1 text-[11px]">
                  <span className="flex min-w-0 items-baseline gap-1">
                    {slot1Wins && <>
                      <span className="font-bold tabular-nums text-green-400">{hpPct}%</span>
                      <span className="truncate text-[10px] text-zinc-400">{unit1Name}</span>
                    </>}
                  </span>
                  <span className="font-bold tabular-nums text-green-400">{Math.round(winnerHp!)} HP</span>
                  <span className="flex min-w-0 items-baseline gap-1">
                    {slot2Wins && <>
                      <span className="truncate text-right text-[10px] text-zinc-400">{unit2Name}</span>
                      <span className="font-bold tabular-nums text-green-400">{hpPct}%</span>
                    </>}
                  </span>
                </div>
                <div className="relative flex h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="absolute h-full rounded-full bg-green-500/70"
                    style={{
                      width: `${hpPct}%`,
                      left: slot1Wins ? 0 : undefined,
                      right: slot2Wins ? 0 : undefined,
                    }}
                  />
                </div>
              </>
            )}
            {loserUnitsToWin != null && (
              <>
                <div className="text-center text-[11px] text-zinc-400">
                  <span className="text-amber-300/90 font-medium">{loserUnitsToWin}</span> <span className="text-amber-300/90 font-medium">{loserName}</span> to win
                </div>
                <div className="flex items-center justify-center gap-1">
                  {Array.from({ length: Math.min(loserUnitsToWin, 7) }).map((_, i) => (
                    <SoldierChip key={i} />
                  ))}
                  {loserUnitsToWin > 7 && (
                    <span className="text-[9px] text-amber-500/60">+{loserUnitsToWin - 7}</span>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface SlotPanelProps {
  slot: Slot;
  scale?: number;
  /** If provided, the header becomes a drag handle (primary slot only). */
  onMovePointerDown?: (e: React.PointerEvent) => void;
  civLocked?: boolean;
  onToggleCivLock?: () => void;
  /** VS button — triggers combat simulation mode. */
  onVsClick?: () => void;
  vsActive?: boolean;
  drawerStorageKey?: string;
  /** Other slot — enables versus stat comparison colors on the card. */
  compareSlot?: Slot;
  /** When true, the civ-lock tooltip refers to the opponent rather than the streamer. */
  opponentMode?: boolean;
  /** VS combat result for this slot — HP remaining (winner) or units to win (loser). */
  vsInfo?: VSSlotInfo;
}

// Opponent stats for the versus comparison — mirrors the Sandbox's
// stats1/stats2: combat stats from modifiedStats, cost/pop/time from the raw
// age-selected variation.
function buildCompareStats(compareSlot?: Slot): CompareStats | undefined {
  if (!compareSlot?.unit) return undefined;
  const variation: any = compareSlot.variation ?? compareSlot.unit;
  const stats = compareSlot.modifiedStats;
  return {
    hp: stats.hitpoints * (stats.hpStartFraction ?? 1),
    attack: Math.max(stats.meleeAttack, stats.rangedAttack, stats.siegeAttack || 0),
    meleeArmor: stats.meleeArmor,
    rangedArmor: stats.rangedArmor,
    speed: stats.moveSpeed,
    attackSpeed: stats.attackSpeed || 0,
    maxRange: stats.maxRange || 0,
    cost: getTotalCost(variation),
    population: variation?.costs?.popcap,
    productionTime: variation?.costs?.time,
  };
}

export function SlotPanel({
  slot,
  scale = 1,
  onMovePointerDown,
  civLocked = false,
  onToggleCivLock,
  onVsClick,
  vsActive = false,
  drawerStorageKey = DRAWER_HEIGHT_KEY,
  compareSlot,
  opponentMode = false,
  vsInfo,
}: SlotPanelProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [civPickerOpen, setCivPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [civSearch, setCivSearch] = useState("");
  const [openCategories, setOpenCategories] = useState<Set<string>>(() => new Set());

  // Clamp counter-tech stacks to the tiers available at the selected age.
  const { techs: slotTechs, activeTechnologies: slotActiveTechs, selectedAge: slotAge, toggleTechnology } = slot;
  useEffect(() => {
    const families = new Map<string, any[]>();
    for (const t of slotTechs) {
      if (!getTechnologyTier(t)) continue;
      const base = getTechnologyBaseName(t.displayClasses[0]);
      const arr = families.get(base);
      if (arr) arr.push(t);
      else families.set(base, [t]);
    }
    for (const tiers of families.values()) {
      tiers.sort((a, b) => (getTechnologyTier(a)?.tier ?? 0) - (getTechnologyTier(b)?.tier ?? 0));
      const first = tiers[0];
      if (first.counterMax === undefined) continue;
      const activeIdx = tiers.findIndex((t) => slotActiveTechs.has(t.id));
      if (activeIdx === -1) continue;
      const available = tiers.filter((t) => t.minAge <= slotAge).length;
      const max = Math.min(first.counterMax ?? tiers.length, available);
      if (activeIdx + 1 > max) toggleTechnology(max === 0 ? tiers[activeIdx].id : tiers[max - 1].id);
    }
  }, [slotAge, slotActiveTechs, slotTechs, toggleTechnology]);

  // User-adjustable drawer height, persisted per slot.
  const [drawerHeight, setDrawerHeight] = useState<number>(() => {
    const saved = Number(localStorage.getItem(drawerStorageKey));
    return saved >= DRAWER_MIN_HEIGHT ? saved : 320;
  });
  useEffect(() => {
    try { localStorage.setItem(drawerStorageKey, String(drawerHeight)); } catch { /* sandboxed iframe */ }
  }, [drawerHeight, drawerStorageKey]);

  const drawerGesture = useRef<{ py: number; base: number; scale: number } | null>(null);
  const onDrawerResize = useCallback((e: PointerEvent) => {
    const g = drawerGesture.current;
    if (!g) return;
    const delta = (e.clientY - g.py) / (g.scale || 1);
    setDrawerHeight(clamp(g.base + delta, DRAWER_MIN_HEIGHT, DRAWER_MAX_HEIGHT));
  }, []);
  const endDrawerResize = useCallback(() => {
    drawerGesture.current = null;
    window.removeEventListener("pointermove", onDrawerResize);
  }, [onDrawerResize]);
  const startDrawerResize = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      drawerGesture.current = { py: e.clientY, base: drawerHeight, scale };
      window.addEventListener("pointermove", onDrawerResize);
      window.addEventListener("pointerup", endDrawerResize, { once: true });
    },
    [drawerHeight, scale, onDrawerResize, endDrawerResize],
  );

  const techBtnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close open pickers when the user clicks anywhere outside this slot panel.
  useEffect(() => {
    if (!pickerOpen && !civPickerOpen) return;
    const handler = (e: PointerEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      setPickerOpen(false);
      setCivPickerOpen(false);
      setSearch("");
      setCivSearch("");
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [pickerOpen, civPickerOpen]);

  const effectiveDrawerMaxHeight = (() => {
    if (!techBtnRef.current) return drawerHeight;
    const r = techBtnRef.current.getBoundingClientRect();
    const resizeBarScreenPx = 20 * scale;
    const available = window.innerHeight - r.bottom - resizeBarScreenPx;
    return Math.min(drawerHeight, Math.max(DRAWER_MIN_HEIGHT, available / scale));
  })();

  const civ = CIVILIZATIONS.find((c) => c.abbr === slot.selectedCiv);
  const source = slot.variation ?? slot.unit;
  const isVariation = !!slot.variation;
  const modified = source
    ? buildModifiedVariation(source, slot.modifiedStats, {
      baseId: isVariation ? (source as any).baseId : (source as any).id,
      activeTechnologies: slot.activeTechnologies,
      activeAbilities: slot.activeAbilities,
      abilityCounters: slot.abilityCounters,
      selectedAge: slot.selectedAge,
      secondaryWeapons: slot.secondaryWeapons,
      applyCostMultiplier: true,
    })
    : null;

  const pickUnit = (id: string) => {
    if (id === "desert-raider_cavalry") {
      slot.setUnit(slot.filteredUnits.find((u) => u.id === "desert-raider") || null, "ability-desert-raider-blade");
    } else {
      slot.setUnit(slot.filteredUnits.find((u) => u.id === id) || null);
    }
    setPickerOpen(false);
    setSearch("");
  };

  const q = search.trim().toLowerCase();

  return (
    <div ref={panelRef} className="relative w-[260px]">
      <div className="relative overflow-hidden rounded-lg border border-amber-500/30 bg-zinc-950/65 text-zinc-100 shadow-2xl ring-1 ring-black/30 backdrop-blur-md">
        {/* Header: drag handle when primary, static header when versus */}
        <div
          onPointerDown={onMovePointerDown}
          className={cn(
            "flex touch-none select-none items-center gap-2 border-b border-amber-500/15 bg-zinc-900/70 px-2",
            onMovePointerDown ? "cursor-move py-3" : "cursor-default py-1",
          )}
          title={onMovePointerDown ? "Move panel" : undefined}
        >
          <button
            type="button"
            disabled={civLocked}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() =>
              setCivPickerOpen((v) => {
                const next = !v;
                if (next) setPickerOpen(false);
                if (!next) setCivSearch("");
                return next;
              })
            }
            className={cn(
              "flex items-center gap-2 rounded px-1 py-0.5 transition-colors",
              civLocked ? "cursor-default opacity-60" : "hover:bg-white/10",
              civPickerOpen && "bg-amber-500/15",
            )}
            title={civLocked ? `Civilization follows the ${opponentMode ? "opponent" : "streamer"} automatically` : "Change civilization"}
          >
            {civ ? (
              <>
                <img src={assetUrl(civ.flagPath)} alt={civ.name} className="h-3.5 w-5 shrink-0 rounded-sm object-cover" />
                <span className="text-xs font-medium text-zinc-300">{civ.name}</span>
              </>
            ) : (
              <span className="text-xs text-zinc-500">{slot.selectedCiv}</span>
            )}
            <ChevronDown className={cn("h-3 w-3 text-zinc-500", civLocked && "invisible")} />
          </button>

          {onToggleCivLock && (
            <button
              type="button"
              role="switch"
              aria-checked={civLocked}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onToggleCivLock}
              className="flex h-6 shrink-0 items-center gap-1.5 rounded px-1 transition-colors hover:bg-white/10"
              title={
                civLocked
                  ? `Auto: civilization follows the ${opponentMode ? "opponent" : "streamer"} — click to pick freely`
                  : `Manual civilization — click to auto-follow the ${opponentMode ? "opponent" : "streamer"}`
              }
            >
              <span className={cn("text-[10px] font-medium", civLocked ? "text-amber-400" : "text-zinc-500")}>
                {opponentMode ? "Opponent" : "Streamer"}
              </span>
              <span
                className={cn(
                  "relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors",
                  civLocked ? "bg-amber-500" : "bg-zinc-600",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-2.5 w-2.5 rounded-full bg-white transition-transform",
                    civLocked ? "translate-x-3" : "translate-x-0.5",
                  )}
                />
              </span>
            </button>
          )}

          {onMovePointerDown && <GripHorizontal className="ml-auto h-3.5 w-3.5 text-zinc-600" />}

        </div>

        {slot.unit && modified ? (
          <>
            <CompactUnitCard
              modified={modified}
              base={source}
              name={slot.unit.name}
              icon={(modified as any).icon ?? (slot.unit as any).icon}
              civs={(modified as any).civs ?? slot.unit.civs ?? []}
              availableAges={getAvailableAges(slot.unit.id, slot.selectedCiv)}
              selectedAge={slot.selectedAge}
              onAgeChange={slot.setSelectedAge}
              onNameClick={() => setPickerOpen((v) => !v)}
              pickerOpen={pickerOpen}
              bonusDamage={slot.modifiedStats.bonusDamage}
              secondaryWeapons={modified.secondaryWeapons ?? slot.secondaryWeapons}
              maxHpBonusFraction={slot.modifiedStats.maxHpBonusFraction ?? 0}
              onVsClick={onVsClick}
              vsActive={vsActive}
              compare={buildCompareStats(compareSlot)}
              vsInfo={vsInfo}
            />

            <button
              ref={techBtnRef}
              type="button"
              aria-pressed={drawerOpen}
              onClick={() => setDrawerOpen((v) => !v)}
              className={cn(
                "flex w-full items-center justify-between border-t border-amber-500/20 px-3 py-2 text-sm font-semibold transition-colors",
                drawerOpen ? "bg-amber-500/10 text-amber-300" : "text-amber-200 hover:bg-white/5",
              )}
            >
              <span className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-amber-400/80" />
                Technologies &amp; abilities
              </span>
              {drawerOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {drawerOpen && (
              <>
                <div
                  className="overflow-y-auto border-t border-amber-500/10 bg-black/20 p-3"
                  style={{ maxHeight: effectiveDrawerMaxHeight }}
                >
                  <CompactLoadout
                    technologies={slot.techs}
                    activeTechnologies={slot.activeTechnologies}
                    onToggleTech={slot.toggleTechnology}
                    lockedTechnologies={slot.lockedTechnologies}
                    selectedCiv={slot.selectedCiv}
                    selectedAge={slot.selectedAge}
                    unitMinAge={slot.unitMinAge}
                    fullUpgradeAge={slot.fullUpgradeAge}
                    onApplyFullUpgrade={slot.applyFullUpgrade}
                    onReset={slot.resetTechnologies}
                    abilities={slot.abilities}
                    activeAbilities={slot.activeAbilities}
                    onToggleAbility={slot.toggleAbility}
                    lockedAbilities={slot.lockedAbilities}
                    abilityCounters={slot.abilityCounters}
                    onIncrement={slot.incrementAbility}
                    onDecrement={slot.decrementAbility}
                    onSetCounter={slot.setAbilityCounter}
                  />
                </div>
                <div
                  onPointerDown={startDrawerResize}
                  className="flex cursor-ns-resize touch-none select-none items-center justify-center border-t border-amber-500/15 bg-zinc-900/70 py-0.5 text-zinc-500 hover:text-zinc-300"
                  title="Resize section"
                >
                  <GripHorizontal className="h-3 w-3" />
                </div>
              </>
            )}
          </>
        ) : (
          <div className="p-4">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex w-full items-center justify-between rounded-md border border-amber-500/30 bg-black/30 px-3 py-2 text-sm text-amber-200 hover:border-amber-500/60"
            >
              Select a unit
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Civ dropdown — outside overflow-hidden so it can overlap the panel border. */}
      {civPickerOpen && (
        <div className="absolute inset-x-0 top-8 z-50 flex max-h-[50vh] flex-col rounded-b-md border border-amber-500/30 bg-zinc-950/98 shadow-2xl backdrop-blur">
          <div className="flex items-center gap-2 border-b border-amber-500/15 px-2 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            <input
              autoFocus
              value={civSearch}
              onChange={(e) => setCivSearch(e.target.value)}
              placeholder="Search civilization…"
              className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
            />
          </div>
          <div className="overflow-y-auto">
            {CIVILIZATIONS.filter((c) =>
              !civSearch.trim() || c.name.toLowerCase().includes(civSearch.trim().toLowerCase())
            ).map((c) => (
              <button
                key={c.abbr}
                type="button"
                onClick={() => {
                  slot.setSelectedCiv(c.abbr);
                  slot.setUnit(null);
                  setCivPickerOpen(false);
                  setCivSearch("");
                  setPickerOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-amber-500/15",
                  c.abbr === slot.selectedCiv ? "text-amber-300" : "text-zinc-200",
                )}
              >
                <img src={assetUrl(c.flagPath)} alt="" className="h-4 w-6 shrink-0 rounded-sm object-cover" />
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Unit picker — anchored under the header. */}
      {pickerOpen && (
        <div className="absolute inset-x-2 top-14 z-50 flex max-h-[60vh] flex-col overflow-hidden rounded-md border border-amber-500/40 bg-zinc-950/95 shadow-2xl backdrop-blur">
          <div className="flex items-center gap-2 border-b border-amber-500/15 px-2 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search unit…"
              className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
            />
          </div>
          <div className="overflow-y-auto p-1">
            {CATEGORY_ORDER.map((cat) => {
              const units = (slot.categorizedUnits[cat] || [])
                .filter((u: AoE4Unit) => !q || u.name.toLowerCase().includes(q))
                .slice()
                .sort((a: AoE4Unit, b: AoE4Unit) => a.name.localeCompare(b.name));
              if (!units.length) return null;
              const isOpen = q ? true : openCategories.has(cat);
              const toggle = () => setOpenCategories((prev) => {
                const next = new Set(prev);
                next.has(cat) ? next.delete(cat) : next.add(cat);
                return next;
              });
              return (
                <div key={cat} className="mb-0.5">
                  <button
                    type="button"
                    onClick={toggle}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-white/5"
                  >
                    {CATEGORY_ICONS[cat] && (
                      <img src={CATEGORY_ICONS[cat]} alt="" className="h-5 w-5 shrink-0 object-contain opacity-80" />
                    )}
                    <span className="text-sm font-semibold text-amber-200">
                      {CATEGORY_LABELS[cat] ?? cat}
                    </span>
                    <span className="ml-auto text-[10px] text-zinc-500">{units.length}</span>
                    {isOpen
                      ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                      : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-500" />}
                  </button>
                  {isOpen && units.map((u: AoE4Unit) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => pickUnit(u.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-amber-500/15",
                        slot.unit?.id === u.id ? "text-amber-300" : "text-zinc-200",
                      )}
                    >
                      <img
                        src={assetUrl((u as any).icon)}
                        alt=""
                        className="h-6 w-6 shrink-0 object-contain opacity-90"
                      />
                      <span className="truncate">{u.name}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// UnitPanel — primary slot panel + resize grip.
// The versus panel is rendered independently in Overlay.tsx.
// ---------------------------------------------------------------------------

export default function UnitPanel({
  slot,
  scale = 1,
  onMovePointerDown,
  onResizePointerDown,
  civLocked = false,
  onToggleCivLock,
  onVsClick,
  vsActive,
  compareSlot,
  vsResult,
  sizeLock,
}: {
  slot: Slot;
  scale?: number;
  onMovePointerDown?: (e: React.PointerEvent) => void;
  onResizePointerDown?: (e: React.PointerEvent, handle?: ResizeHandle) => void;
  civLocked?: boolean;
  onToggleCivLock?: () => void;
  onVsClick?: () => void;
  vsActive?: boolean;
  compareSlot?: Slot;
  vsResult?: VSResultData;
  /** When provided, shows a lock toggle that ties both unit panels to one size. */
  sizeLock?: { locked: boolean; onToggle: () => void };
}) {
  const vsInfo1: VSSlotInfo | undefined = vsResult
    ? {
      hpRemaining: vsResult.winner === "attacker" ? vsResult.winnerHp : undefined,
      hpMax: vsResult.winner === "attacker" ? vsResult.winnerMaxHp : undefined,
      unitsToWin: vsResult.winner === "defender" ? vsResult.loserUnitsToWin : undefined,
    }
    : undefined;

  return (
    <div className="relative">
      <SlotPanel
        slot={slot}
        scale={scale}
        onMovePointerDown={onMovePointerDown}
        civLocked={civLocked}
        onToggleCivLock={onToggleCivLock}
        onVsClick={onVsClick}
        vsActive={vsActive}
        compareSlot={compareSlot}
        vsInfo={vsInfo1}
      />
      {onResizePointerDown && (
        <>
          <ResizeHandles onResizeStart={onResizePointerDown} />
          <ResizeGrip onPointerDown={onResizePointerDown} title="Resize panel" />
          {sizeLock && <SizeLockButton locked={sizeLock.locked} onToggle={sizeLock.onToggle} />}
        </>
      )}
    </div>
  );
}
