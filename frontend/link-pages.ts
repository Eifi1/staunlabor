/**
 * The pages a shared link to an exhibit is read from: the built `index.html`
 * once per exhibit, with that exhibit's title, summary, address and picture in
 * the tags a link preview reads (Open Graph, X's card, the description), as
 * `dist/<path>.html`, which Caddy serves for `/<path>` (deploy/Caddyfile).
 *
 * Files, because WhatsApp, Signal, Mastodon and the rest read the HTML as it
 * is sent and run no JavaScript: a title the app sets once it has loaded is
 * one they never see. Written by the build (`vite.config.ts`), never by hand;
 * the pictures are `public/previews/<exhibit>.jpg`, photographed by
 * `scripts/write-previews.mjs`. German only: a link preview's request names no
 * language, and de-CH is the site's fallback.
 *
 * What it deliberately does not do: change anything else in the page. The
 * scripts, the styles and the shell are the overview's to the byte, so the
 * site that loads from `/sky` is the site that loads from `/`.
 */

export const SITE = "https://staunlabor.app";

/** The pictures' size: Open Graph's large card, which WhatsApp shows whole. */
export const PREVIEW_SIZE = { width: 1200, height: 630 } as const;

/** An exhibit as its link preview names it. */
export interface LinkPage {
  exhibit: string;
  path: string;
  title: string;
  summary: string;
}

export interface LinkPageFile {
  file: string;
  html: string;
}

/** Every tag a link preview reads: the overview's are taken out, never left
 *  beside the exhibit's, since a reader that meets two `og:title`s may take
 *  either. */
const PREVIEW_TAG = /\s*<meta\s[^>]*(?:property="og:[^"]*"|name="(?:description|twitter:[^"]*)")[^>]*>/g;
const TITLE = /<title>[^<]*<\/title>/;
/** A route the router knows and a file name Caddy can try: lower-case letters. */
const PATH = /^\/[a-z]+$/;

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function previewImage(name: string): string {
  return `${SITE}/previews/${name}.jpg`;
}

/** The exhibits that have a page, with the German texts they are announced by.
 *  A built exhibit without its title or summary is an error, not a page that
 *  previews as "undefined". */
export function exhibitPages(
  entries: readonly { exhibit: string; path?: string | null }[],
  texts: Readonly<Record<string, { title?: string; summary?: string }>>,
): LinkPage[] {
  return entries.flatMap(({ exhibit, path }) => {
    if (!path) return [];
    const { title, summary } = texts[exhibit] ?? {};
    if (!title || !summary) throw new Error(`experiments.exhibits.${exhibit}: no title or summary in de-CH`);
    return [{ exhibit, path, title, summary }];
  });
}

/** `index` with `page`'s preview tags and title in place of the overview's. */
export function linkPage(index: string, page: LinkPage): LinkPageFile {
  if (!PATH.test(page.path)) throw new Error(`${page.path}: not a path a page can be written for`);
  if (!TITLE.test(index) || !index.includes("</head>")) throw new Error("index.html has no <title> or no </head>");
  const title = `${page.title} — Staunlabor`;
  const tags: [string, string, string][] = [
    ["name", "description", page.summary],
    ["property", "og:type", "website"],
    ["property", "og:site_name", "Staunlabor"],
    ["property", "og:locale", "de_CH"],
    ["property", "og:url", `${SITE}${page.path}`],
    ["property", "og:title", title],
    ["property", "og:description", page.summary],
    ["property", "og:image", previewImage(page.exhibit)],
    ["property", "og:image:type", "image/jpeg"],
    ["property", "og:image:width", String(PREVIEW_SIZE.width)],
    ["property", "og:image:height", String(PREVIEW_SIZE.height)],
    ["property", "og:image:alt", page.title],
    ["name", "twitter:card", "summary_large_image"],
  ];
  const head = tags.map(([kind, name, value]) => `    <meta ${kind}="${name}" content="${escapeHtml(value)}" />`);
  const html = index
    .replace(PREVIEW_TAG, "")
    .replace(TITLE, `<title>${escapeHtml(title)}</title>`)
    .replace("</head>", `${head.join("\n")}\n  </head>`);
  return { file: `${page.path.slice(1)}.html`, html };
}

export function linkPages(index: string, pages: readonly LinkPage[]): LinkPageFile[] {
  return pages.map((page) => linkPage(index, page));
}
