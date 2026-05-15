import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    // Polling is required for file-watching through Docker bind mounts on
    // macOS and Windows hosts.
    watch: {
      usePolling: true,
    },
    hmr: {
      port: 5173,
    },
  },
});
