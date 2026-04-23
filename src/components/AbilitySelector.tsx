import type { Ability, AbilityVariation } from "@/data/unified-abilities";
import { abilityPatches, foreignEngineeringAbilityIds, ABILITY_ROW_GROUPS } from "@/data/patches/abilities";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Helper to check if ability has 'active' property
function hasActiveProperty(obj: Ability): obj is Ability & { active: string } {
  return 'active' in obj;
}

interface AbilitySelectorProps {
  abilities: Ability[];
  activeAbilities: Set<string>;
  onToggle: (abilityId: string) => void;
  orientation?: "left" | "right";
  selectedCiv?: string;
  lockedAbilities?: Set<string>;
  abilityCounters?: Map<string, number>;
  onIncrement?: (abilityId: string) => void;
  onDecrement?: (abilityId: string) => void;
  unitId?: string;
}

export const AbilitySelector = ({
  abilities,
  activeAbilities,
  onToggle,
  orientation = "left",
  selectedCiv,
  lockedAbilities,
  abilityCounters,
  onIncrement,
  onDecrement,
  unitId,
}: AbilitySelectorProps) => {
  if (abilities.length === 0) return null;

  const ages = [1, 2, 3, 4];

  const renderCounterAbilityButton = (ability: Ability) => {
    const count = abilityCounters?.get(ability.id) ?? 0;
    const isActive = count > 0;
    const max = ability.counterMax!;
    const patch = abilityPatches.find(p => p.id === ability.id);
    const patchTooltip = !foreignEngineeringAbilityIds.has(ability.id) ? patch?.uiTooltip : undefined;

    return (
      <div key={ability.id} className="w-12 flex flex-col items-center gap-1 relative">
        <TooltipProvider delayDuration={750}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={`
                  w-12 h-12 rounded border-2 transition-all relative overflow-hidden select-none
                  ${isActive
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-border/50 bg-secondary/50 opacity-60'
                  }
                `}
              >
                <img
                  src={ability.icon}
                  alt={ability.name}
                  className="w-full h-full object-contain p-1"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="%23666"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="24" fill="white">A</text></svg>';
                  }}
                />
                {isActive && (
                  <div className="absolute top-0 left-0 bg-amber-500 text-black text-[10px] font-bold px-1.5 rounded-br leading-4">
                    {count}
                  </div>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="font-semibold">{ability.name}</p>
              {ability.description && (
                <p className="text-xs text-muted-foreground mt-1">{ability.description}</p>
              )}
              {count > 0 && (() => {
                const step = (unitId ? ability.unitCounterStep?.[unitId] : undefined) ?? ability.counterStep ?? 0.05;
                const label = ability.counterTooltipLabel ?? 'attack cycle';
                const isAdditive = ability.counterDirection === 'additive';
                const val = ability.counterDirection === 'increase'
                  ? 1 + count * step
                  : isAdditive ? count * step
                  : 1 / (1 + count * step);
                return (
                  <p className="text-xs text-amber-400 mt-1">
                    {isAdditive ? `+${val}` : `×${val.toFixed(3)}`} {label} ({count} stack{count > 1 ? 's' : ''})
                  </p>
                );
              })()}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {patchTooltip && (
          <TooltipProvider delayDuration={750}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="absolute top-0 right-0 text-[10px] font-bold text-yellow-500 bg-black/50 px-1 rounded-bl cursor-help z-10 pointer-events-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  *
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs z-50">
                <p className="text-xs text-yellow-400">{patchTooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <div className="w-full flex items-center justify-between">
          <button
            onClick={() => onDecrement?.(ability.id)}
            disabled={count === 0}
            className="w-4 h-5 rounded border border-border/50 bg-secondary/60 hover:bg-secondary/90 active:scale-90 disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center text-xs leading-none transition-all font-medium"
          >
            −
          </button>
          <span className="text-[9px] text-muted-foreground text-center flex-1 tabular-nums">
            {count}/{max}
          </span>
          <button
            onClick={() => onIncrement?.(ability.id)}
            disabled={count >= max}
            className="w-4 h-5 rounded border border-border/50 bg-secondary/60 hover:bg-secondary/90 active:scale-90 disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center text-xs leading-none transition-all font-medium"
          >
            +
          </button>
        </div>
      </div>
    );
  };

  const renderAbilityButton = (ability: Ability) => {
    if (ability.counterMax !== undefined) return renderCounterAbilityButton(ability);
    const isActive = activeAbilities.has(ability.id);
    const isLocked = lockedAbilities?.has(ability.id) ?? false;
    const isDefaultAlways = (hasActiveProperty(ability) && ability.active === 'always') || ability.variations?.some((v: AbilityVariation) => v.active === 'always');
    const iconPath = ability.icon;
    const isForeignEngineering = selectedCiv === 'by' && foreignEngineeringAbilityIds.has(ability.id);
    const patch = abilityPatches.find(p => p.id === ability.id);
    const patchTooltip = isForeignEngineering
      ? patch?.uiTooltip
      : (!foreignEngineeringAbilityIds.has(ability.id) ? patch?.uiTooltip : undefined);

    return (
      <div key={ability.id} className="relative">
        <TooltipProvider delayDuration={750}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => !isLocked && onToggle(ability.id)}
                className={`
                  w-12 h-12 rounded border-2 transition-all relative overflow-hidden
                  ${isLocked
                    ? 'border-border/30 bg-secondary/20 opacity-30 cursor-not-allowed'
                    : isActive
                      ? 'border-purple-500 bg-purple-500/10 hover:scale-105 active:scale-95'
                      : isForeignEngineering
                        ? 'border-orange-500/60 bg-orange-950/40 opacity-80 hover:scale-105 active:scale-95'
                        : 'border-border/50 bg-secondary/50 opacity-60 hover:scale-105 active:scale-95'
                  }
                `}
              >
                <img
                  src={iconPath}
                  alt={ability.name}
                  className="w-full h-full object-contain p-1"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="%23666"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="24" fill="white">A</text></svg>';
                  }}
                />
                {isDefaultAlways && (
                  <div className="absolute bottom-0 right-0 bg-green-600 text-white text-[10px] px-1 rounded-tl">
                    auto
                  </div>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="font-semibold">{ability.name}</p>
              {ability.description && (
                <p className="text-xs text-muted-foreground mt-1">{ability.description}</p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {patchTooltip && (
          <TooltipProvider delayDuration={750}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="absolute top-0 right-0 text-[10px] font-bold text-yellow-500 bg-black/50 px-1 rounded-bl cursor-help z-10 pointer-events-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  *
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs z-50">
                <p className="text-xs text-yellow-400">{patchTooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  };

  const renderRow = (rowAbilities: Ability[], label: string, isFirst: boolean) => {
    const byAge: Record<number, Ability[]> = { 1: [], 2: [], 3: [], 4: [] };
    rowAbilities.forEach(a => {
      const age = a.minAge;
      if (age >= 1 && age <= 4) byAge[age].push(a);
    });
    const hasAny = ages.some(age => byAge[age].length > 0);
    if (!hasAny) return null;

    const grid = (
      <div className="flex gap-2">
        {ages.map(age => (
          <div key={age} className="w-12 flex flex-col gap-2">
            {byAge[age].map(renderAbilityButton)}
          </div>
        ))}
      </div>
    );

    const labelEl = (
      <div className="text-xs font-medium text-purple-400 w-10 flex-shrink-0 pt-2">
        {isFirst ? 'ABI:' : label ? `${label}:` : ''}
      </div>
    );

    return (
      <div key={label || 'default'} className="flex items-start gap-2">
        {orientation === "left" ? <>{labelEl}{grid}</> : <>{grid}{labelEl}</>}
      </div>
    );
  };

  // Split abilities into default row and named rows
  const namedIds = new Set(ABILITY_ROW_GROUPS.flatMap(g => g.ids));
  const defaultAbilities = abilities.filter(a => !namedIds.has(a.id));
  const namedRows = ABILITY_ROW_GROUPS.map(g => ({
    label: g.label,
    abilities: abilities.filter(a => g.ids.includes(a.id)),
  }));

  const rows = [
    { label: '', abilities: defaultAbilities },
    ...namedRows,
  ].filter(r => r.abilities.length > 0);

  return (
    <div className="space-y-2 mt-2">
      {rows.map((row, i) => renderRow(row.abilities, row.label, i === 0))}
    </div>
  );
};
