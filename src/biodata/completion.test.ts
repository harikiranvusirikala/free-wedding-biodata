import { describe, expect, it } from "vitest";
import { completionState, sectionCompletion } from "./completion";
import { SAMPLE_PROFILE, createProfile } from "./defaults";
import type { FamilySection, FieldsSection } from "./types";

describe("section completion", () => {
  it("counts the visible rows and how many have something in them", () => {
    const personal = createProfile().sections.find((s) => s.key === "personal") as FieldsSection;
    expect(sectionCompletion(personal)).toEqual({ filled: 0, total: 9 });
    const some: FieldsSection = {
      ...personal,
      fields: personal.fields.map((f, i) => (i < 3 ? { ...f, value: "x" } : f)),
    };
    expect(sectionCompletion(some)).toEqual({ filled: 3, total: 9 });
  });

  it("leaves hidden rows out of both counts, and treats spaces as empty", () => {
    const personal = createProfile().sections.find((s) => s.key === "personal") as FieldsSection;
    const [a, b, ...rest] = personal.fields;
    const section: FieldsSection = { ...personal, fields: [{ ...a, value: "x", visible: false }, { ...b, value: "   " }, ...rest] };
    expect(sectionCompletion(section)).toEqual({ filled: 0, total: 8 });
  });

  it("counts a picked option as filled", () => {
    const personal = createProfile().sections.find((s) => s.key === "personal") as FieldsSection;
    const section: FieldsSection = { ...personal, fields: [{ ...personal.fields[1], value: "", optionKey: "male" }] };
    expect(sectionCompletion(section)).toEqual({ filled: 1, total: 1 });
  });

  it("counts family members by their details", () => {
    const family = SAMPLE_PROFILE.sections.find((s) => s.key === "family") as FamilySection;
    expect(sectionCompletion(family)).toEqual({ filled: 4, total: 4 });
    const fresh = createProfile().sections.find((s) => s.key === "family") as FamilySection;
    expect(sectionCompletion(fresh)).toEqual({ filled: 0, total: 2 });
  });

  it("the sample's Career skips its hidden income", () => {
    const career = SAMPLE_PROFILE.sections.find((s) => s.key === "career") as FieldsSection;
    expect(sectionCompletion(career)).toEqual({ filled: 5, total: 5 });
  });

  it("names the state for the section's dot", () => {
    expect(completionState({ filled: 0, total: 0 })).toBe("empty");
    expect(completionState({ filled: 0, total: 4 })).toBe("empty");
    expect(completionState({ filled: 2, total: 4 })).toBe("partial");
    expect(completionState({ filled: 4, total: 4 })).toBe("complete");
  });
});
