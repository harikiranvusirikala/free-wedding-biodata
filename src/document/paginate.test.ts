import { describe, expect, it } from "vitest";
import { autoFit, paginate, type BlockMetrics, type PageLayout } from "./paginate";

const row = (height = 20): BlockMetrics => ({ height });
const heading = (height = 30, spaceBefore = 10): BlockMetrics => ({ height, spaceBefore, keepWithNext: true });
const para = (count: number, lineHeight = 10, padTop = 4, padBottom = 4, spaceBefore = 0): BlockMetrics => ({
  height: padTop + count * lineHeight + padBottom,
  spaceBefore,
  lines: { count, lineHeight, padTop, padBottom },
});
const fixed = (height: number) => ({ pageHeight: () => height });
const blocksOn = (pages: PageLayout[]) => pages.map((p) => p.fragments.map((f) => f.block));

describe("paginate", () => {
  it("puts everything on one page when it fits, stacking tops with the space between blocks", () => {
    const pages = paginate([heading(), row(), row()], fixed(200));
    expect(pages).toHaveLength(1);
    expect(pages[0].fragments.map((f) => [f.top, f.spaceBefore])).toEqual([
      [0, 0], // the first block's space is dropped at the top of the page
      [30, 0],
      [50, 0],
    ]);
    expect(pages[0].used).toBe(70);
  });

  it("never splits a row: the row that doesn't fit starts the next page", () => {
    const pages = paginate([row(40), row(40), row(40)], fixed(100));
    expect(blocksOn(pages)).toEqual([[0, 1], [2]]);
    expect(pages[1].fragments[0].top).toBe(0);
  });

  it("drops a block's space above it at the top of a page", () => {
    const pages = paginate([row(90), heading(30, 12), row(20)], fixed(100));
    expect(blocksOn(pages)).toEqual([[0], [1, 2]]);
    expect(pages[1].fragments[0]).toMatchObject({ spaceBefore: 0, top: 0 });
  });

  it("never ends a page with a heading: it moves down with its first row", () => {
    // 60 used; heading 30 fits (90) but its first row (20) would not, so the heading moves too.
    const pages = paginate([row(60), heading(30, 0), row(20)], fixed(100));
    expect(blocksOn(pages)).toEqual([[0], [1, 2]]);
  });

  it("keeps a heading with the first lines of a paragraph after it", () => {
    // Heading 30 + paragraph start needs 4 + 2 lines × 10 + 4 = 28 → 58; only 40 left.
    const pages = paginate([row(60), heading(30, 0), para(10)], fixed(100));
    expect(blocksOn(pages)[0]).toEqual([0]);
    expect(pages[1].fragments[0].block).toBe(1);
  });

  it("splits a long paragraph at a line boundary and continues it on the next page", () => {
    // 50 used; 50 left → (50 - 8) / 10 = 4 lines fit; the other 8 lines go on.
    const pages = paginate([row(50), para(12)], fixed(100));
    expect(pages).toHaveLength(2);
    expect(pages[0].fragments[1]).toMatchObject({ block: 1, fromLine: 0, toLine: 4, height: 48 });
    expect(pages[1].fragments[0]).toMatchObject({ block: 1, fromLine: 4, toLine: 12, top: 0, height: 88 });
  });

  it("splits a paragraph over three pages when it must", () => {
    const pages = paginate([para(25)], fixed(100)); // 9 lines per page
    expect(pages.map((p) => [p.fragments[0].fromLine, p.fragments[0].toLine])).toEqual([
      [0, 9],
      [9, 18],
      [18, 25],
    ]);
  });

  it("leaves no single orphan or widow line", () => {
    // Room for 1 line only: the whole paragraph moves rather than leave one line behind.
    let pages = paginate([row(78), para(5)], fixed(100));
    expect(pages[0].fragments).toHaveLength(1);
    expect(pages[1].fragments[0]).toMatchObject({ fromLine: 0, toLine: 5 });
    // Room for 4 of 5 lines: only 3 stay so 2 go on (no widow).
    pages = paginate([row(52), para(5)], fixed(100));
    expect(pages[0].fragments[1]).toMatchObject({ fromLine: 0, toLine: 3 });
    expect(pages[1].fragments[0]).toMatchObject({ fromLine: 3, toLine: 5 });
  });

  it("places a block taller than a page alone (it can't move anywhere better)", () => {
    const pages = paginate([row(20), row(150), row(20)], fixed(100));
    expect(blocksOn(pages)).toEqual([[0], [1], [2]]);
  });

  it("uses each page's own height (page 1 may hold a header band)", () => {
    const pages = paginate([row(50), row(50), row(50), row(50)], { pageHeight: (i) => (i === 0 ? 150 : 100) });
    expect(blocksOn(pages)).toEqual([[0, 1, 2], [3]]);
  });

  it("tolerates sub-pixel rounding at the bottom", () => {
    expect(paginate([row(33.333), row(33.333), row(33.334)], fixed(100))).toHaveLength(1);
  });

  it("gives one empty page for no blocks", () => {
    expect(paginate([], fixed(100))).toEqual([{ fragments: [], used: 0 }]);
  });
});

describe("autoFit (D31)", () => {
  const layout = (rowsPerPage: Record<string, number>) => (step: string) =>
    paginate(Array.from({ length: 10 }, () => row(10)), fixed(10 * rowsPerPage[step]));

  it("keeps the largest size that fits on one page", () => {
    const tried: string[] = [];
    const result = autoFit(["xl", "l", "m", "s", "xs"], (step) => {
      tried.push(step);
      return layout({ xl: 6, l: 8, m: 10, s: 12, xs: 14 })(step);
    });
    expect(result.step).toBe("m");
    expect(result.pages).toHaveLength(1);
    expect(tried).toEqual(["xl", "l", "m"]);
  });

  it("falls back to the smallest size, on as many pages as needed", () => {
    const result = autoFit(["xl", "xs"], layout({ xl: 3, xs: 6 }));
    expect(result.step).toBe("xs");
    expect(result.pages).toHaveLength(2);
  });

  it("refuses an empty list of sizes", () => {
    expect(() => autoFit([], () => [])).toThrow();
  });
});
