// Inline panel to replace the icon of a unit, technology or ability.

import { useState } from "react";
import { ArrowRight, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { IconReport } from "@/lib/report/types";

interface IconEditorProps {
  target: IconReport["target"];
  existing?: IconReport;
  onSave: (r: IconReport) => void;
  onRemove: () => void;
  onClose: () => void;
}

const isHttps = (s: string) => /^https:\/\/\S+$/i.test(s.trim());

export function IconEditor({ target, existing, onSave, onRemove, onClose }: IconEditorProps) {
  const [url, setUrl] = useState(existing?.newIcon ?? "");
  const [broken, setBroken] = useState(existing?.broken ?? false);
  const [error, setError] = useState("");

  const save = () => {
    const u = url.trim();
    if (!u && !broken) { setError("Paste the right image address, or tick “the icon is broken”."); return; }
    if (u && !isHttps(u)) { setError("The image address must start with https://"); return; }
    onSave({ kind: "icon", target, newIcon: u, broken });
  };

  const kindText = target.kind === "unit" ? "unit" : target.kind === "tech" ? "technology" : "ability";
  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-secondary/40 p-3 animate-in fade-in-0 slide-in-from-top-1 duration-200">
      <p className="text-sm font-medium">Icon of the {kindText} <span className="text-primary">{target.name}</span></p>
      <div className="flex items-center gap-3">
        <figure className="flex flex-col items-center gap-1">
          {target.currentIcon
            ? <img src={target.currentIcon} alt="Current icon" className="h-14 w-14 rounded-md border border-border/60 object-cover" />
            : <span className="grid h-14 w-14 place-items-center rounded-md border border-border/60"><ImageOff className="h-5 w-5 text-muted-foreground" /></span>}
          <figcaption className="text-[11px] text-muted-foreground">Now</figcaption>
        </figure>
        <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
        <figure className="flex flex-col items-center gap-1">
          {isHttps(url)
            ? <img src={url.trim()} alt="New icon preview" className="h-14 w-14 rounded-md border border-primary/60 object-cover" />
            : <span className="h-14 w-14 rounded-md border border-dashed border-border" />}
          <figcaption className="text-[11px] text-muted-foreground">New</figcaption>
        </figure>
      </div>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium">Correct image address</span>
        <Input aria-label="Correct image address" value={url} onChange={e => { setUrl(e.target.value); setError(""); }} placeholder="https://data.aoe4world.com/images/…" />
        <span className="text-muted-foreground">Right-click the right icon on aoe4world or the wiki → “Copy image address”.</span>
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={broken} onChange={e => setBroken(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
        The current icon is broken or does not load
      </label>
      {error && <p className="text-xs text-red-400" role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        {existing && <Button type="button" variant="ghost" size="sm" onClick={onRemove}>Remove correction</Button>}
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Close</Button>
        <Button type="button" size="sm" onClick={save}>{existing ? "Update" : "Add to corrections"}</Button>
      </div>
    </div>
  );
}
