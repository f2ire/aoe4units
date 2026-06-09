/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight, ChevronUp, GripHorizontal, Search, Settings2 } from "lucide-react";
import { getAvailableAges } from "@/data/unified-units";
import type { AoE4Unit } from "@/data/unified-units";
import { getTechnologyTier, getTechnologyBaseName } from "@/data/unified-technologies";
import { CIVILIZATIONS } from "@/data/civilizations";
import { useUnitSlot } from "@/hooks/useUnitSlot";
import { buildModifiedVariation } from "@/lib/buildVariation";
import { cn } from "@/lib/utils";
import { CompactUnitCard } from "./CompactUnitCard";
import { CompactLoadout } from "./CompactLoadout";
import { assetUrl } from "./assetUrl";

type Slot = ReturnType<typeof useUnitSlot>;

// Category labels for the unit picker (mirrors categorizeUnit()'s output).
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

// One unified, semi-transparent overlay panel: the compact stat card (click the
// unit name to change unit) + a collapsible technologies/abilities loadout, all
// in a single box so the stream stays visible behind it. Civ selection lives in
// the Overlay's left rail; `slot` is owned there and passed in.
const DRAWER_HEIGHT_KEY = "aoe4-overlay-drawer-h";
const DRAWER_MIN_HEIGHT = 80;
const DRAWER_MAX_HEIGHT = 1200;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function UnitPanel({
  slot,
  scale = 1,
  onMovePointerDown,
  onResizePointerDown,
}: {
  slot: Slot;
  scale?: number;
  onMovePointerDown?: (e: React.PointerEvent) => void;
  onResizePointerDown?: (e: React.PointerEvent) => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [civPickerOpen, setCivPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [openCategories, setOpenCategories] = useState<Set<string>>(() => new Set());

  // Lowering the age must drop counter-tech stacks that belong to a higher age
  // (e.g. 6 stacks researched at age IV → max 2 at age II). The shared slot never
  // prunes techs by age (the sandbox intentionally allows any tier at any age), so
  // the overlay reconciles it here: clamp each counter line to the tiers available
  // at selectedAge by switching to the highest allowed tier (or off when none).
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

  // User-adjustable max height of the technologies/abilities drawer. Drag its
  // bottom handle up to shrink it (content then scrolls). Persisted across loads.
  const [drawerHeight, setDrawerHeight] = useState<number>(() => {
    const saved = Number(localStorage.getItem(DRAWER_HEIGHT_KEY));
    return saved >= DRAWER_MIN_HEIGHT ? saved : 320;
  });
  useEffect(() => {
    try {
      localStorage.setItem(DRAWER_HEIGHT_KEY, String(drawerHeight));
    } catch {
      /* storage may be unavailable in the sandboxed iframe */
    }
  }, [drawerHeight]);

  // Drawer resize gesture. The panel may be scaled, so screen-px deltas are
  // divided by the scale captured at gesture start to get the unscaled delta.
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

  // Close the unit/civ pickers when clicking anywhere outside the panel (e.g. on
  // the stream behind the overlay). A `fixed` backdrop can't be used here: the
  // panel sits under a `transform: scale` ancestor, so `position: fixed` is
  // relative to the panel, not the viewport. A document-level listener avoids
  // that — clicks inside the panel (incl. the triggers) keep their normal toggle.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pickerOpen && !civPickerOpen) return;
    const onDocPointerDown = (e: PointerEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      setPickerOpen(false);
      setCivPickerOpen(false);
      setSearch("");
    };
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [pickerOpen, civPickerOpen]);

  // Cap the drawer to the available viewport space below the tech toggle button,
  // so the resize handle is always reachable.
  const effectiveDrawerMaxHeight = (() => {
    if (!techBtnRef.current) return drawerHeight;
    const r = techBtnRef.current.getBoundingClientRect();
    const resizeBarScreenPx = 20 * scale; // resize bar ~20px in natural units × scale
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
    <div ref={panelRef} className="relative w-[300px]">
      <div className="relative overflow-hidden rounded-lg border border-amber-500/30 bg-zinc-950/65 text-zinc-100 shadow-2xl ring-1 ring-black/30 backdrop-blur-md">
        {/* Drag handle — grab here to move the panel. */}
        {onMovePointerDown && (
          <div
            onPointerDown={onMovePointerDown}
            className="flex cursor-move touch-none select-none items-center gap-2 border-b border-amber-500/15 bg-zinc-900/70 px-2 py-1"
            title="Move panel"
          >
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() =>
                setCivPickerOpen((v) => {
                  const next = !v;
                  if (next) setPickerOpen(false);
                  return next;
                })
              }
              className={cn(
                "flex items-center gap-2 rounded px-1 py-0.5 transition-colors hover:bg-white/10",
                civPickerOpen && "bg-amber-500/15",
              )}
              title="Change civilization"
            >
              {civ ? (
                <>
                  <img src={assetUrl(civ.flagPath)} alt={civ.name} className="h-3.5 w-5 shrink-0 rounded-sm object-cover" />
                  <span className="text-xs font-medium text-zinc-300">{civ.name}</span>
                </>
              ) : (
                <span className="text-xs text-zinc-500">{slot.selectedCiv}</span>
              )}
              <ChevronDown className="h-3 w-3 text-zinc-500" />
            </button>
            <GripHorizontal className="ml-auto h-3.5 w-3.5 text-zinc-600" />
          </div>
        )}

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
            />

            {/* Technologies & abilities — merged into the same panel */}
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
                {/* Drag up to shrink this section (content scrolls). */}
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

        {/* Resize grip — drag the corner to scale the panel. */}
        {onResizePointerDown && (
          <div
            onPointerDown={onResizePointerDown}
            className="absolute bottom-0 right-0 z-20 h-3.5 w-3.5 cursor-nwse-resize touch-none"
            style={{ background: "linear-gradient(135deg, transparent 50%, rgba(245,158,11,0.7) 50%)" }}
            title="Resize panel"
          />
        )}
      </div>

      {/* Civ dropdown — at root level (outside the overflow-hidden box) so it can
          overflow the panel. Outside clicks are handled by the document listener. */}
      {civPickerOpen && (
        <div className="absolute inset-x-0 top-8 z-50 max-h-[50vh] overflow-y-auto rounded-b-md border border-amber-500/30 bg-zinc-950/98 shadow-2xl backdrop-blur">
          {CIVILIZATIONS.map((c) => (
            <button
              key={c.abbr}
              type="button"
              onClick={() => {
                slot.setSelectedCiv(c.abbr);
                slot.setUnit(null);
                setCivPickerOpen(false);
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
      )}

      {/* Unit picker — anchored under the header, opened by clicking the name. */}
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
