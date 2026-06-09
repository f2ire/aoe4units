import { useState, useEffect, useMemo } from "react";
import { CIVILIZATIONS } from "@/data/civilizations";

const POLL_MS = 30_000;
const MAX_BACKOFF_MS = 300_000; // 5 min cap

// aoe4world uses lowercase snake_case civ slugs (verified live 2026-06-07).
// When a civ is randomized, aoe4world may append a sub-variant suffix
// (e.g. "sengoku_daimyo", "order_of_the_dragon_vlad") — map these to the base civ.
const CIV_MAP: Record<string, string> = {
  abbasid_dynasty: "ab", abbasid: "ab",
  ayyubids: "ay",
  byzantines: "by", byzantines_varangian: "by",
  chinese: "ch",
  delhi_sultanate: "de", delhi: "de",
  english: "en",
  french: "fr",
  golden_horde: "gol",
  holy_roman_empire: "hr", hre: "hr",
  house_of_lancaster: "hl", lancaster: "hl",
  japanese: "ja",
  jeanne_d_arc: "je",
  jin_dynasty: "jin", jin: "jin",
  knights_templar: "kt",
  macedonian_dynasty: "mac", macedonian: "mac",
  malians: "ma",
  mongols: "mo",
  order_of_the_dragon: "od", order_of_the_dragon_vlad: "od", dragon: "od",
  ottomans: "ot",
  rus: "ru",
  sengoku_dynasty: "sen", sengoku: "sen", sengoku_daimyo: "sen",
  tughlaq_dynasty: "tug", tughlaq: "tug",
  zhu_xi_s_legacy: "zx", zhuxi: "zx",
};

function mapCiv(raw: string): string | null {
  const key = raw.toLowerCase().replace(/[^a-z0-9]/g, "_");
  if (CIV_MAP[key]) return CIV_MAP[key];
  // Slug/name fallback for civs not yet in the explicit map.
  const c = CIVILIZATIONS.find(
    (c) => c.slug === key || c.slug === raw.toLowerCase() || c.name.toLowerCase() === raw.toLowerCase(),
  );
  return c?.abbr ?? null;
}

export interface Aoe4WorldDetection {
  /** Our civ abbreviation (e.g. "en", "fr") or null if unknown / no ongoing game. */
  detectedCiv: string | null;
  profileId: number | null;
  isPolling: boolean;
  error: string | null;
}

export function useAoe4WorldDetection(): Aoe4WorldDetection {
  // Dev shortcut: add ?civ=fr (or any abbr) to the URL to skip the API entirely.
  // e.g. http://localhost:8081/?civ=fr
  const devOverride = useMemo(() => {
    try { return new URLSearchParams(window.location.search).get("civ"); }
    catch { return null; }
  }, []);

  const [profileId, setProfileId] = useState<number | null>(null);
  const [detectedCiv, setDetectedCiv] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read profile_id from Twitch broadcaster configuration segment.
  useEffect(() => {
    if (devOverride) return;
    const ext = window.Twitch?.ext;
    if (!ext) return;

    function readConfig() {
      const seg = ext!.configuration.broadcaster;
      if (!seg?.content) return;
      try {
        const data = JSON.parse(seg.content) as { profileId?: number | string };
        const id = Number(data.profileId);
        if (id > 0) setProfileId(id);
      } catch { /* malformed config — ignore */ }
    }

    readConfig();
    ext.configuration.onChanged(readConfig);
  }, []);

  // Poll aoe4world whenever a valid profileId is available.
  useEffect(() => {
    if (devOverride || !profileId) return;

    let cancelled = false;
    let backoffMs = POLL_MS;
    let timeoutId: number;

    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch(
          `https://aoe4world.com/api/v0/players/${profileId}/games/last`,
        );
        if (!res.ok) {
          if (res.status === 429) backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
          throw new Error(`HTTP ${res.status}`);
        }
        const game = await res.json() as {
          ongoing?: boolean;
          teams?: { profile_id: number; civilization: string }[][];
        };

        if (!cancelled) {
          // ongoing = partie en cours ; just_finished = quelques secondes après la fin
          if (game.ongoing || game.just_finished) {
            outer: for (const team of game.teams ?? []) {
              for (const player of team) {
                if (player.profile_id === profileId) {
                  const abbr = mapCiv(player.civilization);
                  if (abbr) setDetectedCiv(abbr);
                  break outer;
                }
              }
            }
          }
          // Don't clear detectedCiv on game-end — keep last known civ until a new one arrives.
          setError(null);
          backoffMs = POLL_MS;
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "API error");
          backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
        }
      }
      if (!cancelled) timeoutId = window.setTimeout(poll, backoffMs);
    }

    setIsPolling(true);
    poll();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      setIsPolling(false);
    };
  }, [profileId]);

  if (devOverride) return { detectedCiv: devOverride, profileId: null, isPolling: false, error: null };
  return { detectedCiv, profileId, isPolling, error };
}
