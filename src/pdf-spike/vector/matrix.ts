// 2D affine matrices in the PDF/SVG order [a b c d e f]: x' = a·x + c·y + e, y' = b·x + d·y + f.

export type Matrix = readonly [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** The matrix that applies `first`, then `second` (PDF's `first × second`). */
export function multiply(first: Matrix, second: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = first;
  const [a2, b2, c2, d2, e2, f2] = second;
  return [
    a1 * a2 + b1 * c2,
    a1 * b2 + b1 * d2,
    c1 * a2 + d1 * c2,
    c1 * b2 + d1 * d2,
    e1 * a2 + f1 * c2 + e2,
    e1 * b2 + f1 * d2 + f2,
  ];
}

export function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

export const translate = (tx: number, ty = 0): Matrix => [1, 0, 0, 1, tx, ty];
export const scale = (sx: number, sy = sx): Matrix => [sx, 0, 0, sy, 0, 0];

export function rotate(degrees: number, cx = 0, cy = 0): Matrix {
  const r = (degrees * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const m: Matrix = [cos, sin, -sin, cos, 0, 0];
  if (!cx && !cy) return m;
  // translate(cx cy) rotate(a) translate(-cx -cy), applied right to left to points.
  return multiply(multiply(translate(-cx, -cy), m), translate(cx, cy));
}

const skewX = (deg: number): Matrix => [1, 0, Math.tan((deg * Math.PI) / 180), 1, 0, 0];
const skewY = (deg: number): Matrix => [1, Math.tan((deg * Math.PI) / 180), 0, 1, 0, 0];

/**
 * Parses an SVG `transform` attribute. SVG lists transforms outermost first ("rotate(…) translate(…)" rotates the
 * translated shape), so the result maps a point through the last one first.
 */
export function parseTransform(value: string | undefined): Matrix {
  let m: Matrix = IDENTITY;
  if (!value) return m;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(value))) {
    const args = (match[2].match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []).map(Number);
    let t: Matrix = IDENTITY;
    switch (match[1]) {
      case "matrix":
        if (args.length === 6) t = args as unknown as Matrix;
        break;
      case "translate":
        t = translate(args[0] ?? 0, args[1] ?? 0);
        break;
      case "scale":
        t = scale(args[0] ?? 1, args[1] ?? args[0] ?? 1);
        break;
      case "rotate":
        t = rotate(args[0] ?? 0, args[1] ?? 0, args[2] ?? 0);
        break;
      case "skewX":
        t = skewX(args[0] ?? 0);
        break;
      case "skewY":
        t = skewY(args[0] ?? 0);
        break;
    }
    // Later transforms in the list apply to points first.
    m = multiply(t, m);
  }
  return m;
}

/** Average scale of a matrix, for stroke widths. */
export function meanScale(m: Matrix): number {
  return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
}
