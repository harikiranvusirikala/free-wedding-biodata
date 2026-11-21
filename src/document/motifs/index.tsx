import { useId } from "react";

// Original motif artwork for the top of a biodata (VISION §7 D21, D45, D47): our own drawings, ported from the
// mockup library (docs/mockups/assets/motifs.js). Every motif takes the template's colours: `ink` fills the main
// shapes as a vertical gradient to a lighter tint, `base` (a pale tint) cuts the details. Plain paths, circles
// and linear gradients only, the SVG subset the PDF writer draws (src/pdf-spike/vector/svg-to-pdf.ts); no
// paint-order or text. Nothing is ever shown unless the user picks a motif ("None" first, never inferred).
// Step 4.4 adds the rest of the library.

type Pt = readonly [number, number];
type Cubic = readonly [Pt, Pt, Pt, Pt];

const r2 = (v: number) => Math.round(v * 100) / 100;

function bez(p: Cubic, t: number): Pt {
  const u = 1 - t;
  return [
    u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0],
    u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1],
  ];
}

/** A smooth tapered stroke as a filled outline along cubic segments, width w0 → w1, with a round tip. */
function taper(segs: readonly Cubic[], w0: number, w1: number): string {
  const N = 24;
  const pts: Pt[] = [];
  segs.forEach((seg, i) => {
    for (let j = i ? 1 : 0; j <= N; j++) pts.push(bez(seg, j / N));
  });
  const left: Pt[] = [];
  const right: Pt[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len;
    const ny = tx / len;
    const w = (w0 + (w1 - w0) * (i / (n - 1))) / 2;
    left.push([r2(pts[i][0] + nx * w), r2(pts[i][1] + ny * w)]);
    right.push([r2(pts[i][0] - nx * w), r2(pts[i][1] - ny * w)]);
  }
  const end = right[n - 1];
  return (
    `M${left.map((p) => p.join(" ")).join(" L")}` +
    ` A${r2(w1 / 2)} ${r2(w1 / 2)} 0 0 1 ${end.join(" ")}` +
    ` L${right.reverse().map((p) => p.join(" ")).join(" L")} Z`
  );
}

/** Mirrors an absolute path (M, L, C, Q, Z only) across x = 60. */
const mirror = (d: string) => d.replace(/(-?\d*\.?\d+)[ ,]+(-?\d*\.?\d+)/g, (_, x: string, y: string) => `${r2(120 - Number(x))} ${y}`);

/** Mixes a #rrggbb colour with white: t = 0 the colour, 1 white. */
export function tint(hex: string, t: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const mix = (v: number) => Math.round(v + (255 - v) * t);
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => mix(v).toString(16).padStart(2, "0")).join("")}`;
}

// Ganesha: crown, face, ears, trunk and tusk (the mockup's "ganesha", our own drawing).
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

/** A filled shape with a thin base-coloured keyline outside it (the mockup's paint-order trick, PDF-safe). */
function Keyed({ d, fill, base, width }: { d: string; fill: string; base: string; width: number }) {
  return (
    <>
      <path d={d} fill="none" stroke={base} strokeWidth={width} strokeLinejoin="round" />
      <path d={d} fill={fill} />
    </>
  );
}

function Ganesha({ g, base }: { g: string; base: string }) {
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

/** The motif library: id → drawing on a 120 × 120 box. */
const DRAWINGS: Record<string, (c: { g: string; base: string }) => React.ReactNode> = {
  ganesha: Ganesha,
};

export const MOTIF_IDS = Object.keys(DRAWINGS);

export const isMotif = (id: string | null | undefined): id is string => !!id && Object.hasOwn(DRAWINGS, id);

/** A motif in the template's colours, `size` px square; nothing for None or an unknown id. */
export function Motif({ id, ink, base, size }: { id: string | null; ink: string; base: string; size: number }) {
  const gradientId = `motif${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  if (!isMotif(id)) return null;
  const Drawing = DRAWINGS[id];
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden style={{ display: "block" }}>
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="0" y1="12" x2="0" y2="108">
          <stop offset="0" stopColor={ink} />
          <stop offset="1" stopColor={tint(ink, 0.35)} />
        </linearGradient>
      </defs>
      <Drawing g={`url(#${gradientId})`} base={base} />
    </svg>
  );
}
