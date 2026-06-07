# AoE4 Units — Twitch Extension

Separate build target for the Twitch extension. Reuses the main app's `src/` via
the `@/` alias (components, data, combat logic) — **no business logic lives here yet**.

## Structure

```
extension/
├── index.html        # Twitch panel view (loads twitch-ext.min.js + src/panel.tsx)
├── config.html       # Broadcaster configuration view (loads src/config.tsx)
├── src/
│   ├── panel.tsx     # Panel entry — renders "OK" for now
│   ├── config.tsx    # Config entry — renders "OK" for now
│   └── twitch.d.ts   # Types for window.Twitch.ext (Helper SDK)
└── README.md
```

## Commands

```bash
npm run dev:ext     # Vite dev server for the extension (vite.extension.config.ts)
npm run build:ext   # Production build → dist-extension/ (relative paths, base: './')
```

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
