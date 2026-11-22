import { useEffect, useMemo, useRef, useState } from "react";
import { PHOTO_PAGE_FRAME, printedChart, printedPhotoPages } from "@/biodata/photo-pages";
import type { BiodataProfile, MainPhoto, PhotoFrame } from "@/biodata/types";
import type { PhotoInput, PhotoPagesInput } from "@/document/blocks/types";
import { photoPagePixels } from "@/document/photo-pages";
import { drawPicture, printPixels, renderCropDataUrl } from "./photos";
import { cropKey, fitKey, resolvePicture, type DrawPicture, type PictureRequest, type PictureSnapshot } from "./picture-store";
import { usePictures } from "./use-pictures";

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

// ---------------------------------------------------------------------------------------------------------------
// The pages after the biodata (Step 4.2b, D40, D41): the extra photos, each drawn into its cell's frame at the
// pixels the cell needs at 300 dpi, and the horoscope chart picture, as blob: URLs (picture-urls.ts) so eight photos
// don't fill the page with megabytes of text. The cell size depends on the layout only (never the design), so a new
// design or colour redraws nothing.

/** JPEG quality of a photo drawn for a photo page: 300 dpi is the resolution, this keeps eight of them a sane size. */
export const PAGE_PHOTO_QUALITY = 0.88;

/** What has to be drawn for the pages after the biodata; empty when they are switched off. */
export function photoPageRequests(profile: Pick<BiodataProfile, "photoPages" | "horoscopeChart">): PictureRequest[] {
  const out: PictureRequest[] = [];
  const printed = printedPhotoPages(profile);
  if (printed) {
    const frame = PHOTO_PAGE_FRAME[printed.perPage];
    const outWidth = photoPagePixels(printed.perPage);
    for (const photo of printed.photos) {
      out.push({
        key: cropKey(photo.id, photo.crop, frame, outWidth, PAGE_PHOTO_QUALITY),
        id: photo.id,
        spec: { kind: "crop", crop: photo.crop, frame, outWidth, quality: PAGE_PHOTO_QUALITY },
      });
    }
  }
  const chart = printedChart(profile);
  if (chart) out.push({ key: fitKey(chart.id, chart.crop.rotation), id: chart.id, spec: { kind: "fit", rotation: chart.crop.rotation } });
  return out;
}

/**
 * The document's pages after the biodata for a profile: `title` is the chart page's heading. A photo not drawn yet
 * leaves an empty cell; one that can't be read is left out (the editor's card says it is missing). Undefined when
 * nothing prints after the biodata.
 */
export function photoPagesInput(
  profile: Pick<BiodataProfile, "photoPages" | "horoscopeChart">,
  title: string,
  requests: readonly PictureRequest[],
  snapshot: PictureSnapshot,
): PhotoPagesInput | undefined {
  const printed = printedPhotoPages(profile);
  const chart = printedChart(profile);
  const byId = new Map(requests.map((r) => [r.id, r]));
  const photos: PhotoPagesInput["photos"] = [];
  for (const photo of printed?.photos ?? []) {
    const request = byId.get(photo.id);
    const picture = request ? resolvePicture(snapshot, request) : undefined;
    if (picture !== null) photos.push({ id: photo.id, picture });
  }
  const chartRequest = chart ? byId.get(chart.id) : undefined;
  const chartPicture = chartRequest ? resolvePicture(snapshot, chartRequest) : undefined;
  const input: PhotoPagesInput = { perPage: printed?.perPage ?? 1, photos };
  if (chart && chartPicture !== null) input.chart = { title, picture: chartPicture };
  return photos.length || input.chart ? input : undefined;
}

/**
 * The pages after the biodata for React: redrawn when a photo, crop or layout changes, keeping a photo's previous
 * picture while its new crop is drawn. `ready` is false until every picture has been drawn (or found unreadable).
 */
export function useDocumentPhotos(
  profile: Pick<BiodataProfile, "photoPages" | "horoscopeChart">,
  title: string,
  loadBlob: LoadBlob,
  draw: DrawPicture = drawPicture,
): { input?: PhotoPagesInput; ready: boolean } {
  const { photoPages, horoscopeChart } = profile;
  const requestsKey = useMemo(() => JSON.stringify(photoPageRequests({ photoPages, horoscopeChart })), [photoPages, horoscopeChart]);
  const requests = useMemo(() => JSON.parse(requestsKey) as PictureRequest[], [requestsKey]);
  const pictures = usePictures(requests, loadBlob, draw);
  const { snapshot } = pictures;
  const input = useMemo(
    () => photoPagesInput({ photoPages, horoscopeChart }, title, requests, snapshot),
    [photoPages, horoscopeChart, title, requests, snapshot],
  );
  return { input, ready: pictures.ready };
}
