import type { Palette } from "../tokens";
import { CORNERS, H, leafD, lighten, mix, pol, R, seg, W } from "./geometry";
import { FrameSvg, ornament, stroke, useFrameId } from "./svg";

// The mandala corners frame family (Royal Maroon, VISION D39, D46): a quarter mandala in each corner (scalloped
// rim, lotus arches, a ring of dots, gradient petals and a leaf rosette) joined by a fine rule with small diamonds
// at the middle of each side. Our own drawing, ported from the mockup library (docs/mockups/assets/frames.js,
// "mandalaCorners"); the radial petal gradient became a linear one along each petal, and the translucent fills
// solid tints of the paper, both inside the PDF writer's SVG subset. Lines in `rule`, dots and leaves `accent`.
//
// Each quarter reaches 83 px from its corner; the rule sits 18 px in. Royal Maroon's margins (76 top and bottom,
// 64 sides, 44 at the top of page 1 under a centred top element) keep text clear: the content box's corner is
// 99 px from the page corner.

const SCALE = 0.94;

const RIM = (() => {
  let d = "M82 0";
  for (let i = 0; i < 18; i++) {
    const a0 = (i / 18) * 90;
    const a1 = ((i + 1) / 18) * 90;
    const pm = pol(0, 0, 88, (a0 + a1) / 2);
    const p1 = pol(0, 0, 82, a1);
    d += `Q${R(pm[0])} ${R(pm[1])} ${R(p1[0])} ${R(p1[1])}`;
  }
  return d;
})();

const dot = (x: number, y: number, r: number) => `M${R(x - r)} ${R(y)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const dotsOn = (r: number, angles: number[], size: number) => angles.map((a) => dot(...pol(0, 0, r, a), size)).join("");
const range = (n: number, step: number, from = 0) => Array.from({ length: n }, (_, i) => from + i * step);

const RIM_DOTS = dotsOn(86.5, range(18, 5, 2.5), 1.1);
const LOTUS = range(7, 15)
  .map((ang) => {
    const [pa, pb, pt, ca, cb] = [pol(0, 0, 52, ang - 7), pol(0, 0, 52, ang + 7), pol(0, 0, 71, ang), pol(0, 0, 66, ang - 7), pol(0, 0, 66, ang + 7)];
    const p = (q: readonly [number, number]) => `${R(q[0])} ${R(q[1])}`;
    return `M${p(pa)}C${p(ca)} ${p(pt)} ${p(pt)}C${p(pt)} ${p(cb)} ${p(pb)}`;
  })
  .join("");
const LOTUS_DOTS = dotsOn(60, range(7, 15), 1.6);
const RING_DOTS = dotsOn(43, range(13, 7.5), 1.3);
const PETAL = "M0 0C6 -3.6 22 -5.2 38 0C22 5.2 6 3.6 0 0Z";
const LEAF = leafD(17, 4);

const R0 = 18;
const E = 92;
const RULE = [seg(E, R0, W - E, R0), seg(E, H - R0, W - E, H - R0), seg(R0, E, R0, H - E), seg(W - R0, E, W - R0, H - E)].join("");
const DIAMONDS = `M${W / 2} ${R0 - 5}l5 5l-5 5l-5 -5zM${W / 2} ${H - R0 - 5}l5 5l-5 5l-5 -5zM${R0 - 5} ${H / 2}l5 -5l5 5l-5 5zM${W - R0 - 5} ${H / 2}l5 -5l5 5l-5 5z`;

export function MandalaCornersFrame({ palette }: { palette: Palette }) {
  const { line, accent, soft, paper, dark } = ornament(palette);
  const id = useFrameId("man");
  const quarter = (
    <g transform={`scale(${SCALE})`}>
      <path d="M0 0H82A82 82 0 0 1 0 82Z" fill={mix(paper, soft, 0.55)} />
      <path d={RIM_DOTS} fill={accent} />
      <path d={RIM} {...stroke(line, 1)} />
      <path d="M80 0A80 80 0 0 1 0 80" {...stroke(line, 0.5)} />
      <path d="M74 0A74 74 0 0 1 0 74" {...stroke(line, 1.1)} />
      <path d={LOTUS} fill={mix(paper, soft, 0.28)} stroke={line} strokeWidth="1.1" strokeLinejoin="round" />
      <path d={LOTUS_DOTS} fill={accent} />
      <path d="M50 0A50 50 0 0 1 0 50" {...stroke(line, 1)} />
      <path d="M46 0A46 46 0 0 1 0 46" {...stroke(line, 0.5)} />
      <path d={RING_DOTS} fill={line} />
      {range(9, 11.25).map((a) => (
        <path key={a} d={PETAL} fill={`url(#${id})`} transform={a ? `rotate(${a})` : undefined} />
      ))}
      <path d="M0 0H20A20 20 0 0 1 0 20Z" fill={paper} />
      <path d="M20 0A20 20 0 0 1 0 20" {...stroke(line, 1)} />
      {range(5, 22.5).map((a) => (
        <path key={a} d={LEAF} fill={accent} transform={a ? `rotate(${a})` : undefined} />
      ))}
      <path d="M0 0H6A6 6 0 0 1 0 6Z" fill={line} />
    </g>
  );
  return (
    <FrameSvg>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="38" y2="0">
          <stop offset="0" stopColor={line} />
          <stop offset="1" stopColor={lighten(line, dark ? 0.15 : 0.35)} />
        </linearGradient>
      </defs>
      {CORNERS.map((t, i) => (
        <g key={i} transform={t}>
          {quarter}
        </g>
      ))}
      <path d={RULE} {...stroke(line, 0.8)} />
      <path d={DIAMONDS} fill={accent} />
    </FrameSvg>
  );
}
