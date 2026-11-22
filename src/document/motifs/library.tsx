import type { ReactNode } from "react";
import { arc, arcSegs, blob, brush, circleC, circlePath, crescent, drop, mirror, points, pt, r2, spline, starPoints, xf, type Pt } from "./geometry";
import { ALLAH_PATH, IK_ONKAR_PATH } from "./glyphs";

// The motif drawings (VISION §7 D21, D45, D47): our own original artwork, never traced from anyone else's. Redrawn
// on 2026-11-22 as single-colour wedding-card artwork: calligraphic brush strokes that swell and taper (geometry.ts
// `brush`), airy silhouettes with no pale disc behind them (the Allah medallion is a deliberate medallion), and one
// smooth vertical gradient. Each is drawn on a 120 × 120 box in the template's colours: `g` is the ink gradient that
// fills the main shapes, `cut` the paper colour that cuts details out of them (so a cut reads as a hole on the page),
// `base` the pale tint, `lite` the gradient's light end and `ink` the plain ink.
//
// Only the SVG the PDF writer draws (src/pdf/svg-to-pdf.ts): paths, circles, rects, polygons, strokes and linear
// gradients. No text (D47 (4): Ik Onkar and Allah are font outlines in ./glyphs.ts), no masks (the crescent and the
// interlocking rings are built from arcs), no paint-order (Keyed draws the keyline first), and no transforms on
// gradient-filled shapes (paths are turned with xf, so the gradient stays vertical).

export interface Ink {
  g: string;
  base: string;
  cut: string;
  lite: string;
  ink: string;
}

/** A filled shape with a paper-coloured keyline round it, parting it from the shapes it overlaps (PDF-safe). */
function Keyed({ d, fill, cut, width }: { d: string; fill: string; cut: string; width: number }) {
  return (
    <>
      <path d={d} fill="none" stroke={cut} strokeWidth={width} strokeLinejoin="round" />
      <path d={d} fill={fill} />
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Hindu

const sp = spline;

/** Computes a drawing's paths once, the first time it is drawn (they don't depend on the colours). */
function once<T>(make: () => T): () => T {
  let value: T | undefined;
  return () => (value ??= make());
}

/** A bell-shaped pressure curve peaking at `at` (0…1), never below `floor`. */
const bell = (at: number, spread: number, floor = 0.35) => (s: number) => floor + (1 - floor) * Math.exp(-(((s - at) / spread) ** 2));

const OM = once(() => {
  // Drawn at 1 : 1 round (62, 51), then enlarged into the box.
  const S = 1.2;
  const at = (pts: Pt[]) => sp(pts.map(([x, y]) => [60 + (x - 62) * S, 61 + (y - 51) * S] as Pt));
  const strokes = [
    brush(at([[33, 43.5], [39, 38.6], [47, 38], [52.6, 42], [52.2, 49], [46.5, 53.4], [40.5, 54.6]]), { w: 8.8 * S, press: bell(0.55, 0.3, 0.3), in: 0.12, out: 0.12, tip0: 0.3, tip1: 0.4 }),
    brush(at([[40.5, 54.6], [50, 55.2], [57, 60.5], [59, 69.5], [55, 78], [47, 82.5], [38.5, 81.5], [32.6, 76], [31.6, 70.4]]), { w: 10 * S, press: bell(0.36, 0.3, 0.25), in: 0.06, out: 0.25, tip0: 0.5 }),
    brush(at([[51, 57], [57, 57.8], [64, 56.4], [70.5, 51.5], [77, 48], [83.5, 48.8], [88, 54.5], [88.8, 62.5], [86.2, 70.5], [88.8, 77], [93.5, 78.6]]), { w: 8.4 * S, press: bell(0.62, 0.36, 0.45), in: 0.2, out: 0.18 }),
    brush(at([[63, 32.5], [69.5, 38], [78, 39.4], [86, 35.6], [90.5, 29.6]]), { w: 5.4 * S, in: 0.45, out: 0.45 }),
  ];
  const dot = at([[76.6, 19.2], [80.6, 22.4], [79.8, 26.8], [75.6, 28], [72.4, 24.6]]).map((c) => c[0]);
  return [...strokes, blob(dot)];
});

/** Om (ॐ) in brush strokes: the two bowls, the tail sweeping right, the crescent and the dot. */
export function Om({ g }: Ink) {
  return (
    <>
      {OM().map((d, i) => (
        <path key={i} d={d} fill={g} />
      ))}
    </>
  );
}

const KALASH_LEAF = sp([[60, 52], [58, 40.5], [61, 29], [68.5, 19.5]]);

const KALASH = once(() => ({
  leaf: brush(KALASH_LEAF, { w: 11, in: 0.3, out: 0.65, tip0: 0.2 }),
  vein: brush(sp([[60, 48.5], [58.6, 40.5], [61, 30.5], [65.6, 24]]), { w: 1.1, in: 0.2, out: 0.5 }),
  tuft: brush(sp([[60, 22.5], [60.4, 17.5], [59.2, 12.5]]), { w: 2.4, in: 0.2, out: 0.7, tip0: 0.6 }),
}));

/** Kalash: a round pot on a foot, five mango leaves fanned from its mouth and a coconut with a tuft. */
export function Kalash({ g, cut }: Ink) {
  const { leaf, vein, tuft } = KALASH();
  return (
    <>
      {[-74, -40, 40, 74].map((a) => (
        <g key={a}>
          <path d={xf(a < 0 ? mirror(leaf) : leaf, a < 0 ? a + 8 : a - 8, 60, 54)} fill={g} />
          <path d={xf(a < 0 ? mirror(vein) : vein, a < 0 ? a + 8 : a - 8, 60, 54)} fill={cut} />
        </g>
      ))}
      <Keyed d="M60 21.5 C65.5 26.5 72 31.5 72 40.5 C72 48 66.6 52.6 60 52.6 C53.4 52.6 48 48 48 40.5 C48 31.5 54.5 26.5 60 21.5 Z" fill={g} cut={cut} width={2.6} />
      <path d="M60 25.5 C56.4 31 54.6 38 55.6 49 M60 25.5 C63.6 31 65.4 38 64.4 49" fill="none" stroke={cut} strokeWidth="0.9" strokeLinecap="round" />
      {[-26, 0, 26].map((a) => (
        <path key={a} d={xf(tuft, a, 60, 22.5)} fill={g} />
      ))}
      <Keyed d="M51 60.5 C45 64.5 33 70 33 84 C33 97 44.5 104.5 60 104.5 C75.5 104.5 87 97 87 84 C87 70 75 64.5 69 60.5 Z" fill={g} cut={cut} width={2.6} />
      <Keyed d="M51.5 57 H68.5 L70 62 H50 Z" fill={g} cut={cut} width={2.2} />
      <Keyed d="M45.5 51.5 H74.5 A3.2 3.2 0 0 1 74.5 57.9 H45.5 A3.2 3.2 0 0 1 45.5 51.5 Z" fill={g} cut={cut} width={2.6} />
      <Keyed d="M51 103 L47.5 110.5 H72.5 L69 103 Z" fill={g} cut={cut} width={2.2} />
      <path d="M36.4 75.5 Q60 84 83.6 75.5 M35.2 91.5 Q60 100 84.8 91.5" fill="none" stroke={cut} strokeWidth="1.3" strokeLinecap="round" />
      {[-21, -10.5, 0, 10.5, 21].map((x) => (
        <path key={x} d={drop(60 + x, 85.5 - Math.abs(x) * 0.09, Math.abs(x) > 15 ? 1.4 : 1.8, 60 + x, 80.5 - Math.abs(x) * 0.09)} fill={cut} />
      ))}
    </>
  );
}

/** Swastika (the Hindu sathiya: upright, arms turning clockwise) with the four dots. */
export function Swastika({ g }: Ink) {
  // Each piece is a rectangle of the same winding, so overlaps simply join (non-zero fill).
  const R = 35;
  const H = 27;
  const w = 4.2;
  const rect = (x0: number, y0: number, x1: number, y1: number) => `M${x0} ${y0} L${x1} ${y0} L${x1} ${y1} L${x0} ${y1} Z`;
  const up = [rect(60 - w, 60 - R, 60 + w, 60 + R), rect(60 - R, 60 - w, 60 + R, 60 + w), rect(60 - w, 60 - R, 60 + H, 60 - R + 2 * w)];
  const hook = up[2];
  return (
    <>
      <path d={`${up[0]} ${up[1]}`} fill={g} />
      {[0, 90, 180, 270].map((a) => (
        <path key={a} d={xf(hook, a, 60, 60)} fill={g} />
      ))}
      {[
        [43, 43],
        [77, 43],
        [43, 77],
        [77, 77],
      ].map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r="4.8" fill={g} />
      ))}
    </>
  );
}

const PETAL = "M60 17 C69.5 29 76 45 72.4 63 C70.6 72 65.6 79 60 84 C54.4 79 49.4 72 47.6 63 C44 45 50.5 29 60 17 Z";

const LOTUS = once(() => ({
  vein: brush(sp([[60, 28], [60.5, 52], [60, 77]]), { w: 1.5, in: 0.3, out: 0.3 }),
  sideVein: brush(sp([[60, 38], [60.4, 58], [60, 76]]), { w: 1.2, in: 0.3, out: 0.3 }),
  calyx: brush(sp([[31, 83], [45, 90.5], [60, 92.4], [75, 90.5], [89, 83]]), { w: 5.6, in: 0.4, out: 0.4 }),
  ripples: [brush(sp([[38, 99], [60, 96.8], [82, 99]]), { w: 2.8, in: 0.45, out: 0.45 }), brush(sp([[47, 105], [60, 103.6], [73, 105]]), { w: 2.2, in: 0.45, out: 0.45 })],
}));

/** Lotus: a broad pointed centre petal, two filled and two light outer petals on a calyx, over ripples. */
export function Lotus({ g, cut, lite }: Ink) {
  const { vein, sideVein, calyx, ripples } = LOTUS();
  return (
    <>
      {[-62, 62].map((a) => (
        <Keyed key={a} d={xf(PETAL, a, 60, 86, 0.76)} fill={lite} cut={cut} width={2.6} />
      ))}
      {[-32, 32].map((a) => (
        <Keyed key={a} d={xf(PETAL, a, 60, 86, 0.9)} fill={g} cut={cut} width={2.8} />
      ))}
      <Keyed d={PETAL} fill={g} cut={cut} width={2.8} />
      <path d={vein} fill={cut} />
      {[-32, 32].map((a) => (
        <path key={a} d={xf(sideVein, a, 60, 86, 0.9)} fill={cut} />
      ))}
      <Keyed d={calyx} fill={g} cut={cut} width={2.4} />
      {ripples.map((d) => (
        <path key={d.length} d={d} fill={g} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Muslim

/** Crescent and star: a slender crescent with sharp horns and a five-pointed star with slightly drawn-in sides. */
export function CrescentStar({ g }: Ink) {
  return (
    <>
      <path d={crescent(54, 62, 40, 68, 52.5, 35.5)} fill={g} />
      <polygon points={starPoints(80, 47, 13.5, 5.6, 5, 14)} fill={g} stroke={g} strokeWidth="0.8" strokeLinejoin="round" />
    </>
  );
}

/** The outline of an eight-pointed star (two squares of half-side `a`, one turned 45°). */
function eightPoint(cx: number, cy: number, a: number): Pt[] {
  const out: Pt[] = [];
  const inner = a / Math.cos(Math.PI / 8);
  for (let k = 0; k < 16; k++) out.push(pt(cx, cy, k % 2 ? inner : a * Math.SQRT2, -90 + k * 22.5));
  return out;
}

/** Allah (الله, an Amiri outline) inside a fine double eight-pointed star, with a dot at each point. */
export function Allah({ g }: Ink) {
  const tips = Array.from({ length: 8 }, (_, k) => pt(60, 60, 57, -90 + k * 45));
  return (
    <>
      <polygon points={points(eightPoint(60, 60, 37.5))} fill="none" stroke={g} strokeWidth="2.4" strokeLinejoin="miter" />
      <polygon points={points(eightPoint(60, 60, 33.6))} fill="none" stroke={g} strokeWidth="1" strokeLinejoin="miter" />
      {tips.map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r="1.7" fill={g} />
      ))}
      <path d={xf(ALLAH_PATH, 0, 60, 60, 0.8)} fill={g} />
    </>
  );
}

/** A medallion (shamsa): a sun disc with a ring of rays, a fine inner ring, and Allah cut out of it. */
export function AllahMedallion({ g, cut }: Ink) {
  const rays = Array.from({ length: 24 }, (_, k) => {
    const a = k * 15;
    const long = k % 2 === 0;
    return `M${pt(60, 60, 43, a - 4.2).join(" ")} L${pt(60, 60, long ? 56 : 51.5, a).join(" ")} L${pt(60, 60, 43, a + 4.2).join(" ")} Z`;
  }).join(" ");
  return (
    <>
      <path d={rays} fill={g} />
      <circle cx="60" cy="60" r="45" fill={g} />
      <circle cx="60" cy="60" r="40.6" fill="none" stroke={cut} strokeWidth="1.3" />
      <path d={xf(ALLAH_PATH, 0, 60, 60, 0.84)} fill={cut} />
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Christian

/** One arm of a cross pointing up from (60, cy), `len` long, `h` half wide, ending in `end` (drawn at the tip). */
function crossArm(cy: number, len: number, h: number, end: (tipY: number) => string): string {
  return `M${60 - h} ${cy} L${60 - h} ${r2(cy - len + 10)} L${60 + h} ${r2(cy - len + 10)} L${60 + h} ${cy} Z ${end(cy - len)}`;
}

/** The angles and lengths of a Latin cross's arms round its crossing at (60, 40). */
const CROSS_ARMS = [
  [0, 28],
  [90, 30],
  [180, 68],
  [270, 30],
] as const;

/** A Latin cross with slender beams flaring into pointed tips, and an engraved line down each arm. */
export function Cross({ g, cut }: Ink) {
  const h = 3.7;
  const flare = (t: number) => `M${60 - h} ${t + 11} C${60 - h} ${t + 5} ${60 - 6.6} ${t + 4.4} ${60 - 6.6} ${t + 1.4} L60 ${t - 2.6} L${60 + 6.6} ${t + 1.4} C${60 + 6.6} ${t + 4.4} ${60 + h} ${t + 5} ${60 + h} ${t + 11} Z`;
  return (
    <>
      {CROSS_ARMS.map(([a, len]) => (
        <path key={a} d={xf(crossArm(40, len, h, flare), a, 60, 40)} fill={g} />
      ))}
      {CROSS_ARMS.map(([a, len]) => (
        <path key={a} d={xf(`M60 ${40 - 6.5} L60 ${40 - len + 9}`, a, 60, 40)} stroke={cut} strokeWidth="1" strokeLinecap="round" />
      ))}
      <path d="M60 36.6 L63.4 40 L60 43.4 L56.6 40 Z" fill={cut} />
    </>
  );
}

/** A budded cross: each arm ends in three buds (the trefoil of the Apostles' cross). */
export function CrossBudded({ g, cut }: Ink) {
  const h = 3.5;
  const arms = [
    [0, 26],
    [90, 28],
    [180, 62],
    [270, 28],
  ] as const;
  const buds = (t: number) =>
    `${circleC(60, t + 1, 5.2)} ${circleC(60 - 5.6, t + 7.2, 4.1)} ${circleC(60 + 5.6, t + 7.2, 4.1)}`;
  return (
    <>
      {arms.map(([a, len]) => (
        <path key={a} d={xf(crossArm(42, len, h, buds), a, 60, 42)} fill={g} />
      ))}
      {arms.map(([a, len]) => (
        <circle key={a} cx={pt(60, 42, len - 1, a - 90)[0]} cy={pt(60, 42, len - 1, a - 90)[1]} r="1.5" fill={cut} />
      ))}
      <path d="M60 38.4 L63.6 42 L60 45.6 L56.4 42 Z" fill={cut} />
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Sikh

/** Ik Onkar (ੴ, a Noto Serif Gurmukhi outline), on its own. */
export function IkOnkar({ g }: Ink) {
  return <path d={xf(IK_ONKAR_PATH, 0, 60, 60, 1.12)} fill={g} />;
}

const KIRPAN = brush(sp([[46, 93], [31, 90], [21.5, 79], [19.5, 64], [20, 51], [16.5, 37]]), { w: 9.5, in: 0.04, out: 0.85, tip0: 0.9 });

/** One kirpan's hilt: a guard across the blade root, a grip crossing under the centre and a round pommel. */
function Hilt({ g, cut, side }: { g: string; cut: string; side: 1 | -1 }) {
  const x = (v: number) => (side === 1 ? v : r2(120 - v));
  const grip = `M${x(48)} 94 L${x(69)} 106.4`;
  const guard = `M${x(44.4)} 87.6 L${x(47.8)} 98.6`;
  return (
    <>
      <path d={grip} stroke={cut} strokeWidth="6.4" strokeLinecap="round" />
      <path d={grip} stroke={g} strokeWidth="3.8" strokeLinecap="round" />
      <circle cx={x(71.2)} cy="107.6" r="4" fill={cut} />
      <circle cx={x(71.2)} cy="107.6" r="2.8" fill={g} />
      <path d={guard} stroke={g} strokeWidth="3.2" strokeLinecap="round" />
    </>
  );
}

/**
 * The Khanda: the double-edged khanda in the centre, the chakkar around it and two kirpans.
 * COMMUNITY REVIEW (VISION D47 (3), BUILD_PLAN Step 6.3): to be checked by members of the Sikh community before
 * launch; an owner check. Change nothing here on taste alone.
 */
export function Khanda({ g, cut }: Ink) {
  return (
    <>
      <path d={KIRPAN} fill={g} />
      <path d={mirror(KIRPAN)} fill={g} />
      <Hilt g={g} cut={cut} side={1} />
      <Hilt g={g} cut={cut} side={-1} />
      <path d={`${circlePath(60, 58, 27)} ${circlePath(60, 58, 20.5)}`} fill={g} fillRule="evenodd" />
      <Keyed d="M60 8 C63.6 14 66.6 21.5 66.4 30 L65.4 77 H54.6 L53.6 30 C53.4 21.5 56.4 14 60 8 Z" fill={g} cut={cut} width={3.2} />
      <path d="M60 15.5 L60 74" stroke={cut} strokeWidth="1.1" strokeLinecap="round" />
      <Keyed d="M51.6 76.4 H68.4 A2.6 2.6 0 0 1 68.4 81.6 H51.6 A2.6 2.6 0 0 1 51.6 76.4 Z" fill={g} cut={cut} width={2.4} />
      <Keyed d="M58.2 81.6 H61.8 L62.6 92 H57.4 Z" fill={g} cut={cut} width={2} />
      <Keyed d={circlePath(60, 95.6, 3.6)} fill={g} cut={cut} width={2} />
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Jain

/**
 * The Jain symbol: the outline of the universe (loka), the crescent and dot (siddhashila), three dots (the three
 * jewels), the swastika and the raised hand (ahimsa) with the wheel.
 * COMMUNITY REVIEW (VISION D47 (3), BUILD_PLAN Step 6.3): to be checked by members of the Jain community before
 * launch; an owner check. Change nothing here on taste alone.
 */
export function Jain({ g, cut }: Ink) {
  const spokes = Array.from({ length: 12 }, (_, k) => `M60 93.5 L${pt(60, 93.5, 5.4, k * 30).join(" ")}`).join(" ");
  const fingers = [
    [50.6, 75.4],
    [55.3, 71.8],
    [60, 71],
    [64.7, 73.6],
  ] as const;
  return (
    <>
      <path d="M51.5 8.5 H68.5 L87 37 L68.5 60 L94 111 H26 L51.5 60 L33 37 Z" fill="none" stroke={g} strokeWidth="2.8" strokeLinejoin="round" />
      <circle cx="60" cy="15" r="2" fill={g} />
      <path d="M51.5 19 Q60 28 68.5 19 Q60 24 51.5 19 Z" fill={g} stroke={g} strokeWidth="0.8" strokeLinejoin="round" />
      <circle cx="53" cy="31" r="2" fill={g} />
      <circle cx="60" cy="31" r="2" fill={g} />
      <circle cx="67" cy="31" r="2" fill={g} />
      <path d="M60 39 V53 M53 46 H67 M60 39 H66 M67 46 V52 M60 53 H54 M53 46 V40" fill="none" stroke={g} strokeWidth="2.3" strokeLinecap="square" />
      {fingers.map(([x, y]) => (
        <rect key={x} x={r2(x - 2.25)} y={y} width="4.5" height={r2(91 - y)} rx="2.25" fill={g} stroke={cut} strokeWidth="0.8" />
      ))}
      <path d="M50 87 L50 98.5 C50 104 54 106.5 60 106.5 C66 106.5 70 104 70 98.5 L70 87 Z" fill={g} />
      <path d="M50.5 98.5 C47 95.5 44 90 43.5 86 C43.2 84 45.6 83.2 46.8 84.9 C48.6 87.5 49.8 89.5 51 91 Z" fill={g} stroke={cut} strokeWidth="0.8" strokeLinejoin="round" />
      <circle cx="60" cy="93.5" r="6" fill="none" stroke={cut} strokeWidth="1.2" />
      <path d={spokes} stroke={cut} strokeWidth="0.7" />
      <circle cx="60" cy="93.5" r="1.4" fill={cut} />
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Buddhist

/** A point `r` out along angle `a` (degrees) from the centre, moved `hw` sideways. */
function radial(r: number, hw: number, a: number): string {
  const t = (a * Math.PI) / 180;
  const d = [Math.cos(t), Math.sin(t)];
  const p = [-d[1], d[0]];
  return `${r2(60 + d[0] * r + p[0] * hw)} ${r2(60 + d[1] * r + p[1] * hw)}`;
}

const EIGHT = Array.from({ length: 8 }, (_, k) => k * 45 - 90);

/** The Dharma wheel, light: a fine double rim, eight slender spokes with a bead, a lotus hub and dots outside. */
export function DharmaWheel({ g, cut }: Ink) {
  const spokes = EIGHT.map((a) => `M${radial(12, -1.4, a)} L${radial(23, -2.6, a)} L${radial(36, -0.8, a)} L${radial(36, 0.8, a)} L${radial(23, 2.6, a)} L${radial(12, 1.4, a)} Z`).join(" ");
  const petals = EIGHT.map((a) => xf("M60 60 C62.6 56 62.6 52.4 60 49 C57.4 52.4 57.4 56 60 60 Z", a + 90 + 22.5, 60, 60)).join(" ");
  return (
    <>
      <circle cx="60" cy="60" r="41.5" fill="none" stroke={g} strokeWidth="3.4" />
      <circle cx="60" cy="60" r="35.6" fill="none" stroke={g} strokeWidth="1.3" />
      <path d={spokes} fill={g} />
      {EIGHT.map((a) => {
        const [x, y] = pt(60, 60, 49, a + 22.5);
        const [sx, sy] = pt(60, 60, 47.6, a);
        return (
          <g key={a}>
            <circle cx={x} cy={y} r="1.7" fill={g} />
            <path d={drop(sx, sy, 2.4, pt(60, 60, 54.5, a)[0], pt(60, 60, 54.5, a)[1])} fill={g} />
          </g>
        );
      })}
      <path d={petals} fill={g} />
      <circle cx="60" cy="60" r="4.6" fill={g} />
      <circle cx="60" cy="60" r="2.4" fill="none" stroke={cut} strokeWidth="0.9" />
    </>
  );
}

/** The Dharma wheel, solid: a broad rim, eight flared spokes, a hub with a cut ring and eight spear-tip finials. */
export function DharmaWheelSolid({ g, cut }: Ink) {
  let spokes = "";
  let tips = "";
  for (const a of EIGHT) {
    spokes += `M${radial(10, -1.9, a)} Q${radial(22, -5.4, a)} ${radial(35, -1.6, a)} L${radial(35, 1.6, a)} Q${radial(22, 5.4, a)} ${radial(10, 1.9, a)} Z `;
    tips += `M${radial(42, -4.6, a)} Q${radial(47, -4.4, a)} ${radial(53, 0, a)} Q${radial(47, 4.4, a)} ${radial(42, 4.6, a)} Z `;
  }
  return (
    <>
      <path d={tips} fill={g} />
      <path d={spokes} fill={g} />
      <path d={`${circlePath(60, 60, 44)} ${circlePath(60, 60, 33.5)}`} fill={g} fillRule="evenodd" />
      <circle cx="60" cy="60" r="38.8" fill="none" stroke={cut} strokeWidth="1.1" />
      <circle cx="60" cy="60" r="12.5" fill={g} />
      <circle cx="60" cy="60" r="8.2" fill="none" stroke={cut} strokeWidth="1.4" />
      <circle cx="60" cy="60" r="2.8" fill={cut} />
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Not religious

const FLORAL_ROUND = "M60 47 C68 41 71 30 66 22.5 C64 19.5 62 19.5 60 22 C58 19.5 56 19.5 54 22.5 C49 30 52 41 60 47 Z";

const FLORAL = once(() => {
  const edge = brush(sp([pt(60, 60, 17, -104), pt(60, 60, 33, -106.5), pt(60, 60, 46, -98), pt(60, 60, 54, -90)]), { w: 2.8, in: 0.25, out: 0.4 });
  return { edges: EIGHT.map((a) => `${xf(edge, a + 112.5, 60, 60)} ${xf(mirror(edge), a + 112.5, 60, 60)}`) };
});

/** Floral: a rangoli flower, eight outlined pointed petals behind eight filled round ones, and a ring of dots. */
export function Floral({ g, cut }: Ink) {
  const { edges } = FLORAL();
  return (
    <>
      {EIGHT.map((a, k) => (
        <g key={a}>
          <path d={edges[k]} fill={g} />
          <circle cx={pt(60, 60, 47.5, a + 22.5 + 22.5)[0]} cy={pt(60, 60, 47.5, a + 45)[1]} r="1.7" fill={g} />
        </g>
      ))}
      {EIGHT.map((a) => (
        <g key={a}>
          <Keyed d={xf(FLORAL_ROUND, a + 90, 60, 60)} fill={g} cut={cut} width={2.6} />
          <path d={xf("M60 43.5 L60 28", a + 90, 60, 60)} stroke={cut} strokeWidth="1" strokeLinecap="round" />
        </g>
      ))}
      <Keyed d={circlePath(60, 60, 11.5)} fill={g} cut={cut} width={2.6} />
      <circle cx="60" cy="60" r="7.4" fill="none" stroke={cut} strokeWidth="1.2" />
      <circle cx="60" cy="60" r="2.6" fill={cut} />
    </>
  );
}

const PAISLEY = blob([
  [55, 104],
  [38, 98],
  [30, 81],
  [33, 63],
  [44, 50.5],
  [56.5, 42],
  [66.5, 33],
  [73.5, 23.5],
  [80, 16.4],
  [87.6, 14.2],
  [93, 18.4],
  [92.2, 25.6],
  [87.4, 27.8],
  [86, 24.2],
  [82.6, 28.6],
  [79.6, 37],
  [80.6, 50],
  [81.6, 66],
  [79, 85],
  [70.5, 99],
]);

const PAISLEY_LINES = once(() => ({
  contour: brush(sp([[72.6, 34.5], [60, 47], [47, 56], [39.6, 67], [38.6, 81], [45, 93], [56, 97], [67, 93], [72.6, 82], [73, 66], [71.6, 52]]), { w: 1.9, in: 0.12, out: 0.12, tip: 0.3 }),
  outline: brush(sp([[66, 107.6], [48, 108], [32.4, 99], [25.6, 81], [28.6, 61.5], [40, 46.6], [52.6, 37.8], [62, 28.6], [69.6, 18.6], [77.6, 11.4]]), { w: 1.8, in: 0.25, out: 0.3 }),
}));

/** Paisley (the mango buta): a filled teardrop whose tip curls over, an outer hairline, an inner contour, a flower. */
export function Paisley({ g, cut }: Ink) {
  const petal = "M56 80 C58.4 76 58.4 72.6 56 69.2 C53.6 72.6 53.6 76 56 80 Z";
  const { contour, outline } = PAISLEY_LINES();
  const seeds = [
    [96.4, 34, 1.9],
    [96.6, 42, 1.5],
    [95, 49, 1.15],
  ] as const;
  return (
    <>
      <path d={outline} fill={g} />
      <path d={PAISLEY} fill={g} />
      <path d={contour} fill={cut} />
      {Array.from({ length: 6 }, (_, k) => (
        <path key={k} d={xf(petal, k * 60, 56, 80)} fill={cut} />
      ))}
      <circle cx="56" cy="80" r="1.8" fill={g} />
      {[50, 58.5].map((y, k) => (
        <circle key={y} cx={63 - k * 4.6} cy={y - 4} r={1.3 - k * 0.15} fill={cut} />
      ))}
      {seeds.map(([x, y, rr]) => (
        <circle key={y} cx={x} cy={y} r={rr} fill={g} />
      ))}
    </>
  );
}

const RING_A = [47, 72] as const;
const RING_B = [73, 72] as const;
const RINGS = once(() => {
  const ring = (c: readonly [number, number], a0: number, a1: number) => brush(arcSegs(c[0], c[1], 22, a0, a1), { w: 7.2, nib: -35, thin: 0.42, in: 0, out: 0, tip: 1 });
  return { a: ring(RING_A, 0, 360), b: ring(RING_B, 0, 360), aTop: ring(RING_A, -84, -34) };
});

/** Rings: two interlocked wedding rings drawn with a nib (thick and thin), one set with a stone. */
export function Rings({ g, cut }: Ink) {
  const [A, B, r] = [RING_A, RING_B, 22];
  const rings = RINGS();
  // Interlocked without masks: A, then B over it at the bottom crossing (with a paper keyline), then the top
  // crossing of A drawn again over B, with its own keyline.
  return (
    <>
      <path d={rings.a} fill={g} />
      <path d={arc(B[0], B[1], r, 105, 145)} fill="none" stroke={cut} strokeWidth="11" />
      <path d={rings.b} fill={g} />
      <path d={arc(A[0], A[1], r, -78, -40)} fill="none" stroke={cut} strokeWidth="11" />
      <path d={rings.aTop} fill={g} />
      <path d="M68.6 47.6 L70.2 44 H75.8 L77.4 47.6 Z" fill={g} />
      <Keyed d="M64.6 36.6 L68.4 31 H77.6 L81.4 36.6 L73 46.4 Z" fill={g} cut={cut} width={2.4} />
      <path d="M65.2 36.6 H80.8 M68.4 31 L71 36.6 L73 45.6 L75 36.6 L77.6 31" fill="none" stroke={cut} strokeWidth="0.9" strokeLinejoin="round" />
      <path d="M90 23 L91.2 27.4 L95.6 28.6 L91.2 29.8 L90 34.2 L88.8 29.8 L84.4 28.6 L88.8 27.4 Z" fill={g} />
      <path d="M55 29 L55.8 31.8 L58.6 32.6 L55.8 33.4 L55 36.2 L54.2 33.4 L51.4 32.6 L54.2 31.8 Z" fill={g} />
    </>
  );
}

/** A drawing and the vertical span of its ink gradient (dark at y1, light at y2). */
export interface MotifDrawing {
  draw: (ink: Ink) => ReactNode;
  y1: number;
  y2: number;
}
