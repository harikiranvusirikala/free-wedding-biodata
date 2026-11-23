import { describe, expect, it } from "vitest";
import { LANGUAGE_ALTERNATES, LANGUAGE_PAGES } from "./languages";

// The language pages (Step 6.1 part 2): each one's words are in its own script (apart from Latin names like PDF and
// A4), short enough for search results, and every page lists every other.

const BLOCKS: Record<string, [number, number]> = {
  te: [0x0c00, 0x0c7f],
  hi: [0x0900, 0x097f],
  mr: [0x0900, 0x097f],
  ta: [0x0b80, 0x0bff],
  kn: [0x0c80, 0x0cff],
  ml: [0x0d00, 0x0d7f],
  gu: [0x0a80, 0x0aff],
  bn: [0x0980, 0x09ff],
  pa: [0x0a00, 0x0a7f],
};
const JOINERS = new Set([0x200c, 0x200d]);

describe("language pages", () => {
  it("are the nine document languages besides English, each once", () => {
    expect(LANGUAGE_PAGES.map((p) => p.lang).sort()).toEqual(["bn", "gu", "hi", "kn", "ml", "mr", "pa", "ta", "te"]);
  });

  it.each(LANGUAGE_PAGES.map((p) => [p.lang, p] as const))("%s is written in its own script", (lang, page) => {
    const [from, to] = BLOCKS[lang];
    const texts = [page.native, page.title, page.description, page.h1, page.lead, page.cta, ...page.points, page.note, page.alt, page.others];
    for (const text of texts) {
      const letters = [...text].map((c) => c.codePointAt(0)!).filter((cp) => /\p{L}|\p{M}/u.test(String.fromCodePoint(cp)));
      const own = letters.filter((cp) => cp >= from && cp <= to);
      const latin = letters.filter((cp) => cp < 0x250);
      expect(own.length + latin.length, `${lang}: letters from another script in "${text}"`).toBe(letters.filter((cp) => !JOINERS.has(cp)).length);
      expect(own.length / letters.length, `${lang}: mostly its own script in "${text}"`).toBeGreaterThan(0.8);
    }
  });

  it.each(LANGUAGE_PAGES.map((p) => [p.lang, p] as const))("%s fits search results", (_, page) => {
    expect([...page.title].length).toBeLessThanOrEqual(60);
    expect([...page.description].length).toBeLessThanOrEqual(160);
  });

  it("awaits a native speaker's reading (D47), so none is marked reviewed yet", () => {
    expect(LANGUAGE_PAGES.filter((p) => p.reviewed).map((p) => p.lang)).toEqual([]);
  });

  it("gives every page the full set of hreflang alternates, English as the default", () => {
    expect(LANGUAGE_ALTERNATES).toMatchObject({ en: "/", te: "/te", pa: "/pa", "x-default": "/" });
    expect(Object.keys(LANGUAGE_ALTERNATES)).toHaveLength(11);
  });
});
