import type { Palette } from "../tokens";
import { H, insetRect, mix, nums, pol, W, type Pt } from "./geometry";
import { FrameSvg, ornament, stroke } from "./svg";

// The rangoli frame family (Rangoli, VISION D39, D46): a kolam band all round the page (two interlaced waves with
// dots in their eyes and small petals at alternate crossings) between fine rules, with a kolam rosette at each
// corner. Our own drawing, ported from the mockup library (docs/mockups/assets/frames.js, "rangoli") and made
// lighter: each half-wave is one relative cubic (not 25 sampled points) and the dots are tiny round-capped strokes,
// all dots of a colour in one path. Lines in `rule`, dots in `accent`, the band backing `soft` on the paper.
//
// The band runs 22–50 px from every edge; the rosettes reach 61 px at the corners. Rangoli's margins (70 top and
// bottom, 66 sides) keep the text clear.

const D = 36;
const AMP = 6.5;
/** A sine half-wave as one cubic: control points 0.4244 of the way in, 4/3 of the amplitude out. */
const K = 0.4244;

/** A dot as a tiny round-capped stroke (the stroke width is its diameter): a dozen characters instead of forty. */
const dot = (x: number, y: number) => `M${nums([x, y])}h0.01`;

/** One side of the band from p to q (on the band's centre line): the two waves, the eye dots and the petals. */
function side(p: Pt, q: Pt) {
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
  const n = Math.max(2, Math.round(len / 15));
  const s = len / n;
  const [ux, uy] = [(q[0] - p[0]) / len, (q[1] - p[1]) / len];
  const [nx, ny] = [-uy, ux];
  // Relative offsets of a half-wave's controls and end. Consecutive half-waves bulge to alternate sides, so each
  // one's first control is the reflection of the previous one's second: one `c`, then `s` all the way.
  const v = (t: number, off: number) => [ux * t + nx * off, uy * t + ny * off];
  let waves = "";
  for (const dir of [1, -1]) {
    const off = (dir * 4 * AMP) / 3;
    const rest: number[] = [];
    for (let k = 1; k < n; k++) rest.push(...v(s - K * s, k % 2 ? -off : off), ...v(s, 0));
    waves += `M${nums(p)}c${nums([...v(K * s, off), ...v(s - K * s, off), ...v(s, 0)])}s${nums(rest)}`;
  }
  let eyes = "";
  let petals = "";
  for (let k = 0; k < n; k++) {
    const t = s * (k + 0.5);
    eyes += dot(p[0] + ux * t, p[1] + uy * t);
    if (k % 2 === 1) {
      const [cx, cy] = [p[0] + ux * s * k, p[1] + uy * s * k];
      petals += dot(cx + nx * 10.5, cy + ny * 10.5) + dot(cx - nx * 10.5, cy - ny * 10.5);
    }
  }
  return { waves, eyes, petals };
}

const E = D + 27;
const SIDES = [side([E, D], [W - E, D]), side([E, H - D], [W - E, H - D]), side([D, E], [D, H - E]), side([W - D, E], [W - D, H - E])];
const BAND = {
  waves: SIDES.map((s) => s.waves).join(""),
  eyes: SIDES.map((s) => s.eyes).join(""),
  petals: SIDES.map((s) => s.petals).join(""),
};

// A kolam rosette: eight loops round a centre, dots between them.
const ROSETTE_DOTS = Array.from({ length: 8 }, (_, k) => dot(...pol(0, 0, 18.5, k * 45 + 22.5))).join("");

function Rosette({ x, y, line, accent, fill }: { x: number; y: number; line: string; accent: string; fill: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="25" fill={fill} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <ellipse key={a} cx="12.5" rx="10" ry="4.6" transform={a ? `rotate(${a})` : undefined} {...stroke(line, 1.3)} />
      ))}
      <path d={ROSETTE_DOTS} {...stroke(accent, 3.2)} />
      <circle r="25" {...stroke(line, 0.8)} />
      <circle r="2.4" fill={accent} />
    </g>
  );
}

export function RangoliFrame({ palette }: { palette: Palette }) {
  const { line, accent, soft, paper } = ornament(palette);
  const rosette = { line, accent, fill: mix(paper, soft, 0.55) };
  return (
    <FrameSvg>
      <path d={`${insetRect(D - 14)}${insetRect(D + 14)}`} fill={mix(paper, soft, 0.45)} fillRule="evenodd" />
      <path d={insetRect(D - 14)} {...stroke(line, 1)} />
      <path d={insetRect(D - 18)} {...stroke(line, 0.45)} />
      <path d={insetRect(D + 14)} {...stroke(line, 0.7)} />
      <path d={BAND.waves} {...stroke(line, 1.25)} />
      <path d={BAND.eyes} {...stroke(accent, 3)} />
      <path d={BAND.petals} {...stroke(line, 2.2)} />
      <Rosette x={D} y={D} {...rosette} />
      <Rosette x={W - D} y={D} {...rosette} />
      <Rosette x={D} y={H - D} {...rosette} />
      <Rosette x={W - D} y={H - D} {...rosette} />
    </FrameSvg>
  );
}
