# AoE4 Units — Twitch Extension

Separate build target for the Twitch **Video-Overlay** extension. Reuses the main
app's `src/` via the `@/` alias (components, data, combat logic).

## Structure

```
extension/
├── index.html              # Overlay view (loads twitch-ext.min.js + src/Overlay.tsx)
├── config.html             # Broadcaster configuration view (loads src/config.tsx)
├── preview.html            # DEV-ONLY: overlay over a fake stream (not a build input)
├── src/
│   ├── Overlay.tsx         # Overlay entry — left icon rail + sliding unit panel
│   ├── config.tsx          # Broadcaster config entry
│   ├── UnitPanel.tsx       # Unit comparison panel shown in the overlay
│   ├── CompactUnitCard.tsx # Slimmed unit stat card for the panel
│   ├── CompactLoadout.tsx  # Compact tech/ability loadout display
│   ├── useAoe4WorldDetection.ts # Hook: detect live game/civs via aoe4world
│   ├── assetUrl.ts         # Resolve icon/asset URLs (CDN vs local-resized)
│   ├── twitch.d.ts         # Types for window.Twitch.ext (Helper SDK)
│   └── data/               # Slimmed JSON (units/abilities/techs) — see vite.extension.config.ts
└── README.md
```

## Commands

```bash
npm run dev:ext        # Vite dev server (port 8081) — open /preview.html to see the overlay
npm run build:ext      # Production build → dist-extension/ (relative paths, base: './')
npm run preview:ext    # Serve the built dist-extension/ locally (port 8081)
npm run zip:ext        # Build + zip dist-extension/ → aoe4-overlay.zip for upload
npm run build:ext-data # Regenerate the slimmed src/data/*.json from the main data
```

Upload `aoe4-overlay.zip` (produced by `npm run zip:ext`) in the Twitch Developer
Console under *Files* for the Hosted Test stage.

The main site build (`npm run build`, vite-react-ssg) is unaffected — it uses
`vite.config.ts` and does not see this folder.

## Notes

- **Relative paths are mandatory** for Twitch extensions (`base: './'` in
  `vite.extension.config.ts`), since the extension is served from a hashed,
  versioned path on Twitch's CDN.
- The Twitch Helper SDK (`twitch-ext.min.js`) is loaded from Twitch's exact URL
  in both HTML files — do not self-host or bundle it.
- Output goes to `dist-extension/` (gitignored). Zip its contents for upload to
  the Twitch Developer Console.
- External fetches (e.g. `aoe4world.com`) must be declared in the extension's
  *Allowlist for URL Fetching Domains* (see `docs/phase0-aoe4world-validation.md`).
