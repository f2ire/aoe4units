import { useState, useRef, useCallback, useLayoutEffect } from "react";

// Wide enough for the loadout drawer's natural width (label column + 4 age columns
// + the Reset button ≈ 238px, plus the drawer's p-3 padding) — below this the drawer
// gets a horizontal scrollbar. Must stay in sync with SlotPanel's `w-[...]`.
export const PANEL_BASE_WIDTH = 288;
const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const PANEL_WIDTH_FRACTION = 0.22;
const PANEL_HEIGHT_FRACTION = 0.9;
// Floor for the default (auto) size only — keeps the card readable on small
// players; manual resize can still go down to MIN_SCALE.
const DEFAULT_MIN_SCALE = 1;

export const DEFAULT_PANEL_X = 52; // left-2 (8px) + h-9/w-9 (36px) + gap (8px)

export type PanelState = { x: number; y: number; scale: number };

export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

// Pointer direction that grows the panel for each handle (sx: +1 = right edge,
// −1 = left edge; sy: +1 = bottom edge, −1 = top edge; 0 = axis not involved).
const HANDLE_DIRS: Record<ResizeHandle, { sx: number; sy: number }> = {
  n: { sx: 0, sy: -1 },
  s: { sx: 0, sy: 1 },
  e: { sx: 1, sy: 0 },
  w: { sx: -1, sy: 0 },
  ne: { sx: 1, sy: -1 },
  nw: { sx: -1, sy: -1 },
  se: { sx: 1, sy: 1 },
  sw: { sx: -1, sy: 1 },
};

// Manual placements store fx/fy as fractions of the AVAILABLE space
// (window minus the panel's rendered size), not of the raw window: with the
// panel size now fixed, this keeps the placement relative when the screen
// changes — a panel at the right edge stays at the right edge instead of
// overflowing off-screen.
type Placement =
  | { mode: "auto" }
  | { mode: "manual"; fx: number; fy: number; scale: number };

export const clampPanel = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

function toFrac(pos: number, panelSize: number, windowSize: number): number {
  const avail = windowSize - panelSize;
  return avail > 0 ? clampPanel(pos / avail, 0, 1) : 0;
}

function fromFrac(frac: number, panelSize: number, windowSize: number): number {
  return Math.round(frac * Math.max(0, windowSize - panelSize));
}

function defaultScale(): number {
  return clampPanel(
    (window.innerWidth * PANEL_WIDTH_FRACTION) / PANEL_BASE_WIDTH,
    DEFAULT_MIN_SCALE,
    MAX_SCALE,
  );
}

function fitScale(naturalH: number): number {
  const byWidth = (window.innerWidth * PANEL_WIDTH_FRACTION) / PANEL_BASE_WIDTH;
  const byHeight = (window.innerHeight * PANEL_HEIGHT_FRACTION) / naturalH;
  return clampPanel(Math.min(byWidth, byHeight), DEFAULT_MIN_SCALE, MAX_SCALE);
}

function computeLayout(
  p: Placement,
  naturalH: number,
  defaultX: number,
  autoScale?: number,
): PanelState {
  if (p.mode === "manual") {
    const scale = clampPanel(p.scale, MIN_SCALE, MAX_SCALE);
    return {
      x: fromFrac(p.fx, PANEL_BASE_WIDTH * scale, window.innerWidth),
      y: fromFrac(p.fy, naturalH * scale, window.innerHeight),
      scale,
    };
  }
  const scale = autoScale ?? fitScale(naturalH);
  const y = clampPanel(
    Math.round((window.innerHeight - naturalH * scale) / 2),
    8,
    window.innerHeight - 40,
  );
  return { x: defaultX, y, scale };
}

function provisionalState(p: Placement, defaultX: number): PanelState {
  if (p.mode === "manual") {
    const scale = clampPanel(p.scale, MIN_SCALE, MAX_SCALE);
    const w = PANEL_BASE_WIDTH * scale;
    return {
      // Panel height is unknown before mount — approximate with the width;
      // the first relayout (layout effect, pre-paint) corrects it.
      x: fromFrac(p.fx, w, window.innerWidth),
      y: fromFrac(p.fy, w, window.innerHeight),
      scale,
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
    if (saved && saved.mode === "manual" && Number.isFinite(saved.fx) && Number.isFinite(saved.scale)) {
      return { mode: "manual", fx: saved.fx, fy: saved.fy, scale: saved.scale };
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
  const panelPosRef = useRef({ x: panel.x, y: panel.y });
  panelPosRef.current = { x: panel.x, y: panel.y };
  // Auto mode fits the scale to the window once, then keeps it fixed so the
  // card no longer resizes when the window does.
  const autoScaleSettled = useRef(false);

  const relayout = useCallback(() => {
    if (gestureActive.current) return;
    const el = panelRef.current;
    if (!el) return;
    // Settle the auto scale only once the window has a real size — the Twitch
    // iframe can be 0×0 at mount, and a scale fitted to that would stick.
    const fitNow = !autoScaleSettled.current && window.innerWidth > 0 && window.innerHeight > 0;
    if (fitNow) autoScaleSettled.current = true;
    setPanel((prev) =>
      computeLayout(placementRef.current, el.offsetHeight, defaultX, fitNow ? undefined : prev.scale),
    );
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
      fx: toFrac(rect.left, rect.width, window.innerWidth),
      fy: toFrac(rect.top, rect.height, window.innerHeight),
      scale: clampPanel(panelScaleRef.current, MIN_SCALE, MAX_SCALE),
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

  // Resize from any edge or corner (default: bottom-right). The scale tracks
  // the pointer along the grabbed axis — corners average both axes — and
  // west/north handles re-anchor x/y so the opposite edge stays fixed.
  const resizeGesture = useRef<{
    px: number; py: number; base: number;
    sx: number; sy: number; naturalH: number; bx: number; by: number;
  } | null>(null);
  const onResize = useCallback((e: PointerEvent) => {
    const g = resizeGesture.current;
    if (!g) return;
    let delta = 0;
    let axes = 0;
    if (g.sx) { delta += (g.sx * (e.clientX - g.px)) / PANEL_BASE_WIDTH; axes++; }
    if (g.sy) { delta += (g.sy * (e.clientY - g.py)) / g.naturalH; axes++; }
    if (axes > 1) delta /= axes;
    const scale = clampPanel(g.base + delta, MIN_SCALE, MAX_SCALE);
    setPanel((p) => ({
      ...p,
      x: g.sx < 0 ? g.bx + Math.round(PANEL_BASE_WIDTH * (g.base - scale)) : p.x,
      y: g.sy < 0 ? g.by + Math.round(g.naturalH * (g.base - scale)) : p.y,
      scale,
    }));
  }, []);
  const endResize = useCallback(() => {
    resizeGesture.current = null;
    gestureActive.current = false;
    window.removeEventListener("pointermove", onResize);
    commitManual();
  }, [onResize, commitManual]);
  const startResize = useCallback(
    (e: React.PointerEvent, handle: ResizeHandle = "se") => {
      e.preventDefault();
      e.stopPropagation();
      gestureActive.current = true;
      const dir = HANDLE_DIRS[handle];
      resizeGesture.current = {
        px: e.clientX, py: e.clientY, base: panel.scale,
        sx: dir.sx, sy: dir.sy,
        // offsetHeight is the unscaled layout height (transform-independent).
        naturalH: panelRef.current?.offsetHeight || PANEL_BASE_WIDTH,
        bx: panel.x, by: panel.y,
      };
      window.addEventListener("pointermove", onResize);
      window.addEventListener("pointerup", endResize, { once: true });
    },
    [panel.scale, panel.x, panel.y, onResize, endResize],
  );

  // Force the panel to a given position and clear any persisted placement so
  // the next viewport-resize relayout uses this position, not an old saved one.
  const resetPanel = useCallback((state: PanelState) => {
    const h = (panelRef.current?.offsetHeight ?? 0) * state.scale;
    const placement: Placement = {
      mode: "manual",
      fx: toFrac(state.x, PANEL_BASE_WIDTH * state.scale, window.innerWidth),
      fy: toFrac(state.y, h, window.innerHeight),
      scale: clampPanel(state.scale, MIN_SCALE, MAX_SCALE),
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
    const h = (panelRef.current?.offsetHeight ?? 0) * scale;
    const placement: Placement = {
      mode: "manual",
      fx: toFrac(x, PANEL_BASE_WIDTH * scale, window.innerWidth),
      fy: toFrac(y, h, window.innerHeight),
      scale: clampPanel(scale, MIN_SCALE, MAX_SCALE),
    };
    placementRef.current = placement;
    try { localStorage.setItem(storeKey, JSON.stringify(placement)); } catch { /* sandboxed iframe */ }
  }, [storeKey]);

  // Set just the scale (position unchanged). Used by the size-lock feature to
  // keep a follower panel's own scale aligned with the displayed size. When
  // persist is set, the new scale is written to storage (manual placement).
  const setScale = useCallback((scale: number, persist = false) => {
    const s = clampPanel(scale, MIN_SCALE, MAX_SCALE);
    panelScaleRef.current = s;
    setPanel((p) => ({ ...p, scale: s }));
    if (persist) savePosition(panelPosRef.current.x, panelPosRef.current.y, s);
  }, [savePosition]);

  return { panel, panelRef, startMove, startResize, resetPanel, moveTo, savePosition, setScale };
}
