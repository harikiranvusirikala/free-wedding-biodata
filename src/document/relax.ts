// Relaxed spacing (Step 4.5, owner's M1 polish): a biodata that fits on ONE page with a lot of room left gets its
// vertical gaps (the space between rows, above each heading, around the top element) stretched by a factor up to a
// cap, so the page looks composed instead of ending in an empty band. Font sizes, frames and the photo never change,
// and a document of two or more pages is never touched. PURE: the browser measures the blocks at the normal gaps and
// again at the cap (measure.ts); everything else, the factor and the blocks between those two measurements, is here.
//
// Why two measurements are enough: a gap is `calc(<n>em * var(--doc-relax))`, so every block's height, and the space
// above it, is a straight line in the factor (line counts don't change; only gaps do). The page's used height at the
// cap and at 1 therefore give the factor that fills the page, and the blocks at that factor, without a third pass.

import type { BlockMetrics } from "./paginate";

/** The largest factor: gaps never grow more than half again, however empty the page is. */
export const RELAX_MAX = 1.5;

/** Below this share of the page's content height left over, nothing is relaxed (the page already looks full). */
export const RELAX_MIN_LEFTOVER = 0.03;

/** The share of the content height a relaxed page fills at most; the rest is a safety margin for sub-pixel rounding. */
export const RELAX_FILL = 0.985;

/** Factors below this are not worth a different layout: 1. */
const RELAX_MIN_STEP = 1.02;

/** Height of the blocks stacked on one page (nothing above the first block, as paginate() places it). */
export function stackedHeight(blocks: readonly BlockMetrics[]): number {
  return blocks.reduce((sum, block, i) => sum + (i === 0 ? 0 : (block.spaceBefore ?? 0)) + block.height, 0);
}

/**
 * The gap factor for a one-page document. `used` is the stacked height at factor 1, `usedAtMax` at `max`; `capacity`
 * is the page's content height. 1 when the page is nearly full, has no gaps to stretch, or the stretch would be
 * invisible; otherwise as much as fills the page to RELAX_FILL, never more than `max`. Rounded down to 0.01, so the
 * result is the same on every machine.
 */
export function relaxFactor({ capacity, used, usedAtMax, max = RELAX_MAX }: { capacity: number; used: number; usedAtMax: number; max?: number }): number {
  const gaps = usedAtMax - used;
  if (!(capacity > 0) || !(max > 1) || !(gaps > 0) || !(used > 0)) return 1;
  if (capacity - used < capacity * RELAX_MIN_LEFTOVER) return 1;
  const room = capacity * RELAX_FILL - used;
  if (!(room > 0)) return 1;
  const factor = Math.floor((1 + (max - 1) * Math.min(1, room / gaps)) * 100) / 100;
  return factor < RELAX_MIN_STEP ? 1 : factor;
}

/**
 * The blocks as they measure at `factor`, from their measurements at 1 (`base`) and at `max` (`wide`): every size is a
 * straight line in the factor. Heights, the space above and a paragraph's padding follow it; its line count and line
 * height (the text itself) don't.
 */
export function blendMetrics(base: readonly BlockMetrics[], wide: readonly BlockMetrics[], factor: number, max = RELAX_MAX): BlockMetrics[] {
  const t = max > 1 ? (factor - 1) / (max - 1) : 0;
  const mix = (a: number, b: number) => a + (b - a) * t;
  return base.map((block, i) => {
    const other = wide[i];
    const blended: BlockMetrics = { ...block, height: mix(block.height, other.height), spaceBefore: mix(block.spaceBefore ?? 0, other.spaceBefore ?? 0) };
    if (block.lines && other.lines) {
      blended.lines = { ...block.lines, padTop: mix(block.lines.padTop, other.lines.padTop), padBottom: mix(block.lines.padBottom, other.lines.padBottom) };
    }
    return blended;
  });
}
