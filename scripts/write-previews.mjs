#!/usr/bin/env node
/**
 * The link-preview pictures, `frontend/public/previews/<card>.jpg`: one per
 * exhibit with a page and one for the overview, each the card of
 * `frontend/src/features/experiments/preview-card.tsx` photographed at
 * 1200 × 630 in a headless Chromium (Playwright). The built pages name them
 * in their `og:image` (`frontend/link-pages.ts`).
 *
 *     node scripts/write-previews.mjs                 # every card
 *     node scripts/write-previews.mjs sky wave        # these only
 *
 * Run it after a new exhibit or a changed drawing, and commit the pictures:
 * the build does not take them, so a deploy never depends on a browser.
 * `link-pages.test.ts` fails while an exhibit has none.
 *
 * It starts its own Vite dev server (`preview-server.mjs`), whose `/api` goes
 * to STAUNLABOR_PREVIEW_API (default: the dev API, http://localhost:8002), so
 * the previews that ask the engine are answered; `https://staunlabor.app`
 * serves while the engine there is the branch's.
 *
 * Each preview plays for its SETTLE (ms) and is then held: the picture is that
 * moment, chosen per exhibit where the default shows nothing yet. Playing runs
 * on the clock, so a second run's pictures differ by a frame or two.
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { FRONTEND, PORTS, withPreviewServer } from "./preview-server.mjs";

const OUT = path.join(FRONTEND, "public/previews");
const SETTLE_DEFAULT = 3000;
/** The smoke ring needs a push and a second to rise before there is a ring to see. */
const SETTLE = { smoke: 6000 };
/** JPEG at this quality: a card is 60–150 kB, under WhatsApp's limit for a
 *  large picture, which a PNG of the same card is not. */
const QUALITY = 85;

await withPreviewServer(PORTS.previews, process.argv.slice(2), async ({ cards, origin }) => {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 630 },
      colorScheme: "light",
      reducedMotion: "no-preference",
      locale: "de-CH",
    });
    page.on("pageerror", (error) => console.error(`  page error: ${error.message}`));
    for (const card of cards) {
      await page.goto(`${origin}/preview-card.html?card=${card}`);
      await page.waitForFunction(() => document.documentElement.dataset.loaded === "true", null, {
        timeout: 60_000,
      });
      await page.waitForTimeout(SETTLE[card] ?? SETTLE_DEFAULT);
      await page.evaluate(() => window.holdStill());
      await page.waitForFunction(() => document.documentElement.dataset.held === "true");
      const file = path.join(OUT, `${card}.jpg`);
      await page.screenshot({ path: file, type: "jpeg", quality: QUALITY });
      console.log(`${card} → ${path.relative(process.cwd(), file)}`);
    }
  } finally {
    await browser.close();
  }
});
