import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import sharp from "sharp";

// Separate build for the Twitch extension. Reuses the main app's `src/` via the
// `@/` alias. Multi-entry (panel + broadcaster config). Output is fully
// relative-pathed (`base: './'`) because Twitch serves extensions from a hashed,
// versioned CDN path — absolute paths would 404.
const root = path.resolve(__dirname, "extension");

// Redirect the data loaders' relative JSON imports (`./all-*.json` from
// src/data/*.ts) to the slimmed Phase 2 copies in extension/src/data/. A
// `resolveId` plugin is used instead of resolve.alias because relative-import
// aliasing is unreliable (the importer-relative specifier slips past alias
// matching, bundling the full 5+ MB data). The slim files are drop-in
// (`{ __version__, data }` shape), so the extension ships ~100 KB gzip of data
// while every reused component/hook still comes from the app's src/ via `@/`.
const SLIM_DATA_FILES = new Set(["all-unified.json", "all-optimized_abi.json", "all-optimized_tec.json"]);
function slimTwitchData() {
  return {
    name: "slim-twitch-data",
    enforce: "pre" as const,
    resolveId(source: string) {
      const m = source.match(/(?:^|[\\/])([^\\/]+\.json)$/);
      if (m && SLIM_DATA_FILES.has(m[1])) return path.resolve(root, "src/data", m[1]);
      return null;
    },
  };
}

// Cost icons and civ flags are copied as-is. Ability/tech/unit icons come partly
// from CDN (data.aoe4world.com) and partly from local paths set in patches/ — the
// local ones are resized to ICON_SIZE so the extension zip stays small.
const LOCAL_ASSET_FOLDERS = ["resources", "flags"];
const RESIZED_ASSET_FOLDERS = ["abilities", "technologies", "units"];
const ICON_SIZE = 128; // px — icons render at 34 px; 128 px covers 3.7× scale
const MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".gif": "image/gif",
};
const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

function copyLocalAssets() {
  const srcPublic = path.resolve(__dirname, "public");

  const copyDir = (from: string, to: string) => {
    fs.mkdirSync(to, { recursive: true });
    for (const e of fs.readdirSync(from, { withFileTypes: true })) {
      const s = path.join(from, e.name);
      const d = path.join(to, e.name);
      if (e.isDirectory()) copyDir(s, d);
      else fs.copyFileSync(s, d);
    }
  };

  const resizeDir = async (from: string, to: string) => {
    fs.mkdirSync(to, { recursive: true });
    for (const e of fs.readdirSync(from, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const s = path.join(from, e.name);
      const d = path.join(to, e.name);
      if (e.isDirectory()) {
        await resizeDir(s, d);
      } else if (IMAGE_EXTS.has(path.extname(e.name).toLowerCase())) {
        await sharp(s)
          .resize(ICON_SIZE, ICON_SIZE, { fit: "inside", withoutEnlargement: true })
          .toFile(d);
      } else {
        fs.copyFileSync(s, d);
      }
    }
  };

  return {
    name: "copy-local-assets",
    // Dev/preview: serve all asset folders directly from public/ (full res is fine in dev).
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const url = (req.url || "").split("?")[0];
        const allFolders = [...LOCAL_ASSET_FOLDERS, ...RESIZED_ASSET_FOLDERS];
        if (allFolders.some((f) => url.startsWith(`/${f}/`))) {
          const file = path.join(srcPublic, decodeURIComponent(url));
          if (fs.existsSync(file)) {
            res.setHeader("Content-Type", MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream");
            fs.createReadStream(file).pipe(res);
            return;
          }
        }
        next();
      });
    },
    // Build: copy as-is for small assets, resize to ICON_SIZE for icon folders.
    async closeBundle() {
      const outDir = path.resolve(__dirname, "dist-extension");
      for (const folder of LOCAL_ASSET_FOLDERS) {
        const from = path.join(srcPublic, folder);
        if (fs.existsSync(from)) copyDir(from, path.join(outDir, folder));
      }
      for (const folder of RESIZED_ASSET_FOLDERS) {
        const from = path.join(srcPublic, folder);
        if (fs.existsSync(from)) await resizeDir(from, path.join(outDir, folder));
      }
    },
  };
}

// Twitch CSP for extensions allows external scripts from 'self' (correct JS MIME)
// and inline <style> ('unsafe-inline'), but NOT inline <script>. Twitch's CDN also
// serves .css with the wrong MIME (text/plain → refused by strict MIME checking).
// So: keep JS external, and inline the CSS as a <style> tag (allowed) instead of a
// <link rel="stylesheet"> (blocked). This plugin swaps the stylesheet link for an
// inline <style> and drops the now-unused .css asset.
function inlineCss() {
  const outDir = path.resolve(__dirname, "dist-extension");
  return {
    name: "inline-css",
    enforce: "post" as const,
    // Per-HTML: inline the stylesheet(s) THIS page links (shared CSS is referenced
    // by both pages, so look it up by filename rather than deleting it eagerly).
    transformIndexHtml(html: string, ctx: any) {
      if (!ctx?.bundle) return html;
      const links = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g)];
      if (!links.length) return html;
      const styles: string[] = [];
      for (const m of links) {
        const base = (m[1].split("/").pop() || "").trim();
        const key = Object.keys(ctx.bundle).find((k) => k.endsWith(base));
        const asset = key ? ctx.bundle[key] : null;
        if (asset && asset.type === "asset") styles.push(String(asset.source));
      }
      const out = html.replace(/<link[^>]+rel="stylesheet"[^>]*>\s*/g, "");
      return {
        html: out,
        tags: styles.length ? [{ tag: "style", children: styles.join("\n"), injectTo: "head" as const }] : [],
      };
    },
    // After every page inlined its CSS, drop the now-unused external .css files
    // (emitted at the output root since assetsDir is "").
    closeBundle() {
      if (!fs.existsSync(outDir)) return;
      for (const f of fs.readdirSync(outDir)) {
        if (f.endsWith(".css")) fs.rmSync(path.join(outDir, f));
      }
    },
  };
}

export default defineConfig({
  root,
  base: "./",
  // Plain HTTP for local dev/preview — used only to view the overlay locally
  // (preview.html). Twitch testing goes through the Hosted Test zip (Twitch
  // serves it over its own HTTPS CDN), so no local HTTPS/cert is needed here.
  plugins: [slimTwitchData(), copyLocalAssets(), react(), inlineCss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // PostCSS/Tailwind config lives at the repo root (postcss.config.js +
  // tailwind.config.ts); point Vite there since `root` is now extension/.
  css: {
    postcss: path.resolve(__dirname, "./postcss.config.js"),
  },
  build: {
    outDir: path.resolve(__dirname, "dist-extension"),
    emptyOutDir: true,
    // Emit JS at the output ROOT (no `assets/` subfolder) so the zip is trivially
    // correct: every file sits next to index.html. Avoids the common case where a
    // subfolder is dropped from the zip → 404 on the JS, and any Twitch subpath
    // quirk. CSS is inlined (see inlineCss), images keep their own folders.
    assetsDir: "",
    rollupOptions: {
      input: {
        index: path.resolve(root, "index.html"),
        config: path.resolve(root, "config.html"),
      },
      output: {
        entryFileNames: "[name]-[hash].js",
        chunkFileNames: "[name]-[hash].js",
        assetFileNames: "[name]-[hash][extname]",
      },
    },
  },
  // Both dev and preview bind on all interfaces (host: true) so the server is
  // reachable at http://127.0.0.1:8081/ — the address Twitch's Local Test uses to
  // load the extension assets (Vite otherwise binds localhost/::1 only).
  server: {
    port: 8081,
    host: true,
  },
  preview: {
    port: 8081,
    host: true,
  },
});
