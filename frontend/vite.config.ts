import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { EXHIBITS } from "./src/features/experiments/exhibits";
import de from "./src/shared/i18n/locales/de-CH.json";
import { exhibitPages, linkPages } from "./link-pages";

/** The dev server's port and the API's: off the sibling apps' (Keksdose's
 *  5174/8000, Kurvenschmiede's 5175/8001), so all of them can run at once. */
const DEV_SERVER_PORT = 5176;
const API_TARGET = "http://localhost:8002";

/** The version the footer shows, from the one file the release bumps first. */
const APP_VERSION = (JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf8")) as { version: string })
  .version;

/** One page per exhibit for the link previews (`link-pages.ts`), written beside
 *  the built index.html once the bundle is on disk: the page each one copies
 *  must name the bundle's hashed files. */
function linkPagesPlugin(): Plugin {
  let outDir = "";
  return {
    name: "staunlabor:link-pages",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const index = readFileSync(path.join(outDir, "index.html"), "utf8");
      for (const page of linkPages(index, exhibitPages(EXHIBITS, de.experiments.exhibits))) {
        writeFileSync(path.join(outDir, page.file), page.html);
      }
    },
  };
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
    // One copy of each, however a dependency pins them: a second React is an
    // "invalid hook call" with nothing naming the cause.
    dedupe: ["react", "react-dom", "zustand", "recharts", "sonner", "react-router"],
  },
  plugins: [react(), tailwindcss(), linkPagesPlugin()],
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
      // preview-card.tsx is, like main.tsx, an entry that only mounts: the
      // dev-only page scripts/write-previews.mjs photographs.
      exclude: ["src/test/**", "src/**/*.test.*", "src/main.tsx", "src/preview-card.tsx", "src/vite-env.d.ts"],
      // A point under what the suite measured on 2026-11-13 (86.0 / 76.9 /
      // 78.2 / 87.3): the animations' branches are covered a tenth or two
      // differently from run to run, and a floor at the measure failed CI's
      // first run on that. Raised in the commit that earns it, never lowered
      // to pass.
      thresholds: { statements: 85, branches: 75.9, functions: 77, lines: 86.3 },
    },
  },
});
