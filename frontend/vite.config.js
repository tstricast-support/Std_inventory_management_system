import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),

    VitePWA({
  registerType: "autoUpdate",
  manifest: false,
  workbox: {
    navigateFallback: "/index.html",
    navigateFallbackDenylist: [/^\/admin/],
        },
      }),
        ],

  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        admin: resolve(__dirname, "admin.html"),
      },
    },
  },
});