import { describe, expect, it } from "vitest";
import { createProfile } from "./defaults";
import { toDocument } from "./document";
import { setColor, setDesign, setLabelCase, setLabelStyle, setTextSize } from "./edits";
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
    // Exactly four words change (confirmed by the owner); every other label stays standard.
    expect(after.get("nakshatra")).toBe("Star");
    expect(after.get("rashi")).toBe("Raasi");
    expect(after.get("gotra")).toBe("Swagothram");
    expect(after.get("maternalGotra")).toBe("Maternal Gothram");
    const changed = [...after].filter(([key, label]) => label !== before.get(key)).map(([key]) => key);
    expect(changed.sort()).toEqual(["gotra", "maternalGotra", "nakshatra", "rashi"]);
    expect(after.get("dateOfBirth")).toBe("Date of Birth");
    expect(after.get("highestQualification")).toBe("Qualification");
    expect(after.get("occupation")).toBe("Occupation");
    expect(doc(telugu).sections.find((s) => s.key === "contact")?.title).toBe(doc(profile).sections.find((s) => s.key === "contact")?.title);

    const renamed = structuredClone(telugu);
    for (const section of renamed.sections) if (section.kind === "fields") for (const f of section.fields) if (f.key === "nakshatra") f.label = "Janma Nakshatram";
    expect(labels(renamed).get("nakshatra")).toBe("Janma Nakshatram");
    expect(labels(renamed).get("gotra")).toBe("Swagothram");

    const hindi = { ...telugu, docLanguage: "hi" as const };
    expect(labels(hindi).get("nakshatra")).toBe(labels({ ...profile, docLanguage: "hi" }).get("nakshatra"));
    expect(labels(hindi).get("gotra")).not.toBe("Swagothram");
  });
});
