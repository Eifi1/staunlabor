import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { readFileSync } from "node:fs";

/** The dev server's port and the API's: off the sibling apps' (Keksdose's
 *  5174/8000, Kurvenschmiede's 5175/8001), so all of them can run at once. */
const DEV_SERVER_PORT = 5176;
const API_TARGET = "http://localhost:8002";

/** The version the footer shows, from the one file the release bumps first. */
const APP_VERSION = (JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf8")) as { version: string })
  .version;

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
    // One copy of each, however a dependency pins them: a second React is an
    // "invalid hook call" with nothing naming the cause.
    dedupe: ["react", "react-dom", "zustand", "recharts", "sonner", "react-router"],
  },
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Vendor chunks by where a module lives, so a deploy that changes the
        // site's own code does not make every reader download React again;
        // recharts and KaTeX only with the pages that draw them.
        manualChunks(id) {
          const at = id.lastIndexOf("node_modules/");
          if (at < 0) return;
          const rest = id.slice(at + "node_modules/".length);
          const pkg = rest.startsWith("@") ? rest.split("/").slice(0, 2).join("/") : rest.split("/")[0];
          if (["react", "react-dom", "scheduler", "react-router", "clsx"].includes(pkg)) return "react";
          if (pkg === "recharts") return "charts";
          if (pkg === "katex") return "katex";
          if (pkg.startsWith("@tanstack/")) return "query";
          if (["i18next", "react-i18next"].includes(pkg)) return "i18n";
          return;
        },
      },
    },
  },
  server: {
    port: DEV_SERVER_PORT,
    proxy: { "/api": { target: API_TARGET, changeOrigin: true } },
  },
  preview: {
    port: 4176,
    proxy: { "/api": { target: API_TARGET, changeOrigin: true } },
  },
  test: {
    globals: true,
    clearMocks: true,
    restoreMocks: true,
    // A whole exhibit page under v8 coverage on a two-core runner: generous,
    // because what a timeout is for is a test that never finishes.
    testTimeout: 30_000,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    sequence: { hooks: "list" },
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html"],
      include: ["src/**"],
      exclude: ["src/test/**", "src/**/*.test.*", "src/main.tsx", "src/vite-env.d.ts"],
      // What the suite measured on 2026-11-13, truncated: a floor, raised in
      // the commit that earns it, never lowered to pass.
      thresholds: { statements: 86.0, branches: 76.9, functions: 78.1, lines: 87.3 },
    },
  },
});
