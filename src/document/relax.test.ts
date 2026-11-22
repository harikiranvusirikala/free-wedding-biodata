import { describe, expect, it } from "vitest";
import type { BlockMetrics } from "./paginate";
import { paginate } from "./paginate";
import { blendMetrics, RELAX_FILL, RELAX_MAX, RELAX_MIN_LEFTOVER, relaxFactor, stackedHeight } from "./relax";

// Step 4.5: relaxed spacing. The factor that stretches a one-page biodata's vertical gaps is pure arithmetic on two
// measurements (at the normal gaps and at the cap), so it is tested without a browser.

const CAPACITY = 1000;

describe("relaxFactor", () => {
  it("fills the page up to RELAX_FILL when the cap would overshoot", () => {
    // 800 used; the gaps add 400 at the cap (1.5): to reach 985 only 185/400 of that is needed → 1 + 0.5 × 0.4625.
    const factor = relaxFactor({ capacity: CAPACITY, used: 800, usedAtMax: 1200 });
    expect(factor).toBeCloseTo(1.23, 2);
    const used = 800 + (1200 - 800) * ((factor - 1) / (RELAX_MAX - 1));
    expect(used).toBeLessThanOrEqual(CAPACITY * RELAX_FILL);
    expect(used).toBeGreaterThan(CAPACITY * RELAX_FILL - 8);
  });

  it("is the cap when even the cap leaves room", () => {
    expect(relaxFactor({ capacity: CAPACITY, used: 600, usedAtMax: 700 })).toBe(RELAX_MAX);
  });

  it("is 1 when the page is nearly full, full, or overfull", () => {
    expect(relaxFactor({ capacity: CAPACITY, used: CAPACITY * (1 - RELAX_MIN_LEFTOVER) + 1, usedAtMax: 1200 })).toBe(1);
    expect(relaxFactor({ capacity: CAPACITY, used: 1000, usedAtMax: 1100 })).toBe(1);
    expect(relaxFactor({ capacity: CAPACITY, used: 1200, usedAtMax: 1300 })).toBe(1);
  });

  it("is 1 when there are no gaps to stretch, or the numbers are unusable", () => {
    expect(relaxFactor({ capacity: CAPACITY, used: 700, usedAtMax: 700 })).toBe(1);
    expect(relaxFactor({ capacity: CAPACITY, used: 700, usedAtMax: 650 })).toBe(1);
    expect(relaxFactor({ capacity: 0, used: 0, usedAtMax: 10 })).toBe(1);
    expect(relaxFactor({ capacity: CAPACITY, used: 700, usedAtMax: 900, max: 1 })).toBe(1);
    expect(relaxFactor({ capacity: Number.NaN, used: 700, usedAtMax: 900 })).toBe(1);
  });

  it("is 1 when the stretch would be too small to see", () => {
    // 3% left, but the safety margin leaves only 1.5% of the page to fill: a factor of 1.01 isn't a different layout.
    expect(relaxFactor({ capacity: CAPACITY, used: 970, usedAtMax: 1370 })).toBe(1);
  });

  it("grows with the room left, never past the cap, and is the same every time", () => {
    const factors = [900, 850, 800, 750, 700, 650, 600].map((used) => relaxFactor({ capacity: CAPACITY, used, usedAtMax: used + 150 }));
    for (let i = 1; i < factors.length; i++) expect(factors[i]).toBeGreaterThanOrEqual(factors[i - 1]);
    expect(Math.max(...factors)).toBeLessThanOrEqual(RELAX_MAX);
    expect(relaxFactor({ capacity: CAPACITY, used: 777, usedAtMax: 927 })).toBe(relaxFactor({ capacity: CAPACITY, used: 777, usedAtMax: 927 }));
    // Two decimals, rounded down.
    for (const f of factors) expect(Math.round(f * 100)).toBeCloseTo(f * 100, 6);
  });
});

/** A heading, six rows and a paragraph, with gaps measured at factor `f` (rows 4 px apart, headings 16 px below the last row). */
function blocks(f: number): BlockMetrics[] {
  const out: BlockMetrics[] = [{ height: 30, spaceBefore: 0, keepWithNext: true }];
  for (let i = 0; i < 6; i++) out.push({ height: 20 + 4 * f, spaceBefore: 0 });
  out.push({ height: 30, spaceBefore: 16 * f, keepWithNext: true });
  out.push({ height: 10 + 3 * 18 + 6 * f, spaceBefore: 0, lines: { count: 3, lineHeight: 18, padTop: 5, padBottom: 5 * f + 0 } });
  return out;
}

describe("blendMetrics and stackedHeight", () => {
  it("gives the blocks as measured at any factor between 1 and the cap", () => {
    const base = blocks(1);
    const wide = blocks(RELAX_MAX);
    for (const f of [1, 1.1, 1.25, 1.37, RELAX_MAX]) {
      const blended = blendMetrics(base, wide, f);
      const exact = blocks(f);
      blended.forEach((b, i) => {
        expect(b.height).toBeCloseTo(exact[i].height, 6);
        expect(b.spaceBefore ?? 0).toBeCloseTo(exact[i].spaceBefore ?? 0, 6);
        expect(b.keepWithNext).toBe(exact[i].keepWithNext);
        if (exact[i].lines) {
          expect(b.lines!.count).toBe(3);
          expect(b.lines!.lineHeight).toBe(18);
          expect(b.lines!.padBottom).toBeCloseTo(exact[i].lines!.padBottom, 6);
          expect(b.lines!.padTop).toBe(5);
        }
      });
      expect(stackedHeight(blended)).toBeCloseTo(stackedHeight(exact), 6);
    }
  });

  it("is the original at factor 1 and doesn't change its inputs", () => {
    const base = blocks(1);
    const copy = structuredClone(base);
    const blended = blendMetrics(base, blocks(RELAX_MAX), 1);
    expect(blended).toEqual(base);
    expect(base).toEqual(copy);
  });

  it("stacked height ignores the space above the first block, as the first block of a page does", () => {
    expect(stackedHeight([{ height: 10, spaceBefore: 99 }, { height: 20, spaceBefore: 5 }])).toBe(35);
    expect(stackedHeight([])).toBe(0);
  });

  it("agrees with paginate: the factor from two measurements keeps one page one page, and fills it", () => {
    const capacity = 330;
    const options = { pageHeight: () => capacity };
    const base = blocks(1);
    const wide = blocks(RELAX_MAX);
    expect(paginate(base, options)).toHaveLength(1);
    const factor = relaxFactor({ capacity, used: stackedHeight(base), usedAtMax: stackedHeight(wide) });
    expect(factor).toBeGreaterThan(1);
    const pages = paginate(blendMetrics(base, wide, factor), options);
    expect(pages).toHaveLength(1);
    expect(pages[0].used).toBeLessThanOrEqual(capacity * RELAX_FILL + 0.001);
    expect(pages[0].used).toBeGreaterThan(stackedHeight(base));
  });
});
