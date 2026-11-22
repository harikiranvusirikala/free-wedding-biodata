// The Download engine (BUILD_PLAN Step 4.1, VISION D49, D38): turns the laid-out A4 pages ([data-page] elements,
// the same pages as the preview and print, D1) into a vector PDF or one image per page. Only this small module
// and the display-list reader load with it; HarfBuzz, pdf-lib and the canvas code are imported on the first call,
// so the editor can import it (or better, `await import("@/pdf")`) without paying for them up front.
//
//   const blob = await createPdf(pagesRoot, { title: "Marriage Biodata" });
//   const images = await createPageImages(pagesRoot, { format: "jpeg" });
//
// Filenames: pdfFileName / pageImageFileName in src/biodata/filename.ts (pure, no PDF code).

import { readDisplayList, type DisplayList, type ImageItem } from "./display-list";
import type { RunMeasure } from "./write-pdf";

export type { DisplayList, DisplayPage, DisplayItem, TextItem, RectItem, ImageItem, SvgItem } from "./display-list";
export { readDisplayList } from "./display-list";

export interface CreatePdfOptions {
  /** The PDF's title (document properties). */
  title?: string;
  /** Progress, after each page: (pages written, total). */
  onProgress?: (done: number, total: number) => void;
  /** Development checks: every line's shaped width against the browser's, and anything the writer skipped. */
  debug?: { onRun?: (m: RunMeasure) => void; onMismatch?: (m: RunMeasure) => void; onWarning?: (message: string) => void };
}

export interface PageImageOptions {
  format: "jpeg" | "png";
  /** Image width in px (default 2480: A4 at 300 dpi, 2480 × 3508, print quality; VISION D38). */
  width?: number;
  /** JPEG quality (default 0.92). */
  quality?: number;
  onProgress?: (done: number, total: number) => void;
}

/** Lets the page paint between pages, so a progress indicator keeps moving on a slow phone. */
const yieldToMain = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const DATA_URL = /^data:image\/(jpe?g|png);base64,/i;

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** Any picture the PDF can't take as it is (a blob: URL, WebP, …) becomes a JPEG or PNG data URL. */
async function asEmbeddable(src: string): Promise<string> {
  if (DATA_URL.test(src)) return src;
  const blob = await (await fetch(src)).blob();
  if (blob.type === "image/jpeg" || blob.type === "image/png") return blobToDataUrl(blob);
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  // PNG keeps any transparency; photos from the cropper are already JPEG data URLs and never get here.
  return canvas.toDataURL("image/png");
}

async function embeddableImages(list: DisplayList): Promise<DisplayList> {
  const converted = new Map<string, Promise<string>>();
  const pages = await Promise.all(
    list.pages.map(async (page) => ({
      ...page,
      items: await Promise.all(
        page.items.map(async (item) => {
          if (item.kind !== "image") return item;
          let p = converted.get(item.src);
          if (!p) {
            p = asEmbeddable(item.src);
            converted.set(item.src, p);
          }
          return { ...item, src: await p } satisfies ImageItem;
        }),
      ),
    })),
  );
  return { pages };
}

/** The pages under `pagesRoot` as a vector A4 PDF (HarfBuzz shaping, subset Noto fonts, copyable text). */
export async function createPdf(pagesRoot: ParentNode, options: CreatePdfOptions = {}): Promise<Blob> {
  const list = readDisplayList(pagesRoot);
  if (!list.pages.length) throw new Error("No pages to write");
  const [{ writePdf }, fonts, images] = await Promise.all([import("./write-pdf"), import("./fonts"), embeddableImages(list)]);
  const bytes = await writePdf(images, fonts.loadFont, {
    subsetWasm: fonts.loadSubsetWasm,
    title: options.title,
    onRun: options.debug?.onRun,
    onMismatch: options.debug?.onMismatch,
    onWarning: options.debug?.onWarning,
    onPage: async (done, total) => {
      options.onProgress?.(done, total);
      if (done < total) await yieldToMain();
    },
  });
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

/** The pages under `pagesRoot` as one JPEG or PNG each, drawn from the same display list as the PDF. */
export async function createPageImages(pagesRoot: ParentNode, options: PageImageOptions): Promise<Blob[]> {
  const list = readDisplayList(pagesRoot);
  if (!list.pages.length) throw new Error("No pages to draw");
  const { drawPage, canvasToBlob } = await import("./draw-page");
  const type = options.format === "png" ? "image/png" : "image/jpeg";
  const out: Blob[] = [];
  for (const page of list.pages) {
    const canvas = await drawPage(page, options.width ?? 2480);
    out.push(await canvasToBlob(canvas, type, options.format === "png" ? undefined : (options.quality ?? 0.92)));
    canvas.width = canvas.height = 0; // free the bitmap now (phones keep few canvases)
    options.onProgress?.(out.length, list.pages.length);
    if (out.length < list.pages.length) await yieldToMain();
  }
  return out;
}
