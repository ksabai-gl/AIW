import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // cursor-agent-bridge default: http://127.0.0.1:3847 — same-origin `/api/*` from this UI
      "/api": {
        target: "http://127.0.0.1:3847",
        changeOrigin: true,
        // Kiro/Cursor agent runs often exceed DevTools/default proxy idle timeouts (~2m), which surface as browser "Failed to fetch".
        timeout: 600_000,
        proxyTimeout: 600_000,
      },
    },
  },
});
