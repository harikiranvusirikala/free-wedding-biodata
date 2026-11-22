import { describe, expect, it } from "vitest";
import { INVOCATIONS } from "@/biodata/invocations";
import { mixedFontStack, scriptFamilies, topElementFamilies } from "./scripts";
import { FONT_UNICODE_RANGE } from "./tokens";

// Step 2.0: an invocation line (or a title of the user's own) prints in its own script on any page.

describe("scriptFamilies", () => {
  it("names the script fonts a text needs, in the order they appear", () => {
    expect(scriptFamilies("॥ श्री गणेशाय नमः ॥")).toEqual(["Noto Sans Devanagari"]);
    expect(scriptFamilies("ੴ ਸਤਿ ਗੁਰ ਪ੍ਰਸਾਦਿ")).toEqual(["Noto Sans Gurmukhi"]);
    expect(scriptFamilies("శ్రీ and ॐ")).toEqual(["Noto Sans Telugu", "Noto Sans Devanagari"]);
    expect(scriptFamilies("With God's blessings")).toEqual([]);
    expect(scriptFamilies("")).toEqual([]);
  });

  it("covers every preset invocation line with fonts we ship", () => {
    for (const line of INVOCATIONS) {
      const families = scriptFamilies(line.text);
      for (const f of families) expect(Object.keys(FONT_UNICODE_RANGE)).toContain(f);
      // Anything else in the line is Latin or punctuation, which Noto Sans draws.
      const rest = [...line.text].filter((ch) => !/[ऀ-ൿ]/u.test(ch));
      for (const ch of rest) expect(ch.codePointAt(0)!, `${line.id}: ${ch}`).toBeLessThan(0x2100);
    }
  });
});

describe("mixedFontStack", () => {
  it("puts the text's scripts first, then the page's fonts", () => {
    expect(mixedFontStack("en", "॥ श्री गणेशाय नमः ॥")).toBe('"Noto Sans Devanagari", "Noto Sans", sans-serif');
    expect(mixedFontStack("te", "ੴ")).toBe('"Noto Sans Gurmukhi", "Noto Sans Telugu", "Noto Sans", sans-serif');
    expect(mixedFontStack("hi", "ॐ")).toBe('"Noto Sans Devanagari", "Noto Sans", sans-serif');
    expect(mixedFontStack("en", "Bismillah")).toBe('"Noto Sans", sans-serif');
  });

  it("lists the extra fonts the top of a page needs", () => {
    expect(topElementFamilies({ invocation: "ॐ", title: "బయోడేటా" })).toEqual(["Noto Sans Devanagari", "Noto Sans Telugu"]);
    expect(topElementFamilies({ invocation: "ॐ ", title: undefined })).toEqual(["Noto Sans Devanagari"]);
    expect(topElementFamilies({})).toEqual([]);
  });
});
