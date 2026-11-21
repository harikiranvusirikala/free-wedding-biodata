// The display list (BUILD_PLAN Step 0.2): every A4 page as positioned primitives, read from the laid-out HTML
// pages. One layout (the browser's) feeds every output: a vector PDF writer, a raster page image, a print.
// Coordinates are CSS px on a 794 × 1123 page (A4 at 96 px per inch), origin top-left.

export interface TextItem {
  kind: "text";
  /** Left edge of the line's first grapheme. */
  x: number;
  /** Baseline. */
  y: number;
  /** The browser's width for this run, for checking another engine's shaping against it. */
  width: number;
  text: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  color: string;
  letterSpacing: number;
}

export interface RectItem {
  kind: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
}

export interface ImageItem {
  kind: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  /** A data: URL (JPEG or PNG). */
  src: string;
  radius?: number;
}

export interface SvgItem {
  kind: "svg";
  x: number;
  y: number;
  width: number;
  height: number;
  /** Self-contained SVG markup with a viewBox. */
  markup: string;
}

export type DisplayItem = TextItem | RectItem | ImageItem | SvgItem;

export interface DisplayPage {
  width: number;
  height: number;
  background: string;
  lang: string;
  items: DisplayItem[];
}

export interface DisplayList {
  pages: DisplayPage[];
}

const TRANSPARENT = /^(transparent|rgba\(0, 0, 0, 0\))$/;

/** Ascent of a font in px, from canvas metrics (matches how the browser places the baseline in a line box). */
function ascentFor(font: string, ctx: CanvasRenderingContext2D, cache: Map<string, number>): number {
  let ascent = cache.get(font);
  if (ascent === undefined) {
    ctx.font = font;
    ascent = ctx.measureText("Hg").fontBoundingBoxAscent;
    cache.set(font, ascent);
  }
  return ascent;
}

/** Reads one laid-out page element (data-page) into a DisplayPage. */
export function readPage(pageEl: HTMLElement): DisplayPage {
  const origin = pageEl.getBoundingClientRect();
  const scale = origin.width / pageEl.offsetWidth || 1;
  const box = (r: DOMRect) => ({
    x: (r.left - origin.left) / scale,
    y: (r.top - origin.top) / scale,
    width: r.width / scale,
    height: r.height / scale,
  });
  const items: DisplayItem[] = [];
  const ctx = document.createElement("canvas").getContext("2d")!;
  const ascents = new Map<string, number>();
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

  const walk = (el: Element) => {
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") return;

    if (el instanceof SVGSVGElement) {
      const clone = el.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      items.push({ kind: "svg", ...box(el.getBoundingClientRect()), markup: clone.outerHTML });
      return;
    }
    if (el instanceof HTMLImageElement) {
      items.push({ kind: "image", ...box(el.getBoundingClientRect()), src: el.currentSrc || el.src, radius: parseFloat(style.borderTopLeftRadius) || 0 });
      return;
    }
    if (el !== pageEl) {
      const fill = TRANSPARENT.test(style.backgroundColor) ? undefined : style.backgroundColor;
      const borderWidth = parseFloat(style.borderTopWidth) || 0;
      const stroke = borderWidth > 0 && style.borderTopStyle !== "none" ? style.borderTopColor : undefined;
      if (fill || stroke) {
        items.push({ kind: "rect", ...box(el.getBoundingClientRect()), fill, stroke, strokeWidth: stroke ? borderWidth : undefined, radius: parseFloat(style.borderTopLeftRadius) || 0 });
      }
      // A bottom rule only (heading bars): drawn as a thin filled rect.
      const bottom = parseFloat(style.borderBottomWidth) || 0;
      if (!stroke && bottom > 0 && style.borderBottomStyle !== "none") {
        const r = box(el.getBoundingClientRect());
        items.push({ kind: "rect", x: r.x, y: r.y + r.height - bottom, width: r.width, height: bottom, fill: style.borderBottomColor });
      }
    }

    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) readText(child as Text, style);
      else if (child.nodeType === Node.ELEMENT_NODE) walk(child as Element);
    }
  };

  const readText = (node: Text, style: CSSStyleDeclaration) => {
    const data = node.data;
    if (!data.trim()) return;
    const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const ascent = ascentFor(font, ctx, ascents);
    const upper = style.textTransform === "uppercase";
    const range = document.createRange();
    let line: { top: number; x: number; right: number; text: string } | null = null;
    const flush = () => {
      if (line && line.text.trim()) {
        const text = line.text.replace(/\s+$/, "").replace(/^\s+/, "");
        items.push({
          kind: "text",
          x: line.x,
          y: line.top + ascent,
          width: line.right - line.x,
          text: upper ? text.toUpperCase() : text,
          fontFamily: style.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
          fontWeight: Number(style.fontWeight) || 400,
          fontSize: parseFloat(style.fontSize),
          color: style.color,
          letterSpacing: parseFloat(style.letterSpacing) || 0,
        });
      }
      line = null;
    };
    for (const { segment, index } of segmenter.segment(data)) {
      range.setStart(node, index);
      range.setEnd(node, index + segment.length);
      const rects = range.getClientRects();
      if (!rects.length) continue;
      const r = box(rects[0]);
      if (/^\s+$/.test(segment)) {
        if (line) line.text += segment;
        continue;
      }
      if (!line || Math.abs(r.y - line.top) > r.height * 0.5) {
        flush();
        line = { top: r.y, x: r.x, right: r.x + r.width, text: segment };
      } else {
        line.text += segment;
        line.right = Math.max(line.right, r.x + r.width);
      }
    }
    flush();
  };

  walk(pageEl);
  return {
    width: pageEl.offsetWidth,
    height: pageEl.offsetHeight,
    background: getComputedStyle(pageEl).backgroundColor,
    lang: pageEl.lang || pageEl.dataset.lang || "en",
    items,
  };
}

/** Every page element marked data-page inside `root`. */
export function readDisplayList(root: ParentNode = document): DisplayList {
  return { pages: [...root.querySelectorAll<HTMLElement>("[data-page]")].map(readPage) };
}
