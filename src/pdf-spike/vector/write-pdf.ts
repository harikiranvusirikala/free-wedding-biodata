// Candidate C (BUILD_PLAN Step 0.2): a vector PDF writer driven by the browser's own layout. The display list gives
// every line of text with its position (lines, wrapping and positions are Chrome's); this writer shapes each line
// with HarfBuzz using the same TTF, draws the glyph IDs with pdf-lib's low-level objects (Type0 / CIDFontType2,
// Identity-H, fonts subset with glyph IDs kept), wraps each line in an /ActualText span for copy and paste, and
// converts rects, images and SVG to PDF operators. Runs the same in the browser and in Node.

import { PDFDocument, PDFName, PDFString, type PDFRef, type PDFDict, type PDFContext } from "pdf-lib";
import type { DisplayList, DisplayPage, ImageItem, RectItem, TextItem } from "../display-list";
import { num, parseColor, rgbOps, type Rgba } from "./color";
import { IDENTITY, type Matrix } from "./matrix";
import { rectPath, type Segment } from "./svg-path";
import { svgToPdf, type LinearGradient } from "./svg-to-pdf";
import { loadShapingFont, shapeRun, type HarfBuzzModule, type ShapingFont } from "./shape";
import { createSubsetter, type Subsetter } from "./subset";

export const A4_WIDTH_PT = 595.28;
export const A4_HEIGHT_PT = 841.89;
const PX_TO_PT = 72 / 96;

export interface RunMeasure {
  page: number;
  text: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  /** The browser's width (px). */
  browserWidth: number;
  /** HarfBuzz's advance with letter spacing (px). */
  shapedWidth: number;
  /** (shaped − browser) / browser. */
  ratio: number;
  glyphs: number;
  codePoints: number;
  fallback: boolean;
  /** The line was treated as justified (spaces widened to Chrome's width). */
  justified?: boolean;
}

export interface WritePdfOptions {
  /** harfbuzz-subset.wasm bytes (or a loader). Without it fonts are embedded whole. */
  subsetWasm?: ArrayBuffer | Uint8Array | (() => Promise<ArrayBuffer | Uint8Array>);
  /** The harfbuzzjs module, if already loaded; otherwise it is imported lazily. */
  harfbuzz?: HarfBuzzModule;
  /** Families tried after the run's own family for characters it lacks (CSS fallback). */
  fallbackFamilies?: string[];
  /** Relative width difference above which a run is reported to onMismatch (default 0.015). */
  widthTolerance?: number;
  onRun?: (m: RunMeasure) => void;
  onMismatch?: (m: RunMeasure) => void;
  onWarning?: (message: string) => void;
  title?: string;
}

export type FontLoader = (family: string, weight: number) => Promise<ArrayBuffer | Uint8Array>;

/** Page px (y down) → PDF default space (pt, y up). */
const PAGE_MATRIX: Matrix = [PX_TO_PT, 0, 0, -PX_TO_PT, 0, A4_HEIGHT_PT];

const pathOps = (segments: Segment[]) =>
  segments
    .map((s) =>
      s.op === "M"
        ? `${num(s.x)} ${num(s.y)} m`
        : s.op === "L"
          ? `${num(s.x)} ${num(s.y)} l`
          : s.op === "C"
            ? `${num(s.x1)} ${num(s.y1)} ${num(s.x2)} ${num(s.y2)} ${num(s.x)} ${num(s.y)} c`
            : "h",
    )
    .join("\n");

/** UTF-16BE hex with BOM, for /ActualText and ToUnicode. */
function utf16Hex(text: string, bom: boolean): string {
  let out = bom ? "FEFF" : "";
  for (let i = 0; i < text.length; i++) out += text.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase();
  return out;
}

const hex4 = (n: number) => n.toString(16).padStart(4, "0").toUpperCase();

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === "function") {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  throw new Error("No base64 decoder");
}

/** Collapses CSS white space the way `white-space: normal` renders it. */
const collapse = (s: string) => s.replace(/[ \t\n\r\f]+/g, " ").trim();

interface FontMetrics {
  bbox: [number, number, number, number];
  ascent: number;
  descent: number;
  capHeight: number;
  postScriptName: string;
}

function readMetrics(font: ShapingFont): FontMetrics {
  const k = 1000 / font.upem;
  const head = font.face.referenceTable("head");
  const hhea = font.face.referenceTable("hhea");
  const os2 = font.face.referenceTable("OS/2");
  const i16 = (t: Uint8Array | undefined, o: number) => (t && t.length >= o + 2 ? new DataView(t.buffer, t.byteOffset, t.byteLength).getInt16(o) : 0);
  const bbox: [number, number, number, number] = [i16(head, 36) * k, i16(head, 38) * k, i16(head, 40) * k, i16(head, 42) * k];
  const ascent = i16(hhea, 4) * k;
  const descent = i16(hhea, 6) * k;
  const capHeight = os2 && os2.length >= 90 && new DataView(os2.buffer, os2.byteOffset).getUint16(0) >= 2 ? i16(os2, 88) * k : ascent * 0.7;
  let postScriptName = "";
  try {
    postScriptName = font.face.getName(6, "en");
  } catch {
    // HB_TINY builds may lack name lookup.
  }
  if (!postScriptName) postScriptName = `${font.family.replace(/\s+/g, "")}-${font.weight >= 600 ? "Bold" : "Regular"}`;
  return { bbox, ascent, descent, capHeight, postScriptName: postScriptName.replace(/[^\x21-\x7e]|[()<>[\]{}/%#]/g, "") };
}

/** Six capital letters from a hash of the glyph set (PDF subset tag). */
function subsetTag(gids: number[], name: string): string {
  let h = 2166136261;
  for (const n of [...gids, ...[...name].map((c) => c.charCodeAt(0))]) {
    h ^= n;
    h = Math.imul(h, 16777619) >>> 0;
  }
  let tag = "";
  for (let i = 0; i < 6; i++) {
    tag += String.fromCharCode(65 + (h % 26));
    h = Math.floor(h / 26) + i * 7919;
  }
  return tag;
}

function toUnicodeCMap(used: Map<number, string | null>): string {
  const entries = [...used].filter((e): e is [number, string] => !!e[1]).sort((a, b) => a[0] - b[0]);
  const blocks: string[] = [];
  for (let i = 0; i < entries.length; i += 100) {
    const chunk = entries.slice(i, i + 100);
    blocks.push(`${chunk.length} beginbfchar\n${chunk.map(([g, t]) => `<${hex4(g)}> <${utf16Hex(t, false)}>`).join("\n")}\nendbfchar`);
  }
  return [
    "/CIDInit /ProcSet findresource begin",
    "12 dict begin",
    "begincmap",
    "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
    "/CMapName /Adobe-Identity-UCS def",
    "/CMapType 2 def",
    "1 begincodespacerange",
    "<0000> <FFFF>",
    "endcodespacerange",
    ...blocks,
    "endcmap",
    "CMapName currentdict /CMap defineresource pop",
    "end",
    "end",
  ].join("\n");
}

/** The /W array: runs of consecutive glyph IDs with their widths (1/1000 em). */
function widthsArray(font: ShapingFont, gids: number[]): (number | number[])[] {
  const out: (number | number[])[] = [];
  let run: number[] = [];
  let start = -1;
  let prev = -2;
  for (const g of gids) {
    if (g !== prev + 1) {
      if (run.length) out.push(start, run);
      run = [];
      start = g;
    }
    run.push(Math.round((font.advance(g) * 1000) / font.upem * 100) / 100);
    prev = g;
  }
  if (run.length) out.push(start, run);
  return out;
}

/** Width in 1/1000 em as written to /W, so TJ adjustments match what the viewer advances. */
const pdfWidth = (font: ShapingFont, gid: number) => Math.round((font.advance(gid) * 1000) / font.upem * 100) / 100;

function embedFont(context: PDFContext, font: ShapingFont, subsetter: Subsetter | null, warn: (m: string) => void): PDFRef {
  const gids = [...font.used.keys()].sort((a, b) => a - b);
  const metrics = readMetrics(font);
  let file = font.bytes;
  let baseName = metrics.postScriptName;
  if (subsetter) {
    try {
      file = subsetter.subset(font.bytes, gids);
      baseName = `${subsetTag(gids, baseName)}+${baseName}`;
    } catch (e) {
      warn(`Subsetting ${font.key} failed (${(e as Error).message}); embedding the whole font`);
    }
  }
  const fontFile = context.register(context.flateStream(file, { Length1: file.length }));
  const descriptor = context.register(
    context.obj({
      Type: "FontDescriptor",
      FontName: PDFName.of(baseName),
      Flags: 4,
      FontBBox: metrics.bbox.map((n) => Math.round(n)),
      ItalicAngle: 0,
      Ascent: Math.round(metrics.ascent),
      Descent: Math.round(metrics.descent),
      CapHeight: Math.round(metrics.capHeight),
      StemV: font.weight >= 600 ? 120 : 80,
      FontFile2: fontFile,
    }),
  );
  const cidFont = context.register(
    context.obj({
      Type: "Font",
      Subtype: "CIDFontType2",
      BaseFont: PDFName.of(baseName),
      CIDSystemInfo: { Registry: PDFString.of("Adobe"), Ordering: PDFString.of("Identity"), Supplement: 0 },
      FontDescriptor: descriptor,
      DW: 0,
      W: widthsArray(font, gids),
      CIDToGIDMap: "Identity",
    }),
  );
  const toUnicode = context.register(context.flateStream(toUnicodeCMap(font.used)));
  return context.register(
    context.obj({
      Type: "Font",
      Subtype: "Type0",
      BaseFont: PDFName.of(baseName),
      Encoding: "Identity-H",
      DescendantFonts: [cidFont],
      ToUnicode: toUnicode,
    }),
  );
}

/** Builds a PDF axial shading (stitched exponential functions for more than two stops). */
function shadingFor(context: PDFContext, g: LinearGradient): PDFRef {
  const stops = [...g.stops];
  if (stops[0].offset > 0) stops.unshift({ ...stops[0], offset: 0 });
  if (stops[stops.length - 1].offset < 1) stops.push({ ...stops[stops.length - 1], offset: 1 });
  const rgb = (c: Rgba) => [c.r, c.g, c.b].map((v) => Math.round(v * 10000) / 10000);
  const fn = (a: Rgba, b: Rgba) => ({ FunctionType: 2, Domain: [0, 1], C0: rgb(a), C1: rgb(b), N: 1 });
  const parts = stops.slice(1).map((s, i) => fn(stops[i].color, s.color));
  const Function =
    parts.length === 1
      ? parts[0]
      : {
          FunctionType: 3,
          Domain: [0, 1],
          Functions: parts,
          Bounds: stops.slice(1, -1).map((s) => s.offset),
          Encode: parts.flatMap(() => [0, 1]),
        };
  return context.register(
    context.obj({
      ShadingType: 2,
      ColorSpace: "DeviceRGB",
      Coords: [g.x1, g.y1, g.x2, g.y2],
      Function,
      Extend: [true, true],
    }),
  );
}

/** Writes the display list as an A4 vector PDF. */
export async function writePdf(list: DisplayList, fonts: FontLoader, options: WritePdfOptions = {}): Promise<Uint8Array> {
  const hb: HarfBuzzModule = options.harfbuzz ?? (await import("harfbuzzjs"));
  const warn = options.onWarning ?? (() => {});
  const tolerance = options.widthTolerance ?? 0.015;
  const fallbackFamilies = options.fallbackFamilies ?? ["Noto Sans"];
  let subsetter: Subsetter | null = null;
  if (options.subsetWasm) {
    const wasm = typeof options.subsetWasm === "function" ? await options.subsetWasm() : options.subsetWasm;
    subsetter = await createSubsetter(wasm);
  }

  const doc = await PDFDocument.create();
  doc.setProducer("Free Wedding Biodata (vector spike)");
  doc.setCreator("Free Wedding Biodata");
  if (options.title) doc.setTitle(options.title);
  const context = doc.context;

  // Fonts: loaded once per family + weight, shaped with HarfBuzz, embedded after all pages are drawn.
  const loaded = new Map<string, Promise<ShapingFont>>();
  const fontFor = (family: string, weight: number) => {
    const w = weight >= 600 ? 700 : 400;
    const key = `${family}|${w}`;
    let p = loaded.get(key);
    if (!p) {
      p = fonts(family, w).then((data) => loadShapingFont(hb, family, w, data));
      loaded.set(key, p);
    }
    return p;
  };
  const fontNames = new Map<string, string>(); // font key → resource name
  const fontResName = (f: ShapingFont) => {
    let n = fontNames.get(f.key);
    if (!n) {
      n = `F${fontNames.size + 1}`;
      fontNames.set(f.key, n);
    }
    return n;
  };

  const images = new Map<string, Promise<PDFRef>>();
  const shadings = new Map<string, PDFRef>();
  const forms = new Map<string, { name: string; ref: PDFRef } | null>();
  const pageFontUse: Set<string>[] = [];
  const pageResources: Record<string, unknown>[] = [];

  for (let pageIndex = 0; pageIndex < list.pages.length; pageIndex++) {
    const page: DisplayPage = list.pages[pageIndex];
    const pdfPage = doc.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]);
    const ops: string[] = ["q", `${PAGE_MATRIX.map(num).join(" ")} cm`];
    const xObjects: Record<string, PDFRef> = {};
    const extGStates: Record<string, PDFDict> = {};
    const usedFonts = new Set<string>();
    pageFontUse.push(usedFonts);
    const alphaName = (fill: number, stroke: number) => {
      const name = `GS${Math.round(fill * 1000)}_${Math.round(stroke * 1000)}`;
      extGStates[name] ??= context.obj({ Type: "ExtGState", ca: fill, CA: stroke });
      return name;
    };
    const setColor = (c: Rgba, stroke: boolean) => {
      ops.push(rgbOps(c, stroke));
      if (c.a < 1) ops.push(`/${alphaName(stroke ? 1 : c.a, stroke ? c.a : 1)} gs`);
    };

    const widestAt = new Map<number, number>();
    for (const it of page.items) if (it.kind === "text") widestAt.set(it.x, Math.max(widestAt.get(it.x) ?? 0, it.width));

    const bg = parseColor(page.background);
    if (bg) ops.push(rgbOps(bg, false), `0 0 ${num(page.width)} ${num(page.height)} re f`);

    for (const item of page.items) {
      if (item.kind === "rect") drawRect(item);
      else if (item.kind === "image") await drawImage(item);
      else if (item.kind === "svg") {
        // Each distinct SVG (markup + box) becomes one Form XObject, drawn by reference on every page that has it
        // (the page frame repeats on every page).
        const key = JSON.stringify([item.markup, item.x, item.y, item.width, item.height]);
        let form = forms.get(key);
        if (form === undefined) {
          form = null;
          try {
            const formPatterns: Record<string, PDFDict> = {};
            const formStates: Record<string, PDFDict> = {};
            const content = svgToPdf(
              item.markup,
              item,
              IDENTITY, // a form's patterns map to the form's own space, which is page px here
              {
                pattern: (g, toForm) => {
                  const shadingKey = JSON.stringify([g.x1, g.y1, g.x2, g.y2, g.stops]);
                  let shading = shadings.get(shadingKey);
                  if (!shading) {
                    shading = shadingFor(context, g);
                    shadings.set(shadingKey, shading);
                  }
                  const name = `P${Object.keys(formPatterns).length + 1}`;
                  formPatterns[name] = context.obj({ PatternType: 2, Shading: shading, Matrix: toForm.map((n) => Math.round(n * 1e5) / 1e5) });
                  return name;
                },
                alpha: (fill, stroke) => {
                  const name = `GS${Math.round(fill * 1000)}_${Math.round(stroke * 1000)}`;
                  formStates[name] ??= context.obj({ Type: "ExtGState", ca: fill, CA: stroke });
                  return name;
                },
              },
              warn,
            );
            const formResources: Record<string, unknown> = {};
            if (Object.keys(formPatterns).length) formResources.Pattern = formPatterns;
            if (Object.keys(formStates).length) formResources.ExtGState = formStates;
            form = {
              name: `Fm${forms.size + 1}`,
              ref: context.register(
                context.flateStream(content, {
                  Type: "XObject",
                  Subtype: "Form",
                  BBox: [0, 0, page.width, page.height],
                  // An indirect dictionary, so it lands in a compressed object stream (stream dictionaries don't).
                  Resources: context.register(context.obj(formResources as Record<string, PDFDict>)),
                }),
              ),
            };
          } catch (e) {
            warn(`SVG skipped on page ${pageIndex + 1}: ${(e as Error).message}`);
          }
          forms.set(key, form);
        }
        if (form) {
          xObjects[form.name] = form.ref;
          ops.push(`/${form.name} Do`);
        }
      } else await drawText(item);
    }
    ops.push("Q");

    const resources: Record<string, unknown> = {};
    if (Object.keys(xObjects).length) resources.XObject = xObjects;
    if (Object.keys(extGStates).length) resources.ExtGState = extGStates;
    // Fonts are embedded at the end (subset to every glyph used on any page), so resources are attached then.
    pageResources.push(resources);
    pdfPage.node.set(PDFName.of("Contents"), context.register(context.flateStream(ops.join("\n"))));

    function drawRect(r: RectItem) {
      const fill = parseColor(r.fill);
      const stroke = r.stroke && r.strokeWidth ? parseColor(r.stroke) : null;
      const radius = r.radius ?? 0;
      if (fill) {
        setColor(fill, false);
        ops.push(pathOps(rectPath(r.x, r.y, r.width, r.height, radius)), "f");
      }
      if (stroke && r.strokeWidth) {
        // CSS borders sit inside the border box: stroke the path inset by half the width.
        const sw = r.strokeWidth;
        ops.push("q");
        setColor(stroke, true);
        ops.push(`${num(sw)} w`, pathOps(rectPath(r.x + sw / 2, r.y + sw / 2, r.width - sw, r.height - sw, Math.max(0, radius - sw / 2))), "S", "Q");
      }
    }

    async function drawImage(img: ImageItem) {
      const m = /^data:image\/(jpe?g|png);base64,([\s\S]*)$/.exec(img.src);
      if (!m) {
        warn(`Image skipped (not a JPEG/PNG data URL): ${img.src.slice(0, 40)}`);
        return;
      }
      let ref = images.get(img.src);
      if (!ref) {
        const bytes = base64ToBytes(m[2]);
        ref = (m[1] === "png" ? doc.embedPng(bytes) : doc.embedJpg(bytes)).then((i) => i.ref);
        images.set(img.src, ref);
      }
      const name = `Im${[...images.keys()].indexOf(img.src) + 1}`;
      xObjects[name] = await ref;
      ops.push("q");
      if (img.radius) ops.push(pathOps(rectPath(img.x, img.y, img.width, img.height, img.radius)), "W n");
      ops.push(`${num(img.width)} 0 0 ${num(-img.height)} ${num(img.x)} ${num(img.y + img.height)} cm`, `/${name} Do`, "Q");
    }

    async function drawText(t: TextItem) {
      const text = collapse(t.text);
      if (!text) return;
      const primary = await fontFor(t.fontFamily, t.fontWeight);
      const stack = [primary];
      for (const f of fallbackFamilies) if (f !== t.fontFamily) stack.push(await fontFor(f, t.fontWeight));
      const shaped = shapeRun(hb, text, stack, t.fontSize, t.letterSpacing, page.lang || "en");
      const measure: RunMeasure = {
        page: pageIndex + 1,
        text,
        fontFamily: t.fontFamily,
        fontWeight: t.fontWeight,
        fontSize: t.fontSize,
        browserWidth: t.width,
        shapedWidth: shaped.width,
        ratio: t.width ? (shaped.width - t.width) / t.width : 0,
        glyphs: shaped.glyphs.length,
        codePoints: shaped.codePoints,
        fallback: shaped.glyphs.some((g) => g.font !== primary),
      };
      // Justified lines: Chrome widened the spaces. The display list doesn't carry text-align, so a line with
      // spaces that is exactly as wide as the widest line starting at the same x on the page (a full justified
      // line) and that HarfBuzz finds narrower gets the difference spread over its spaces.
      const spaces = shaped.glyphs.filter((g) => text[g.cluster] === " ");
      const gap = t.width - shaped.width;
      const fullLine = t.width >= page.width * 0.4 && Math.abs(t.width - (widestAt.get(t.x) ?? 0)) < 0.01;
      if (spaces.length && fullLine && gap > 0.25) {
        measure.justified = true;
        const extra = gap / spaces.length;
        let shift = 0;
        for (const g of shaped.glyphs) {
          g.x += shift;
          if (text[g.cluster] === " ") shift += extra;
        }
      }
      options.onRun?.(measure);
      if (!measure.justified && Math.abs(measure.ratio) > tolerance) options.onMismatch?.(measure);

      const color = parseColor(t.color) ?? { r: 0, g: 0, b: 0, a: 1 };
      ops.push(`/Span << /ActualText <${utf16Hex(text, true)}> >> BDC`, "q");
      setColor(color, false);
      ops.push("BT", `1 0 0 -1 ${num(t.x)} ${num(t.y)} Tm`);
      let current: ShapingFont | null = null;
      let rise = 0;
      let pen = 0;
      let tj: string[] = [];
      let hexRun = "";
      const flushHex = () => {
        if (hexRun) tj.push(`<${hexRun}>`);
        hexRun = "";
      };
      const flushTj = () => {
        flushHex();
        if (tj.length) ops.push(`[${tj.join(" ")}] TJ`);
        tj = [];
      };
      for (const g of shaped.glyphs) {
        if (g.font !== current) {
          flushTj();
          current = g.font;
          usedFonts.add(g.font.key);
          ops.push(`/${fontResName(g.font)} ${num(t.fontSize)} Tf`);
        }
        if (Math.abs(g.y - rise) > 1e-4) {
          flushTj();
          rise = g.y;
          ops.push(`${num(rise)} Ts`);
        }
        const delta = g.x - pen;
        if (Math.abs(delta) > 1e-4) {
          flushHex();
          tj.push(num((-delta * 1000) / t.fontSize));
        }
        hexRun += hex4(g.gid);
        pen = g.x + (pdfWidth(g.font, g.gid) * t.fontSize) / 1000;
      }
      flushTj();
      ops.push("ET", "Q", "EMC");
    }
  }

  // Embed every font used, subset to the glyphs drawn on any page, and attach resources.
  const fontRefs = new Map<string, PDFRef>();
  for (const p of loaded.values()) {
    const f = await p;
    if (!fontNames.has(f.key) || !f.used.size) continue;
    fontRefs.set(f.key, embedFont(context, f, subsetter, warn));
  }
  doc.getPages().forEach((pdfPage, i) => {
    const resources = pageResources[i];
    const fontDict: Record<string, PDFRef> = {};
    for (const key of pageFontUse[i]) fontDict[fontNames.get(key)!] = fontRefs.get(key)!;
    if (Object.keys(fontDict).length) resources.Font = fontDict;
    pdfPage.node.set(PDFName.of("Resources"), context.obj(resources as Record<string, PDFRef>));
  });
  return doc.save({ useObjectStreams: true });
}

