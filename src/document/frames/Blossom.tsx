import type { ReactNode } from "react";
import type { Palette } from "../tokens";
import { at, bez, CORNERS, cr, darken, H, leafD, mix, R, W, type Pt } from "./geometry";
import { FrameSvg, ornament, stroke, useFrameId } from "./svg";
import { CornerWash, fade } from "./wash";

// The blossom frame family (Floral Ivory, VISION D46, D51; the florals sibling of Classic Gold's foliage): in each
// corner a five-petal blossom with two smaller ones and a bud, on slender stems with sage leaves that run along the
// edges into a fine rule; a small blossom between two leaves at the middle of each side; soft glows of the paper's
// tint in the corners. Our own drawing (from the mockup's floral border, docs/mockups/assets/doc.js, redrawn with
// shaded petals). Colours: blossoms in `accent` (the small ones paler), leaves in the frame gradient, stems and
// rule in `rule`, glows in `soft`. Paths, circles and linear gradients only.
//
// A corner piece stays within 250 px of its corner along the edges and 58 px in from them (68 px along the
// diagonal); the rule sits 24 px in. Floral Ivory's margins keep the text clear.

const RULE = 24;
const END = 246;

/** A rounded petal from the centre (0,0) out to (r,0). */
const petal = (r: number) =>
  `M0 0C${R(r * 0.2)} ${R(-r * 0.46)} ${R(r * 0.74)} ${R(-r * 0.62)} ${R(r * 0.95)} ${R(-r * 0.26)}` +
  `C${R(r * 1.05)} ${R(-r * 0.06)} ${R(r * 1.05)} ${R(r * 0.06)} ${R(r * 0.95)} ${R(r * 0.26)}` +
  `C${R(r * 0.74)} ${R(r * 0.62)} ${R(r * 0.2)} ${R(r * 0.46)} 0 0Z`;

/** A bud: a closed teardrop pointing along +x from its base at (0,0). */
const BUD = "M0 0C2 -5.5 7 -6.5 12 -1.5C13 -0.5 13 0.5 12 1.5C7 6.5 2 5.5 0 0Z";

/** Where leaves sit along a stem: [t along the stem, side, length]. */
const LEAVES = [
  [0.27, 1, 20],
  [0.38, -1, 19],
  [0.5, 1, 17],
  [0.61, -1, 16],
  [0.72, 1, 14],
  [0.83, -1, 12],
  [0.93, 1, 9],
] as const;

/** The stem along the top edge of the top-left corner (`swap` gives the one down the left edge). */
function stemPts(swap: boolean): Pt[] {
  const P = (x: number, y: number): Pt => (swap ? [y, x] : [x, y]);
  return bez(P(34, 34), P(80, 16), P(160, 28), P(END, RULE), 30);
}

const STEMS = [stemPts(false), stemPts(true)];

/** Leaves on both stems: position and angle. */
const LEAF_AT = STEMS.flatMap((pts, s) =>
  LEAVES.map(([t, side, L]) => {
    const i = Math.round(t * (pts.length - 1));
    const [a, b] = [pts[i], pts[Math.min(pts.length - 1, i + 1)]];
    const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
    // The stem down the side is the top one mirrored, so its leaves turn the other way to stay mirror images.
    return { x: a[0], y: a[1], deg: ang + (s ? -side : side) * 42, L };
  }),
);

/** Five shaded petals round a golden heart; big blossoms (r ≥ 15) also get a ring of dots. */
function Blossom({ x, y, r, turn, fill, line, heart, dots }: { x: number; y: number; r: number; turn: number; fill: string; line: string; heart: string; dots: string }) {
  const d = petal(r);
  return (
    <g transform={at(x, y, turn)} fill={fill} stroke={line} strokeWidth="0.8">
      {[0, 72, 144, 216, 288].map((a) => (
        <path key={a} d={d} transform={a ? `rotate(${a})` : undefined} />
      ))}
      <circle r={R(r * 0.3)} fill={heart} stroke="none" />
      {r >= 15 ? <path d={DOTS(r)} fill={dots} stroke="none" /> : null}
    </g>
  );
}

/** The ring of five dots round a big blossom's heart, as one path of tiny circles. */
function DOTS(r: number) {
  const s = R(r * 0.06);
  return [36, 108, 180, 252, 324]
    .map((a) => {
      const rad = (a * Math.PI) / 180;
      const [cx, cy] = [R(r * 0.42 * Math.cos(rad)), R(r * 0.42 * Math.sin(rad))];
      return `M${R(cx - s)} ${cy}a${s} ${s} 0 1 0 ${R(2 * s)} 0a${s} ${s} 0 1 0 ${R(-2 * s)} 0`;
    })
    .join("");
}

export function BlossomFrame({ palette }: { palette: Palette }) {
  const id = useFrameId("blo");
  const { line, accent, paper } = ornament(palette);
  const [leafDark, leafLight] = palette.frame;
  const big = `url(#${id}p)`;
  const small = `url(#${id}q)`;
  const leaf = `url(#${id}l)`;
  const heart = mix(accent, "#f4c24d", 0.62);
  const dots = darken(accent, 0.35);
  const glow = fade(paper, blossomTint(palette));
  const corner: ReactNode = (
    <>
      <path d={`${cr(STEMS[0])}${cr(STEMS[1])}`} {...stroke(line, 1.3)} />
      {LEAF_AT.map((l, i) => (
        <path key={i} d={leafD(l.L, l.L * 0.32, 0.8)} transform={at(l.x, l.y, l.deg)} fill={leaf} />
      ))}
      {/* Leaves tucked behind the big blossom, pointing along both edges and inwards. */}
      <path d={leafD(26, 7.6, 1.5)} transform={at(48, 36, -8)} fill={leaf} />
      <path d={leafD(26, 7.6, -1.5)} transform={at(36, 48, 98)} fill={leaf} />
      <path d={leafD(18, 5.6, 1)} transform={at(50, 50, 45)} fill={leaf} />
      <path d={BUD} transform={at(END - 64, RULE + 2, -24)} fill={small} />
      <path d={BUD} transform={at(RULE + 2, END - 64, 114)} fill={small} />
      <Blossom x={118} y={23} r={10.5} turn={20} fill={small} line={paper} heart={heart} dots={dots} />
      <Blossom x={23} y={118} r={10.5} turn={-14} fill={small} line={paper} heart={heart} dots={dots} />
      <Blossom x={66} y={45} r={7} turn={30} fill={small} line={paper} heart={heart} dots={dots} />
      <Blossom x={45} y={66} r={7} turn={-6} fill={small} line={paper} heart={heart} dots={dots} />
      <Blossom x={38} y={38} r={22} turn={8} fill={big} line={paper} heart={heart} dots={dots} />
      <circle cx="86" cy="38" r="1.8" fill={mix(paper, accent, 0.7)} />
      <circle cx="38" cy="86" r="1.8" fill={mix(paper, accent, 0.7)} />
    </>
  );
  // The middle of each side: a small blossom between two leaves, over a gap in the rule.
  const mid = (x: number, flip: boolean): ReactNode => (
    <g key={x}>
      <path d={leafD(20, 5.6, 1)} transform={at(x, H / 2 - 9, flip ? -100 : -80)} fill={leaf} />
      <path d={leafD(20, 5.6, -1)} transform={at(x, H / 2 + 9, flip ? 100 : 80)} fill={leaf} />
      <Blossom x={x} y={H / 2} r={9} turn={flip ? 54 : 18} fill={big} line={paper} heart={heart} dots={dots} />
    </g>
  );
  const rule =
    `M${END} ${RULE}H${W - END}M${END} ${H - RULE}H${W - END}` +
    [RULE, W - RULE].map((x) => `M${x} ${END}V${H / 2 - 30}M${x} ${H / 2 + 30}V${H - END}`).join("");
  return (
    <FrameSvg>
      <defs>
        <linearGradient id={`${id}p`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={darken(accent, 0.08)} />
          <stop offset="1" stopColor={mix(accent, paper, 0.38)} />
        </linearGradient>
        <linearGradient id={`${id}q`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={mix(accent, paper, 0.18)} />
          <stop offset="1" stopColor={mix(accent, paper, 0.58)} />
        </linearGradient>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={leafDark} />
          <stop offset="1" stopColor={leafLight} />
        </linearGradient>
      </defs>
      {(["tl", "tr", "bl", "br"] as const).map((c) => (
        <CornerWash key={c} id={`${id}${c}`} corner={c} size={390} colors={glow} />
      ))}
      <path d={rule} {...stroke(line, 1)} />
      {CORNERS.map((t, i) => (
        <g key={i} transform={t}>
          {corner}
        </g>
      ))}
      {mid(RULE, false)}
      {mid(W - RULE, true)}
    </FrameSvg>
  );
}

/** The darkest tint the frame lays under the text (its corner glows), for the contrast test. */
export const blossomTint = (p: Palette) => ornament(p).soft;
