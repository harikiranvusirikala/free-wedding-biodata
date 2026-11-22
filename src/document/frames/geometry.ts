import { PAGE } from "../tokens";

// Shared construction for the illustrated frame families (Step 4.3, VISION D39, D46): our own drawings, ported
// from the mockup library (docs/mockups/assets/frames.js) and cleaned up. Everything here returns plain path data
// rounded to 0.1 px, built once at import; the frame components only add colours. The output stays inside the PDF
// writer's SVG subset (src/pdf/svg-to-pdf.ts): paths, circles, ellipses, rects, transforms and linear gradients;
// translucent colours are mixed with the paper instead of using opacity. Pure.

export const { width: W, height: H } = PAGE;

export type Pt = readonly [number, number];

/** Rounds to 0.1 px: plenty for print, and it keeps the markup small. */
export const R = (v: number) => Math.round(v * 10) / 10;
const rad = (deg: number) => (deg * Math.PI) / 180;
export const pol = (cx: number, cy: number, r: number, deg: number): Pt => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))];
const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const rev = (p: readonly Pt[]) => p.slice().reverse();

/** Points along a cubic Bézier, N segments. */
export function bez(p0: Pt, p1: Pt, p2: Pt, p3: Pt, N: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}

/**
 * Drops points closer than `min` px to the last kept one (the ends always stay): sampled curves are much denser
 * than a smooth Catmull-Rom path needs, and every point costs a cubic in the markup.
 */
export function thin(pts: readonly Pt[], min = 2.2): Pt[] {
  if (pts.length <= 2) return pts.slice();
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) if (dist(pts[i], out[out.length - 1]) >= min) out.push(pts[i]);
  const last = pts[pts.length - 1];
  if (out.length > 1 && dist(out[out.length - 1], last) < min / 2) out.pop();
  out.push(last);
  return out;
}

/** Path numbers at 0.1 px, space-separated, with no space before a minus sign. */
export function nums(values: readonly number[]): string {
  return values
    .map((v) => String(R(v) || 0))
    .join(" ")
    .replace(/ -/g, "-");
}

/**
 * A smooth path through points (Catmull-Rom as cubics), written compactly: relative coordinates, and `s` for every
 * segment after the first (a Catmull-Rom segment's first control point is the reflection of the previous one's
 * second, which is exactly what `s` assumes).
 */
export function cr(pts: readonly Pt[], closed = false): string {
  const n = pts.length;
  const rd = (x: number, y: number): Pt => [R(x), R(y)];
  let cur = rd(pts[0][0], pts[0][1]);
  let d = `M${nums(cur)}`;
  const smooth: number[] = [];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const p1 = pts[i % n];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[closed ? (i + 2) % n : Math.min(n - 1, i + 2)];
    const c2 = rd(p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6);
    const end = rd(p2[0], p2[1]);
    if (i === 0) {
      const c1 = rd(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6);
      d += `c${nums([c1[0] - cur[0], c1[1] - cur[1], c2[0] - cur[0], c2[1] - cur[1], end[0] - cur[0], end[1] - cur[1]])}`;
    } else smooth.push(c2[0] - cur[0], c2[1] - cur[1], end[0] - cur[0], end[1] - cur[1]);
    cur = end;
  }
  if (smooth.length) d += `s${nums(smooth)}`;
  return d + (closed ? "Z" : "");
}

/** A stroke of varying width as a filled outline: widths [start, middle, end]. */
export function taper(points: readonly Pt[], w: readonly [number, number, number]): string {
  const pts = thin(points);
  const n = pts.length;
  const cum = [0];
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + dist(pts[i], pts[i - 1]);
  const tot = cum[n - 1] || 1;
  const width = (t: number) => w[0] * (1 - t) + w[2] * t + (w[1] - (w[0] + w[2]) / 2) * Math.sin(Math.PI * t);
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const hw = width(cum[i] / tot) / 2;
    const nx = (-(b[1] - a[1]) / len) * hw;
    const ny = ((b[0] - a[0]) / len) * hw;
    left.push([pts[i][0] + nx, pts[i][1] + ny]);
    right.push([pts[i][0] - nx, pts[i][1] - ny]);
  }
  return `${cr(left)}L${cr(right.reverse()).slice(1)}Z`;
}

/** A logarithmic spiral from radius r0 to r1, starting at angle a0 (deg); dir 1 turns clockwise on screen. */
export function spiral(cx: number, cy: number, r0: number, r1: number, a0: number, turns: number, dir: 1 | -1): Pt[] {
  const pts: Pt[] = [];
  const total = turns * 2 * Math.PI;
  for (let a = 0; ; ) {
    const t = Math.min(1, a / total);
    const r = r0 * Math.pow(r1 / r0, t);
    const ang = rad(a0) + dir * a;
    pts.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
    if (t >= 1) break;
    a += Math.min(0.3, 3 / r);
  }
  return pts;
}

/** A lead-in from (0,0) heading +x for `len`, ending in a curl of radius `size` (dir 1 curls towards +y). */
export function curlPts(len: number, size: number, dir: 1 | -1, bow = 0, turns = 1.05): Pt[] {
  const lead = bez([0, 0], [len * 0.35, -dir * bow], [len * 0.72, 0], [len, 0], Math.max(6, Math.round(len / 3)));
  return lead.concat(spiral(len, dir * size, size, size * 0.3, dir > 0 ? -90 : 90, turns, dir).slice(1));
}

/** Moves, rotates (deg) and scales points. */
export function tp(pts: readonly Pt[], x: number, y: number, deg = 0, s = 1): Pt[] {
  const co = Math.cos(rad(deg));
  const si = Math.sin(rad(deg));
  return pts.map((p) => [x + p[0] * s * co - p[1] * s * si, y + p[0] * s * si + p[1] * s * co]);
}

/** Joins two point runs with a cubic that follows both end tangents. */
export function join(A: readonly Pt[], B: readonly Pt[], k = 0.4): Pt[] {
  const a1 = A[A.length - 1];
  const a0 = A[A.length - 2];
  const b0 = B[0];
  const b1 = B[1];
  const da = dist(a1, a0) || 1;
  const db = dist(b1, b0) || 1;
  const gap = dist(a1, b0) * k;
  const c1: Pt = [a1[0] + ((a1[0] - a0[0]) / da) * gap, a1[1] + ((a1[1] - a0[1]) / da) * gap];
  const c2: Pt = [b0[0] - ((b1[0] - b0[0]) / db) * gap, b0[1] - ((b1[1] - b0[1]) / db) * gap];
  return [...A, ...bez(a1, c1, c2, b0, Math.max(4, Math.round(dist(a1, b0) / 3))).slice(1, -1), ...B];
}

/** A pointed leaf from (0,0) to (L,0), half-width w; `bend` moves the tip sideways. */
export function leafD(L: number, w: number, bend = 0): string {
  return (
    `M0 0C${R(L * 0.36)} ${R(-w)} ${R(L * 0.72)} ${R(-w * 0.8 + bend * 0.6)} ${R(L)} ${R(bend)}` +
    `C${R(L * 0.72)} ${R(w * 0.8 + bend * 0.6)} ${R(L * 0.36)} ${R(w)} 0 0Z`
  );
}

/** The transform that places a leaf (or any shape drawn along +x) at a point, turned by deg. */
export const at = (x: number, y: number, deg = 0) => `translate(${R(x)} ${R(y)})${deg ? ` rotate(${R(deg)})` : ""}`;

/** A straight segment as path data. */
export const seg = (x1: number, y1: number, x2: number, y2: number) => `M${R(x1)} ${R(y1)}L${R(x2)} ${R(y2)}`;

/** A rectangle inset `i` from every page edge, as path data. */
export const insetRect = (i: number) => `M${i} ${i}H${W - i}V${H - i}H${i}Z`;

/** Mirrors: across the vertical centre line, the horizontal one, both, and the top-left diagonal (x ↔ y). */
export const MX = `matrix(-1 0 0 1 ${W} 0)`;
export const MY = `matrix(1 0 0 -1 0 ${H})`;
export const MXY = `matrix(-1 0 0 -1 ${W} ${H})`;
export const DIAG = "matrix(0 1 1 0 0 0)";
/** The four corners of a piece drawn for the top-left one. */
export const CORNERS = [undefined, MX, MY, MXY] as const;

// Colour: frames take the palette's colours and mix tints from them (and from the paper), so one drawing serves
// every colour variant, including dark paper.

const rgb = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Mixes two #rrggbb colours: t = 0 gives a, 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const A = rgb(a);
  const B = rgb(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}
export const lighten = (c: string, t: number) => mix(c, "#ffffff", t);
export const darken = (c: string, t: number) => mix(c, "#000000", t);

/** Relative luminance (WCAG), for picking light or dark ornament details. */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of two colours. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const isDark = (paper: string) => luminance(paper) < 0.2;
