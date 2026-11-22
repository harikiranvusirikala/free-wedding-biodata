import { describe, expect, it } from "vitest";
import { getDocDictionary } from "@/i18n/doc";
import { createProfile, SAMPLE_PROFILE } from "./defaults";
import { docTexts, toDocument, type DocParagraph, type DocRow } from "./document";
import { profileSchema } from "./schema";
import type { BiodataProfile, FieldsSection } from "./types";

const en = getDocDictionary("en");
const te = getDocDictionary("te");
const TODAY = new Date(2026, 10, 21);

const sample = (): BiodataProfile => structuredClone(SAMPLE_PROFILE) as BiodataProfile;
const section = (p: BiodataProfile, key: string) => p.sections.find((s) => s.key === key)!;
const fieldsOf = (p: BiodataProfile, key: string) => (section(p, key) as FieldsSection).fields;
const rows = (doc: ReturnType<typeof toDocument>, key: string) =>
  doc.sections.find((s) => s.key === key)!.items.filter((i): i is DocRow => i.kind === "row");

describe("toDocument", () => {
  it("prints nothing for an empty new draft", () => {
    const doc = toDocument(createProfile({ newId: (() => { let n = 0; return () => `id-${++n}`; })() }), en, TODAY);
    expect(doc.sections).toEqual([]);
    expect(doc.title).toBeUndefined();
    expect(doc.motif).toBeNull();
    expect(doc.invocation).toBeUndefined();
    expect(doc.name).toBeUndefined();
  });

  it("keeps only visible, non-empty fields and sections, in the profile's order", () => {
    const doc = toDocument(sample(), en, TODAY);
    expect(doc.sections.map((s) => s.key)).toEqual([
      "aboutMe",
      "personal",
      "religion",
      "horoscope",
      "education",
      "career",
      "family",
      "familyBackground",
      "contact",
      "partnerPreferences",
      "references",
    ]);
    // Religion has only the religion filled; caste, community and sub-caste are empty.
    expect(rows(doc, "religion").map((r) => r.label)).toEqual(["Religion"]);
    // The annual income is hidden in the sample.
    expect(rows(doc, "career").some((r) => r.key === "annualIncome")).toBe(false);
  });

  it("drops a hidden section and a section whose fields are all empty or hidden", () => {
    const p = sample();
    section(p, "horoscope").visible = false;
    for (const f of fieldsOf(p, "education")) f.visible = false;
    for (const f of fieldsOf(p, "religion")) f.value = "  ";
    for (const f of fieldsOf(p, "religion")) delete f.optionKey;
    const keys = toDocument(p, en, TODAY).sections.map((s) => s.key);
    expect(keys).not.toContain("horoscope");
    expect(keys).not.toContain("education");
    expect(keys).not.toContain("religion");
  });

  it("labels from the dictionary unless renamed; custom fields use their own label", () => {
    const doc = toDocument(sample(), en, TODAY);
    const career = rows(doc, "career");
    expect(career.find((r) => r.key === "employer")!.label).toBe("Company");
    expect(career.find((r) => r.key === "designation")!.label).toBe("Designation");
    expect(rows(doc, "personal").find((r) => r.label === "Blood group")!.value).toBe("B+");
    const teDoc = toDocument({ ...sample(), docLanguage: "te" }, te, TODAY);
    expect(rows(teDoc, "personal")[0]).toMatchObject({ label: "పేరు", value: "Sai Teja Mandapati" });
    expect(teDoc.sections[1].title).toBe("వ్యక్తిగత వివరాలు");
  });

  it("prints picked options in the document language and typed values as typed (D33)", () => {
    const p = sample();
    const nakshatra = fieldsOf(p, "horoscope").find((f) => f.key === "nakshatra")!;
    const gotra = fieldsOf(p, "horoscope").find((f) => f.key === "gotra")!;
    gotra.value = "భరద్వాజ";
    const teDoc = toDocument(p, te, TODAY);
    const horoscope = rows(teDoc, "horoscope");
    expect(horoscope.find((r) => r.key === "nakshatra")!.value).toBe("మఘ");
    expect(horoscope.find((r) => r.key === "manglik")!.value).toBe("లేదు");
    expect(horoscope.find((r) => r.key === "gotra")!.value).toBe("భరద్వాజ");
    // An unknown option key falls back to the typed value.
    nakshatra.optionKey = "notAStar";
    expect(rows(toDocument(p, en, TODAY), "horoscope").find((r) => r.key === "nakshatra")!.value).toBe("Magha");
  });

  it("formats dates (always dd-mm-yyyy), time and height per the options", () => {
    const p = sample();
    p.options.heightFormat = "ft-in-cm";
    const personal = rows(toDocument(p, en, TODAY), "personal");
    expect(personal.find((r) => r.key === "dateOfBirth")!.value).toBe("14-08-1996");
    expect(personal.find((r) => r.key === "height")!.value).toBe(`5' 10" (178 cm)`);
    expect(rows(toDocument(p, en, TODAY), "horoscope").find((r) => r.key === "birthTime")!.value).toBe("6:45 AM");
  });

  it("prints dd-mm-yyyy even for a draft that stored another date style (kept for compatibility, ignored)", () => {
    for (const dateFormat of ["d month yyyy", "d-month-yyyy"] as const) {
      const p = sample();
      p.options.dateFormat = dateFormat;
      for (const section of p.sections) if (section.kind === "fields") for (const f of section.fields) if (f.key === "dateOfBirth") f.value = "1998-01-13";
      expect(profileSchema.safeParse(p).success).toBe(true);
      for (const lang of ["en", "te", "hi"] as const) {
        const value = rows(toDocument(p, getDocDictionary(lang), TODAY), "personal").find((r) => r.key === "dateOfBirth")!.value;
        expect(value, `${dateFormat} ${lang}`).toBe("13-01-1998");
      }
    }
  });

  it("adds the age after the date of birth only when Show age is on (D13)", () => {
    const p = sample();
    const personal = rows(toDocument(p, en, TODAY), "personal");
    const dob = personal.findIndex((r) => r.key === "dateOfBirth");
    expect(personal[dob + 1]).toMatchObject({ key: "age", label: "Age", value: "30 years" });
    p.options.showAge = false;
    expect(rows(toDocument(p, en, TODAY), "personal").some((r) => r.key === "age")).toBe(false);
    p.options.showAge = true;
    expect(rows(toDocument(p, te, TODAY), "personal").find((r) => r.key === "age")!.value).toBe("30 సంవత్సరాలు");
  });

  it("prints family members as relation : details, dropping hidden and empty ones (D28)", () => {
    const p = sample();
    const family = section(p, "family");
    if (family.kind !== "family") throw new Error("family");
    family.members[3].visible = false;
    family.members.push({ id: "m-typed", relation: "Cousin (Elder)", details: "Kiran, Pune", visible: true });
    family.members.push({ id: "m-empty", relationKey: "aunt", relation: "", details: " ", visible: true });
    const doc = toDocument(p, te, TODAY);
    const familyRows = rows(doc, "family");
    expect(familyRows.map((r) => r.label)).toEqual(["తండ్రి", "తల్లి", "అక్క", "Cousin (Elder)"]);
    expect(familyRows[0].value).toBe("Mandapati Venkata Rao, Retired Headmaster, Guntur");
  });

  it("makes paragraphs of textarea fields and keeps notes and multiline rows", () => {
    const doc = toDocument(sample(), en, TODAY);
    const about = doc.sections[0].items[0] as DocParagraph;
    expect(about).toMatchObject({ kind: "paragraph", label: "About Me" });
    expect(about.text.startsWith("I am a calm")).toBe(true);
    const contact = rows(doc, "contact");
    expect(contact.find((r) => r.key === "alternatePhone")!.note).toBe("Mother");
    expect(contact.find((r) => r.key === "address")!.multiline).toBe(true);
    const partner = doc.sections.find((s) => s.key === "partnerPreferences")!;
    expect(partner.items.map((i) => i.kind)).toEqual(["row", "row", "row", "row", "row", "paragraph"]);
  });

  it("joins line breaks in single-line rows and keeps them in multiline ones", () => {
    const p = sample();
    fieldsOf(p, "personal")[0].value = "Sai Teja\nMandapati";
    fieldsOf(p, "contact").find((f) => f.key === "address")!.value = "Plot 12\nSample Colony";
    const doc = toDocument(p, en, TODAY);
    expect(rows(doc, "personal")[0].value).toBe("Sai Teja, Mandapati");
    expect(rows(doc, "contact").find((r) => r.key === "address")!.value).toBe("Plot 12\nSample Colony");
  });

  it("takes title, motif and invocation from the options, never inferred (D21, D45)", () => {
    const p = sample();
    let doc = toDocument(p, en, TODAY);
    expect([doc.title, doc.motif, doc.invocation]).toEqual([undefined, null, undefined]);
    p.options.titleKey = "biodata";
    p.options.title = "Ignored";
    p.options.motif = "ganesha";
    p.options.invocation = " శ్రీరస్తు · శుభమస్తు · అవిఘ్నమస్తు ";
    doc = toDocument(p, te, TODAY);
    expect(doc.title).toBe("బయోడేటా");
    expect(doc.motif).toBe("ganesha");
    expect(doc.invocation).toBe("శ్రీరస్తు · శుభమస్తు · అవిఘ్నమస్తు");
    delete p.options.titleKey;
    expect(toDocument(p, en, TODAY).title).toBe("Ignored");
  });

  it("renamed sections keep the user's title; the name and photo slot are exposed", () => {
    const p = sample();
    section(p, "personal").title = "About the groom";
    p.photo = { id: "photo-1", frame: "2:3", crop: { x: 0.5, y: 0.5, zoom: 1, rotation: 0 } };
    const doc = toDocument(p, en, TODAY);
    expect(doc.sections[1].title).toBe("About the groom");
    expect(doc.name).toBe("Sai Teja Mandapati");
    expect(doc.photo).toEqual({ id: "photo-1", frame: "2:3" });
    expect(doc.lang).toBe("en");
    expect(doc.textSize).toBe("auto");
  });

  it("lists every printed string", () => {
    const doc = toDocument(sample(), en, TODAY);
    const texts = docTexts(doc);
    expect(texts).toContain("Sai Teja Mandapati");
    expect(texts).toContain("Family Details");
    expect(texts).toContain("Mother");
  });
});
