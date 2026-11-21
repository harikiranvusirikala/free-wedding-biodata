import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PhotoDemo } from "./PhotoDemo";

export const metadata: Metadata = { title: "Photo", robots: { index: false, follow: false } };

// The photo card and cropper on their own (BUILD_PLAN Step 3.1), with in-memory storage and a drawn test picture,
// until the editor wires them to autosave. A 404 unless `next dev` or ENABLE_DEV_PAGES=1 (Playwright's web server
// sets it); on Vercel it is built as a 404.
export default function DevPhotoPage() {
  if (process.env.NODE_ENV !== "development" && process.env.ENABLE_DEV_PAGES !== "1") notFound();
  return <PhotoDemo />;
}
