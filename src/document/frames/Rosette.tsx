import type { Palette } from "../tokens";
import { at, CORNERS, H, leafD, mix, nums, pol, seg, W } from "./geometry";
import { PaperWash, washAt } from "./paper-wash";
import { FrameSvg, ornament, stroke } from "./svg";

// The rosette frame family (Navy Rosette, VISION D46, D51): a formal double border with a fine gold line inside it, a rosette in each corner and at
// the middle of each side, and a laurel sprig growing out of each mid-side rosette along the border, on a soft
// paper wash. Our own drawing, ported from the mockup library (docs/mockups/assets/frames.js, "rosetteLine"); the
// rotated ellipse petals became one path per rosette and the 90 % leaves solid mixes. Lines, petals and leaves in
// `rule`; the rosettes' centres and dots in `accent`.
//
// The border sits at 22 and 29 px with a gold line at 34; the corner rosettes reach 43 px from each edge, the side rosettes 38 px, the
// sprigs lie along the border within 30 px of it.

const O = 22;
const I = 29;
const M = (O + I) / 2;
/** A fine third line in `accent` (gold) inside the double border. */
const G = 34;

/** An ellipse centred at (cx, cy), turned by deg, as four cubics. */
function ellipseD(cx: number, cy: number, rx: number, ry: number, deg: number): string {
  const k = 0.5523;
  const rad = (deg * Math.PI) / 180;
  const [c, s] = [Math.cos(rad), Math.sin(rad)];
  const p = (x: number, y: number) => [cx + x * c - y * s, cy + x * s + y * c];
  const q = [
    [rx, 0, rx, k * ry, k * rx, ry, 0, ry],
    [-k * rx, ry, -rx, k * ry, -rx, 0],
    [-rx, -k * ry, -k * rx, -ry, 0, -ry],
    [k * rx, -ry, rx, -k * ry, rx, 0],
  ];
  let d = `M${nums(p(q[0][0], q[0][1]))}C${nums([...p(q[0][2], q[0][3]), ...p(q[0][4], q[0][5]), ...p(q[0][6], q[0][7])])}`;
  for (const seg6 of q.slice(1)) d += `C${nums([...p(seg6[0], seg6[1]), ...p(seg6[2], seg6[3]), ...p(seg6[4], seg6[5])])}`;
  return `${d}Z`;
}

const range = (n: number, step: number, from = 0) => Array.from({ length: n }, (_, i) => from + i * step);
const dot = (x: number, y: number, r: number) => `M${nums([x - r, y])}a${nums([r, r])} 0 1 0 ${nums([2 * r, 0])}a${nums([r, r])} 0 1 0 ${nums([-2 * r, 0])}Z`;

/** A rosette of radius r at the origin: twelve petals and twelve dots between them. */
function rosetteParts(r: number) {
  return {
    petals: range(12, 30)
      .map((a) => ellipseD(...pol(0, 0, r * 0.55, a), r * 0.32, r * 0.13, a))
      .join(""),
    dots: range(12, 30, 15)
      .map((a) => dot(...pol(0, 0, r * 0.88, a), r * 0.05 + 0.3))
      .join(""),
  };
}

const SIDE_R = 11;
const CORNER_R = 16;
const SIDE = rosetteParts(SIDE_R);
const CORNER = rosetteParts(CORNER_R);

/**
 * A laurel sprig along +x from a rosette at the origin: a stem, four staggered pairs of broad leaves (x, length) set at
 * a shallow angle, and a tip leaf. Thin leaves at a steep angle read as chevrons ("->>>"), so they are full and close.
 */
const SPRIG_LEAVES = [
  [16, 10.5],
  [24, 10],
  [32, 9],
  [40, 7.5],
] as const;

export function RosetteFrame({ palette }: { palette: Palette }) {
  const { line, accent, paper } = ornament(palette);
  const leaf = mix(line, paper, 0.25);
  const rosette = (r: number, parts: typeof SIDE, backing: string) => (
    <>
      <circle r={r + 1.5} fill={backing} />
      <circle r={r} {...stroke(line, 1.1)} />
      <path d={parts.petals} fill={line} />
      <circle r={r * 0.22} fill={accent} />
      <circle r={r * 0.08} fill={backing} />
      <path d={parts.dots} fill={accent} />
    </>
  );
  const sprig = (
    <>
      <path d={seg(13, 0, 50, 0)} {...stroke(line, 0.8)} />
      {SPRIG_LEAVES.map(([x, L]) => (
        <g key={x}>
          <path d={leafD(L, L * 0.38, L * 0.1)} fill={leaf} transform={at(x, -0.6, -28)} />
          <path d={leafD(L, L * 0.38, -L * 0.1)} fill={leaf} transform={at(x + 4, 0.6, 28)} />
        </g>
      ))}
      <path d={leafD(7.5, 2.8)} fill={leaf} transform={at(48, 0)} />
    </>
  );
  // A mid-side ornament at (x, y): the backing that breaks the border, two sprigs and the rosette, drawn for the top
  // edge and turned so that its +y points into the page.
  const sideOrnament = (x: number, y: number, turn: number) => {
    const backing = washAt(palette, y);
    return (
      <g key={`${x} ${y}`} transform={at(x, y, turn)}>
        <rect x="-58" y={O - 4 - M} width="116" height={G - O + 7} fill={backing} />
        {sprig}
        <g transform="scale(-1 1)">{sprig}</g>
        {rosette(SIDE_R, SIDE, backing)}
      </g>
    );
  };
  return (
    <FrameSvg>
      <PaperWash palette={palette} />
      <path d={`M${O} ${O}H${W - O}V${H - O}H${O}Z`} {...stroke(line, 1.7)} />
      <path d={`M${I} ${I}H${W - I}V${H - I}H${I}Z`} {...stroke(line, 0.7)} />
      <path d={`M${G} ${G}H${W - G}V${H - G}H${G}Z`} {...stroke(accent, 0.8)} />
      {sideOrnament(W / 2, M, 0)}
      {sideOrnament(W / 2, H - M, 180)}
      {sideOrnament(M, H / 2, -90)}
      {sideOrnament(W - M, H / 2, 90)}
      {CORNERS.map((t, i) => (
        <g key={i} transform={t}>
          <g transform={at(M, M)}>{rosette(CORNER_R, CORNER, washAt(palette, i < 2 ? M : H - M))}</g>
        </g>
      ))}
    </FrameSvg>
  );
}
