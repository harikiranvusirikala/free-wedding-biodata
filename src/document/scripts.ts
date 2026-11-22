import type { LangCode } from "@/biodata/types";
import { FONT_FAMILY, NOTO_SANS_SCRIPT_RANGE, SCRIPT_RANGE } from "./tokens";

// Text in another script than the page's (Steps 2.0 and 4.2). The page's font stack is the document language's
// script font, then Noto Sans; a script font draws only its own script (its unicode-range, document.css), so text
// in a third script would fall through to whatever font the system has, and the PDF writer, which only has our
// TTFs, could not match it. Every element that prints text the user may have typed (values, notes, custom labels
// and titles, names, paragraphs) therefore gets the fonts its text needs (`textFontStack`), and an invocation line
// or title gets its own script first (`mixedFontStack`). Only text that needs them gets the extra fonts: the
// browser loads, and the PDF writer reads, exactly the stack an element has, and both pick the same font for every
// character with the same ranges (src/pdf). Pure.

/** Code point ranges → a test for any of them ("U+0900-097F, U+1CD0-1CFF" → /[\u{900}-\u{97F}\u{1CD0}-\u{1CFF}]/u). */
function rangeTest(css: string): RegExp {
  const parts = css.split(",").map((part) => {
    const [from, to = from] = part.trim().replace(/^U\+/i, "").split("-");
    return `\\u{${from}}-\\u{${to}}`;
  });
  return new RegExp(`[${parts.join("")}]`, "u");
}

/** The script fonts, each with a test for its own script blocks. */
const SCRIPT_FONTS: readonly { family: string; test: RegExp }[] = Object.entries(SCRIPT_RANGE).map(([family, range]) => ({
  family,
  test: rangeTest(range),
}));

const DRAWN_BY_NOTO_SANS = rangeTest(NOTO_SANS_SCRIPT_RANGE);

/** The dandas sit in the Devanagari block but end sentences in most Indic scripts: every script font draws them. */
const SHARED = /[\u0964\u0965]/u;

/** The script font that draws one character, or undefined for Latin, digits, punctuation and other scripts. */
function scriptFamilyOf(ch: string): string | undefined {
  return SHARED.test(ch) ? undefined : SCRIPT_FONTS.find((f) => f.test.test(ch))?.family;
}

/** The script fonts `text` uses, in the order the scripts first appear. */
export function scriptFamilies(text: string): string[] {
  const found = new Set<string>();
  for (const ch of text) {
    const family = scriptFamilyOf(ch);
    if (family) found.add(family);
  }
  return [...found];
}

/** True when `text` holds any Indic script (no case, and letter spacing would pull its clusters apart). */
export const hasIndicScript = (text: string) => [...text].some((ch) => scriptFamilyOf(ch) !== undefined);

/**
 * The script fonts `text` needs on a page in `lang` beyond the page's own stack: not the page's script font, and
 * not for characters Noto Sans draws itself (the Devanagari block), in the order they first appear.
 */
export function extraFamilies(lang: LangCode, text: string): string[] {
  const page = FONT_FAMILY[lang];
  const found = new Set<string>();
  for (const ch of text) {
    const family = scriptFamilyOf(ch);
    if (family && family !== page && !DRAWN_BY_NOTO_SANS.test(ch)) found.add(family);
  }
  return [...found];
}

const cssStack = (families: string[]) => `${[...new Set(families)].map((f) => `"${f}"`).join(", ")}, sans-serif`;

/**
 * The CSS font stack for an element printing `text` (a value, label, title or paragraph) on a page in `lang`, or
 * undefined when the page's own stack draws all of it (the element then inherits it). The page's fonts stay first,
 * so the element's line metrics and baseline don't change; the extra script fonts follow for their characters only.
 */
export function textFontStack(lang: LangCode, text: string): string | undefined {
  const extra = extraFamilies(lang, text);
  return extra.length ? cssStack([FONT_FAMILY[lang], "Noto Sans", ...extra]) : undefined;
}

/**
 * A CSS font stack for an invocation line or title on a page in `lang`: the scripts it uses first, so a line wholly
 * in another script draws its spaces and dandas in that script too, then the page's own fonts.
 */
export function mixedFontStack(lang: LangCode, text: string): string {
  return cssStack([...scriptFamilies(text), FONT_FAMILY[lang], "Noto Sans"]);
}
