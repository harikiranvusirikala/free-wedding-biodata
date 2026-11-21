import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Throws } from "./Throws";

export const metadata: Metadata = { title: "Error screen", robots: { index: false, follow: false } };

// Shows the "Something went wrong" screen (src/app/error.tsx) for the A7 screenshots and its e2e test, by
// breaking on purpose once the page is in the browser. A 404 unless `next dev` or ENABLE_DEV_PAGES=1.
export default function DevErrorPage() {
  if (process.env.NODE_ENV !== "development" && process.env.ENABLE_DEV_PAGES !== "1") notFound();
  return <Throws />;
}
