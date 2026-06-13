import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import { cn } from "@/lib/utils";

interface PlayerResult {
  profile_id: number;
  name: string;
  rating?: number;
}

/** Accept a raw numeric ID or an aoe4world profile URL like /players/12345678-name. */
function extractProfileId(input: string): number | null {
  const trimmed = input.trim();
  const direct = Number(trimmed);
  if (Number.isInteger(direct) && direct > 0) return direct;
  const m = trimmed.match(/\/players\/(\d+)/);
  if (m) return Number(m[1]);
  return null;
}

type TestResult =
  | { ok: true; ongoing: true; playerName: string; civilization: string; map: string; kind: string }
  | { ok: true; ongoing: false; playerName: string }
  | { ok: false; error: string };

function Config() {
  const [profileInput, setProfileInput] = useState("");
  const [savedId, setSavedId] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "invalid">("idle");

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlayerResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Load existing config from Twitch on mount; also react to remote changes.
  useEffect(() => {
    const ext = window.Twitch?.ext;
    if (!ext) return;

    function readConfig() {
      const seg = ext!.configuration.broadcaster;
      if (!seg?.content) return;
      try {
        const data = JSON.parse(seg.content) as { profileId?: number | string };
        const id = Number(data.profileId);
        if (id > 0) {
          setSavedId(id);
          setProfileInput(String(id));
        }
      } catch { /* ignore */ }
    }

    readConfig();
    ext.configuration.onChanged(readConfig);
  }, []);

  function save() {
    const id = extractProfileId(profileInput);
    if (!id) {
      setSaveStatus("invalid");
      setTimeout(() => setSaveStatus("idle"), 3000);
      return;
    }

    const ext = window.Twitch?.ext;
    const payload = JSON.stringify({ profileId: id });
    if (ext) {
      ext.configuration.set("broadcaster", "1", payload);
    } else {
      // Dev fallback when running outside Twitch.
      try { localStorage.setItem("aoe4-ext-config", payload); } catch { /* ignore */ }
    }

    setSavedId(id);
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2500);
  }

  async function searchProfiles() {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    setSearchResults([]);
    try {
      const res = await fetch(
        `https://aoe4world.com/api/v0/players/search?query=${encodeURIComponent(q)}&limit=8`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { players?: PlayerResult[] };
      setSearchResults(data.players ?? []);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  function pickResult(p: PlayerResult) {
    setProfileInput(String(p.profile_id));
    setSearchResults([]);
    setSearchQuery("");
    setTestResult(null);
  }

  async function testApi() {
    const id = extractProfileId(profileInput);
    if (!id) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`https://aoe4world.com/api/v0/players/${id}/games/last`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const game = await res.json() as {
        ongoing?: boolean;
        just_finished?: boolean;
        map?: string;
        kind?: string;
        teams?: { profile_id: number; name: string; civilization: string }[][];
      };
      let playerName = `#${id}`;
      let civilization = "";
      for (const team of game.teams ?? []) {
        for (const p of team) {
          if (p.profile_id === id) { playerName = p.name; civilization = p.civilization; break; }
        }
      }
      if (game.ongoing || game.just_finished) {
        setTestResult({ ok: true, ongoing: true, playerName, civilization, map: game.map ?? "?", kind: game.kind ?? "?" });
      } else {
        setTestResult({ ok: true, ongoing: false, playerName });
      }
    } catch (e) {
      setTestResult({ ok: false, error: e instanceof Error ? e.message : "API error" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-5 text-zinc-100">
      <h1 className="mb-1 text-lg font-bold text-amber-400">AoE4 Units — Setup</h1>
      <p className="mb-5 text-sm text-zinc-400">
        Enter your <span className="text-zinc-200">aoe4world.com</span> profile ID once. The
        extension will auto-detect your civilization while you are in a game.
      </p>

      {/* ── Profile ID entry ── */}
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
        aoe4world profile ID or profile URL
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={profileInput}
          onChange={(e) => setProfileInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="12345678  or  https://aoe4world.com/players/12345678-…"
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={save}
          className={cn(
            "min-w-[72px] rounded-md px-4 py-2 text-sm font-semibold transition-colors",
            saveStatus === "saved"
              ? "bg-green-600 text-white"
              : saveStatus === "invalid"
                ? "bg-red-600 text-white"
                : "bg-amber-500 text-black hover:bg-amber-400",
          )}
        >
          {saveStatus === "saved" ? "Saved ✓" : saveStatus === "invalid" ? "Invalid" : "Save"}
        </button>
      </div>
      {savedId && saveStatus === "idle" && (
        <p className="mt-1.5 text-xs text-zinc-500">
          Active profile: <span className="font-mono text-zinc-300">{savedId}</span>
        </p>
      )}

      {/* ── API test ── */}
      <div className="mt-3">
        <button
          type="button"
          onClick={testApi}
          disabled={testing || !extractProfileId(profileInput)}
          className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-40"
        >
          {testing ? "Testing…" : "Test detection"}
        </button>
        {testResult && (
          <div className={cn(
            "mt-2 rounded-md border px-3 py-2 text-sm",
            !testResult.ok
              ? "border-red-800 bg-red-950/50 text-red-300"
              : testResult.ongoing
                ? "border-green-800 bg-green-950/50 text-green-300"
                : "border-zinc-700 bg-zinc-800/50 text-zinc-400",
          )}>
            {testResult.ok === false ? (
              <span>Error: {testResult.error}</span>
            ) : testResult.ongoing ? (
              <span>
                Game found — <strong className="text-white">{testResult.playerName}</strong>
                {" · "}civ: <strong className="text-amber-300">{testResult.civilization}</strong>
                <span className="ml-2 text-xs text-zinc-500">{testResult.map} · {testResult.kind}</span>
              </span>
            ) : (
              <span>Profile OK (<strong className="text-zinc-200">{testResult.playerName}</strong>) — no ongoing game right now.</span>
            )}
          </div>
        )}
      </div>

      {/* ── Username search helper ── */}
      <div className="mt-6">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Find your profile by in-game name
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchProfiles()}
            placeholder="In-game username…"
            className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={searchProfiles}
            disabled={searching}
            className="rounded-md bg-zinc-700 px-4 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-600 disabled:opacity-50"
          >
            {searching ? "…" : "Search"}
          </button>
        </div>
        {searchError && <p className="mt-1.5 text-xs text-red-400">{searchError}</p>}
        {searchResults.length > 0 && (
          <ul className="mt-2 overflow-hidden rounded-md border border-zinc-700 bg-zinc-900">
            {searchResults.map((p) => (
              <li key={p.profile_id}>
                <button
                  type="button"
                  onClick={() => pickResult(p)}
                  className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-amber-500/15"
                >
                  <span className="font-medium text-zinc-100">{p.name}</span>
                  <span className="font-mono text-xs text-zinc-400">
                    #{p.profile_id}
                    {p.rating != null && <span className="ml-2 text-zinc-500">{p.rating} MMR</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!searching && searchResults.length === 0 && searchQuery && !searchError && (
          <p className="mt-1.5 text-xs text-zinc-500">No results — try a different name.</p>
        )}
      </div>

      {/* ── How it works ── */}
      <div className="mt-8 rounded-md border border-zinc-800 bg-zinc-900/50 p-4 text-xs text-zinc-500">
        <p className="mb-2 font-semibold text-zinc-400">How it works</p>
        <ol className="list-inside list-decimal space-y-1">
          <li>
            Find your profile ID above (it's also in your aoe4world.com URL) and click{" "}
            <strong className="text-zinc-300">Save</strong>.
          </li>
          <li>While you're in a ranked or quick-match game your civilization is detected automatically.</li>
          <li>Viewers see your civ pre-selected in the unit browser — they can still override it.</li>
          <li>
            For custom / unranked games not tracked by aoe4world, viewers pick the civ manually.
          </li>
        </ol>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Config />
  </React.StrictMode>,
);
