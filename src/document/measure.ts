import type { LangCode } from "@/biodata/types";
import type { BlockSpec } from "./blocks/types";
import { autoFit, paginate, type BlockMetrics, type PageLayout } from "./paginate";
import { blendMetrics, relaxFactor, RELAX_MAX, stackedHeight } from "./relax";
import { BODY_PX, FONT_FAMILY, RELAX_VAR, type TextStep } from "./tokens";

// Browser side of pagination (BUILD_PLAN A4 step 3): the blocks are rendered off-screen at true size, once per
// text size Auto may try (DocumentView draws them, each in a [data-measure-step] column of the content width
// holding one [data-block] per block); after the fonts are loaded this reads their heights and line metrics and
// hands them to the pure paginate()/autoFit(). The pages then render with exactly the measured blocks.

/** Loads the document's fonts (Regular and Bold) before anything is measured. */
export async function loadDocumentFonts(lang: LangCode): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const families = new Set([FONT_FAMILY[lang], "Noto Sans"]);
  await Promise.all([...families].flatMap((family) => ["400", "700"].map((w) => document.fonts.load(`${w} 16px "${family}"`).catch(() => []))));
  await document.fonts.ready;
}

/**
 * Loads the faces that text in another script uses (src/document/scripts.ts) before it is measured: every element
 * under `root` with a font stack of its own asks for that stack at its own weight and style, for its own
 * characters, so only the faces it draws with are fetched (a Telugu name on an English page loads Telugu Regular,
 * not Bold, unless a bold label is Telugu too).
 */
export async function loadElementFonts(root: HTMLElement): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const wanted = new Map<string, Set<string>>();
  for (const el of root.querySelectorAll<HTMLElement>('[style*="font-family"]')) {
    const style = getComputedStyle(el);
    const font = `${style.fontStyle} ${style.fontWeight} 16px ${style.fontFamily}`;
    const chars = wanted.get(font) ?? new Set<string>();
    for (const ch of el.textContent ?? "") chars.add(ch);
    wanted.set(font, chars);
  }
  await Promise.all([...wanted].map(([font, chars]) => document.fonts.load(font, [...chars].join("")).catch(() => [])));
}

/**
 * Heights (and, for paragraphs, line metrics) of the blocks rendered in one measuring column. `relax` is the factor
 * the column's gaps are at (its CSS variable), so the space above each block scales with it as the gaps inside do.
 */
export function measureBlocks(column: HTMLElement, specs: readonly BlockSpec[], bodyPx: number, relax = 1): BlockMetrics[] {
  const els = column.querySelectorAll<HTMLElement>(":scope > [data-block]");
  return specs.map((spec, i) => {
    const el = els[i];
    const rect = el.getBoundingClientRect();
    const metrics: BlockMetrics = { height: rect.height, spaceBefore: spec.spaceBefore * bodyPx * relax, keepWithNext: spec.keepWithNext };
    const text = spec.block.kind === "paragraph" ? el.querySelector<HTMLElement>("[data-lines]") : null;
    if (text) {
      const t = text.getBoundingClientRect();
      const declared = parseFloat(getComputedStyle(text).lineHeight) || bodyPx * 1.45;
      const count = Math.max(1, Math.round(t.height / declared));
      metrics.lines = { count, lineHeight: t.height / count, padTop: t.top - rect.top, padBottom: rect.bottom - t.bottom };
    }
    return metrics;
  });
}

/** Character offsets where each rendered line of a single-text-node element starts. */
export function lineStarts(el: HTMLElement): number[] {
  const node = el.firstChild;
  if (!node || node.nodeType !== Node.TEXT_NODE) return [0];
  const text = (node as Text).data;
  const range = document.createRange();
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 16;
  const starts: number[] = [];
  let lastTop = -Infinity;
  let newlines = 0;
  for (const { segment, index } of segmenter.segment(text)) {
    if (/^\s+$/.test(segment)) {
      // pre-line keeps line breaks: a second newline in a row is an empty line, which has nothing to measure.
      if (segment.includes("\n")) {
        newlines += 1;
        if (newlines > 1 && starts.length) {
          starts.push(index);
          lastTop += lineHeight;
        }
      }
      continue;
    }
    newlines = 0;
    range.setStart(node, index);
    range.setEnd(node, index + segment.length);
    const rects = range.getClientRects();
    if (!rects.length) continue;
    const top = rects[0].top;
    if (top > lastTop + lineHeight / 2) {
      starts.push(index);
      lastTop = top;
    }
  }
  return starts.length ? starts : [0];
}

export interface DocumentLayout {
  step: TextStep;
  bodyPx: number;
  pages: PageLayout[];
  /** For each split paragraph (by block index): the text of each of its pieces, keyed by fromLine. */
  pieces: Map<number, Map<number, string>>;
  /** True when a block is taller than a page (it is placed alone and clipped). */
  overflow: boolean;
  /** Relaxed spacing (relax.ts): the factor the page's vertical gaps are stretched by; 1 for no change. */
  relax: number;
}

/**
 * Measures every step's column, picks the text size (D31) and splits paragraphs into per-page text pieces. A document
 * that then fits ONE page with plenty of room left gets relaxed spacing: its gaps are measured once more at the cap
 * (the chosen step's column only, with its CSS variable set), and the factor that fills the page, and the blocks at
 * that factor, come from those two measurements (relax.ts). The text size is never changed by it; two pages or more
 * stay exactly as paginated. `options.relax: false` turns it off (the dev page's before/after comparison).
 */
export function layoutDocument(
  root: HTMLElement,
  specs: readonly BlockSpec[],
  steps: readonly TextStep[],
  pageHeight: (index: number) => number,
  options: { relax?: boolean } = {},
): DocumentLayout {
  const columns = new Map<TextStep, HTMLElement>();
  root.querySelectorAll<HTMLElement>("[data-measure-step]").forEach((el) => columns.set(el.dataset.measureStep as TextStep, el));
  const measured = new Map<TextStep, BlockMetrics[]>();
  const fit = autoFit(steps, (s) => {
    const metrics = measureBlocks(columns.get(s)!, specs, BODY_PX[s]);
    measured.set(s, metrics);
    return paginate(metrics, { pageHeight });
  });

  const { step } = fit;
  let { pages } = fit;
  let metrics = measured.get(step)!;
  let relax = 1;
  if (pages.length === 1 && options.relax !== false) {
    const column = columns.get(step)!;
    column.style.setProperty(RELAX_VAR, String(RELAX_MAX));
    const wide = measureBlocks(column, specs, BODY_PX[step], RELAX_MAX);
    column.style.removeProperty(RELAX_VAR);
    const factor = relaxFactor({ capacity: pageHeight(0), used: stackedHeight(metrics), usedAtMax: stackedHeight(wide) });
    if (factor > 1) {
      const blended = blendMetrics(metrics, wide, factor);
      const relaxedPages = paginate(blended, { pageHeight });
      // Never trade a one-page biodata for a longer one: if the blended gaps don't fit, nothing changes.
      if (relaxedPages.length === 1) {
        metrics = blended;
        pages = relaxedPages;
        relax = factor;
      }
    }
  }
  const pieces = new Map<number, Map<number, string>>();
  const column = columns.get(step)!;
  const blockEls = column.querySelectorAll<HTMLElement>(":scope > [data-block]");
  let overflow = false;
  pages.forEach((page, p) => {
    for (const f of page.fragments) {
      if (f.top + f.height > pageHeight(p) + 0.5) overflow = true;
      if (f.fromLine === undefined || f.toLine === undefined) continue;
      const count = metrics[f.block].lines!.count;
      if (f.fromLine === 0 && f.toLine >= count) continue;
      let map = pieces.get(f.block);
      if (!map) {
        const el = blockEls[f.block].querySelector<HTMLElement>("[data-lines]")!;
        const starts = lineStarts(el);
        const text = (el.firstChild as Text).data;
        map = new Map();
        // Every piece of this paragraph on every page.
        for (const pg of pages) {
          for (const g of pg.fragments) {
            if (g.block !== f.block || g.fromLine === undefined || g.toLine === undefined) continue;
            const from = starts[Math.min(g.fromLine, starts.length - 1)] ?? 0;
            const to = g.toLine >= count || g.toLine >= starts.length ? text.length : starts[g.toLine];
            // A piece never starts or ends with blank lines (that only makes it shorter than measured).
            map.set(g.fromLine, text.slice(from, to).replace(/\s+$/, "").replace(/^\s+/, ""));
          }
        }
        pieces.set(f.block, map);
      }
    }
  });
  return { step, bodyPx: BODY_PX[step], pages, pieces, overflow, relax };
}
