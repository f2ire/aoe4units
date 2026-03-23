import type { Ability, AbilityVariation } from "@/data/unified-abilities";
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
}

export const AbilitySelector = ({
  abilities,
  activeAbilities,
  onToggle,
  orientation = "left"
}: AbilitySelectorProps) => {
  if (abilities.length === 0) return null;

  // Group abilities by age only (no complex categories)
  const grouped: Record<number, Ability[]> = { 1: [], 2: [], 3: [], 4: [] };
  
  abilities.forEach(ability => {
    const age = ability.minAge;
    if (age >= 1 && age <= 4) {
      grouped[age].push(ability);
    }
  });

  const ages = [1, 2, 3, 4];
  
  const abilityGrid = (
    <div className="flex gap-2">
      {ages.map(age => {
        const ageAbilities = grouped[age];
        
        return (
          <div key={age} className="w-12 flex flex-col gap-2">
            {ageAbilities.map(ability => {
              const isActive = activeAbilities.has(ability.id);
              // Detect if this ability is "active" by default (e.g. aura)
              // Check both at the ability level and in variations
              const isDefaultAlways = (hasActiveProperty(ability) && ability.active === 'always') || ability.variations?.some((v: AbilityVariation) => v.active === 'always');
              // Use the icon from the aoe4world.com URL
              const iconPath = ability.icon;

              return (
                <div key={ability.id} className="relative">
                  <TooltipProvider delayDuration={750}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => onToggle(ability.id)}
                          className={`
                            w-12 h-12 rounded border-2 transition-all relative
                            hover:scale-105 active:scale-95 overflow-hidden
                            ${isActive
                              ? 'border-purple-500 bg-purple-500/10'
                              : 'border-border/50 bg-secondary/50 opacity-60'
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
                          <p className="text-xs text-muted-foreground mt-1">
                            {ability.description}
                          </p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );

  const label = (
    <div className="text-xs font-medium text-purple-400 w-10 flex-shrink-0 pt-2">
      ABI:
    </div>
  );

  return (
    <div className="space-y-2 mt-2">
      <div className="flex items-start gap-2">
        {orientation === "left" ? (
          <>
            {label}
            {abilityGrid}
          </>
        ) : (
          <>
            {abilityGrid}
            {label}
          </>
        )}
      </div>
    </div>
  );
};
