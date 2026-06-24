import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const hmrHost = process.env.VITE_HMR_HOST;
const devHost = process.env.VITE_DEV_HOST ?? "0.0.0.0";
const bffDevTarget = process.env.VITE_BFF_DEV_TARGET ?? "http://127.0.0.1:8080";

export default defineConfig({
  cacheDir: "node_modules/.vite-cache",

  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react-router-dom",
      "@tanstack/react-query",
      "zustand",
      "clsx",
      "tailwind-merge",
      "class-variance-authority",
    ],
  },

  build: {
    target: "es2020",
    sourcemap: false,
    assetsInlineLimit: 4096,
  },

  server: {
    host: devHost,
    port: 5173,
    strictPort: true,

    warmup: {
      clientFiles: [
        "./src/main.tsx",
        "./src/app/App.tsx",
        "./src/app/router.tsx",
        "./src/components/layout/app-shell.tsx",
        "./src/components/layout/sidebar.tsx",
        "./src/components/layout/topbar.tsx",
        "./src/styles/globals.css",
      ],
    },

    hmr: hmrHost
      ? {
          host: hmrHost,
          protocol: "ws",
          port: 5173,
          clientPort: 5173,
        }
      : undefined,

    proxy: {
      "/web-api": {
        target: bffDevTarget,
        changeOrigin: true,
      },
      "/node-api": {
        target: bffDevTarget,
        changeOrigin: true,
      },
      "/node-ws": {
        target: bffDevTarget,
        changeOrigin: true,
        ws: true,
      },
      "/healthz": {
        target: bffDevTarget,
        changeOrigin: true,
      },
    },
  },
});
