import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Replace "trip" with your actual GitHub repository name
export default defineConfig({
  plugins: [react()],
  base: "/trip/",   // ← must match your repo name exactly
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
