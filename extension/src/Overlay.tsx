import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { Swords } from "lucide-react";
import "@/index.css";
import { cn } from "@/lib/utils";
import { useUnitSlot } from "@/hooks/useUnitSlot";
import UnitPanel from "./UnitPanel";
import { useAoe4WorldDetection } from "./useAoe4WorldDetection";

// Persisted position + scale of the floating unit/stats panel.
const STORE_KEY = "aoe4-overlay-panel-v2";
// Persisted viewer preference: lock the displayed civ to the streamer's detected
// civ (default) vs let the viewer pick freely.
const CIV_LOCK_KEY = "aoe4-overlay-civ-locked";
const PANEL_BASE_WIDTH = 300; // px — used to convert resize-drag distance into a scale delta
const MIN_SCALE = 0.5;
const MAX_SCALE = 4; // raised so the auto default keeps growing on large/4K players

// Screen-relative default sizing: the panel targets this fraction of the
// viewport width, bounded so it never exceeds this fraction of the height.
const PANEL_WIDTH_FRACTION = 0.2;
const PANEL_HEIGHT_FRACTION = 0.9;

// Toggle-logo geometry (kept in sync with the button's `left-2`/`h-9 w-9`
// classes) so the panel can open adjacent to it.
const LOGO_LEFT = 8; // left-2
const LOGO_SIZE = 36; // h-9 / w-9
const LOGO_GAP = 8; // breathing room between the logo and the panel
const DEFAULT_PANEL_X = LOGO_LEFT + LOGO_SIZE + LOGO_GAP; // 52 — just right of the logo

type PanelState = { x: number; y: number; scale: number };

// How the panel is positioned/sized — stored as viewport-relative fractions so
// it stays correct across resize / fullscreen / different screens:
//  - "auto"   → screen-relative default: scaled to a fraction of the viewport
//               (fitScale), centered vertically, adjacent to the logo.
//  - "manual" → user dragged/resized it. fx/fy = top-left as fractions of the
//               viewport; widthFrac = rendered width as a fraction of viewport
//               width (→ scale). All reapplied on every viewport change.
type Placement =
  | { mode: "auto" }
  | { mode: "manual"; fx: number; fy: number; widthFrac: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Provisional default scale from the viewport width alone, for the first render
// before the panel's natural size is measured (refined in relayout).
function defaultScale(): number {
  return clamp((window.innerWidth * PANEL_WIDTH_FRACTION) / PANEL_BASE_WIDTH, MIN_SCALE, MAX_SCALE);
}

// Scale that makes the panel occupy PANEL_WIDTH_FRACTION of the viewport width
// without exceeding PANEL_HEIGHT_FRACTION of its height. `naturalW`/`naturalH`
// are untransformed layout dimensions (transform: scale doesn't affect
// offsetWidth/Height), so this is stable across recomputes.
function fitScale(naturalW: number, naturalH: number): number {
  const byWidth = (window.innerWidth * PANEL_WIDTH_FRACTION) / naturalW;
  const byHeight = (window.innerHeight * PANEL_HEIGHT_FRACTION) / naturalH;
  return clamp(Math.min(byWidth, byHeight), MIN_SCALE, MAX_SCALE);
}

// Read the persisted placement. Old (pre-v6) pixel states have no `mode` and are
// ignored → fall back to the screen-relative auto default.
function loadPlacement(): Placement {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (saved && saved.mode === "manual" && Number.isFinite(saved.fx)) {
      return { mode: "manual", fx: saved.fx, fy: saved.fy, widthFrac: saved.widthFrac };
    }
  } catch {
    /* ignore corrupted storage */
  }
  return { mode: "auto" };
}

// Resolve a placement to concrete {x,y,scale} for the current viewport, given
// the panel's untransformed natural size. This is what makes both position and
// size relative: it's re-run on every viewport change.
function computeLayout(p: Placement, naturalW: number, naturalH: number): PanelState {
  if (p.mode === "manual") {
    return {
      x: clamp(Math.round(p.fx * window.innerWidth), 0, Math.max(0, window.innerWidth - 40)),
      y: clamp(Math.round(p.fy * window.innerHeight), 0, Math.max(0, window.innerHeight - 40)),
      scale: clamp((p.widthFrac * window.innerWidth) / naturalW, MIN_SCALE, MAX_SCALE),
    };
  }
  const scale = fitScale(naturalW, naturalH);
  const y = clamp(Math.round((window.innerHeight - naturalH * scale) / 2), 8, window.innerHeight - 40);
  return { x: DEFAULT_PANEL_X, y, scale };
}

// First-render state before the panel can be measured (estimates with
// PANEL_BASE_WIDTH; relayout refines it before paint, so this isn't seen).
function provisionalState(p: Placement): PanelState {
  if (p.mode === "manual") {
    return {
      x: clamp(Math.round(p.fx * window.innerWidth), 0, Math.max(0, window.innerWidth - 40)),
      y: clamp(Math.round(p.fy * window.innerHeight), 0, Math.max(0, window.innerHeight - 40)),
      scale: clamp((p.widthFrac * window.innerWidth) / PANEL_BASE_WIDTH, MIN_SCALE, MAX_SCALE),
    };
  }
  return { x: DEFAULT_PANEL_X, y: clamp(Math.round(window.innerHeight / 2) - 18, 8, window.innerHeight - 40), scale: defaultScale() };
}

// Twitch Video-Overlay surface. The root spans the whole video but is
// pointer-events:none + transparent, so clicks pass through to the player —
// only the left icon rail (panel toggle + civ picker) and the panel capture
// pointer events. The unit slot is owned here so the rail's civ picker and the
// panel share one state. The unit/stats panel floats: it can be dragged by its
// top handle and resized from its bottom-right corner (both persisted).
function Overlay() {
  const slot = useUnitSlot();
  const [open, setOpen] = useState(true);
  const placementRef = useRef<Placement>(loadPlacement());
  const [panel, setPanel] = useState<PanelState>(() => provisionalState(placementRef.current));
  const panelRef = useRef<HTMLDivElement>(null);
  // True while a drag/resize gesture is in progress — skip relayout so a stray
  // resize event mid-gesture doesn't fight the pointer.
  const gestureActive = useRef(false);

  // Re-apply the current placement to the live viewport: measure the panel's
  // untransformed size and recompute {x,y,scale}. This is what keeps BOTH
  // position and size relative to the screen on resize / fullscreen / DPI
  // change, in both auto and manual modes. offsetWidth/Height are layout sizes
  // (unaffected by the scale transform), so the result never feeds back.
  const relayout = useCallback(() => {
    if (gestureActive.current) return;
    const el = panelRef.current;
    if (!el) return;
    const naturalW = el.offsetWidth;
    const naturalH = el.offsetHeight;
    setPanel(computeLayout(placementRef.current, naturalW, naturalH));
  }, []);

  // Run before paint, then on every viewport change. A ResizeObserver on the
  // root element catches fullscreen / player-resize that a bare window "resize"
  // can miss inside the Twitch iframe; observing the panel itself re-centers
  // when its content height changes (unit/drawer). visualViewport covers
  // mobile/zoom.
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

  // Capture the current on-screen geometry as viewport fractions (manual mode)
  // and persist it, so a user-placed panel stays relative on later resizes.
  const commitManual = useCallback(() => {
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const placement: Placement = {
      mode: "manual",
      fx: clamp(rect.left / window.innerWidth, 0, 1),
      fy: clamp(rect.top / window.innerHeight, 0, 1),
      widthFrac: clamp(rect.width / window.innerWidth, 0.02, 1),
    };
    placementRef.current = placement;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(placement));
    } catch {
      /* storage may be unavailable in the sandboxed iframe */
    }
  }, []);

  const { detectedCiv } = useAoe4WorldDetection();

  // Civ lock: when on (default), the displayed civ stays pinned to the streamer's
  // detected civ — including when the streamer starts a new game with a new civ —
  // and the civ picker is disabled. When off, detection is ignored and the viewer
  // picks freely. Persisted so the viewer's choice sticks across reloads.
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
      try {
        localStorage.setItem(CIV_LOCK_KEY, JSON.stringify(next));
      } catch {
        /* storage may be unavailable in the sandboxed iframe */
      }
      return next;
    });
  }, []);

  // Auto-select the first displayed unit whenever no unit is selected (mount + civ change).
  const hasUnit = !!slot.unit;
  const selectedCiv = slot.selectedCiv;
  useEffect(() => {
    if (hasUnit) return;
    const CATEGORY_ORDER = [
      "jeanne", "melee_infantry", "ranged", "cavalry", "siege",
      "mercenary", "khaganate", "monk", "ship", "other",
    ];
    for (const cat of CATEGORY_ORDER) {
      const units = (slot.categorizedUnits[cat] ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
      if (units.length > 0) { slot.setUnit(units[0]); return; }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnit, selectedCiv]);

  // While locked, keep the displayed civ pinned to the streamer's detected civ —
  // this re-syncs on each new game (detectedCiv changes) and the moment the viewer
  // re-locks after picking freely. While unlocked, detection is ignored entirely.
  useEffect(() => {
    if (!civLocked || !detectedCiv || slot.selectedCiv === detectedCiv) return;
    slot.setSelectedCiv(detectedCiv);
    slot.setUnit(null);
  }, [civLocked, detectedCiv, slot]);

  // Persistence is handled by commitManual on gesture end (placement fractions),
  // not on every panel change — relayout writes live px we don't want to store.

  // Drag-to-move: the gesture state lives in a ref so the window listeners stay
  // stable; setPanel uses a functional update + live viewport bounds.
  const moveGesture = useRef<{ px: number; py: number; bx: number; by: number } | null>(null);
  const onMove = useCallback((e: PointerEvent) => {
    const g = moveGesture.current;
    if (!g) return;
    setPanel((p) => ({
      ...p,
      x: clamp(g.bx + (e.clientX - g.px), 0, window.innerWidth - 40),
      y: clamp(g.by + (e.clientY - g.py), 0, window.innerHeight - 40),
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

  // Corner resize: convert the diagonal drag distance into a uniform scale delta.
  const resizeGesture = useRef<{ px: number; py: number; base: number } | null>(null);
  const onResize = useCallback((e: PointerEvent) => {
    const g = resizeGesture.current;
    if (!g) return;
    const delta = ((e.clientX - g.px) + (e.clientY - g.py)) / 2 / PANEL_BASE_WIDTH;
    setPanel((p) => ({ ...p, scale: clamp(g.base + delta, MIN_SCALE, MAX_SCALE) }));
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

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      {/* Toggle button — floating at the top-left corner. */}
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

      {/* Floating unit panel — draggable + resizable, positioned freely. */}
      <div
        ref={panelRef}
        className={cn(
          "pointer-events-auto absolute transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        style={{
          left: panel.x,
          top: panel.y,
          transform: `scale(${panel.scale})`,
          transformOrigin: "top left",
          visibility: open ? undefined : "hidden",
        }}
        aria-hidden={!open}
      >
        <UnitPanel
          slot={slot}
          scale={panel.scale}
          onMovePointerDown={startMove}
          onResizePointerDown={startResize}
          civLocked={civLocked}
          onToggleCivLock={toggleCivLock}
        />
      </div>
    </div>
  );
}

// Entry: the page background MUST be transparent so the stream shows through
// (index.css applies an opaque bg-background to <body>); theme follows the
// Twitch player context.
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
