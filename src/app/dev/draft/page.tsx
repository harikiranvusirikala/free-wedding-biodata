import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DraftDocument } from "./DraftDocument";

export const metadata: Metadata = { title: "Draft document", robots: { index: false, follow: false } };

// A stored draft's document (?d=<id>), read from this browser's IndexedDB and laid out by the document engine, until
// the editor's live preview (Step 3.3). Step 2.0's e2e checks the top of the biodata and the document language on
// it. A 404 unless `next dev` or ENABLE_DEV_PAGES=1 (Playwright's web server sets it); on Vercel it is a 404.
export default function DevDraftPage() {
  if (process.env.NODE_ENV !== "development" && process.env.ENABLE_DEV_PAGES !== "1") notFound();
  return <DraftDocument />;
}
