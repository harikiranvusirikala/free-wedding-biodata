import type { Palette } from "../tokens";
import { at, CORNERS, cr, curlPts, DIAG, H, leafD, mix, seg, spiral, taper, tp, W } from "./geometry";
import { FrameSvg, ornament, stroke, useFrameId } from "./svg";

// The paisley frame family (Paisley, VISION D39, D46): a mango paisley at each corner, its tail curling along the
// edge into a thin double rule, a leaf and a small flower medallion in the corner. Our own drawing, ported from the
// mockup library (docs/mockups/assets/frames.js, "paisley"). The paisley body is a vertical gradient of `soft`
// towards `rule`, outlined in `rule`; its inner flower, dots and leaves are `accent`.
//
// Each corner piece reaches about 50 px in from both edges and 168 px along them; the rules sit at 24 and 30 px.
// Paisley's margins (66 px, or 52 at the top of page 1 under a top element between the corners) keep text clear.

const PAISLEY = "M-14 1C-15 -9 -6 -15.5 5 -14.5C16 -13.5 27 -14 38 -25C37 -12 31 -1 20 6C11 12 3 14.5 -3 14C-10 13.4 -13.6 8 -14 1Z";
const INNER = "M-8 1C-8.5 -4.6 -3.5 -8.2 3 -7.8C10 -7.4 16 -8 22.5 -13.4C21.4 -6.4 17.6 -1 11.6 2.8C6.6 6 2 7.6 -1.6 7.4C-5.4 7.1 -7.8 4.4 -8 1Z";
const BUD = leafD(5.2, 1.7);
const TRAIL = [[-17.5, 3], [-16.8, -5], [-12.5, -12.2], [-5.5, -17], [3, -18.6], [11.5, -18.3], [20, -19.2], [28, -23.4]] as const;
const CURL = cr(spiral(33.4, -22.4, 4.6, 1.1, 210, 1.1, 1));
const TAIL = taper(tp(curlPts(46, 6.5, 1, 4, 1.1), 104, 22, 4), [1.8, 2.4, 0.5]);
const TAIL_LEAF = leafD(14, 3.8);
const MEDALLION_LEAF = leafD(6, 1.9);

const sideRules = (e: number, d: number) => [seg(e, d, W - e, d), seg(e, H - d, W - e, H - d), seg(d, e, d, H - e), seg(W - d, e, W - d, H - e)].join("");
/** The outer rule starts at the tail's curl (so the tail flows into it), the inner one just after the curl. */
const RULES = [sideRules(152, 24), sideRules(168, 30)];

export function PaisleyFrame({ palette }: { palette: Palette }) {
  const { line, accent, soft, paper } = ornament(palette);
  const id = useFrameId("pai");
  const half = (
    <>
      <g transform="translate(58 32) rotate(-2) scale(1.05)">
        <path d={PAISLEY} fill={`url(#${id})`} />
        <path d={PAISLEY} {...stroke(line, 1.3)} />
        <path d={INNER} fill={mix(paper, soft, 0.15)} stroke={accent} strokeWidth="0.9" strokeLinejoin="round" />
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <path key={a} d={BUD} fill={accent} transform={at(-0.5, 0.2, a)} />
        ))}
        <circle cx="-0.5" cy="0.2" r="1.4" fill={line} />
        {TRAIL.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 2 ? 0.9 : 1.2} fill={accent} />
        ))}
        <path d={CURL} {...stroke(line, 1)} />
      </g>
      <path d={TAIL} fill={line} />
      <path d={TAIL_LEAF} fill={accent} transform={at(124, 20, -28)} />
    </>
  );
  const corner = (
    <>
      {half}
      <g transform={DIAG}>{half}</g>
      <circle cx="26" cy="26" r="7.5" fill={paper} stroke={line} strokeWidth="1" />
      {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((a) => (
        <path key={a} d={MEDALLION_LEAF} fill={accent} transform={at(26, 26, a)} />
      ))}
      <circle cx="26" cy="26" r="1.8" fill={line} />
    </>
  );
  return (
    <FrameSvg>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={soft} />
          <stop offset="1" stopColor={mix(soft, line, 0.25)} />
        </linearGradient>
      </defs>
      <path d={RULES[0]} {...stroke(line, 1.2)} />
      <path d={RULES[1]} {...stroke(line, 0.55)} />
      {CORNERS.map((t, i) => (
        <g key={i} transform={t}>
          {corner}
        </g>
      ))}
    </FrameSvg>
  );
}
