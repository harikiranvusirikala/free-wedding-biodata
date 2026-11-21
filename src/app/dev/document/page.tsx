import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentGallery } from "./DocumentGallery";

export const metadata: Metadata = { title: "Document engine", robots: { index: false, follow: false } };

// The document engine's dev page (BUILD_PLAN Step 3.2): Classic Gold and Minimal Ivory, English and Telugu, short,
// sample and long content, plus a short Classic Gold page in each other document language (Step 4.2), at true
// size. A 404 unless `next dev` or ENABLE_DEV_PAGES=1 (Playwright's web server sets it); on Vercel it is a 404.
export default function DevDocumentPage() {
  if (process.env.NODE_ENV !== "development" && process.env.ENABLE_DEV_PAGES !== "1") notFound();
  return <DocumentGallery />;
}
