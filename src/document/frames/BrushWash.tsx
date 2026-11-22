import type { Palette } from "../tokens";
import { bez, cr, H, mix, R, taper, thin, W, type Pt } from "./geometry";
import { SIDE_PANEL_WIDTH } from "./SidePanel";
import { FrameSvg, ornament, useFrameId } from "./svg";

// The brush-wash frame family (Slate Brush, VISION D46, D51): broad soft brush strokes and no border. Our own
// drawing after the mockup library's "brushWash" (docs/mockups/assets/frames.js), refitted to the Modern skeleton:
// one broad vertical stroke is the side panel (photo, name and contact sit on it), a second runs across the top of
// the main column, and a slim echo of it crosses the bottom margin. The mockup's translucent paint becomes solid
// tints of the paper, each stroke's body a linear gradient that thins out towards its dry end, and the bristle
// marks thin tapered strands, all inside the PDF writer's SVG subset (src/pdf/svg-to-pdf.ts).
//
// Keep-outs: the panel's text column ends 26 px inside its 250 px edge, so the dry, darker strands stay at x ≥ 232
// (inside the panel only lighter strands, which only raise the contrast of the text on it); the top stroke stays
// above y 50 and right of x 270, the bottom one below y 1078, outside the main column (56 px margins).

/** A small seeded random generator (mulberry32): the strands are irregular, but the same on every page and run. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A filled outline around a spine whose width follows `width(t)` (t from 0 to 1 along the spine). */
function ribbon(spine: readonly Pt[], width: (t: number) => number): string {
  const pts = thin(spine, 6);
  const n = pts.length;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const hw = width(i / (n - 1)) / 2;
    const nx = (-(b[1] - a[1]) / len) * hw;
    const ny = ((b[0] - a[0]) / len) * hw;
    left.push([pts[i][0] + nx, pts[i][1] + ny]);
    right.push([pts[i][0] - nx, pts[i][1] - ny]);
  }
  return `${cr(left)}L${cr(right.reverse()).slice(1)}Z`;
}

/** Point `t` of the spine moved sideways by `off` px (positive to the spine's left-hand normal). */
function offsetAt(spine: readonly Pt[], i: number, off: number): Pt {
  const a = spine[Math.max(0, i - 1)];
  const b = spine[Math.min(spine.length - 1, i + 1)];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [spine[i][0] - ((b[1] - a[1]) / len) * off, spine[i][1] + ((b[0] - a[0]) / len) * off];
}

/**
 * Bristle strands along a stroke: `count` thin tapered lines, each at a random place across the band `across`
 * (fractions of the half-width, -1 right … 1 left of the spine) from a random start to a random end in `along`.
 */
function strands(spine: readonly Pt[], width: (t: number) => number, seed: number, count: number, across: [number, number], along: [number, number], weight: number): string {
  const r = rng(seed);
  const n = spine.length;
  let d = "";
  for (let k = 0; k < count; k++) {
    const o = across[0] + r() * (across[1] - across[0]);
    const t0 = along[0] + r() * 0.25 * (along[1] - along[0]);
    const t1 = along[1] - r() * 0.3 * (along[1] - along[0]);
    const sub: Pt[] = [];
    for (let i = Math.floor(t0 * (n - 1)); i <= Math.floor(t1 * (n - 1)); i++) sub.push(offsetAt(spine, i, (o * width(i / (n - 1))) / 2));
    // Strands are long and nearly straight: a point every 30 px is plenty for the smooth outline.
    if (sub.length > 4) d += taper(thin(sub, 30), [0.3, weight * (0.6 + r() * 0.8), 0.1]);
  }
  return d;
}

// The panel stroke: down the left edge, a little wider than the panel, its right edge wavering; it narrows and
// dries out over the last tenth of the page.
const PANEL_SPINE = bez([122, -40], [118, 300], [126, 760], [116, H + 30], 90);
const PANEL_W = SIDE_PANEL_WIDTH + 18;
const panelWidth = (t: number) => {
  const wave = 5 * Math.sin(t * 23 + 0.7) + 3 * Math.sin(t * 61 + 2.1);
  const dry = t > 0.86 ? 1 - 0.3 * Math.pow((t - 0.86) / 0.14, 1.4) : 1;
  return (PANEL_W + wave) * dry;
};
const PANEL = ribbon(PANEL_SPINE, panelWidth);
/** Darker dry strands along the panel's right edge, outside its text column (they stop where the stroke narrows). */
const PANEL_EDGE = strands(PANEL_SPINE, panelWidth, 11, 10, [-1.06, -0.87], [0, 0.86], 3.2);
/** Lighter streaks inside the panel: paint thinning where the bristles parted. */
const PANEL_STREAKS = strands(PANEL_SPINE, panelWidth, 12, 7, [-0.86, -0.45], [0.1, 1], 4);

// The top stroke: from beyond the right edge of the page towards the panel, full at the start and dry at the end.
const TOP_SPINE = bez([W + 20, 23], [640, 18], [470, 30], [282, 25], 70);
const topWidth = (t: number) => {
  const base = t < 0.06 ? 0.5 + 0.5 * Math.sin((t / 0.06) * (Math.PI / 2)) : 1 - 0.75 * Math.pow((t - 0.06) / 0.94, 1.6);
  return 46 * base * (1 + 0.05 * Math.sin(t * 19 + 1.3));
};
const TOP = ribbon(TOP_SPINE, topWidth);
const TOP_CORE = ribbon(TOP_SPINE.slice(0, 52), (t) => 14 * (1 - 0.8 * t) * (1 + 0.1 * Math.sin(t * 29)));
const TOP_STRANDS = strands(TOP_SPINE, topWidth, 21, 12, [-0.95, 0.95], [0.1, 1], 1.6);

// The echo in the bottom margin: a slim stroke from the right edge, with two dots of paint where it lifts off.
const BOTTOM_SPINE = bez([W + 16, H - 30], [700, H - 36], [620, H - 26], [540, H - 32], 40);
const bottomWidth = (t: number) => 18 * (1 - 0.82 * Math.pow(t, 1.3)) * (1 + 0.08 * Math.sin(t * 17));
const BOTTOM = ribbon(BOTTOM_SPINE, bottomWidth);
const BOTTOM_STRANDS = strands(BOTTOM_SPINE, bottomWidth, 31, 6, [-0.9, 0.9], [0.15, 1], 1.1);
const DOT = (x: number, y: number, r: number) => `M${R(x - r)} ${R(y)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const DOTS = DOT(524, H - 31, 2.6) + DOT(511, H - 25, 1.5) + DOT(300, 34, 2.4) + DOT(287, 41, 1.4);

export function BrushWashFrame({ palette }: { palette: Palette }) {
  const { accent, paper } = ornament(palette);
  // The thin paint marks take the frame's mid colour (the palette's `rule` is a pale hairline colour here).
  const line = palette.frame[2];
  const side = palette.side ?? palette.inkBase;
  const id = useFrameId("brush");
  return (
    <FrameSvg>
      <defs>
        {/* The panel's paint is fullest at the top and thins towards the bottom. */}
        <linearGradient id={`${id}p`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={H}>
          <stop offset="0" stopColor={side} />
          <stop offset="0.7" stopColor={mix(side, paper, 0.2)} />
          <stop offset="1" stopColor={mix(side, paper, 0.5)} />
        </linearGradient>
        <linearGradient id={`${id}t`} gradientUnits="userSpaceOnUse" x1={W} y1="0" x2="282" y2="0">
          <stop offset="0" stopColor={mix(accent, paper, 0.5)} />
          <stop offset="1" stopColor={mix(accent, paper, 0.84)} />
        </linearGradient>
      </defs>
      <path d={PANEL} fill={`url(#${id}p)`} />
      <path d={PANEL_STREAKS} fill={mix(side, paper, 0.55)} />
      <path d={PANEL_EDGE} fill={mix(side, line, 0.22)} />
      <path d={TOP} fill={`url(#${id}t)`} />
      <path d={TOP_CORE} fill={mix(line, paper, 0.62)} />
      <path d={TOP_STRANDS} fill={mix(line, paper, 0.5)} />
      <path d={BOTTOM} fill={mix(accent, paper, 0.72)} />
      <path d={BOTTOM_STRANDS} fill={mix(line, paper, 0.55)} />
      <path d={DOTS} fill={mix(line, paper, 0.45)} />
    </FrameSvg>
  );
}
