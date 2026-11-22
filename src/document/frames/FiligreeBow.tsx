import type { Palette } from "../tokens";
import { CORNERS, curlPts, darken, lighten, mix, MX, taper, tp, W } from "./geometry";
import { FiligreeCorner, sideRules, type FiligreeOptions } from "./Filigree";
import { PaperWash, washAt } from "./paper-wash";
import { FrameSvg, Metal, ornament, stroke, useFrameId } from "./svg";

// The filigree-with-bow frame family (Peach Filigree, VISION D46, D51): the filigree corner (frames/Filigree) drawn
// small and light with an outlined fleur, a fine double rule, and a ribbon bow with two tails at the top centre
// flanked by curling swirls, on a soft paper wash. Our own drawing, ported from the mockup library (docs/mockups/
// assets/frames.js, "filigreeBow"); the bow's translucent shading became solid mixes. Scrolls are a metal gradient
// of `rule`; the ribbon a vertical gradient of `accent`.
//
// Each corner stays within 170 px along the edges and 39 px in from them (49 px along the diagonal); the rules sit at
// 18.7 and 24 px; the bow hangs 55 px from the top edge within 37 px of the centre line, the swirls within 64 px
// of it on each side and 30 px of the top.

const OPTIONS: FiligreeOptions = { k: 0.85, w: 0.75, leaves: false, outline: true };

const CY = 22;
const TAIL = "M-3 3C-10 14 -18 24 -30 34L-24 35.5L-21 41C-11 30 -3 18 3 6Z";
const LOOP = "M0 0C-10 -16 -38 -22 -46 -12C-52 -4 -46 10 -30 10C-18 10 -8 5 0 0Z";
const LOOP_IN = "M-4 -1C-14 -10 -32 -14 -38 -8C-42 -3 -38 4 -28 4C-18 4 -10 2 -4 -1Z";
const SHEEN = "M-6 -2C-18 -6 -30 -8 -40 -6";
const SWIRL = taper(tp(curlPts(30, 5, 1, -3, 1.1), W / 2 + 42, CY, 0), [0.4, 1.8, 0.4]);

export function FiligreeBowFrame({ palette }: { palette: Palette }) {
  const { line, accent, dark } = ornament(palette);
  const metalId = useFrameId("fbm");
  const ribbonId = useFrameId("fbr");
  const ribbon = `url(#${ribbonId})`;
  const knot = darken(accent, 0.12);
  // The mockup's 35 % dark shadow inside each loop and 80 % light sheen, as solids over the ribbon.
  const shadow = mix(accent, darken(accent, 0.25), 0.6);
  const sheen = mix(accent, lighten(accent, 0.5), 0.8);
  const loop = (
    <>
      <path d={LOOP} fill={ribbon} />
      <path d={LOOP_IN} fill={shadow} />
      <path d={SHEEN} {...stroke(sheen, 0.8)} />
    </>
  );
  const swirl = (
    <>
      <path d={SWIRL} fill={`url(#${metalId})`} />
      <circle cx={W / 2 + 80} cy={CY - 1} r="1.2" fill={line} />
    </>
  );
  return (
    <FrameSvg>
      <PaperWash palette={palette} />
      <defs>
        <Metal id={metalId} color={line} dark={dark} />
        <linearGradient id={ribbonId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lighten(accent, dark ? 0.15 : 0.25)} />
          <stop offset="1" stopColor={darken(accent, 0.12)} />
        </linearGradient>
      </defs>
      <path d={sideRules(166, 18.7)} {...stroke(line, 0.9)} />
      <path d={sideRules(166, 24)} {...stroke(line, 0.45)} />
      {CORNERS.map((t, i) => (
        <g key={i} transform={t}>
          <FiligreeCorner o={OPTIONS} fill={`url(#${metalId})`} line={line} accent={accent} />
        </g>
      ))}
      <rect x={W / 2 - 74} y={CY - 8} width="148" height="16" fill={washAt(palette, CY)} />
      <g transform={`translate(${W / 2} ${CY}) scale(0.8)`}>
        <path d={TAIL} fill={ribbon} />
        <path d={TAIL} fill={ribbon} transform="scale(-1 1)" />
        {loop}
        <g transform="scale(-1 1)">{loop}</g>
        <rect x="-7" y="-7.5" width="14" height="15" rx="4" fill={knot} />
        <path d="M-3 -5Q0 0 -3 5M3 -5Q0 0 3 5" {...stroke(mix(accent, lighten(accent, 0.35), 0.8), 0.8)} />
      </g>
      {swirl}
      <g transform={MX}>{swirl}</g>
    </FrameSvg>
  );
}

