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
    expect(variants.map((v) => v.id)).toEqual([...TEMPLATES.map((t) => `${t.id}-en-simple`), "classic-gold-te-simple", "deepam-en-simple-night"]);
  });

  it.each(variants.map((v) => v.id))("%s is a valid Simple-form profile with the Ganesha symbol and a photo", (id) => {
    const v = variants.find((x) => x.id === id)!;
    expect(profileSchema.parse(v.profile)).toEqual(v.profile);
    expect(v.profile.options.formLayout).toBe("simple");
    expect(v.profile.options.motif).toBe("ganesha");
    expect(v.profile.photo).toBeTruthy();
  });

  it("prints the four Simple sections", () => {
    const doc = toDocument(variants[0].profile, getDocDictionary("en"), FIXTURE_TODAY);
    expect(doc.sections.map((s) => s.key)).toEqual(["personal", "family", "contact", "partnerPreferences"]);
  });
});
