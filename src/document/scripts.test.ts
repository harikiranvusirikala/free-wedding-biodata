import { describe, expect, it } from "vitest";
import { INVOCATIONS } from "@/biodata/invocations";
import { extraFamilies, hasIndicScript, mixedFontStack, scriptFamilies, textFontStack } from "./scripts";
import { FONT_UNICODE_RANGE } from "./tokens";

// Steps 2.0 and 4.2: text in another script than the page's prints in its own script's font, on screen and in the PDF.

describe("scriptFamilies", () => {
  it("names the script fonts a text needs, in the order they appear", () => {
    expect(scriptFamilies("॥ श्री गणेशाय नमः ॥")).toEqual(["Noto Sans Devanagari"]);
    expect(scriptFamilies("ੴ ਸਤਿ ਗੁਰ ਪ੍ਰਸਾਦਿ")).toEqual(["Noto Sans Gurmukhi"]);
    expect(scriptFamilies("శ్రీ and ॐ")).toEqual(["Noto Sans Telugu", "Noto Sans Devanagari"]);
    expect(scriptFamilies("Ravi ಬೆಂಗಳೂರು, கோவை, മലയാളം, ગુજરાત, বাংলা")).toEqual([
      "Noto Sans Kannada",
      "Noto Sans Tamil",
      "Noto Sans Malayalam",
      "Noto Sans Gujarati",
      "Noto Sans Bengali",
    ]);
    // Vedic signs live outside the main Devanagari block.
    expect(scriptFamilies("᳐")).toEqual(["Noto Sans Devanagari"]);
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

describe("hasIndicScript", () => {
  it("tells Indic text from Latin, digits and punctuation", () => {
    expect(hasIndicScript("కుటుంబం")).toBe(true);
    expect(hasIndicScript("Family (కుటుంబం)")).toBe(true);
    expect(hasIndicScript("Family details – 2 ₹")).toBe(false);
    expect(hasIndicScript("।")).toBe(false); // a danda alone is shared punctuation
  });
});

describe("extraFamilies", () => {
  it("lists the script fonts a value needs beyond the page's own stack", () => {
    expect(extraFamilies("en", "రవి తేజ మండపాటి")).toEqual(["Noto Sans Telugu"]);
    expect(extraFamilies("en", "Ravi తేజ, ಬೆಂಗಳೂರು")).toEqual(["Noto Sans Telugu", "Noto Sans Kannada"]);
    expect(extraFamilies("ta", "రవి")).toEqual(["Noto Sans Telugu"]);
    expect(extraFamilies("kn", "ತೇಜ (తేజ)")).toEqual(["Noto Sans Telugu"]);
  });

  it("adds nothing for the page's own script, Latin, digits and punctuation", () => {
    expect(extraFamilies("te", "రవి తేజ – 9000012345, ₹ 24 LPA")).toEqual([]);
    expect(extraFamilies("kn", "Blood Group : B+")).toEqual([]);
    expect(extraFamilies("en", "Hyderabad – 500081")).toEqual([]);
    // Marathi and Hindi share Devanagari.
    expect(extraFamilies("mr", "हैदराबाद")).toEqual([]);
  });

  it("leaves the Devanagari block to Noto Sans, which draws it with the same glyphs", () => {
    expect(extraFamilies("en", "फ्लैट 402, हैदराबाद")).toEqual([]);
    expect(extraFamilies("ta", "हैदराबाद")).toEqual([]);
    // Vedic signs aren't in Noto Sans: they need Noto Sans Devanagari.
    expect(extraFamilies("en", "ॐ᳐")).toEqual(["Noto Sans Devanagari"]);
  });
});

describe("textFontStack", () => {
  it("keeps the page's fonts first and adds the scripts a value needs", () => {
    expect(textFontStack("en", "రవి తేజ")).toBe('"Noto Sans", "Noto Sans Telugu", sans-serif');
    expect(textFontStack("kn", "Ravi రవి")).toBe('"Noto Sans Kannada", "Noto Sans", "Noto Sans Telugu", sans-serif');
    expect(textFontStack("hi", "চট্টগ্রাম ਅੰਮ੍ਰਿਤਸਰ")).toBe('"Noto Sans Devanagari", "Noto Sans", "Noto Sans Bengali", "Noto Sans Gurmukhi", sans-serif');
  });

  it("is undefined when the page's stack draws the text (the element inherits it)", () => {
    expect(textFontStack("en", "Ravi Teja")).toBeUndefined();
    expect(textFontStack("kn", "Gothram")).toBeUndefined();
    expect(textFontStack("te", "రవి Teja")).toBeUndefined();
    expect(textFontStack("en", "हैदराबाद")).toBeUndefined();
    expect(textFontStack("en", "")).toBeUndefined();
  });
});

describe("mixedFontStack", () => {
  it("puts the text's scripts first, then the page's fonts", () => {
    expect(mixedFontStack("en", "॥ श्री गणेशाय नमः ॥")).toBe('"Noto Sans Devanagari", "Noto Sans", sans-serif');
    expect(mixedFontStack("te", "ੴ")).toBe('"Noto Sans Gurmukhi", "Noto Sans Telugu", "Noto Sans", sans-serif');
    expect(mixedFontStack("hi", "ॐ")).toBe('"Noto Sans Devanagari", "Noto Sans", sans-serif');
    expect(mixedFontStack("en", "Bismillah")).toBe('"Noto Sans", sans-serif');
  });
});
