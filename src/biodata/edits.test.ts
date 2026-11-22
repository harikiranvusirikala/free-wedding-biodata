import { describe, expect, it } from "vitest";
import { createProfile } from "./defaults";
import {
  pickFieldOption,
  renameField,
  renameSection,
  resetFieldLabel,
  resetSectionTitle,
  setFieldValue,
  setFieldVisible,
  setMemberDetails,
  setMemberVisible,
  setSectionVisible,
} from "./edits";
import { profileSchema } from "./schema";
import type { BiodataProfile, FamilySection, Field, FieldsSection } from "./types";

const CREATED = new Date("2026-11-21T10:00:00.000Z");
const LATER = new Date("2026-11-21T10:05:00.000Z");
const later = () => LATER;

function setup() {
  let n = 0;
  const profile = createProfile({ newId: () => `id-${++n}`, now: () => CREATED, formLayout: "detailed" });
  // Deep-freeze the original so any mutation by an edit throws.
  const freeze = (value: unknown): void => {
    if (value && typeof value === "object") {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
  };
  const snapshot = structuredClone(profile);
  freeze(profile);
  const personal = profile.sections.find((s) => s.key === "personal") as FieldsSection;
  const field = (key: string) => personal.fields.find((f) => f.key === key) as Field;
  return { profile, snapshot, personal, field };
}

const findField = (profile: BiodataProfile, id: string) =>
  profile.sections.flatMap((s) => (s.kind === "fields" ? s.fields : [])).find((f) => f.id === id);

describe("field edits", () => {
  it("sets a value immutably, sharing every untouched part", () => {
    const { profile, snapshot, personal, field } = setup();
    const name = field("fullName");
    const next = setFieldValue(profile, name.id, "Sai Teja", later);

    expect(findField(next, name.id)?.value).toBe("Sai Teja");
    expect(next.updatedAt).toBe(LATER.toISOString());
    expect(next.revision).toBe(0);
    expect(profile).toEqual(snapshot);
    expect(next.sections[0]).toBe(profile.sections[0]);
    const nextPersonal = next.sections.find((s) => s.id === personal.id) as FieldsSection;
    expect(nextPersonal.fields[1]).toBe(personal.fields[1]);
    expect(profileSchema.safeParse(next).success).toBe(true);
  });

  it("keeps the value exactly as typed", () => {
    const { profile, field } = setup();
    const next = setFieldValue(profile, field("fullName").id, "  Sai ", later);
    expect(findField(next, field("fullName").id)?.value).toBe("  Sai ");
  });

  it("returns the same profile when nothing changes", () => {
    const { profile, field } = setup();
    expect(setFieldValue(profile, field("fullName").id, "", later)).toBe(profile);
    expect(setFieldValue(profile, "no-such-id", "x", later)).toBe(profile);
    expect(setFieldVisible(profile, field("fullName").id, true, later)).toBe(profile);
    expect(renameField(profile, "no-such-id", "x", later)).toBe(profile);
    expect(resetFieldLabel(profile, field("fullName").id, later)).toBe(profile);
  });

  it("picks an option, and typing afterwards replaces it (D33)", () => {
    const { profile, field } = setup();
    const status = field("maritalStatus");
    const picked = pickFieldOption(profile, status.id, "neverMarried", "Never married", later);
    expect(findField(picked, status.id)).toMatchObject({ optionKey: "neverMarried", value: "Never married" });
    expect(pickFieldOption(picked, status.id, "neverMarried", "Never married", later)).toBe(picked);

    const typed = setFieldValue(picked, status.id, "Never married", later);
    expect(typed).not.toBe(picked);
    expect(findField(typed, status.id)).not.toHaveProperty("optionKey");
    expect(findField(typed, status.id)?.value).toBe("Never married");
  });

  it("hides a field without losing its value (§6)", () => {
    const { profile, field } = setup();
    const id = field("height").id;
    const hidden = setFieldVisible(setFieldValue(profile, id, "178", later), id, false, later);
    expect(findField(hidden, id)).toMatchObject({ visible: false, value: "178" });
    expect(findField(setFieldVisible(hidden, id, true, later), id)).toMatchObject({ visible: true, value: "178" });
  });

  it("renames a default field and resets it to the dictionary label", () => {
    const { profile, field } = setup();
    const id = field("dateOfBirth").id;
    const renamed = renameField(profile, id, "Born on", later);
    expect(findField(renamed, id)).toMatchObject({ key: "dateOfBirth", label: "Born on" });
    const reset = resetFieldLabel(renamed, id, later);
    expect(findField(reset, id)).not.toHaveProperty("label");
    expect(findField(reset, id)?.key).toBe("dateOfBirth");
  });

  it("keeps a custom field's label on reset, since it has no dictionary label", () => {
    const { profile, personal } = setup();
    const custom: Field = { id: "custom", label: "Blood group", type: "text", value: "B+", visible: true };
    const withCustom = {
      ...profile,
      sections: profile.sections.map((s) => (s.id === personal.id ? { ...personal, fields: [...personal.fields, custom] } : s)),
    };
    expect(resetFieldLabel(withCustom, "custom", later)).toBe(withCustom);
  });
});

describe("section edits", () => {
  it("hides a section, leaving its fields and their values alone", () => {
    const { profile, snapshot, personal, field } = setup();
    const filled = setFieldValue(profile, field("fullName").id, "Sai", later);
    const hidden = setSectionVisible(filled, personal.id, false, later);
    const section = hidden.sections.find((s) => s.id === personal.id) as FieldsSection;
    expect(section.visible).toBe(false);
    expect(section.fields.find((f) => f.key === "fullName")).toMatchObject({ visible: true, value: "Sai" });
    expect(profile).toEqual(snapshot);
  });

  it("works on the family list too", () => {
    const { profile } = setup();
    const family = profile.sections.find((s) => s.kind === "family")!;
    const next = setSectionVisible(profile, family.id, false, later);
    expect(next.sections.find((s) => s.id === family.id)).toMatchObject({ visible: false, kind: "family" });
    expect(profileSchema.safeParse(next).success).toBe(true);
  });

  it("renames a section and resets it to the dictionary title", () => {
    const { profile, personal } = setup();
    const renamed = renameSection(profile, personal.id, "About Sai", later);
    expect(renamed.sections.find((s) => s.id === personal.id)).toMatchObject({ key: "personal", title: "About Sai" });
    expect(renamed.updatedAt).toBe(LATER.toISOString());
    const reset = resetSectionTitle(renamed, personal.id, later);
    expect(reset.sections.find((s) => s.id === personal.id)).not.toHaveProperty("title");
  });

  it("returns the same profile when nothing changes", () => {
    const { profile, personal } = setup();
    expect(setSectionVisible(profile, personal.id, true, later)).toBe(profile);
    expect(setSectionVisible(profile, "no-such-id", false, later)).toBe(profile);
    expect(renameSection(profile, "no-such-id", "x", later)).toBe(profile);
    expect(resetSectionTitle(profile, personal.id, later)).toBe(profile);
  });

  it("uses the real clock when none is given", () => {
    const { profile, personal } = setup();
    const before = Date.now();
    const next = setSectionVisible(profile, personal.id, false);
    expect(Date.parse(next.updatedAt)).toBeGreaterThanOrEqual(before);
  });
});

describe("family member edits", () => {
  it("sets a member's details as typed and hides a member, keeping the details", () => {
    const { profile, snapshot } = setup();
    const family = profile.sections.find((s) => s.kind === "family") as FamilySection;
    const father = family.members[0];
    const typed = setMemberDetails(profile, father.id, "Venkata Rao, Retired ", later);
    const hidden = setMemberVisible(typed, father.id, false, later);
    const after = (hidden.sections.find((s) => s.id === family.id) as FamilySection).members[0];
    expect(after).toMatchObject({ relationKey: "father", details: "Venkata Rao, Retired ", visible: false });
    expect(hidden.updatedAt).toBe(LATER.toISOString());
    // Other sections are shared, not copied.
    expect(hidden.sections.filter((s) => s.id !== family.id)).toEqual(profile.sections.filter((s) => s.id !== family.id));
    expect(hidden.sections[1]).toBe(profile.sections[1]);
    expect(profileSchema.safeParse(hidden).success).toBe(true);
    expect(profile).toEqual(snapshot);
  });

  it("returns the same profile when nothing changes", () => {
    const { profile } = setup();
    const family = profile.sections.find((s) => s.kind === "family") as FamilySection;
    expect(setMemberDetails(profile, family.members[0].id, "", later)).toBe(profile);
    expect(setMemberVisible(profile, family.members[0].id, true, later)).toBe(profile);
    expect(setMemberDetails(profile, "no-such-id", "x", later)).toBe(profile);
  });
});
