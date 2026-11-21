import type { LangCode } from "@/biodata/types";

// The document's design tokens (BUILD_PLAN A2/A4, VISION §7): page size, margins, the text-size steps, spacing,
// fonts and every template's colour variants. Components read sizes from here; spacing inside a page is in em
// of the body size, so a whole page scales with the text-size step while the page, frame and photo stay put.
// Coordinates are CSS px on an A4 page at 96 px per inch, the same space as the display list (src/pdf).

/** A4 portrait at 96 px per inch (210 × 297 mm). */
export const PAGE = { width: 794, height: 1123 } as const;

/** px per pt (96 / 72). */
export const PX_PER_PT = 4 / 3;

export const TEXT_STEPS = ["xs", "s", "m", "l", "xl"] as const;
export type TextStep = (typeof TEXT_STEPS)[number];

/**
 * Body text size per step in px. XS is the floor: 12 px = 9 pt, the smallest body size a biodata may use (D31).
 * Labels, values and paragraphs use the body size; headings and titles are multiples of it.
 */
export const BODY_PX: Record<TextStep, number> = { xs: 12, s: 12.75, m: 13.5, l: 14.25, xl: 15 };
export const MIN_BODY_PX = 9 * PX_PER_PT;

/** Auto text size tries these, largest first (D31). */
export const AUTO_STEPS: readonly TextStep[] = ["xl", "l", "m", "s", "xs"];

/** Unitless line height of body text. */
export const LINE_HEIGHT = 1.45;

/** Space in em of the body size. */
export const SPACE = {
  /** Between sections (above each heading). */
  section: 1.05,
  /** Below a heading, before its first row. */
  afterHeading: 0.5,
  /** Between rows. */
  row: 0.28,
  /** Indent of rows and paragraphs under a heading bar. */
  indent: 1,
  /** Between the label column and the value. */
  labelGap: 0.9,
} as const;

/** Page margins in px: where the content box sits inside the page. */
export interface Box {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** The fonts in public/fonts (OFL, `npm run fonts`): the same TTFs the PDF writer embeds (D10, D49). */
export const FONT_FAMILY: Record<LangCode, string> = {
  en: "Noto Sans",
  te: "Noto Sans Telugu",
  hi: "Noto Sans Devanagari",
  mr: "Noto Sans Devanagari",
  ta: "Noto Sans Tamil",
  kn: "Noto Sans Kannada",
  ml: "Noto Sans Malayalam",
  gu: "Noto Sans Gujarati",
  bn: "Noto Sans Bengali",
  pa: "Noto Sans Gurmukhi",
};

/**
 * What each script font draws (its CSS `unicode-range`, the same strings as in document.css; a test keeps them
 * equal): its own script block, the dandas, the joiners, the dotted circle and the space. Everything else on an
 * Indic page (Latin letters, digits, punctuation, ₹) falls through to Noto Sans at the same weight: the script
 * fonts carry Latin glyphs too, but Noto Sans Kannada Bold's are Regular weight (Step 4.2 found English labels
 * printed lighter than bold). The space stays in the script font, so it remains the "first available font" whose
 * metrics set line boxes and baselines. The PDF writer falls back per glyph with the same ranges (src/pdf, D49).
 */
const INDIC_COMMON = "U+0020, U+00A0, U+0964-0965, U+200B-200D, U+25CC";
export const FONT_UNICODE_RANGE: Readonly<Record<string, string>> = {
  "Noto Sans Telugu": `U+0C00-0C7F, ${INDIC_COMMON}`,
  "Noto Sans Devanagari": `U+0900-097F, U+1CD0-1CFF, U+A8E0-A8FF, ${INDIC_COMMON}`,
  "Noto Sans Tamil": `U+0B80-0BFF, ${INDIC_COMMON}`,
  "Noto Sans Kannada": `U+0C80-0CFF, ${INDIC_COMMON}`,
  "Noto Sans Malayalam": `U+0D00-0D7F, ${INDIC_COMMON}`,
  "Noto Sans Gujarati": `U+0A80-0AFF, ${INDIC_COMMON}`,
  "Noto Sans Bengali": `U+0980-09FF, ${INDIC_COMMON}`,
  "Noto Sans Gurmukhi": `U+0A00-0A7F, ${INDIC_COMMON}`,
};

/** The CSS font stack for a document language: its script font first (limited to its script), then Noto Sans. */
export function fontStack(lang: LangCode): string {
  const family = FONT_FAMILY[lang];
  return family === "Noto Sans" ? `"Noto Sans", sans-serif` : `"${family}", "Noto Sans", sans-serif`;
}

/**
 * Uppercase and letter spacing are Latin-only styles: Indic scripts have no case, and letter spacing breaks
 * their joined clusters.
 */
export const isLatin = (lang: LangCode) => lang === "en";

/** One colour variant of a template (D39, D46): three per template. */
export interface Palette {
  id: string;
  /** Shown in the colour picker (Step 3.3). */
  name: string;
  /** The swatch in the picker. */
  swatch: string;
  paper: string;
  text: string;
  /** Labels, title, quote rules. */
  label: string;
  /** Heading bar fill and text (Classic). */
  bar: string;
  barText: string;
  /** Hairlines and frames of simple templates. */
  rule: string;
  /** Motif ink and its pale base (D45: motifs take the template's colours). */
  ink: string;
  inkBase: string;
  /** Frame artwork gradient (dark, light, mid), for illustrated frames. */
  frame: readonly [string, string, string];
}

export const CLASSIC_GOLD_COLORS: readonly Palette[] = [
  {
    id: "gold",
    name: "Gold",
    swatch: "#fcc96a",
    paper: "#fffdf8",
    text: "#1f1a14",
    label: "#8f5410",
    bar: "#fcc96a",
    barText: "#2b1a06",
    rule: "#c8962e",
    ink: "#9a5b13",
    inkBase: "#fbe9c6",
    frame: ["#b07a14", "#f2cd6b", "#c08a22"],
  },
  {
    id: "rose",
    name: "Rose",
    swatch: "#f2b8a0",
    paper: "#fffaf7",
    text: "#24160f",
    label: "#9a3d26",
    bar: "#f5c2ad",
    barText: "#3a1209",
    rule: "#c47a5e",
    ink: "#a8452f",
    inkBase: "#fbe2d8",
    frame: ["#a8553a", "#f0b49c", "#b86a4c"],
  },
  {
    id: "sage",
    name: "Sage",
    swatch: "#cfe3c3",
    paper: "#fcfdf8",
    text: "#18200f",
    label: "#4b6a26",
    bar: "#cfe3c3",
    barText: "#1b2a12",
    rule: "#7f9f5a",
    ink: "#557631",
    inkBase: "#e4efda",
    frame: ["#5e7f35", "#c9dc8f", "#6f8f42"],
  },
];

export const MINIMAL_IVORY_COLORS: readonly Palette[] = [
  {
    id: "ink",
    name: "Ink",
    swatch: "#1d1d1b",
    paper: "#fffdf7",
    text: "#1d1d1b",
    label: "#5f5b52",
    bar: "transparent",
    barText: "#1d1d1b",
    rule: "#d9d3c4",
    ink: "#3a3833",
    inkBase: "#efebe0",
    frame: ["#1d1d1b", "#6d6a62", "#3a3833"],
  },
  {
    id: "maroon",
    name: "Maroon",
    swatch: "#7a1420",
    paper: "#fffdf7",
    text: "#1f1a1a",
    label: "#7a1420",
    bar: "transparent",
    barText: "#7a1420",
    rule: "#e2d2c8",
    ink: "#7a1420",
    inkBase: "#f6e3e3",
    frame: ["#7a1420", "#c46a72", "#94303b"],
  },
  {
    id: "navy",
    name: "Navy",
    swatch: "#1f3c73",
    paper: "#fdfdfb",
    text: "#161b26",
    label: "#1f3c73",
    bar: "transparent",
    barText: "#1f3c73",
    rule: "#d3d9e4",
    ink: "#1f3c73",
    inkBase: "#e3eaf7",
    frame: ["#1f3c73", "#7d95c4", "#2f5aa8"],
  },
];
