import React from "react";
import { Technology, categorizeTechnology, getTechnologyTier, getTechnologyBaseName, IMPROVED_TECH_PAIRS, IMPROVED_TECH_BASE, allTechnologies } from "@/data/unified-technologies";
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
  unitId?: string;
  selectedAge?: number;
  unitMinAge?: number;
  fullUpgradeAge?: number | null;
  onApplyFullUpgrade?: (age: number) => void;
  onReset?: () => void;
}

export const TechnologySelector = ({
  technologies,
  activeTechnologies,
  onToggle,
  orientation = "left",
  selectedCiv,
  lockedTechnologies,
  unitId,
  selectedAge,
  unitMinAge = 1,
  fullUpgradeAge,
  onApplyFullUpgrade,
  onReset,
}: TechnologySelectorProps) => {
  // Filter out improved techs — they're controlled via the "^" button on their base tech.
  // Exception: FEC improved techs for Byzantines are shown directly (no base tech available).
  const visibleTechnologies = technologies.filter(t =>
    !IMPROVED_TECH_BASE[t.id] || (selectedCiv === 'by' && foreignEngineeringTechIds.has(t.id))
  );

  if (visibleTechnologies.length === 0) return null;

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
    'Age',
    'Other',
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
    'Age': 'AGE',
    'Other': 'Other',
  };

  // Structure: category -> lineKey -> age -> technologies[]
  const grouped: Record<string, Record<string, Record<number, Technology[]>>> = {};

  categories.forEach(cat => {
    grouped[cat] = {};
  });

  visibleTechnologies.forEach(tech => {
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

  const AGE_LABELS = ['I', 'II', 'III', 'IV'];

  return (
    <div className="space-y-2 mt-2">
      {(onApplyFullUpgrade || onReset) && (
        <div className={`flex items-center gap-2 mb-5 ${orientation === 'right' ? 'flex-row-reverse' : ''}`}>
          <span className="text-[11px] uppercase tracking-wide text-[#6a6a7a]">Full upgrade</span>
          {onApplyFullUpgrade && (
            <div className="flex rounded overflow-hidden border border-[#3a3a4a] bg-[#1a1a2a]">
              {AGE_LABELS.map((label, i) => {
                const age = i + 1;
                const isDisabled = age < unitMinAge;
                const isActive = fullUpgradeAge === age;
                return (
                  <button
                    key={age}
                    disabled={isDisabled}
                    onClick={() => onApplyFullUpgrade(age)}
                    className={[
                      'px-3 py-1 text-xs font-medium border-l border-[#3a3a4a] first:border-l-0 transition-colors',
                      isActive
                        ? 'bg-[#c9a227] text-[#0f0f17] font-bold'
                        : isDisabled
                          ? 'opacity-30 cursor-not-allowed text-[#6a6a7a]'
                          : 'text-[#6a6a7a] hover:bg-[#2a2a3a] hover:text-[#c9a227] cursor-pointer',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
          {onReset && (
            <button
              onClick={onReset}
              className="px-2 py-1 text-xs rounded border border-[#3a3a4a] bg-[#1a1a2a] text-[#6a6a7a] hover:bg-[#2a2a3a] hover:text-red-400 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      )}
      {categories.map(category => {
        const categoryLines = grouped[category];
        const lineKeys = Object.keys(categoryLines);

        return lineKeys.map((lineKey, lineIndex) => {
          const lineTechs = categoryLines[lineKey];
          const hasAnyTech = ages.some(age => lineTechs[age].length > 0);
          if (!hasAnyTech) return null;

          // Detect counter lines: a tier-line whose first (lowest) tier has counterMax defined.
          // Full list (no age cap) — used for counter detection, maxCount and toggle handlers.
          const allTiersForLine = ages
            .flatMap(age => lineTechs[age])
            .sort((a, b) => (getTechnologyTier(a)?.tier ?? 0) - (getTechnologyTier(b)?.tier ?? 0));
          const firstTierTech = allTiersForLine[0];
          const isCounterLine = firstTierTech?.counterMax !== undefined;

          let techGrid: React.ReactNode;

          if (isCounterLine) {
            const activeTierIdx = allTiersForLine.findIndex(t => activeTechnologies.has(t.id));
            const currentCount = activeTierIdx === -1 ? 0 : activeTierIdx + 1;
            const maxCount = firstTierTech.counterMax ?? allTiersForLine.length;
            const activeTierTech = currentCount > 0 ? allTiersForLine[currentCount - 1] : firstTierTech;
            const iconPath = activeTierTech.icon.startsWith('http') ? activeTierTech.icon : `/technologies/${activeTierTech.icon.split('/').pop() || ''}`;

            // Span width: number of distinct ages covered × 48px + (n-1) × 8px gap
            const agesInLine = [...new Set(allTiersForLine.map(t => t.minAge))].sort((a, b) => a - b);
            const numSpannedCols = agesInLine.length;
            const counterMinAge = agesInLine[0] ?? firstTierTech.minAge;
            const spanWidth = numSpannedCols * 48 + (numSpannedCols - 1) * 8;

            const handleIncrement = () => {
              if (currentCount < maxCount) onToggle(allTiersForLine[currentCount].id);
            };
            const handleDecrement = () => {
              if (currentCount === 0) return;
              onToggle(allTiersForLine[currentCount - (currentCount === 1 ? 1 : 2)].id);
            };

            techGrid = (
              <div className="flex gap-2">
                {ages.map(age => {
                  // Columns before the counter start: empty placeholder
                  if (age < counterMinAge) return <div key={age} className="w-12 flex-shrink-0" />;
                  // First column of the span: render the counter widget at the computed width
                  if (age === counterMinAge) return (
                    <div key={age} style={{ width: `${spanWidth}px` }} className="flex-shrink-0 flex flex-col items-center gap-1 relative">
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              onClick={() => currentCount > 0 && onToggle(allTiersForLine[currentCount - 1].id)}
                              className={`w-full h-12 rounded border-2 transition-all relative overflow-hidden select-none ${currentCount > 0 ? 'border-green-500 bg-green-500/10 cursor-pointer hover:border-red-500 hover:bg-red-500/10 active:scale-95' : 'border-border/50 bg-secondary/50 opacity-60'}`}>
                              <img src={iconPath} alt={activeTierTech.name} className="w-full h-full object-contain p-1" onError={(e) => { e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="%23666"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="24" fill="white">?</text></svg>'; }} />
                              {currentCount > 0 && (
                                <div className="absolute top-0 left-0 bg-green-500 text-black text-[10px] font-bold px-1.5 rounded-br leading-4">{currentCount}</div>
                              )}
                              {firstTierTech.unique && (
                                <div className="absolute bottom-1 left-0 w-4 h-4 rounded-full bg-background border border-border/20 flex items-center justify-center pointer-events-none z-10">
                                  <img src="/unique.png" alt="" className="w-6 h-6 object-contain" />
                                </div>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs">
                            <p className="font-semibold">{activeTierTech.name}</p>
                            {activeTierTech.description && <p className="text-xs text-muted-foreground mt-1">{activeTierTech.description}</p>}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <div className="w-full flex items-center justify-between">
                        <button onClick={handleDecrement} disabled={currentCount === 0} className="w-4 h-5 rounded border border-border/50 bg-secondary/60 hover:bg-secondary/90 active:scale-90 disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center text-xs leading-none transition-all font-medium">−</button>
                        <span className="text-[9px] text-muted-foreground text-center flex-1 tabular-nums">{currentCount}/{maxCount}</span>
                        <button onClick={handleIncrement} disabled={currentCount === maxCount} className="w-4 h-5 rounded border border-border/50 bg-secondary/60 hover:bg-secondary/90 active:scale-90 disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center text-xs leading-none transition-all font-medium">+</button>
                      </div>
                    </div>
                  );
                  // Columns absorbed into the span: skip (null removes them from flex flow)
                  if (age < counterMinAge + numSpannedCols) return null;
                  // Columns after the span: empty placeholder
                  return <div key={age} className="w-12 flex-shrink-0" />;
                })}
              </div>
            );
          } else {
            techGrid = (
              <div className="flex gap-2">
                {ages.map(age => {
                  const techs = lineTechs[age];

                  return (
                    <div key={age} className="w-12 flex flex-col gap-2">
                      {techs.map(tech => {
                        const isActive = activeTechnologies.has(tech.id);
                        const isLocked = lockedTechnologies?.has(tech.id) ?? false;
                        const iconFileName = tech.icon.split('/').pop() || '';
                        const iconPath = tech.icon.startsWith('http') ? tech.icon : `/technologies/${iconFileName}`;
                        const patch = technologyPatches.find(p => p.id === tech.id);
                        const isForeignEngineering = selectedCiv === 'by' && foreignEngineeringTechIds.has(tech.id);
                        const unitTooltip = unitId ? patch?.unitTooltips?.[unitId] : undefined;
                        const patchTooltip = unitTooltip ?? (isForeignEngineering
                          ? patch?.uiTooltip
                          : (!foreignEngineeringTechIds.has(tech.id)
                            ? (patch?.uiTooltip || patch?.variations?.find(vp => vp.uiTooltip)?.uiTooltip)
                            : patch?.uiTooltipNative));

                        const improvedId = IMPROVED_TECH_PAIRS[tech.id];
                        const isMongolActive = improvedId ? activeTechnologies.has(improvedId) : false;
                        const improvedTech = improvedId ? allTechnologies.find(t => t.id === improvedId) : undefined;

                        // Visual state per spec — CSS classes only, no inline hex
                        const iconStateClass = isLocked && !isActive
                          ? 'border-border/30 bg-secondary/30'
                          : !isActive
                            ? isForeignEngineering
                              ? 'border-orange-500/60 bg-orange-950/40 opacity-80'
                              : 'border-border/50 bg-secondary/50 opacity-60'
                            : isMongolActive
                              ? 'border-green-500 bg-green-500/10'
                              : 'border-green-500 bg-green-500/10';

                        return (
                          <div key={tech.id} className="relative">
                            {tech.unique && (
                              <div className="absolute bottom-1 left-0 w-4 h-4 rounded-full bg-background border border-border/20 flex items-center justify-center pointer-events-none z-10">
                                <img src="/unique.png" alt="" className="w-6 h-6 object-contain" />
                              </div>
                            )}

                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => !isLocked && onToggle(tech.id)}
                                    className={`w-12 h-12 rounded border-2 transition-all relative overflow-hidden ${isLocked ? 'opacity-30 cursor-not-allowed' : 'hover:scale-105 active:scale-95'} ${iconStateClass}`}
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
                                    <p className="text-xs text-muted-foreground mt-1">{tech.description}</p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            {/* Mongol upgrade badge — only for Mongol civ */}
                            {tech.hasMongolUpgrade && selectedCiv === 'mo' && (
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); onToggle(improvedId!); }}
                                      className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full border text-[9px] font-bold flex items-center justify-center transition-all hover:scale-110 active:scale-90 z-20 ${isMongolActive
                                          ? 'border-green-500 bg-green-900/80 text-green-400'
                                          : isActive
                                            ? 'border-orange-500 bg-orange-900/80 text-orange-400'
                                            : 'border-orange-500/40 bg-orange-900/30 text-orange-400/50'
                                        }`}
                                    >
                                      {isMongolActive ? '✓' : '+'}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="max-w-xs">
                                    <p className="font-semibold">{improvedTech?.name ?? 'Improved'}</p>
                                    {improvedTech?.description && (
                                      <p className="text-xs text-muted-foreground mt-1">{improvedTech.description}</p>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}

                            {patchTooltip && (
                              <TooltipProvider delayDuration={200}>
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
                      })}
                    </div>
                  );
                })}
              </div>
            );
          }

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
