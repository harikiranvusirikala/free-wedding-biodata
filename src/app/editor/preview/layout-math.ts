// The live preview's arithmetic (BUILD_PLAN Step 3.3), pure so it is unit-tested: how much the A4 pages are scaled
// to fit the pane, the zoom steps, where each page sits in the scrolled pane and which one is in view, and the
// sentence under the text-size control (D31, D45 "Fits on one page", "Takes 2 pages").
// Sizes are CSS px; a page is 794 × 1123 (A4 at 96 px per inch, src/document/tokens.ts PAGE) and DocumentView
// stacks pages 24 px apart (.doc-pages in src/document/document.css).

import type { TextSize } from "@/biodata/types";

export const PAGE_WIDTH = 794;
export const PAGE_HEIGHT = 1123;
export const PAGE_GAP = 24;

/** "fit" follows the pane's size; a number is a fixed scale (1 = true size, 100 %). */
export type Zoom = "fit" | number;

/** The fixed scales − and + step through. */
export const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 2] as const;
export const MIN_ZOOM = ZOOM_STEPS[0];
export const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1];

/**
 * The scale that fits a page into the space left for it: the whole page ("page", the desktop pane: VISION §5 "fit
 * to page", BUILD_PLAN A7 "the page fitted to the available height") or its width ("width", phones, where a whole
 * page would be too small to read and the pane scrolls). Never above `max`, never below the smallest zoom.
 */
export function fitScale(space: { width: number; height: number }, mode: "page" | "width", max = 1.25): number {
  const byWidth = space.width / PAGE_WIDTH;
  const scale = mode === "width" ? byWidth : Math.min(byWidth, space.height / PAGE_HEIGHT);
  if (!Number.isFinite(scale) || scale <= 0) return MIN_ZOOM;
  return Math.min(max, Math.max(MIN_ZOOM, scale));
}

/** The next zoom step above (`+1`) or below (`-1`) the scale shown now; stays put at either end. */
export function stepZoom(current: number, direction: 1 | -1): number {
  const eps = 0.005;
  if (direction > 0) return ZOOM_STEPS.find((s) => s > current + eps) ?? MAX_ZOOM;
  return [...ZOOM_STEPS].reverse().find((s) => s < current - eps) ?? MIN_ZOOM;
}

/** The scale in use: the fitted one, or the fixed zoom. */
export function resolveScale(zoom: Zoom, fitted: number): number {
  return zoom === "fit" ? fitted : zoom;
}

/** "66%" */
export function percent(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}

/** Height of `pages` stacked pages at true size. */
export function stackHeight(pages: number): number {
  const n = Math.max(1, pages);
  return n * PAGE_HEIGHT + (n - 1) * PAGE_GAP;
}

/** Top of page `index` (0-based) in the scaled stack. */
export function pageTop(index: number, scale: number): number {
  return index * (PAGE_HEIGHT + PAGE_GAP) * scale;
}

/**
 * The page in view (0-based) for a pane scrolled to `scrollTop` showing `viewHeight` px: the page covering the
 * middle of the view, so a page counts as "the one you're looking at" once it fills most of the pane.
 */
export function pageInView(scrollTop: number, viewHeight: number, scale: number, pages: number): number {
  if (pages <= 1 || scale <= 0) return 0;
  const middle = scrollTop + viewHeight / 2;
  const index = Math.floor(middle / ((PAGE_HEIGHT + PAGE_GAP) * scale));
  return Math.min(pages - 1, Math.max(0, index));
}

/** Text size steps, for showing which one Auto chose. */
export const SIZE_LABELS = { xs: "XS", s: "S", m: "M", l: "L", xl: "XL" } as const;
export type SizeStep = keyof typeof SIZE_LABELS;

/**
 * Which sentence goes under the text-size control, and its values (app strings `preview.fit.*`):
 * Auto that fits one page names the size it chose; Auto that doesn't says even the smallest size takes N pages;
 * a fixed size says whether it fits.
 */
export function sizeHint(
  textSize: TextSize,
  layout: { pages: number; step: SizeStep },
): { key: "preview.fit.autoOne" | "preview.fit.autoMany" | "preview.fit.one" | "preview.fit.many"; values: Record<string, string | number> } {
  const size = SIZE_LABELS[layout.step];
  if (textSize === "auto") {
    return layout.pages <= 1 ? { key: "preview.fit.autoOne", values: { size } } : { key: "preview.fit.autoMany", values: { pages: layout.pages } };
  }
  return layout.pages <= 1 ? { key: "preview.fit.one", values: { size } } : { key: "preview.fit.many", values: { pages: layout.pages, size } };
}
