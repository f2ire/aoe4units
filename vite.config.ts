import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
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
