import { describe, expect, it } from "vitest";
import { toDocument } from "../../src/biodata/document";
import { profileSchema } from "../../src/biodata/schema";
import { TEMPLATES } from "../../src/document/templates";
import { getDocDictionary } from "../../src/i18n/doc";
import { FIXTURE_TODAY, simpleVariants } from "./documents";

// Step 6.1: the site's pictures show the Simple form's biodata (owner's choice 2026-11-23) in every design.

const variants = simpleVariants(TEMPLATES);

describe("simple variants", () => {
  it("covers every design, plus Telugu and a dark colour", () => {
    expect(variants.map((v) => v.id)).toEqual([
      ...TEMPLATES.map((t) => `${t.id}-en-simple`),
      ...["te", "hi", "ta", "kn", "ml", "mr", "gu", "bn", "pa"].map((lang) => `classic-gold-${lang}-simple`),
      "deepam-en-simple-night",
      ...["muslim", "christian", "sikh", "jain"].map((name) => `classic-gold-en-simple-${name}`),
    ]);
  });

  it.each(variants.map((v) => v.id))("%s is a valid Simple-form profile with the Ganesha symbol and a photo", (id) => {
    const v = variants.find((x) => x.id === id)!;
    expect(profileSchema.parse(v.profile)).toEqual(v.profile);
    expect(v.profile.options.formLayout).toBe("simple");
    if (!id.endsWith("-jain")) expect(v.profile.options.motif).toBeTruthy();
    expect(v.profile.photo).toBeTruthy();
  });

  it("prints the four Simple sections", () => {
    const doc = toDocument(variants[0].profile, getDocDictionary("en"), FIXTURE_TODAY);
    expect(doc.sections.map((s) => s.key)).toEqual(["personal", "family", "contact", "partnerPreferences"]);
  });
});

describe("tradition samples", () => {
  it.each([
    ["muslim", ["Sect", "Maslak"], ["Nakshatra", "Rashi", "Gotra"]],
    ["christian", ["Denomination", "Church / Parish"], ["Nakshatra", "Rashi", "Gotra"]],
    ["sikh", ["Sikh Practice", "Gotra"], ["Nakshatra", "Rashi"]],
    ["jain", ["Sect", "Gotra"], ["Nakshatra", "Rashi"]],
  ])("%s prints its own fields and leaves out the others", (name, shown, absent) => {
    const v = variants.find((x) => x.id === `classic-gold-en-simple-${name}`)!;
    const doc = toDocument(v.profile, getDocDictionary("en"), FIXTURE_TODAY);
    const labels = doc.sections.flatMap((s) => s.items.flatMap((i) => (i.kind === "row" ? [i.label] : [])));
    for (const label of shown) expect(labels, label).toContain(label);
    for (const label of absent) expect(labels, label).not.toContain(label);
  });
});
