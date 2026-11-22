import { describe, expect, it } from "vitest";
import { createProfile } from "./defaults";
import { addMember, addPresetSection, editMemberRelation, insertMember, locateMember, moveMember, removeMember, setPhoto } from "./edits";
import { profileSchema } from "./schema";
import type { BiodataProfile, FamilySection, MainPhoto } from "./types";

// Step 2.3: family members and References (VISION §6 "Repeated family members", D28, D44), and the main photo's
// reference (Step 3.1). Same checks as the other edits: immutable (the original is deep-frozen), unchanged parts
// shared, the same profile back for a no-op, and a profile the schema accepts.

const CREATED = new Date("2026-11-22T10:00:00.000Z");
const LATER = new Date("2026-11-22T10:05:00.000Z");
const later = () => LATER;

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function setup() {
  let n = 0;
  let profile = createProfile({ newId: () => `id-${++n}`, now: () => CREATED });
  profile = addPresetSection(profile, "references", () => `id-${++n}`, () => CREATED);
  let m = 0;
  const newId = () => `new-${++m}`;
  return { profile: freeze(profile), newId };
}

const family = (profile: BiodataProfile) => profile.sections.find((s) => s.key === "family") as FamilySection;
const references = (profile: BiodataProfile) => profile.sections.find((s) => s.key === "references") as FamilySection;
const relations = (s: FamilySection) => s.members.map((m) => m.relationKey ?? m.relation);
const valid = (profile: BiodataProfile) => expect(profileSchema.safeParse(profile).success).toBe(true);

describe("adding family members", () => {
  it("adds a picked relation at the end of the list, shown, with its details", () => {
    const { profile, newId } = setup();
    const next = addMember(profile, family(profile).id, { relationKey: "elderBrother", details: "Ravi, Engineer, Pune" }, newId, later);
    expect(family(next).members.at(-1)).toEqual({ id: "new-1", relationKey: "elderBrother", relation: "", details: "Ravi, Engineer, Pune", visible: true });
    expect(relations(family(next))).toEqual(["father", "mother", "elderBrother"]);
    expect(family(next).members[0]).toBe(family(profile).members[0]);
    expect(next.sections[0]).toBe(profile.sections[0]);
    expect(next.updatedAt).toBe(LATER.toISOString());
    valid(next);
  });

  it("keeps a typed relation as typed, with no key, and details empty when none are given", () => {
    const { profile, newId } = setup();
    const next = addMember(profile, family(profile).id, { relation: "Godfather " }, newId, later);
    const added = family(next).members.at(-1)!;
    expect(added).toEqual({ id: "new-1", relation: "Godfather ", details: "", visible: true });
    expect(added).not.toHaveProperty("relationKey");
    valid(next);
  });

  it("keeps several lines of details: a reference with two phone numbers (D44)", () => {
    const { profile, newId } = setup();
    const details = "Pothuri Srinivas, Vijayawada\n+91 90000 00004\n+91 90000 00005";
    const next = addMember(profile, references(profile).id, { relationKey: "maternalUncle", details }, newId, later);
    expect(references(next).members).toEqual([{ id: "new-1", relationKey: "maternalUncle", relation: "", details, visible: true }]);
    // The same relation twice is fine too (two references who are both uncles).
    const twice = addMember(next, references(next).id, { relationKey: "maternalUncle", details: "Another" }, newId, later);
    expect(relations(references(twice))).toEqual(["maternalUncle", "maternalUncle"]);
    valid(twice);
  });

  it("refuses a missing relation, an unknown section and a section of fields", () => {
    const { profile, newId } = setup();
    expect(addMember(profile, family(profile).id, { relation: "   ", details: "x" }, newId, later)).toBe(profile);
    expect(addMember(profile, family(profile).id, { relationKey: "" }, newId, later)).toBe(profile);
    expect(addMember(profile, "nope", { relationKey: "aunt" }, newId, later)).toBe(profile);
    const personal = profile.sections.find((s) => s.key === "personal")!;
    expect(addMember(profile, personal.id, { relationKey: "aunt" }, newId, later)).toBe(profile);
  });
});

describe("editing a member's relation", () => {
  it("typing a relation clears the picked key; picking one clears the typed words", () => {
    const { profile } = setup();
    const father = family(profile).members[0];
    const typed = editMemberRelation(profile, father.id, { relation: "Step-father" }, later);
    expect(family(typed).members[0]).toEqual({ id: father.id, relation: "Step-father", details: "", visible: true });
    expect(family(typed).members[1]).toBe(family(profile).members[1]);
    const picked = editMemberRelation(typed, father.id, { relationKey: "grandfather" }, later);
    expect(family(picked).members[0]).toEqual({ id: father.id, relationKey: "grandfather", relation: "", details: "", visible: true });
    valid(typed);
    valid(picked);
  });

  it("keeps the details and visibility, and is a no-op for the same relation, a blank one or an unknown id", () => {
    const { profile } = setup();
    const mother = family(profile).members[1];
    expect(editMemberRelation(profile, mother.id, { relationKey: "mother" }, later)).toBe(profile);
    expect(editMemberRelation(profile, mother.id, { relation: "  " }, later)).toBe(profile);
    expect(editMemberRelation(profile, "nope", { relationKey: "aunt" }, later)).toBe(profile);
    const typed = editMemberRelation(profile, mother.id, { relation: "Amma" }, later);
    expect(editMemberRelation(typed, mother.id, { relation: "Amma" }, later)).toBe(typed);
  });
});

describe("moving and removing members", () => {
  function withSiblings() {
    const { profile, newId } = setup();
    let next = addMember(profile, family(profile).id, { relationKey: "elderSister", details: "A" }, newId, later);
    next = addMember(next, family(next).id, { relationKey: "youngerBrother", details: "B" }, newId, later);
    return freeze(next);
  }

  it("moves a member one place up or down, a no-op at either end", () => {
    const profile = withSiblings();
    const [father, , sister] = family(profile).members;
    const up = moveMember(profile, sister.id, -1, later);
    expect(relations(family(up))).toEqual(["father", "elderSister", "mother", "youngerBrother"]);
    expect(relations(family(moveMember(up, sister.id, 1, later)))).toEqual(["father", "mother", "elderSister", "youngerBrother"]);
    expect(moveMember(profile, father.id, -1, later)).toBe(profile);
    expect(moveMember(profile, family(profile).members[3].id, 1, later)).toBe(profile);
    expect(moveMember(profile, "nope", 1, later)).toBe(profile);
    valid(up);
  });

  it("removes a member, and insertMember puts them back at their place (Undo)", () => {
    const profile = withSiblings();
    const at = locateMember(profile, family(profile).members[2].id)!;
    expect(at.index).toBe(2);
    expect(at.section.key).toBe("family");
    const removed = at.section.members[at.index];
    const without = removeMember(profile, removed.id, later);
    expect(relations(family(without))).toEqual(["father", "mother", "youngerBrother"]);
    expect(locateMember(without, removed.id)).toBeUndefined();
    const back = insertMember(without, at.section.id, at.index, removed, later);
    expect(family(back).members).toEqual(family(profile).members);
    // Twice is refused; an index past the end is clamped; an unknown id is a no-op.
    expect(insertMember(back, at.section.id, 0, removed, later)).toBe(back);
    expect(relations(family(insertMember(without, at.section.id, 99, removed, later))).at(-1)).toBe("elderSister");
    expect(removeMember(profile, "nope", later)).toBe(profile);
    valid(without);
  });
});

describe("the main photo's reference", () => {
  const photo: MainPhoto = { id: "photo-1", frame: "3:4", crop: { x: 0.5, y: 0.4, zoom: 1.2, rotation: 0 } };

  it("sets, re-crops and removes the photo", () => {
    const { profile } = setup();
    const set = setPhoto(profile, photo, later);
    expect(set.photo).toEqual(photo);
    expect(set.updatedAt).toBe(LATER.toISOString());
    expect(set.sections).toBe(profile.sections);
    valid(set);
    const cropped = setPhoto(set, { ...photo, crop: { ...photo.crop, zoom: 2 } }, later);
    expect(cropped.photo?.crop.zoom).toBe(2);
    const removed = setPhoto(cropped, undefined, later);
    expect(removed).not.toHaveProperty("photo");
    valid(removed);
  });

  it("is a no-op for the same photo, or no photo when there is none", () => {
    const { profile } = setup();
    expect(setPhoto(profile, undefined, later)).toBe(profile);
    const set = setPhoto(profile, photo, later);
    expect(setPhoto(set, { ...photo, crop: { ...photo.crop } }, later)).toBe(set);
  });
});
