import { Technology, categorizeTechnology, getTechnologyTier, getTechnologyBaseName } from "@/data/unified-technologies";
import { technologyPatches, foreignEngineeringTechIds } from "@/data/patches/technologies";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TechnologySelectorProps {
  technologies: Technology[];
  activeTechnologies: Set<string>;
  onToggle: (techId: string) => void;
  orientation?: "left" | "right";
  selectedCiv?: string;
  lockedTechnologies?: Set<string>;
}

export const TechnologySelector = ({
  technologies,
  activeTechnologies,
  onToggle,
  orientation = "left",
  selectedCiv,
  lockedTechnologies,
}: TechnologySelectorProps) => {
  if (technologies.length === 0) return null;

  // Group technologies by category AND by age
  const categories = [
    'HP', 
    'HP-Unique',
    'Attack-Melee', 'Attack-Ranged', 
    'Attack-Melee-Unique', 'Attack-Ranged-Unique',
    'Armor-Melee', 'Armor-Ranged', 
    'Armor-Melee-Unique', 'Armor-Ranged-Unique',
    'Range',
    'Range-Unique',
    'AttackSpeed',
    'AttackSpeed-Unique',
    'Speed', 
    'Speed-Unique',
    'Other'
  ];
  const categoryLabels: Record<string, string> = {
    'HP': 'HP',
    'Attack-Melee': 'ATK',
    'Attack-Ranged': 'ATK',
    'Armor-Melee': 'ARM',
    'Armor-Ranged': 'ARM',
    'Range': 'RNG',
    'AttackSpeed': 'AS',
    'Speed': 'SPD',
    'HP-Unique': 'HP',
    'Attack-Melee-Unique': 'ATK',
    'Attack-Ranged-Unique': 'ATK',
    'Armor-Melee-Unique': 'ARM',
    'Armor-Ranged-Unique': 'ARM',
    'Range-Unique': 'RNG',
    'AttackSpeed-Unique': 'AS',
    'Speed-Unique': 'SPD',
    'Other': 'Other'
  };

  // Structure: category -> lineKey -> age -> technologies[]
  const grouped: Record<string, Record<string, Record<number, Technology[]>>> = {};
  
  categories.forEach(cat => {
    grouped[cat] = {};
  });

  technologies.forEach(tech => {
    const category = categorizeTechnology(tech);
    const age = tech.minAge;
    
    if (age < 1 || age > 4 || !grouped[category]) return;

    const tierInfo = getTechnologyTier(tech);
    let lineKey: string;

    if (tierInfo) {
      const baseName = getTechnologyBaseName(tech.displayClasses[0]);
      lineKey = `family:${baseName}`;
    } else {
      lineKey = category;
    }

    if (!grouped[category][lineKey]) {
      grouped[category][lineKey] = { 1: [], 2: [], 3: [], 4: [] };
    }
    grouped[category][lineKey][age].push(tech);
  });

  const ages = [1, 2, 3, 4];
  
  // Tracker to know which is the first line of each group (HP, ATK, ARM, SPD)
  const firstLineOfGroup = new Map<string, { category: string; lineKey: string }>();

  // Pre-calculate which is the first visible line of each group
  categories.forEach(category => {
    const categoryLines = grouped[category];
    const lineKeys = Object.keys(categoryLines);
    
    for (const lineKey of lineKeys) {
      const lineTechs = categoryLines[lineKey];
      const hasAnyTech = ages.some(age => lineTechs[age].length > 0);
      if (!hasAnyTech) continue;
      
      const baseLabel = categoryLabels[category];
      if (!firstLineOfGroup.has(baseLabel)) {
        firstLineOfGroup.set(baseLabel, { category, lineKey });
        break;
      }
    }
  });
  
  return (
    <div className="space-y-2 mt-2">
      {categories.map(category => {
        const categoryLines = grouped[category];
        const lineKeys = Object.keys(categoryLines);
        
        return lineKeys.map((lineKey, lineIndex) => {
          const lineTechs = categoryLines[lineKey];
          const hasAnyTech = ages.some(age => lineTechs[age].length > 0);
          if (!hasAnyTech) return null;

          const techGrid = (
            <div className="flex gap-2">
              {ages.map(age => {
                const techs = lineTechs[age];
              
              return (
                <div key={age} className="w-12 flex flex-col gap-2">
                  {techs.map(tech => {
                    const isActive = activeTechnologies.has(tech.id);
                    const isLocked = lockedTechnologies?.has(tech.id) ?? false;
                    const iconFileName = tech.icon.split('/').pop() || '';
                    const iconPath = `/technologies/${iconFileName}`;
                    const patch = technologyPatches.find(p => p.id === tech.id);
                    const isForeignEngineering = selectedCiv === 'by' && foreignEngineeringTechIds.has(tech.id);
                    // For FEC techs, only show the uiTooltip when playing as Byzantine
                    const patchTooltip = isForeignEngineering
                      ? patch?.uiTooltip
                      : (!foreignEngineeringTechIds.has(tech.id)
                          ? (patch?.uiTooltip || patch?.variations?.find(vp => vp.uiTooltip)?.uiTooltip)
                          : undefined);
                    return (
                      <div key={tech.id} className="relative">
                        <TooltipProvider delayDuration={750}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => !isLocked && onToggle(tech.id)}
                                className={`
                                  w-12 h-12 rounded border-2 transition-all relative overflow-hidden
                                  ${isLocked ? 'opacity-30 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}
                                  ${isActive
                                    ? 'border-green-500 bg-green-500/10'
                                    : isForeignEngineering
                                      ? 'border-orange-500/60 bg-orange-950/40 opacity-80'
                                      : 'border-border/50 bg-secondary/50 opacity-60'
                                  }
                                `}
                              >
                                <img 
                                  src={iconPath}
                                  alt={tech.name}
                                  className="w-full h-full object-contain p-1"
                                  onError={(e) => {
                                    e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="%23666"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="24" fill="white">?</text></svg>';
                                  }}
                                />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs">
                              <p className="font-semibold">{tech.name}</p>
                              {tech.description && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {tech.description}
                                </p>
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
                                <p className="text-xs text-yellow-400">
                                  {patchTooltip}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );

          // Show the label only on the first line of each group
          const baseLabel = categoryLabels[category];
          const firstLine = firstLineOfGroup.get(baseLabel);
          const isFirstLineOfGroup = firstLine?.category === category && firstLine?.lineKey === lineKey;

          const label = (
            <div className="text-xs font-medium text-muted-foreground w-10 flex-shrink-0 pt-2">
              {isFirstLineOfGroup ? `${baseLabel}:` : ''}
            </div>
          );

          return (
            <div key={`${category}-${lineKey}`} className="flex items-start gap-2">
            {orientation === "left" ? (
              <>
                {label}
                {techGrid}
              </>
            ) : (
              <>
                {techGrid}
                {label}
              </>
            )}
            </div>
          );
        });
      })}
    </div>
  );
};
