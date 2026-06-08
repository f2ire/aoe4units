import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Swords, X } from "lucide-react";
import "@/index.css";
import { cn } from "@/lib/utils";
import UnitPanel from "./UnitPanel";

// Twitch Video-Overlay surface. The root spans the whole video but is
// pointer-events:none + transparent, so clicks pass through to the player —
// only the left icon rail and the sliding panel capture pointer events. The
// panel is collapsed by default; clicking the rail icon slides it in.
function Overlay() {
  const [open, setOpen] = useState(true); // DEBUG: open by default to confirm visibility on Twitch

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      {/* DEBUG marker — proves the overlay mounted inside the Twitch iframe.
          Remove once confirmed visible. */}
      <div className="absolute left-1/2 top-2 -translate-x-1/2 rounded bg-red-600 px-3 py-1 text-xs font-bold text-white shadow-lg">
        AOE4 OVERLAY LOADED
      </div>
      <div className="absolute inset-y-0 left-0 flex">
        {/* Icon rail — always visible at the left edge. */}
        <div className="pointer-events-auto flex w-11 flex-col items-center gap-2 bg-black/55 py-2 backdrop-blur-sm">
          <button
            type="button"
            aria-label={open ? "Close unit panel" : "Open unit panel"}
            aria-pressed={open}
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/10 hover:text-white",
              open && "bg-primary text-primary-foreground hover:bg-primary",
            )}
          >
            <Swords className="h-5 w-5" />
          </button>
        </div>

        {/* Sliding panel — the single-unit view. */}
        <div
          className={cn(
            "pointer-events-auto h-full w-[320px] overflow-y-auto border-r border-border bg-background/95 shadow-2xl backdrop-blur-sm transition-all duration-200",
            open ? "translate-x-0 opacity-100" : "-translate-x-3 opacity-0",
          )}
          // Keep it out of layout flow when closed so it never blocks the video.
          style={open ? undefined : { visibility: "hidden", width: 0, borderRightWidth: 0 }}
          aria-hidden={!open}
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-semibold text-foreground">Unit Stats</span>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="rounded p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-3">
            <UnitPanel />
          </div>
        </div>
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
