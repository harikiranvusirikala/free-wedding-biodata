import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SpikePages } from "@/pdf-spike/reference/SpikePages";

export const metadata: Metadata = { title: "PDF spike", robots: { index: false, follow: false } };

// The PDF spike's reference page (BUILD_PLAN Step 0.2). A 404 unless `next dev` or ENABLE_DEV_PAGES=1
// (Playwright's web server sets it); on Vercel it is built as a 404.
export default function PdfSpikePage() {
  if (process.env.NODE_ENV !== "development" && process.env.ENABLE_DEV_PAGES !== "1") notFound();
  return <SpikePages />;
}
