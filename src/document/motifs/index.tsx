import { useEffect, useId, useSyncExternalStore } from "react";
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
import { holdTinted, subscribeTinted, tintedNow, tintPicture } from "./tinted";

// The motif library for the top of a biodata (VISION §7 D21, D45, D47): our own drawings (./library.tsx), each in
// the template's colours: `ink` fills the main shapes as a vertical gradient to a lighter tint and details are cut
// out in the paper colour; and the owner's pictures (./art), the single-colour ones recoloured in `ink` with their
// shading kept (./tone.ts, ./tinted.ts). Nothing is ever shown unless the user picks a motif ("None" first, never
// inferred).

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
 * in drafts and never renamed. `tint`: a single-colour picture (gold line art or gold shading) printed in the
 * design's colours, keeping its shading (./tone.ts; chosen by measuring each picture's hues and by eye, 2026-11-22).
 * Colour pictures (several hues, or a colour that is part of the symbol, like the orange Om seal) keep their own.
 */
const PICTURES: Record<string, { src: string; tradition: MotifTradition; review?: true; tint?: true }> = {
  ganeshaStencil: { src: ART.ganeshaStencil, tradition: "hindu", tint: true },
  ganeshaLine: { src: ART.ganeshaLine, tradition: "hindu", tint: true },
  ganeshaOutline: { src: ART.ganeshaOutline, tradition: "hindu", tint: true },
  ganeshaSeated: { src: ART.ganeshaSeated, tradition: "hindu" },
  ganeshaTrident: { src: ART.ganeshaTrident, tradition: "hindu" },
  ganeshaLotusFrame: { src: ART.ganeshaLotusFrame, tradition: "hindu" },
  ganeshaOrangeFrame: { src: ART.ganeshaOrangeFrame, tradition: "hindu" },
  ganeshaNamah: { src: ART.ganeshaNamah, tradition: "hindu", tint: true },
  omMandala: { src: ART.omMandala, tradition: "hindu", tint: true },
  omSeal: { src: ART.omSeal, tradition: "hindu" },
  venkateswara: { src: ART.venkateswara, tradition: "hindu", review: true },
  ramaWithBow: { src: ART.ramaWithBow, tradition: "hindu", review: true },
  allahWreath: { src: ART.allahWreath, tradition: "muslim", review: true, tint: true },
  jainHand: { src: ART.jainHand, tradition: "jain", review: true, tint: true },
  omGold: { src: ART.omGold, tradition: "hindu", tint: true },
  ganeshaSeatedRight: { src: ART.ganeshaSeatedRight, tradition: "hindu", tint: true },
  ganeshaSeatedLeft: { src: ART.ganeshaSeatedLeft, tradition: "hindu", tint: true },
  ganeshaMandala: { src: ART.ganeshaMandala, tradition: "hindu", tint: true },
  ganeshaLotus: { src: ART.ganeshaLotus, tradition: "hindu", tint: true },
  ganeshaThrone: { src: ART.ganeshaThrone, tradition: "hindu", tint: true },
  ganeshaTrunk: { src: ART.ganeshaTrunk, tradition: "hindu", tint: true },
  // The first symbol: the owner's classic Ganesha. The id was the drawn Ganesha before, so drafts keep their choice.
  ganesha: { src: ART.ganeshaSheet, tradition: "hindu", tint: true },
  ikOnkarDisc: { src: ART.ikOnkarDisc, tradition: "sikh", tint: true },
  khandaSheet: { src: ART.khandaSheet, tradition: "sikh", review: true, tint: true },
  crossLatinSheet: { src: ART.crossLatinSheet, tradition: "christian", tint: true },
  crossBuddedSheet: { src: ART.crossBuddedSheet, tradition: "christian", tint: true },
  allahMedallionSheet: { src: ART.allahMedallionSheet, tradition: "muslim", review: true, tint: true },
  dharmaLight: { src: ART.dharmaLight, tradition: "buddhist", tint: true },
  dharmaSolid: { src: ART.dharmaSolid, tradition: "buddhist", tint: true },
  jainMotto: { src: ART.jainMotto, tradition: "jain", review: true, tint: true },
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
 * classic Ganesha first, then Ganesha in the design's colours, Ganesha as coloured pictures, Om and blessings, the
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

/** Pictures printed in the design's colours (`tint`), in picker order. */
export const TINTED_PICTURE_IDS = PICTURE_IDS.filter((id) => PICTURES[id].tint);

/** The symbol takes the design's colours: every drawn symbol and the tinted pictures; not the colour pictures. */
export const motifInDesignColours = (id: string): boolean => {
  const key = LEGACY_IDS[id] ?? id;
  return Object.hasOwn(LIBRARY, key) || (Object.hasOwn(PICTURES, key) && !!PICTURES[key].tint);
};

/** The picture to recolour for a symbol, or null (None, a drawn symbol, a colour picture). */
function tintSource(id: string | null): string | null {
  if (!isMotif(id)) return null;
  const key = LEGACY_IDS[id] ?? id;
  return Object.hasOwn(PICTURES, key) && PICTURES[key].tint ? PICTURES[key].src : null;
}

/**
 * Makes a symbol's tinted picture in `ink` (./tinted.ts) and resolves when it is ready; at once when nothing needs
 * it. Whatever lays out or prints a document awaits this first, so the picture is never caught untinted.
 */
export async function tintMotif(id: string | null, ink: string): Promise<void> {
  const src = tintSource(id);
  if (src) await tintPicture(src, ink);
}

/**
 * A motif in the template's colours, `size` px square; nothing for None or an unknown id. `paper` is the colour the
 * motif sits on (details are cut out in it); it defaults to `base`.
 */
export function Motif({ id, ink, base, paper, size }: { id: string | null; ink: string; base: string; paper?: string; size: number }) {
  const gradientId = `motif${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const toTint = tintSource(id);
  const tinted = useSyncExternalStore(subscribeTinted, () => (toTint ? tintedNow(toTint, ink) : undefined), () => undefined);
  useEffect(() => {
    if (!toTint) return;
    if (!tinted) {
      void tintPicture(toTint, ink);
      return;
    }
    return holdTinted(toTint, ink);
  }, [toTint, ink, tinted]);
  if (!isMotif(id)) return null;
  id = LEGACY_IDS[id] ?? id;
  if (Object.hasOwn(PICTURES, id)) {
    if (toTint && !tinted) {
      // Being recoloured (a moment, once per design colour): an empty box of the same size, never the gold original.
      return <span data-motif-pending="" style={{ display: "block", width: size, height: size }} />;
    }
    // A picture in a size x size box: tinted (a PNG data URL) or a colour picture as it is. The PDF writer reads it
    // when printing.
    return <img src={tinted ?? PICTURES[id].src} data-motif={id} width={size} height={size} alt="" style={{ display: "block", objectFit: "contain" }} />;
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
