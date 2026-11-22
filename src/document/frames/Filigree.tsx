import type { ReactNode } from "react";
import type { Palette } from "../tokens";
import { at, bez, CORNERS, curlPts, DIAG, H, leafD, mix, R, rev, seg, spiral, taper, tp, W, type Pt } from "./geometry";
import { FrameSvg, Metal, ornament, stroke, useFrameId } from "./svg";

// The filigree frame family (Deepam on dark paper; Step 4.4's Baroque Gold reuses the corner with leaves, VISION
// D39, D44, D46): a C-scroll with a counter scroll and inner curl along each edge from every corner, a fleur pointing
// out of the corner, fine double rules between the corners and a small cartouche at the bottom centre. Our own
// drawing, ported from the mockup library (docs/mockups/assets/frames.js, "filigreeCorner"/"filigreeDark"). The
// scrolls are tapered strokes filled with a sideways metal gradient of `rule`; the corner jewel is `accent`.
//
// Each corner piece stays within 200 px along the edges and 46 px in from them (57 px along the diagonal); the rules
// sit at 21.6 and 27 px. Deepam's margins (64 top and bottom, 60 sides, 48 under a top element) keep text clear.

type W3 = readonly [number, number, number];

/** The scroll strokes of the top half of a corner (mirrored across the diagonal for the other half). */
function scrolls(w: number, leaves: boolean): string[] {
  const T = (pts: readonly Pt[], ws: W3) => taper(pts, [ws[0] * w, ws[1] * w, ws[2] * w]);
  const main = bez([40, 40], [52, 28], [80, 21], [118, 21], 24).concat(spiral(118, 33, 12, 3, -90, 1.15, 1).slice(1));
  const counter = bez([84, 21.5], [104, 17], [130, 12], [160, 17], 20).concat(spiral(160, 10, 7, 1.8, 90, 1.1, -1).slice(1));
  const out = [
    T(main, [3.2, 3.6, 0.6]),
    T(counter, [0.5, 2.2, 0.4]),
    T(bez([150, 20.5], [166, 23], [180, 22], [196, 22], 12), [0.4, 1.5, 0.8]),
    T(bez([62, 27], [72, 34], [84, 38], [94, 36], 10).concat(spiral(94, 31, 5, 1.4, 90, 1, -1).slice(1)), [0.4, 1.6, 0.4]),
  ];
  if (leaves) out.push(T(bez([50, 42], [62, 32], [84, 27], [104, 28], 14).concat(spiral(104, 33, 5, 1.4, -90, 1, 1).slice(1)), [0.3, 1.2, 0.3]));
  return out;
}

/** Acanthus-style fronds on the scrolls (Baroque): x, y, angle, length, half-width. */
const FRONDS = [
  [64, 26, -38, 20, 5],
  [72, 25, -8, 15, 3.8],
  [104, 19, -32, 15, 3.8],
  [136, 14, -58, 11, 3],
] as const;

const FLEUR_BUD = "M0 -1C6.5 -7 6.5 -16 0 -25C-6.5 -16 -6.5 -7 0 -1Z";

export interface FiligreeOptions {
  /** Scale of the whole corner. */
  k: number;
  /** Stroke weight multiplier. */
  w: number;
  /** Add acanthus fronds and an echo line (Baroque). */
  leaves: boolean;
}

const cache = new Map<string, { scrolls: string; side: string }>();
function corner(o: FiligreeOptions) {
  const key = `${o.w}:${o.leaves}`;
  let c = cache.get(key);
  if (!c) {
    c = { scrolls: scrolls(o.w, o.leaves).join(""), side: taper(tp(curlPts(11, 4.6, 1, 2, 1.05), 1.5, -3, -58), [2.2 * o.w, 2.6 * o.w, 0.4 * o.w]) };
    cache.set(key, c);
  }
  return c;
}

/** One corner (top-left; place it with CORNERS), filled with `fill` (usually a metal gradient). */
export function FiligreeCorner({ o, fill, line, accent, leafFill, vein }: { o: FiligreeOptions; fill: string; line: string; accent: string; leafFill?: string; vein?: string }) {
  const c = corner(o);
  const half: ReactNode = (
    <>
      <path d={c.scrolls} fill={fill} />
      {o.leaves
        ? FRONDS.map(([x, y, a, L, hw]) => (
            <g key={x} transform={at(x, y, a)}>
              <path d={leafD(L, hw, -hw * 0.3)} fill={leafFill ?? accent} />
              <path d={`M1 0Q${R(L * 0.5)} ${R(-hw * 0.25)} ${R(L * 0.85)} ${R(-hw * 0.3)}`} {...stroke(vein ?? line, 0.6)} />
            </g>
          ))
        : null}
      <circle cx="118" cy="33" r={R(1.6 * o.w)} fill={line} />
      <circle cx="160" cy="10" r={R(1.2 * o.w)} fill={line} />
    </>
  );
  return (
    <g transform={`scale(${o.k})`}>
      {half}
      <g transform={DIAG}>{half}</g>
      <g transform="translate(40 40) rotate(-45)">
        <path d={FLEUR_BUD} fill={fill} />
        <path d={c.side} fill={fill} />
        <path d={c.side} fill={fill} transform="scale(-1 1)" />
        <ellipse cy="-2.5" rx="5" ry="1.7" fill={fill} />
      </g>
      <circle cx="40" cy="40" r={R(3.4 * o.w)} fill={accent} stroke={line} strokeWidth={R(0.8 * o.w)} />
      <circle cx="50" cy="50" r={R(1.7 * o.w)} fill={line} />
      <circle cx="56.5" cy="56.5" r={R(1.1 * o.w)} fill={line} />
    </g>
  );
}

/** Straight rules on all four sides between `e` and the opposite `e`, at each inset. */
export const sideRules = (e: number, inset: number) =>
  [seg(e, inset, W - e, inset), seg(e, H - inset, W - e, H - inset), seg(inset, e, inset, H - e), seg(W - inset, e, W - inset, H - e)].join("");

const DARK_OPTIONS: FiligreeOptions = { k: 0.98, w: 0.7, leaves: false };

// The bottom cartouche: an arm of spiral and curl on each side of a diamond.
const BY = H - 24;
const ARM =
  taper(rev(spiral(-34, BY - 6, 6, 1.4, 90, 1.1, 1)).concat(bez([-28, BY], [-20, BY], [-14, BY], [-9, BY], 6).slice(1)), [0.5, 1.8, 0.6]) +
  taper(tp(curlPts(30, 4, 1, 2, 1), -40, BY, 180), [0.5, 1.4, 0.4]);

export function FiligreeDarkFrame({ palette }: { palette: Palette }) {
  const { line, accent, paper, dark } = ornament(palette);
  const id = useFrameId("fil");
  const metal = `url(#${id})`;
  return (
    <FrameSvg>
      <defs>
        <Metal id={id} color={line} dark={dark} />
      </defs>
      <path d={sideRules(191, 21.6)} {...stroke(line, 1.1)} />
      <path d={sideRules(191, 27)} {...stroke(mix(line, paper, 0.2), 0.5)} />
      {CORNERS.map((t, i) => (
        <g key={i} transform={t}>
          <FiligreeCorner o={DARK_OPTIONS} fill={metal} line={line} accent={accent} />
        </g>
      ))}
      <rect x={W / 2 - 80} y={BY - 12} width="160" height="24" fill={paper} />
      <g transform={`translate(${W / 2} 0)`}>
        <path d={ARM} fill={metal} />
        <path d={ARM} fill={metal} transform="scale(-1 1)" />
        <path d={`M0 ${BY - 9}L7 ${BY}L0 ${BY + 9}L-7 ${BY}Z`} fill={metal} />
        <path d={`M0 ${BY - 4.5}L3.4 ${BY}L0 ${BY + 4.5}L-3.4 ${BY}Z`} fill={paper} />
        <circle cx="-75" cy={BY} r="1.3" fill={line} />
        <circle cx="75" cy={BY} r="1.3" fill={line} />
      </g>
    </FrameSvg>
  );
}
