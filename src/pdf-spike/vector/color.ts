// CSS colour strings → RGB in 0..1 plus alpha. Covers what computed styles and the SVG markup use: rgb()/rgba()
// (comma or space syntax), #rgb/#rgba/#rrggbb/#rrggbbaa and a handful of names.

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const NAMED: Record<string, [number, number, number]> = {
  black: [0, 0, 0],
  white: [255, 255, 255],
  red: [255, 0, 0],
  green: [0, 128, 0],
  blue: [0, 0, 255],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
  gold: [255, 215, 0],
  orange: [255, 165, 0],
  maroon: [128, 0, 0],
  navy: [0, 0, 128],
  silver: [192, 192, 192],
};

/** Parses a colour; returns null for none/transparent/unknown values. */
export function parseColor(value: string | undefined | null): Rgba | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === "none" || v === "transparent") return null;
  if (v[0] === "#") {
    let hex = v.slice(1);
    if (hex.length === 3 || hex.length === 4) hex = [...hex].map((c) => c + c).join("");
    if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(hex)) return null;
    const n = (i: number) => parseInt(hex.slice(i, i + 2), 16);
    return { r: n(0) / 255, g: n(2) / 255, b: n(4) / 255, a: hex.length === 8 ? n(6) / 255 : 1 };
  }
  const fn = /^rgba?\(([^)]*)\)$/.exec(v);
  if (fn) {
    const parts = fn[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const channel = (p: string) => (p.endsWith("%") ? (parseFloat(p) / 100) * 255 : parseFloat(p));
    const alpha = parts[3] === undefined ? 1 : parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
    return { r: channel(parts[0]) / 255, g: channel(parts[1]) / 255, b: channel(parts[2]) / 255, a: alpha };
  }
  const named = NAMED[v];
  return named ? { r: named[0] / 255, g: named[1] / 255, b: named[2] / 255, a: 1 } : null;
}

/** A number for a PDF content stream: at most 4 decimals, no exponent, no trailing zeros. */
export function num(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const r = Math.round(n * 10000) / 10000;
  if (Object.is(r, -0) || r === 0) return "0";
  return String(r);
}

export const rgbOps = (c: Rgba, stroke: boolean) => `${num(c.r)} ${num(c.g)} ${num(c.b)} ${stroke ? "RG" : "rg"}`;
