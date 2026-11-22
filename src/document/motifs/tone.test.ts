import { describe, expect, it } from "vitest";
import { getPalette, getTemplate } from "../templates";
import { GOLD_LUMA, LIGHT, SHADE, luma, parseHex, toneOf, tonePixels, toneRamp } from "./tone";

// The gold symbol pictures in the design's colours (./tone.ts): the tone of each pixel follows its lightness
// relative to the art's gold, alpha is kept exactly, lighter stays lighter, and the ends of the ramp are reached.

const px = (...colours: [number, number, number, number][]) => new Uint8ClampedArray(colours.flat());
const pixelsOf = (out: Uint8ClampedArray) => Array.from({ length: out.length / 4 }, (_, i) => [...out.slice(i * 4, i * 4 + 4)]);
const GOLD: [number, number, number] = [0xb7, 0x79, 0x1f];
const close = (a: readonly number[], b: readonly number[], tolerance = 1) => a.every((v, i) => Math.abs(v - b[i]) <= tolerance);

describe("tonePixels", () => {
  it("prints the art's gold as the ink itself, and black and white at the ramp's ends", () => {
    expect(luma(...GOLD)).toBeCloseTo(GOLD_LUMA, 2);
    const ink = "#0f6e74";
    const ramp = toneRamp(ink);
    const [gold, black, white] = pixelsOf(tonePixels(px([...GOLD, 255], [0, 0, 0, 255], [255, 255, 255, 255]), ink));
    expect(close(gold, [...parseHex(ink), 255], 2), String(gold)).toBe(true);
    expect(close(black, [...ramp.deep.map(Math.round), 255]), String(black)).toBe(true);
    expect(close(white, [...ramp.light.map(Math.round), 255]), String(white)).toBe(true);
    // The ends: the ink SHADE of the way to black, LIGHT of the way to white (a highlight stays tinted, not white).
    expect(ramp.deep.map(Math.round)).toEqual(parseHex(ink).map((v) => Math.round(v * (1 - SHADE))));
    expect(ramp.light.map(Math.round)).toEqual(parseHex(ink).map((v) => Math.round(v + (255 - v) * LIGHT)));
  });

  it("keeps alpha exactly, transparent pixels included", () => {
    const alphas = [0, 1, 37, 128, 200, 254, 255];
    const input = px(...alphas.map((a, i) => [180 - i * 10, 120 + i, 30, a] as [number, number, number, number]));
    const out = tonePixels(input, "#7d1426");
    expect(pixelsOf(out).map((p) => p[3])).toEqual(alphas);
    expect(out).not.toBe(input);
  });

  it("keeps the order of lightness: a lighter pixel in the source is never darker in the result", () => {
    for (const ink of ["#9a5b13", "#0f6e74", "#7d1426", "#3a3833", "#f2cd6b", "#ecc96a"]) {
      const greys = Array.from({ length: 52 }, (_, i) => i * 5);
      const golds = greys.map((v) => [Math.min(255, v * 1.4), v, v * 0.3, 255] as [number, number, number, number]).sort((a, b) => luma(a[0], a[1], a[2]) - luma(b[0], b[1], b[2]));
      const out = pixelsOf(tonePixels(px(...golds), ink)).map((p) => luma(p[0], p[1], p[2]));
      for (let i = 1; i < out.length; i++) expect(out[i], `${ink} step ${i}`).toBeGreaterThanOrEqual(out[i - 1] - 1e-9);
      expect(out.at(-1)! - out[0], ink).toBeGreaterThan(0.2);
    }
  });

  it("gives the result the ink's hue: Peacock teal has no gold left", () => {
    const shaded = px([0xa0, 0x6a, 0x10, 255], [...GOLD, 255], [0xe0, 0xb0, 0x50, 255], [0xf8, 0xe6, 0xb8, 255]);
    for (const [r, g, b] of pixelsOf(tonePixels(shaded, "#0f6e74"))) {
      expect(g, "green over red").toBeGreaterThan(r);
      expect(b, "blue over red").toBeGreaterThan(r);
    }
  });

  it("keeps a flat line drawing one colour (the ink) and a shaded picture's highlights lighter than its body", () => {
    const flat = pixelsOf(tonePixels(px([...GOLD, 255], [...GOLD, 90], [...GOLD, 10]), "#2f6a2b"));
    expect(new Set(flat.map((p) => p.slice(0, 3).join())).size).toBe(1);
    const [body, highlight] = pixelsOf(tonePixels(px([0xc0, 0x88, 0x30, 255], [0xf4, 0xe0, 0xb0, 255]), "#2f6a2b"));
    expect(luma(highlight[0], highlight[1], highlight[2]) - luma(body[0], body[1], body[2])).toBeGreaterThan(0.25);
  });

  it("stays light and readable on the dark papers, whose ink is a light gold", () => {
    for (const [template, colour] of [["deepam", "maroon"], ["deepam", "night"], ["baroque-gold", "navy"], ["peacock", "emerald"]] as const) {
      const palette = getPalette(getTemplate(template), colour);
      const paper = luma(...parseHex(palette.paper));
      expect(luma(...parseHex(palette.ink)), `${template} ${colour} is a dark paper`).toBeGreaterThan(paper + 0.4);
      // The art's darkest gold (luma 0.43 in the shaded pictures) and its body still stand well clear of the paper.
      const darkest = toneOf(0.43, toneRamp(palette.ink));
      expect(luma(...darkest) - paper, `${template} ${colour}`).toBeGreaterThan(0.4);
    }
  });

  it("is quick enough for the largest picture (768 × 768)", () => {
    const big = new Uint8ClampedArray(768 * 768 * 4).map((_, i) => (i * 37) & 255);
    const start = performance.now();
    tonePixels(big, "#0f6e74");
    expect(performance.now() - start).toBeLessThan(1000);
  });
});
