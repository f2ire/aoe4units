import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { Swords } from "lucide-react";
import "@/index.css";
import { cn } from "@/lib/utils";
import { useUnitSlot } from "@/hooks/useUnitSlot";
import UnitPanel, { SlotPanel, VSCard, ResizeGrip, ResizeHandles, SizeLockButton, type VSResultData, type VSSlotInfo, type MultiUnitModelKey } from "./UnitPanel";
import { useAoe4WorldDetection } from "./useAoe4WorldDetection";
import { useDraggablePanel, DEFAULT_PANEL_X, PANEL_BASE_WIDTH, clampPanel } from "./useDraggablePanel";
import {
  computeVersus,
  computeLoserUnitsToWin,
  computeVersusAtEqualCost,
  computeVersusKitingFocusFire,
  computeVersusKitingBatchesMC,
  computeVersusAtEqualCostKitingFocusFire,
  computeVersusAtEqualCostKitingBatchesMC,
  aggregatedDPSModel,
  focusFireModel,
  focusFireAsymmetricModel,
  focusFireBatchesMCModel,
  focusFireBatchesMCAsymmetricModel,
  type MultiUnitModel,
  type VersusResult,
} from "@/lib/combat";
import { getPrimaryWeapon, getTotalCost } from "@/data/unified-units";
import { buildModifiedVariation, getChargeBonus } from "@/lib/buildVariation";

const STORE_KEY = "aoe4-overlay-panel-v3";
const STORE_KEY_VS = "aoe4-overlay-panel-vs-v2";
const STORE_KEY_VS_STATS = "aoe4-overlay-panel-vs-stats-v2";
const CIV_LOCK_KEY = "aoe4-overlay-civ-locked";
const OPP_CIV_LOCK_KEY = "aoe4-overlay-opp-civ-locked";
const SIZE_LOCK_KEY = "aoe4-overlay-size-locked";

const VS_CARD_BASE_WIDTH = 185;
// Extra scale applied to the VS stats card so it renders larger than its
// viewport-responsive default without affecting the unit panels.
const VS_STATS_SCALE_FACTOR = 1.25;

// Default x for the versus panel: primary panel + VS card + gaps.
const VS_DEFAULT_X = DEFAULT_PANEL_X + PANEL_BASE_WIDTH + 8 + VS_CARD_BASE_WIDTH + 8;

const AUTO_SELECT_ORDER = [
  "jeanne", "melee_infantry", "ranged", "cavalry", "siege",
  "mercenary", "khaganate", "monk", "ship", "other",
];

const LOGO_KEY = "aoe4-overlay-logo-v1";
const LOGO_SIZE = 36; // h-9 w-9
const LOGO_DRAG_THRESHOLD = 5;

// Drag-to-move for the toggle logo. A press only becomes a drag past
// LOGO_DRAG_THRESHOLD; the click that follows a drag is swallowed by the
// caller via wasDragged(). Position persisted as viewport fractions.
// With no saved drag, fracRef stays null and the default (left edge,
// vertically centered) is recomputed from the live viewport on every layout —
// the Twitch iframe can be 0×0 at mount, so fractions must never be derived
// from the initial dimensions.
function useDraggableLogo() {
  const fracRef = useRef<{ fx: number; fy: number } | null | undefined>(undefined);
  if (fracRef.current === undefined) {
    let saved: { fx?: number; fy?: number } | null = null;
    try { saved = JSON.parse(localStorage.getItem(LOGO_KEY) || "null"); } catch { /* corrupted storage */ }
    fracRef.current = saved && Number.isFinite(saved.fx) && Number.isFinite(saved.fy)
      ? { fx: saved.fx!, fy: saved.fy! }
      : null;
  }

  const layout = useCallback(() => {
    const frac = fracRef.current;
    if (!frac) {
      return {
        x: 8,
        y: Math.max(0, Math.round((window.innerHeight - LOGO_SIZE) / 2)),
      };
    }
    return {
      x: clampPanel(Math.round(frac.fx * window.innerWidth), 0, Math.max(0, window.innerWidth - LOGO_SIZE)),
      y: clampPanel(Math.round(frac.fy * window.innerHeight), 0, Math.max(0, window.innerHeight - LOGO_SIZE)),
    };
  }, []);

  const [pos, setPos] = useState(layout);
  const posRef = useRef(pos);
  posRef.current = pos;
  const dragged = useRef(false);

  useEffect(() => {
    const relayout = () => setPos(layout());
    window.addEventListener("resize", relayout);
    window.addEventListener("orientationchange", relayout);
    document.addEventListener("fullscreenchange", relayout);
    return () => {
      window.removeEventListener("resize", relayout);
      window.removeEventListener("orientationchange", relayout);
      document.removeEventListener("fullscreenchange", relayout);
    };
  }, [layout]);

  const startDrag = useCallback((e: React.PointerEvent) => {
    dragged.current = false;
    const start = { px: e.clientX, py: e.clientY, bx: posRef.current.x, by: posRef.current.y };
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - start.px;
      const dy = ev.clientY - start.py;
      if (!dragged.current && Math.hypot(dx, dy) < LOGO_DRAG_THRESHOLD) return;
      dragged.current = true;
      setPos({
        x: clampPanel(start.bx + dx, 0, Math.max(0, window.innerWidth - LOGO_SIZE)),
        y: clampPanel(start.by + dy, 0, Math.max(0, window.innerHeight - LOGO_SIZE)),
      });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      if (!dragged.current) return;
      if (window.innerWidth <= 0 || window.innerHeight <= 0) return;
      const p = posRef.current;
      fracRef.current = {
        fx: clampPanel(p.x / window.innerWidth, 0, 1),
        fy: clampPanel(p.y / window.innerHeight, 0, 1),
      };
      try { localStorage.setItem(LOGO_KEY, JSON.stringify(fracRef.current)); } catch { /* sandboxed iframe */ }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  }, []);

  const wasDragged = useCallback(() => dragged.current, []);

  return { pos, startDrag, wasDragged };
}

function Overlay() {
  const slot = useUnitSlot();
  const slot2 = useUnitSlot();
  const [open, setOpen] = useState(true);
  const [vsOpen, setVsOpen] = useState(false);
  // Versus options — mirror the Sandbox's atEqualCost / allowKiting / model selector.
  const [atEqualCost, setAtEqualCost] = useState(false);
  const [allowKiting, setAllowKiting] = useState(false);
  const [multiUnitModelKey, setMultiUnitModelKey] = useState<MultiUnitModelKey>("focusFire");

  // Default multi-unit model: "Attack move" (focusFireBatchesMC) when both units are melee,
  // but "Target focus" (focusFire) as soon as either unit is ranged. Re-applied only when the
  // ranged makeup of the matchup changes, so a manual model choice persists within a given matchup.
  const rangedSrc1 = slot.variation ?? slot.unit;
  const rangedSrc2 = slot2.variation ?? slot2.unit;
  const hasRangedUnit = (!!rangedSrc1 && getPrimaryWeapon(rangedSrc1)?.type === "ranged") || (!!rangedSrc2 && getPrimaryWeapon(rangedSrc2)?.type === "ranged");
  useEffect(() => {
    setMultiUnitModelKey(hasRangedUnit ? "focusFire" : "focusFireBatchesMC");
  }, [hasRangedUnit]);

  const logo = useDraggableLogo();
  const primary = useDraggablePanel(STORE_KEY, DEFAULT_PANEL_X);
  const versus = useDraggablePanel(STORE_KEY_VS, VS_DEFAULT_X);
  // VS stats card: its own scale with its own resize grip, so resizing
  // either unit card leaves it untouched (and vice versa).
  const vsStats = useDraggablePanel(STORE_KEY_VS_STATS, VS_DEFAULT_X);

  // Size lock: when on, both unit panels render at the primary's scale and the
  // versus panel's resize handle drives the primary — a single source of truth
  // keeps them the same size with no bidirectional sync.
  const [sizeLocked, setSizeLocked] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(SIZE_LOCK_KEY);
      return raw === null ? false : JSON.parse(raw) === true;
    } catch {
      return false;
    }
  });
  const primaryScaleRef = useRef(primary.panel.scale);
  primaryScaleRef.current = primary.panel.scale;
  const toggleSizeLock = useCallback(() => {
    setSizeLocked((v) => {
      const next = !v;
      // On unlock, keep the versus panel at the size it's currently shown at so
      // it doesn't snap back to a stale independent scale.
      if (!next) versus.setScale(primaryScaleRef.current, true);
      try { localStorage.setItem(SIZE_LOCK_KEY, JSON.stringify(next)); } catch { /* iframe */ }
      return next;
    });
  }, [versus]);

  // On every open, reset the versus panel to its default position adjacent to
  // the primary panel. Captures primary position at open time — no live follow.
  const primaryPanel = primary.panel;
  useEffect(() => {
    if (!vsOpen) return;
    versus.resetPanel({
      x: primaryPanel.x + Math.round((PANEL_BASE_WIDTH + VS_CARD_BASE_WIDTH) * primaryPanel.scale) + 16,
      y: primaryPanel.y,
      scale: primaryPanel.scale,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vsOpen]);

  const { detectedCiv, detectedOpponentCiv } = useAoe4WorldDetection();

  // Civ lock: pin the displayed civ to the streamer's detected civ (default on).
  const [civLocked, setCivLocked] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(CIV_LOCK_KEY);
      return raw === null ? true : JSON.parse(raw) === true;
    } catch {
      return true;
    }
  });
  const toggleCivLock = useCallback(() => {
    setCivLocked((v) => {
      const next = !v;
      try { localStorage.setItem(CIV_LOCK_KEY, JSON.stringify(next)); } catch { /* iframe */ }
      return next;
    });
  }, []);

  // Opponent civ lock: pin the versus panel to the opponent's detected civ (1v1 only).
  const [oppCivLocked, setOppCivLocked] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(OPP_CIV_LOCK_KEY);
      return raw === null ? true : JSON.parse(raw) === true;
    } catch {
      return true;
    }
  });
  const toggleOppCivLock = useCallback(() => {
    setOppCivLocked((v) => {
      const next = !v;
      try { localStorage.setItem(OPP_CIV_LOCK_KEY, JSON.stringify(next)); } catch { /* iframe */ }
      return next;
    });
  }, []);

  // Auto-select first unit on mount / civ change for each slot.
  const hasUnit = !!slot.unit;
  const selectedCiv = slot.selectedCiv;
  useEffect(() => {
    if (hasUnit) return;
    for (const cat of AUTO_SELECT_ORDER) {
      const units = (slot.categorizedUnits[cat] ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
      if (units.length > 0) { slot.setUnit(units[0]); return; }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnit, selectedCiv]);

  const hasUnit2 = !!slot2.unit;
  const selectedCiv2 = slot2.selectedCiv;
  useEffect(() => {
    if (hasUnit2) return;
    for (const cat of AUTO_SELECT_ORDER) {
      const units = (slot2.categorizedUnits[cat] ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
      if (units.length > 0) { slot2.setUnit(units[0]); return; }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnit2, selectedCiv2]);

  // While locked, keep the displayed civ pinned to the streamer's detected civ.
  useEffect(() => {
    if (!civLocked || !detectedCiv || slot.selectedCiv === detectedCiv) return;
    slot.setSelectedCiv(detectedCiv);
    slot.setUnit(null);
  }, [civLocked, detectedCiv, slot]);

  // While locked, keep the versus panel pinned to the opponent's detected civ (1v1 only).
  useEffect(() => {
    if (!oppCivLocked || !detectedOpponentCiv || slot2.selectedCiv === detectedOpponentCiv) return;
    slot2.setSelectedCiv(detectedOpponentCiv);
    slot2.setUnit(null);
  }, [oppCivLocked, detectedOpponentCiv, slot2]);

  // Versus panel resize grip ref — needed to stop propagation from reaching
  // the versus panel's drag handle.
  const vsResizeRef = useRef<HTMLDivElement>(null);

  // Combat VS result — computed only when the versus mode is open and both units loaded.
  let vsResult: VSResultData | undefined;
  let equalCostDisabled = false;
  let equalCostDisabledTitle: string | undefined;
  if (vsOpen && slot.unit && slot2.unit) {
    try {
      const src1 = (slot.variation ?? slot.unit) as any;
      const src2 = (slot2.variation ?? slot2.unit) as any;
      // Versus blocks apply cost multipliers; equal-cost blocks don't (same as Sandbox).
      const mod1 = buildModifiedVariation(src1, slot.modifiedStats, {
        baseId: slot.variation ? src1.baseId : src1.id,
        activeTechnologies: slot.activeTechnologies,
        activeAbilities: slot.activeAbilities,
        abilityCounters: slot.abilityCounters,
        selectedAge: slot.selectedAge,
        secondaryWeapons: slot.secondaryWeapons,
        applyCostMultiplier: !atEqualCost,
      });
      const mod2 = buildModifiedVariation(src2, slot2.modifiedStats, {
        baseId: slot2.variation ? src2.baseId : src2.id,
        activeTechnologies: slot2.activeTechnologies,
        activeAbilities: slot2.activeAbilities,
        abilityCounters: slot2.abilityCounters,
        selectedAge: slot2.selectedAge,
        secondaryWeapons: slot2.secondaryWeapons,
        applyCostMultiplier: !atEqualCost,
      });
      const ms1 = slot.modifiedStats as any;
      const ms2 = slot2.modifiedStats as any;
      const chargeA = getChargeBonus(src1, slot.activeAbilities, slot.selectedAge, slot.activeTechnologies, ms1.chargeMultiplier, ms1.meleeAttack, slot.abilityCounters, ms1.rangedAttack, ms1.chargeChange);
      const chargeB = getChargeBonus(src2, slot2.activeAbilities, slot2.selectedAge, slot2.activeTechnologies, ms2.chargeMultiplier, ms2.meleeAttack, slot2.abilityCounters, ms2.rangedAttack, ms2.chargeChange);
      const ab1 = [...slot.activeAbilities];
      const ab2 = [...slot2.activeAbilities];

      // Kiting start distance: fixed at the max range of the two units (Sandbox default).
      const startDistance = Math.max(slot.modifiedStats.maxRange || 0, slot2.modifiedStats.maxRange || 0);

      const cost1 = getTotalCost(mod1);
      const cost2 = getTotalCost(mod2);
      equalCostDisabled = (cost1 > 0 && cost2 > 0 && cost1 === cost2) || cost1 === 0 || cost2 === 0;
      equalCostDisabledTitle = cost1 === 0 || cost2 === 0
        ? "A unit has no cost"
        : equalCostDisabled ? "Units have the same cost" : undefined;

      let result: VersusResult;
      let multipliers: { multA: number; multB: number; totalCostA: number; totalCostB: number } | undefined;
      const useEqualCost = atEqualCost && !equalCostDisabled;
      if (useEqualCost) {
        if (allowKiting && multiUnitModelKey === "focusFire") {
          const r = computeVersusAtEqualCostKitingFocusFire(mod1, mod2, ab1, ab2, chargeA, chargeB, startDistance);
          result = r;
          multipliers = r.multipliers;
        } else if (allowKiting && multiUnitModelKey === "focusFireBatchesMC") {
          const r = computeVersusAtEqualCostKitingBatchesMC(mod1, mod2, ab1, ab2, chargeA, chargeB, startDistance);
          result = r;
          multipliers = r.multipliers;
        } else {
          const isRanged1 = getPrimaryWeapon(mod1)?.type === "ranged";
          const isRanged2 = getPrimaryWeapon(mod2)?.type === "ranged";
          const model: MultiUnitModel =
            multiUnitModelKey === "focusFire" ? (isRanged1 !== isRanged2 ? focusFireAsymmetricModel : focusFireModel) :
              multiUnitModelKey === "focusFireBatchesMC" ? (isRanged1 !== isRanged2 ? focusFireBatchesMCAsymmetricModel : focusFireBatchesMCModel) :
                aggregatedDPSModel;
          const r = computeVersusAtEqualCost(mod1, mod2, ab1, ab2, chargeA, chargeB, allowKiting, startDistance, model);
          result = r;
          multipliers = r.multipliers;
        }
      } else if (allowKiting && multiUnitModelKey === "focusFire") {
        result = computeVersusKitingFocusFire(mod1, mod2, ab1, ab2, chargeA, chargeB, startDistance);
      } else if (allowKiting && multiUnitModelKey === "focusFireBatchesMC") {
        result = computeVersusKitingBatchesMC(mod1, mod2, ab1, ab2, chargeA, chargeB, startDistance);
      } else {
        result = computeVersus(mod1, mod2, ab1, ab2, chargeA, chargeB, allowKiting, startDistance);
      }

      let loserUnitsToWin: number | undefined;
      if (!useEqualCost && result.winner !== "draw") {
        try { loserUnitsToWin = computeLoserUnitsToWin(result, mod1, mod2); } catch { /* ignore */ }
      }

      // Winner group units remaining (equal-cost): MC median when available, like Sandbox.
      const md = result.mcDistribution;
      const winnerUnits = result.winner === "attacker"
        ? (md?.whenAWins?.unitsMedian ?? result.winnerUnitsRemaining)
        : result.winner === "defender"
          ? (md?.whenBWins?.unitsMedian ?? result.winnerUnitsRemaining)
          : undefined;

      vsResult = {
        winner: result.winner,
        unit1Name: slot.unit.name,
        unit2Name: slot2.unit.name,
        ttk1: result.attacker.timeToKill,
        ttk2: result.defender.timeToKill,
        dps1: result.attacker.dps,
        dps2: result.defender.dps,
        hitsToKill1: result.attacker.hitsToKill,
        hitsToKill2: result.defender.hitsToKill,
        dpsPerCost1: result.attacker.dpsPerCost,
        dpsPerCost2: result.defender.dpsPerCost,
        // In equal-cost mode the HP bar (vs single-unit max HP) is meaningless — show units left instead.
        winnerHp: useEqualCost ? undefined : result.winnerHpRemaining,
        winnerMaxHp: useEqualCost ? undefined : result.winner === "attacker" ? slot.modifiedStats.hitpoints : result.winner === "defender" ? slot2.modifiedStats.hitpoints : undefined,
        loserUnitsToWin,
        multA: multipliers?.multA,
        multB: multipliers?.multB,
        winnerUnits: useEqualCost ? winnerUnits : undefined,
        winRateA: md?.winRateA,
        winRateB: md?.winRateB,
        drawRate: md?.drawRate,
      };
    } catch {
      // combat computation failed — no result displayed
    }
  }

  // VS card follows the primary panel horizontally (reactive to drag).
  const vsCardX = primary.panel.x + Math.round(PANEL_BASE_WIDTH * primary.panel.scale) + 8;
  const vsCardY = primary.panel.y;

  // The versus panel is pinned at a fixed offset from the primary panel
  // (derived position, never independent). Dragging either handle moves the primary only.
  // The VS card has its own independent scale (vsStats) so resizing either unit card
  // leaves the vs stats untouched.
  const vsStatsScale = vsStats.panel.scale * VS_STATS_SCALE_FACTOR;
  const versusRenderX = vsCardX + Math.round(VS_CARD_BASE_WIDTH * vsStatsScale) + 8;
  const versusRenderY = primary.panel.y;

  // When sizes are locked, the versus panel mirrors the primary's scale and its
  // resize handle drives the primary instead of its own scale.
  const versusScale = sizeLocked ? primary.panel.scale : versus.panel.scale;
  const versusResize = sizeLocked ? primary.startResize : versus.startResize;

  const vsInfo2: VSSlotInfo | undefined = vsResult
    ? {
        hpRemaining: vsResult.winner === "defender" ? vsResult.winnerHp : undefined,
        hpMax: vsResult.winner === "defender" ? vsResult.winnerMaxHp : undefined,
        unitsToWin: vsResult.winner === "attacker" ? vsResult.loserUnitsToWin : undefined,
      }
    : undefined;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      {/* Toggle button */}
      <button
        type="button"
        aria-label={open ? "Close unit panel" : "Open unit panel"}
        aria-pressed={open}
        onClick={() => { if (logo.wasDragged()) return; setOpen((v) => !v); }}
        onPointerDown={logo.startDrag}
        className={cn(
          "pointer-events-auto absolute flex h-9 w-9 touch-none items-center justify-center rounded-md text-white/80 shadow-lg transition-colors hover:bg-white/10 hover:text-white",
          open ? "bg-amber-500 text-black hover:bg-amber-500" : "bg-black/55 backdrop-blur-sm",
        )}
        style={{ left: logo.pos.x, top: logo.pos.y }}
      >
        <Swords className="h-5 w-5" />
      </button>

      {/* Primary panel */}
      <div
        ref={primary.panelRef}
        className={cn(
          "pointer-events-auto absolute transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        style={{
          left: primary.panel.x,
          top: primary.panel.y,
          transform: `scale(${primary.panel.scale})`,
          transformOrigin: "top left",
          visibility: open ? undefined : "hidden",
        }}
        aria-hidden={!open}
      >
        <UnitPanel
          slot={slot}
          scale={primary.panel.scale}
          onMovePointerDown={primary.startMove}
          onResizePointerDown={primary.startResize}
          civLocked={civLocked}
          onToggleCivLock={toggleCivLock}
          onVsClick={() => setVsOpen((v) => !v)}
          vsActive={vsOpen}
          compareSlot={vsOpen ? slot2 : undefined}
          vsResult={vsResult}
          sizeLock={vsOpen ? { locked: sizeLocked, onToggle: toggleSizeLock } : undefined}
        />
      </div>

      {/* VS card — follows the primary panel, shown only in versus mode (and while the overlay is open) */}
      {open && vsOpen && vsResult && (
        <div
          ref={vsStats.panelRef}
          className="pointer-events-none absolute"
          style={{
            left: vsCardX,
            top: vsCardY,
            transform: `scale(${vsStatsScale})`,
            transformOrigin: "top left",
          }}
        >
          <div className="relative">
            <VSCard
              {...vsResult}
              controls={{
                atEqualCost,
                onToggleEqualCost: () => setAtEqualCost((v) => !v),
                equalCostDisabled,
                equalCostDisabledTitle,
                allowKiting,
                onToggleKiting: () => setAllowKiting((v) => !v),
                modelKey: multiUnitModelKey,
                onModelChange: setMultiUnitModelKey,
              }}
            />
            {/* Resize handles + grip for the VS stats card */}
            <ResizeHandles onResizeStart={vsStats.startResize} className="pointer-events-auto" />
            <ResizeGrip
              onPointerDown={vsStats.startResize}
              title="Resize VS stats"
              className="pointer-events-auto"
            />
          </div>
        </div>
      )}

      {/* Versus panel — pinned next to the VS card (hidden while the overlay is closed) */}
      {open && vsOpen && (
        <div
          ref={versus.panelRef}
          className="pointer-events-auto absolute"
          style={{
            left: versusRenderX,
            top: versusRenderY,
            transform: `scale(${versusScale})`,
            transformOrigin: "top left",
          }}
        >
          <div className="relative">
            <SlotPanel
              slot={slot2}
              scale={versusScale}
              onMovePointerDown={primary.startMove}
              drawerStorageKey="aoe4-overlay-drawer-h-2"
              compareSlot={slot}
              civLocked={oppCivLocked}
              onToggleCivLock={toggleOppCivLock}
              opponentMode
              vsInfo={vsInfo2}
            />
            {/* Resize handles + grip for the versus panel */}
            <ResizeHandles onResizeStart={versusResize} />
            <ResizeGrip
              gripRef={vsResizeRef}
              onPointerDown={versusResize}
              title="Resize versus panel"
            />
            <SizeLockButton locked={sizeLocked} onToggle={toggleSizeLock} />
          </div>
        </div>
      )}
    </div>
  );
}

function Root() {
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    const ext = window.Twitch?.ext;
    if (!ext) return;
    ext.onContext((ctx) => {
      const isDark = (ctx.theme ?? "dark") === "dark";
      document.documentElement.classList.toggle("dark", isDark);
    });
  }, []);

  return <Overlay />;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
