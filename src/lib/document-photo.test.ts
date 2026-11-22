import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MainPhoto, PhotoCrop } from "@/biodata/types";
import { DOCUMENT_PHOTO_MM, PAGE_PHOTO_QUALITY, documentPhotoKey, documentPhotoPixels, loadDocumentPhoto, photoPageRequests, photoPagesInput, useDocumentPhoto, useDocumentPhotos, type RenderCrop } from "./document-photo";
import { photoPagePixels } from "@/document/photo-pages";
import type { DrawPicture } from "./picture-store";

// The document's cropped photo (Step 3.1 → 3.3). Drawing needs a real canvas (checked in e2e on /dev/draft), so
// these tests pass their own `render` and check what it is asked for and what comes back.

const PHOTO: MainPhoto = { id: "p1", frame: "3:4", crop: { x: 0.5, y: 0.4, zoom: 1.5, rotation: 90 } };
const blob = new Blob(["jpeg"], { type: "image/jpeg" });
const fakeRender: RenderCrop = async (_blob, crop, frame, width) => `data:image/jpeg;base64,${crop.zoom}-${frame}-${width}`;

describe("document photo", () => {
  it("draws at 300 dpi for the widest printed frame", () => {
    expect(DOCUMENT_PHOTO_MM).toBeGreaterThanOrEqual((200 * 25.4) / 96);
    expect(documentPhotoPixels()).toBe(Math.round((DOCUMENT_PHOTO_MM / 25.4) * 300));
    expect(documentPhotoPixels(25.4)).toBe(300);
  });

  it("keys on the picture, frame and crop only", () => {
    expect(documentPhotoKey(undefined)).toBeUndefined();
    const key = documentPhotoKey(PHOTO);
    expect(documentPhotoKey({ ...PHOTO, crop: { ...PHOTO.crop } })).toBe(key);
    expect(documentPhotoKey({ ...PHOTO, frame: "2:3" })).not.toBe(key);
    expect(documentPhotoKey({ ...PHOTO, id: "p2" })).not.toBe(key);
    expect(documentPhotoKey({ ...PHOTO, crop: { ...PHOTO.crop, x: 0.51 } })).not.toBe(key);
    expect(documentPhotoKey({ ...PHOTO, crop: { ...PHOTO.crop, rotation: 0 } })).not.toBe(key);
  });

  it("crops the stored picture into a data URL with the frame", async () => {
    const loadBlob = vi.fn(async () => blob);
    const render = vi.fn(fakeRender);
    const input = await loadDocumentPhoto(PHOTO, loadBlob, { render });
    expect(loadBlob).toHaveBeenCalledWith("p1");
    expect(render).toHaveBeenCalledWith(blob, PHOTO.crop, "3:4", documentPhotoPixels());
    expect(input).toEqual({ src: `data:image/jpeg;base64,1.5-3:4-${documentPhotoPixels()}`, frame: "3:4" });
  });

  it("gives nothing for no photo, a missing picture, or one that can't be read or drawn", async () => {
    const render = vi.fn(fakeRender);
    expect(await loadDocumentPhoto(undefined, async () => blob, { render })).toBeUndefined();
    expect(await loadDocumentPhoto(PHOTO, async () => undefined, { render })).toBeUndefined();
    expect(await loadDocumentPhoto(PHOTO, () => Promise.reject(new Error("db")), { render })).toBeUndefined();
    expect(await loadDocumentPhoto(PHOTO, async () => blob, { render: () => Promise.reject(new Error("decode")) })).toBeUndefined();
    expect(render).not.toHaveBeenCalled();
  });
});

describe("useDocumentPhoto", () => {
  it("draws the photo, keeps the old picture while a new crop draws, and drops it when the photo is removed", async () => {
    const loadBlob = vi.fn(async () => blob);
    const render = vi.fn(fakeRender);
    const { result, rerender } = renderHook(({ photo }: { photo?: MainPhoto }) => useDocumentPhoto(photo, loadBlob, { render }), { initialProps: { photo: PHOTO as MainPhoto | undefined } });
    expect(result.current).toEqual({ photo: undefined, ready: false });
    await waitFor(() => expect(result.current.ready).toBe(true));
    const first = result.current.photo;
    expect(first?.src).toContain("1.5-3:4");

    // The same crop in a new object: nothing is redrawn and the object stays the same.
    rerender({ photo: { ...PHOTO, crop: { ...PHOTO.crop } } });
    expect(result.current.photo).toBe(first);
    expect(render).toHaveBeenCalledTimes(1);

    // A new crop: the old picture stays until the new one is drawn.
    rerender({ photo: { ...PHOTO, crop: { ...PHOTO.crop, zoom: 2 } } });
    expect(result.current).toEqual({ photo: first, ready: false });
    await waitFor(() => expect(result.current.photo?.src).toContain("2-3:4"));
    expect(result.current.ready).toBe(true);

    await act(async () => rerender({ photo: undefined }));
    expect(result.current).toEqual({ photo: undefined, ready: true });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The pages after the biodata (Step 4.2b).

const CROP: PhotoCrop = { x: 0.5, y: 0.5, zoom: 1, rotation: 0 };
const pages = (perPage: 1 | 2 | 4, ids: string[], extra: { include?: boolean } = {}) => ({
  photoPages: { perPage, photos: ids.map((id) => ({ id, crop: CROP })), ...extra },
  horoscopeChart: undefined,
});

describe("photoPageRequests", () => {
  it("asks for each photo in its layout's frame at the pixels its cell needs, and the chart whole", () => {
    const requests = photoPageRequests({ ...pages(1, ["a", "b"]), horoscopeChart: { id: "c", crop: { ...CROP, rotation: 90 } } });
    expect(requests.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(requests[0].spec).toEqual({ kind: "crop", crop: CROP, frame: "2:3", outWidth: photoPagePixels(1), quality: PAGE_PHOTO_QUALITY });
    expect(requests[2].spec).toEqual({ kind: "fit", rotation: 90 });
    expect(photoPageRequests(pages(4, ["a"]))[0].spec).toMatchObject({ frame: "3:4", outWidth: photoPagePixels(4) });
    expect(photoPagePixels(4)).toBeLessThan(photoPagePixels(1));
  });

  it("asks for nothing when the pages are switched off or there are none", () => {
    expect(photoPageRequests(pages(2, ["a", "b"], { include: false }))).toEqual([]);
    expect(photoPageRequests({ photoPages: undefined, horoscopeChart: { id: "c", crop: CROP, include: false } })).toEqual([]);
    expect(photoPageRequests({})).toEqual([]);
  });

  it("changes a key when the crop, the layout or the picture changes, never for the design", () => {
    const key = (p: Parameters<typeof photoPageRequests>[0]) => photoPageRequests(p)[0].key;
    const base = key(pages(1, ["a"]));
    expect(key(pages(1, ["a"]))).toBe(base);
    expect(key(pages(2, ["a"]))).not.toBe(base);
    expect(key({ photoPages: { perPage: 1, photos: [{ id: "a", crop: { ...CROP, zoom: 2 } }] } })).not.toBe(base);
    expect(key(pages(1, ["z"]))).not.toBe(base);
  });
});

describe("photoPagesInput", () => {
  const request = (id: string) => photoPageRequests(pages(1, [id]))[0];
  const snapshot = (entries: [string, { src: string; width: number; height: number } | null][]) => ({ drawn: new Map(entries), latest: new Map<string, { src: string; width: number; height: number }>() });

  it("leaves an empty cell for a photo not drawn yet, and out a photo that can't be read", () => {
    const profile = pages(2, ["a", "b", "c"]);
    const requests = photoPageRequests(profile);
    const input = photoPagesInput(profile, "Horoscope", requests, snapshot([[requests[0].key, { src: "blob:a", width: 1, height: 1 }], [requests[2].key, null]]));
    expect(input?.perPage).toBe(2);
    expect(input?.photos).toEqual([{ id: "a", picture: { src: "blob:a", width: 1, height: 1 } }, { id: "b", picture: undefined }]);
    expect(request("a").id).toBe("a");
  });

  it("has the chart page with its heading, or nothing at all when nothing prints", () => {
    const profile = { photoPages: undefined, horoscopeChart: { id: "c", crop: CROP } };
    const requests = photoPageRequests(profile);
    expect(photoPagesInput(profile, "జాతక వివరాలు", requests, snapshot([[requests[0].key, { src: "blob:c", width: 4, height: 3 }]]))?.chart).toEqual({ title: "జాతక వివరాలు", picture: { src: "blob:c", width: 4, height: 3 } });
    expect(photoPagesInput({}, "x", [], snapshot([]))).toBeUndefined();
    expect(photoPagesInput(pages(1, ["a"], { include: false }), "x", [], snapshot([]))).toBeUndefined();
  });
});

describe("useDocumentPhotos", () => {
  const draw: DrawPicture = async (_blob, spec) => ({ src: `blob:${spec.kind === "crop" ? spec.crop.zoom : "chart"}-${Math.random()}`, width: 10, height: 15 });

  it("draws every photo, says when they're all drawn, and redraws only what changed", async () => {
    const loadBlob = vi.fn(async () => blob);
    const drawFn = vi.fn(draw);
    const profile = pages(2, ["a", "b", "c"]);
    const { result, rerender } = renderHook(({ p }: { p: Parameters<typeof photoPageRequests>[0] }) => useDocumentPhotos(p, "Horoscope", loadBlob, drawFn), { initialProps: { p: profile } });
    expect(result.current.ready).toBe(false);
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(drawFn).toHaveBeenCalledTimes(3);
    expect(result.current.input?.photos.map((p) => p.id)).toEqual(["a", "b", "c"]);
    const first = result.current.input;

    // The same photos in new objects: nothing is drawn again.
    rerender({ p: { photoPages: structuredClone(profile.photoPages), horoscopeChart: undefined } });
    expect(drawFn).toHaveBeenCalledTimes(3);
    expect(result.current.input?.photos.map((p) => p.picture?.src)).toEqual(first?.photos.map((p) => p.picture?.src));

    // Reordered: nothing is drawn again (a key holds the picture and its crop, not its position).
    rerender({ p: pages(2, ["c", "a", "b"]) });
    expect(result.current.ready).toBe(true);
    expect(drawFn).toHaveBeenCalledTimes(3);
    expect(result.current.input?.photos.map((p) => p.id)).toEqual(["c", "a", "b"]);

    // One photo re-cropped: only it is drawn, and the old picture stands in until then.
    const recropped = pages(2, ["c", "a", "b"]);
    recropped.photoPages.photos[1] = { id: "a", crop: { ...CROP, zoom: 2 } };
    rerender({ p: recropped });
    expect(result.current.ready).toBe(false);
    expect(result.current.input?.photos[1].picture).toBeDefined();
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(drawFn).toHaveBeenCalledTimes(4);

    // Switched off: nothing to draw, nothing to print.
    rerender({ p: pages(2, ["c", "a", "b"], { include: false }) });
    expect(result.current).toEqual({ input: undefined, ready: true });
  });

  it("is ready at once when nothing prints", () => {
    const { result } = renderHook(() => useDocumentPhotos({}, "x", async () => blob, draw));
    expect(result.current).toEqual({ input: undefined, ready: true });
  });
});
