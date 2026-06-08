/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Heart,
  Swords,
  Timer,
  Crosshair,
  Shield,
  Wind,
  Clock,
  Users,
  ChevronDown,
} from "lucide-react";
import { getPrimaryWeapon, getArmorValue, getTotalCost } from "@/data/unified-units";
import { AgeSelector } from "@/components/AgeSelector";
import { cn } from "@/lib/utils";
import { assetUrl } from "./assetUrl";

// Compact, overlay-oriented unit stat card (dark + AoE4 gold accents).
// Presentational only: it receives the already-built `modified` variation
// (techs/abilities applied) plus the raw `base` variation (age-selected, no
// techs) so each stat can be highlighted when a technology changes it.

interface CompactUnitCardProps {
  /** Final, combat-ready variation (techs + abilities applied). */
  modified: any;
  /** Raw age-selected variation, no techs/abilities — baseline for deltas. */
  base: any;
  name: string;
  icon: string;
  civs: string[];
  availableAges: number[];
  selectedAge: number;
  onAgeChange: (age: number) => void;
  /** Click the unit name to change unit. */
  onNameClick?: () => void;
  pickerOpen?: boolean;
  /** Bonus-damage modifiers (vs classes / charge) — shown on Attack hover. */
  bonusDamage?: any[];
  /** Secondary weapons — shown on Attack hover. */
  secondaryWeapons?: any[];
  /** Flat bonus = fraction × enemy max HP (e.g. kanabo) — shown on Attack hover. */
  maxHpBonusFraction?: number;
}

// Flatten a modifier target's class tokens into a readable "heavy cavalry" label.
function formatTargetClasses(target: any): string {
  const classes = target?.class?.flat?.() ?? [];
  return classes.length ? classes.join(" ") : "all";
}

// A single stat chip: icon + value, tinted green/orange when a tech changed it.
// `tooltip`, when provided, shows a rich popover on hover (e.g. Attack details).
function Chip({
  icon,
  label,
  children,
  delta,
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  // >0 buffed, <0 nerfed, 0/undefined unchanged
  delta?: number;
  tooltip?: React.ReactNode;
}) {
  const tint =
    delta === undefined || Math.abs(delta) < 1e-6
      ? "text-zinc-100"
      : delta > 0
        ? "text-emerald-400"
        : "text-orange-400";
  return (
    <div
      className={cn(
        "group relative flex items-center gap-2 rounded-md border border-amber-500/15 bg-black/40 px-2 py-1.5",
        tooltip && "cursor-help",
      )}
      title={tooltip ? undefined : label}
    >
      <span className="text-amber-400/80">{icon}</span>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="text-[9px] uppercase tracking-wide text-zinc-500">{label}</span>
        <span className={cn("truncate text-sm font-semibold tabular-nums", tint)}>{children}</span>
      </div>
      {tooltip && (
        <div className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden w-60 rounded-md border border-amber-500/40 bg-zinc-950/95 p-2 text-left shadow-2xl backdrop-blur group-hover:block">
          {tooltip}
        </div>
      )}
    </div>
  );
}

const ICON = "h-4 w-4 shrink-0";

export function CompactUnitCard({
  modified,
  base,
  name,
  icon,
  civs,
  availableAges,
  selectedAge,
  onAgeChange,
  onNameClick,
  pickerOpen,
  bonusDamage = [],
  secondaryWeapons = [],
  maxHpBonusFraction = 0,
}: CompactUnitCardProps) {
  const weapon = getPrimaryWeapon(modified);
  const baseWeapon = getPrimaryWeapon(base);

  const burst = weapon?.burst?.count && weapon.burst.count > 1 ? weapon.burst.count : 0;
  const attack = Math.round(weapon?.damage ?? 0);
  const baseAttack = Math.round(baseWeapon?.damage ?? 0);

  const meleeArmor = Math.round(getArmorValue(modified, "melee"));
  const rangedArmor = Math.round(getArmorValue(modified, "ranged"));
  const baseMeleeArmor = Math.round(getArmorValue(base, "melee"));
  const baseRangedArmor = Math.round(getArmorValue(base, "ranged"));

  const speed = modified.movement?.speed;
  const baseSpeed = base.movement?.speed;

  const range = weapon?.range?.max;
  const baseRange = baseWeapon?.range?.max;
  const atkSpeed = weapon?.speed;
  const baseAtkSpeed = baseWeapon?.speed;

  const costs = modified.costs ?? {};
  const totalCost = Math.round(getTotalCost(modified));
  const productionTime = (costs as any)?.time;
  const population = (costs as any)?.popcap;

  const oliveLabel = civs.includes("mac") ? "Silver" : "Olive Oil";
  const oliveIcon = civs.includes("mac") ? "/resources/silver.png" : "/resources/oliveoil.png";
  const resources: Array<{ key: string; icon: string; alt: string; value: number }> = [
    { key: "food", icon: "/resources/food.png", alt: "Food", value: costs.food },
    { key: "wood", icon: "/resources/wood.png", alt: "Wood", value: costs.wood },
    { key: "gold", icon: "/resources/gold.png", alt: "Gold", value: costs.gold },
    { key: "stone", icon: "/resources/stone.png", alt: "Stone", value: costs.stone },
    { key: "oliveoil", icon: oliveIcon, alt: oliveLabel, value: costs.oliveoil },
  ].filter((r) => (r.value ?? 0) > 0);

  // Attack hover details: secondary weapons + bonus damage.
  const visibleBonus = (bonusDamage ?? []).filter((m: any) => m && !m.hidden);
  const hasAttackDetails = secondaryWeapons.length > 0 || visibleBonus.length > 0 || maxHpBonusFraction > 0;
  const attackTooltip = hasAttackDetails ? (
    <div className="space-y-2 text-xs">
      {secondaryWeapons.length > 0 && (
        <div>
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400/80">Secondary weapons</div>
          {secondaryWeapons.map((w: any, i: number) => (
            <div key={i} className="text-zinc-200">
              <span className="font-medium">{w.name || "Weapon"}</span>{" "}
              {Math.round(w.damage || 0)}
              {w.burst?.count > 1 ? ` × ${w.burst.count}` : ""}{" "}
              <span className="text-zinc-500">({w.type})</span>
              {(w.modifiers || []).map((m: any, mi: number) => (
                <div key={mi} className="pl-2 text-emerald-400">+{Math.round(m.value || 0)} vs <span className="capitalize">{formatTargetClasses(m.target)}</span></div>
              ))}
            </div>
          ))}
        </div>
      )}
      {visibleBonus.length > 0 && (
        <div>
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400/80">Bonus damage</div>
          {visibleBonus.map((m: any, i: number) => (
            <div key={i} className="text-emerald-400">
              {m.isChargeBonus
                ? `+${m.chargeBonusBurst > 1 ? `${Math.round(m.value / m.chargeBonusBurst)}×${m.chargeBonusBurst}` : Math.round(m.value)} ${m.chargeBonusLabel ?? "Charge"}`
                : <>+{Math.round(m.value)} vs <span className="capitalize">{formatTargetClasses(m.target)}</span></>}
            </div>
          ))}
        </div>
      )}
      {maxHpBonusFraction > 0 && (
        <div className="text-emerald-400">+{Math.round(maxHpBonusFraction * 100)}% enemy max HP</div>
      )}
    </div>
  ) : undefined;

  return (
    <div className="p-3 text-zinc-100">
      {/* Header: thumbnail + clickable name (opens unit picker), age selector below */}
      <div className="flex items-center gap-2.5">
        <img
          src={assetUrl(icon)}
          alt={name}
          className="h-11 w-11 shrink-0 rounded border border-amber-500/30 bg-black/40 object-contain p-0.5"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><rect width="44" height="44" fill="%23222"/><text x="50%" y="50%" fill="%23eab308" text-anchor="middle" dy=".3em" font-size="18">?</text></svg>';
          }}
        />
        <button
          type="button"
          onClick={onNameClick}
          title="Change unit"
          className="group flex min-w-0 flex-1 items-center gap-1 text-left"
        >
          <h3 className="min-w-0 flex-1 break-words font-serif text-base font-semibold text-amber-100 group-hover:text-amber-300" title={name}>
            {name}
          </h3>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-amber-400/60 transition-transform group-hover:text-amber-300",
              pickerOpen && "rotate-180",
            )}
          />
        </button>
      </div>
      <div className="mt-2 flex justify-start">
        <div className="scale-[0.62] origin-left">
          <AgeSelector
            availableAges={availableAges}
            selectedAge={selectedAge}
            onAgeChange={onAgeChange}
            orientation="left"
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="mt-1 grid grid-cols-2 gap-1.5">
        <Chip icon={<Heart className={ICON} />} label="HP" delta={modified.hitpoints - base.hitpoints}>
          {Math.round(modified.hitpoints)}
        </Chip>
        <Chip
          icon={<Swords className={ICON} />}
          label={`Attack (${weapon?.type ?? "—"})`}
          delta={attack - baseAttack}
          tooltip={attackTooltip}
        >
          {attack}
          {burst > 0 && <span className="text-zinc-400"> × {burst}</span>}
        </Chip>
        {atkSpeed != null && (
          <Chip
            icon={<Timer className={ICON} />}
            label="Attack Speed"
            delta={baseAtkSpeed != null ? baseAtkSpeed - atkSpeed : undefined}
          >
            {atkSpeed.toFixed(2)}s
          </Chip>
        )}
        {range != null && (
          <Chip icon={<Crosshair className={ICON} />} label="Range" delta={baseRange != null ? range - baseRange : undefined}>
            {parseFloat(range.toFixed(2))}
          </Chip>
        )}
        <Chip icon={<Shield className={ICON} />} label="Armor M / R">
          <span className={meleeArmor > baseMeleeArmor ? "text-emerald-400" : meleeArmor < baseMeleeArmor ? "text-orange-400" : ""}>
            {meleeArmor}
          </span>
          <span className="text-zinc-500"> / </span>
          <span className={rangedArmor > baseRangedArmor ? "text-emerald-400" : rangedArmor < baseRangedArmor ? "text-orange-400" : ""}>
            {rangedArmor}
          </span>
        </Chip>
        {speed != null && (
          <Chip icon={<Wind className={ICON} />} label="Speed" delta={baseSpeed != null ? speed - baseSpeed : undefined}>
            {speed.toFixed(2)}
          </Chip>
        )}
      </div>

      {/* Footer: costs + total, population, production time */}
      <div className="mt-2.5 flex items-center justify-between border-t border-amber-500/15 pt-2 text-xs">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {resources.map((r) => (
            <span key={r.key} className="flex items-center gap-1 text-zinc-300">
              <img src={assetUrl(r.icon)} alt={r.alt} className="h-3.5 w-3.5" />
              {Math.round(r.value)}
            </span>
          ))}
          <span className="flex items-center gap-1 font-semibold text-amber-300">Σ {totalCost}</span>
        </div>
        <div className="flex items-center gap-2.5 text-zinc-300">
          {!!population && (
            <span className="flex items-center gap-1" title="Population">
              <Users className="h-3.5 w-3.5 text-amber-400/70" />
              {population}
            </span>
          )}
          {!!productionTime && (
            <span className="flex items-center gap-1" title="Production time">
              <Clock className="h-3.5 w-3.5 text-amber-400/70" />
              {productionTime}s
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
