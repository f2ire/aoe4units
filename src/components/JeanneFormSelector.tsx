import { useState } from "react";
import type { AoE4Unit } from "@/data/unified-units";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";

export const JEANNE_FORM_TREE = [
  { level: 1, forms: [{ id: 'jeanne-darc-peasant',      label: 'Peasant',        col: 'both'   as const }] },
  { level: 2, forms: [
    { id: 'jeanne-darc-woman-at-arms', label: 'Woman-at-Arms',  col: 'melee'  as const },
    { id: 'jeanne-darc-hunter',        label: 'Hunter',         col: 'ranged' as const },
  ]},
  { level: 3, forms: [
    { id: 'jeanne-darc-knight',         label: 'Knight',         col: 'melee'  as const },
    { id: 'jeanne-darc-mounted-archer', label: 'Mounted Archer', col: 'ranged' as const },
  ]},
  { level: 4, forms: [
    { id: 'jeanne-darc-blast-cannon', label: 'Blast Cannon', col: 'melee'  as const },
    { id: 'jeanne-darc-markswoman',   label: 'Markswoman',   col: 'ranged' as const },
  ]},
] as const;

export const isJeanneUnit = (unit: AoE4Unit | null | undefined): boolean =>
  !!unit?.classes?.includes('jeanne_d_arc');

const flatForms = JEANNE_FORM_TREE.flatMap(({ level, forms }) =>
  forms.map(f => ({ ...f, level }))
);

interface JeanneFormSelectorProps {
  mode: 'panel' | 'list';
  allForms: AoE4Unit[];
  currentFormId?: string;
  onSelect: (unit: AoE4Unit) => void;
}

export const JeanneFormSelector = ({ allForms, currentFormId, onSelect }: JeanneFormSelectorProps) => {
  const [open, setOpen] = useState(false);
  const formsById = Object.fromEntries(allForms.map(u => [u.id, u]));
  const currentEntry = flatForms.find(f => f.id === currentFormId);
  const currentUnit = currentFormId ? formsById[currentFormId] : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-2 w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm hover:bg-accent transition-colors"
        >
          {currentUnit && currentEntry ? (
            <>
              <img src={currentUnit.icon} alt={currentUnit.name} className="w-5 h-5 object-contain flex-shrink-0" />
              <span className="text-xs text-muted-foreground">Lv{currentEntry.level}</span>
              <span className="font-medium flex-1 text-left">{currentEntry.label}</span>
            </>
          ) : (
            <span className="text-muted-foreground flex-1 text-left">Select form...</span>
          )}
          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-2 bg-popover border-border w-64" align="start">
        {/* Column headers */}
        <div className="grid grid-cols-2 gap-1 mb-1 px-1">
          <span className="text-[10px] font-semibold text-orange-400 uppercase tracking-wide text-center">Melee</span>
          <span className="text-[10px] font-semibold text-sky-400 uppercase tracking-wide text-center">Ranged</span>
        </div>

        <div className="space-y-1">
          {JEANNE_FORM_TREE.map(({ level, forms }) => (
            <div key={level} className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground w-6 flex-shrink-0 text-right">Lv{level}</span>
              {forms.length === 1 ? (
                /* Lv1 Peasant — full width */
                <button
                  key={forms[0].id}
                  onClick={() => {
                    const unit = formsById[forms[0].id];
                    if (unit) { onSelect(unit); setOpen(false); }
                  }}
                  className={`col-span-2 flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors
                    ${currentFormId === forms[0].id
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : 'hover:bg-accent hover:text-accent-foreground'
                    }`}
                >
                  {(() => {
                    const u = formsById[forms[0].id];
                    return u ? <img src={u.icon} alt={u.name} className="w-5 h-5 object-contain flex-shrink-0" /> : null;
                  })()}
                  <span>{forms[0].label}</span>
                </button>
              ) : (
                /* Lv2–4 — two columns */
                <div className="flex-1 grid grid-cols-2 gap-1">
                  {forms.map(form => {
                    const unit = formsById[form.id];
                    if (!unit) return null;
                    const isActive = currentFormId === form.id;
                    return (
                      <button
                        key={form.id}
                        onClick={() => { onSelect(unit); setOpen(false); }}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors
                          ${isActive
                            ? form.col === 'melee'
                              ? 'bg-orange-500/20 text-orange-300 font-semibold ring-1 ring-orange-500/50'
                              : 'bg-sky-500/20 text-sky-300 font-semibold ring-1 ring-sky-500/50'
                            : 'hover:bg-accent hover:text-accent-foreground'
                          }`}
                      >
                        <img src={unit.icon} alt={unit.name} className="w-5 h-5 object-contain flex-shrink-0" />
                        <span className="truncate">{form.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
