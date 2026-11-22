import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MainPhoto } from "@/biodata/types";
import { DOCUMENT_PHOTO_MM, documentPhotoKey, documentPhotoPixels, loadDocumentPhoto, useDocumentPhoto, type RenderCrop } from "./document-photo";

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
