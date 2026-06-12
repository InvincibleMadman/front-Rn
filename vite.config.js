var _a, _b;
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
var hmrHost = process.env.VITE_HMR_HOST;
var devHost = (_a = process.env.VITE_DEV_HOST) !== null && _a !== void 0 ? _a : "0.0.0.0";
var bffDevTarget = (_b = process.env.VITE_BFF_DEV_TARGET) !== null && _b !== void 0 ? _b : "http://127.0.0.1:8080";
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
