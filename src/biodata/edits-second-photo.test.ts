import { describe, expect, it } from "vitest";
import { createProfile } from "./defaults";
import { addPhotoPagePhoto, setPhoto, setSecondPhoto } from "./edits";
import { keepPhotoRefs, photoIdsOf, swapPhotoIds } from "./photo-refs";
import { profileSchema } from "./schema";
import type { BiodataProfile, PhotoRef } from "./types";

// Step 4.4: the second photo on page 1 (D40). The edit is immutable (deep-frozen input), returns the same profile when
// it changes nothing, refuses an id another picture of the draft uses, and leaves a profile the schema accepts; the
// picture is copied, restored and deleted with the draft like every other (photo-refs).

const LATER = new Date("2026-11-22T10:05:00.000Z");
const later = () => LATER;
const crop = { x: 0.5, y: 0.5, zoom: 1, rotation: 0 } as const;
const ref = (id: string, zoom = 1): PhotoRef => ({ id, crop: { ...crop, zoom } });

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

const base = () => freeze(setPhoto(createProfile(), { id: "main", crop, frame: "3:4" }));

describe("setSecondPhoto", () => {
  it("adds, re-crops, replaces and removes the second photo, touching nothing else", () => {
    const p = base();
    const added = setSecondPhoto(p, ref("second"), later);
    expect(added.secondPhoto).toEqual(ref("second"));
    expect(added.updatedAt).toBe(LATER.toISOString());
    expect(added.photo).toBe(p.photo);
    expect(profileSchema.safeParse(added).success).toBe(true);

    const cropped = setSecondPhoto(freeze(added), ref("second", 1.6), later);
    expect(cropped.secondPhoto?.crop.zoom).toBe(1.6);
    const replaced = setSecondPhoto(freeze(cropped), ref("other"), later);
    expect(replaced.secondPhoto?.id).toBe("other");

    const removed = setSecondPhoto(freeze(replaced), undefined, later);
    expect("secondPhoto" in removed).toBe(false);
    expect(profileSchema.safeParse(removed).success).toBe(true);
  });

  it("returns the same profile when nothing changes", () => {
    const p = base();
    expect(setSecondPhoto(p, undefined, later)).toBe(p);
    const added = freeze(setSecondPhoto(p, ref("second"), later));
    expect(setSecondPhoto(added, ref("second"), later)).toBe(added);
  });

  it("refuses an id another picture of the draft already uses", () => {
    const p = freeze(addPhotoPagePhoto(base(), ref("page"), later));
    expect(setSecondPhoto(p, ref("main"), later)).toBe(p);
    expect(setSecondPhoto(p, ref("page"), later)).toBe(p);
  });

  it("stays when the main photo is removed (it prints again once a main photo is back)", () => {
    const p = freeze(setSecondPhoto(base(), ref("second"), later));
    const noMain = setPhoto(p, undefined, later);
    expect(noMain.photo).toBeUndefined();
    expect(noMain.secondPhoto).toEqual(ref("second"));
  });

  it("is a picture of the draft for duplicate, backup and restore", () => {
    const p: BiodataProfile = setSecondPhoto(base(), ref("second"), later);
    expect(photoIdsOf(p)).toEqual(["main", "second"]);
    expect(swapPhotoIds(p, new Map([["second", "fresh"]])).secondPhoto?.id).toBe("fresh");
    expect("secondPhoto" in keepPhotoRefs(p, new Set(["main"]))).toBe(false);
  });
});
