import { fullNameOf } from "./draft-name";
import type { BiodataProfile } from "./types";

// Download filenames (VISION §11 "PDF acceptance requirements" and "Image export", BUILD_PLAN Part B rule 5):
// Marriage-Biodata-<FirstName>.pdf and Marriage-Biodata-<FirstName>-page-<n>.jpg. The first name is the Full name's
// first word that isn't an initial ("K. Sai Teja Mandapati" → "Sai"), in any script (a Telugu name stays Telugu),
// sanitised so it is safe on every system: letters, combining marks and digits kept, anything else (slashes, dots,
// quotes, emoji, control characters) dropped, at most 40 characters. No name gives Marriage-Biodata.pdf.

const BASE = "Marriage-Biodata";
const MAX_NAME = 40;
const INITIAL = /^(\p{L}\.)+$|^\p{L}$/u;

/** A word reduced to letters, marks and digits (NFC), hyphen-joined where other characters split it. */
export function sanitizeFilePart(text: string): string {
  const cleaned = text
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^\p{M}+/u, "");
  // Cut at a grapheme boundary, never inside a conjunct.
  const graphemes = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(cleaned)].map((s) => s.segment);
  return graphemes.slice(0, MAX_NAME).join("").replace(/-+$/, "");
}

/** The first name a filename uses, sanitised; "" when there is none. */
export function fileFirstName(fullName: string): string {
  const words = fullName.trim().split(/\s+/u).filter(Boolean);
  const named = words.filter((w) => !INITIAL.test(w));
  for (const word of named.length ? named : words) {
    const part = sanitizeFilePart(word);
    if (part) return part;
  }
  return "";
}

const stem = (profile: Pick<BiodataProfile, "sections">) => {
  const name = fileFirstName(fullNameOf(profile));
  return name ? `${BASE}-${name}` : BASE;
};

/** Marriage-Biodata-<FirstName>.pdf */
export function pdfFileName(profile: Pick<BiodataProfile, "sections">): string {
  return `${stem(profile)}.pdf`;
}

/** Marriage-Biodata-<FirstName>-page-<n>.jpg (or .png); `page` counts from 1. */
export function pageImageFileName(profile: Pick<BiodataProfile, "sections">, page: number, format: "jpeg" | "png" = "jpeg"): string {
  return `${stem(profile)}-page-${page}.${format === "png" ? "png" : "jpg"}`;
}
