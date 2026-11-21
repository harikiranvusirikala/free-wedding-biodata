// The display list (BUILD_PLAN A4, VISION D49): every laid-out A4 page as positioned primitives, read from the
// pages the browser already laid out ([data-page] elements, src/document/Page.tsx). One layout (the browser's)
// feeds every output: the vector PDF (write-pdf.ts), the page images (draw-page.ts) and print.
// Coordinates are CSS px on a 794 × 1123 page (A4 at 96 px per inch), origin top-left, whatever the page's
// on-screen scale.

export type TextAlign = "left" | "center" | "right" | "justify";

export interface TextItem {
  kind: "text";
  /** Left edge of the line's first grapheme. */
  x: number;
  /** Baseline, measured with the browser's own font metrics (a baseline probe per font). */
  y: number;
  /** The browser's width for this run: the anchor for centred, right-aligned and justified lines. */
  width: number;
  /** The text as drawn (after text-transform), white space collapsed, trimmed. */
  text: string;
  /** The CSS font stack, generic families dropped: the writer falls back per glyph through it like CSS does. */
  fontFamilies: string[];
  fontWeight: number;
  fontStyle: "normal" | "italic";
  fontSize: number;
  color: string;
  letterSpacing: number;
  /** The block's text-align (start/end resolved for left-to-right text). */
  align: TextAlign;
  /** The browser stretched this line's spaces to the full width (justified text, not its last line). */
  justified: boolean;
  /** Copy and paste: a space follows this run on the same line (separate runs such as a label and its value). */
  spaceAfter: boolean;
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

export type ImageFit = "fill" | "cover" | "contain";

export interface ImageItem {
  kind: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  /** The picture; the PDF writer needs a JPEG or PNG data: URL (createPdf converts anything else first). */
  src: string;
  radius?: number;
  /** object-fit (centred), with the picture's own size. */
  fit: ImageFit;
  naturalWidth: number;
  naturalHeight: number;
}

export interface SvgItem {
  kind: "svg";
  x: number;
  y: number;
  width: number;
  height: number;
  /** Self-contained SVG markup with a viewBox; ids renamed i0, i1, … in document order. */
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
const GENERIC = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace", "ui-rounded", "math", "emoji", "fangsong"]);
const PRESERVES_NEWLINES = new Set(["pre", "pre-wrap", "pre-line", "break-spaces"]);

/** A computed font-family list → family names, quotes removed, generic families dropped. */
export function fontFamilies(css: string): string[] {
  return css
    .split(",")
    .map((f) => f.trim().replace(/^["']|["']$/g, "").trim())
    .filter((f) => f && !GENERIC.has(f.toLowerCase()));
}

/** A computed text-align → left/center/right/justify (start and end resolved for the given direction). */
export function resolveAlign(textAlign: string, direction = "ltr"): TextAlign {
  const rtl = direction === "rtl";
  switch (textAlign) {
    case "center":
    case "-webkit-center":
      return "center";
    case "right":
    case "-webkit-right":
      return "right";
    case "justify":
      return "justify";
    case "end":
      return rtl ? "left" : "right";
    case "start":
      return rtl ? "right" : "left";
    default:
      return "left";
  }
}

/** Applies a computed text-transform to a run (Indic scripts have no case, so this only changes Latin text). */
export function transformText(text: string, transform: string, lang: string): string {
  if (transform === "uppercase") return text.toLocaleUpperCase(lang || undefined);
  if (transform === "lowercase") return text.toLocaleLowerCase(lang || undefined);
  if (transform === "capitalize") return text.replace(/(^|\s)(\p{L})/gu, (_, s: string, c: string) => s + c.toLocaleUpperCase(lang || undefined));
  return text;
}

/**
 * Renames every id in an SVG (and each `url(#…)` / `href="#…"` that points at it) to i0, i1, … in document order.
 * React's useId ids carry colons or «» that a reader might not take, and the same frame on two pages then has
 * identical markup, so the PDF stores it once.
 */
export function normalizeSvgIds(svg: Element): void {
  const all = [svg, ...svg.querySelectorAll("*")];
  const renamed = new Map<string, string>();
  for (const el of all) {
    const id = el.getAttribute("id");
    if (id && !renamed.has(id)) renamed.set(id, `i${renamed.size}`);
  }
  if (!renamed.size) return;
  for (const el of all) {
    for (const attr of [...el.attributes]) {
      const value = attr.value;
      if (attr.name === "id") {
        el.setAttribute("id", renamed.get(value) ?? value);
        continue;
      }
      if (!value.includes("#")) continue;
      let next = value;
      for (const [from, to] of renamed) {
        next = next.split(`url(#${from})`).join(`url(#${to})`).split(`url("#${from}")`).join(`url("#${to}")`).split(`url('#${from}')`).join(`url('#${to}')`);
        if (next === `#${from}`) next = `#${to}`;
      }
      if (next !== value) el.setAttribute(attr.name, next);
    }
  }
}

/**
 * Where the baseline sits below the top of a text run's box, for one font: measured once per font by the browser
 * itself (an empty inline-block on the baseline next to a text node in that font), so it includes the browser's
 * own rounding of ascent and descent. Text boxes (Range.getClientRects) span the primary font's ascent + descent
 * whatever the line height, so baseline = box top + this offset.
 */
function baselineProbe(doc: Document) {
  const cache = new Map<string, number>();
  let host: HTMLDivElement | null = null;
  return {
    offset(style: CSSStyleDeclaration): number {
      const key = `${style.fontStyle}|${style.fontWeight}|${style.fontSize}|${style.fontFamily}`;
      let offset = cache.get(key);
      if (offset !== undefined) return offset;
      if (!host) {
        host = doc.createElement("div");
        host.setAttribute("aria-hidden", "true");
        host.style.cssText = "position:absolute;left:-10000px;top:0;visibility:hidden;white-space:nowrap;line-height:normal;";
        doc.body.appendChild(host);
      }
      const span = doc.createElement("span");
      span.style.fontFamily = style.fontFamily;
      span.style.fontSize = style.fontSize;
      span.style.fontWeight = style.fontWeight;
      span.style.fontStyle = style.fontStyle;
      span.style.lineHeight = style.lineHeight;
      const text = doc.createTextNode("x");
      const marker = doc.createElement("span");
      marker.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline;";
      span.append(text, marker);
      host.appendChild(span);
      const range = doc.createRange();
      range.selectNodeContents(text);
      const box = range.getClientRects()[0] ?? range.getBoundingClientRect();
      offset = marker.getBoundingClientRect().bottom - box.top;
      span.remove();
      cache.set(key, offset);
      return offset;
    },
    dispose() {
      host?.remove();
      host = null;
    },
  };
}

type Probe = ReturnType<typeof baselineProbe>;

/** Reads one laid-out page element (data-page) into a DisplayPage. */
function readPageWith(pageEl: HTMLElement, probe: Probe): DisplayPage {
  const origin = pageEl.getBoundingClientRect();
  const scale = origin.width / pageEl.offsetWidth || 1;
  const box = (r: DOMRect) => ({
    x: (r.left - origin.left) / scale,
    y: (r.top - origin.top) / scale,
    width: r.width / scale,
    height: r.height / scale,
  });
  const items: DisplayItem[] = [];
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const lang = pageEl.lang || pageEl.dataset.lang || "en";

  // The last text run pushed, to tell whether the next one continues its line (for spaceAfter).
  let last: { item: TextItem; top: number; right: number; trailingSpace: boolean } | null = null;
  let pendingSpace = false;
  const sameLine = (top: number, height: number) => !!last && Math.abs(top - last.top) < height * 0.5;

  const walk = (el: Element) => {
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") return;

    if (el instanceof SVGSVGElement) {
      const clone = el.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.removeAttribute("class");
      clone.removeAttribute("style");
      if (!clone.getAttribute("color")) clone.setAttribute("color", style.color);
      normalizeSvgIds(clone);
      items.push({ kind: "svg", ...box(el.getBoundingClientRect()), markup: clone.outerHTML });
      return;
    }
    if (el instanceof HTMLImageElement) {
      const fit = style.objectFit === "cover" || style.objectFit === "contain" ? style.objectFit : "fill";
      items.push({
        kind: "image",
        ...box(el.getBoundingClientRect()),
        src: el.currentSrc || el.src,
        radius: parseFloat(style.borderTopLeftRadius) || 0,
        fit,
        naturalWidth: el.naturalWidth,
        naturalHeight: el.naturalHeight,
      });
      return;
    }
    if (el !== pageEl) {
      const fill = TRANSPARENT.test(style.backgroundColor) ? undefined : style.backgroundColor;
      const borderWidth = parseFloat(style.borderTopWidth) || 0;
      const stroke = borderWidth > 0 && style.borderTopStyle !== "none" ? style.borderTopColor : undefined;
      if (fill || stroke) {
        items.push({ kind: "rect", ...box(el.getBoundingClientRect()), fill, stroke, strokeWidth: stroke ? borderWidth : undefined, radius: parseFloat(style.borderTopLeftRadius) || 0 });
      }
      // A bottom rule only (heading underlines): drawn as a thin filled rect.
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
    const range = document.createRange();
    if (!data.trim()) {
      // A white-space-only node between two runs (e.g. `<b>Name</b> <span>…</span>`): a space, if rendered.
      range.selectNodeContents(node);
      if ([...range.getClientRects()].some((r) => r.width > 0)) pendingSpace = true;
      return;
    }
    const ascent = probe.offset(style);
    const align = resolveAlign(style.textAlign, style.direction);
    const justifyAll = style.textAlignLast === "justify";
    const keepsNewlines = PRESERVES_NEWLINES.has(style.whiteSpace);
    const fontSize = parseFloat(style.fontSize);
    const base = {
      fontFamilies: fontFamilies(style.fontFamily),
      fontWeight: Number(style.fontWeight) || 400,
      fontStyle: (style.fontStyle === "italic" || style.fontStyle.startsWith("oblique") ? "italic" : "normal") as TextItem["fontStyle"],
      fontSize,
      color: style.color,
      letterSpacing: parseFloat(style.letterSpacing) || 0,
      align,
    };

    interface Line {
      top: number;
      height: number;
      x: number;
      right: number;
      text: string;
      leadingSpace: boolean;
      trailingSpace: boolean;
      forcedBreak: boolean;
    }
    const lines: Line[] = [];
    let line: Line | null = null;
    for (const { segment, index } of segmenter.segment(data)) {
      range.setStart(node, index);
      range.setEnd(node, index + segment.length);
      if (/^\s+$/.test(segment)) {
        if (keepsNewlines && segment.includes("\n")) {
          if (line) line.forcedBreak = true;
          line = null;
          continue;
        }
        const r = range.getClientRects()[0];
        const rendered = !!r && r.width > 0;
        if (line) {
          line.text += " ";
          if (rendered) line.trailingSpace = true;
        } else if (rendered && !lines.length) {
          // Leading white space of the node, rendered on the line of the run before.
          pendingSpace = true;
        }
        continue;
      }
      const rects = range.getClientRects();
      if (!rects.length) continue;
      const r = box(rects[0]);
      if (!line || Math.abs(r.y - line.top) > r.height * 0.5) {
        line = { top: r.y, height: r.height, x: r.x, right: r.x + r.width, text: segment, leadingSpace: false, trailingSpace: false, forcedBreak: false };
        lines.push(line);
      } else {
        line.text += segment;
        line.trailingSpace = false;
        line.right = Math.max(line.right, r.x + r.width);
      }
    }

    lines.forEach((l, i) => {
      const text = transformText(l.text.replace(/\s+/g, " ").trim(), style.textTransform, lang);
      if (!text) return;
      const lastLine = i === lines.length - 1;
      const item: TextItem = {
        kind: "text",
        x: l.x,
        y: l.top + ascent,
        width: l.right - l.x,
        text,
        ...base,
        justified: align === "justify" && text.includes(" ") && (justifyAll || (!lastLine && !l.forcedBreak)),
        spaceAfter: false,
      };
      if (last && sameLine(l.top, l.height) && l.x >= last.right - 0.5) {
        const gap = l.x - last.right;
        if (pendingSpace || last.trailingSpace || gap >= fontSize * 0.2) last.item.spaceAfter = true;
      }
      pendingSpace = false;
      items.push(item);
      last = { item, top: l.top, right: l.right, trailingSpace: l.trailingSpace };
    });
  };

  walk(pageEl);
  return {
    width: pageEl.offsetWidth,
    height: pageEl.offsetHeight,
    background: getComputedStyle(pageEl).backgroundColor,
    lang,
    items,
  };
}

/** Reads one laid-out page element (data-page) into a DisplayPage. */
export function readPage(pageEl: HTMLElement): DisplayPage {
  const probe = baselineProbe(pageEl.ownerDocument);
  try {
    return readPageWith(pageEl, probe);
  } finally {
    probe.dispose();
  }
}

/** Every page element marked data-page inside `root`, in document order. */
export function readDisplayList(root: ParentNode = document): DisplayList {
  const pages = [...root.querySelectorAll<HTMLElement>("[data-page]")];
  const probe = baselineProbe(pages[0]?.ownerDocument ?? document);
  try {
    return { pages: pages.map((el) => readPageWith(el, probe)) };
  } finally {
    probe.dispose();
  }
}
