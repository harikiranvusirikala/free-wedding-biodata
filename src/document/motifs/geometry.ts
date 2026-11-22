// Geometry helpers for the motif drawings (VISION §7 D21, D45), ported from the mockup library
// (docs/mockups/assets/motifs.js). Every motif sits on a 120 × 120 box. Paths use absolute M, L, C, Q, A and Z
// only, so the PDF writer (src/pdf/svg-to-pdf.ts) draws them exactly as the browser does.

export type Pt = readonly [number, number];
export type Cubic = readonly [Pt, Pt, Pt, Pt];

export const r2 = (v: number) => Math.round(v * 100) / 100;
/** One decimal: enough for brush outlines (a tenth of a unit is under 0.1 px at the printed 96 px). */
const r1 = (v: number) => Math.round(v * 10) / 10;

/** The point at `deg` degrees (0 = right, 90 = down) on a circle. */
export function pt(cx: number, cy: number, r: number, deg: number): Pt {
  const a = (deg * Math.PI) / 180;
  return [r2(cx + r * Math.cos(a)), r2(cy + r * Math.sin(a))];
}

const PAIR = /(-?\d*\.?\d+)[ ,]+(-?\d*\.?\d+)/g;

/** Rotates (degrees) and scales every coordinate pair of an absolute M/L/C/Q/Z path about (cx, cy) (no H, V or A). */
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

/** A whole circle as four cubics (no arcs), so xf and mirror can move it. */
export function circleC(cx: number, cy: number, r: number): string {
  const k = 0.5523 * r;
  return `M${r2(cx + r)} ${cy} C${r2(cx + r)} ${r2(cy + k)} ${r2(cx + k)} ${r2(cy + r)} ${cx} ${r2(cy + r)} C${r2(cx - k)} ${r2(cy + r)} ${r2(cx - r)} ${r2(cy + k)} ${r2(cx - r)} ${cy} C${r2(cx - r)} ${r2(cy - k)} ${r2(cx - k)} ${r2(cy - r)} ${cx} ${r2(cy - r)} C${r2(cx + k)} ${r2(cy - r)} ${r2(cx + r)} ${r2(cy - k)} ${r2(cx + r)} ${cy} Z`;
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

// ---------------------------------------------------------------------------------------------------------------
// Brushwork (the 2026-11-22 redraw): smooth curves through hand-placed points, and calligraphic strokes along them
// whose width swells and thins like a brush or a broad nib, ending in tapered points.

/** A smooth curve through the points (uniform Catmull-Rom as cubic segments; `k` < 1 tightens the bends). */
export function spline(points: readonly Pt[], k = 1): Cubic[] {
  const at = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))];
  const segs: Cubic[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    segs.push([p1, [p1[0] + ((p2[0] - p0[0]) * k) / 6, p1[1] + ((p2[1] - p0[1]) * k) / 6], [p2[0] - ((p3[0] - p1[0]) * k) / 6, p2[1] - ((p3[1] - p1[1]) * k) / 6], p2]);
  }
  return segs;
}

/** A closed smooth shape through the points (Catmull-Rom round the loop), as a path. */
export function blob(points: readonly Pt[], k = 1): string {
  const n = points.length;
  const at = (i: number) => points[((i % n) + n) % n];
  let d = `M${r2(points[0][0])} ${r2(points[0][1])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1 = [p1[0] + ((p2[0] - p0[0]) * k) / 6, p1[1] + ((p2[1] - p0[1]) * k) / 6];
    const c2 = [p2[0] - ((p3[0] - p1[0]) * k) / 6, p2[1] - ((p3[1] - p1[1]) * k) / 6];
    d += ` C${r2(c1[0])} ${r2(c1[1])} ${r2(c2[0])} ${r2(c2[1])} ${r2(p2[0])} ${r2(p2[1])}`;
  }
  return `${d} Z`;
}

export interface BrushOptions {
  /** The widest width. */
  w: number;
  /** A broad nib's angle (degrees): moving along it draws the thinnest line, across it the widest. */
  nib?: number;
  /** The thinnest width with a nib, as a fraction of `w` (default 0.3). */
  thin?: number;
  /** Lengths (as fractions of the stroke) over which it swells in at the start and tapers out at the end. */
  in?: number;
  out?: number;
  /** The width at the tips as a fraction of `w`: 0 is a sharp point (default), more ends in a round tip. */
  tip?: number;
  /** The width at the start / end tips separately (default `tip`). */
  tip0?: number;
  tip1?: number;
  /** Extra pressure along the stroke, s in 0…1 → a factor (e.g. a swell in the middle). */
  press?: (s: number) => number;
}

/** Samples cubic segments evenly by length (about one point per `step` units). */
function sampleEven(segs: readonly Cubic[], step: number): Pt[] {
  const dense: Pt[] = [];
  segs.forEach((seg, i) => {
    for (let j = i ? 1 : 0; j <= 48; j++) dense.push(bez(seg, j / 48));
  });
  const acc = [0];
  for (let i = 1; i < dense.length; i++) acc.push(acc[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const total = acc[acc.length - 1];
  const n = Math.max(8, Math.ceil(total / step));
  const out: Pt[] = [];
  let j = 0;
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * total;
    while (j < acc.length - 2 && acc[j + 1] < s) j++;
    const f = acc[j + 1] > acc[j] ? (s - acc[j]) / (acc[j + 1] - acc[j]) : 0;
    out.push([dense[j][0] + (dense[j + 1][0] - dense[j][0]) * f, dense[j][1] + (dense[j + 1][1] - dense[j][1]) * f]);
  }
  return out;
}

/** An open polyline drawn smoothly: straight to the first midpoint, quadratic curves through the midpoints. */
function smoothRun(p: readonly Pt[], start: "M" | "L"): string {
  const f = (q: Pt) => `${r1(q[0])} ${r1(q[1])}`;
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let d = `${start}${f(p[0])} L${f(mid(p[0], p[1]))}`;
  for (let i = 1; i < p.length - 1; i++) d += ` Q${f(p[i])} ${f(mid(p[i], p[i + 1]))}`;
  return `${d} L${f(p[p.length - 1])}`;
}

/**
 * A calligraphic stroke along cubic segments, as one filled outline: it swells in from a tip, keeps its width
 * (modulated by the nib's angle and `press`) and tapers out to a sharp or round tip.
 */
export function brush(segs: readonly Cubic[], o: BrushOptions): string {
  const pts = sampleEven(segs, 1.8);
  const n = pts.length;
  const fin = o.in ?? 0.25;
  const fout = o.out ?? 0.35;
  const tip0 = o.tip0 ?? o.tip ?? 0;
  const tip1 = o.tip1 ?? o.tip ?? 0;
  const thin = o.thin ?? 0.3;
  const ease = (u: number) => Math.sin((Math.min(1, Math.max(0, u)) * Math.PI) / 2);
  const left: Pt[] = [];
  const right: Pt[] = [];
  const widths: number[] = [];
  const dirs: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1;
    const s = i / (n - 1);
    let w = o.w;
    if (o.nib !== undefined) w *= thin + (1 - thin) * Math.abs(Math.sin(Math.atan2(ty, tx) - (o.nib * Math.PI) / 180));
    if (o.press) w *= o.press(s);
    const env = Math.min(fin > 0 ? tip0 + (1 - tip0) * ease(s / fin) : 1, fout > 0 ? tip1 + (1 - tip1) * ease((1 - s) / fout) : 1);
    w *= env;
    widths.push(w);
    dirs.push([tx / len, ty / len]);
    const nx = -ty / len;
    const ny = tx / len;
    left.push([pts[i][0] + (nx * w) / 2, pts[i][1] + (ny * w) / 2]);
    right.push([pts[i][0] - (nx * w) / 2, pts[i][1] - (ny * w) / 2]);
  }
  // Round tips as two quarter-circle cubics (no arcs, so xf and mirror can move the outline too).
  const f = (q: Pt) => `${r1(q[0])} ${r1(q[1])}`;
  const K = 0.5523;
  const cap = (c: Pt, dir: Pt, w: number, forward: boolean) => {
    const r = w / 2;
    const t: Pt = forward ? dir : [-dir[0], -dir[1]];
    const nn: Pt = forward ? [-dir[1], dir[0]] : [dir[1], -dir[0]];
    const p = (a: number, b: number): Pt => [c[0] + nn[0] * a + t[0] * b, c[1] + nn[1] * a + t[1] * b];
    return ` C${f(p(r, K * r))} ${f(p(K * r, r))} ${f(p(0, r))} C${f(p(-K * r, r))} ${f(p(-r, K * r))} ${f(p(-r, 0))}`;
  };
  const capEnd = widths[n - 1] > 0.3 ? cap(pts[n - 1], dirs[n - 1], widths[n - 1], true) : ` L${f(right[n - 1])}`;
  const capStart = widths[0] > 0.3 ? cap(pts[0], dirs[0], widths[0], false) : "";
  return `${smoothRun(left, "M")}${capEnd}${smoothRun(right.reverse(), "L")}${capStart} Z`;
}

/** A teardrop from its round end (cx, cy, radius r) to a point at (tx, ty), as a path. */
export function drop(cx: number, cy: number, r: number, tx: number, ty: number): string {
  const a = Math.atan2(ty - cy, tx - cx);
  const d = Math.hypot(tx - cx, ty - cy);
  const t = Math.acos(Math.min(0.99, r / d));
  const p1 = pt(cx, cy, r, ((a + t) * 180) / Math.PI);
  const p2 = pt(cx, cy, r, ((a - t) * 180) / Math.PI);
  return `M${r2(tx)} ${r2(ty)} L${p1.join(" ")} A${r} ${r} 0 1 1 ${p2.join(" ")} Z`;
}

/** An arc of a circle from a0 to a1 degrees (clockwise, a1 > a0) as cubic segments of at most 90°, for `brush`. */
export function arcSegs(cx: number, cy: number, r: number, a0: number, a1: number): Cubic[] {
  const n = Math.max(1, Math.ceil((a1 - a0) / 90));
  const step = (a1 - a0) / n;
  const k = (4 / 3) * Math.tan((step * Math.PI) / 720);
  const segs: Cubic[] = [];
  for (let i = 0; i < n; i++) {
    const s = ((a0 + i * step) * Math.PI) / 180;
    const e = ((a0 + (i + 1) * step) * Math.PI) / 180;
    const p0: Pt = [cx + r * Math.cos(s), cy + r * Math.sin(s)];
    const p3: Pt = [cx + r * Math.cos(e), cy + r * Math.sin(e)];
    segs.push([p0, [p0[0] - k * r * Math.sin(s), p0[1] + k * r * Math.cos(s)], [p3[0] + k * r * Math.sin(e), p3[1] - k * r * Math.cos(e)], p3]);
  }
  return segs;
}

/** The points of a polygon, for <polygon points>. */
export const points = (pts: readonly Pt[]) => pts.map((p) => `${r2(p[0])},${r2(p[1])}`).join(" ");
