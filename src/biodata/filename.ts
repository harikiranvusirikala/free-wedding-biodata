import { fullNameOf } from "./draft-name";
import type { BiodataProfile } from "./types";

// Download filenames (VISION §11 "PDF acceptance requirements" and "Image export", BUILD_PLAN Part B rule 5), as
// families name the file they send (owner's choice, 2026-11-22): "<Full name> Biodata.pdf", e.g.
// "Vusirikala Hari Kiran Biodata.pdf"; page images "<Full name> Biodata.jpg" for a one-page biodata, else
// "<Full name> Biodata - page 2.jpg". The name is the Full name in any script (a Telugu name stays Telugu),
// sanitised so it is safe on every system: letters, combining marks, digits, apostrophes and hyphens kept, any
// other run of characters (slashes, dots, quotes, emoji, control characters) becomes one space, at most 60
// characters, cut between letters. No name gives "Marriage Biodata.pdf".

const SUFFIX = "Biodata";
const NO_NAME = "Marriage Biodata";
const MAX_NAME = 60;

/** A name reduced to safe filename characters (NFC), other runs turned into single spaces, trimmed and capped. */
export function sanitizeFileName(text: string): string {
  const cleaned = text
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}\p{N}'’-]+/gu, " ")
    .trim()
    .replace(/^[\p{M}'’-]+/u, "")
    .trim();
  // Cut at a grapheme boundary, never inside a conjunct.
  const graphemes = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(cleaned)].map((s) => s.segment);
  return graphemes.slice(0, MAX_NAME).join("").replace(/[\s'’-]+$/u, "");
}

const stem = (profile: Pick<BiodataProfile, "sections">) => {
  const name = sanitizeFileName(fullNameOf(profile));
  return name ? `${name} ${SUFFIX}` : NO_NAME;
};

/** "<Full name> Biodata.pdf" */
export function pdfFileName(profile: Pick<BiodataProfile, "sections">): string {
  return `${stem(profile)}.pdf`;
}

/**
 * "<Full name> Biodata.jpg" (or .png) when the biodata has one page (`pages` = 1), else
 * "<Full name> Biodata - page <n>.jpg"; `page` counts from 1.
 */
export function pageImageFileName(profile: Pick<BiodataProfile, "sections">, page: number, format: "jpeg" | "png" = "jpeg", pages?: number): string {
  const ext = format === "png" ? "png" : "jpg";
  return pages === 1 ? `${stem(profile)}.${ext}` : `${stem(profile)} - page ${page}.${ext}`;
}
