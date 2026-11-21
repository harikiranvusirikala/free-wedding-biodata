import { describe, expect, it } from "vitest";
import { arcToCubics, ellipsePath, parsePath, pathBBox, rectPath, type Segment } from "./svg-path";

const end = (segments: Segment[]) => {
  for (let i = segments.length - 1; i >= 0; i--) {
    const s = segments[i];
    if (s.op !== "Z") return [s.x, s.y];
  }
  return null;
};

describe("parsePath", () => {
  it("reads absolute M/L/H/V/Z", () => {
    expect(parsePath("M300 24H494M22 300V823L10 10Z")).toEqual([
      { op: "M", x: 300, y: 24 },
      { op: "L", x: 494, y: 24 },
      { op: "M", x: 22, y: 300 },
      { op: "L", x: 22, y: 823 },
      { op: "L", x: 10, y: 10 },
      { op: "Z" },
    ]);
  });

  it("reads relative commands, implicit linetos and packed numbers", () => {
    expect(parsePath("m10 10 5 5h-3v.5l1-1z")).toEqual([
      { op: "M", x: 10, y: 10 },
      { op: "L", x: 15, y: 15 },
      { op: "L", x: 12, y: 15 },
      { op: "L", x: 12, y: 15.5 },
      { op: "L", x: 13, y: 14.5 },
      { op: "Z" },
    ]);
  });

  it("returns to the subpath start after Z for following relative commands", () => {
    const s = parsePath("M10 10l5 0z l1 1");
    expect(s[s.length - 1]).toEqual({ op: "L", x: 11, y: 11 });
  });

  it("reads relative cubics and reflects S controls", () => {
    const s = parsePath("M40 44c-14-10-30-4-30 12s12 22 24 18");
    expect(s[1]).toEqual({ op: "C", x1: 26, y1: 34, x2: 10, y2: 40, x: 10, y: 56 });
    // S's first control is the reflection of the previous second control (10,40) about (10,56).
    expect(s[2]).toEqual({ op: "C", x1: 10, y1: 72, x2: 22, y2: 78, x: 34, y: 74 });
  });

  it("elevates Q to a cubic and reflects T", () => {
    const s = parsePath("M0 0Q30 30 60 0T120 0");
    expect(s[1]).toEqual({ op: "C", x1: 20, y1: 20, x2: 40, y2: 20, x: 60, y: 0 });
    const t = s[2];
    expect(t.op).toBe("C");
    if (t.op === "C") {
      expect(t.y1).toBeCloseTo(-20);
      expect(t.x).toBe(120);
    }
  });

  it("reads arcs with packed flags and ends exactly at the endpoint", () => {
    const s = parsePath("M10 20a5 5 0 1010 0");
    expect(end(s)).toEqual([20, 20]);
    // A half circle (large arc, sweep) bulges by its radius: bounding box height 5.
    const box = pathBBox(s)!;
    expect(box.width).toBeCloseTo(10, 5);
    expect(box.height).toBeCloseTo(5, 2);
  });

  it("splits arcs into quarter segments and scales up radii that are too small", () => {
    expect(arcToCubics(0, 0, 10, 10, 0, true, true, 0, 0.0001).length).toBeGreaterThanOrEqual(3);
    const tiny = arcToCubics(0, 0, 1, 1, 0, false, true, 10, 0);
    expect(tiny.length).toBe(2);
    expect(end(tiny)).toEqual([10, 0]);
  });

  it("rejects malformed data", () => {
    expect(() => parsePath("10 10")).toThrow();
    expect(() => parsePath("M10")).toThrow();
  });
});

describe("shapes and bounding boxes", () => {
  it("draws an ellipse as four cubics with a tight box", () => {
    const e = ellipsePath(39, 20, 15.5, 6.5);
    expect(e.filter((s) => s.op === "C")).toHaveLength(4);
    expect(pathBBox(e)).toEqual({ x: 23.5, y: 13.5, width: 31, height: 13 });
  });

  it("clamps rect radii to half the size", () => {
    const r = rectPath(0, 0, 10, 4, 8);
    expect(pathBBox(r)).toEqual({ x: 0, y: 0, width: 10, height: 4 });
    expect(r[0]).toEqual({ op: "M", x: 5, y: 0 });
  });

  it("includes curve extrema beyond the end points", () => {
    const box = pathBBox(parsePath("M22 22 Q140 8 300 30"))!;
    expect(box.y).toBeLessThan(22);
    expect(box.y).toBeGreaterThan(8);
  });
});
