#!/usr/bin/env node
/**
 * Short clips for posts, `clips/<card>.mp4`: the link-preview card of
 * `frontend/src/features/experiments/preview-card.tsx`, but moving, a few
 * seconds of each exhibit's own preview at 1920 × 1008 (the card's 1200 × 630
 * at 1.6). A shared link shows only the card's still picture: LinkedIn reads
 * `og:image`, not `og:video`, and an animated GIF there stays on its first
 * frame. A clip uploaded into the post itself plays, with the link in the
 * text (Marcel, 2026-11-20).
 *
 *     node scripts/write-clips.mjs                     # every card
 *     node scripts/write-clips.mjs cone race           # these only
 *     node scripts/write-clips.mjs --lang en --seconds 12 cone
 *
 * The clips are not committed (`clips/` is in .gitignore): a few MB each, and
 * nothing on the site uses them.
 *
 * How, and why so:
 * - **The page's clock is Playwright's** (`page.clock`), paused: every frame
 *   advances the time by exactly 1/FPS and is then photographed, so a slow
 *   machine makes a slow run, never a stuttering or hurried clip. The previews
 *   draw from `requestAnimationFrame` and `performance.now`, which the clock
 *   drives. The run checks that the page's time over the frames is the
 *   clip's length. A clip still shows the preview's own pace: the pendulum
 *   wave's preview runs at twice the exhibit's time, the waterwheel's at four
 *   times, Foucault's at 3600 times (`PREVIEW_SPEED` and `preview ? n` in the
 *   pages).
 * - **The browser encodes**: the frames are played into a canvas at their
 *   rate and recorded by Chromium's MediaRecorder as MP4 (H.264), the one
 *   format every guide to LinkedIn's uploads agrees on. No ffmpeg, no package.
 *
 * Like `write-previews.mjs` it starts its own Vite dev server
 * (`preview-server.mjs`), whose `/api` goes to STAUNLABOR_PREVIEW_API
 * (default: the dev API, http://localhost:8002).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { PORTS, ROOT, withPreviewServer } from "./preview-server.mjs";

const OUT = path.join(ROOT, "clips");
const FPS = 30;
/** The card's size, and the scale it is photographed at: 1920 × 1008, even
 *  on both sides as H.264 wants, and sharp in a feed's full width. */
const CARD = { width: 1200, height: 630 };
const SCALE = 1.6;
/** H.264 at this rate: drawings on a plain ground stay clean. */
const BITRATE = 8_000_000;
/** Played before the first frame: past the very first instant, where some
 *  previews have not drawn their motion yet. The smoke ring needs its push. */
const PREROLL_DEFAULT_MS = 500;
const PREROLL_MS = { smoke: 2500 };

function options(argv) {
  const out = { lang: "de-CH", seconds: 10, cards: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--lang") out.lang = argv[++i];
    else if (argv[i] === "--seconds") out.seconds = Number(argv[++i]);
    else out.cards.push(argv[i]);
  }
  if (!(out.seconds > 0 && out.seconds <= 60)) throw new Error("--seconds: 1 to 60");
  return out;
}

/** Lets the page's pending React work run: a message, which the fake clock
 *  does not hold back as it holds timeouts. */
const settle = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => resolve();
        channel.port2.postMessage(0);
      }),
  );

/** The card, loaded under the fake clock, and its frames as JPEG. */
async function frames(page, origin, card, lang, seconds) {
  // Paused at once: an installed clock otherwise also runs in real time, and
  // every screenshot's own time went into the clip on top of its 1/FPS.
  const start = Date.now();
  await page.clock.install({ time: start });
  await page.clock.pauseAt(start + 1000);
  await page.goto(`${origin}/preview-card.html?card=${card}&lang=${lang}`);
  // Loading needs the network (real) and the page's timers (the clock's):
  // both, a little at a time.
  const deadline = Date.now() + 60_000;
  while (!(await page.evaluate(() => document.documentElement.dataset.loaded === "true"))) {
    if (Date.now() > deadline) throw new Error(`${card}: not loaded after 60 s`);
    await page.clock.runFor(50);
    await page.waitForTimeout(50);
  }
  await page.clock.runFor(PREROLL_MS[card] ?? PREROLL_DEFAULT_MS);
  const shots = [];
  const before = await page.evaluate(() => performance.now());
  for (let i = 0; i < seconds * FPS; i++) {
    // Whole milliseconds, 33, 33, 34, …: the clock rounds a step of 33.3 up,
    // which made each second 1.02.
    await page.clock.runFor(Math.round(((i + 1) * 1000) / FPS) - Math.round((i * 1000) / FPS));
    await settle(page);
    shots.push((await page.screenshot({ type: "jpeg", quality: 92 })).toString("base64"));
  }
  // The page's time over the frames is the clip's, or the clip plays at the
  // wrong speed: a clock left running added each screenshot's own time, and
  // the first clips ran several times too fast (Marcel, 2026-11-20).
  const filmed = (await page.evaluate(() => performance.now())) - before;
  if (Math.abs(filmed - seconds * 1000) > 1) {
    throw new Error(`${card}: ${(filmed / 1000).toFixed(2)} s of the page in ${seconds} s of clip`);
  }
  return shots;
}

/** The frames played into a canvas at FPS and recorded as MP4, in a page of
 *  its own with a real clock. */
async function encode(page, shots) {
  await page.evaluate(() => {
    window.clipFrames = [];
  });
  for (const shot of shots) {
    await page.evaluate(async (data) => {
      const blob = await (await fetch(`data:image/jpeg;base64,${data}`)).blob();
      window.clipFrames.push(await createImageBitmap(blob));
    }, shot);
  }
  const base64 = await page.evaluate(
    async ({ fps, bitrate }) => {
      const pictures = window.clipFrames;
      const canvas = document.createElement("canvas");
      canvas.width = pictures[0].width;
      canvas.height = pictures[0].height;
      const context = canvas.getContext("2d");
      context.drawImage(pictures[0], 0, 0);
      const stream = canvas.captureStream(0);
      const [track] = stream.getVideoTracks();
      const type = "video/mp4;codecs=avc1.640028";
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported(type) ? type : "video/mp4",
        videoBitsPerSecond: bitrate,
      });
      const chunks = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      const stopped = new Promise((resolve) => (recorder.onstop = resolve));
      recorder.start();
      const start = performance.now();
      for (let i = 0; i < pictures.length; i++) {
        const due = start + (i * 1000) / fps;
        while (performance.now() < due) {
          await new Promise((resolve) => setTimeout(resolve, Math.max(0, due - performance.now() - 1)));
        }
        context.drawImage(pictures[i], 0, 0);
        track.requestFrame();
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 / fps));
      recorder.stop();
      await stopped;
      const bytes = new Uint8Array(await new Blob(chunks, { type: "video/mp4" }).arrayBuffer());
      let text = "";
      for (let i = 0; i < bytes.length; i += 0x8000) {
        text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      return btoa(text);
    },
    { fps: FPS, bitrate: BITRATE },
  );
  return Buffer.from(base64, "base64");
}

const { lang, seconds, cards: asked } = options(process.argv.slice(2));
await withPreviewServer(PORTS.clips, asked, async ({ cards, origin }) => {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    const encoder = await browser.newPage();
    await encoder.goto("about:blank");
    for (const card of cards) {
      // A fresh page for each card: the fake clock is installed once a page.
      const page = await browser.newPage({
        viewport: CARD,
        deviceScaleFactor: SCALE,
        colorScheme: "light",
        reducedMotion: "no-preference",
        locale: lang,
      });
      page.on("pageerror", (error) => console.error(`  page error: ${error.message}`));
      try {
        const shots = await frames(page, origin, card, lang, seconds);
        const file = path.join(OUT, lang === "de-CH" ? `${card}.mp4` : `${card}.${lang}.mp4`);
        const clip = await encode(encoder, shots);
        await writeFile(file, clip);
        console.log(`${card} → ${path.relative(process.cwd(), file)} (${(clip.length / 1e6).toFixed(1)} MB)`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
});
