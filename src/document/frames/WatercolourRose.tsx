import type { ReactNode } from "react";
import type { Palette } from "../tokens";
import { at, bez, darken, leafD, lighten, MXY, mix, pol, R, spiral, taper, type Pt } from "./geometry";
import { FrameSvg, ornament, stroke, useFrameId } from "./svg";
import { arcPts, blob, CornerWash, fade, gradientBank } from "./wash";

// The watercolour-roses frame family (Watercolour Rose, VISION D46, D51): soft washes with loose roses, buds and
// leaves in the top-left and bottom-right corners, and a gentle glow of colour spreading from those corners. Our
// own drawing, ported from the mockup library (docs/mockups/assets/frames.js, "watercolorRose"). The mockup paints
// with translucent radial gradients; here every translucent colour is mixed with the paper, the glow is a corner
// wash that fades to the paper (wash.tsx) and the blooms are wobbly blobs with linear gradients.
// Colours: roses in `rule`, leaves in `accent`, washes in `soft`.
//
// Each cluster stays within about 240 px of its corner along the edges and 70 px in from them (the roses at the
// very corner reach 82 px along the diagonal); Watercolour Rose's margins keep the text clear.

const K = 1.34;

function cluster(p: Palette, bank: ReturnType<typeof gradientBank>, variant: number) {
  const { line: c, accent: a, paper } = ornament(p);
  // Washes are a shade deeper than the corner glow, so they always read as a layer of colour on it.
  const soft = mix(ornament(p).soft, c, 0.1);
  const tint = (col: string, op: number) => mix(paper, col, op);
  const out: ReactNode[] = [];
  let key = 0;
  /** A wash fading away from the corner: along +x, -x (towards the left) or +y. */
  const wash = (cx: number, cy: number, rx: number, ry: number, rot: number, col: string, op: number, seed: number, dir: "x" | "-x" | "y" = "x") => {
    const [strong, pale] = [tint(col, op), tint(col, op * 0.78)];
    const d = blob(cx, cy, rx, ry, rot, 0.16, seed, 16);
    out.push(<path key={key++} d={d} fill={dir === "-x" ? bank.fill(pale, strong, true) : bank.fill(strong, pale, dir === "x")} stroke={tint(col, Math.min(1, op * 1.08))} strokeWidth="1" />);
  };
  const leaf = (x: number, y: number, deg: number, L: number, w: number, op: number) => {
    out.push(
      <g key={key++} transform={at(x, y, deg)} strokeWidth="0.7">
        <path d={leafD(L, w)} fill={bank.fill(tint(a, op), tint(lighten(a, 0.3), op * 0.6))} stroke={tint(darken(a, 0.1), op * 0.7)} />
        <path d={`M0 0Q${R(L * 0.5)} ${R(-w * 0.15)} ${R(L * 0.9)} 0`} fill="none" stroke={tint(darken(a, 0.15), op * 0.85)} />
      </g>,
    );
  };
  const rose = (cx: number, cy: number, r: number, seed: number) => {
    const ink = tint(darken(c, 0.22), 0.6);
    for (let k = 0; k < 5; k++) {
      const ang = k * 72 + seed * 23;
      const pc = pol(cx, cy, r * 0.42, ang);
      out.push(<path key={key++} d={blob(pc[0], pc[1], r * 0.6, r * 0.46, ang + 90, 0.12, seed * 10 + k, 14)} fill={tint(c, 0.3)} stroke={tint(c, 0.5)} strokeWidth="0.8" />);
    }
    for (let k = 0; k < 3; k++) {
      const ang = k * 120 + seed * 23 + 36;
      const pc = pol(cx, cy, r * 0.2, ang);
      out.push(<path key={key++} d={blob(pc[0], pc[1], r * 0.42, r * 0.34, ang + 90, 0.1, seed * 20 + k, 12)} fill={tint(c, 0.46)} stroke={tint(c, 0.58)} strokeWidth="0.6" />);
    }
    out.push(<path key={key++} d={blob(cx, cy, r * 0.3, r * 0.27, seed * 30, 0.1, seed * 3, 10)} fill={bank.fill(tint(darken(c, 0.12), 0.72), tint(c, 0.42), false)} />);
    const rot = seed * 37;
    out.push(
      <path key={key++} d={taper(arcPts(cx, cy + r * 0.04, r * 0.52, 25 + rot, 155 + rot), [0.3, 2.2, 0.3])} fill={ink} />,
      <path key={key++} d={taper(arcPts(cx, cy, r * 0.33, 200 + rot, 330 + rot), [0.3, 1.8, 0.3])} fill={ink} />,
      <path key={key++} d={taper(spiral(cx, cy, r * 0.16, r * 0.05, rot, 1, 1), [1.4, 1.2, 0.3])} fill={tint(darken(c, 0.22), 0.7)} />,
    );
  };
  // Washes first (largest and palest), then trailing stems, leaves, roses, buds and a few loose dots.
  wash(80, 19, 140, 26, -4, soft, 1, 3 + variant);
  wash(19, 100, 26, 118, 4, soft, 0.95, 9 + variant, "y");
  wash(132, 15, 78, 13, -3, c, 0.13, 5 + variant);
  wash(14, 150, 11, 70, 2, c, 0.1, 7 + variant, "y");
  // A thin stem trailing along each edge with small leaves (`swap` draws the one down the side).
  for (const swap of [false, true]) {
    const P = (x: number, y: number): Pt => (swap ? [y, x] : [x, y]);
    const stem = bez(P(150, 22), P(185, 14), P(215, 20), P(252, 13), 16);
    out.push(<path key={key++} d={taper(stem, [1.3, 1, 0.3])} fill={tint(darken(a, 0.1), 0.75)} />);
    for (const [x, y, deg, L] of [
      [176, 18, -28, 20],
      [196, 17, 30, 17],
      [218, 18, -26, 15],
      [238, 15, 24, 12],
    ] as const) {
      const [px, py] = P(x, y);
      leaf(px, py, swap ? 90 - deg : deg, L, L * 0.26, 0.6);
    }
  }
  leaf(80, 26, -12, 50, 11, 0.8);
  leaf(122, 16, 8, 40, 9, 0.65);
  leaf(28, 80, 100, 50, 11, 0.8);
  leaf(18, 120, 80, 38, 9, 0.65);
  leaf(160, 20, -6, 28, 7, 0.55);
  leaf(14, 160, 96, 28, 7, 0.55);
  rose(36, 34, 26, 1 + variant);
  rose(84, 18, 15, 2 + variant);
  rose(16, 86, 14, 3 + variant);
  out.push(
    <path key={key++} d="M142 30C146 22 154 22 156 28C154 33 146 34 142 30Z" fill={tint(c, 0.62)} />,
    <path key={key++} d="M138 30Q144 30 152 27" {...stroke(tint(a, 0.8), 1.1)} />,
    <path key={key++} d="M28 150C22 154 22 162 28 164C33 162 34 154 28 150Z" fill={tint(c, 0.62)} />,
    <path key={key++} d="M28 140Q28 146 26.5 154" {...stroke(tint(a, 0.8), 1.1)} />,
  );
  for (const [x, y, r, op] of [
    [262, 22, 1.8, 0.5],
    [270, 15, 1.2, 0.45],
    [22, 262, 1.8, 0.5],
    [15, 270, 1.2, 0.45],
  ] as const) {
    out.push(<circle key={key++} cx={x} cy={y} r={r} fill={tint(c, op)} />);
  }
  return out;
}

export function WatercolourRoseFrame({ palette }: { palette: Palette }) {
  const id = useFrameId("wcr");
  const { paper } = ornament(palette);
  const bank = gradientBank(id);
  const glow = fade(paper, watercolourRoseTint(palette));
  const tl = cluster(palette, bank, 0);
  const br = cluster(palette, bank, 4);
  return (
    <FrameSvg>
      <CornerWash id={`${id}a`} corner="tl" size={560} colors={glow} />
      <CornerWash id={`${id}b`} corner="br" size={560} colors={glow} />
      <g transform={`scale(${K})`}>{tl}</g>
      <g transform={`${MXY} scale(${K})`}>{br}</g>
      {bank.defs()}
    </FrameSvg>
  );
}

/** The darkest tint the frame lays under the text (its corner glow), for the contrast test. */
export const watercolourRoseTint = (p: Palette) => mix(ornament(p).paper, ornament(p).soft, 0.8);
