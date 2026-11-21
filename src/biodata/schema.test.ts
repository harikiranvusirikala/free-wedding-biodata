import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { SAMPLE_PROFILE, createProfile } from "./defaults";
import { profileSchema } from "./schema";
import type { BiodataProfile } from "./types";

let n = 0;
const fresh = () => createProfile({ newId: () => `id-${++n}`, now: () => new Date("2026-11-21T10:00:00.000Z") });

const issuesOf = (value: unknown) => {
  const result = profileSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
};

describe("profileSchema", () => {
  it("describes exactly the BiodataProfile type", () => {
    // Checked by the type checker (npm run typecheck): fails to compile if the schema and types.ts drift apart.
    // (expectTypeOf's toEqualTypeOf misreads arrays of discriminated unions, so a plain equality type is used.)
    type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
    const same: Equals<z.infer<typeof profileSchema>, BiodataProfile> = true;
    expect(same).toBe(true);
  });

  it("accepts a new draft and the sample", () => {
    expect(profileSchema.safeParse(fresh()).success).toBe(true);
    expect(profileSchema.safeParse(SAMPLE_PROFILE).success).toBe(true);
  });

  it("accepts photos within the D40/D41 limits", () => {
    const crop = { x: 0.5, y: 0.4, zoom: 1.2, rotation: 90 };
    const profile = {
      ...fresh(),
      photo: { id: "p1", crop, frame: "2:3" },
      secondPhoto: { id: "p2", crop },
      photoPages: { perPage: 2, photos: [{ id: "p3", crop }] },
      horoscopeChart: { id: "p4", crop },
    };
    expect(issuesOf(profile)).toEqual([]);
  });

  it("drops unknown keys at every level instead of rejecting them (VISION §9)", () => {
    const profile = fresh();
    const withExtras = {
      ...profile,
      futureOption: true,
      options: { ...profile.options, letterhead: true },
      sections: profile.sections.map((s) => ({ ...s, colour: "red" })),
    };
    const result = profileSchema.parse(withExtras);
    expect(result).not.toHaveProperty("futureOption");
    expect(result.options).not.toHaveProperty("letterhead");
    expect(result.sections[0]).not.toHaveProperty("colour");
    expect(result).toEqual(profile);
  });

  it.each([
    ["a missing field", (p: BiodataProfile) => ({ ...p, draftName: undefined }), "draftName"],
    ["a number value", (p: BiodataProfile) => withFirstField(p, { value: 5 }), "sections.1.fields.0.value"],
    ["an unknown field type", (p: BiodataProfile) => withFirstField(p, { type: "number" }), "sections.1.fields.0.type"],
    ["a field with neither key nor label", (p: BiodataProfile) => withFirstField(p, { key: undefined }), "sections.1.fields.0"],
    ["an unknown section kind", (p: BiodataProfile) => ({ ...p, sections: [{ ...p.sections[0], kind: "table" }] }), "sections.0.kind"],
    ["an unknown language", (p: BiodataProfile) => ({ ...p, docLanguage: "fr" }), "docLanguage"],
    ["a negative revision", (p: BiodataProfile) => ({ ...p, revision: -1 }), "revision"],
    ["a fractional revision", (p: BiodataProfile) => ({ ...p, revision: 1.5 }), "revision"],
    ["a non-ISO timestamp", (p: BiodataProfile) => ({ ...p, updatedAt: "yesterday" }), "updatedAt"],
    ["an unknown text size", (p: BiodataProfile) => ({ ...p, options: { ...p.options, textSize: "huge" } }), "options.textSize"],
    ["an empty motif id", (p: BiodataProfile) => ({ ...p, options: { ...p.options, motif: "" } }), "options.motif"],
    ["another schema version", (p: BiodataProfile) => ({ ...p, schemaVersion: 2 }), "schemaVersion"],
    [
      "a crop outside the image",
      (p: BiodataProfile) => ({ ...p, photo: { id: "p", frame: "3:4", crop: { x: 1.5, y: 0, zoom: 1, rotation: 0 } } }),
      "photo.crop.x",
    ],
    [
      "a rotation that isn't a quarter turn",
      (p: BiodataProfile) => ({ ...p, photo: { id: "p", frame: "3:4", crop: { x: 0, y: 0, zoom: 1, rotation: 45 } } }),
      "photo.crop.rotation",
    ],
    [
      "more than four extra photos",
      (p: BiodataProfile) => ({
        ...p,
        photoPages: { perPage: 4, photos: [1, 2, 3, 4, 5].map((i) => ({ id: `p${i}`, crop: { x: 0, y: 0, zoom: 1, rotation: 0 } })) },
      }),
      "photoPages.photos",
    ],
  ])("rejects %s", (_name, breakIt, path) => {
    expect(issuesOf(breakIt(fresh()))).toContain(path);
  });

  it("rejects duplicate ids, which would make edits hit the wrong row", () => {
    const profile = fresh();
    const personal = profile.sections[1];
    if (personal.kind !== "fields") throw new Error("expected fields");
    const duplicate = { ...profile, sections: [{ ...personal, fields: [personal.fields[0], personal.fields[0]] }] };
    expect(issuesOf(duplicate)).toContain("sections.0.fields.1.id");
  });

  it("rejects things that aren't profiles", () => {
    for (const value of [null, undefined, 42, "profile", [], {}]) expect(profileSchema.safeParse(value).success).toBe(false);
  });
});

function withFirstField(profile: BiodataProfile, change: Record<string, unknown>) {
  return {
    ...profile,
    sections: profile.sections.map((s, i) =>
      i === 1 && s.kind === "fields" ? { ...s, fields: [{ ...s.fields[0], ...change }, ...s.fields.slice(1)] } : s,
    ),
  };
}
