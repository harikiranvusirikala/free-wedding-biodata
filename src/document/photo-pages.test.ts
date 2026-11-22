import { describe, expect, it } from "vitest";
import { PHOTO_PAGE_FRAME } from "@/biodata/photo-pages";
import { CHART_HEADING_RESERVE, PHOTO_GAP, REFERENCE_CONTENT, chartPlacement, contentSize, inputPageCounts, photoCellSize, photoPageCells, photoPagePixels } from "./photo-pages";
import { TEMPLATES } from "./templates";
import { PAGE } from "./tokens";
import type { DocModel } from "@/biodata/document";

// Step 4.2b: the layout of the pages after the biodata is arithmetic, shared by every design, the preview, the PDF
// and the page images (D1).

const CLASSIC = { width: 666, height: 947 };
/** Whole-pixel rounding may be a pixel off centre. */
const within1 = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);
const doc = (templateId: string): DocModel => ({ lang: "en", templateId, colorId: "", textSize: "auto", labelCase: "normal", motif: null, sections: [] });

describe("photo cells", () => {
  it("one photo is the largest tall 2:3 cell the content box holds", () => {
    expect(photoCellSize(CLASSIC, 1)).toEqual({ width: 631, height: 946 });
    // A narrow content box (Modern's) is limited by its width instead.
    expect(photoCellSize({ width: 456, height: 1011 }, 1)).toEqual({ width: 456, height: 684 });
  });

  it("two sit side by side with a gap, four in a 2 × 2 grid of 3:4", () => {
    const two = photoCellSize(CLASSIC, 2);
    expect(two.width).toBe(Math.floor((CLASSIC.width - PHOTO_GAP) / 2));
    expect(two.height / two.width).toBeCloseTo(1.5, 2);
    const four = photoCellSize(CLASSIC, 4);
    expect(four.width).toBe(two.width);
    expect(four.height / four.width).toBeCloseTo(4 / 3, 2);
    expect(2 * four.height + PHOTO_GAP).toBeLessThanOrEqual(CLASSIC.height);
  });

  it("every cell of a layout is one size and the frame follows the layout", () => {
    for (const n of [1, 2, 4] as const) {
      const size = photoCellSize(CLASSIC, n);
      for (let count = 1; count <= n; count++) for (const cell of photoPageCells(CLASSIC, n, count)) expect({ width: cell.width, height: cell.height }).toEqual(size);
    }
    expect(PHOTO_PAGE_FRAME).toEqual({ 1: "2:3", 2: "2:3", 4: "3:4" });
  });

  it("centres one photo, a pair, and a short last row", () => {
    const [only] = photoPageCells(CLASSIC, 1, 1);
    within1(only.x * 2 + only.width, CLASSIC.width);
    within1(only.y * 2 + only.height, CLASSIC.height);

    const pair = photoPageCells(CLASSIC, 2, 2);
    expect(pair[0].y).toBe(pair[1].y);
    expect(pair[1].x - (pair[0].x + pair[0].width)).toBe(PHOTO_GAP);
    within1(pair[0].x + (CLASSIC.width - (pair[1].x + pair[1].width)), 2 * pair[0].x);

    // One photo on a 2-per-page page keeps its neighbours' size, centred.
    const alone = photoPageCells(CLASSIC, 2, 1)[0];
    expect(alone.width).toBe(pair[0].width);
    within1(alone.x * 2 + alone.width, CLASSIC.width);

    // Three of four: two in the top row, one centred below.
    const three = photoPageCells(CLASSIC, 4, 3);
    expect(three).toHaveLength(3);
    expect(three[0].y).toBe(three[1].y);
    expect(three[2].y).toBeGreaterThan(three[0].y);
    within1(three[2].x * 2 + three[2].width, CLASSIC.width);
    // The block of two rows is centred down the page.
    const bottom = three[2].y + three[2].height;
    within1(three[0].y + (CLASSIC.height - bottom), 2 * three[0].y);
  });

  it("stacks two photos in a narrow box, where that makes them wider (the Modern designs' column)", () => {
    const narrow = { width: 456, height: 1011 };
    const cells = photoPageCells(narrow, 2, 2);
    expect(cells[0].x).toBe(cells[1].x);
    expect(cells[1].y - (cells[0].y + cells[0].height)).toBe(PHOTO_GAP);
    expect(cells[0].width).toBeGreaterThan(photoCellSize({ width: 456, height: 1011 }, 4).width);
    expect(cells[0].height / cells[0].width).toBeCloseTo(1.5, 2);
    // Still 2:3 whichever way they sit, so a crop never changes with the design; a lone photo is centred.
    const alone = photoPageCells(narrow, 2, 1)[0];
    expect(alone.width).toBe(cells[0].width);
    within1(alone.y * 2 + alone.height, narrow.height);
    // A wide box keeps them side by side.
    expect(photoPageCells(CLASSIC, 2, 2)[0].y).toBe(photoPageCells(CLASSIC, 2, 2)[1].y);
  });

  it("never leaves the content box, in any design, for any count", () => {
    for (const template of TEMPLATES) {
      const content = contentSize(template.pageBox(1, doc(template.id)));
      for (const n of [1, 2, 4] as const) {
        for (let count = 1; count <= n; count++) {
          for (const cell of photoPageCells(content, n, count)) {
            expect(cell.x, `${template.id} ${n}`).toBeGreaterThanOrEqual(0);
            expect(cell.y, `${template.id} ${n}`).toBeGreaterThanOrEqual(0);
            expect(cell.x + cell.width, `${template.id} ${n}`).toBeLessThanOrEqual(content.width);
            expect(cell.y + cell.height, `${template.id} ${n}`).toBeLessThanOrEqual(content.height);
          }
        }
      }
    }
  });

  it("draws every design's photos at most at the pixels the reference box asks for (300 dpi)", () => {
    for (const template of TEMPLATES) {
      const content = contentSize(template.pageBox(1, doc(template.id)));
      expect(content.width, template.id).toBeLessThanOrEqual(REFERENCE_CONTENT.width);
      expect(content.height, template.id).toBeLessThanOrEqual(REFERENCE_CONTENT.height);
      for (const n of [1, 2, 4] as const) expect(photoCellSize(content, n).width * 300 / 96, `${template.id} ${n}`).toBeLessThanOrEqual(photoPagePixels(n));
    }
    expect(REFERENCE_CONTENT).toEqual({ width: PAGE.width - 120, height: PAGE.height - 112 });
    expect(photoPagePixels(1)).toBe(Math.ceil((photoCellSize(REFERENCE_CONTENT, 1).width * 300) / 96));
    expect(photoPagePixels(1)).toBeGreaterThan(2000);
  });
});

describe("the chart page", () => {
  it("fits the picture whole under the heading, never cropped, centred across", () => {
    const wide = chartPlacement(CLASSIC, { width: 1600, height: 1200 });
    expect(wide.width).toBe(CLASSIC.width);
    expect(wide.width / wide.height).toBeCloseTo(4 / 3, 2);
    expect(wide.y).toBe(CHART_HEADING_RESERVE);
    const tall = chartPlacement(CLASSIC, { width: 1000, height: 3000 });
    expect(tall.height).toBe(CLASSIC.height - CHART_HEADING_RESERVE);
    expect(tall.width / tall.height).toBeCloseTo(1 / 3, 2);
    expect(Math.abs(tall.x * 2 + tall.width - CLASSIC.width)).toBeLessThanOrEqual(1);
    // Small pictures are scaled up to fill: the chart is meant to be read.
    expect(chartPlacement(CLASSIC, { width: 300, height: 300 }).width).toBe(CLASSIC.width);
  });
});

describe("inputPageCounts", () => {
  it("counts photo pages and the chart's page", () => {
    const picture = { src: "blob:x", width: 1, height: 1 };
    expect(inputPageCounts(undefined)).toEqual({ photos: 0, chart: 0, total: 0 });
    expect(inputPageCounts({ perPage: 2, photos: [{ id: "a" }, { id: "b" }, { id: "c", picture }] })).toEqual({ photos: 2, chart: 0, total: 2 });
    expect(inputPageCounts({ perPage: 4, photos: [], chart: { title: "Horoscope", picture } })).toEqual({ photos: 0, chart: 1, total: 1 });
  });
});
