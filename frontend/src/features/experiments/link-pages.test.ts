/// <reference types="node" />
// The test reads the pictures and the page from the disk, as the build does.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import de from "@/shared/i18n/locales/de-CH.json";
import { EXHIBITS } from "./exhibits";
import { exhibitPages, linkPage, linkPages, PREVIEW_SIZE, previewImage, SITE } from "../../../link-pages";

const at = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));
const INDEX = readFileSync(at("../../../index.html"), "utf8");
const PAGES = exhibitPages(EXHIBITS, de.experiments.exhibits);

/** A JPEG's size, from its frame header (SOF0–SOF3). */
function jpegSize(bytes: Buffer): { width: number; height: number } {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    const marker = bytes[offset + 1];
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += 2 + bytes.readUInt16BE(offset + 2);
  }
  throw new Error("no frame header");
}

const tagCount = (html: string, attribute: string) => html.split(attribute).length - 1;
const content = (html: string, attribute: string) => new RegExp(`${attribute} content="([^"]*)"`).exec(html)?.[1];

describe("the pages a shared link is read from", () => {
  it("writes one page per exhibit with a page, named for its route", () => {
    const files = linkPages(INDEX, PAGES).map((page) => page.file);
    expect(files).toEqual(EXHIBITS.map((entry) => `${entry.path.slice(1)}.html`));
  });

  it("puts the exhibit's own title, summary, address and picture where a link preview reads them, once each", () => {
    const sky = PAGES.find((page) => page.exhibit === "sky")!;
    const { html } = linkPage(INDEX, sky);
    const { title, summary } = de.experiments.exhibits.sky;
    expect(content(html, 'property="og:title"')).toBe(`${title} — Staunlabor`);
    expect(content(html, 'property="og:url"')).toBe(`${SITE}/sky`);
    expect(content(html, 'property="og:image"')).toBe(previewImage("sky"));
    expect(content(html, 'property="og:image:width"')).toBe(String(PREVIEW_SIZE.width));
    expect(content(html, 'property="og:image:height"')).toBe(String(PREVIEW_SIZE.height));
    expect(content(html, 'name="twitter:card"')).toBe("summary_large_image");
    expect(html).toContain(`<title>${title} — Staunlabor</title>`);
    for (const attribute of [
      'property="og:title"',
      'property="og:image"',
      'name="description"',
      'name="twitter:card"',
    ]) {
      expect(tagCount(html, attribute)).toBe(1);
    }
    expect(content(html, 'name="description"')).toBe(summary);
    expect(html).not.toContain(previewImage("overview"));
  });

  it("leaves everything else in the page as the overview's", () => {
    const strip = (html: string) =>
      html
        .replace(/\s*<meta\s[^>]*(?:property="og:[^"]*"|name="(?:description|twitter:[^"]*)")[^>]*>/g, "")
        .replace(/<title>[^<]*<\/title>/, "");
    for (const { html } of linkPages(INDEX, PAGES)) expect(strip(html)).toBe(strip(INDEX));
  });

  it("escapes what it writes into the page", () => {
    const { html } = linkPage(INDEX, { exhibit: "x", path: "/x", title: 'A "B" <C> & D', summary: "1 < 2" });
    expect(html).toContain("A &quot;B&quot; &lt;C&gt; &amp; D — Staunlabor");
    expect(html).toContain('content="1 &lt; 2"');
    expect(html).not.toContain("<C>");
  });

  it("refuses a route it could not name a file for, an index without its head, and an exhibit without its texts", () => {
    const page = { exhibit: "x", path: "/../x", title: "X", summary: "Y" };
    expect(() => linkPage(INDEX, page)).toThrow(/not a path/);
    expect(() => linkPage("<html></html>", { ...page, path: "/x" })).toThrow(/no <title>/);
    expect(() => exhibitPages([{ exhibit: "nothing", path: "/nothing" }], {})).toThrow(/nothing/);
  });

  it("announces the overview with its own picture", () => {
    expect(content(INDEX, 'property="og:image"')).toBe(previewImage("overview"));
    expect(content(INDEX, 'name="twitter:card"')).toBe("summary_large_image");
  });

  it("has a picture for every card, of the size it says and small enough for WhatsApp to show it large", () => {
    for (const card of ["overview", ...EXHIBITS.map((entry) => entry.exhibit)]) {
      const file = at(`../../../public/previews/${card}.jpg`);
      // Missing: `node scripts/write-previews.mjs ${card}`, and commit it.
      expect(existsSync(file), card).toBe(true);
      const bytes = readFileSync(file);
      expect(jpegSize(bytes), card).toEqual(PREVIEW_SIZE);
      expect(bytes.length, card).toBeLessThan(300_000);
    }
  });
});
