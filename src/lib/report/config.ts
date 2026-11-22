// Public by nature (shipped in the JS bundle) — the Discord webhook and the
// Turnstile secret live only in the Worker (worker/report/, `wrangler secret put`).

/** POST endpoint of the deployed Worker, e.g. "https://aoe4units-report.<account>.workers.dev". Empty = not deployed yet.
 *  VITE_REPORT_ENDPOINT (e.g. in .env.local → http://localhost:8787 for `wrangler dev`) overrides it. */
export const REPORT_ENDPOINT: string = import.meta.env.VITE_REPORT_ENDPOINT || 'https://aoe4units-report.valo-proxy-twitchwidget.workers.dev/';

/** Turnstile site key for aoe4units.com. Empty = not configured yet. */
export const TURNSTILE_SITE_KEY = '0x4AAAAAAGNoEaYOK_zW1Ng_';

// Cloudflare's documented test key: always passes, so the dialog works on localhost
// without touching the production widget (its secret counterpart is set in worker/report/.dev.vars).
const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';

export const turnstileSiteKey = (): string =>
  import.meta.env.DEV ? TURNSTILE_TEST_SITE_KEY : TURNSTILE_SITE_KEY;

export const reportingConfigured = (): boolean =>
  REPORT_ENDPOINT !== '' && turnstileSiteKey() !== '';
