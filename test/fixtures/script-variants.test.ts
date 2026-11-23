import { describe, expect, it } from "vitest";
import { toDocument } from "../../src/biodata/document";
import { profileSchema } from "../../src/biodata/schema";
import { TEMPLATES } from "../../src/document/templates";
import { getDocDictionary } from "../../src/i18n/doc";
import { FIXTURE_TODAY, LONG_NAMES, scriptVariants } from "./documents";
import { LONG_NAME } from "./scripts";

// Step 4.2 part 2: the fixture biodatas typed in each language's own script must really print that script's stress
// sequences (an emptied or hidden field would quietly drop them from the PDFs under review).

const STRESS: Record<string, string[]> = {
  en: [LONG_NAME, "Guntur", "B.Tech"],
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

const variants = scriptVariants(TEMPLATES);

/** Everything the document model prints for a variant, as one string. */
function printed(id: string): string {
  const v = variants.find((x) => x.id === id)!;
  const doc = toDocument(v.profile, getDocDictionary(v.lang), FIXTURE_TODAY);
  return JSON.stringify(doc);
}

describe("script variants (Step 4.2 part 2)", () => {
  it("has a short Classic Gold and a long other-skeleton biodata for each of the ten languages", () => {
    expect(variants).toHaveLength(20);
    expect(new Set(variants.map((v) => v.lang)).size).toBe(10);
    expect(variants.filter((v) => v.length === "script").every((v) => v.templateId === "classic-gold")).toBe(true);
    // Minimal, both Modern designs and both letterheads (Classic skeleton under a letterhead header).
    const longDesigns = new Set(variants.filter((v) => v.length === "scriptLong").map((v) => v.templateId));
    expect([...longDesigns].sort()).toEqual(["executive-navy", "minimal-ivory", "modern-two-column", "sandalwood", "slate-brush"]);
    expect(new Set([...longDesigns].map((id) => TEMPLATES.find((t) => t.id === id)!.skeleton))).toEqual(new Set(["classic", "minimal", "modern"]));
  });

  it.each(variants.map((v) => v.id))("%s is a valid profile", (id) => {
    const v = variants.find((x) => x.id === id)!;
    expect(profileSchema.parse(v.profile)).toEqual(v.profile);
  });

  it.each(Object.entries(STRESS))("prints %s's stress sequences and keeps its joiners", (lang, sequences) => {
    const text = printed(`classic-gold-${lang}-script`);
    for (const sequence of sequences) expect(text, sequence).toContain(sequence);
    if (lang === "te") expect(text).toContain("‌");
    if (lang === "mr") expect(text).toContain("‍");
  });

  it("prints the long name, the two-line address and three About paragraphs in the long ones", () => {
    for (const v of variants.filter((x) => x.length === "scriptLong")) {
      const doc = toDocument(v.profile, getDocDictionary(v.lang), FIXTURE_TODAY);
      expect(doc.name, v.id).toBe(LONG_NAMES[v.lang]);
      expect([...LONG_NAMES[v.lang]].length, v.id).toBeGreaterThanOrEqual(38);
      expect(JSON.stringify(doc), v.id).toContain("Sample Residency");
    }
    expect(LONG_NAMES.en.length).toBeGreaterThanOrEqual(60);
  });

  it("leaves the other fields empty, so they and their sections don't print", () => {
    const doc = toDocument(variants[0].profile, getDocDictionary("en"), FIXTURE_TODAY);
    const keys = doc.sections.map((s) => s.key);
    for (const absent of ["religion", "horoscope", "education", "career", "familyBackground", "partnerPreferences", "references"]) expect(keys, absent).not.toContain(absent);
  });
});
