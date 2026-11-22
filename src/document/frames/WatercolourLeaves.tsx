import type { ReactNode } from "react";
import type { Palette } from "../tokens";
import { at, bez, darken, leafD, lighten, MXY, mix, R, taper, W, type Pt } from "./geometry";
import { FrameSvg, ornament, stroke, useFrameId } from "./svg";
import { blob, CornerWash, fade, gradientBank, rng } from "./wash";

// The watercolour-leaves frame family (Mango Grove, VISION D46, D51): sprays of long mango leaves in watercolour
// tints along the top and side from the top-right and bottom-left corners, two ripe mangoes hanging in the top one,
// and a glow of colour spreading from those corners. Our own drawing, ported from the mockup library
// (docs/mockups/assets/frames.js, "watercolorLeaves"; the mangoes are new). Translucent colours are mixed with the
// paper, the glow is a corner wash that fades to the paper (wash.tsx), washes are blobs with linear gradients.
// Colours: leaves alternate `rule`, `accent` and their mixes; twigs a dark `accent`; washes `soft`; the mangoes
// the palette's frame gradient (dark, light, mid).
//
// Each spray stays within about 390 px of its corner along the edges and 62 px in from them; Mango Grove's
// margins keep the text clear.

/** The sprays are drawn a little larger than the mockup's, about the top-right corner. */
const GROW = `translate(${W} 0) scale(1.18) translate(${-W} 0)`;

/** A mango hanging from its stalk at the origin, about 21 × 30 px. */
const MANGO = "M0 0C9 -1 13.5 8 12.5 17C11.5 26 4 31.5-2.5 29.5C-9 27.5-9.5 19-6.5 13C-4 8-3.5 3 0 0Z";

function spray(p: Palette, bank: ReturnType<typeof gradientBank>, variant: number, mango?: string) {
  const { line: c, accent: a, paper } = ornament(p);
  // Washes are a shade deeper than the corner glow, so they always read as a layer of colour on it.
  const soft = mix(ornament(p).soft, c, 0.14);
  const tint = (col: string, op: number) => mix(paper, col, op);
  const r = rng(11 + variant);
  const out: ReactNode[] = [];
  let key = 0;
  /** A wash fading away from the corner: along +x, -x (towards the left) or +y. */
  const wash = (cx: number, cy: number, rx: number, ry: number, rot: number, col: string, op: number, seed: number, dir: "x" | "-x" | "y" = "x") => {
    const [strong, pale] = [tint(col, op), tint(col, op * 0.78)];
    out.push(<path key={key++} d={blob(cx, cy, rx, ry, rot, 0.16, seed, 16)} fill={dir === "-x" ? bank.fill(pale, strong, true) : bank.fill(strong, pale, dir === "x")} stroke={tint(col, Math.min(1, op * 1.1))} strokeWidth="1" />);
  };
  const leaf = (x: number, y: number, deg: number, L: number, w: number, col: string, strength: number) => {
    // Strengths in steps of 0.05, so leaves share a handful of gradients.
    const op = Math.round(strength * 20) / 20;
    out.push(
      <g key={key++} transform={at(x, y, deg)} strokeWidth="0.7">
        <path d={leafD(L, w, w * 0.25)} fill={bank.fill(tint(col, op), tint(lighten(col, 0.3), op * 0.62))} stroke={tint(darken(col, 0.12), op * 0.7)} />
        <path d={`M1 0Q${R(L * 0.5)} ${R(-w * 0.12)} ${R(L * 0.92)} ${R(w * 0.2)}`} fill="none" stroke={tint(darken(col, 0.2), op * 0.8)} />
      </g>,
    );
  };
  wash(W - 124, 18, 134, 20, 3, soft, 1, 31 + variant, "-x");
  wash(W - 18, 132, 18, 124, 2, soft, 0.95, 37 + variant, "y");
  wash(W - 62, 20, 62, 15, -4, c, 0.12, 41 + variant, "-x");
  wash(W - 20, 72, 13, 58, 0, a, 0.1, 43 + variant, "y");
  // Twigs along the top edge and down the side, leaves alternating along them.
  const twigTop = bez([W - 4, 10], [W - 90, 20], [W - 180, 8], [W - 300, 16], 30);
  const twigSide = bez([W - 10, 4], [W - 22, 90], [W - 10, 180], [W - 18, 300], 30);
  const twig = tint(darken(a, 0.28), 0.8);
  out.push(<path key={key++} d={taper(twigTop, [2.6, 1.7, 0.4])} fill={twig} />, <path key={key++} d={taper(twigSide, [2.6, 1.7, 0.4])} fill={twig} />);
  const cols = [c, a, mix(c, a, 0.5), lighten(c, 0.15)];
  const along = (tw: Pt[], n: number) => {
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const idx = Math.round(t * (tw.length - 1));
      const [p0, q] = [tw[idx], tw[Math.min(tw.length - 1, idx + 1)]];
      const ang = (Math.atan2(q[1] - p0[1], q[0] - p0[0]) * 180) / Math.PI;
      const sgn = i % 2 ? 1 : -1;
      const L = (54 - t * 26) * (0.85 + r() * 0.3);
      leaf(p0[0], p0[1], ang + sgn * (24 + r() * 10), L, L * 0.23, cols[(i + variant) % cols.length], 0.72 + r() * 0.22);
    }
  };
  along(twigTop, 14);
  along(twigSide, 14);
  // Two mangoes hanging under the top corner, on short stalks (the bottom spray, turned over, has none).
  if (mango) for (const [x, y, deg, s] of [
    [W - 64, 25, 8, 1.2],
    [W - 38, 42, -14, 1],
  ] as const) {
    out.push(
      <path key={key++} d={`M${x} ${y - 8}Q${R(x + 2)} ${R(y - 3)} ${x} ${y}`} {...stroke(twig, 1.2)} />,
      <path key={key++} d={MANGO} transform={`${at(x, y, deg)} scale(${s})`} fill={mango} stroke={tint(darken(c, 0.15), 0.5)} strokeWidth="0.6" />,
      <path key={key++} d="M-3 8C-4 14-3 20 0 24" transform={`${at(x, y, deg)} scale(${s})`} {...stroke(tint("#ffffff", 0.55), 1.3)} />,
    );
  }
  // A few loose falling leaves and dots further along each edge.
  leaf(W - 330, 30, 165, 18, 4, c, 0.5);
  leaf(W - 34, 330, 105, 18, 4, a, 0.5);
  for (const [x, y, rad, col] of [
    [W - 356, 22, 2, c],
    [W - 366, 30, 1.2, a],
    [W - 24, 360, 2, c],
    [W - 30, 372, 1.2, a],
  ] as const) {
    out.push(<circle key={key++} cx={x} cy={y} r={rad} fill={tint(col, 0.45)} />);
  }
  return out;
}

export function WatercolourLeavesFrame({ palette }: { palette: Palette }) {
  const id = useFrameId("wcl");
  const { paper } = ornament(palette);
  const bank = gradientBank(id);
  const [dark, light, mid] = palette.frame;
  const mango = `url(#${id}m)`;
  const glow = fade(paper, watercolourLeavesTint(palette));
  const tr = spray(palette, bank, 0, mango);
  const bl = spray(palette, bank, 3);
  return (
    <FrameSvg>
      <defs>
        <linearGradient id={`${id}m`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="0.55" stopColor={mid} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
      </defs>
      <CornerWash id={`${id}a`} corner="tr" size={560} colors={glow} />
      <CornerWash id={`${id}b`} corner="bl" size={560} colors={glow} />
      <g transform={GROW}>{tr}</g>
      <g transform={`${MXY} ${GROW}`}>{bl}</g>
      {bank.defs()}
    </FrameSvg>
  );
}

/** The darkest tint the frame lays under the text (its corner glow), for the contrast test. */
export const watercolourLeavesTint = (p: Palette) => mix(ornament(p).paper, ornament(p).soft, 0.8);
