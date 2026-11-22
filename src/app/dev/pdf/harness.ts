// Dev-only harness for the Download engine (BUILD_PLAN Step 4.1): runs createPdf / createPageImages on a set of laid-out
// pages and returns what e2e/pdf.spec.ts checks (base64 files, timings, and every line whose shaped width differs
// from the browser's). Used by /dev/document (any variant) and /dev/pdf (the display-list feature page).

import { readDisplayList, type DisplayList } from "@/pdf/display-list";
import { faceSuffix } from "@/pdf/weights";

export interface PdfRun {
  pdf: string;
  bytes: number;
  ms: number;
  /** Lines whose HarfBuzz width differs from the browser's by more than 1.5 % (justified lines excluded). */
  mismatches: { text: string; ratio: number; fontFamily: string; fontWeight: number }[];
  /** How many lines used a fallback font (per-glyph fallback). */
  fallbackRuns: number;
  runs: number;
  /** Every line: its text and the fonts its glyphs are drawn with (PostScript-style names, e.g. NotoSansTelugu-Bold). */
  lines: { page: number; text: string; fonts: Record<string, number> }[];
  warnings: string[];
}

export interface ImagesRun {
  images: string[];
  bytes: number[];
  ms: number;
}

export interface PdfHarness {
  displayList(): DisplayList;
  pdf(): Promise<PdfRun>;
  images(format: "jpeg" | "png", width?: number): Promise<ImagesRun>;
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function pdfHarness(root: () => ParentNode): PdfHarness {
  return {
    displayList: () => readDisplayList(root()),
    async pdf() {
      const { createPdf } = await import("@/pdf");
      const mismatches: PdfRun["mismatches"] = [];
      const warnings: string[] = [];
      let runs = 0;
      const lines: PdfRun["lines"] = [];
      let fallbackRuns = 0;
      const t0 = performance.now();
      const blob = await createPdf(root(), {
        title: "Marriage Biodata",
        debug: {
          onRun: (m) => {
            runs++;
            lines.push({ page: m.page, text: m.text, fonts: Object.fromEntries(m.fonts.map((f) => [`${f.family.replace(/\s+/g, "")}-${faceSuffix(f.weight)}`, f.glyphs])) });
            if (m.fallback) fallbackRuns++;
          },
          onMismatch: (m) => mismatches.push({ text: m.text, ratio: Math.round(m.ratio * 10000) / 10000, fontFamily: m.fontFamily, fontWeight: m.fontWeight }),
          onWarning: (w) => warnings.push(w),
        },
      });
      const ms = performance.now() - t0;
      return { pdf: await toBase64(blob), bytes: blob.size, ms, mismatches, fallbackRuns, runs, lines, warnings };
    },
    async images(format, width) {
      const { createPageImages } = await import("@/pdf");
      const t0 = performance.now();
      const blobs = await createPageImages(root(), { format, width });
      const ms = performance.now() - t0;
      return { images: await Promise.all(blobs.map(toBase64)), bytes: blobs.map((b) => b.size), ms };
    },
  };
}
