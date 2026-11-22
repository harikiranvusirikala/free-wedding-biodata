import { describe, expect, it } from "vitest";
import { createProfile } from "./defaults";
import { toDocument } from "./document";
import { setColor, setDesign, setLabelCase, setTextSize } from "./edits";
import { profileSchema } from "./schema";
import type { BiodataProfile } from "./types";
import { getDocDictionary } from "@/i18n/doc";

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
