import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Gallery } from "./Gallery";

export const metadata: Metadata = { title: "UI kit", robots: { index: false, follow: false } };

// The component gallery (BUILD_PLAN A7, Step 1.1): every kit recipe and component in every state, so the kit
// shows up in the A7 screenshots before the editor uses it. A 404 unless `next dev` or ENABLE_DEV_PAGES=1
// (Playwright's web server sets it); on Vercel it is built as a 404.
export default function DevUiPage() {
  if (process.env.NODE_ENV !== "development" && process.env.ENABLE_DEV_PAGES !== "1") notFound();
  return <Gallery />;
}
