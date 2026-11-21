// SVG path data → absolute move/line/cubic/close segments (quadratics, smooth curves and arcs become cubics),
// plus the basic shapes as paths and a tight bounding box.

export type Segment =
  | { op: "M"; x: number; y: number }
  | { op: "L"; x: number; y: number }
  | { op: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { op: "Z" };

const NUMBER = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y;

/** Splits path data into commands and their numbers. Arc flags may be written without separators ("a1 1 0 01 1 1"). */
function tokenize(d: string): { cmd: string; args: number[] }[] {
  const out: { cmd: string; args: number[] }[] = [];
  let i = 0;
  let current: { cmd: string; args: number[] } | null = null;
  while (i < d.length) {
    const ch = d[i];
    if (/[\s,]/.test(ch)) {
      i++;
      continue;
    }
    if (/[MmLlHhVvCcSsQqTtAaZz]/.test(ch)) {
      current = { cmd: ch, args: [] };
      out.push(current);
      i++;
      continue;
    }
    if (!current) throw new Error(`Path data must start with a command: ${d.slice(0, 20)}`);
    // Arc flags (4th and 5th argument of each 7) are single digits 0/1.
    const upper = current.cmd.toUpperCase();
    const k = current.args.length % 7;
    if (upper === "A" && (k === 3 || k === 4) && (ch === "0" || ch === "1")) {
      current.args.push(ch === "1" ? 1 : 0);
      i++;
      continue;
    }
    NUMBER.lastIndex = i;
    const m = NUMBER.exec(d);
    if (!m) throw new Error(`Bad path data at ${i}: ${d.slice(i, i + 20)}`);
    current.args.push(Number(m[0]));
    i = NUMBER.lastIndex;
  }
  return out;
}

/** Converts an SVG elliptical arc to cubic Bézier segments (SVG 1.1 implementation notes, F.6). */
export function arcToCubics(
  x1: number,
  y1: number,
  rxIn: number,
  ryIn: number,
  angle: number,
  largeArc: boolean,
  sweep: boolean,
  x2: number,
  y2: number,
): Segment[] {
  if (x1 === x2 && y1 === y2) return [];
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (!rx || !ry) return [{ op: "L", x: x2, y: y2 }];
  const phi = (angle * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let coef = Math.sqrt(Math.max(0, num / den));
  if (largeArc === sweep) coef = -coef;
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const vecAngle = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const theta1 = vecAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = vecAngle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  const parts = Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9);
  const step = delta / parts;
  const k = (4 / 3) * Math.tan(step / 4);
  const point = (t: number): [number, number] => {
    const ex = rx * Math.cos(t);
    const ey = ry * Math.sin(t);
    return [cos * ex - sin * ey + cx, sin * ex + cos * ey + cy];
  };
  const deriv = (t: number): [number, number] => {
    const ex = -rx * Math.sin(t);
    const ey = ry * Math.cos(t);
    return [cos * ex - sin * ey, sin * ex + cos * ey];
  };
  const out: Segment[] = [];
  let t = theta1;
  for (let p = 0; p < parts; p++) {
    const t2 = t + step;
    const [px, py] = point(t);
    const [qx, qy] = p === parts - 1 ? [x2, y2] : point(t2);
    const [d1x, d1y] = deriv(t);
    const [d2x, d2y] = deriv(t2);
    out.push({ op: "C", x1: px + k * d1x, y1: py + k * d1y, x2: qx - k * d2x, y2: qy - k * d2y, x: qx, y: qy });
    t = t2;
  }
  return out;
}

/** Parses SVG path data into absolute segments. */
export function parsePath(d: string): Segment[] {
  const out: Segment[] = [];
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  // Last control point for S/T reflection, and which kind of command set it.
  let lastCtrl: { x: number; y: number; kind: "C" | "Q" } | null = null;
  for (const { cmd, args } of tokenize(d)) {
    const rel = cmd === cmd.toLowerCase();
    const upper = cmd.toUpperCase();
    const ox = () => (rel ? x : 0);
    const oy = () => (rel ? y : 0);
    if (upper === "Z") {
      out.push({ op: "Z" });
      x = startX;
      y = startY;
      lastCtrl = null;
      continue;
    }
    const arity = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 }[upper] ?? 0;
    if (!arity || args.length % arity !== 0 || !args.length) throw new Error(`Bad arguments for ${cmd}: ${args.join(" ")}`);
    for (let i = 0; i < args.length; i += arity) {
      const a = args.slice(i, i + arity);
      switch (upper) {
        case "M":
          x = a[0] + ox();
          y = a[1] + oy();
          // Extra pairs after a moveto are implicit linetos.
          if (i === 0) {
            out.push({ op: "M", x, y });
            startX = x;
            startY = y;
          } else out.push({ op: "L", x, y });
          lastCtrl = null;
          break;
        case "L":
          x = a[0] + ox();
          y = a[1] + oy();
          out.push({ op: "L", x, y });
          lastCtrl = null;
          break;
        case "H":
          x = a[0] + ox();
          out.push({ op: "L", x, y });
          lastCtrl = null;
          break;
        case "V":
          y = a[0] + oy();
          out.push({ op: "L", x, y });
          lastCtrl = null;
          break;
        case "C": {
          const s: Segment = { op: "C", x1: a[0] + ox(), y1: a[1] + oy(), x2: a[2] + ox(), y2: a[3] + oy(), x: a[4] + ox(), y: a[5] + oy() };
          out.push(s);
          lastCtrl = { x: s.x2, y: s.y2, kind: "C" };
          x = s.x;
          y = s.y;
          break;
        }
        case "S": {
          const c1x: number = lastCtrl?.kind === "C" ? 2 * x - lastCtrl.x : x;
          const c1y: number = lastCtrl?.kind === "C" ? 2 * y - lastCtrl.y : y;
          const s: Segment = { op: "C", x1: c1x, y1: c1y, x2: a[0] + ox(), y2: a[1] + oy(), x: a[2] + ox(), y: a[3] + oy() };
          out.push(s);
          lastCtrl = { x: s.x2, y: s.y2, kind: "C" };
          x = s.x;
          y = s.y;
          break;
        }
        case "Q":
        case "T": {
          let qx: number;
          let qy: number;
          let ex: number;
          let ey: number;
          if (upper === "Q") {
            qx = a[0] + ox();
            qy = a[1] + oy();
            ex = a[2] + ox();
            ey = a[3] + oy();
          } else {
            qx = lastCtrl?.kind === "Q" ? 2 * x - lastCtrl.x : x;
            qy = lastCtrl?.kind === "Q" ? 2 * y - lastCtrl.y : y;
            ex = a[0] + ox();
            ey = a[1] + oy();
          }
          // Degree elevation: a quadratic is a cubic with controls 2/3 of the way to the quadratic control.
          out.push({ op: "C", x1: x + (2 / 3) * (qx - x), y1: y + (2 / 3) * (qy - y), x2: ex + (2 / 3) * (qx - ex), y2: ey + (2 / 3) * (qy - ey), x: ex, y: ey });
          lastCtrl = { x: qx, y: qy, kind: "Q" };
          x = ex;
          y = ey;
          break;
        }
        case "A": {
          const ex = a[5] + ox();
          const ey = a[6] + oy();
          out.push(...arcToCubics(x, y, a[0], a[1], a[2], a[3] !== 0, a[4] !== 0, ex, ey));
          x = ex;
          y = ey;
          lastCtrl = null;
          break;
        }
      }
    }
  }
  return out;
}

/** Bézier constant for a quarter circle. */
const KAPPA = 0.5522847498307936;

export function ellipsePath(cx: number, cy: number, rx: number, ry: number): Segment[] {
  if (rx <= 0 || ry <= 0) return [];
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  return [
    { op: "M", x: cx + rx, y: cy },
    { op: "C", x1: cx + rx, y1: cy + ky, x2: cx + kx, y2: cy + ry, x: cx, y: cy + ry },
    { op: "C", x1: cx - kx, y1: cy + ry, x2: cx - rx, y2: cy + ky, x: cx - rx, y: cy },
    { op: "C", x1: cx - rx, y1: cy - ky, x2: cx - kx, y2: cy - ry, x: cx, y: cy - ry },
    { op: "C", x1: cx + kx, y1: cy - ry, x2: cx + rx, y2: cy - ky, x: cx + rx, y: cy },
    { op: "Z" },
  ];
}

/** A rectangle with optional corner radii (SVG rules: a missing radius copies the other, both clamp to half). */
export function rectPath(x: number, y: number, w: number, h: number, rxIn = 0, ryIn = rxIn): Segment[] {
  if (w <= 0 || h <= 0) return [];
  const rx = Math.min(Math.max(rxIn, 0), w / 2);
  const ry = Math.min(Math.max(ryIn, 0), h / 2);
  if (!rx || !ry) {
    return [{ op: "M", x, y }, { op: "L", x: x + w, y }, { op: "L", x: x + w, y: y + h }, { op: "L", x, y: y + h }, { op: "Z" }];
  }
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  const r = x + w;
  const b = y + h;
  return [
    { op: "M", x: x + rx, y },
    { op: "L", x: r - rx, y },
    { op: "C", x1: r - rx + kx, y1: y, x2: r, y2: y + ry - ky, x: r, y: y + ry },
    { op: "L", x: r, y: b - ry },
    { op: "C", x1: r, y1: b - ry + ky, x2: r - rx + kx, y2: b, x: r - rx, y: b },
    { op: "L", x: x + rx, y: b },
    { op: "C", x1: x + rx - kx, y1: b, x2: x, y2: b - ry + ky, x: x, y: b - ry },
    { op: "L", x, y: y + ry },
    { op: "C", x1: x, y1: y + ry - ky, x2: x + rx - kx, y2: y, x: x + rx, y },
    { op: "Z" },
  ];
}

export function polyPath(points: string, close: boolean): Segment[] {
  const n = (points.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []).map(Number);
  const out: Segment[] = [];
  for (let i = 0; i + 1 < n.length; i += 2) out.push({ op: i ? "L" : "M", x: n[i], y: n[i + 1] });
  if (close && out.length) out.push({ op: "Z" });
  return out;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Tight bounding box of the geometry (curve extrema included, stroke ignored), as SVG's getBBox(). */
export function pathBBox(segments: Segment[]): Box | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const add = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  // Roots in (0,1) of the derivative of a 1D cubic Bézier.
  const extrema = (p0: number, p1: number, p2: number, p3: number): number[] => {
    const a = -p0 + 3 * p1 - 3 * p2 + p3;
    const b = 2 * (p0 - 2 * p1 + p2);
    const c = p1 - p0;
    const ts: number[] = [];
    if (Math.abs(a) < 1e-12) {
      if (Math.abs(b) > 1e-12) ts.push(-c / b);
    } else {
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const s = Math.sqrt(disc);
        ts.push((-b + s) / (2 * a), (-b - s) / (2 * a));
      }
    }
    return ts.filter((t) => t > 0 && t < 1);
  };
  const at = (p0: number, p1: number, p2: number, p3: number, t: number) => {
    const u = 1 - t;
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
  };
  let x = 0;
  let y = 0;
  for (const s of segments) {
    if (s.op === "Z") continue;
    if (s.op === "C") {
      for (const t of [...extrema(x, s.x1, s.x2, s.x), ...extrema(y, s.y1, s.y2, s.y)]) {
        add(at(x, s.x1, s.x2, s.x, t), at(y, s.y1, s.y2, s.y, t));
      }
      if (x === s.x && y === s.y) add(x, y);
    }
    add(s.x, s.y);
    x = s.x;
    y = s.y;
  }
  if (minX === Infinity) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
