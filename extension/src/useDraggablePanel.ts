import { useState, useRef, useCallback, useLayoutEffect } from "react";

export const PANEL_BASE_WIDTH = 300;
const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const PANEL_WIDTH_FRACTION = 0.2;
const PANEL_HEIGHT_FRACTION = 0.9;

export const DEFAULT_PANEL_X = 52; // left-2 (8px) + h-9/w-9 (36px) + gap (8px)

export type PanelState = { x: number; y: number; scale: number };

type Placement =
  | { mode: "auto" }
  | { mode: "manual"; fx: number; fy: number; widthFrac: number };

export const clampPanel = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

function defaultScale(): number {
  return clampPanel(
    (window.innerWidth * PANEL_WIDTH_FRACTION) / PANEL_BASE_WIDTH,
    MIN_SCALE,
    MAX_SCALE,
  );
}

function fitScale(naturalH: number): number {
  const byWidth = (window.innerWidth * PANEL_WIDTH_FRACTION) / PANEL_BASE_WIDTH;
  const byHeight = (window.innerHeight * PANEL_HEIGHT_FRACTION) / naturalH;
  return clampPanel(Math.min(byWidth, byHeight), MIN_SCALE, MAX_SCALE);
}

function computeLayout(
  p: Placement,
  naturalH: number,
  defaultX: number,
): PanelState {
  if (p.mode === "manual") {
    return {
      x: clampPanel(Math.round(p.fx * window.innerWidth), 0, Math.max(0, window.innerWidth - 40)),
      y: clampPanel(Math.round(p.fy * window.innerHeight), 0, Math.max(0, window.innerHeight - 40)),
      scale: clampPanel((p.widthFrac * window.innerWidth) / PANEL_BASE_WIDTH, MIN_SCALE, MAX_SCALE),
    };
  }
  const scale = fitScale(naturalH);
  const y = clampPanel(
    Math.round((window.innerHeight - naturalH * scale) / 2),
    8,
    window.innerHeight - 40,
  );
  return { x: defaultX, y, scale };
}

function provisionalState(p: Placement, defaultX: number): PanelState {
  if (p.mode === "manual") {
    return {
      x: clampPanel(Math.round(p.fx * window.innerWidth), 0, Math.max(0, window.innerWidth - 40)),
      y: clampPanel(Math.round(p.fy * window.innerHeight), 0, Math.max(0, window.innerHeight - 40)),
      scale: clampPanel((p.widthFrac * window.innerWidth) / PANEL_BASE_WIDTH, MIN_SCALE, MAX_SCALE),
    };
  }
  return {
    x: defaultX,
    y: clampPanel(Math.round(window.innerHeight / 2) - 18, 8, window.innerHeight - 40),
    scale: defaultScale(),
  };
}

function loadPlacement(storeKey: string): Placement {
  try {
    const saved = JSON.parse(localStorage.getItem(storeKey) || "null");
    if (saved && saved.mode === "manual" && Number.isFinite(saved.fx)) {
      return { mode: "manual", fx: saved.fx, fy: saved.fy, widthFrac: saved.widthFrac };
    }
  } catch {
    /* ignore corrupted storage */
  }
  return { mode: "auto" };
}

// Encapsulates floating-panel position, drag-to-move, and corner-resize.
// storeKey: localStorage key for persisted placement.
// defaultX: auto-mode x position (defaults to just right of the toggle logo).
export function useDraggablePanel(storeKey: string, defaultX = DEFAULT_PANEL_X) {
  const placementRef = useRef<Placement>(loadPlacement(storeKey));
  const [panel, setPanel] = useState<PanelState>(() =>
    provisionalState(placementRef.current, defaultX),
  );
  const panelRef = useRef<HTMLDivElement>(null);
  const gestureActive = useRef(false);
  const panelScaleRef = useRef(panel.scale);
  panelScaleRef.current = panel.scale;

  const relayout = useCallback(() => {
    if (gestureActive.current) return;
    const el = panelRef.current;
    if (!el) return;
    setPanel(computeLayout(placementRef.current, el.offsetHeight, defaultX));
  }, [defaultX]);

  useLayoutEffect(() => {
    relayout();
    const ro = new ResizeObserver(() => relayout());
    ro.observe(document.documentElement);
    if (panelRef.current) ro.observe(panelRef.current);
    window.addEventListener("resize", relayout);
    window.addEventListener("orientationchange", relayout);
    document.addEventListener("fullscreenchange", relayout);
    window.visualViewport?.addEventListener("resize", relayout);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", relayout);
      window.removeEventListener("orientationchange", relayout);
      document.removeEventListener("fullscreenchange", relayout);
      window.visualViewport?.removeEventListener("resize", relayout);
    };
  }, [relayout]);

  const commitManual = useCallback(() => {
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const placement: Placement = {
      mode: "manual",
      fx: clampPanel(rect.left / window.innerWidth, 0, 1),
      fy: clampPanel(rect.top / window.innerHeight, 0, 1),
      widthFrac: clampPanel(
        (PANEL_BASE_WIDTH * panelScaleRef.current) / window.innerWidth,
        0.02,
        1,
      ),
    };
    placementRef.current = placement;
    try {
      localStorage.setItem(storeKey, JSON.stringify(placement));
    } catch {
      /* sandboxed iframe */
    }
  }, [storeKey]);

  // Drag-to-move
  const moveGesture = useRef<{ px: number; py: number; bx: number; by: number } | null>(null);
  const onMove = useCallback((e: PointerEvent) => {
    const g = moveGesture.current;
    if (!g) return;
    setPanel((p) => ({
      ...p,
      x: clampPanel(g.bx + (e.clientX - g.px), 0, window.innerWidth - 40),
      y: clampPanel(g.by + (e.clientY - g.py), 0, window.innerHeight - 40),
    }));
  }, []);
  const endMove = useCallback(() => {
    moveGesture.current = null;
    gestureActive.current = false;
    window.removeEventListener("pointermove", onMove);
    commitManual();
  }, [onMove, commitManual]);
  const startMove = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      gestureActive.current = true;
      moveGesture.current = { px: e.clientX, py: e.clientY, bx: panel.x, by: panel.y };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", endMove, { once: true });
    },
    [panel.x, panel.y, onMove, endMove],
  );

  // Corner resize
  const resizeGesture = useRef<{ px: number; py: number; base: number } | null>(null);
  const onResize = useCallback((e: PointerEvent) => {
    const g = resizeGesture.current;
    if (!g) return;
    const delta = ((e.clientX - g.px) + (e.clientY - g.py)) / 2 / PANEL_BASE_WIDTH;
    setPanel((p) => ({ ...p, scale: clampPanel(g.base + delta, MIN_SCALE, MAX_SCALE) }));
  }, []);
  const endResize = useCallback(() => {
    resizeGesture.current = null;
    gestureActive.current = false;
    window.removeEventListener("pointermove", onResize);
    commitManual();
  }, [onResize, commitManual]);
  const startResize = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      gestureActive.current = true;
      resizeGesture.current = { px: e.clientX, py: e.clientY, base: panel.scale };
      window.addEventListener("pointermove", onResize);
      window.addEventListener("pointerup", endResize, { once: true });
    },
    [panel.scale, onResize, endResize],
  );

  // Force the panel to a given position and clear any persisted placement so
  // the next viewport-resize relayout uses this position, not an old saved one.
  const resetPanel = useCallback((state: PanelState) => {
    const placement: Placement = {
      mode: "manual",
      fx: clampPanel(state.x / window.innerWidth, 0, 1),
      fy: clampPanel(state.y / window.innerHeight, 0, 1),
      widthFrac: clampPanel((PANEL_BASE_WIDTH * state.scale) / window.innerWidth, 0.02, 1),
    };
    placementRef.current = placement;
    try { localStorage.removeItem(storeKey); } catch { /* iframe */ }
    setPanel(state);
  }, [storeKey]);

  const moveTo = useCallback((x: number, y: number) => {
    setPanel((p) => ({
      ...p,
      x: clampPanel(x, 0, window.innerWidth - 40),
      y: clampPanel(y, 0, window.innerHeight - 40),
    }));
  }, []);

  const savePosition = useCallback((x: number, y: number, scale: number) => {
    const placement: Placement = {
      mode: "manual",
      fx: clampPanel(x / window.innerWidth, 0, 1),
      fy: clampPanel(y / window.innerHeight, 0, 1),
      widthFrac: clampPanel((PANEL_BASE_WIDTH * scale) / window.innerWidth, 0.02, 1),
    };
    placementRef.current = placement;
    try { localStorage.setItem(storeKey, JSON.stringify(placement)); } catch { /* sandboxed iframe */ }
  }, [storeKey]);

  return { panel, panelRef, startMove, startResize, resetPanel, moveTo, savePosition };
}
