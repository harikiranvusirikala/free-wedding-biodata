import type { Palette } from "../tokens";
import { curlPts, darken, DIAG, H, lighten, mix, MX, nums, pol, taper, tp, W } from "./geometry";
import { PaperWash, washAt } from "./paper-wash";
import { FrameSvg, ornament, stroke, useFrameId } from "./svg";

// The peacock frame family (Peacock, VISION D46, D51): a long peacock feather along the top and down the side from
// each top corner, a short one out of the corner, a fine double border and a lotus with curling tendrils at the
// bottom centre, on a soft paper wash. Our own drawing, ported from the mockup library (docs/mockups/assets/
// frames.js, "peacock"): the eye's radial gradient became a linear one across it, and the translucent barbs solid
// mixes with the paper, both inside the PDF writer's SVG subset. Shafts, barbs and the border in `rule`; the eye in
// `accent` with a pale `soft` rim; the lotus a gradient of `rule`.
//
// The long feathers reach 46 px from the top edge (and from the side) near their eyes, 255 px from the corner; the
// border sits at 27 and 32 px; the lotus rises 31 px above the bottom edge.

const LONG = 252;
const MID = 150;
const SHORT = 52;

/** One feather along +x from (0,0): barbs, fringe round the eye, shaft, and the eye's teardrops. */
function featherPaths(len: number, eye: number) {
  const ex = len - eye * 0.9;
  let barbs = "";
  for (let x = len * 0.12; x < ex + eye * 0.2; x += 4.4) {
    const t = (x - len * 0.12) / (ex - len * 0.12);
    const bl = 5 + Math.pow(Math.max(0, t), 1.3) * eye * 1.35;
    const ang = 32 + t * 10;
    for (const sg of [1, -1]) {
      const p = pol(x, 0, bl, sg * ang);
      barbs += `M${nums([x, 0])}Q${nums([x + bl * 0.55, sg * bl * 0.3, p[0], p[1]])}`;
    }
  }
  let fringe = "";
  for (let k = -150; k <= 150; k += 12) fringe += `M${nums(pol(ex, 0, eye * 0.98, k))}L${nums(pol(ex, 0, eye * 1.32, k))}`;
  const drop = (cx: number, r: number, stretch: number) =>
    `M${nums([cx + r, 0])}C${nums([cx + r, r * 0.95, cx - r * 0.6, r * 0.9, cx - r * stretch, 0])}` +
    `C${nums([cx - r * 0.6, -r * 0.9, cx + r, -r * 0.95, cx + r, 0])}Z`;
  return {
    barbs,
    fringe,
    shaft: taper(
      [
        [0, 0],
        [len * 0.5, 0],
        [len, 0],
      ],
      [1.5, 1.1, 0.4],
    ),
    drops: [drop(ex, eye, 1.7), drop(ex + eye * 0.08, eye * 0.72, 1.6), drop(ex + eye * 0.18, eye * 0.42, 1.45), drop(ex + eye * 0.24, eye * 0.18, 1.3)],
  };
}

const LONG_FEATHER = featherPaths(LONG, 16);
const MID_FEATHER = featherPaths(MID, 11);
const SHORT_FEATHER = featherPaths(SHORT, 8.5);

const PETAL = "M0 0C-7 -5 -8 -15 0 -24C8 -15 7 -5 0 0Z";
const LOTUS_Y = H - 27;
const LOTUS_PETALS = [
  [-70, 0.68],
  [70, 0.68],
  [-38, 0.85],
  [38, 0.85],
  [0, 1],
] as const;
const TENDRIL = taper(tp(curlPts(30, 4, -1, -2, 1.05), 22, 1, 0), [1.4, 1.6, 0.4]);

export function PeacockFrame({ palette }: { palette: Palette }) {
  const { line, accent, soft, paper, dark } = ornament(palette);
  const eyeId = useFrameId("pke");
  const lotusId = useFrameId("pkl");
  const barbs = mix(line, paper, 0.3);
  const fringe = mix(line, paper, 0.4);
  const pupil = dark ? darken(accent, 0.5) : darken(line, 0.35);
  // Behind the lotus (hiding the border) and between its petals: the wash's colour there.
  const backing = washAt(palette, LOTUS_Y);
  const glint = dark ? lighten(line, 0.4) : lighten(accent, 0.55);
  const feather = (f: typeof LONG_FEATHER) => (
    <>
      <path d={f.barbs} {...stroke(barbs, 0.55)} />
      <path d={f.fringe} {...stroke(fringe, 0.55)} />
      <path d={f.shaft} fill={line} />
      <path d={f.drops[0]} fill={soft} stroke={line} strokeWidth="0.9" />
      <path d={f.drops[1]} fill={`url(#${eyeId})`} />
      <path d={f.drops[2]} fill={pupil} />
      <path d={f.drops[3]} fill={glint} />
    </>
  );
  const top = (
    <>
      <g transform="translate(13 13) rotate(15)">{feather(MID_FEATHER)}</g>
      <g transform="translate(13 13) rotate(3)">{feather(LONG_FEATHER)}</g>
    </>
  );
  const corner = (
    <>
      {top}
      <g transform={DIAG}>{top}</g>
      <g transform="translate(13 13) rotate(45)">{feather(SHORT_FEATHER)}</g>
      <circle cx="13" cy="13" r="3.2" fill={accent} />
      <circle cx="13" cy="13" r="1.3" fill={paper} />
    </>
  );
  const e = 270;
  const border = (d: number) => `M${e} ${d}H${W - e}M${d} ${e}V${H - d}H${W - d}V${e}`;
  const tendril = (
    <>
      <path d={TENDRIL} fill={line} />
      <circle cx="58" cy="1" r="1.6" fill={accent} />
      <circle cx="64" cy="1" r="1" fill={line} />
    </>
  );
  return (
    <FrameSvg>
      <PaperWash palette={palette} />
      <defs>
        <linearGradient id={eyeId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={darken(accent, 0.15)} />
          <stop offset="0.6" stopColor={lighten(accent, 0.15)} />
          <stop offset="1" stopColor={darken(accent, 0.1)} />
        </linearGradient>
        <linearGradient id={lotusId} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={line} />
          <stop offset="1" stopColor={lighten(line, dark ? 0.2 : 0.45)} />
        </linearGradient>
      </defs>
      <path d={border(27)} {...stroke(line, 0.9)} />
      <path d={border(32)} {...stroke(line, 0.45)} />
      {corner}
      <g transform={MX}>{corner}</g>
      <g transform={`translate(${W / 2} ${LOTUS_Y}) scale(1.25)`}>
        <rect x="-66" y="-7" width="132" height="12" fill={backing} />
        {LOTUS_PETALS.map(([rot, sc]) => (
          <path key={rot} d={PETAL} fill={`url(#${lotusId})`} stroke={backing} strokeWidth="1.2" transform={`translate(0 -1) rotate(${rot}) scale(${sc})`} />
        ))}
        <path d="M0 -5V-18" {...stroke(mix(lighten(line, 0.6), paper, 0.3), 0.7)} />
        <path d="M-17 1Q0 6 17 1" {...stroke(line, 1.3)} />
        {tendril}
        <g transform="scale(-1 1)">{tendril}</g>
      </g>
    </FrameSvg>
  );
}
