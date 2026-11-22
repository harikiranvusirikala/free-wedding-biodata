import { describe, expect, it } from "vitest";
import { createProfile } from "./defaults";
import { toDocument } from "./document";
import { activeStylePreset, setColor, setDateFormat, setDesign, setLabelCase, setLabelStyle, setStylePreset, setTextSize } from "./edits";
import { profileSchema } from "./schema";
import type { BiodataProfile } from "./types";
import { getDocDictionary } from "@/i18n/doc";
import { SAMPLE_PROFILE } from "./defaults";

// Step 3.3: the live preview's controls (design, colour, text size, label case; D31, D39, D46). Each edit is
// immutable (the original is deep-frozen), returns the same profile when nothing changes, stamps updatedAt, leaves a
// profile the schema accepts, and reaches the document model.

const CREATED = new Date("2026-11-21T10:00:00.000Z");
const LATER = new Date("2026-11-21T10:05:00.000Z");
const later = () => LATER;
const TODAY = new Date("2026-11-21T12:00:00.000Z");

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function setup(): BiodataProfile {
  let n = 0;
  return freeze(createProfile({ newId: () => `id-${++n}`, now: () => CREATED, formLayout: "detailed" }));
}

const valid = (profile: BiodataProfile) => expect(profileSchema.safeParse(profile).success).toBe(true);
const doc = (profile: BiodataProfile) => toDocument(profile, getDocDictionary(profile.docLanguage), TODAY);

describe("setDesign", () => {
  it("changes the design and its colour together", () => {
    const profile = setup();
    const next = setDesign(profile, "paisley", "copper", later);
    expect(next).toMatchObject({ templateId: "paisley", colorId: "copper", updatedAt: LATER.toISOString() });
    expect(next.sections).toBe(profile.sections);
    expect(next.options).toBe(profile.options);
    valid(next);
    expect(doc(next)).toMatchObject({ templateId: "paisley", colorId: "copper" });
  });

  it("is a no-op for the design and colour already chosen", () => {
    const profile = setup();
    expect(setDesign(profile, profile.templateId, profile.colorId, later)).toBe(profile);
  });

  it("changes only the colour when the design stays", () => {
    const profile = setup();
    const next = setDesign(profile, profile.templateId, "rose", later);
    expect(next.templateId).toBe(profile.templateId);
    expect(next.colorId).toBe("rose");
  });
});

describe("setColor", () => {
  it("picks another colour of the open design", () => {
    const profile = setup();
    const next = setColor(profile, "sage", later);
    expect(next).toMatchObject({ colorId: "sage", templateId: profile.templateId, updatedAt: LATER.toISOString() });
    valid(next);
    expect(setColor(next, "sage", later)).toBe(next);
  });
});

describe("setTextSize", () => {
  it("sets Auto or a fixed size, and the document follows (D31)", () => {
    const profile = setup();
    expect(profile.options.textSize).toBe("auto");
    const large = setTextSize(profile, "l", later);
    expect(large.options).toMatchObject({ textSize: "l" });
    expect(large.options.motif).toBe(profile.options.motif);
    expect(large.updatedAt).toBe(LATER.toISOString());
    valid(large);
    expect(doc(large).textSize).toBe("l");
    expect(setTextSize(large, "l", later)).toBe(large);
    expect(setTextSize(large, "auto", later).options.textSize).toBe("auto");
  });
});

describe("setLabelCase", () => {
  it("switches labels between as written and capitals (D31)", () => {
    const profile = setup();
    expect(profile.options.labelCase).toBe("normal");
    const upper = setLabelCase(profile, "upper", later);
    expect(upper.options.labelCase).toBe("upper");
    valid(upper);
    expect(doc(upper).labelCase).toBe("upper");
    expect(setLabelCase(upper, "upper", later)).toBe(upper);
    expect(setLabelCase(upper, "normal", later).options.labelCase).toBe("normal");
  });
});

describe("setDateFormat", () => {
  it("changes how every date prints, in the document language (D14, D28)", () => {
    const profile = freeze(structuredClone(SAMPLE_PROFILE) as BiodataProfile);
    const dob = (p: BiodataProfile) => doc(p).sections.flatMap((s) => s.items).find((i) => i.kind === "row" && i.key === "dateOfBirth");
    const original = dob(profile);
    const next = setDateFormat(profile, "d-month-yyyy", later);
    expect(next.options.dateFormat).toBe("d-month-yyyy");
    expect(next.updatedAt).toBe(LATER.toISOString());
    expect(next.sections).toBe(profile.sections);
    valid(next);
    const printed = dob(next);
    expect(printed).toMatchObject({ value: expect.stringMatching(/^\d{1,2}-[A-Za-z]+-\d{4}$/) });
    expect(printed).not.toEqual(original);
    expect(dob(setDateFormat(next, "d month yyyy", later))).toMatchObject({ value: expect.stringMatching(/^\d{1,2} [A-Za-z]+ \d{4}$/) });
    expect(dob(setDateFormat(next, "dd-mm-yyyy", later))).toEqual(original);
  });

  it("is a no-op for the format already set", () => {
    const profile = setup();
    expect(setDateFormat(profile, "dd-mm-yyyy", later)).toBe(profile);
    const other = setDateFormat(profile, "d month yyyy", later);
    expect(setDateFormat(other, "d month yyyy", later)).toBe(other);
  });
});

describe("setLabelStyle", () => {
  it("is Standard until chosen, switches to the Telugu families' wording and back", () => {
    const profile = setup();
    expect(profile.options.labelStyle).toBeUndefined();
    const telugu = setLabelStyle(profile, "telugu", later);
    expect(telugu.options.labelStyle).toBe("telugu");
    expect(telugu.updatedAt).toBe(LATER.toISOString());
    expect(telugu.sections).toBe(profile.sections);
    valid(telugu);
    const standard = setLabelStyle(telugu, "standard", later);
    expect(standard.options.labelStyle).toBe("standard");
    valid(standard);
  });

  it("is a no-op for the style already in use, including an absent one meaning Standard", () => {
    const profile = setup();
    expect(setLabelStyle(profile, "standard", later)).toBe(profile);
    const telugu = setLabelStyle(profile, "telugu", later);
    expect(setLabelStyle(telugu, "telugu", later)).toBe(telugu);
  });

  it("re-words English labels, but a label the user renamed wins and other languages ignore the style", () => {
    const profile = freeze(structuredClone(SAMPLE_PROFILE) as BiodataProfile);
    const labels = (p: BiodataProfile) => new Map(doc(p).sections.flatMap((s) => s.items).map((i) => [i.key, i.label]));
    const before = labels(profile);
    expect(before.get("nakshatra")).toBe("Nakshatra");
    const telugu = setLabelStyle(profile, "telugu", later);
    const after = labels(telugu);
    expect(after.get("nakshatra")).toBe("Birth Star");
    expect(after.get("gotra")).toBe("Swagothram");
    expect(after.get("fullName")).toBe(before.get("fullName"));
    expect(doc(telugu).sections.find((s) => s.key === "contact")?.title).toBe("Contact Information");

    const renamed = structuredClone(telugu);
    for (const section of renamed.sections) if (section.kind === "fields") for (const f of section.fields) if (f.key === "nakshatra") f.label = "Janma Nakshatram";
    expect(labels(renamed).get("nakshatra")).toBe("Janma Nakshatram");
    expect(labels(renamed).get("gotra")).toBe("Swagothram");

    const hindi = { ...telugu, docLanguage: "hi" as const };
    expect(labels(hindi).get("nakshatra")).toBe(labels({ ...profile, docLanguage: "hi" }).get("nakshatra"));
    expect(labels(hindi).get("gotra")).not.toBe("Swagothram");
  });
});

describe("setStylePreset", () => {
  it("sets the label wording and the date style together, and each can be changed on its own afterwards", () => {
    const profile = setup();
    expect(activeStylePreset(profile.options)).toBe("standard");
    const telugu = setStylePreset(profile, "telugu", later);
    expect(telugu.options).toMatchObject({ labelStyle: "telugu", dateFormat: "d-month-yyyy" });
    expect(telugu.updatedAt).toBe(LATER.toISOString());
    expect(telugu.sections).toBe(profile.sections);
    valid(telugu);
    expect(activeStylePreset(telugu.options)).toBe("telugu");

    // The date control still overrides: the preset no longer matches, and the choice is kept.
    const dated = setDateFormat(telugu, "dd-mm-yyyy", later);
    expect(dated.options.labelStyle).toBe("telugu");
    expect(activeStylePreset(dated.options)).toBeUndefined();

    const back = setStylePreset(dated, "standard", later);
    expect(back.options).toMatchObject({ labelStyle: "standard", dateFormat: "dd-mm-yyyy" });
    expect(activeStylePreset(back.options)).toBe("standard");
  });

  it("is a no-op when the draft already matches the preset", () => {
    const profile = setup();
    expect(setStylePreset(profile, "standard", later)).toBe(profile);
    const telugu = setStylePreset(profile, "telugu", later);
    expect(setStylePreset(telugu, "telugu", later)).toBe(telugu);
  });
});
