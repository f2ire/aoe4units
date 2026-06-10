import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { Swords } from "lucide-react";
import "@/index.css";
import { cn } from "@/lib/utils";
import { useUnitSlot } from "@/hooks/useUnitSlot";
import UnitPanel, { SlotPanel, VSCard, type VSResultData, type VSSlotInfo, type MultiUnitModelKey } from "./UnitPanel";
import { useAoe4WorldDetection } from "./useAoe4WorldDetection";
import { useDraggablePanel, DEFAULT_PANEL_X, PANEL_BASE_WIDTH } from "./useDraggablePanel";
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

const STORE_KEY = "aoe4-overlay-panel-v2";
const STORE_KEY_VS = "aoe4-overlay-panel-vs-v1";
const STORE_KEY_VS_STATS = "aoe4-overlay-panel-vs-stats-v1";
const CIV_LOCK_KEY = "aoe4-overlay-civ-locked";
const OPP_CIV_LOCK_KEY = "aoe4-overlay-opp-civ-locked";

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

function Overlay() {
  const slot = useUnitSlot();
  const slot2 = useUnitSlot();
  const [open, setOpen] = useState(true);
  const [panelMode, setPanelMode] = useState<null | "compare" | "versus">(null);
  // Versus options — mirror the Sandbox's atEqualCost / allowKiting / model selector.
  const [atEqualCost, setAtEqualCost] = useState(false);
  const [allowKiting, setAllowKiting] = useState(false);
  const [multiUnitModelKey, setMultiUnitModelKey] = useState<MultiUnitModelKey>("focusFire");

  const panelOpen = panelMode !== null;

  const primary = useDraggablePanel(STORE_KEY, DEFAULT_PANEL_X);
  const versus = useDraggablePanel(STORE_KEY_VS, VS_DEFAULT_X);
  // VS stats card: its own scale, never wired to a resize grip, so resizing
  // either unit card leaves it untouched (stays at the viewport-responsive default).
  const vsStats = useDraggablePanel(STORE_KEY_VS_STATS, VS_DEFAULT_X);

  // On every open, reset the versus panel to its default position adjacent to
  // the primary panel. Captures primary position at open time — no live follow.
  const primaryPanel = primary.panel;
  useEffect(() => {
    if (!panelOpen) return;
    versus.resetPanel({
      x: primaryPanel.x + Math.round((PANEL_BASE_WIDTH + VS_CARD_BASE_WIDTH) * primaryPanel.scale) + 16,
      y: primaryPanel.y,
      scale: primaryPanel.scale,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen]);

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

  // Combat VS result — computed only when panelMode === 'versus' and both units loaded.
  let vsResult: VSResultData | undefined;
  let equalCostDisabled = false;
  let equalCostDisabledTitle: string | undefined;
  if (panelMode === "versus" && slot.unit && slot2.unit) {
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

  // Prevent rapid clicks from triggering Twitch's dblclick-to-fullscreen behavior.
  useEffect(() => {
    const handler = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("dblclick", handler, true);
    return () => document.removeEventListener("dblclick", handler, true);
  }, []);

  // VS card follows the primary panel horizontally (reactive to drag).
  const vsCardX = primary.panel.x + Math.round(PANEL_BASE_WIDTH * primary.panel.scale) + 8;
  const vsCardY = primary.panel.y;

  // In versus mode the versus panel is pinned at a fixed offset from the primary panel
  // (derived position, never independent). Dragging either handle moves the primary only.
  // The VS card has its own independent scale (vsStats) so resizing either unit card
  // leaves the vs stats untouched.
  const vsStatsScale = vsStats.panel.scale * VS_STATS_SCALE_FACTOR;
  const versusRenderX = panelMode === "versus"
    ? vsCardX + Math.round(VS_CARD_BASE_WIDTH * vsStatsScale) + 8
    : versus.panel.x;
  const versusRenderY = panelMode === "versus" ? primary.panel.y : versus.panel.y;

  const vsInfo2: VSSlotInfo | undefined = vsResult
    ? {
        hpRemaining: vsResult.winner === "defender" ? vsResult.winnerHp : undefined,
        hpMax: vsResult.winner === "defender" ? vsResult.winnerMaxHp : undefined,
        unitsToWin: vsResult.winner === "attacker" ? vsResult.loserUnitsToWin : undefined,
      }
    : undefined;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]" onDoubleClick={(e) => e.preventDefault()}>
      {/* Toggle button */}
      <button
        type="button"
        aria-label={open ? "Close unit panel" : "Open unit panel"}
        aria-pressed={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "pointer-events-auto absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-md text-white/80 shadow-lg transition-colors hover:bg-white/10 hover:text-white",
          open ? "bg-amber-500 text-black hover:bg-amber-500" : "bg-black/55 backdrop-blur-sm",
        )}
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
          onComparClick={() => setPanelMode((v) => (v === "compare" ? null : "compare"))}
          comparActive={panelMode === "compare"}
          onVsClick={() => setPanelMode((v) => (v === "versus" ? null : "versus"))}
          vsActive={panelMode === "versus"}
          compareSlot={panelOpen ? slot2 : undefined}
          vsResult={vsResult}
        />
      </div>

      {/* VS card — follows the primary panel, shown only in versus mode (and while the overlay is open) */}
      {open && panelMode === "versus" && vsResult && (
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
        </div>
      )}

      {/* Versus panel — independent position, independent drag/resize (hidden while the overlay is closed) */}
      {open && panelOpen && (
        <div
          ref={versus.panelRef}
          className="pointer-events-auto absolute"
          style={{
            left: versusRenderX,
            top: versusRenderY,
            transform: `scale(${versus.panel.scale})`,
            transformOrigin: "top left",
          }}
        >
          <div className="relative">
            <SlotPanel
              slot={slot2}
              scale={versus.panel.scale}
              onMovePointerDown={panelMode === "versus" ? primary.startMove : versus.startMove}
              onClose={() => setPanelMode(null)}
              drawerStorageKey="aoe4-overlay-drawer-h-2"
              compareSlot={slot}
              civLocked={oppCivLocked}
              onToggleCivLock={toggleOppCivLock}
              opponentMode
              vsInfo={vsInfo2}
            />
            {/* Resize grip for the versus panel */}
            <div
              ref={vsResizeRef}
              onPointerDown={versus.startResize}
              className="absolute bottom-0 right-0 z-20 h-3.5 w-3.5 cursor-nwse-resize touch-none"
              style={{ background: "linear-gradient(135deg, transparent 50%, rgba(245,158,11,0.7) 50%)" }}
              title="Resize versus panel"
            />
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
