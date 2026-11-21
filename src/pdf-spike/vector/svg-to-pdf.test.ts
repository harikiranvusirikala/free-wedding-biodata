import { describe, expect, it } from "vitest";
import type { Matrix } from "./matrix";
import { svgToPdf, viewBoxMatrix, type LinearGradient } from "./svg-to-pdf";
import { parseXml } from "./xml";

const PAGE: Matrix = [0.75, 0, 0, -0.75, 0, 841.89];

function render(markup: string, box = { x: 0, y: 0, width: 100, height: 100 }) {
  const patterns: { g: LinearGradient; m: Matrix }[] = [];
  const warnings: string[] = [];
  const ops = svgToPdf(markup, box, PAGE, { pattern: (g, m) => (patterns.push({ g, m }), `P${patterns.length}`), alpha: (f, s) => `GS${f}_${s}` }, (w) => warnings.push(w));
  return { ops, patterns, warnings };
}

describe("parseXml", () => {
  it("reads nested elements, both quote styles, self-closing tags, entities and comments", () => {
    const el = parseXml(`<?xml version="1.0"?><!-- c --><svg viewBox='0 0 10 10'><g fill="a&amp;b"><path d="M0 0"/></g><text>x &lt; y</text></svg>`);
    expect(el.name).toBe("svg");
    expect(el.attrs.viewBox).toBe("0 0 10 10");
    expect(el.children[0].attrs.fill).toBe("a&b");
    expect(el.children[0].children[0].name).toBe("path");
    expect(el.children[1].text).toBe("x < y");
  });

  it("rejects mismatched tags", () => {
    expect(() => parseXml("<svg><g></svg>")).toThrow();
  });
});

describe("svgToPdf", () => {
  it("maps the viewBox into the box (xMidYMid meet)", () => {
    const m = viewBoxMatrix(parseXml(`<svg viewBox="0 0 120 130"></svg>`), { x: 355, y: 58, width: 84, height: 91 });
    expect(m[0]).toBeCloseTo(0.7, 6);
    expect(m[4]).toBeCloseTo(355, 6);
    expect(m[5]).toBeCloseTo(58, 6);
  });

  it("inherits stroke properties from the root and fills shapes black by default", () => {
    const { ops } = render(`<svg viewBox="0 0 100 100" fill="none" stroke="#9a5b13" stroke-width="6" stroke-linecap="round"><path d="M0 0h10"/><circle cx="5" cy="5" r="2" fill="#9a5b13" stroke="none"/><rect width="5" height="5" style="fill: red"/></svg>`);
    expect(ops).toContain("0.6039 0.3569 0.0745 RG\n6 w\n1 J");
    expect(ops).toMatch(/0 0 m\n10 0 l\nS/);
    expect(ops).toMatch(/0\.6039 0\.3569 0\.0745 rg\n[^]*c\nh\nf/);
    expect(ops).toContain("1 0 0 rg");
  });

  it("applies element transforms with cm inside q/Q", () => {
    const { ops } = render(`<svg viewBox="0 0 100 100"><g transform="translate(10 0) scale(-1 1)"><circle cx="5" cy="5" r="1"/></g></svg>`);
    expect(ops).toContain("q\n-1 0 0 1 10 0 cm");
  });

  it("paints linearGradient fills as shading patterns over the element's bounding box", () => {
    const { ops, patterns } = render(
      `<svg viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b07a14"/><stop offset=".5" stop-color="#f2cd6b"/><stop offset="1" stop-color="#c08a22"/></linearGradient></defs><ellipse cx="50" cy="20" rx="10" ry="5" fill="url(#g)"/><path d="M0 0H50" stroke="url(#g)"/></svg>`,
    );
    expect(ops).toContain("/Pattern cs /P1 scn");
    expect(patterns[0].g.stops.map((s) => s.offset)).toEqual([0, 0.5, 1]);
    expect(patterns[0].g.matrix).toEqual([20, 0, 0, 10, 40, 15]);
    // The line has no height: an objectBoundingBox gradient isn't rendered (SVG rule), so no stroke is drawn.
    expect(patterns).toHaveLength(1);
    expect(ops).not.toContain("SCN");
  });

  it("reports what it can't draw", () => {
    const { warnings } = render(`<svg viewBox="0 0 10 10"><text>hi</text><radialGradient id="r"/></svg>`);
    expect(warnings.join(" ")).toMatch(/radialGradient/);
    expect(warnings.join(" ")).toMatch(/<text>/);
  });
});
