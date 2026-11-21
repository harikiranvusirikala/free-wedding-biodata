import { describe, expect, it } from "vitest";
import {
  DEFAULT_CROP,
  LOW_DPI,
  MAX_ZOOM,
  PRINT_WIDTH_MM,
  clampCrop,
  cropPlacement,
  effectiveDpi,
  fromRotated,
  isLowResolution,
  panCrop,
  pixelsAcross,
  rotateCrop,
  sameCrop,
  toRotated,
  visibleSpan,
  zoomCrop,
} from "./photo-crop";
import { PHOTO_FRAMES, PHOTO_ROTATIONS, type PhotoCrop, type PhotoFrame } from "./types";

/** Where a point of the frame box lands on the source image, by undoing cropPlacement's four steps independently. */
function boxToSource(width: number, height: number, crop: PhotoCrop, frame: PhotoFrame, boxWidth: number, px: number, py: number) {
  const { scale, centre, origin } = cropPlacement(width, height, crop, frame, boxWidth);
  const a = (-crop.rotation * Math.PI) / 180;
  const ux = (px - centre.x) / scale;
  const uy = (py - centre.y) / scale;
  return { x: ux * Math.cos(a) - uy * Math.sin(a) + origin.x, y: ux * Math.sin(a) + uy * Math.cos(a) + origin.y };
}

/** Every corner of the frame falls on the image (the frame is covered). */
function expectCovered(width: number, height: number, crop: PhotoCrop, frame: PhotoFrame) {
  const boxWidth = 300;
  const { boxHeight } = cropPlacement(width, height, crop, frame, boxWidth);
  for (const [px, py] of [[0, 0], [boxWidth, 0], [0, boxHeight], [boxWidth, boxHeight]]) {
    const p = boxToSource(width, height, crop, frame, boxWidth, px, py);
    expect(p.x).toBeGreaterThanOrEqual(-1e-6);
    expect(p.y).toBeGreaterThanOrEqual(-1e-6);
    expect(p.x).toBeLessThanOrEqual(width + 1e-6);
    expect(p.y).toBeLessThanOrEqual(height + 1e-6);
  }
}

const IMAGES = [
  { width: 3000, height: 2000 }, // landscape
  { width: 2250, height: 3000 }, // exactly 3:4
  { width: 1000, height: 3000 }, // very tall
  { width: 800, height: 800 }, // square
];

describe("rotation coordinates", () => {
  it("round-trips every point through every quarter turn", () => {
    for (const rotation of PHOTO_ROTATIONS) {
      const [rx, ry] = toRotated(0.2, 0.7, rotation);
      const [x, y] = fromRotated(rx, ry, rotation);
      expect(x).toBeCloseTo(0.2);
      expect(y).toBeCloseTo(0.7);
    }
  });

  it("turns clockwise: the source's top-left corner ends up top-right after 90°", () => {
    expect(toRotated(0, 0, 90)).toEqual([1, 0]);
    expect(toRotated(0, 0, 270)).toEqual([0, 1]);
  });
});

describe("visibleSpan", () => {
  it("covers a wider image by its height and a taller one by its width", () => {
    expect(visibleSpan(3000, 2000, DEFAULT_CROP, "3:4")).toEqual({ width: 0.75 / 1.5, height: 1 });
    expect(visibleSpan(1000, 3000, DEFAULT_CROP, "3:4").width).toBe(1);
  });

  it("swaps the image's sides when it is turned", () => {
    expect(visibleSpan(3000, 2000, { ...DEFAULT_CROP, rotation: 90 }, "3:4").width).toBe(1);
  });

  it("shows half as much at zoom 2", () => {
    const span = visibleSpan(2250, 3000, { ...DEFAULT_CROP, zoom: 2 }, "3:4");
    expect(span.width).toBeCloseTo(0.5);
    expect(span.height).toBeCloseTo(0.5);
  });
});

describe("clampCrop", () => {
  it("keeps the frame covered for any crop, frame and rotation", () => {
    for (const image of IMAGES) {
      for (const frame of PHOTO_FRAMES) {
        for (const rotation of PHOTO_ROTATIONS) {
          for (const [x, y, zoom] of [[0, 0, 1], [1, 1, 1], [0.5, 0.5, 1], [0, 1, 2.5], [0.95, 0.1, 4], [-3, 7, 9], [0.5, 0.5, 0.2]]) {
            const crop = clampCrop({ x, y, zoom, rotation }, image.width, image.height, frame);
            expect(crop.zoom).toBeGreaterThanOrEqual(1);
            expect(crop.zoom).toBeLessThanOrEqual(MAX_ZOOM);
            expectCovered(image.width, image.height, crop, frame);
          }
        }
      }
    }
  });

  it("leaves a crop that already covers the frame alone", () => {
    const crop = { x: 0.4, y: 0.5, zoom: 2, rotation: 0 } as const;
    expect(clampCrop(crop, 3000, 2000, "3:4")).toEqual(crop);
  });

  it("centres an image that exactly fits the frame at zoom 1", () => {
    expect(clampCrop({ x: 0, y: 1, zoom: 1, rotation: 0 }, 2250, 3000, "3:4")).toEqual(DEFAULT_CROP);
  });

  it("moves only along the side the image is longer on", () => {
    const crop = clampCrop({ x: 0, y: 0, zoom: 1, rotation: 0 }, 3000, 2000, "3:4");
    expect(crop.x).toBeCloseTo(0.25);
    expect(crop.y).toBeCloseTo(0.5);
  });

  it("turns broken numbers into a usable crop", () => {
    expect(clampCrop({ x: Number.NaN, y: 0.5, zoom: Number.NaN, rotation: 0 }, 800, 800, "2:3")).toEqual({ x: 0.5, y: 0.5, zoom: 1, rotation: 0 });
  });
});

describe("panCrop", () => {
  it("moves the image with the finger: dragging right shows more of the left", () => {
    const crop = panCrop(DEFAULT_CROP, 30, 0, 3000, 2000, "3:4", 300);
    expect(crop.x).toBeLessThan(0.5);
    expect(crop.y).toBe(0.5);
    // 30 px of a 300 px frame showing half the image's width: a twentieth of the image.
    expect(crop.x).toBeCloseTo(0.45);
  });

  it("stops at the image's edge", () => {
    const crop = panCrop(DEFAULT_CROP, 5000, 0, 3000, 2000, "3:4", 300);
    expect(crop.x).toBeCloseTo(0.25);
  });

  it("follows the finger on a turned image", () => {
    // Turned 90° clockwise, the source's top is on the right: dragging left (showing more of the right) moves
    // the frame towards the source's top.
    const start = { x: 0.5, y: 0.5, zoom: 2, rotation: 90 } as const;
    const crop = panCrop(start, -20, 0, 2000, 3000, "3:4", 300);
    expect(crop.y).toBeLessThan(0.5);
    expect(crop.x).toBeCloseTo(0.5);
    expectCovered(2000, 3000, crop, "3:4");
  });

  it("does nothing while the frame has no size", () => {
    expect(panCrop(DEFAULT_CROP, 10, 10, 800, 800, "3:4", 0)).toBe(DEFAULT_CROP);
  });
});

describe("zoomCrop", () => {
  it("zooms around the centre by default and stays within limits", () => {
    expect(zoomCrop(DEFAULT_CROP, 2, 3000, 2000, "3:4")).toEqual({ ...DEFAULT_CROP, zoom: 2 });
    expect(zoomCrop(DEFAULT_CROP, 99, 3000, 2000, "3:4").zoom).toBe(MAX_ZOOM);
    expect(zoomCrop(DEFAULT_CROP, 0.1, 3000, 2000, "3:4").zoom).toBe(1);
  });

  it("keeps the point under a pinch in place", () => {
    const start = { x: 0.5, y: 0.5, zoom: 1.5, rotation: 0 } as const;
    const focus = { x: 0.25, y: -0.25 };
    const before = boxToSource(3000, 2000, start, "3:4", 300, 225, 100);
    const zoomed = zoomCrop(start, 2.5, 3000, 2000, "3:4", focus);
    const after = boxToSource(3000, 2000, zoomed, "3:4", 300, 225, 100);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it("zooming out near an edge pulls the image back over the frame", () => {
    const crop = zoomCrop({ x: 0.9, y: 0.1, zoom: 4, rotation: 180 }, 1, 3000, 2000, "2:3");
    expectCovered(3000, 2000, crop, "2:3");
  });
});

describe("rotateCrop", () => {
  it("turns a quarter at a time and comes back after four", () => {
    let crop: PhotoCrop = { x: 0.4, y: 0.5, zoom: 1.5, rotation: 0 };
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      crop = rotateCrop(crop, 3000, 2000, "3:4");
      seen.push(crop.rotation);
      expectCovered(3000, 2000, crop, "3:4");
    }
    expect(seen).toEqual([90, 180, 270, 0]);
  });

  it("keeps the same point of the photo in the middle when it can", () => {
    const crop = rotateCrop({ x: 0.45, y: 0.5, zoom: 3, rotation: 0 }, 3000, 2000, "3:4");
    expect(crop.x).toBeCloseTo(0.45);
    expect(crop.y).toBeCloseTo(0.5);
  });
});

describe("effectiveDpi", () => {
  it("counts the source pixels across the printed frame", () => {
    // 2250 px across a 3:4 frame printed 2 inches wide.
    expect(effectiveDpi(2250, 3000, DEFAULT_CROP, "3:4", 50.8)).toBeCloseTo(1125);
    expect(pixelsAcross(2250, 3000, { ...DEFAULT_CROP, zoom: 2 }, "3:4")).toBeCloseTo(1125);
  });

  it("halves when zoomed in twice as far", () => {
    const one = effectiveDpi(3000, 2000, DEFAULT_CROP, "3:4");
    expect(effectiveDpi(3000, 2000, { ...DEFAULT_CROP, zoom: 2 }, "3:4")).toBeCloseTo(one / 2);
  });

  it("uses the image's turned width", () => {
    // A landscape 3000 × 2000 turned upright is 2000 wide and covers a 3:4 frame by its width.
    expect(pixelsAcross(3000, 2000, { ...DEFAULT_CROP, rotation: 90 }, "3:4")).toBeCloseTo(2000);
  });

  it("warns below 200 dpi at the template's print width", () => {
    const needed = (LOW_DPI * PRINT_WIDTH_MM["3:4"]) / 25.4; // ≈ 417 px across
    expect(isLowResolution(240, 320, DEFAULT_CROP, "3:4")).toBe(true);
    expect(isLowResolution(Math.ceil(needed), Math.ceil((needed * 4) / 3), DEFAULT_CROP, "3:4")).toBe(false);
    expect(isLowResolution(600, 800, { ...DEFAULT_CROP, zoom: 2 }, "3:4")).toBe(true);
  });
});

describe("cropPlacement", () => {
  it("puts the crop's centre in the middle of the box", () => {
    const crop = { x: 0.3, y: 0.6, zoom: 2, rotation: 270 } as const;
    const p = boxToSource(3000, 2000, crop, "2:3", 200, 100, 150);
    expect(p.x).toBeCloseTo(900);
    expect(p.y).toBeCloseTo(1200);
  });

  it("writes the CSS for an element with its origin at the top-left", () => {
    expect(cropPlacement(2250, 3000, DEFAULT_CROP, "3:4", 150).transform).toBe("translate(75px, 100px) scale(0.06666666666666667) rotate(0deg) translate(-1125px, -1500px)");
  });
});

describe("sameCrop", () => {
  it("ignores floating-point noise but not real changes", () => {
    expect(sameCrop(DEFAULT_CROP, { ...DEFAULT_CROP, x: 0.5 + 1e-9 })).toBe(true);
    expect(sameCrop(DEFAULT_CROP, { ...DEFAULT_CROP, rotation: 90 })).toBe(false);
    expect(sameCrop(DEFAULT_CROP, { ...DEFAULT_CROP, zoom: 1.01 })).toBe(false);
  });
});
