import { useId } from "react";
import {
  Allah,
  AllahMedallion,
  Cross,
  CrossBudded,
  CrescentStar,
  DharmaWheel,
  DharmaWheelSolid,
  Floral,
  IkOnkar,
  Jain,
  Kalash,
  Khanda,
  Lotus,
  Om,
  Paisley,
  Rings,
  Swastika,
  type MotifDrawing,
} from "./library";
import { ART } from "./art";

// The motif library for the top of a biodata (VISION §7 D21, D45, D47): our own drawings (./library.tsx), each in
// the template's colours: `ink` fills the main shapes as a vertical gradient to a lighter tint and details are cut
// out in the paper colour. Nothing is ever shown unless the user picks a motif ("None" first, never inferred).

/** Mixes a #rrggbb colour with white: t = 0 the colour, 1 white. */
export function tint(hex: string, t: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const mix = (v: number) => Math.round(v + (255 - v) * t);
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => mix(v).toString(16).padStart(2, "0")).join("")}`;
}

export const MOTIF_TRADITIONS = ["hindu", "muslim", "christian", "sikh", "jain", "buddhist", "secular"] as const;
export type MotifTradition = (typeof MOTIF_TRADITIONS)[number];

/**
 * The library in picker order (grouped by tradition, D21's table). Ids are stored in drafts (`options.motif`), so
 * an id is never renamed; a drawing may be redrawn. Symbols that await a community's review before launch (D47 (3))
 * carry `review`, so the review list stays in one place: the Khanda and the Jain symbol, the hand-drawn Om, and the
 * two Allah designs (the name of God as printed decoration).
 */
const LIBRARY: Record<string, MotifDrawing & { tradition: MotifTradition; review?: true }> = {
  om: { draw: Om, y1: 24, y2: 98, tradition: "hindu", review: true },
  kalash: { draw: Kalash, y1: 10, y2: 110, tradition: "hindu" },
  swastika: { draw: Swastika, y1: 23, y2: 97, tradition: "hindu" },
  lotus: { draw: Lotus, y1: 16, y2: 104, tradition: "hindu" },
  crescentStar: { draw: CrescentStar, y1: 22, y2: 102, tradition: "muslim" },
  allah: { draw: Allah, y1: 4, y2: 116, tradition: "muslim", review: true },
  allahMedallion: { draw: AllahMedallion, y1: 4, y2: 116, tradition: "muslim", review: true },
  cross: { draw: Cross, y1: 10, y2: 110, tradition: "christian" },
  crossBudded: { draw: CrossBudded, y1: 10, y2: 110, tradition: "christian" },
  ikOnkar: { draw: IkOnkar, y1: 28, y2: 92, tradition: "sikh" },
  khanda: { draw: Khanda, y1: 8, y2: 112, tradition: "sikh", review: true },
  jain: { draw: Jain, y1: 8, y2: 112, tradition: "jain", review: true },
  dharmaWheel: { draw: DharmaWheel, y1: 6, y2: 114, tradition: "buddhist" },
  dharmaWheelSolid: { draw: DharmaWheelSolid, y1: 6, y2: 114, tradition: "buddhist" },
  floral: { draw: Floral, y1: 6, y2: 114, tradition: "secular" },
  paisley: { draw: Paisley, y1: 14, y2: 108, tradition: "secular" },
  rings: { draw: Rings, y1: 22, y2: 98, tradition: "secular" },
};

/**
 * The owner's artwork (./art): pictures and line drawings, shown as images. Same contract as LIBRARY: ids are stored
 * in drafts and never renamed. Colour pictures keep their own colours (the document colour doesn't change them).
 */
const PICTURES: Record<string, { src: string; tradition: MotifTradition; review?: true }> = {
  ganeshaStencil: { src: ART.ganeshaStencil, tradition: "hindu" },
  ganeshaLine: { src: ART.ganeshaLine, tradition: "hindu" },
  ganeshaOutline: { src: ART.ganeshaOutline, tradition: "hindu" },
  ganeshaSeated: { src: ART.ganeshaSeated, tradition: "hindu" },
  ganeshaTrident: { src: ART.ganeshaTrident, tradition: "hindu" },
  ganeshaLotusFrame: { src: ART.ganeshaLotusFrame, tradition: "hindu" },
  ganeshaOrangeFrame: { src: ART.ganeshaOrangeFrame, tradition: "hindu" },
  ganeshaNamah: { src: ART.ganeshaNamah, tradition: "hindu" },
  omMandala: { src: ART.omMandala, tradition: "hindu" },
  omSeal: { src: ART.omSeal, tradition: "hindu" },
  venkateswara: { src: ART.venkateswara, tradition: "hindu", review: true },
  ramaWithBow: { src: ART.ramaWithBow, tradition: "hindu", review: true },
  allahWreath: { src: ART.allahWreath, tradition: "muslim", review: true },
  jainHand: { src: ART.jainHand, tradition: "jain", review: true },
  omGold: { src: ART.omGold, tradition: "hindu" },
  ganeshaSeatedRight: { src: ART.ganeshaSeatedRight, tradition: "hindu" },
  ganeshaSeatedLeft: { src: ART.ganeshaSeatedLeft, tradition: "hindu" },
  ganeshaMandala: { src: ART.ganeshaMandala, tradition: "hindu" },
  ganeshaLotus: { src: ART.ganeshaLotus, tradition: "hindu" },
  ganeshaThrone: { src: ART.ganeshaThrone, tradition: "hindu" },
  ganeshaTrunk: { src: ART.ganeshaTrunk, tradition: "hindu" },
  // The first symbol: the owner's classic Ganesha. The id was the drawn Ganesha before, so drafts keep their choice.
  ganesha: { src: ART.ganeshaSheet, tradition: "hindu" },
  ikOnkarDisc: { src: ART.ikOnkarDisc, tradition: "sikh" },
  khandaSheet: { src: ART.khandaSheet, tradition: "sikh", review: true },
  crossLatinSheet: { src: ART.crossLatinSheet, tradition: "christian" },
  crossBuddedSheet: { src: ART.crossBuddedSheet, tradition: "christian" },
  allahMedallionSheet: { src: ART.allahMedallionSheet, tradition: "muslim", review: true },
  dharmaLight: { src: ART.dharmaLight, tradition: "buddhist" },
  dharmaSolid: { src: ART.dharmaSolid, tradition: "buddhist" },
  jainMotto: { src: ART.jainMotto, tradition: "jain", review: true },
};

/** The symbols drawn as vectors (LIBRARY) and the pictures (PICTURES, ./art), in picker order: drawn first. */
export const DRAWN_IDS = Object.keys(LIBRARY);
export const PICTURE_IDS = Object.keys(PICTURES);
/** Ids a draft saved earlier today may hold (a symbol since removed): they show the symbol that replaced them. */
const LEGACY_IDS: Record<string, string> = { ganeshaOrnate: "ganesha" };

export const isMotif = (id: string | null | undefined): id is string =>
  !!id && (Object.hasOwn(LIBRARY, id) || Object.hasOwn(PICTURES, id) || Object.hasOwn(LEGACY_IDS, id));

/** A motif's tradition (the picker's groups). */
export const motifTradition = (id: string): MotifTradition | undefined => {
  const key = LEGACY_IDS[id] ?? id;
  return Object.hasOwn(LIBRARY, key) ? LIBRARY[key].tradition : Object.hasOwn(PICTURES, key) ? PICTURES[key].tradition : undefined;
};

/**
 * The Hindu symbols, organised in sets (the picker and its dialog keep this order; ids are never renamed): the
 * classic Ganesha first, then Ganesha as gold and line art, Ganesha as coloured pictures, Om and blessings, the
 * gods, and the auspicious symbols. Any Hindu symbol not listed follows the last set, so a new one always shows.
 */
export const HINDU_SECTIONS: readonly { key: string; ids: readonly string[] }[] = [
  { key: "ganesha", ids: ["ganesha", "ganeshaLine", "ganeshaOutline", "ganeshaStencil", "ganeshaSeatedRight", "ganeshaSeatedLeft", "ganeshaMandala", "ganeshaLotus", "ganeshaThrone", "ganeshaTrunk"] },
  { key: "ganeshaColour", ids: ["ganeshaSeated", "ganeshaTrident", "ganeshaLotusFrame", "ganeshaOrangeFrame"] },
  { key: "om", ids: ["om", "omGold", "omMandala", "omSeal", "ganeshaNamah"] },
  { key: "gods", ids: ["venkateswara", "ramaWithBow"] },
  { key: "auspicious", ids: ["kalash", "swastika", "lotus"] },
];

const ALL_IDS = [...DRAWN_IDS, ...PICTURE_IDS];
const hinduListed = new Set(HINDU_SECTIONS.flatMap((section) => section.ids));
const HINDU_ORDER = [...HINDU_SECTIONS.flatMap((section) => section.ids), ...ALL_IDS.filter((id) => motifTradition(id) === "hindu" && !hinduListed.has(id))];

/** Every symbol in picker order: grouped by tradition; the Hindu ones in their sets (HINDU_SECTIONS). */
export const MOTIF_IDS = MOTIF_TRADITIONS.flatMap((tradition) =>
  tradition === "hindu" ? HINDU_ORDER.filter((id) => ALL_IDS.includes(id)) : ALL_IDS.filter((id) => motifTradition(id) === tradition),
);

/** A tradition's symbols in sets, for the dialog's sub-headings: Hindu has several, the others one without a key. */
export function motifSections(tradition: MotifTradition): { key: string | null; ids: string[] }[] {
  const ids = MOTIF_IDS.filter((id) => motifTradition(id) === tradition);
  if (tradition !== "hindu") return ids.length ? [{ key: null, ids }] : [];
  const sets = HINDU_SECTIONS.map((section) => ({ key: section.key as string | null, ids: section.ids.filter((id) => ids.includes(id)) }));
  const rest = ids.filter((id) => !hinduListed.has(id));
  return [...sets, ...(rest.length ? [{ key: null, ids: rest }] : [])].filter((set) => set.ids.length);
}

/** Motifs drawn for us that still need a community's review before launch (D47 (3)). */
export const MOTIFS_AWAITING_REVIEW = MOTIF_IDS.filter((id) => (Object.hasOwn(LIBRARY, id) ? LIBRARY[id].review : PICTURES[id]?.review));

/**
 * A motif in the template's colours, `size` px square; nothing for None or an unknown id. `paper` is the colour the
 * motif sits on (details are cut out in it); it defaults to `base`.
 */
export function Motif({ id, ink, base, paper, size }: { id: string | null; ink: string; base: string; paper?: string; size: number }) {
  const gradientId = `motif${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  if (!isMotif(id)) return null;
  id = LEGACY_IDS[id] ?? id;
  if (Object.hasOwn(PICTURES, id)) {
    // A picture: drawn as it is (its own colours), in a size x size box; the PDF writer fetches it when printing.
    return <img src={PICTURES[id].src} width={size} height={size} alt="" style={{ display: "block", objectFit: "contain" }} />;
  }
  const { draw: Drawing, y1, y2 } = LIBRARY[id];
  const lite = tint(ink, 0.35);
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden style={{ display: "block" }}>
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="0" y1={y1} x2="0" y2={y2}>
          <stop offset="0" stopColor={ink} />
          <stop offset="1" stopColor={lite} />
        </linearGradient>
      </defs>
      <Drawing g={`url(#${gradientId})`} base={base} cut={paper ?? base} lite={lite} ink={ink} />
    </svg>
  );
}
