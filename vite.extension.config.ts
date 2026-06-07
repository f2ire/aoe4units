import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Separate build for the Twitch extension. Reuses the main app's `src/` via the
// `@/` alias. Multi-entry (panel + broadcaster config). Output is fully
// relative-pathed (`base: './'`) because Twitch serves extensions from a hashed,
// versioned CDN path — absolute paths would 404.
const root = path.resolve(__dirname, "extension");

export default defineConfig({
  root,
  base: "./",
  plugins: [react()],
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
  server: {
    port: 8081,
  },
});
