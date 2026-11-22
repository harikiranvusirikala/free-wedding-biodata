import { describe, expect, it } from "vitest";
import { pageStatus } from "./page-status";

describe("pageStatus (Step 4.2b)", () => {
  it("keeps the old sentences when nothing follows the biodata", () => {
    expect(pageStatus({ pages: 1, photoPages: 0, chartPages: 0 })).toBe("Fits on 1 page · A4");
    expect(pageStatus({ pages: 2, photoPages: 0, chartPages: 0 })).toBe("2 pages · A4");
  });

  it("says how many pages are details, how many are photos, and the chart's", () => {
    expect(pageStatus({ pages: 1, photoPages: 3, chartPages: 0 })).toBe("1 page of details + 3 photo pages · A4");
    expect(pageStatus({ pages: 2, photoPages: 1, chartPages: 1 })).toBe("2 pages of details + 1 photo page + horoscope page · A4");
    expect(pageStatus({ pages: 1, photoPages: 0, chartPages: 1 })).toBe("1 page of details + horoscope page · A4");
  });
});
