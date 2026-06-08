// Resolve an image path for the Twitch extension. Twitch serves the extension
// from a hashed, versioned CDN path, so repo-absolute public paths ("/flags/x.png")
// would 404 — they must be relative to the extension's own base. Remote (http/https)
// and data: URIs are returned untouched.
export function assetUrl(p?: string): string {
  if (!p) return p ?? "";
  if (/^(https?:)?\/\//.test(p) || p.startsWith("data:")) return p;
  return p.replace(/^\/+/, "");
}
