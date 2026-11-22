// Geometry helpers for the motif drawings (VISION §7 D21, D45), ported from the mockup library
// (docs/mockups/assets/motifs.js). Every motif sits on a 120 × 120 box. Paths use absolute M, L, C, Q, A and Z
// only, so the PDF writer (src/pdf/svg-to-pdf.ts) draws them exactly as the browser does.

export type Pt = readonly [number, number];
export type Cubic = readonly [Pt, Pt, Pt, Pt];

export const r2 = (v: number) => Math.round(v * 100) / 100;

/** The point at `deg` degrees (0 = right, 90 = down) on a circle. */
export function pt(cx: number, cy: number, r: number, deg: number): Pt {
  const a = (deg * Math.PI) / 180;
  return [r2(cx + r * Math.cos(a)), r2(cy + r * Math.sin(a))];
}

const PAIR = /(-?\d*\.?\d+)[ ,]+(-?\d*\.?\d+)/g;

/** Rotates (degrees) and scales every coordinate pair of an absolute M/L/C/Q/Z path about (cx, cy). */
export function xf(d: string, deg: number, cx: number, cy: number, s = 1): string {
  const a = (deg * Math.PI) / 180;
  const co = Math.cos(a);
  const si = Math.sin(a);
  return d.replace(PAIR, (_, x: string, y: string) => {
    const dx = (Number(x) - cx) * s;
    const dy = (Number(y) - cy) * s;
    return `${r2(cx + dx * co - dy * si)} ${r2(cy + dx * si + dy * co)}`;
  });
}

/** Mirrors an absolute M/L/C/Q/Z path across x = 60. */
export const mirror = (d: string) => d.replace(PAIR, (_, x: string, y: string) => `${r2(120 - Number(x))} ${y}`);

function bez(p: Cubic, t: number): Pt {
  const u = 1 - t;
  return [
    u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0],
    u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1],
  ];
}

/**
 * A smooth tapered stroke as a filled outline along cubic segments, width w0 → w1, ending in a round tip (or a
 * sharp point when `pointed`, which also narrows faster towards the end, like a blade).
 */
export function taper(segs: readonly Cubic[], w0: number, w1: number, pointed = false): string {
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
    const t = i / (n - 1);
    const w = (w0 + (w1 - w0) * (pointed ? Math.pow(t, 1.6) : t)) / 2;
    left.push([r2(pts[i][0] + nx * w), r2(pts[i][1] + ny * w)]);
    right.push([r2(pts[i][0] - nx * w), r2(pts[i][1] - ny * w)]);
  }
  const end = right[n - 1];
  const tip = pointed ? ` L${end.join(" ")}` : ` A${r2(w1 / 2)} ${r2(w1 / 2)} 0 0 1 ${end.join(" ")}`;
  return `M${left.map((p) => p.join(" ")).join(" L")}${tip} L${right.reverse().map((p) => p.join(" ")).join(" L")} Z`;
}

/** A scalloped disc: `n` round bumps around radius `r`. */
export function scallop(cx: number, cy: number, r: number, n: number): string {
  const br = r2(r * Math.sin(Math.PI / n));
  let d = "";
  for (let k = 0; k <= n; k++) {
    const p = pt(cx, cy, r, -90 + (k * 360) / n);
    d += k === 0 ? `M${p.join(" ")}` : ` A${br} ${br} 0 0 1 ${p.join(" ")}`;
  }
  return `${d} Z`;
}

/** The points of an n-pointed star (outer radius r1, inner r2), rotated `rot` degrees, for <polygon points>. */
export function starPoints(cx: number, cy: number, r1: number, rIn: number, n: number, rot: number): string {
  const out: string[] = [];
  for (let k = 0; k < n * 2; k++) out.push(pt(cx, cy, k % 2 ? rIn : r1, rot - 90 + (k * 180) / n).join(" "));
  return out.join(" ");
}

/** An open arc of a circle from a0 to a1 degrees, clockwise. */
export function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p0 = pt(cx, cy, r, a0);
  const p1 = pt(cx, cy, r, a1);
  return `M${p0.join(" ")} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p1.join(" ")}`;
}

/** A whole circle as a path (two half arcs), e.g. for an even-odd ring. */
export function circlePath(cx: number, cy: number, r: number): string {
  return `M${r2(cx - r)} ${cy} A${r} ${r} 0 1 1 ${r2(cx + r)} ${cy} A${r} ${r} 0 1 1 ${r2(cx - r)} ${cy} Z`;
}

/**
 * A crescent: the disc (ax, ay, ar) minus the disc (bx, by, br), as one closed path of two arcs, so it needs no
 * mask (the PDF writer has none). The discs must overlap with the cut-out reaching outside the first.
 */
export function crescent(ax: number, ay: number, ar: number, bx: number, by: number, br: number): string {
  const dx = bx - ax;
  const dy = by - ay;
  const d = Math.hypot(dx, dy);
  const a = (ar * ar - br * br + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ar * ar - a * a));
  const mx = ax + (a * dx) / d;
  const my = ay + (a * dy) / d;
  const p1: Pt = [r2(mx + (h * dy) / d), r2(my - (h * dx) / d)];
  const p2: Pt = [r2(mx - (h * dy) / d), r2(my + (h * dx) / d)];
  // Outer edge: the long way round the first disc, away from the cut-out; inner edge: back along the second.
  return `M${p1.join(" ")} A${ar} ${ar} 0 1 0 ${p2.join(" ")} A${br} ${br} 0 0 1 ${p1.join(" ")} Z`;
}
