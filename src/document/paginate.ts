// Measured blocks → A4 pages (BUILD_PLAN A4 step 3, VISION D31, D45). PURE: no DOM. The browser measures each
// block once at true size (measure.ts); this decides where every block goes:
// - a block never splits, except a line block (a paragraph), which splits between lines, keeping at least
//   `minLines` lines on each side when it can (no single orphan or widow line);
// - a block marked keepWithNext (a section heading) moves to the next page unless the start of the block after it
//   fits under it, so a heading never ends a page;
// - a block's space above it is dropped at the top of a page;
// - a block taller than a whole page is placed alone and allowed to overflow (the measure step reports it).
// Auto text size (D31): autoFit tries the template's sizes largest first and keeps the first that fits one page,
// else the last (smallest, never below 9 pt) with as many pages as it needs.

export interface LineMetrics {
  count: number;
  /** px per line. */
  lineHeight: number;
  /** px above the first line and below the last, inside the block (repeated on every piece of a split). */
  padTop: number;
  padBottom: number;
}

export interface BlockMetrics {
  /** px, without the space above it. For a line block: padTop + count × lineHeight + padBottom. */
  height: number;
  /** px of space above the block, dropped when it starts a page. */
  spaceBefore?: number;
  keepWithNext?: boolean;
  /** Present on blocks that may split between lines. */
  lines?: LineMetrics;
}

export interface Fragment {
  /** Index into the measured blocks. */
  block: number;
  /** For a split line block: the lines on this page, [fromLine, toLine). */
  fromLine?: number;
  toLine?: number;
  /** The space above this fragment on its page (0 at the top of a page). */
  spaceBefore: number;
  /** px, without spaceBefore. */
  height: number;
  /** px from the top of the page's content box to this fragment's top edge. */
  top: number;
}

export interface PageLayout {
  fragments: Fragment[];
  /** px of the content box used. */
  used: number;
}

export interface PaginateOptions {
  /** The content box height of page `index` (page 1 may differ, e.g. a header in the top band). */
  pageHeight: (index: number) => number;
  /** Lines kept together at the end and start of a split paragraph (default 2). */
  minLines?: number;
}

/** Rounding slack in px, so sub-pixel measurements don't push a block that does fit. */
const EPS = 0.01;

/** The least height the start of `block` needs on a page that already has content. */
function startHeight(block: BlockMetrics, minLines: number): number {
  const space = block.spaceBefore ?? 0;
  if (!block.lines) return space + block.height;
  const { count, lineHeight, padTop, padBottom } = block.lines;
  return space + padTop + Math.min(count, minLines) * lineHeight + padBottom;
}

export function paginate(blocks: readonly BlockMetrics[], options: PaginateOptions): PageLayout[] {
  const minLines = Math.max(1, options.minLines ?? 2);
  const pages: PageLayout[] = [{ fragments: [], used: 0 }];
  let page = pages[0];
  const newPage = () => {
    page = { fragments: [], used: 0 };
    pages.push(page);
  };
  const capacity = () => options.pageHeight(pages.length - 1);
  const place = (fragment: Omit<Fragment, "top" | "spaceBefore">, spaceBefore: number) => {
    page.fragments.push({ ...fragment, spaceBefore, top: page.used + spaceBefore });
    page.used += spaceBefore + fragment.height;
  };

  blocks.forEach((block, index) => {
    if (block.lines && block.lines.count > 0) {
      const { count, lineHeight, padTop, padBottom } = block.lines;
      let from = 0;
      while (from < count) {
        const empty = page.fragments.length === 0;
        const space = empty ? 0 : (block.spaceBefore ?? 0);
        const room = capacity() - page.used - space - padTop - padBottom;
        const fit = Math.max(0, Math.floor((room + EPS) / lineHeight));
        const left = count - from;
        let take: number;
        if (fit >= left) take = left;
        else {
          // Keep minLines on this page and minLines for the next one, when the paragraph is long enough.
          const keep = Math.min(minLines, left);
          take = Math.min(fit, left - keep);
          if (take < Math.min(minLines, left)) take = 0;
          if (take === 0 && empty) take = Math.max(1, Math.min(fit, left)); // a page must make progress
        }
        if (take === 0) {
          newPage();
          continue;
        }
        place({ block: index, fromLine: from, toLine: from + take, height: padTop + take * lineHeight + padBottom }, space);
        from += take;
        if (from < count) newPage();
      }
      return;
    }

    for (;;) {
      const empty = page.fragments.length === 0;
      const space = empty ? 0 : (block.spaceBefore ?? 0);
      let need = space + block.height;
      const next = blocks[index + 1];
      if (block.keepWithNext && next) need += startHeight(next, minLines);
      if (empty || page.used + need <= capacity() + EPS) {
        place({ block: index, height: block.height }, space);
        return;
      }
      newPage();
    }
  });

  if (pages.length > 1 && pages[pages.length - 1].fragments.length === 0) pages.pop();
  return pages;
}

/**
 * D31 Auto text size: lay out at each step, largest first, and keep the first that fits on one page; if none
 * does, the last step (the smallest) with all its pages. `steps` must not be empty.
 */
export function autoFit<S>(steps: readonly S[], layoutAt: (step: S) => PageLayout[]): { step: S; pages: PageLayout[] } {
  if (!steps.length) throw new Error("autoFit needs at least one step");
  let result = { step: steps[0], pages: layoutAt(steps[0]) };
  for (let i = 1; i < steps.length && result.pages.length > 1; i++) result = { step: steps[i], pages: layoutAt(steps[i]) };
  return result;
}
