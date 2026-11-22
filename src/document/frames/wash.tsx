import { cr, H, mix, R, W, type Pt } from "./geometry";

// Soft watercolour washes inside the PDF writer's subset (Step 4.4, VISION D51): the mockup's watercolour frames
// (docs/mockups/assets/frames.js) paint with translucent radial gradients and blurs, which the PDF writer can't
// draw. Here a corner glow is a right triangle whose linear gradient fades to the paper exactly on its long side (so
// it has no edge at all), and a wash is a wobbly blob filled with a linear gradient of paper-mixed tints, edged a
// little darker like a dried watercolour bloom. Pure geometry plus two small components; colours come from callers.

/** A small deterministic random generator (mulberry32), so every page draws the same wobbles. */
export function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A wobbly closed outline round (cx, cy): radii rx, ry, turned by rot degrees; wob is how uneven (0.1–0.2). */
export function blobPts(cx: number, cy: number, rx: number, ry: number, rot: number, wob: number, seed: number, n = 22): Pt[] {
  const r = rng(seed);
  const [p1, p2, p3] = [r() * 6.3, r() * 6.3, r() * 6.3];
  const co = Math.cos((rot * Math.PI) / 180);
  const si = Math.sin((rot * Math.PI) / 180);
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    const k = 1 + wob * (0.5 * Math.sin(2 * a + p1) + 0.3 * Math.sin(3 * a + p2) + 0.2 * Math.sin(5 * a + p3)) + wob * 0.3 * (r() - 0.5);
    const x = rx * k * Math.cos(a);
    const y = ry * k * Math.sin(a);
    pts.push([cx + x * co - y * si, cy + x * si + y * co]);
  }
  return pts;
}

export const blob = (cx: number, cy: number, rx: number, ry: number, rot: number, wob: number, seed: number, n?: number) =>
  cr(blobPts(cx, cy, rx, ry, rot, wob, seed, n), true);

/** Points along a circular arc (degrees), about every `step` degrees. */
export function arcPts(cx: number, cy: number, r: number, a0: number, a1: number, step = 8): Pt[] {
  const n = Math.max(4, Math.ceil(Math.abs(a1 - a0) / step));
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Pt;
  });
}

/** An eased fade from `tint` to `paper` in `n` stops (strong in the corner, long soft tail). */
export function fade(paper: string, tint: string, n = 6): string[] {
  return Array.from({ length: n }, (_, i) => mix(paper, tint, Math.pow(1 - i / (n - 1), 2)));
}

export type Corner = "tl" | "tr" | "bl" | "br";

/**
 * A soft paper wash in one page corner (D51): a right triangle with legs `size` along the two edges, its linear
 * gradient running from the corner to the paper on the long side, which is a line of equal colour, so no edge shows.
 */
export function CornerWash({ id, corner, size, colors }: { id: string; corner: Corner; size: number; colors: readonly string[] }) {
  const x = corner[1] === "l" ? 0 : W;
  const y = corner[0] === "t" ? 0 : H;
  const dx = x ? -size : size;
  const dy = y ? -size : size;
  return (
    <>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={x} y1={y} x2={R(x + dx / 2)} y2={R(y + dy / 2)}>
          {colors.map((c, i) => (
            <stop key={i} offset={R(i / (colors.length - 1)) || 0} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      <path d={`M${x} ${y}H${x + dx}L${x} ${y + dy}Z`} fill={`url(#${id})`} />
    </>
  );
}

/**
 * Gradient fills shared by many shapes of one frame (a leaf colour at one strength is one gradient, not one per
 * leaf): `fill(from, to, horizontal)` returns a url and remembers the gradient; `<Defs />` writes them all.
 */
export function gradientBank(prefix: string) {
  const list = new Map<string, { id: string; from: string; to: string; across: boolean }>();
  return {
    fill(from: string, to: string, across = true) {
      const key = `${from}${to}${across}`;
      let g = list.get(key);
      if (!g) {
        g = { id: `${prefix}g${list.size}`, from, to, across };
        list.set(key, g);
      }
      return `url(#${g.id})`;
    },
    defs() {
      return (
        <defs>
          {[...list.values()].map((g) => (
            <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2={g.across ? 1 : 0} y2={g.across ? 0 : 1}>
              <stop offset="0" stopColor={g.from} />
              <stop offset="1" stopColor={g.to} />
            </linearGradient>
          ))}
        </defs>
      );
    },
  };
}
