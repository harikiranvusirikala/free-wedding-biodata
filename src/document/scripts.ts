import type { DocModel } from "@/biodata/document";
import type { LangCode } from "@/biodata/types";
import { FONT_FAMILY, FONT_UNICODE_RANGE } from "./tokens";

// Text in another script than the page's (Step 2.0): an invocation line is printed in its own script whatever the
// document language is ("॥ श्री गणेशाय नमः ॥" on an English page, "ੴ ਸਤਿ ਗੁਰ ਪ੍ਰਸਾਦਿ" on a Telugu one), and a title
// of the user's own may be too. Such text gets a font stack that starts with the script fonts it uses; each face
// is limited to its script by its unicode-range (document.css), so the browser and the PDF writer (which reads the
// same stack and ranges, src/pdf) pick the same font for every character. Pure.

/** The script fonts, each with a test for its own block (the first range of its unicode-range). */
const SCRIPT_FONTS: readonly { family: string; test: RegExp }[] = Object.keys(FONT_UNICODE_RANGE).map((family) => {
  const [from, to] = FONT_UNICODE_RANGE[family].split(",")[0].trim().replace("U+", "").split("-");
  return { family, test: new RegExp(`[\\u${from}-\\u${to}]`, "u") };
});

/** The script fonts `text` needs, in the order the scripts first appear. */
export function scriptFamilies(text: string): string[] {
  const found: { family: string; at: number }[] = [];
  for (const { family, test } of SCRIPT_FONTS) {
    const at = text.search(test);
    if (at >= 0) found.push({ family, at });
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.family);
}

/** A CSS font stack for `text` on a page in `lang`: the scripts it uses first, then the page's own fonts. */
export function mixedFontStack(lang: LangCode, text: string): string {
  const families = [...new Set([...scriptFamilies(text), FONT_FAMILY[lang], "Noto Sans"])];
  return `${families.map((f) => `"${f}"`).join(", ")}, sans-serif`;
}

/** The fonts the top of a page needs beyond the page's own (so they are loaded before anything is measured). */
export function topElementFamilies(doc: Pick<DocModel, "invocation" | "title">): string[] {
  return scriptFamilies(`${doc.invocation ?? ""} ${doc.title ?? ""}`);
}
