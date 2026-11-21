// Candidate D and the page-image check (BUILD_PLAN Step 0.2, VISION D38): draw a display-list page onto a canvas
// (the browser shapes the text with the same fonts), then either save it as an image or put JPEG pages in a PDF.
import { PDFDocument } from "pdf-lib";
import type { DisplayList, DisplayPage } from "../display-list";

const A4_PT = { width: 595.28, height: 841.89 };

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
      roundedRect(ctx, item.x, item.y, item.width, item.height, item.radius ?? 0);
      if (item.fill) {
        ctx.fillStyle = item.fill;
        ctx.fill();
      }
      if (item.stroke) {
        ctx.strokeStyle = item.stroke;
        ctx.lineWidth = item.strokeWidth ?? 1;
        ctx.stroke();
      }
    } else if (item.kind === "image") {
      const img = await loadImage(item.src);
      ctx.save();
      roundedRect(ctx, item.x, item.y, item.width, item.height, item.radius ?? 0);
      ctx.clip();
      ctx.drawImage(img, item.x, item.y, item.width, item.height);
      ctx.restore();
    } else if (item.kind === "svg") {
      // Rendered by the browser at the target resolution, so curves stay sharp.
      const sized = item.markup.replace(/<svg([^>]*?)\swidth="[^"]*"/, "<svg$1").replace(/<svg([^>]*?)\sheight="[^"]*"/, "<svg$1").replace("<svg", `<svg width="${item.width * scale}" height="${item.height * scale}"`);
      const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`);
      ctx.drawImage(img, item.x, item.y, item.width, item.height);
    } else {
      ctx.font = `${item.fontWeight} ${item.fontSize}px "${item.fontFamily}"`;
      ctx.letterSpacing = `${item.letterSpacing}px`;
      ctx.fillStyle = item.color;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(item.text, item.x, item.y);
    }
  }
  return canvas;
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), type, quality));

/** Candidate D: every page as a 300 dpi JPEG in an A4 PDF. */
export async function rasterPdf(list: DisplayList, dpi = 300, quality = 0.9): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const widthPx = Math.round((210 / 25.4) * dpi);
  for (const page of list.pages) {
    const canvas = await drawPage(page, widthPx);
    const jpeg = await doc.embedJpg(new Uint8Array(await (await toBlob(canvas, "image/jpeg", quality)).arrayBuffer()));
    const pdfPage = doc.addPage([A4_PT.width, A4_PT.height]);
    pdfPage.drawImage(jpeg, { x: 0, y: 0, width: A4_PT.width, height: A4_PT.height });
  }
  return doc.save();
}

/** The image export check (D38): one page as JPEG and PNG at `widthPx` (1240 × 1754 is A4 at 150 dpi). */
export async function pageImages(page: DisplayPage, widthPx = 1240): Promise<{ jpeg: Blob; png: Blob }> {
  const canvas = await drawPage(page, widthPx);
  return { jpeg: await toBlob(canvas, "image/jpeg", 0.92), png: await toBlob(canvas, "image/png") };
}
