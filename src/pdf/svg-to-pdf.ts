// SVG markup → PDF vector operators. Supports what generated ornaments use: path (all commands), circle, ellipse,
// rect, line, polyline, polygon, nested g, element transforms, inherited presentation attributes (and the same
// properties in a style attribute), fill/stroke colours, stroke width/cap/join/miter/dash, fill-rule, opacities,
// and linearGradient fills and strokes as real PDF axial shadings (through the resources callback).
// Not supported (reported through `warn`): text, use, image, clipPath, mask, filter, pattern, radialGradient.

import { parseColor, num, rgbOps, type Rgba } from "./color";
import { IDENTITY, multiply, parseTransform, translate, type Matrix } from "./matrix";
import { ellipsePath, parsePath, pathBBox, polyPath, rectPath, type Box, type Segment } from "./svg-path";
import { parseXml, type XmlElement } from "./xml";

export interface GradientStop {
  offset: number;
  color: Rgba;
}

export interface LinearGradient {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stops: GradientStop[];
  /** Maps gradient space to the painted element's user space (bounding-box mapping included). */
  matrix: Matrix;
}

export interface SvgResources {
  /** Returns the resource name of a shading pattern; `toPage` maps gradient space to the page's default space. */
  pattern(gradient: LinearGradient, toPage: Matrix): string;
  /** Returns the resource name of an ExtGState with these constant alphas. */
  alpha(fill: number, stroke: number): string;
}

interface Paint {
  fill: string;
  stroke: string;
  strokeWidth: number;
  lineCap: string;
  lineJoin: string;
  miterLimit: number;
  dash: string;
  fillRule: string;
  fillOpacity: number;
  strokeOpacity: number;
  color: string;
}

const INITIAL: Paint = {
  fill: "black",
  stroke: "none",
  strokeWidth: 1,
  lineCap: "butt",
  lineJoin: "miter",
  miterLimit: 4,
  dash: "none",
  fillRule: "nonzero",
  fillOpacity: 1,
  strokeOpacity: 1,
  color: "black",
};

const PROPS: Record<string, keyof Paint> = {
  fill: "fill",
  stroke: "stroke",
  "stroke-width": "strokeWidth",
  "stroke-linecap": "lineCap",
  "stroke-linejoin": "lineJoin",
  "stroke-miterlimit": "miterLimit",
  "stroke-dasharray": "dash",
  "fill-rule": "fillRule",
  "fill-opacity": "fillOpacity",
  "stroke-opacity": "strokeOpacity",
  color: "color",
};

const NUMERIC = new Set<keyof Paint>(["strokeWidth", "miterLimit", "fillOpacity", "strokeOpacity"]);

/** Attributes plus style="a: b; c: d" declarations (style wins, as in CSS). */
function styleOf(el: XmlElement): Record<string, string> {
  const out: Record<string, string> = { ...el.attrs };
  for (const decl of (el.attrs.style ?? "").split(";")) {
    const i = decl.indexOf(":");
    if (i > 0) out[decl.slice(0, i).trim()] = decl.slice(i + 1).trim();
  }
  return out;
}

const length = (v: string | undefined, fallback = 0) => {
  if (v === undefined) return fallback;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

const fraction = (v: string | undefined, fallback: number) => {
  if (v === undefined) return fallback;
  return v.trim().endsWith("%") ? parseFloat(v) / 100 : parseFloat(v);
};

function segmentsToOps(segments: Segment[]): string {
  const out: string[] = [];
  for (const s of segments) {
    if (s.op === "M") out.push(`${num(s.x)} ${num(s.y)} m`);
    else if (s.op === "L") out.push(`${num(s.x)} ${num(s.y)} l`);
    else if (s.op === "C") out.push(`${num(s.x1)} ${num(s.y1)} ${num(s.x2)} ${num(s.y2)} ${num(s.x)} ${num(s.y)} c`);
    else out.push("h");
  }
  return out.join("\n");
}

interface GradientDef {
  el: XmlElement;
}

/**
 * A paint `url(#id) fallback`. Ids may be quoted or CSS-escaped, and may hold characters such as the colons and «»
 * of React's useId ("url(#:r1:)", "url(#\:r1\:)", "url('#«r1»')").
 */
export function paintUrl(value: string): { id: string; fallback: string } | null {
  const m = /^url\(\s*(?:"#((?:\\.|[^"\\])*)"|'#((?:\\.|[^'\\])*)'|#((?:\\.|[^)\\\s])*))\s*\)\s*(.*)$/.exec(value.trim());
  if (!m) return null;
  const raw = m[1] ?? m[2] ?? m[3];
  const id = raw.replace(/\\([0-9a-fA-F]{1,6})\s?|\\(.)/g, (_, hex: string | undefined, ch: string | undefined) => (hex ? String.fromCodePoint(parseInt(hex, 16)) : ch!));
  return { id, fallback: m[4].trim() };
}

/** Shape geometry for a drawable element, or null for non-shapes. */
function geometry(el: XmlElement): Segment[] | null {
  const a = el.attrs;
  switch (el.name) {
    case "path":
      return a.d ? parsePath(a.d) : [];
    case "circle": {
      const r = length(a.r);
      return ellipsePath(length(a.cx), length(a.cy), r, r);
    }
    case "ellipse":
      return ellipsePath(length(a.cx), length(a.cy), length(a.rx), length(a.ry));
    case "rect": {
      const rx = a.rx !== undefined ? length(a.rx) : a.ry !== undefined ? length(a.ry) : 0;
      const ry = a.ry !== undefined ? length(a.ry) : rx;
      return rectPath(length(a.x), length(a.y), length(a.width), length(a.height), rx, ry);
    }
    case "line":
      return [
        { op: "M", x: length(a.x1), y: length(a.y1) },
        { op: "L", x: length(a.x2), y: length(a.y2) },
      ];
    case "polyline":
      return polyPath(a.points ?? "", false);
    case "polygon":
      return polyPath(a.points ?? "", true);
    default:
      return null;
  }
}

/** The viewBox → viewport mapping (preserveAspectRatio: none, or any xMin/xMid/xMax + meet/slice). */
export function viewBoxMatrix(svg: XmlElement, box: Box): Matrix {
  const vb = (svg.attrs.viewBox ?? "").split(/[\s,]+/).filter(Boolean).map(Number);
  const [vx, vy, vw, vh] =
    vb.length === 4 && vb[2] > 0 && vb[3] > 0 ? vb : [0, 0, length(svg.attrs.width, box.width), length(svg.attrs.height, box.height)];
  const par = (svg.attrs.preserveAspectRatio ?? "xMidYMid meet").trim();
  let sx = box.width / vw;
  let sy = box.height / vh;
  let tx = box.x;
  let ty = box.y;
  if (!par.startsWith("none")) {
    const s = par.includes("slice") ? Math.max(sx, sy) : Math.min(sx, sy);
    const align = par.split(/\s+/)[0];
    const fx = align.includes("xMid") ? 0.5 : align.includes("xMax") ? 1 : 0;
    const fy = align.includes("YMid") ? 0.5 : align.includes("YMax") ? 1 : 0;
    tx += (box.width - vw * s) * fx;
    ty += (box.height - vh * s) * fy;
    sx = sy = s;
  }
  return multiply(translate(-vx, -vy), [sx, 0, 0, sy, tx, ty]);
}

/**
 * Converts SVG markup placed at `box` (page px) into content-stream operators in page px.
 * `pageToDefault` maps page px to the page's default PDF space (needed for pattern matrices).
 */
export function svgToPdf(markup: string, box: Box, pageToDefault: Matrix, res: SvgResources, warn: (message: string) => void = () => {}): string {
  const svg = parseXml(markup);
  if (svg.name !== "svg") throw new Error(`Expected <svg>, got <${svg.name}>`);
  const gradients = new Map<string, GradientDef>();
  const collect = (el: XmlElement) => {
    if (el.name === "linearGradient" && el.attrs.id) gradients.set(el.attrs.id, { el });
    if (el.name === "radialGradient" && el.attrs.id) warn(`radialGradient #${el.attrs.id} not supported`);
    el.children.forEach(collect);
  };
  collect(svg);
  const warned = new Set<string>();
  const warnOnce = (m: string) => {
    if (!warned.has(m)) {
      warned.add(m);
      warn(m);
    }
  };

  /** Resolves a gradient's attributes and stops, following href chains. */
  const resolveGradient = (id: string) => {
    const attrs: Record<string, string> = {};
    let stops: XmlElement[] = [];
    const seen = new Set<string>();
    let cur: GradientDef | undefined = gradients.get(id);
    while (cur && !seen.has(cur.el.attrs.id)) {
      seen.add(cur.el.attrs.id);
      for (const [k, v] of Object.entries(cur.el.attrs)) if (!(k in attrs)) attrs[k] = v;
      if (!stops.length) stops = cur.el.children.filter((c) => c.name === "stop");
      const href = cur.el.attrs.href ?? cur.el.attrs["xlink:href"];
      cur = href?.startsWith("#") ? gradients.get(href.slice(1)) : undefined;
    }
    if (!seen.size) return null;
    let last = 0;
    const parsed: GradientStop[] = stops.map((s) => {
      const st = styleOf(s);
      const offset = Math.min(1, Math.max(last, fraction(st.offset, 0)));
      last = offset;
      const color = parseColor(st["stop-color"] ?? "black") ?? { r: 0, g: 0, b: 0, a: 0 };
      const opacity = st["stop-opacity"] !== undefined ? parseFloat(st["stop-opacity"]) : 1;
      if (opacity * color.a < 1) warnOnce(`gradient #${id}: stop opacity ignored`);
      return { offset, color };
    });
    return { attrs, stops: parsed };
  };

  const out: string[] = [];
  const baseMatrix = viewBoxMatrix(svg, box);
  out.push("q", `${baseMatrix.map(num).join(" ")} cm`);

  /** Sets fill or stroke colour; returns false when there is nothing to paint. */
  const setPaint = (value: string, paint: Paint, stroke: boolean, bbox: Box | null, ctm: Matrix): boolean => {
    const v = value.trim();
    const url = paintUrl(v);
    if (url) {
      const g = resolveGradient(url.id);
      const fallback = url.fallback;
      if (!g || !g.stops.length) return fallback ? setPaint(fallback, paint, stroke, bbox, ctm) : false;
      const userSpace = g.attrs.gradientUnits === "userSpaceOnUse";
      if (!userSpace && (!bbox || bbox.width === 0 || bbox.height === 0)) {
        // SVG: an objectBoundingBox paint server on an element without width or height isn't rendered.
        return fallback ? setPaint(fallback, paint, stroke, bbox, ctm) : false;
      }
      if (g.stops.length === 1) {
        out.push(rgbOps(g.stops[0].color, stroke));
        return true;
      }
      const units = userSpace ? IDENTITY : ([bbox!.width, 0, 0, bbox!.height, bbox!.x, bbox!.y] as Matrix);
      const gt = parseTransform(g.attrs.gradientTransform);
      const toUser = multiply(gt, units);
      const pick = (k: string, d: number) => (userSpace ? length(g.attrs[k], d) : fraction(g.attrs[k], d));
      const gradient: LinearGradient = {
        x1: pick("x1", 0),
        y1: pick("y1", 0),
        x2: pick("x2", userSpace ? 0 : 1),
        y2: pick("y2", 0),
        stops: g.stops,
        matrix: toUser,
      };
      if (g.attrs.spreadMethod && g.attrs.spreadMethod !== "pad") warnOnce(`gradient #${url.id}: spreadMethod ${g.attrs.spreadMethod} drawn as pad`);
      const name = res.pattern(gradient, multiply(toUser, ctm));
      out.push(stroke ? `/Pattern CS /${name} SCN` : `/Pattern cs /${name} scn`);
      return true;
    }
    const color = parseColor(v === "currentColor" ? paint.color : v);
    if (!color || color.a === 0) return false;
    out.push(rgbOps(color, stroke));
    return true;
  };

  const draw = (el: XmlElement, inherited: Paint, ctm: Matrix, opacity: number) => {
    const st = styleOf(el);
    if (st.display === "none" || st.visibility === "hidden") return;
    if (["defs", "linearGradient", "radialGradient", "title", "desc", "metadata", "style", "clipPath", "mask", "symbol", "marker", "pattern", "filter"].includes(el.name)) {
      if (["clipPath", "mask", "filter", "pattern", "marker"].includes(el.name)) warnOnce(`<${el.name}> not supported (ignored)`);
      return;
    }
    const paint: Paint = { ...inherited };
    for (const [attr, key] of Object.entries(PROPS)) {
      const v = st[attr];
      if (v === undefined || v === "inherit") continue;
      if (NUMERIC.has(key)) (paint[key] as number) = parseFloat(v);
      else (paint[key] as string) = v;
    }
    const groupOpacity = opacity * (st.opacity !== undefined ? parseFloat(st.opacity) : 1);
    if (st.opacity !== undefined && el.children.length > 1) warnOnce("group opacity applied per shape (overlaps differ)");
    const local = el === svg ? IDENTITY : parseTransform(st.transform);
    const elementCtm = multiply(local, ctm);
    const hasTransform = local !== IDENTITY;
    if (hasTransform) out.push("q", `${local.map(num).join(" ")} cm`);

    if (el.name === "svg" || el.name === "g" || el.name === "a" || el.name === "switch") {
      if (el !== svg && el.name === "svg") warnOnce("nested <svg> drawn without its own viewport");
      for (const child of el.children) draw(child, paint, elementCtm, groupOpacity);
    } else {
      const segments = geometry(el);
      if (!segments) warnOnce(`<${el.name}> not supported (ignored)`);
      else if (segments.length) {
        const bbox = pathBBox(segments);
        const ops = segmentsToOps(segments);
        const fillAlpha = groupOpacity * paint.fillOpacity;
        const strokeAlpha = groupOpacity * paint.strokeOpacity;
        out.push("q");
        const fill = el.name !== "line" && fillAlpha > 0 && setPaint(paint.fill, paint, false, bbox, elementCtm);
        const stroke = paint.strokeWidth > 0 && strokeAlpha > 0 && setPaint(paint.stroke, paint, true, bbox, elementCtm);
        if (fill || stroke) {
          if (fillAlpha < 1 || strokeAlpha < 1) out.push(`/${res.alpha(fill ? fillAlpha : 1, stroke ? strokeAlpha : 1)} gs`);
          if (stroke) {
            out.push(`${num(paint.strokeWidth)} w`);
            out.push(`${{ round: 1, square: 2 }[paint.lineCap] ?? 0} J`);
            out.push(`${{ round: 1, bevel: 2 }[paint.lineJoin] ?? 0} j`);
            out.push(`${num(paint.miterLimit)} M`);
            const dash = paint.dash === "none" ? [] : (paint.dash.match(/[\d.]+/g) ?? []).map(Number);
            if (dash.length && dash.some((d) => d > 0)) {
              const even = dash.length % 2 ? [...dash, ...dash] : dash;
              out.push(`[${even.map(num).join(" ")}] 0 d`);
            }
          }
          out.push(ops);
          const evenOdd = paint.fillRule === "evenodd" ? "*" : "";
          out.push(fill && stroke ? `B${evenOdd}` : fill ? `f${evenOdd}` : "S");
        }
        out.push("Q");
      }
    }
    if (hasTransform) out.push("Q");
  };

  draw(svg, INITIAL, multiply(baseMatrix, pageToDefault), 1);
  out.push("Q");
  return out.join("\n");
}

