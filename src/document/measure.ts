import type { LangCode } from "@/biodata/types";
import type { BlockSpec } from "./blocks/types";
import { autoFit, paginate, type BlockMetrics, type PageLayout } from "./paginate";
import { BODY_PX, FONT_FAMILY, type TextStep } from "./tokens";

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

/** Heights (and, for paragraphs, line metrics) of the blocks rendered in one measuring column. */
export function measureBlocks(column: HTMLElement, specs: readonly BlockSpec[], bodyPx: number): BlockMetrics[] {
  const els = column.querySelectorAll<HTMLElement>(":scope > [data-block]");
  return specs.map((spec, i) => {
    const el = els[i];
    const rect = el.getBoundingClientRect();
    const metrics: BlockMetrics = { height: rect.height, spaceBefore: spec.spaceBefore * bodyPx, keepWithNext: spec.keepWithNext };
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
}

/** Measures every step's column, picks the text size (D31) and splits paragraphs into per-page text pieces. */
export function layoutDocument(
  root: HTMLElement,
  specs: readonly BlockSpec[],
  steps: readonly TextStep[],
  pageHeight: (index: number) => number,
): DocumentLayout {
  const columns = new Map<TextStep, HTMLElement>();
  root.querySelectorAll<HTMLElement>("[data-measure-step]").forEach((el) => columns.set(el.dataset.measureStep as TextStep, el));
  const measured = new Map<TextStep, BlockMetrics[]>();
  const { step, pages } = autoFit(steps, (s) => {
    const metrics = measureBlocks(columns.get(s)!, specs, BODY_PX[s]);
    measured.set(s, metrics);
    return paginate(metrics, { pageHeight });
  });

  const metrics = measured.get(step)!;
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
  return { step, bodyPx: BODY_PX[step], pages, pieces, overflow };
}
