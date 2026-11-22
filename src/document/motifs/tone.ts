// Single-colour symbol pictures in the design's colours (owner's request, 2026-11-22): the gold line drawings and
// gold-shaded pictures (`tint` in PICTURES, ./index.tsx) are recoloured in the browser with the design's `ink`,
// keeping their shading, highlights and transparency. Pure: the browser side (./tinted.ts) decodes the picture to
// a canvas, runs tonePixels on its pixels and hands the document a PNG data URL.
//
// Each pixel's lightness (luma) is measured against the gold the pictures are drawn in (GOLD_LUMA, the luma of the
// line drawings' #b7791f; the shaded pictures' darkest gold is just below it). A pixel of that gold becomes `ink`
// itself; a darker one moves the same share of the way from `ink` toward black as it sat between the gold and black
// (at most SHADE of it); a lighter one the same share toward white (at most LIGHT). So a flat line drawing prints in
// `ink`, like the drawn symbols' main shapes, and a shaded picture keeps its gradients and its pale highlights,
// relative to the gold it was drawn in rather than stretched. On dark papers `ink` is a light gold, so the picture
// comes out light on the dark paper, as the drawn symbols do. Alpha is kept exactly.

/** The luma (0 to 1) of the gold the pictures are drawn in: #b7791f, the line drawings' colour (scripts/motif-art.mts). */
export const GOLD_LUMA = 0.5;
/** How far toward black the darkest possible pixel goes (pure black in the source). */
export const SHADE = 0.6;
/**
 * How far toward white the lightest possible pixel goes (pure white in the source): a highlight stays tinted. Tuned
 * by eye (A7, 2026-11-22): 0.9 left the pale pictures (flared cross, Ik Onkar disc, light Dharma wheel) washed out on
 * light paper and cream slabs on dark paper; 0.7 dimmed the Allah medallion's letters.
 */
export const LIGHT = 0.78;

export type Rgb = readonly [number, number, number];

/** #rrggbb → [r, g, b] (0 to 255). */
export function parseHex(hex: string): Rgb {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Luma (0 to 1) of an sRGB colour, Rec. 709 weights on the stored values (how light it looks, near enough). */
export const luma = (r: number, g: number, b: number): number => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

const mix = (from: Rgb, to: Rgb, t: number): Rgb => [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t];

/** The colours a tinted picture spans: `deep` for black in the source, `ink` for the gold, `light` for white. */
export function toneRamp(ink: string): { deep: Rgb; ink: Rgb; light: Rgb } {
  const base = parseHex(ink);
  return { deep: mix(base, [0, 0, 0], SHADE), ink: base, light: mix(base, [255, 255, 255], LIGHT) };
}

/** The colour a source pixel of luma `l` takes (unrounded), for a ramp from toneRamp. */
export function toneOf(l: number, ramp: { deep: Rgb; ink: Rgb; light: Rgb }): Rgb {
  if (l <= GOLD_LUMA) return mix(ramp.ink, ramp.deep, (GOLD_LUMA - l) / GOLD_LUMA);
  return mix(ramp.ink, ramp.light, Math.min(1, (l - GOLD_LUMA) / (1 - GOLD_LUMA)));
}

/**
 * RGBA pixels (as a canvas's ImageData gives them) recoloured in `ink`, in a new array: the tone of each pixel
 * follows its luma (see the top of this file), alpha is copied unchanged. Lighter in the source stays lighter.
 */
export function tonePixels(data: Uint8ClampedArray | Uint8Array, ink: string): Uint8ClampedArray {
  const ramp = toneRamp(ink);
  // 256 × 256 × 256 lumas collapse to few distinct values: a table by rounded luma keeps it fast on big pictures.
  const table = new Uint8ClampedArray(1021 * 3);
  for (let i = 0; i <= 1020; i++) {
    const [r, g, b] = toneOf(i / 1020, ramp);
    table[i * 3] = Math.round(r);
    table[i * 3 + 1] = Math.round(g);
    table[i * 3 + 2] = Math.round(b);
  }
  const out = new Uint8ClampedArray(data.length);
  for (let p = 0; p < data.length; p += 4) {
    const k = Math.round(luma(data[p], data[p + 1], data[p + 2]) * 1020) * 3;
    out[p] = table[k];
    out[p + 1] = table[k + 1];
    out[p + 2] = table[k + 2];
    out[p + 3] = data[p + 3];
  }
  return out;
}
