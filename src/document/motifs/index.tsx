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
  Ganesha,
  GaneshaOrnate,
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
  ganesha: { draw: Ganesha, y1: 6, y2: 100, tradition: "hindu" },
  ganeshaOrnate: { draw: GaneshaOrnate, y1: 7, y2: 100, tradition: "hindu" },
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

export const MOTIF_IDS = Object.keys(LIBRARY);

export const isMotif = (id: string | null | undefined): id is string => !!id && Object.hasOwn(LIBRARY, id);

/** A motif's tradition (the picker's groups). */
export const motifTradition = (id: string): MotifTradition | undefined => (isMotif(id) ? LIBRARY[id].tradition : undefined);

/** Motifs drawn for us that still need a community's review before launch (D47 (3)). */
export const MOTIFS_AWAITING_REVIEW = MOTIF_IDS.filter((id) => LIBRARY[id].review);

/**
 * A motif in the template's colours, `size` px square; nothing for None or an unknown id. `paper` is the colour the
 * motif sits on (details are cut out in it); it defaults to `base`.
 */
export function Motif({ id, ink, base, paper, size }: { id: string | null; ink: string; base: string; paper?: string; size: number }) {
  const gradientId = `motif${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  if (!isMotif(id)) return null;
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
