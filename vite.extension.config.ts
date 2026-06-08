import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

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

export default defineConfig({
  root,
  base: "./",
  // Plain HTTP for local dev/preview — used only to view the overlay locally
  // (preview.html). Twitch testing goes through the Hosted Test zip (Twitch
  // serves it over its own HTTPS CDN), so no local HTTPS/cert is needed here.
  plugins: [slimTwitchData(), react()],
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
    rollupOptions: {
      input: {
        index: path.resolve(root, "index.html"),
        config: path.resolve(root, "config.html"),
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
