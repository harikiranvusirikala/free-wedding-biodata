import { useEffect, useRef, useState } from "react";
import type { MainPhoto, PhotoFrame } from "@/biodata/types";
import type { PhotoInput } from "@/document/blocks/types";
import { printPixels, renderCropDataUrl } from "./photos";

// The cropped photo for the document (Step 3.1, D12): the stored source picture drawn through the profile's crop
// into a JPEG data URL, which DocumentView's `photo` prop takes and the PDF writer embeds (Step 3.2 note). The
// crop is applied at render time, so re-cropping never loses quality. Used by /dev/draft now and by the live
// preview (Step 3.3) next: `useDocumentPhoto(profile.photo, loadBlob)` → `<DocumentView photo={photo} … />`.

/** Reads a stored picture by id (profile-repo's getPhoto → record.blob); undefined when it isn't there. */
export type LoadBlob = (id: string) => Promise<Blob | undefined>;
export type RenderCrop = typeof renderCropDataUrl;

/**
 * The widest printed photo frame in any design, rounded up: Classic Gold and Paisley print 200 px at 96 px per
 * inch ≈ 53 mm. At 300 dpi that is the most pixels a frame ever needs; a smaller frame just scales it down.
 */
export const DOCUMENT_PHOTO_MM = 56;

/** The pixels across the document photo is drawn at: the frame's printed width at 300 dpi. */
export function documentPhotoPixels(printWidthMm = DOCUMENT_PHOTO_MM): number {
  return printPixels(printWidthMm);
}

/**
 * What the drawn picture depends on: the picture, its frame and its crop. Equal keys give the same data URL, so
 * a caller redraws (and the document re-measures) only when one of them changes. Undefined: no photo.
 */
export function documentPhotoKey(photo: MainPhoto | undefined): string | undefined {
  if (!photo) return undefined;
  const { x, y, zoom, rotation } = photo.crop;
  return [photo.id, photo.frame, x, y, zoom, rotation].join("|");
}

/**
 * The document's photo for a profile's main photo: its stored picture cropped into the frame as a JPEG data URL.
 * Undefined when there is no photo, or its picture can't be read or decoded (the document then draws no frame,
 * as for a profile without a photo; the editor's photo card says the picture is missing).
 */
export async function loadDocumentPhoto(
  photo: MainPhoto | undefined,
  loadBlob: LoadBlob,
  { render = renderCropDataUrl, printWidthMm = DOCUMENT_PHOTO_MM }: { render?: RenderCrop; printWidthMm?: number } = {},
): Promise<PhotoInput | undefined> {
  if (!photo) return undefined;
  try {
    const blob = await loadBlob(photo.id);
    if (!blob) return undefined;
    const frame: PhotoFrame = photo.frame;
    const src = await render(blob, photo.crop, frame, documentPhotoPixels(printWidthMm));
    return { src, frame };
  } catch {
    return undefined;
  }
}

/**
 * The document photo for React: redrawn when the picture, frame or crop changes (documentPhotoKey). While a new
 * crop is being drawn the previous picture is kept, so the preview doesn't lose its photo frame and re-flow for a
 * moment; removing the photo drops it at once. `ready` is false until the current photo has been drawn (or found
 * missing). The returned object is the same between redraws, so it can go straight into DocumentView.
 */
export function useDocumentPhoto(
  photo: MainPhoto | undefined,
  loadBlob: LoadBlob,
  { render = renderCropDataUrl }: { render?: RenderCrop } = {},
): { photo?: PhotoInput; ready: boolean } {
  const key = documentPhotoKey(photo);
  const [drawn, setDrawn] = useState<{ key: string; photo?: PhotoInput } | null>(null);
  const latest = useRef({ photo, loadBlob, render });
  useEffect(() => {
    latest.current = { photo, loadBlob, render };
  });

  useEffect(() => {
    if (!key) return;
    let live = true;
    const { photo: current, loadBlob: load, render: draw } = latest.current;
    void loadDocumentPhoto(current, load, { render: draw }).then((input) => {
      if (live) setDrawn({ key, photo: input });
    });
    return () => {
      live = false;
    };
  }, [key]);

  if (!key) return { photo: undefined, ready: true };
  return { photo: drawn?.photo, ready: drawn?.key === key };
}
