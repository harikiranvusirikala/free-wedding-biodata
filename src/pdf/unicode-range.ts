// CSS `unicode-range` values (e.g. "U+0C80-0CFF, U+0020, U+20??") → a code point test. The PDF writer uses the
// document's ranges (FONT_UNICODE_RANGE in src/document/tokens.ts) to pick the same font per glyph as the browser.

export type CodePointTest = (cp: number) => boolean;

/** Parses a unicode-range list; throws on a malformed range. */
export function parseUnicodeRange(css: string): [number, number][] {
  return css
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = /^U\+([0-9A-F?]{1,6})(?:-([0-9A-F]{1,6}))?$/i.exec(part);
      if (!m) throw new Error(`Bad unicode-range "${part}"`);
      if (m[1].includes("?")) return [parseInt(m[1].replace(/\?/g, "0"), 16), parseInt(m[1].replace(/\?/g, "F"), 16)] as [number, number];
      const from = parseInt(m[1], 16);
      return [from, m[2] ? parseInt(m[2], 16) : from] as [number, number];
    });
}

export function unicodeRangeTest(css: string): CodePointTest {
  const ranges = parseUnicodeRange(css);
  return (cp) => ranges.some(([from, to]) => cp >= from && cp <= to);
}
