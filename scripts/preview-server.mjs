/**
 * What `write-previews.mjs` and `write-clips.mjs` share: a Vite dev server of
 * the site on a port of its own, whose `/api` goes to STAUNLABOR_PREVIEW_API
 * (default: the dev API, http://localhost:8002), and the cards it can show —
 * the overview and every exhibit with a page — read from the site's own
 * `exhibits.ts`, so a new exhibit is a card without a word here.
 *
 * Each script has its own port (PORTS), off the dev server's 5176, so the
 * site and both scripts can run side by side.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const FRONTEND = path.join(ROOT, "frontend");
const API = process.env.STAUNLABOR_PREVIEW_API ?? "http://localhost:8002";

/** The scripts' ports, one each, so neither waits for the other's. */
export const PORTS = { previews: 5196, clips: 5195 };

/**
 * Starts the server on `port`, hands `use` the cards to photograph (`asked`,
 * or every card when none is asked) and the server's origin, and closes the
 * server however `use` ends. An asked card that does not exist stops the run
 * before anything is photographed.
 */
export async function withPreviewServer(port, asked, use) {
  const server = await createServer({
    root: FRONTEND,
    configFile: path.join(FRONTEND, "vite.config.ts"),
    logLevel: "warn",
    server: { port, strictPort: true, proxy: { "/api": { target: API, changeOrigin: true } } },
  });
  await server.listen();
  try {
    const { EXHIBITS } = await server.ssrLoadModule("/src/features/experiments/exhibits.ts");
    const cards = ["overview", ...EXHIBITS.filter((entry) => entry.path).map((entry) => entry.exhibit)];
    const unknown = asked.filter((card) => !cards.includes(card));
    if (unknown.length) throw new Error(`no such card: ${unknown.join(", ")}`);
    return await use({ cards: asked.length ? asked : cards, origin: `http://localhost:${port}` });
  } finally {
    await server.close();
  }
}
