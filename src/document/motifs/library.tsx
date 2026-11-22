import type { ReactNode } from "react";
import { arc, circlePath, crescent, mirror, pt, r2, scallop, starPoints, taper, xf } from "./geometry";
import { IK_ONKAR_PATH, OM_PATH } from "./glyphs";

// The motif drawings (VISION §7 D21, D45, D47): our own original artwork, ported from the mockup library
// (docs/mockups/assets/motifs.js), never traced from anyone else's. Each one is drawn on a 120 × 120 box in the
// template's colours: `g` is the ink gradient that fills the main shapes, `base` the pale tint that cuts details
// and backs the symbol, `lite` the gradient's light end and `ink` the plain ink.
//
// Only the SVG the PDF writer draws (src/pdf/svg-to-pdf.ts): paths, circles, rects, polygons, groups with
// transforms, strokes, opacities and linear gradients. No text (D47 (4): Om and Ik Onkar are outlines), no masks
// (the crescent and the interlocking rings are built from arcs), no paint-order (Keyed draws the keyline first).

export interface Ink {
  g: string;
  base: string;
  lite: string;
  ink: string;
}

/** A filled shape with a thin base-coloured keyline around it (the mockup's paint-order trick, PDF-safe). */
function Keyed({ d, fill, base, width }: { d: string; fill: string; base: string; width: number }) {
  return (
    <>
      <path d={d} fill="none" stroke={base} strokeWidth={width} strokeLinejoin="round" />
      <path d={d} fill={fill} />
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Hindu

const G = {
  crown: "M47 41 L47 33 C47 25 53 21 56.5 16 L60 9.5 L63.5 16 C67 21 73 25 73 33 L73 41 Z",
  face: "M45 43 C44 55 47 64 53.5 70 L66.5 70 C73 64 76 55 75 43 Z",
  earL: "M47.5 47 C40 39 27 37 20 45 C14 52 15 65 21 72 C27 79 36 82 43 79 C47 77 49.5 72 49.5 68 Z",
  earLine: "M43 50 C35 45 26 46 23 53 C20 60 24 70 31 74",
  trunk: taper(
    [
      [[60, 58], [60, 76], [54.5, 86], [57, 96]],
      [[57, 96], [59, 105], [72, 108.5], [78, 100.5]],
      [[78, 100.5], [82, 94], [78, 87], [72.5, 89]],
    ],
    16,
    5,
  ),
  tusk: "M66.5 66 C71.5 69.5 75 74 76.5 80 C72 78.5 68 75 64.5 70.5 Z",
};

/** Ganesha: crown, face, ears, trunk and tusk. */
export function Ganesha({ g, base }: Ink) {
  return (
    <>
      <path d={G.earL} fill={g} />
      <path d={mirror(G.earL)} fill={g} />
      <path d={G.earLine} fill="none" stroke={base} strokeWidth="1.6" strokeLinecap="round" />
      <path d={mirror(G.earLine)} fill="none" stroke={base} strokeWidth="1.6" strokeLinecap="round" />
      <Keyed d={G.face} fill={g} base={base} width={3.6} />
      <path d={G.trunk} fill={g} />
      <Keyed d={G.crown} fill={g} base={base} width={3.2} />
      <circle cx="60" cy="8.5" r="2.6" fill={g} />
      <Keyed d="M46 38.5 H74 Q76 38.5 76 40.5 V42 Q76 44 74 44 H46 Q44 44 44 42 V40.5 Q44 38.5 46 38.5 Z" fill={g} base={base} width={3.2} />
      <path d="M60 46.5 C61.6 49 61.6 51 60 52.5 C58.4 51 58.4 49 60 46.5 Z" fill={base} />
      <path d="M50.5 55 Q53.5 52.6 56.5 55 Q53.5 56.6 50.5 55 Z" fill={base} />
      <path d="M63.5 55 Q66.5 52.6 69.5 55 Q66.5 56.6 63.5 55 Z" fill={base} />
      <path d="M54.5 77 Q60 79.5 65 76.5 M54 84 Q59 86.5 63.5 83.5" fill="none" stroke={base} strokeWidth="1.3" strokeLinecap="round" />
      <path d={G.tusk} fill={base} stroke={g} strokeWidth="1.4" strokeLinejoin="round" />
    </>
  );
}

/** Om in a ringed disc. */
export function Om({ g, base }: Ink) {
  return (
    <>
      <circle cx="60" cy="60" r="52" fill={base} />
      <circle cx="60" cy="60" r="47.5" fill="none" stroke={g} strokeWidth="1.2" />
      <path d={OM_PATH} fill={g} />
    </>
  );
}

const KALASH_LEAF = "M60 55 C66.5 47 67.5 37 60 26 C52.5 37 53.5 47 60 55 Z";

/** Kalash: a pot with mango leaves and a coconut. */
export function Kalash({ g, base }: Ink) {
  return (
    <>
      <circle cx="60" cy="60" r="52" fill={base} />
      <g transform="translate(60 60) scale(0.92) translate(-60 -62)">
        {[-68, -36, 36, 68].map((a) => (
          <g key={a}>
            <Keyed d={xf(KALASH_LEAF, a, 60, 55)} fill={g} base={base} width={2.8} />
            <path d={xf("M60 52 L60 31", a, 60, 55)} stroke={base} strokeWidth="1" strokeLinecap="round" />
          </g>
        ))}
        <Keyed d="M60 14 C64 21 72.5 25 72.5 38 C72.5 48 66.5 54 60 54 C53.5 54 47.5 48 47.5 38 C47.5 25 56 21 60 14 Z" fill={g} base={base} width={3.2} />
        <path d="M60 19 C56 27 54 36 55.5 50 M60 19 C64 27 66 36 64.5 50 M60 19 L60 51" fill="none" stroke={base} strokeWidth="0.9" strokeLinecap="round" />
        <Keyed d="M50 62 C44 66 31 72 30.5 85 C30 97 42 105 60 105 C78 105 90 97 89.5 85 C89 72 76 66 70 62 Z" fill={g} base={base} width={3.2} />
        <Keyed d="M51 58 L69 58 L70.5 64 L49.5 64 Z" fill={g} base={base} width={2.8} />
        <Keyed d="M46 52 H74 A3.5 3.5 0 0 1 74 59 H46 A3.5 3.5 0 0 1 46 52 Z" fill={g} base={base} width={3.2} />
        <Keyed d="M50 103 L46.5 110.5 L73.5 110.5 L70 103 Z" fill={g} base={base} width={2.8} />
        <path d="M33.5 77.5 Q60 86 86.5 77.5 M32 91.5 Q60 100 88 91.5" fill="none" stroke={base} strokeWidth="1.4" />
        <circle cx="60" cy="86.5" r="2.4" fill={base} />
        <circle cx="50" cy="85.6" r="1.6" fill={base} />
        <circle cx="70" cy="85.6" r="1.6" fill={base} />
        <circle cx="40.5" cy="83.5" r="1.2" fill={base} />
        <circle cx="79.5" cy="83.5" r="1.2" fill={base} />
      </g>
    </>
  );
}

/** Swastika (the Hindu sathiya, arms turning clockwise, upright, with four dots) on a scalloped disc. */
export function Swastika({ g, base }: Ink) {
  return (
    <>
      <path d={scallop(60, 60, 53, 16)} fill={base} />
      <path d="M60 25 V95 M25 60 H95 M60 25 H90 M95 60 V90 M60 95 H30 M25 60 V30" fill="none" stroke={g} strokeWidth="10" strokeLinecap="square" strokeLinejoin="miter" />
      <circle cx="42.5" cy="42.5" r="5" fill={g} />
      <circle cx="77.5" cy="42.5" r="5" fill={g} />
      <circle cx="42.5" cy="77.5" r="5" fill={g} />
      <circle cx="77.5" cy="77.5" r="5" fill={g} />
    </>
  );
}

const PETAL = "M60 20 C73.5 38 75 63 60 88 C45 63 46.5 38 60 20 Z";

/** Lotus: five petals over water. */
export function Lotus({ g, base, lite }: Ink) {
  return (
    <>
      <circle cx="60" cy="62" r="50" fill={base} />
      {[-62, 62].map((a) => (
        <Keyed key={a} d={xf(PETAL, a, 60, 88, 0.72)} fill={lite} base={base} width={3.2} />
      ))}
      {[-31, 31].map((a) => (
        <Keyed key={a} d={xf(PETAL, a, 60, 88, 0.86)} fill={g} base={base} width={3.6} />
      ))}
      <Keyed d={PETAL} fill={g} base={base} width={3.6} />
      <path d="M60 32 C64 46 64 66 60 82 C56 66 56 46 60 32 Z" fill={base} opacity="0.55" />
      <Keyed d="M24 89 C38 99 82 99 96 89 C88 103 32 103 24 89 Z" fill={g} base={base} width={3.2} />
      <path d="M40 106 Q50 102 60 106 Q70 110 80 106" fill="none" stroke={g} strokeWidth="1.4" strokeLinecap="round" />
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
export function Jain({ g, base }: Ink) {
  const spokes = Array.from({ length: 12 }, (_, k) => `M60 94 L${pt(60, 94, 5.6, k * 30).join(" ")}`).join(" ");
  return (
    <>
      <path d="M51 8 L69 8 L88 37 L69 60 L95 112 L25 112 L51 60 L32 37 Z" fill={base} stroke={g} strokeWidth="3.4" strokeLinejoin="round" />
      <circle cx="60" cy="14.5" r="2" fill={g} />
      <path d="M51.5 18.5 Q60 27.5 68.5 18.5 Q60 23.5 51.5 18.5 Z" fill={g} stroke={g} strokeWidth="0.8" strokeLinejoin="round" />
      <circle cx="53" cy="31" r="2" fill={g} />
      <circle cx="60" cy="31" r="2" fill={g} />
      <circle cx="67" cy="31" r="2" fill={g} />
      <path d="M60 39 V53 M53 46 H67 M60 39 H66 M67 46 V52 M60 53 H54 M53 46 V40" fill="none" stroke={g} strokeWidth="2.4" strokeLinecap="square" />
      {(
        [
          [50.4, 76],
          [55.2, 72.5],
          [60, 72],
          [64.8, 74.5],
        ] as const
      ).map(([x, y]) => (
        <rect key={x} x={x} y={y} width="4.8" height={r2(92 - y)} rx="2.4" fill={g} stroke={base} strokeWidth="0.8" />
      ))}
      <path d="M50 88 L50 99 C50 104.5 54 107 60 107 C66 107 70 104.5 70 99 L70 88 Z" fill={g} />
      <path d="M50.5 99 C47 96 44 90.5 43.5 86.5 C43.2 84.5 45.6 83.7 46.8 85.4 C48.6 88 49.8 90 51 91.5 Z" fill={g} stroke={base} strokeWidth="0.8" strokeLinejoin="round" />
      <circle cx="60" cy="94" r="6.2" fill="none" stroke={base} strokeWidth="1.2" />
      <path d={spokes} stroke={base} strokeWidth="0.7" />
      <circle cx="60" cy="94" r="1.4" fill={base} />
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Sikh

/** Ik Onkar in a ringed, scalloped disc. */
export function IkOnkar({ g, base }: Ink) {
  return (
    <>
      <path d={scallop(60, 60, 53, 18)} fill={base} />
      <circle cx="60" cy="60" r="46" fill="none" stroke={g} strokeWidth="1.2" />
      <path d={IK_ONKAR_PATH} fill={g} />
    </>
  );
}

const BLADE_L = taper(
  [
    [[46, 92], [30, 90], [20, 78], [21, 62]],
    [[21, 62], [21, 53], [20.5, 45], [16.5, 36]],
  ],
  10,
  0.8,
  true,
);

/** One kirpan's hilt: a guard across the blade root, a grip crossing under the centre and a round pommel. */
function Hilt({ g, base, side }: { g: string; base: string; side: 1 | -1 }) {
  const x = (v: number) => (side === 1 ? v : r2(120 - v));
  const grip = `M${x(47.5)} 93 L${x(69.5)} 106.5`;
  const guard = `M${x(44.6)} 86.6 L${x(47.6)} 97.4`;
  return (
    <>
      <path d={grip} stroke={base} strokeWidth="6.6" strokeLinecap="round" />
      <path d={grip} stroke={g} strokeWidth="4" strokeLinecap="round" />
      <circle cx={x(71.5)} cy="107.8" r="4" fill={base} />
      <circle cx={x(71.5)} cy="107.8" r="2.8" fill={g} />
      <path d={guard} stroke={base} strokeWidth="5.6" strokeLinecap="round" />
      <path d={guard} stroke={g} strokeWidth="3.2" strokeLinecap="round" />
    </>
  );
}

/**
 * The Khanda: the double-edged khanda in the centre, the chakkar around it and two kirpans.
 * COMMUNITY REVIEW (VISION D47 (3), BUILD_PLAN Step 6.3): to be checked by members of the Sikh community before
 * launch; an owner check. Change nothing here on taste alone.
 */
export function Khanda({ g, base }: Ink) {
  return (
    <>
      <circle cx="60" cy="60" r="53" fill={base} />
      <Keyed d={BLADE_L} fill={g} base={base} width={2.8} />
      <Keyed d={mirror(BLADE_L)} fill={g} base={base} width={2.8} />
      <Hilt g={g} base={base} side={1} />
      <Hilt g={g} base={base} side={-1} />
      <path d={`${circlePath(60, 59, 27)} ${circlePath(60, 59, 19.5)}`} fill="none" stroke={base} strokeWidth="3.2" />
      <path d={`${circlePath(60, 59, 27)} ${circlePath(60, 59, 19.5)}`} fill={g} fillRule="evenodd" />
      <Keyed d="M60 8 L66.5 21 L66 80 L54 80 L53.5 21 Z" fill={g} base={base} width={4} />
      <path d="M60 15 L60 77" stroke={base} strokeWidth="1.1" />
      <Keyed d="M51.5 79 H68.5 A2.5 2.5 0 0 1 68.5 84 H51.5 A2.5 2.5 0 0 1 51.5 79 Z" fill={g} base={base} width={3.2} />
      <Keyed d="M58.5 84 H61.5 Q63 84 63 85.5 V91.5 Q63 93 61.5 93 H58.5 Q57 93 57 91.5 V85.5 Q57 84 58.5 84 Z" fill={g} base={base} width={2.8} />
      <Keyed d={circlePath(60, 96, 3.6)} fill={g} base={base} width={2.8} />
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Christian

/** A plain Latin cross with bevelled faces. */
export function Cross({ g, base, ink }: Ink) {
  const cx = 60;
  const cy = 43;
  const w = 7;
  const T = 14;
  const B = 106;
  const Lx = 30;
  const Rx = 90;
  const light = (pts: number[][]) => <polygon points={pts.map((p) => p.join(",")).join(" ")} fill="#fff" fillOpacity="0.26" />;
  const dark = (pts: number[][]) => <polygon points={pts.map((p) => p.join(",")).join(" ")} fill={ink} fillOpacity="0.32" />;
  const shape = `M${cx - w} ${T} H${cx + w} V${cy - w} H${Rx} V${cy + w} H${cx + w} V${B} H${cx - w} V${cy + w} H${Lx} V${cy - w} H${cx - w} Z`;
  return (
    <>
      <circle cx="60" cy="60" r="52" fill={base} />
      <path d={shape} fill={g} />
      <g>
        {light([[cx - w, T], [cx, T + w], [cx, cy], [cx - w, cy - w]])}
        {dark([[cx + w, T], [cx, T + w], [cx, cy], [cx + w, cy - w]])}
        {light([[cx - w, T], [cx + w, T], [cx, T + w]])}
        {light([[cx - w, B], [cx, B - w], [cx, cy], [cx - w, cy + w]])}
        {dark([[cx + w, B], [cx, B - w], [cx, cy], [cx + w, cy + w]])}
        {dark([[cx - w, B], [cx + w, B], [cx, B - w]])}
        {light([[Lx, cy - w], [Lx + w, cy], [cx, cy], [cx - w, cy - w]])}
        {dark([[Lx, cy + w], [Lx + w, cy], [cx, cy], [cx - w, cy + w]])}
        {light([[Lx, cy - w], [Lx, cy + w], [Lx + w, cy]])}
        {light([[Rx, cy - w], [Rx - w, cy], [cx, cy], [cx + w, cy - w]])}
        {dark([[Rx, cy + w], [Rx - w, cy], [cx, cy], [cx + w, cy + w]])}
        {dark([[Rx, cy - w], [Rx, cy + w], [Rx - w, cy]])}
      </g>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Muslim

/** Crescent and star. */
export function CrescentStar({ g, base }: Ink) {
  return (
    <>
      <circle cx="60" cy="60" r="52" fill={base} />
      <path d={crescent(55, 61, 38, 67, 53, 31)} fill={g} />
      <polygon points={starPoints(77, 50, 13, 5.4, 5, 12)} fill={g} stroke={g} strokeWidth="0.8" strokeLinejoin="round" />
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Buddhist

/** A point `r` out along angle `a` (degrees), moved `hw` sideways. */
function radial(r: number, hw: number, a: number): string {
  const t = (a * Math.PI) / 180;
  const d = [Math.cos(t), Math.sin(t)];
  const p = [-d[1], d[0]];
  return `${r2(60 + d[0] * r + p[0] * hw)} ${r2(60 + d[1] * r + p[1] * hw)}`;
}

/** The Dharma wheel: eight spokes, a rim with finials and a hub. */
export function DharmaWheel({ g, base }: Ink) {
  let spokes = "";
  let tips = "";
  for (let k = 0; k < 8; k++) {
    const a = k * 45 - 90;
    spokes += `M${radial(10, -1.7, a)} Q${radial(22, -5.2, a)} ${radial(36, -1.5, a)} L${radial(36, 1.5, a)} Q${radial(22, 5.2, a)} ${radial(10, 1.7, a)} Z `;
    tips += `M${radial(41, -4.6, a)} Q${radial(46, -4.4, a)} ${radial(51.5, 0, a)} Q${radial(46, 4.4, a)} ${radial(41, 4.6, a)} Z `;
  }
  return (
    <>
      <circle cx="60" cy="60" r="54" fill={base} />
      <path d={tips} fill={g} />
      <path d={spokes} fill={g} />
      <path d="M60 17.5 A42.5 42.5 0 1 1 59.99 17.5 Z M60 25 A35 35 0 1 0 60.01 25 Z" fill={g} fillRule="evenodd" />
      <circle cx="60" cy="60" r="38.75" fill="none" stroke={base} strokeWidth="1.1" />
      <circle cx="60" cy="60" r="12" fill={g} />
      <circle cx="60" cy="60" r="7.8" fill="none" stroke={base} strokeWidth="1.4" />
      <circle cx="60" cy="60" r="2.6" fill={base} />
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Secular

const FLORAL_POINTED = "M60 50 C66 42 68 26 60 12 C52 26 54 42 60 50 Z";
const FLORAL_ROUND = "M60 48 C68 42 71 30 66 22 C64 19 62 19 60 21.5 C58 19 56 19 54 22 C49 30 52 42 60 48 Z";

/** Floral: an eight-petalled flower with a dotted ring (no religious meaning). */
export function Floral({ g, base, lite }: Ink) {
  const k8 = Array.from({ length: 8 }, (_, k) => k);
  return (
    <>
      <circle cx="60" cy="60" r="56" fill={base} />
      {k8.map((k) => {
        const [x, y] = pt(60, 60, 52, k * 45 - 90);
        return <circle key={`d${k}`} cx={x} cy={y} r="2.2" fill={g} />;
      })}
      {k8.map((k) => (
        <Keyed key={`b${k}`} d={xf(FLORAL_POINTED, k * 45 + 22.5, 60, 60)} fill={lite} base={base} width={2.8} />
      ))}
      {k8.map((k) => (
        <g key={`f${k}`}>
          <Keyed d={xf(FLORAL_ROUND, k * 45, 60, 60)} fill={g} base={base} width={3.2} />
          <path d={xf("M60 44 L60 28", k * 45, 60, 60)} stroke={base} strokeWidth="1" strokeLinecap="round" />
        </g>
      ))}
      <Keyed d={circlePath(60, 60, 12)} fill={g} base={base} width={3.2} />
      <circle cx="60" cy="60" r="7.5" fill="none" stroke={base} strokeWidth="1.2" />
      <circle cx="60" cy="60" r="2.6" fill={base} />
    </>
  );
}

/** Rings: two interlocking wedding rings, one with a stone (no religious meaning). */
export function Rings({ g, base }: Ink) {
  const A = [47, 72] as const;
  const B = [73, 72] as const;
  const r = 23;
  const ring = (c: readonly [number, number]) => (
    <>
      <circle cx={c[0]} cy={c[1]} r={r} fill="none" stroke={g} strokeWidth="7.5" />
      <circle cx={c[0]} cy={c[1]} r={r} fill="none" stroke={base} strokeWidth="0.9" strokeOpacity="0.75" />
    </>
  );
  // Interlocked without masks: A, then B over it with a keyline where it crosses A at the bottom, then the top
  // crossing of A drawn again over B, with its own keyline.
  const overB = arc(A[0], A[1], r, -80, -35);
  return (
    <>
      <circle cx="60" cy="60" r="52" fill={base} />
      {ring(A)}
      <path d={arc(B[0], B[1], r, 100, 145)} fill="none" stroke={base} strokeWidth="11" />
      {ring(B)}
      <path d={overB} fill="none" stroke={base} strokeWidth="11" />
      <path d={overB} fill="none" stroke={g} strokeWidth="7.5" />
      <path d={overB} fill="none" stroke={base} strokeWidth="0.9" strokeOpacity="0.75" />
      <path d="M69 46 L70.5 42.5 L75.5 42.5 L77 46 Z" fill={g} />
      <Keyed d="M65 36 L68.5 30.5 L77.5 30.5 L81 36 L73 45.5 Z" fill={g} base={base} width={2.6} />
      <path d="M65.5 36 H80.5 M68.5 30.5 L71 36 L73 45 L75 36 L77.5 30.5" fill="none" stroke={base} strokeWidth="0.9" strokeLinejoin="round" />
      <path d="M89 25 L90.2 29 L94 30.2 L90.2 31.4 L89 35.4 L87.8 31.4 L84 30.2 L87.8 29 Z" fill={g} />
      <path d="M55 30 L55.8 32.6 L58.4 33.4 L55.8 34.2 L55 36.8 L54.2 34.2 L51.6 33.4 L54.2 32.6 Z" fill={g} />
    </>
  );
}

/** A drawing and the vertical span of its ink gradient (dark at y1, light at y2). */
export interface MotifDrawing {
  draw: (ink: Ink) => ReactNode;
  y1: number;
  y2: number;
}
