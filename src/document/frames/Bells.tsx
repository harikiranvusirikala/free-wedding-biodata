import type { Palette } from "../tokens";
import { darken, lighten, mix, MX, R, W } from "./geometry";
import { FrameSvg, Metal, ornament, stroke, useFrameId } from "./svg";

// The temple bells frame family (Temple Bells, VISION D39, D46): bells and diyas hanging from beaded swags along
// the top, a larger bell at each top corner above fine side rules, and a temple band of stepped shikharas along the
// bottom. Our own drawing, ported from the mockup library (docs/mockups/assets/frames.js, "bells") and tidied:
// opacities replaced by solid tints, one path per repeated pattern. Metal parts use a sideways gradient of `rule`;
// beads, flames and band drops use `accent`; the band backing is `soft` mixed into the paper.
//
// Extents: the top row hangs to y ≈ 55, the corner bells to y ≈ 112 at x 16–44, the side rules sit at x 30/36 and
// the band starts at y 1074. Temple Bells' margins (76 top, 62 sides, 70 bottom) keep the text clear.

const TOP = 18;
const XS = Array.from({ length: 11 }, (_, i) => R(72 + (i * (W - 144)) / 10));
const MIDS = XS.slice(1).map((x, i) => R((XS[i] + x) / 2));
const SWAGS =
  XS.slice(1)
    .map((x, i) => `M${XS[i]} ${TOP}Q${MIDS[i]} ${TOP + 15} ${x} ${TOP}`)
    .join("") + `M30 ${TOP}Q51 ${TOP + 12} 72 ${TOP}M${W - 30} ${TOP}Q${W - 51} ${TOP + 12} ${W - 72} ${TOP}`;

// The bottom temple band: stepped shikharas with a finial each, and drops hanging from the band's top rule.
const BAND = { y0: 1080, y1: 1101, x0: 30, x1: W - 30 };
const UNITS = 34;
const UNIT = (BAND.x1 - BAND.x0) / UNITS;
const SHIKHARAS = Array.from({ length: UNITS }, (_, i) => {
  const cx = R(BAND.x0 + UNIT * (i + 0.5));
  const b = BAND.y1 - 1.5;
  return `M${R(cx - 8)} ${b}v-3.2h2v-3.2h2v-3.2h2v-3.2h4v3.2h2v3.2h2v3.2h2v3.2ZM${R(cx - 1.6)} ${R(b - 16.4)}a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0Z`;
}).join("");
const DROPS = Array.from({ length: UNITS - 1 }, (_, i) => {
  const x = BAND.x0 + UNIT * (i + 1);
  return `M${R(x - 2.6)} ${BAND.y0 + 0.6}L${R(x)} ${BAND.y0 + 5.2}L${R(x + 2.6)} ${BAND.y0 + 0.6}Z`;
}).join("");

const DOTTED = "0.1 2.2";

function Bell({ x, y, s, metal, line, hi }: { x: number; y: number; s: number; metal: string; line: string; hi: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cy="2.4" r="2.1" {...stroke(line, 1.1)} />
      <path d="M-2.2 4.4h4.4v3.4h-4.4zM-5 9.6C-5 6.6 5 6.6 5 9.6Z" fill={line} />
      <path d="M-5 9.4C-6.6 13 -6.4 19.5 -9.6 24.6C-10.6 26 -11 27 -11 28L11 28C11 27 10.6 26 9.6 24.6C6.4 19.5 6.6 13 5 9.4Z" fill={metal} />
      <path d="M-6.1 15.2H6.1M-7.9 21.6H7.9" {...stroke(hi, 0.9)} />
      <rect x="-12" y="27.4" width="24" height="2.8" rx="1.4" fill={line} />
      <path d="M0 30.2V31.6" {...stroke(line, 1)} />
      <circle cy="33.4" r="2.1" fill={line} />
    </g>
  );
}

function Lamp({ x, metal, line, flame, core }: { x: number; metal: string; line: string; flame: string; core: string }) {
  return (
    <g transform={`translate(${x} ${TOP})`}>
      <path d="M0 0L-10 21M0 0L10 21M0 0V5" {...stroke(line, 0.9)} strokeDasharray={DOTTED} />
      <circle cy="0.6" r="1.4" fill={line} />
      <path d="M0 9C3.4 13 3.6 17.4 0 20C-3.6 17.4 -3.4 13 0 9Z" fill={flame} />
      <path d="M0 13.2C1.5 15.2 1.6 17.4 0 18.6C-1.6 17.4 -1.5 15.2 0 13.2Z" fill={core} />
      <path d="M-13 21C-12 29.5 12 29.5 13 21Z" fill={metal} />
      <path d="M-13.6 20.6H13.6" {...stroke(line, 1.3)} />
      <path d="M-2 28.4L0 34L2 28.4Z" fill={line} />
      <circle cy="34.6" r="1.2" fill={line} />
    </g>
  );
}

export function BellsFrame({ palette }: { palette: Palette }) {
  const { line, accent, soft, paper, dark } = ornament(palette);
  const id = useFrameId("bel");
  const metal = `url(#${id})`;
  const hi = dark ? darken(line, 0.45) : lighten(line, 0.55);
  const core = lighten(accent, dark ? 0.55 : 0.6);
  const parts = { metal, line, hi };
  const side = (
    <>
      <path d={`M30 ${TOP}V72`} {...stroke(line, 1)} strokeDasharray={DOTTED} />
      <circle cx="30" cy={TOP} r="2.2" fill={line} />
      <circle cx="30" cy="46" r="1.8" fill={accent} />
      <Bell x={30} y={71} s={1.15} {...parts} />
      <path d="M30 128V1074" {...stroke(line, 1.1)} />
      <path d="M36 132V1074" {...stroke(line, 0.5)} />
      <circle cx="30" cy="122" r="1.8" fill={line} />
      <circle cx="36" cy="127" r="1.1" fill={line} />
      <path d={`M${BAND.x0 - 6} ${BAND.y0 - 2}h6v${BAND.y1 - BAND.y0 + 4}h-6z`} fill={line} />
      <circle cx={BAND.x0 - 3} cy="1090.5" r="1.3" fill={paper} />
    </>
  );
  return (
    <FrameSvg>
      <defs>
        <Metal id={id} color={line} dark={dark} />
      </defs>
      <path d={`M22 13H${W - 22}`} {...stroke(line, 1.3)} />
      <path d={`M22 17.5H${W - 22}`} {...stroke(line, 0.55)} />
      <path d={SWAGS} {...stroke(line, 0.8)} />
      {MIDS.map((m) => (
        <g key={m}>
          <circle cx={m} cy={TOP + 7.6} r="1.7" fill={accent} />
          <circle cx={R(m - 9)} cy={TOP + 6.2} r="1" fill={line} />
          <circle cx={R(m + 9)} cy={TOP + 6.2} r="1" fill={line} />
        </g>
      ))}
      {XS.map((x, i) => (
        <g key={x}>
          <circle cx={x} cy={TOP} r="1.8" fill={line} />
          {i % 2 === 0 ? (
            <>
              <path d={`M${x} ${TOP}V${TOP + 5}`} {...stroke(line, 0.9)} strokeDasharray={DOTTED} />
              <Bell x={x} y={TOP + 4.5} s={0.8} {...parts} />
            </>
          ) : (
            <Lamp x={x} metal={metal} line={line} flame={accent} core={core} />
          )}
        </g>
      ))}
      {side}
      <g transform={MX}>{side}</g>
      <rect x={BAND.x0} y={BAND.y0} width={BAND.x1 - BAND.x0} height={BAND.y1 - BAND.y0} fill={mix(paper, soft, 0.75)} />
      <path d={`M${BAND.x0} 1074H${BAND.x1}M${BAND.x0} ${BAND.y1 + 4.5}H${BAND.x1}`} {...stroke(line, 0.5)} />
      <path d={`M${BAND.x0} ${BAND.y0}H${BAND.x1}M${BAND.x0} ${BAND.y1}H${BAND.x1}`} {...stroke(line, 1.1)} />
      <path d={SHIKHARAS} fill={line} />
      <path d={DROPS} fill={accent} />
    </FrameSvg>
  );
}
