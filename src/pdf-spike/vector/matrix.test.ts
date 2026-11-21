import { describe, expect, it } from "vitest";
import { apply, multiply, parseTransform, rotate, translate } from "./matrix";

const close = (a: [number, number], b: [number, number]) => {
  expect(a[0]).toBeCloseTo(b[0], 6);
  expect(a[1]).toBeCloseTo(b[1], 6);
};

describe("parseTransform", () => {
  it("applies the last transform in the list to points first", () => {
    // translate then scale, as SVG reads it: scale first, then translate.
    close(apply(parseTransform("translate(10 20) scale(2 3)"), 1, 1), [12, 23]);
    close(apply(parseTransform("scale(2) translate(10, 20)"), 1, 1), [22, 42]);
  });

  it("rotates about a centre", () => {
    close(apply(parseTransform("rotate(90 10 10)"), 20, 10), [10, 20]);
    close(apply(rotate(180, 5, 5), 0, 0), [10, 10]);
  });

  it("matches the ornament's rotate(…) translate(…) leaves", () => {
    const m = parseTransform("rotate(36.6 39.07 20.18) translate(13.22 0)");
    // The ellipse centre moves 13.22 along the rotated x axis.
    const [x, y] = apply(m, 39.07, 20.18);
    expect(Math.hypot(x - 39.07, y - 20.18)).toBeCloseTo(13.22, 6);
    expect(Math.atan2(y - 20.18, x - 39.07) * (180 / Math.PI)).toBeCloseTo(36.6, 6);
  });

  it("reads matrix(), mirrored scales and skew", () => {
    close(apply(parseTransform("matrix(1 0 0 1 5 6)"), 1, 1), [6, 7]);
    close(apply(parseTransform("translate(794 0) scale(-1 1)"), 10, 5), [784, 5]);
    close(apply(parseTransform("skewX(45)"), 0, 10), [10, 10]);
    expect(parseTransform(undefined)).toEqual([1, 0, 0, 1, 0, 0]);
  });

  it("multiplies in PDF order (first, then second)", () => {
    close(apply(multiply(translate(1, 0), [2, 0, 0, 2, 0, 0]), 1, 1), [4, 2]);
  });
});
