import { describe, expect, it } from "vitest";
import { ALL_PAGES, LONG_ABOUT, LONG_NAME, SCRIPT_PAGES } from "./scripts";

// Guards the fixture itself: an editor or tool that normalises text could silently drop the joiners and
// conjuncts the PDF spike depends on (BUILD_PLAN Step 0.2).

const text = (lang: string) => JSON.stringify(ALL_PAGES.find((page) => page.lang === lang));

const STRESS: Record<string, string[]> = {
  te: ["శ్రీ", "క్ష్మ", "స్త్రీ", "కృష్ణమూర్తి", "సాఫ్ట్‌వేర్", "౨౨"],
  hi: ["श्रीमती", "द्वितीय", "कार्यालय", "कि", "२२"],
  ta: ["ஸ்ரீ", "க்ஷ", "கொ"],
  kn: ["ಕರ್ನಾಟಕ", "ಶ್ರೀ", "೨೨"],
  ml: ["ശ്രീ", "ക്ഷ", "ൻ"],
  mr: ["महाराष्ट्र", "ळ", "र्‍य"],
  gu: ["શ્રી", "દ્ર", "૨૨"],
  bn: ["শ্রী", "ক্ষ", "র্য", "কি", "২২"],
  pa: ["ਸ਼੍ਰੀ", "ਪ੍ਰ", "ਕਿ", "੨੨"],
};

describe("script fixture", () => {
  it("has the ten document languages", () => {
    expect(ALL_PAGES.map((page) => page.lang)).toEqual(["en", "te", "hi", "ta", "kn", "ml", "mr", "gu", "bn", "pa"]);
  });

  it.each(Object.entries(STRESS))("keeps %s's stress sequences", (lang, sequences) => {
    for (const sequence of sequences) expect(text(lang), sequence).toContain(sequence);
  });

  it("keeps the zero-width joiners (Telugu ZWNJ, Marathi eyelash ra ZWJ)", () => {
    expect(text("te")).toContain("\u200c");
    expect(text("mr")).toContain("\u200d");
  });

  it("mixes Latin text into every Indian-language page", () => {
    for (const page of SCRIPT_PAGES) expect(JSON.stringify(page), page.lang).toMatch(/[A-Za-z0-9]{2,}/);
  });

  it("has a 60-character name and about 600 words of About text", () => {
    expect(LONG_NAME.length).toBeGreaterThanOrEqual(60);
    expect(LONG_ABOUT.join(" ").split(/\s+/).length).toBeGreaterThanOrEqual(600);
  });
});
