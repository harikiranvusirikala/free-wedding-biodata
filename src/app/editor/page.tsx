import type { Metadata } from "next";
import { t } from "@/lib/i18n";
import { Editor } from "./Editor";

export const metadata: Metadata = {
  title: t("editor.metaTitle"),
  robots: { index: false, follow: false },
};

// /editor?d=<id>: the draft lives in this browser's IndexedDB, so the page is a static shell that opens it in the
// browser (Editor.tsx). Outside the (public) group, so no analytics ever loads here (VISION D22).
export default function EditorPage() {
  return <Editor />;
}
