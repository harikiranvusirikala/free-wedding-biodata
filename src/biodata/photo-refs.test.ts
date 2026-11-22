import { describe, expect, it } from "vitest";
import { createProfile } from "./defaults";
import { keepPhotoRefs, mapPhotoRefs, photoIdsOf, swapPhotoIds } from "./photo-refs";
import type { BiodataProfile } from "./types";

const crop = { x: 0.5, y: 0.5, zoom: 1, rotation: 0 } as const;

function withEveryPhoto(): BiodataProfile {
  const profile = createProfile({ newId: () => crypto.randomUUID() });
  profile.photo = { id: "main", frame: "3:4", crop };
  profile.secondPhoto = { id: "second", crop };
  profile.photoPages = { perPage: 2, photos: [{ id: "extra-1", crop }, { id: "extra-2", crop }] };
  profile.horoscopeChart = { id: "chart", crop };
  return profile;
}

describe("photo references", () => {
  it("lists every picture a draft points at, in a steady order", () => {
    expect(photoIdsOf(withEveryPhoto())).toEqual(["main", "second", "extra-1", "extra-2", "chart"]);
    expect(photoIdsOf(createProfile({ newId: () => crypto.randomUUID() }))).toEqual([]);
  });

  it("swaps ids through a map, keeping the rest of each reference and any id the map doesn't have", () => {
    const profile = withEveryPhoto();
    const before = structuredClone(profile);
    const next = swapPhotoIds(profile, new Map([["main", "m2"], ["extra-2", "e2"], ["chart", "c2"]]));
    expect(photoIdsOf(next)).toEqual(["m2", "second", "extra-1", "e2", "c2"]);
    expect(next.photo).toEqual({ id: "m2", frame: "3:4", crop });
    expect(next.photoPages?.perPage).toBe(2);
    expect(profile).toEqual(before);
  });

  it("keeps an empty photo group as it was when swapping", () => {
    const profile = createProfile({ newId: () => crypto.randomUUID() });
    profile.photoPages = { perPage: 1, photos: [] };
    expect(swapPhotoIds(profile, new Map()).photoPages).toEqual({ perPage: 1, photos: [] });
  });

  it("removes the references to pictures that aren't kept, and a group left with none", () => {
    const profile = withEveryPhoto();
    const next = keepPhotoRefs(profile, new Set(["second", "extra-2"]));
    expect(next.photo).toBeUndefined();
    expect("photo" in next).toBe(false);
    expect(next.horoscopeChart).toBeUndefined();
    expect(next.photoPages?.photos.map((p) => p.id)).toEqual(["extra-2"]);
    expect("photoPages" in keepPhotoRefs(profile, new Set(["main"]))).toBe(false);
  });

  it("can drop and rename in one pass", () => {
    const next = mapPhotoRefs(withEveryPhoto(), (id) => (id.startsWith("extra") ? undefined : `new-${id}`));
    expect(photoIdsOf(next)).toEqual(["new-main", "new-second", "new-chart"]);
  });
});
