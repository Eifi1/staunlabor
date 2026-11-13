/**
 * The seven catalogues against each other: every language has every key the
 * Swiss German one has and no other, no string is empty, and each keeps the
 * placeholders of the German one — a translation that dropped `{{version}}`
 * would print the braces. The credit to the museum says "inspired by" and
 * never "from": the exhibits are this site's own.
 */
import { describe, expect, it } from "vitest";
import deCH from "./locales/de-CH.json";
import { LANGUAGE_CODES } from "./languages";

type Tree = { [key: string]: string | Tree };

const CATALOGUES = import.meta.glob<Tree>("./locales/*.json", { eager: true, import: "default" });

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

const placeholders = (text: string) => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();

const german = flatten(deCH as Tree);

describe("the catalogues", () => {
  it("are one per language the site offers", () => {
    const files = Object.keys(CATALOGUES)
      .map((path) => path.replace(/^.*\/(.+)\.json$/, "$1"))
      .sort();
    expect(files).toEqual([...LANGUAGE_CODES].sort());
  });

  for (const code of LANGUAGE_CODES) {
    const words = flatten(CATALOGUES[`./locales/${code}.json`]);

    it(`${code} has exactly the Swiss German keys, none of them empty`, () => {
      expect([...words.keys()].filter((key) => !german.has(key))).toEqual([]);
      expect([...german.keys()].filter((key) => !words.has(key))).toEqual([]);
      expect([...words].filter(([, text]) => !text.trim()).map(([key]) => key)).toEqual([]);
    });

    it(`${code} keeps every placeholder`, () => {
      const lost = [...german]
        .filter(([key, text]) => words.has(key) && placeholders(text).join() !== placeholders(words.get(key)!).join())
        .map(([key]) => key);
      expect(lost).toEqual([]);
    });
  }

  it("credit the museum as the model, never as the source", () => {
    expect(german.get("experiments.overview.credit")).toMatch(/^Inspiriert von/);
    for (const text of german.values()) expect(text).not.toMatch(/aus dem (Swiss Science Center )?Technorama/);
  });
});
