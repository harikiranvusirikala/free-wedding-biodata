import type { PhotoCrop, PhotoFrame } from "./types";

// Where a photo sits in its frame (VISION D12, D40, D47), as pure maths shared by the cropper, the editor's
// thumbnail and the picture drawn for the document. A crop (types.ts) is the frame's centre as fractions of the
// source image's width and height, a zoom (1 = the image just covers the frame) and a quarter turn clockwise.
// Every function keeps the frame covered: no edge of the image ever shows inside it.
//
// "Rotated" coordinates are fractions (0–1) of the image after its quarter turn; the frame lives there.

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 5;

/** A new photo: centred, just covering the frame, upright. */
export const DEFAULT_CROP: Readonly<PhotoCrop> = Object.freeze({ x: 0.5, y: 0.5, zoom: 1, rotation: 0 });

/** Frame width ÷ height. */
export const FRAME_ASPECT: Record<PhotoFrame, number> = { "3:4": 3 / 4, "2:3": 2 / 3 };

/**
 * The main photo's printed width in mm for each frame: Classic Gold's 200 px (3:4) and 186 px (2:3) at 96 px per
 * inch on an A4 page. A template with a bigger frame can pass its own width to `effectiveDpi`.
 */
export const PRINT_WIDTH_MM: Record<PhotoFrame, number> = { "3:4": (200 * 25.4) / 96, "2:3": (186 * 25.4) / 96 };

/** Below this many dots per inch at its printed size a photo may look soft on paper (D47). */
export const LOW_DPI = 200;

export interface Size {
  width: number;
  height: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The frame's height for a width. */
export function frameHeight(frame: PhotoFrame, width: number): number {
  return width / FRAME_ASPECT[frame];
}

/** The image's size after its quarter turn. */
export function rotatedSize(width: number, height: number, rotation: PhotoCrop["rotation"]): Size {
  return rotation === 90 || rotation === 270 ? { width: height, height: width } : { width, height };
}

/** A point of the source image (fractions) in rotated coordinates. */
export function toRotated(x: number, y: number, rotation: PhotoCrop["rotation"]): [number, number] {
  switch (rotation) {
    case 90:
      return [1 - y, x];
    case 180:
      return [1 - x, 1 - y];
    case 270:
      return [y, 1 - x];
    default:
      return [x, y];
  }
}

/** A point in rotated coordinates back in the source image (fractions). */
export function fromRotated(rx: number, ry: number, rotation: PhotoCrop["rotation"]): [number, number] {
  switch (rotation) {
    case 90:
      return [ry, 1 - rx];
    case 180:
      return [1 - rx, 1 - ry];
    case 270:
      return [1 - ry, rx];
    default:
      return [rx, ry];
  }
}

/** How much of the rotated image the frame shows, as fractions of its width and height. */
export function visibleSpan(width: number, height: number, crop: PhotoCrop, frame: PhotoFrame): Size {
  const turned = rotatedSize(width, height, crop.rotation);
  const image = turned.width / turned.height;
  const aspect = FRAME_ASPECT[frame];
  return { width: Math.min(1, aspect / image) / crop.zoom, height: Math.min(1, image / aspect) / crop.zoom };
}

/** The nearest crop that keeps the frame covered: zoom within MIN_ZOOM–MAX_ZOOM, the centre moved inside. */
export function clampCrop(crop: PhotoCrop, width: number, height: number, frame: PhotoFrame): PhotoCrop {
  const zoom = clamp(Number.isFinite(crop.zoom) ? crop.zoom : MIN_ZOOM, MIN_ZOOM, MAX_ZOOM);
  const rotation = crop.rotation;
  const span = visibleSpan(width, height, { ...crop, zoom }, frame);
  const [rx, ry] = toRotated(Number.isFinite(crop.x) ? crop.x : 0.5, Number.isFinite(crop.y) ? crop.y : 0.5, rotation);
  const [x, y] = fromRotated(clamp(rx, span.width / 2, 1 - span.width / 2), clamp(ry, span.height / 2, 1 - span.height / 2), rotation);
  return { x: clamp(x, 0, 1), y: clamp(y, 0, 1), zoom, rotation };
}

/** Moves the image by (dx, dy) screen pixels while the frame is `frameWidth` pixels wide on screen. */
export function panCrop(crop: PhotoCrop, dx: number, dy: number, width: number, height: number, frame: PhotoFrame, frameWidth: number): PhotoCrop {
  if (frameWidth <= 0) return crop;
  const span = visibleSpan(width, height, crop, frame);
  const [rx, ry] = toRotated(crop.x, crop.y, crop.rotation);
  const [x, y] = fromRotated(rx - (dx / frameWidth) * span.width, ry - (dy / frameHeight(frame, frameWidth)) * span.height, crop.rotation);
  return clampCrop({ ...crop, x, y }, width, height, frame);
}

/**
 * Sets the zoom, keeping the image point under `focus` where it is: `focus` is a point of the frame as an offset
 * from its centre in fractions of its size (−0.5 to 0.5; the centre by default), such as the middle of a pinch.
 */
export function zoomCrop(crop: PhotoCrop, zoom: number, width: number, height: number, frame: PhotoFrame, focus = { x: 0, y: 0 }): PhotoCrop {
  const nextZoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
  const before = visibleSpan(width, height, crop, frame);
  const after = visibleSpan(width, height, { ...crop, zoom: nextZoom }, frame);
  const [rx, ry] = toRotated(crop.x, crop.y, crop.rotation);
  const [x, y] = fromRotated(rx + focus.x * (before.width - after.width), ry + focus.y * (before.height - after.height), crop.rotation);
  return clampCrop({ ...crop, x, y, zoom: nextZoom }, width, height, frame);
}

/** A quarter turn clockwise around the same point of the photo, then kept covering the frame. */
export function rotateCrop(crop: PhotoCrop, width: number, height: number, frame: PhotoFrame): PhotoCrop {
  const rotation = ((crop.rotation + 90) % 360) as PhotoCrop["rotation"];
  return clampCrop({ ...crop, rotation }, width, height, frame);
}

/** The source pixels across the frame's width (after the quarter turn): what the printed photo is made from. */
export function pixelsAcross(width: number, height: number, crop: PhotoCrop, frame: PhotoFrame): number {
  return visibleSpan(width, height, crop, frame).width * rotatedSize(width, height, crop.rotation).width;
}

/** Dots per inch the photo gets when its frame prints `printWidthMm` wide (D47). */
export function effectiveDpi(width: number, height: number, crop: PhotoCrop, frame: PhotoFrame, printWidthMm = PRINT_WIDTH_MM[frame]): number {
  return pixelsAcross(width, height, crop, frame) / (printWidthMm / 25.4);
}

/** True when the photo would print below LOW_DPI. */
export function isLowResolution(width: number, height: number, crop: PhotoCrop, frame: PhotoFrame, printWidthMm = PRINT_WIDTH_MM[frame]): boolean {
  return effectiveDpi(width, height, crop, frame, printWidthMm) < LOW_DPI;
}

/**
 * How to draw the source image so the crop fills a frame `boxWidth` wide with its top-left corner at the origin:
 * move the frame's centre there, scale, turn, then bring the crop's centre to it. `transform` is the CSS for an
 * element at the image's natural size with `transform-origin: 0 0`; a canvas applies the same four steps.
 */
export function cropPlacement(width: number, height: number, crop: PhotoCrop, frame: PhotoFrame, boxWidth: number) {
  const scale = boxWidth / pixelsAcross(width, height, crop, frame);
  const boxHeight = frameHeight(frame, boxWidth);
  const centre = { x: boxWidth / 2, y: boxHeight / 2 };
  const origin = { x: crop.x * width, y: crop.y * height };
  return {
    scale,
    boxHeight,
    centre,
    origin,
    transform: `translate(${centre.x}px, ${centre.y}px) scale(${scale}) rotate(${crop.rotation}deg) translate(${-origin.x}px, ${-origin.y}px)`,
  };
}

/** Two crops that draw the same picture (within a hair), so an unchanged Done doesn't save. */
export function sameCrop(a: PhotoCrop, b: PhotoCrop): boolean {
  const near = (p: number, q: number) => Math.abs(p - q) < 1e-6;
  return a.rotation === b.rotation && near(a.x, b.x) && near(a.y, b.y) && near(a.zoom, b.zoom);
}
