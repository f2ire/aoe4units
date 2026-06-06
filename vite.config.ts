import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "node:fs";

// Rewrites dist/sitemap.xml after SSG, listing every pre-rendered unit page.
function generateSitemap() {
  const dist = path.resolve(__dirname, "dist");
  const unitsDir = path.join(dist, "units");
  const base = "https://aoe4units.com";
  const today = new Date().toISOString().slice(0, 10);

  const urls = ["/", "/units"];
  // Unit pages are nested as units/<civ>/<id>.html — walk recursively.
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".html")) {
        const rel = path.relative(dist, full).replace(/\\/g, "/").replace(/\.html$/, "");
        urls.push(`/${rel}`);
      }
    }
  };
  if (fs.existsSync(unitsDir)) walk(unitsDir);

  const body = urls
    .map(
      (u) =>
        `  <url>\n    <loc>${base}${u}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`,
    )
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

  fs.writeFileSync(path.join(dist, "sitemap.xml"), xml);
  console.log(`[sitemap] wrote ${urls.length} URLs to dist/sitemap.xml`);
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  ssgOptions: {
    // NOTE: do NOT set `script: "async"`. It adds `async` to the entry module in
    // <head>, which then races the inline scripts at the end of <body> that set
    // `window.__staticRouterHydrationData` and `window.__VITE_REACT_SSG_HASH__`.
    // When the module wins that race the hash is `undefined`, so vite-react-ssg
    // fetches `static-loader-data-manifest-undefined.json`, the host's SPA
    // fallback returns index.html, and `.json()` throws
    // "Unexpected token '<', "<!DOCTYPE "... is not valid JSON".
    // The default ("sync") leaves it a normal deferred module → inline scripts run first.
    formatting: "minify",
    onFinished: generateSitemap,
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Split the large bundled JSON data into its own chunk
          if (id.includes("/src/data/") && id.endsWith(".json")) return "data";
          if (id.includes("node_modules")) return "vendor";
        },
      },
    },
  },
}));
