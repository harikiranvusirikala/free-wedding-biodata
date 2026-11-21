// Page images (VISION D38): a display-list page drawn onto a canvas. The browser shapes the text with the same
// fonts and the same @font-face unicode-ranges as the page itself (so per-glyph fallback matches), lines are
// anchored the way the display list says (left, centre, right, justified), and SVG ornaments are drawn by the
// browser at the target resolution. Browser only.

import type { DisplayPage, TextItem } from "./display-list";
import { imagePlacement } from "./image-placement";

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (r > 0) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

const cssFamily = (f: string) => (/^[\w-]+$/.test(f) && !/^\d/.test(f) ? f : `"${f.replace(/"/g, '\\"')}"`);

/** The canvas font shorthand for a text item: its whole stack, so fallback per glyph works as on the page. */
export function canvasFont(t: Pick<TextItem, "fontStyle" | "fontWeight" | "fontSize" | "fontFamilies">): string {
  const stack = [...t.fontFamilies.map(cssFamily), "sans-serif"].join(", ");
  return `${t.fontStyle === "italic" ? "italic " : ""}${t.fontWeight} ${t.fontSize}px ${stack}`;
}

function drawText(ctx: CanvasRenderingContext2D, t: TextItem) {
  ctx.font = canvasFont(t);
  ctx.letterSpacing = `${t.letterSpacing}px`;
  ctx.fillStyle = t.color;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  if (t.justified) {
    // Word by word, the browser's extra width spread over the spaces.
    const words = t.text.split(" ");
    const widths = words.map((w) => ctx.measureText(w).width);
    const space = ctx.measureText(" ").width;
    const natural = widths.reduce((a, b) => a + b, 0) + space * (words.length - 1);
    const extra = words.length > 1 ? (t.width - natural) / (words.length - 1) : 0;
    let x = t.x;
    words.forEach((w, i) => {
      ctx.fillText(w, x, t.y);
      x += widths[i] + space + extra;
    });
    return;
  }
  const gap = t.align === "center" || t.align === "right" ? t.width - ctx.measureText(t.text).width : 0;
  ctx.fillText(t.text, t.x + (t.align === "center" ? gap / 2 : gap), t.y);
}

/** Draws one page at `widthPx` pixels wide (A4 proportions). */
export async function drawPage(page: DisplayPage, widthPx: number): Promise<HTMLCanvasElement> {
  const scale = widthPx / page.width;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(page.width * scale);
  canvas.height = Math.round(page.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = page.background;
  ctx.fillRect(0, 0, page.width, page.height);

  for (const item of page.items) {
    if (item.kind === "rect") {
      if (item.fill) {
        roundedRect(ctx, item.x, item.y, item.width, item.height, item.radius ?? 0);
        ctx.fillStyle = item.fill;
        ctx.fill();
      }
      if (item.stroke && item.strokeWidth) {
        // CSS borders sit inside the border box.
        const sw = item.strokeWidth;
        roundedRect(ctx, item.x + sw / 2, item.y + sw / 2, item.width - sw, item.height - sw, Math.max(0, (item.radius ?? 0) - sw / 2));
        ctx.strokeStyle = item.stroke;
        ctx.lineWidth = sw;
        ctx.stroke();
      }
    } else if (item.kind === "image") {
      const img = await loadImage(item.src);
      const at = imagePlacement(item);
      ctx.save();
      roundedRect(ctx, item.x, item.y, item.width, item.height, item.radius ?? 0);
      ctx.clip();
      ctx.drawImage(img, at.x, at.y, at.width, at.height);
      ctx.restore();
    } else if (item.kind === "svg") {
      // Rendered by the browser at the target resolution, so curves stay sharp.
      const sized = item.markup
        .replace(/<svg([^>]*?)\swidth="[^"]*"/, "<svg$1")
        .replace(/<svg([^>]*?)\sheight="[^"]*"/, "<svg$1")
        .replace("<svg", `<svg width="${item.width * scale}" height="${item.height * scale}"`);
      const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`);
      ctx.drawImage(img, item.x, item.y, item.width, item.height);
    } else drawText(ctx, item);
  }
  return canvas;
}

export const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the page image"))), type, quality));
