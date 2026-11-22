import type { ReactNode } from "react";
import type { Palette } from "../tokens";
import { at, bez, cr, curlPts, H, leafD, mix, MX, R, taper, tp, W, type Pt } from "./geometry";
import { FrameSvg, ornament, stroke, useFrameId } from "./svg";
import { CornerWash, fade } from "./wash";

// The vines frame family (Mint Vines, VISION D46, D51): a delicate vine with leaves and little buds climbing each
// side of the page, curling round the top corners and along the top edge, a short sprig at each bottom corner, a
// very fine hairline border, and soft glows of the paper's tint in the four corners. Our own drawing, ported from
// the mockup library (docs/mockups/assets/frames.js, "vines"). Colours: stems in `rule`, leaves in the palette's
// frame gradient, buds in `accent`, the corner glows in `soft`. Paths, circles and linear gradients only.
//
// The vine sways 7 px either side of x = 30 and its leaves and buds reach 54 px in from the side edges; along the
// top the curl and leaves stay within 50 px of the edge for 250 px from each corner. Mint Vines' margins keep the
// text clear.

const X = 30;
const Y0 = 40;
const Y1 = H - 60;
const AMP = 7;
const PER = 64;
const vineX = (y: number) => X + AMP * Math.sin(((y - Y0) / PER) * 2 * Math.PI);

/** The left side, top corner and bottom sprig as path data, built once (the right side is its mirror). */
const ART = (() => {
  const pts: Pt[] = [];
  for (let y = Y0; y <= Y1; y += 8) pts.push([vineX(y), y]);
  const leaves: { x: number; y: number; deg: number; L: number }[] = [];
  const buds: { x: number; y: number; dir: number }[] = [];
  const twigs: string[] = [];
  let i = 0;
  for (let y = Y0 + 16; y < Y1 - 10; y += PER / 2, i++) {
    const x = vineX(y);
    const sgn = i % 2 ? 1 : -1;
    leaves.push({ x, y, deg: sgn > 0 ? 35 : 145, L: 18 }, { x, y: y + 6, deg: sgn > 0 ? 150 : 30, L: 12 });
    if (i % 3 === 1) {
      const bx = x + sgn * 13;
      const by = y + 18;
      twigs.push(`M${R(x)} ${R(y + 8)}Q${R(x + sgn * 8)} ${R(y + 10)} ${R(bx)} ${R(by)}`);
      buds.push({ x: bx, y: by, dir: sgn });
    }
  }
  const top = bez([30, 40], [22, 28], [34, 16], [60, 22], 12)
    .concat(bez([60, 22], [100, 32], [130, 12], [170, 22], 16).slice(1), bez([170, 22], [200, 30], [220, 18], [236, 22], 10).slice(1));
  for (const [x, y, deg, L] of [
    [56, 21, -140, 15],
    [84, 27, 40, 16],
    [112, 22, -40, 15],
    [144, 18, 30, 14],
    [186, 25, -150, 13],
    [210, 23, 30, 12],
  ] as const) {
    leaves.push({ x, y, deg, L });
  }
  for (const [x, y, dir] of [
    [98, 40, 1],
    [160, 8, -1],
    [222, 36, 1],
  ] as const) {
    buds.push({ x, y: y - 1.8, dir });
  }
  const sprig = bez([30, Y1], [34, H - 40], [44, H - 30], [70, H - 26], 12).concat(bez([70, H - 26], [100, H - 22], [120, H - 34], [140, H - 26], 12).slice(1));
  for (const [x, y, deg, L] of [
    [52, H - 30, -30, 14],
    [76, H - 26, 40, 13],
    [100, H - 26, -40, 13],
    [124, H - 30, 30, 11],
  ] as const) {
    leaves.push({ x, y, deg, L });
  }
  buds.push({ x: 144, y: H - 26.8, dir: -1 });
  return {
    stems: `${cr(pts)}${cr(top)}${cr(sprig)}`,
    tendril: taper(tp(curlPts(16, 4, 1, -2), 236, 22, 0), [1.3, 1.3, 0.4]),
    twigs: twigs.join(""),
    leaves,
    buds,
  };
})();

/** One bud: a round flower bud and a smaller one beside it. */
function Bud({ x, y, dir, color, second }: { x: number; y: number; dir: number; color: string; second: string }) {
  return (
    <>
      <circle cx={R(x - dir * 2.6)} cy={R(y + 4.4)} r="1.8" fill={second} />
      <circle cx={R(x)} cy={R(y + 1.8)} r="2.8" fill={color} />
    </>
  );
}

export function VinesFrame({ palette }: { palette: Palette }) {
  const id = useFrameId("vin");
  const { line, accent, paper } = ornament(palette);
  const [leafDark, leafLight] = palette.frame;
  const glow = fade(paper, vinesTint(palette));
  const side: ReactNode = (
    <>
      <path d={ART.stems} {...stroke(line, 1.3)} />
      <path d={ART.twigs} {...stroke(line, 0.8)} />
      <path d={ART.tendril} fill={line} />
      {ART.leaves.map((l, i) => (
        <path key={i} d={leafD(l.L, l.L * 0.3, 0.6)} transform={at(l.x, l.y, l.deg)} fill={`url(#${id})`} />
      ))}
      {ART.buds.map((b, i) => (
        <Bud key={i} {...b} color={accent} second={mix(paper, accent, 0.75)} />
      ))}
    </>
  );
  return (
    <FrameSvg>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={leafDark} />
          <stop offset="1" stopColor={leafLight} />
        </linearGradient>
      </defs>
      {(["tl", "tr", "bl", "br"] as const).map((c) => (
        <CornerWash key={c} id={`${id}${c}`} corner={c} size={380} colors={glow} />
      ))}
      <rect x="14" y="14" width={W - 28} height={H - 28} {...stroke(mix(paper, line, 0.5), 0.6)} />
      {side}
      <g transform={MX}>{side}</g>
    </FrameSvg>
  );
}

/** The darkest tint the frame lays under the text (its corner glows), for the contrast test. */
export const vinesTint = (p: Palette) => ornament(p).soft;
