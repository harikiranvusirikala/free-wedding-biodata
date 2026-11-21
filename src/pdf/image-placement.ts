// object-fit for the display list's pictures, shared by the PDF writer and the page images.
import type { ImageItem } from "./display-list";

/** Where a picture is drawn for its object-fit (centred): the box itself, or a larger (cover) / smaller (contain) one. */
export function imagePlacement(img: Pick<ImageItem, "x" | "y" | "width" | "height" | "fit" | "naturalWidth" | "naturalHeight">) {
  const { x, y, width, height } = img;
  if (img.fit === "fill" || !img.naturalWidth || !img.naturalHeight) return { x, y, width, height };
  const k = (img.fit === "cover" ? Math.max : Math.min)(width / img.naturalWidth, height / img.naturalHeight);
  const w = img.naturalWidth * k;
  const h = img.naturalHeight * k;
  return { x: x + (width - w) / 2, y: y + (height - h) / 2, width: w, height: h };
}
