// aoe4units community-report relay.
// Browser → POST JSON → this Worker → Discord webhook (embed + report-<id>.ts attachment).
// Holds the secrets the static site cannot: DISCORD_WEBHOOK_URL, TURNSTILE_SECRET.

interface RateLimit {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

interface Env {
  DISCORD_WEBHOOK_URL: string;
  TURNSTILE_SECRET: string;
  /** Comma-separated origins allowed to post (CORS + check). */
  ALLOWED_ORIGINS: string;
  REPORT_LIMITER?: RateLimit;
}

interface Submission {
  turnstileToken: string;
  title: string;
  summary: string[];
  patch: string;
  report: {
    id: string;
    appVersion?: string;
    source?: string;
    reporter?: string;
    corrections: { kind: string }[];
    context?: { unitName?: string; civName?: string; age?: number; link?: string };
  };
}

const MAX_BODY_BYTES = 64_000;
const KIND_COLORS: Record<string, number> = { value: 0xe0b341, upgrade: 0x8b5cf6, icon: 0x3b82f6, missing: 0x22c55e };
const KIND_LABELS: Record<string, string> = { value: 'Wrong value', upgrade: 'Tech / Ability', icon: 'Icon', missing: 'Missing' };

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  if (!origin || !allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const reply = (status: number, message: string, cors: Record<string, string>) =>
  new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...cors } });

function validate(x: unknown): Submission | string {
  const s = x as Submission;
  if (!s || typeof s !== 'object') return 'Invalid body';
  if (typeof s.turnstileToken !== 'string' || !s.turnstileToken) return 'Missing anti-bot token';
  if (typeof s.title !== 'string' || !s.title) return 'Missing title';
  if (!Array.isArray(s.summary) || s.summary.some(l => typeof l !== 'string') || s.summary.length > 20) return 'Invalid summary';
  if (typeof s.patch !== 'string' || !s.patch) return 'Missing patch';
  if (!s.report || typeof s.report !== 'object' || typeof s.report.id !== 'string' || !/^[a-z0-9]{1,12}$/.test(s.report.id)) return 'Invalid report id';
  const c = s.report.corrections;
  if (!Array.isArray(c) || c.length === 0 || c.length > 30) return 'A report needs 1 to 30 corrections';
  if (c.some(x => !x || typeof x.kind !== 'string' || !(x.kind in KIND_LABELS))) return 'Invalid correction kind';
  return s;
}

async function verifyTurnstile(token: string, ip: string, env: Env): Promise<boolean> {
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

function discordPayload(s: Submission) {
  const r = s.report;
  const ctx = r.context;
  const kinds = [...new Set(r.corrections.map(c => c.kind))];
  const typeText = kinds.map(k => `${KIND_LABELS[k]}${r.corrections.length > 1 ? ` ×${r.corrections.filter(c => c.kind === k).length}` : ''}`).join(', ');
  const fields = [
    { name: r.corrections.length > 1 ? `${r.corrections.length} corrections` : 'Type', value: typeText, inline: true },
    ...(ctx?.unitName ? [{ name: 'Unit', value: clip(`${ctx.unitName} · ${ctx.civName ?? ''} · age ${ctx.age ?? '?'}`, 256), inline: true }] : []),
    ...(r.reporter ? [{ name: 'Reporter', value: clip(r.reporter, 100), inline: true }] : []),
    ...(r.source ? [{ name: 'Source', value: clip(r.source, 1000) }] : []),
  ];
  const link = ctx?.link && /^https?:\/\//.test(ctx.link) ? ctx.link : undefined;
  return {
    username: 'aoe4units reports',
    // Never ping anyone, whatever a reporter types.
    allowed_mentions: { parse: [] as string[] },
    embeds: [{
      title: clip(s.title, 256),
      url: link,
      description: clip(s.summary.join('\n'), 3500),
      color: kinds.length === 1 ? KIND_COLORS[kinds[0]] : 0xe0b341,
      fields,
      footer: { text: `report ${r.id} · patch ${clip(r.appVersion ?? '?', 30)} · full patch attached` },
      timestamp: new Date().toISOString(),
    }],
  };
}

async function postToDiscord(s: Submission, env: Env): Promise<Response> {
  const form = new FormData();
  form.append('payload_json', JSON.stringify(discordPayload(s)));
  form.append('files[0]', new Blob([s.patch], { type: 'text/plain' }), `report-${s.report.id}.ts`);
  return fetch(env.DISCORD_WEBHOOK_URL, { method: 'POST', body: form });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: cors['Access-Control-Allow-Origin'] ? 204 : 403, headers: cors });
    if (request.method !== 'POST') return reply(405, 'Method not allowed', cors);
    if (!cors['Access-Control-Allow-Origin']) return reply(403, 'Origin not allowed', cors);

    const ip = request.headers.get('CF-Connecting-IP') ?? '';
    if (env.REPORT_LIMITER) {
      const { success } = await env.REPORT_LIMITER.limit({ key: ip || 'unknown' });
      if (!success) return reply(429, 'Too many reports — please wait a minute.', cors);
    }

    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return reply(413, 'Report too large', cors);
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return reply(400, 'Invalid JSON', cors); }
    const sub = validate(parsed);
    if (typeof sub === 'string') return reply(400, sub, cors);

    if (!(await verifyTurnstile(sub.turnstileToken, ip, env))) return reply(403, 'Anti-bot check failed — please retry.', cors);

    const res = await postToDiscord(sub, env);
    if (!res.ok) return reply(502, `Discord rejected the report (${res.status})`, cors);
    return reply(200, 'ok', cors);
  },
};
