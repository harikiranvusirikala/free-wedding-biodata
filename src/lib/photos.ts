import { cropPlacement, frameHeight } from "@/biodata/photo-crop";
import type { PhotoCrop, PhotoFrame } from "@/biodata/types";

// Photos in the browser (VISION §10, D12, D40): check a picked file, decode it upright (the camera's EXIF
// orientation applied), shrink it to at most 3000 px on the long edge and store it as a JPEG ≈ 0.9; later draw
// the cropped picture for the document. Re-encoding also drops the file's metadata (camera, GPS location).
// Nothing here leaves the device. The checks are pure and unit-tested; decoding needs a real browser (e2e).

/** The largest file accepted before decoding: phone cameras make 5–15 MB, so 25 MB leaves room. */
export const MAX_INPUT_BYTES = 25 * 1024 * 1024;

/** The stored source's long edge (D40): a full-page photo still prints near 300 dpi and zooming stays sharp. */
export const MAX_LONG_EDGE = 3000;

export const JPEG_QUALITY = 0.9;

/**
 * The file picker's filter. Only JPEG, PNG and WebP (VISION §10): with this list an iPhone's photo picker hands
 * the page a JPEG copy of a HEIC photo. A HEIC file that arrives anyway (dropped on the page) is tried, and gets
 * a clear message if this browser can't decode it.
 */
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";

const TYPES = new Set(["image/jpeg", "image/jpg", "image/pjpeg", "image/png", "image/webp"]);
const HEIC_TYPES = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);
const EXTENSIONS = new Set(["jpg", "jpeg", "jfif", "png", "webp"]);
const HEIC_EXTENSIONS = new Set(["heic", "heif"]);

export type PhotoError = "type" | "size" | "empty" | "heic" | "decode" | "memory";

/** A photo ready to store (the shape of profile-repo's PhotoInput, without its id). */
export interface PreparedPhoto {
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
}

export type PrepareResult = { ok: true; photo: PreparedPhoto } | { ok: false; error: PhotoError };

const extension = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

/** A HEIC/HEIF picture (an iPhone's own format), by its type or, when the browser gives none, its name. */
export function isHeic(file: { name: string; type: string }): boolean {
  const type = file.type.toLowerCase();
  return HEIC_TYPES.has(type) || (!type && HEIC_EXTENSIONS.has(extension(file.name)));
}

/** What's wrong with a picked file before decoding it, or null. Some phones give no type: the name decides. */
export function checkPhotoFile(file: { name: string; type: string; size: number }): PhotoError | null {
  const type = file.type.toLowerCase();
  const known = type ? TYPES.has(type) || HEIC_TYPES.has(type) : EXTENSIONS.has(extension(file.name)) || HEIC_EXTENSIONS.has(extension(file.name));
  if (!known) return "type";
  if (file.size === 0) return "empty";
  if (file.size > MAX_INPUT_BYTES) return "size";
  return null;
}

/** The size that fits `maxLongEdge`, never enlarged, in whole pixels. */
export function fitLongEdge(width: number, height: number, maxLongEdge = MAX_LONG_EDGE): { width: number; height: number } {
  const scale = Math.min(1, maxLongEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

type Drawable = ImageBitmap | HTMLImageElement;

/** Decodes a picture upright. createImageBitmap first; an <img> (which also applies EXIF) where it fails. */
async function decode(file: Blob): Promise<Drawable> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Some browsers decode a format in <img> but not in createImageBitmap: try that before giving up.
    }
  }
  return loadImage(file);
}

/** An <img> for a Blob, decoded; its object URL is released once it has loaded. */
export function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  return image.decode().then(
    () => {
      URL.revokeObjectURL(url);
      return image;
    },
    (error: unknown) => {
      URL.revokeObjectURL(url);
      throw error;
    },
  );
}

const sizeOf = (image: Drawable) => (image instanceof HTMLImageElement ? { width: image.naturalWidth, height: image.naturalHeight } : { width: image.width, height: image.height });

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * A picked file made ready to store: checked, decoded upright, shrunk to MAX_LONG_EDGE and re-encoded as a JPEG
 * on white (a transparent PNG would otherwise turn black). Never throws: a result says what went wrong.
 */
export async function preparePhoto(file: File): Promise<PrepareResult> {
  const problem = checkPhotoFile(file);
  if (problem) return { ok: false, error: problem };

  let image: Drawable;
  try {
    image = await decode(file);
  } catch {
    return { ok: false, error: isHeic(file) ? "heic" : "decode" };
  }
  try {
    const source = sizeOf(image);
    if (!source.width || !source.height) return { ok: false, error: "decode" };
    const size = fitLongEdge(source.width, source.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) return { ok: false, error: "memory" };
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size.width, size.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, size.width, size.height);
    const blob = await toBlob(canvas, "image/jpeg", JPEG_QUALITY);
    canvas.width = canvas.height = 0; // let the browser free the pixels now (iOS keeps canvases alive otherwise)
    if (!blob) return { ok: false, error: "memory" };
    return { ok: true, photo: { blob, mimeType: "image/jpeg", ...size } };
  } catch {
    return { ok: false, error: "memory" };
  } finally {
    if ("close" in image) image.close();
  }
}

/**
 * The cropped picture drawn on a canvas `outWidth` pixels wide (its height from the frame), white behind it.
 * `source` is the stored image, decoded (see `loadImage`). Never wider than the pixels the crop holds, so a
 * small photo isn't blown up for nothing.
 */
export function renderCrop(source: Drawable, crop: PhotoCrop, frame: PhotoFrame, outWidth: number): HTMLCanvasElement {
  const { width, height } = sizeOf(source);
  const placement = cropPlacement(width, height, crop, frame, 1);
  const across = 1 / placement.scale; // source pixels across the frame
  const outW = Math.max(1, Math.round(Math.min(outWidth, across)));
  const outH = Math.max(1, Math.round(frameHeight(frame, outW)));
  const placed = cropPlacement(width, height, crop, frame, outW);
  // Whole pixels may make the canvas a hair taller than the frame: scale to cover both sides, so no white edge.
  const scale = placed.scale * Math.max(1, outH / placed.boxHeight);
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No canvas");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, outW, outH);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.translate(outW / 2, outH / 2);
  context.scale(scale, scale);
  context.rotate((crop.rotation * Math.PI) / 180);
  context.translate(-placed.origin.x, -placed.origin.y);
  context.drawImage(source, 0, 0);
  return canvas;
}

/**
 * The cropped picture as a JPEG data URL for the document (what the PDF writer embeds, Step 3.2's note):
 * `outWidth` is the pixels the frame needs, e.g. its printed width at 300 dpi (`printPixels`).
 */
export async function renderCropDataUrl(blob: Blob, crop: PhotoCrop, frame: PhotoFrame, outWidth: number): Promise<string> {
  const image = await decode(blob);
  try {
    const canvas = renderCrop(image, crop, frame, outWidth);
    const url = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    canvas.width = canvas.height = 0;
    return url;
  } finally {
    if ("close" in image) image.close();
  }
}

/** The pixels a frame printed `printWidthMm` wide needs at `dpi` (300 by default). */
export function printPixels(printWidthMm: number, dpi = 300): number {
  return Math.round((printWidthMm / 25.4) * dpi);
}
