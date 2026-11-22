import { describe, expect, it } from "vitest";
import { createProfile } from "./defaults";
import {
  addPhotoPagePhoto,
  insertPhotoPagePhoto,
  movePhotoPagePhoto,
  removePhotoPagePhoto,
  replacePhotoPagePhoto,
  setHoroscopeChart,
  setHoroscopeIncluded,
  setPhotoPagesIncluded,
  setPhotosPerPage,
} from "./edits";
import { extraPageCounts, photoPageCount, photoPageGroups, printedChart, printedPhotoPages, PHOTO_PAGE_FRAME } from "./photo-pages";
import { photoIdsOf } from "./photo-refs";
import { profileSchema } from "./schema";
import { MAX_EXTRA_PHOTOS, type BiodataProfile, type PhotoRef } from "./types";

// Step 4.2b: the extra photo pages and the horoscope chart (D40, D41). Each edit is immutable (the profile is
// deep-frozen), returns the same profile when it changes nothing and leaves a profile the schema accepts.

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

const start = () => {
  let n = 0;
  return freeze(createProfile({ newId: () => `id-${++n}`, now: () => new Date("2026-11-22T10:00:00.000Z"), formLayout: "detailed" }));
};
const valid = (profile: BiodataProfile) => expect(profileSchema.safeParse(profile).success).toBe(true);
const ids = (profile: BiodataProfile) => profile.photoPages?.photos.map((p) => p.id);

function withPhotos(n: number): BiodataProfile {
  let p = start();
  for (let i = 1; i <= n; i++) p = addPhotoPagePhoto(p, ref(`e${i}`), later);
  return p;
}

describe("the cap is eight (VISION D40, owner's change from four)", () => {
  it("holds 8 extra photos and refuses a ninth", () => {
    expect(MAX_EXTRA_PHOTOS).toBe(8);
    const full = withPhotos(8);
    expect(ids(full)).toEqual(["e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8"]);
    valid(full);
    expect(addPhotoPagePhoto(full, ref("e9"), later)).toBe(full);
    expect(insertPhotoPagePhoto(full, 0, ref("e9"))).toBe(full);
  });
});

describe("addPhotoPagePhoto / insertPhotoPagePhoto", () => {
  it("starts a group at 1 photo per page, printed, and appends in order", () => {
    const first = addPhotoPagePhoto(start(), ref("a"), later);
    expect(first.photoPages).toEqual({ perPage: 1, photos: [ref("a")] });
    expect(first.updatedAt).toBe(LATER.toISOString());
    const second = addPhotoPagePhoto(first, ref("b"), later);
    expect(ids(second)).toEqual(["a", "b"]);
    expect(ids(first)).toEqual(["a"]); // the original is untouched
    valid(second);
  });

  it("refuses an id the draft already uses, anywhere", () => {
    let p = addPhotoPagePhoto(start(), ref("a"), later);
    expect(addPhotoPagePhoto(p, ref("a"))).toBe(p);
    p = setHoroscopeChart(p, ref("chart"), later);
    expect(addPhotoPagePhoto(p, ref("chart"))).toBe(p);
    const withMain = { ...p, photo: { ...ref("main"), frame: "3:4" as const } };
    expect(addPhotoPagePhoto(withMain, ref("main"))).toBe(withMain);
  });

  it("inserts at an index (clamped), for Undo", () => {
    const p = withPhotos(3);
    expect(ids(insertPhotoPagePhoto(p, 1, ref("x")))).toEqual(["e1", "x", "e2", "e3"]);
    expect(ids(insertPhotoPagePhoto(p, -5, ref("x")))).toEqual(["x", "e1", "e2", "e3"]);
    expect(ids(insertPhotoPagePhoto(p, 99, ref("x")))).toEqual(["e1", "e2", "e3", "x"]);
  });

  it("brings back the group's settings when Undo restores the only photo", () => {
    const only = setPhotosPerPage(withPhotos(1), 4, later);
    const gone = removePhotoPagePhoto(only, "e1", later);
    expect(gone.photoPages).toBeUndefined();
    const back = insertPhotoPagePhoto(gone, 0, ref("e1"), only.photoPages, later);
    expect(back.photoPages).toEqual(only.photoPages);
    const off = setPhotoPagesIncluded(only, false, later);
    expect(insertPhotoPagePhoto(removePhotoPagePhoto(off, "e1", later), 0, ref("e1"), off.photoPages, later).photoPages).toEqual({ perPage: 4, photos: [ref("e1")], include: false });
  });
});

describe("replacePhotoPagePhoto", () => {
  it("swaps the picture and keeps its place", () => {
    const p = withPhotos(3);
    const next = replacePhotoPagePhoto(p, "e2", ref("new"), later);
    expect(ids(next)).toEqual(["e1", "new", "e3"]);
    valid(next);
  });

  it("changes only the crop when the id stays", () => {
    const p = withPhotos(2);
    const next = replacePhotoPagePhoto(p, "e1", ref("e1", 2.5), later);
    expect(next.photoPages?.photos[0].crop.zoom).toBe(2.5);
    expect(photoIdsOf(next)).toEqual(photoIdsOf(p));
  });

  it("is a no-op for an unknown id, an unchanged crop or an id another picture holds", () => {
    const p = withPhotos(2);
    expect(replacePhotoPagePhoto(p, "nope", ref("z"))).toBe(p);
    expect(replacePhotoPagePhoto(p, "e1", ref("e1"))).toBe(p);
    expect(replacePhotoPagePhoto(p, "e1", ref("e2"))).toBe(p);
    const empty = start();
    expect(replacePhotoPagePhoto(empty, "e1", ref("z"))).toBe(empty);
  });
});

describe("removePhotoPagePhoto", () => {
  it("removes one photo and keeps the order", () => {
    const next = removePhotoPagePhoto(withPhotos(3), "e2", later);
    expect(ids(next)).toEqual(["e1", "e3"]);
    valid(next);
  });

  it("removes the group with its last photo", () => {
    const next = removePhotoPagePhoto(withPhotos(1), "e1", later);
    expect("photoPages" in next).toBe(false);
    valid(next);
  });

  it("does nothing for an unknown id", () => {
    const p = withPhotos(2);
    expect(removePhotoPagePhoto(p, "nope")).toBe(p);
    const empty = start();
    expect(removePhotoPagePhoto(empty, "nope")).toBe(empty);
  });
});

describe("movePhotoPagePhoto", () => {
  it("moves earlier and later, clamped at the ends", () => {
    const p = withPhotos(4);
    expect(ids(movePhotoPagePhoto(p, "e3", 1, later))).toEqual(["e1", "e3", "e2", "e4"]);
    expect(ids(movePhotoPagePhoto(p, "e2", 2, later))).toEqual(["e1", "e3", "e2", "e4"]);
    expect(ids(movePhotoPagePhoto(p, "e1", 99, later))).toEqual(["e2", "e3", "e4", "e1"]);
    expect(ids(movePhotoPagePhoto(p, "e4", -3, later))).toEqual(["e4", "e1", "e2", "e3"]);
  });

  it("is a no-op where it already is, or for an unknown id", () => {
    const p = withPhotos(3);
    expect(movePhotoPagePhoto(p, "e1", 0)).toBe(p);
    expect(movePhotoPagePhoto(p, "e3", 5)).toBe(p);
    expect(movePhotoPagePhoto(p, "nope", 1)).toBe(p);
  });
});

describe("setPhotosPerPage and setPhotoPagesIncluded", () => {
  it("sets 1, 2 or 4 and refuses anything else", () => {
    const p = withPhotos(3);
    expect(setPhotosPerPage(p, 2, later).photoPages?.perPage).toBe(2);
    expect(setPhotosPerPage(p, 4, later).photoPages?.perPage).toBe(4);
    expect(setPhotosPerPage(p, 1)).toBe(p);
    expect(setPhotosPerPage(p, 3)).toBe(p);
    const empty = start();
    expect(setPhotosPerPage(empty, 2)).toBe(empty);
  });

  it("switches the pages off without losing a photo, and on again", () => {
    const p = withPhotos(3);
    const off = setPhotoPagesIncluded(p, false, later);
    expect(off.photoPages?.include).toBe(false);
    expect(ids(off)).toEqual(["e1", "e2", "e3"]);
    expect(photoIdsOf(off)).toEqual(photoIdsOf(p));
    valid(off);
    const on = setPhotoPagesIncluded(off, true, later);
    expect(on.photoPages).toEqual(p.photoPages); // "on" is the absence of a value
    expect("include" in on.photoPages!).toBe(false);
    expect(setPhotoPagesIncluded(p, true)).toBe(p);
    expect(setPhotoPagesIncluded(off, false)).toBe(off);
    const empty = start();
    expect(setPhotoPagesIncluded(empty, false)).toBe(empty);
  });

  it("keeps the switch and the layout when photos come and go", () => {
    let p = setPhotoPagesIncluded(setPhotosPerPage(withPhotos(2), 2, later), false, later);
    p = addPhotoPagePhoto(p, ref("e3"), later);
    p = movePhotoPagePhoto(p, "e3", 0, later);
    p = replacePhotoPagePhoto(p, "e1", ref("z"), later);
    p = removePhotoPagePhoto(p, "e2", later);
    expect(p.photoPages).toMatchObject({ perPage: 2, include: false });
    expect(ids(p)).toEqual(["e3", "z"]);
  });
});

describe("the horoscope chart (D41)", () => {
  it("sets, replaces and removes it", () => {
    const set = setHoroscopeChart(start(), ref("chart"), later);
    expect(set.horoscopeChart).toEqual(ref("chart"));
    valid(set);
    const replaced = setHoroscopeChart(set, ref("chart2"), later);
    expect(replaced.horoscopeChart?.id).toBe("chart2");
    const gone = setHoroscopeChart(replaced, undefined, later);
    expect("horoscopeChart" in gone).toBe(false);
    expect(setHoroscopeChart(gone, undefined)).toBe(gone);
    expect(setHoroscopeChart(set, ref("chart"))).toBe(set);
  });

  it("refuses an id another picture holds", () => {
    const p = withPhotos(1);
    expect(setHoroscopeChart(p, ref("e1"))).toBe(p);
  });

  it("switches off and on, keeping the picture, and a replacement keeps the choice", () => {
    const set = setHoroscopeChart(start(), ref("chart"), later);
    const off = setHoroscopeIncluded(set, false, later);
    expect(off.horoscopeChart).toEqual({ ...ref("chart"), include: false });
    valid(off);
    expect(setHoroscopeChart(off, ref("chart2"), later).horoscopeChart).toEqual({ ...ref("chart2"), include: false });
    // Undo hands the removed chart back whole.
    expect(setHoroscopeChart(setHoroscopeChart(off, undefined, later), off.horoscopeChart, later).horoscopeChart).toEqual(off.horoscopeChart);
    const on = setHoroscopeIncluded(off, true, later);
    expect(on.horoscopeChart).toEqual(ref("chart"));
    expect("include" in on.horoscopeChart!).toBe(false);
    expect(setHoroscopeIncluded(set, true)).toBe(set);
    const empty = start();
    expect(setHoroscopeIncluded(empty, false)).toBe(empty);
  });

  it("re-cropping (a quarter turn) keeps the choice", () => {
    const off = setHoroscopeIncluded(setHoroscopeChart(start(), ref("chart"), later), false, later);
    const turned = setHoroscopeChart(off, { id: "chart", crop: { ...crop, rotation: 90 } }, later);
    expect(turned.horoscopeChart).toEqual({ id: "chart", crop: { ...crop, rotation: 90 }, include: false });
  });
});

describe("what prints (photo-pages.ts)", () => {
  it("prints nothing when off or empty, and the photos in order when on", () => {
    const p = setPhotosPerPage(withPhotos(3), 2, later);
    expect(printedPhotoPages(p)).toEqual({ perPage: 2, photos: p.photoPages!.photos });
    expect(printedPhotoPages(setPhotoPagesIncluded(p, false, later))).toBeUndefined();
    expect(printedPhotoPages(start())).toBeUndefined();
    expect(printedPhotoPages({ photoPages: { perPage: 1, photos: [] } })).toBeUndefined();
  });

  it("prints the chart unless it is switched off", () => {
    const set = setHoroscopeChart(start(), ref("chart"), later);
    expect(printedChart(set)?.id).toBe("chart");
    expect(printedChart(setHoroscopeIncluded(set, false, later))).toBeUndefined();
    expect(printedChart(start())).toBeUndefined();
  });

  it("counts pages: 3 photos at 2 a page take 2 pages; the chart adds one", () => {
    expect([1, 2, 4].map((n) => photoPageCount(n, 3))).toEqual([3, 2, 1]);
    expect(photoPageCount(2, 0)).toBe(0);
    expect(photoPageGroups([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    const p = setHoroscopeChart(setPhotosPerPage(withPhotos(5), 2, later), ref("chart"), later);
    expect(extraPageCounts(p)).toEqual({ photos: 3, chart: 1, total: 4 });
    expect(extraPageCounts(setHoroscopeIncluded(setPhotoPagesIncluded(p, false, later), false, later))).toEqual({ photos: 0, chart: 0, total: 0 });
    expect(extraPageCounts(start())).toEqual({ photos: 0, chart: 0, total: 0 });
  });

  it("crops every photo to the frame its layout names", () => {
    expect(PHOTO_PAGE_FRAME).toEqual({ 1: "2:3", 2: "2:3", 4: "3:4" });
  });
});
