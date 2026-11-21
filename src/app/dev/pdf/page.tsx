import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PdfFeatures } from "./PdfFeatures";

export const metadata: Metadata = { title: "PDF engine", robots: { index: false, follow: false } };

// The Download engine's feature page (BUILD_PLAN Step 4.1): one A4 page using every display-list feature the PDF
// writer and the page images must reproduce (alignment, justified lines, separate runs on a line, italic, per-glyph
// fallback on a Kannada page, exact baselines, a gradient with a useId-style id, JPEG and PNG pictures with
// object-fit). The real templates are checked on /dev/document. A 404 unless `next dev` or ENABLE_DEV_PAGES=1.
export default function DevPdfPage() {
  if (process.env.NODE_ENV !== "development" && process.env.ENABLE_DEV_PAGES !== "1") notFound();
  return <PdfFeatures />;
}
