import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  calculateEqualCostMultipliers,
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

// Counter abilities whose stack count tracks the on-field unit count (count1/count2).
// `useN: true` → counter = N (counts itself, e.g. inspiration stacks); otherwise → counter = N−1
// (nearby OTHER units, per the in-game "for every other unit" wording).
// Keyed by unit baseId. Kept in sync with the Sandbox's copy.
const COUNT_SYNCED_COUNTERS: Record<string, { abilityId: string; useN: boolean }> = {
  "lord-of-lancaster": { abilityId: "ability-lord-of-lancaster-inspiration", useN: true },
  "chevalier-confrere": { abilityId: "ability-knightly-brotherhood", useN: false },
  "templar-brother": { abilityId: "ability-rule-of-templars", useN: false },
  "atgeirmadr": { abilityId: "ability-stronger-together", useN: false },
};

// Upper bound of the "units to win" search. Past this the loser is reported as
// "More than 100" rather than showing a misleading count (same cap as the Sandbox).
const MAX_UNITS_TO_WIN = 100;

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
  // Closed by default: the viewer only sees the swords logo until they click it.
  const [open, setOpen] = useState(false);
  const [vsOpen, setVsOpen] = useState(false);
  // Versus options — mirror the Sandbox's unit counts / presets / allowKiting / model selector.
  // There is no `atEqualCost` boolean any more: the counts ARE the mode (1v1 = full-fidelity
  // path), and the Cost/Pop presets just fill those counts with a ratio.
  const [count1, setCount1] = useState(1);
  const [count2, setCount2] = useState(1);
  const [activePreset, setActivePreset] = useState<'cost' | 'pop' | null>(null);
  const [allowKiting, setAllowKiting] = useState(false);
  const [multiUnitModelKey, setMultiUnitModelKey] = useState<MultiUnitModelKey>("focusFire");

  // Multi-unit simulation kicks in as soon as either side has more than one unit.
  const isMultiUnit = count1 > 1 || count2 > 1;

  // Reset counts (and any preset) whenever either slot changes unit — mirrors setUnit
  // clearing techs/abilities.
  const unit1Id = slot.unit?.id;
  const unit2Id = slot2.unit?.id;
  useEffect(() => { setCount1(1); setActivePreset(null); }, [unit1Id]);
  useEffect(() => { setCount2(1); setActivePreset(null); }, [unit2Id]);

  // Sync count-driven counter abilities to the on-field unit count. Keyed on [count, unit] so a
  // manual edit on the ability is never overwritten — it only re-fires when the count or unit
  // changes. Always writes the resolved target, so a count drop back to 1 resets the counter.
  const baseId1 = slot.variation?.baseId || slot.unit?.id;
  const baseId2 = slot2.variation?.baseId || slot2.unit?.id;
  const setAbilityCounter1 = slot.setAbilityCounter;
  const setAbilityCounter2 = slot2.setAbilityCounter;
  useEffect(() => {
    const sync = COUNT_SYNCED_COUNTERS[baseId1];
    if (!sync) return;
    setAbilityCounter1(sync.abilityId, sync.useN ? count1 : count1 - 1);
  }, [count1, baseId1, setAbilityCounter1]);
  useEffect(() => {
    const sync = COUNT_SYNCED_COUNTERS[baseId2];
    if (!sync) return;
    setAbilityCounter2(sync.abilityId, sync.useN ? count2 : count2 - 1);
  }, [count2, baseId2, setAbilityCounter2]);

  // Default multi-unit model: "Attack move" (focusFireBatchesMC) when both units are melee,
  // but "Target focus" (focusFire) as soon as either unit is ranged. Re-applied only when the
  // ranged makeup of the matchup changes, so a manual model choice persists within a given matchup.
  const rangedSrc1 = slot.variation ?? slot.unit;
  const rangedSrc2 = slot2.variation ?? slot2.unit;
  const hasRangedUnit = (!!rangedSrc1 && getPrimaryWeapon(rangedSrc1)?.type === "ranged") || (!!rangedSrc2 && getPrimaryWeapon(rangedSrc2)?.type === "ranged");
  useEffect(() => {
    setMultiUnitModelKey(hasRangedUnit ? "focusFire" : "focusFireBatchesMC");
  }, [hasRangedUnit]);

  // Kiting only makes sense when at least one unit is ranged. When both units are melee
  // (range <= 1) there is no approach phase to simulate, so the toggle is disabled and
  // force-cleared (mirrors the Sandbox).
  const maxRangeDistance = Math.max(slot.modifiedStats.maxRange || 0, slot2.modifiedStats.maxRange || 0);
  const kitingDisabled = maxRangeDistance <= 1;
  useEffect(() => { if (kitingDisabled && allowKiting) setAllowKiting(false); }, [kitingDisabled, allowKiting]);

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

  // Civ lock: pin the displayed civ to the streamer's detected civ. Off by default —
  // it only does something during a tracked ranked game, and until then it silently
  // overrides whatever civ the viewer picked.
  const [civLocked, setCivLocked] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(CIV_LOCK_KEY);
      return raw === null ? false : JSON.parse(raw) === true;
    } catch {
      return false;
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
  // Same feature as the streamer lock, so it defaults off too — having one on and the
  // other off would be incoherent.
  const [oppCivLocked, setOppCivLocked] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(OPP_CIV_LOCK_KEY);
      return raw === null ? false : JSON.parse(raw) === true;
    } catch {
      return false;
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
  // Memoized on the real inputs: the "units to win" search below re-runs the matchup up to
  // 100 times (×200 Monte-Carlo iterations for the Attack-move model), and the overlay
  // re-renders on every pointer move while a panel is dragged or resized.
  const { vsResult, costDisabled, popDisabled, presetCosts } = useMemo((): {
    vsResult?: VSResultData;
    costDisabled: boolean;
    popDisabled: boolean;
    presetCosts: { cost1: number; cost2: number; pop1: number; pop2: number };
  } => {
    let vsResult: VSResultData | undefined;
    // Ratio presets are disabled when the underlying quantity is missing on either side.
    let costDisabled = true;
    let popDisabled = true;
    let presetCosts = { cost1: 0, cost2: 0, pop1: 0, pop2: 0 };
    if (vsOpen && slot.unit && slot2.unit) {
      try {
        const src1 = (slot.variation ?? slot.unit) as any;
        const src2 = (slot2.variation ?? slot2.unit) as any;
        // Cost multipliers always apply now (the Sandbox no longer has a separate
        // equal-cost variation block that skipped them).
        const mod1 = buildModifiedVariation(src1, slot.modifiedStats, {
          baseId: slot.variation ? src1.baseId : src1.id,
          activeTechnologies: slot.activeTechnologies,
          activeAbilities: slot.activeAbilities,
          abilityCounters: slot.abilityCounters,
          selectedAge: slot.selectedAge,
          secondaryWeapons: slot.secondaryWeapons,
          applyCostMultiplier: true,
        });
        const mod2 = buildModifiedVariation(src2, slot2.modifiedStats, {
          baseId: slot2.variation ? src2.baseId : src2.id,
          activeTechnologies: slot2.activeTechnologies,
          activeAbilities: slot2.activeAbilities,
          abilityCounters: slot2.abilityCounters,
          selectedAge: slot2.selectedAge,
          secondaryWeapons: slot2.secondaryWeapons,
          applyCostMultiplier: true,
        });
        // Timed-ability handling: when a side has an ability with a `duration`, combat needs a
        // second variation with those effects stripped so the buff expires mid-fight instead of
        // lasting forever (same two-phase correction as the Sandbox).
        const timedDuration1 = slot.activeTimedDuration;
        const timedDuration2 = slot2.activeTimedDuration;
        const noTimerData1 = timedDuration1
          ? buildModifiedVariation(src1, slot.modifiedStatsNoTimer, {
            baseId: slot.variation ? src1.baseId : src1.id,
            activeTechnologies: slot.activeTechnologies,
            activeAbilities: slot.activeAbilities,
            abilityCounters: slot.abilityCounters,
            selectedAge: slot.selectedAge,
            secondaryWeapons: slot.secondaryWeapons,
            applyCostMultiplier: true,
          })
          : undefined;
        const noTimerData2 = timedDuration2
          ? buildModifiedVariation(src2, slot2.modifiedStatsNoTimer, {
            baseId: slot2.variation ? src2.baseId : src2.id,
            activeTechnologies: slot2.activeTechnologies,
            activeAbilities: slot2.activeAbilities,
            abilityCounters: slot2.abilityCounters,
            selectedAge: slot2.selectedAge,
            secondaryWeapons: slot2.secondaryWeapons,
            applyCostMultiplier: true,
          })
          : undefined;

        const ms1 = slot.modifiedStats as any;
        const ms2 = slot2.modifiedStats as any;
        const chargeA = getChargeBonus(src1, slot.activeAbilities, slot.selectedAge, slot.activeTechnologies, ms1.chargeMultiplier, ms1.meleeAttack, slot.abilityCounters, ms1.rangedAttack, ms1.chargeChange);
        const chargeB = getChargeBonus(src2, slot2.activeAbilities, slot2.selectedAge, slot2.activeTechnologies, ms2.chargeMultiplier, ms2.meleeAttack, slot2.abilityCounters, ms2.rangedAttack, ms2.chargeChange);
        const ab1 = [...slot.activeAbilities];
        const ab2 = [...slot2.activeAbilities];

        // Kiting start distance: fixed at the max range of the two units (Sandbox default).
        const startDistance = maxRangeDistance;

        // Ratio presets: enabled only when both sides carry the quantity they normalize.
        presetCosts = {
          cost1: getTotalCost(mod1),
          cost2: getTotalCost(mod2),
          pop1: mod1.costs?.popcap ?? 0,
          pop2: mod2.costs?.popcap ?? 0,
        };
        costDisabled = presetCosts.cost1 <= 0 || presetCosts.cost2 <= 0;
        popDisabled = presetCosts.pop1 <= 0 || presetCosts.pop2 <= 0;

        // Single source of truth for a matchup at arbitrary unit counts (ported verbatim from
        // the Sandbox). Both the displayed result and the "units to win" search go through it,
        // so the two can never disagree — approach phase, kiting and model selection all match.
        const computeMatchup = (
          n1: number,
          n2: number,
        ): VersusResult & { multipliers?: { multA: number; multB: number; totalCostA: number; totalCostB: number } } => {
          if (n1 > 1 || n2 > 1) {
            const customMults = { multA: n1, multB: n2 };
            if (allowKiting && multiUnitModelKey === "focusFire") {
              return computeVersusAtEqualCostKitingFocusFire(mod1, mod2, ab1, ab2, chargeA, chargeB, startDistance, customMults);
            }
            if (allowKiting && multiUnitModelKey === "focusFireBatchesMC") {
              return computeVersusAtEqualCostKitingBatchesMC(mod1, mod2, ab1, ab2, chargeA, chargeB, startDistance, customMults);
            }
            const isRanged1 = getPrimaryWeapon(mod1)?.type === "ranged";
            const isRanged2 = getPrimaryWeapon(mod2)?.type === "ranged";
            const model: MultiUnitModel =
              multiUnitModelKey === "focusFire" ? (isRanged1 !== isRanged2 ? focusFireAsymmetricModel : focusFireModel) :
                multiUnitModelKey === "focusFireBatchesMC" ? (isRanged1 !== isRanged2 ? focusFireBatchesMCAsymmetricModel : focusFireBatchesMCModel) :
                  aggregatedDPSModel;
            return computeVersusAtEqualCost(mod1, mod2, ab1, ab2, chargeA, chargeB, allowKiting, startDistance, model, customMults);
          }
          if (allowKiting && multiUnitModelKey === "focusFire") {
            return computeVersusKitingFocusFire(mod1, mod2, ab1, ab2, chargeA, chargeB, startDistance);
          }
          if (allowKiting && multiUnitModelKey === "focusFireBatchesMC") {
            return computeVersusKitingBatchesMC(mod1, mod2, ab1, ab2, chargeA, chargeB, startDistance);
          }
          return computeVersus(
            mod1, mod2, ab1, ab2, chargeA, chargeB, allowKiting, startDistance,
            noTimerData1, noTimerData2, timedDuration1, timedDuration2,
          );
        };

        const result = computeMatchup(count1, count2);
        const multipliers = isMultiUnit ? { multA: count1, multB: count2 } : undefined;

        // Units the loser would need to flip the outcome. Searched with the SAME computeMatchup
        // as the displayed result (no drift), winner count held fixed. Monte Carlo counts a win
        // rate above 50%; deterministic models require an outright win.
        let loserUnitsToWin: number | undefined;
        let loserUnitsToWinExceeded = false;
        if (result.winner !== "draw") {
          const loserIsLeft = result.winner === "defender";
          const winnerCount = loserIsLeft ? count2 : count1;
          const loserCount = loserIsLeft ? count1 : count2;
          const useWinRate = multiUnitModelKey === "focusFireBatchesMC";
          for (let n = loserCount + 1; n <= MAX_UNITS_TO_WIN; n++) {
            const r = loserIsLeft ? computeMatchup(n, winnerCount) : computeMatchup(winnerCount, n);
            const loserWon = useWinRate && r.mcDistribution
              ? (loserIsLeft ? r.mcDistribution.winRateA : r.mcDistribution.winRateB) > 0.5
              : r.winner === (loserIsLeft ? "attacker" : "defender");
            if (loserWon) { loserUnitsToWin = n; break; }
          }
          if (loserUnitsToWin === undefined) loserUnitsToWinExceeded = true;
        }

        // Units needed to one-shot one opponent unit = ⌈opponent HP / per-unit first-hit damage⌉
        // (first hit includes the charge bonus; falls back to steady damage per hit).
        const osDmg1 = result.attacker.firstHitDamage ?? result.attacker.effectiveDamagePerHit;
        const osDmg2 = result.defender.firstHitDamage ?? result.defender.effectiveDamagePerHit;
        const unitsToOS1 = osDmg1 > 0 && mod2.hitpoints ? Math.ceil(mod2.hitpoints / osDmg1) : undefined;
        const unitsToOS2 = osDmg2 > 0 && mod1.hitpoints ? Math.ceil(mod1.hitpoints / osDmg2) : undefined;

        // Winner group units remaining (multi-unit): MC median when available, like Sandbox.
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
          // With groups the HP bar (vs single-unit max HP) is meaningless — show units left instead.
          winnerHp: isMultiUnit ? undefined : result.winnerHpRemaining,
          winnerMaxHp: isMultiUnit ? undefined : result.winner === "attacker" ? slot.modifiedStats.hitpoints : result.winner === "defender" ? slot2.modifiedStats.hitpoints : undefined,
          loserUnitsToWin,
          loserUnitsToWinExceeded,
          // Approximate when both sides have several units: the search holds the winner count
          // fixed and grouping/MC noise makes the flip point fuzzy.
          loserUnitsToWinApprox: count1 > 1 && count2 > 1,
          unitsToOS1,
          unitsToOS2,
          multA: multipliers?.multA,
          multB: multipliers?.multB,
          winnerUnits: isMultiUnit ? winnerUnits : undefined,
          winRateA: md?.winRateA,
          winRateB: md?.winRateB,
          drawRate: md?.drawRate,
          whenAWins: md?.whenAWins,
          whenBWins: md?.whenBWins,
        };
      } catch {
        // combat computation failed — no result displayed
      }
    }
    return { vsResult, costDisabled, popDisabled, presetCosts };
    // Only the combat inputs matter here — panel position/scale must NOT retrigger this.
  }, [
    vsOpen, isMultiUnit, count1, count2, allowKiting, multiUnitModelKey, maxRangeDistance,
    slot.unit, slot.variation, slot.modifiedStats, slot.modifiedStatsNoTimer, slot.activeTimedDuration,
    slot.activeTechnologies, slot.activeAbilities, slot.abilityCounters, slot.selectedAge, slot.secondaryWeapons,
    slot2.unit, slot2.variation, slot2.modifiedStats, slot2.modifiedStatsNoTimer, slot2.activeTimedDuration,
    slot2.activeTechnologies, slot2.activeAbilities, slot2.abilityCounters, slot2.selectedAge, slot2.secondaryWeapons,
  ]);

  // Ratio presets are exclusive toggles: selecting one fills both counts, clicking the
  // active one reverts to 1v1 (mirrors the Sandbox).
  const togglePreset = useCallback((key: 'cost' | 'pop') => {
    if (activePreset === key) { setCount1(1); setCount2(1); setActivePreset(null); return; }
    const [a, b] = key === 'cost'
      ? [presetCosts.cost1, presetCosts.cost2]
      : [presetCosts.pop1, presetCosts.pop2];
    const m = calculateEqualCostMultipliers(a, b);
    setCount1(m.multA); setCount2(m.multB); setActivePreset(key);
  }, [activePreset, presetCosts.cost1, presetCosts.cost2, presetCosts.pop1, presetCosts.pop2]);

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
                count1,
                count2,
                // A manual stepper edit drops the active preset selection.
                onCount1: (n) => { setCount1(n); setActivePreset(null); },
                onCount2: (n) => { setCount2(n); setActivePreset(null); },
                activePreset,
                onTogglePreset: togglePreset,
                costDisabled,
                popDisabled,
                allowKiting,
                onToggleKiting: () => setAllowKiting((v) => !v),
                kitingDisabled,
                modelKey: multiUnitModelKey,
                onModelChange: setMultiUnitModelKey,
                // Hidden when either side is a lone unit — grouping is forced, so all
                // models give the same result.
                modelSelectorVisible: (isMultiUnit || allowKiting) && count1 > 1 && count2 > 1,
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
