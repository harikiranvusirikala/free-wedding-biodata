import { describe, expect, it } from "vitest";
import { MAX_ZOOM, MIN_ZOOM, PAGE_GAP, PAGE_HEIGHT, PAGE_WIDTH, fitScale, pageInView, pageTop, percent, resolveScale, sizeHint, stackHeight, stepZoom } from "./layout-math";

describe("fitScale", () => {
  it("fits the whole page in the pane, by its height or its width, whichever is tighter", () => {
    expect(fitScale({ width: 600, height: 741 }, "page")).toBeCloseTo(741 / PAGE_HEIGHT);
    expect(fitScale({ width: 397, height: 2000 }, "page")).toBeCloseTo(0.5);
  });

  it("fits the width only on phones, where the pane scrolls", () => {
    expect(fitScale({ width: 358, height: 300 }, "width")).toBeCloseTo(358 / PAGE_WIDTH);
  });

  it("stays within the zoom range on huge or empty panes", () => {
    expect(fitScale({ width: 4000, height: 4000 }, "page")).toBe(1.25);
    expect(fitScale({ width: 4000, height: 4000 }, "page", 1)).toBe(1);
    expect(fitScale({ width: 0, height: 0 }, "page")).toBe(MIN_ZOOM);
    expect(fitScale({ width: -5, height: 100 }, "width")).toBe(MIN_ZOOM);
  });
});

describe("stepZoom", () => {
  it("goes to the next step above or below the scale shown, from a fitted scale too", () => {
    expect(stepZoom(0.66, 1)).toBe(0.67);
    expect(stepZoom(0.67, 1)).toBe(0.75);
    expect(stepZoom(0.62, -1)).toBe(0.5);
    expect(stepZoom(1, -1)).toBe(0.9);
    expect(stepZoom(1, 1)).toBe(1.1);
  });

  it("stays put at either end", () => {
    expect(stepZoom(MAX_ZOOM, 1)).toBe(MAX_ZOOM);
    expect(stepZoom(MIN_ZOOM, -1)).toBe(MIN_ZOOM);
  });

  it("resolves fit to the fitted scale and shows it as a percentage", () => {
    expect(resolveScale("fit", 0.66)).toBe(0.66);
    expect(resolveScale(1.25, 0.66)).toBe(1.25);
    expect(percent(0.6612)).toBe("66%");
  });
});

describe("page positions", () => {
  it("stacks pages 24 px apart", () => {
    expect(stackHeight(1)).toBe(PAGE_HEIGHT);
    expect(stackHeight(2)).toBe(2 * PAGE_HEIGHT + PAGE_GAP);
    expect(stackHeight(0)).toBe(PAGE_HEIGHT);
    expect(pageTop(0, 0.5)).toBe(0);
    expect(pageTop(1, 0.5)).toBe((PAGE_HEIGHT + PAGE_GAP) * 0.5);
  });

  it("names the page that covers the middle of the pane", () => {
    const scale = 0.5;
    const view = 600;
    expect(pageInView(0, view, scale, 1)).toBe(0);
    expect(pageInView(0, view, scale, 2)).toBe(0);
    expect(pageInView(pageTop(1, scale), view, scale, 2)).toBe(1);
    expect(pageInView(10_000, view, scale, 2)).toBe(1);
  });
});

describe("sizeHint", () => {
  it("says which size Auto chose when it fits one page (D31)", () => {
    expect(sizeHint("auto", { pages: 1, step: "m" })).toEqual({ key: "preview.fit.autoOne", values: { size: "M" } });
  });

  it("says Auto takes more pages even at the smallest size", () => {
    expect(sizeHint("auto", { pages: 2, step: "xs" })).toEqual({ key: "preview.fit.autoMany", values: { pages: 2 } });
  });

  it("says whether a fixed size fits (D45)", () => {
    expect(sizeHint("l", { pages: 1, step: "l" })).toEqual({ key: "preview.fit.one", values: { size: "L" } });
    expect(sizeHint("xl", { pages: 3, step: "xl" })).toEqual({ key: "preview.fit.many", values: { pages: 3, size: "XL" } });
  });
});
