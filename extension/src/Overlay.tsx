import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { Swords } from "lucide-react";
import "@/index.css";
import { cn } from "@/lib/utils";
import { CIVILIZATIONS } from "@/data/civilizations";
import { useUnitSlot } from "@/hooks/useUnitSlot";
import UnitPanel from "./UnitPanel";
import { assetUrl } from "./assetUrl";

// Persisted position + scale of the floating unit/stats panel.
const STORE_KEY = "aoe4-overlay-panel";
const PANEL_BASE_WIDTH = 300; // px — used to convert resize-drag distance into a scale delta
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;

type PanelState = { x: number; y: number; scale: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function loadPanelState(): PanelState {
  // First load picks a viewport-aware scale so small players start sensibly;
  // afterwards the user's saved choice wins.
  const fallbackScale = clamp(window.innerWidth / 900, MIN_SCALE, 1);
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (saved && typeof saved.x === "number") {
      return { x: saved.x, y: saved.y, scale: clamp(saved.scale ?? fallbackScale, MIN_SCALE, MAX_SCALE) };
    }
  } catch {
    /* ignore corrupted storage */
  }
  return { x: 48, y: 8, scale: fallbackScale };
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
  const [civOpen, setCivOpen] = useState(false);
  const [panel, setPanel] = useState<PanelState>(loadPanelState);

  const civ = CIVILIZATIONS.find((c) => c.abbr === slot.selectedCiv);

  // Persist position/scale whenever they change.
  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(panel));
    } catch {
      /* storage may be unavailable in the sandboxed iframe */
    }
  }, [panel]);

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
    window.removeEventListener("pointermove", onMove);
  }, [onMove]);
  const startMove = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
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
    window.removeEventListener("pointermove", onResize);
  }, [onResize]);
  const startResize = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeGesture.current = { px: e.clientX, py: e.clientY, base: panel.scale };
      window.addEventListener("pointermove", onResize);
      window.addEventListener("pointerup", endResize, { once: true });
    },
    [panel.scale, onResize, endResize],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      <div className="absolute inset-y-0 left-0 flex items-start">
        {/* Icon rail — always visible at the left edge. */}
        <div className="pointer-events-auto flex w-11 flex-col items-center gap-2 self-stretch bg-black/55 py-2 backdrop-blur-sm">
          <button
            type="button"
            aria-label={open ? "Close unit panel" : "Open unit panel"}
            aria-pressed={open}
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/10 hover:text-white",
              open && "bg-amber-500 text-black hover:bg-amber-500",
            )}
          >
            <Swords className="h-5 w-5" />
          </button>

          {/* Civilization picker */}
          <button
            type="button"
            aria-label="Select civilization"
            aria-pressed={civOpen}
            title={civ?.name ?? "Civilization"}
            onClick={() => setCivOpen((v) => !v)}
            className={cn(
              "flex h-9 w-9 items-center justify-center overflow-hidden rounded-md border transition-colors",
              civOpen ? "border-amber-500 bg-amber-500/15" : "border-white/15 hover:border-amber-500/60",
            )}
          >
            {civ ? (
              <img src={assetUrl(civ.flagPath)} alt={civ.name} className="h-6 w-6 object-contain" />
            ) : (
              <span className="text-[10px] font-bold uppercase text-white/80">{slot.selectedCiv}</span>
            )}
          </button>
        </div>

        {/* Civ dropdown — slides out from the rail. */}
        {civOpen && (
          <div className="pointer-events-auto absolute left-11 top-0 z-50 max-h-[85vh] w-52 overflow-y-auto rounded-r-md border border-amber-500/30 bg-zinc-950/95 p-1 shadow-2xl backdrop-blur">
            {CIVILIZATIONS.map((c) => (
              <button
                key={c.abbr}
                type="button"
                onClick={() => {
                  slot.setSelectedCiv(c.abbr);
                  slot.setUnit(null); // avoid a stale cross-civ unit
                  setCivOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-amber-500/15",
                  c.abbr === slot.selectedCiv ? "text-amber-300" : "text-zinc-200",
                )}
              >
                <img src={assetUrl(c.flagPath)} alt="" className="h-4 w-6 shrink-0 rounded-sm object-cover" />
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Floating unit panel — draggable + resizable, positioned freely. */}
      <div
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
