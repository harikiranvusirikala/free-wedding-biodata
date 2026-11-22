import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MotifSheet } from "./MotifSheet";

export const metadata: Metadata = { title: "Motifs", robots: { index: false, follow: false } };

// The motif library's review page (BUILD_PLAN Step 2.0, redrawn 2026-11-22; A7): every symbol at the editor tile's
// size (34 px) and the printed size (96 px) in four template palettes, dark paper included, and three A4 pages that
// e2e/motifs.spec.ts runs through the real PDF writer and page images. A 404 unless `next dev` or
// ENABLE_DEV_PAGES=1 (Playwright's web server sets it); on Vercel it is a 404.
export default function DevMotifsPage() {
  if (process.env.NODE_ENV !== "development" && process.env.ENABLE_DEV_PAGES !== "1") notFound();
  return <MotifSheet />;
}
