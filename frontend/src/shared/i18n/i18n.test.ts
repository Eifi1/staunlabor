/**
 * Which language a reader gets, with no account to ask: the one picked on this
 * device, else the browser's first one the site offers, else Swiss German. A
 * pick is remembered only when the reader made it, and `<html lang>` follows
 * the words on screen.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "i18next";
import { readStored, writeStored } from "@eifi1/ui-kit";
import { STORAGE } from "@/shared/lib/storage-keys";
import { changeLanguage, initI18n, readerLanguage } from "./index";
import { tagOf } from "./languages";

function browserLanguages(languages: string[]) {
  vi.spyOn(navigator, "languages", "get").mockReturnValue(languages);
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("the reader's language", () => {
  it("is the one picked on this device first", () => {
    writeStored(STORAGE.language, "it");
    browserLanguages(["fr-FR"]);
    expect(readerLanguage()).toBe("it");
  });

  it("is the browser's first offered language when none was picked", () => {
    browserLanguages(["ja-JP", "fr-CH", "en"]);
    expect(readerLanguage()).toBe("fr");
  });

  it("reads every German as the one German the site has", () => {
    browserLanguages(["de-DE"]);
    expect(readerLanguage()).toBe("de-CH");
  });

  it("is Swiss German when the browser asks for nothing the site offers", () => {
    browserLanguages(["ja-JP"]);
    expect(readerLanguage()).toBe("de-CH");
  });
});

describe("a switch", () => {
  it("fetches the words first, follows with <html lang>, and is remembered only when picked", async () => {
    browserLanguages(["en-GB"]);
    await initI18n();
    expect(i18n.language).toBe("en");
    expect(i18n.t("app.tagline")).toBe("Hands-on exhibits, computed");
    expect(document.documentElement.lang).toBe(tagOf("en"));
    expect(readStored(STORAGE.language)).toBeNull();

    await changeLanguage("hu", { remember: true });
    expect(i18n.t("site.footer.imprint")).not.toBe("site.footer.imprint");
    expect(document.documentElement.lang).toBe(tagOf("hu"));
    expect(readStored(STORAGE.language)).toBe("hu");
  });
});
