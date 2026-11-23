import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The colour polish (Step 2.5, VISION D51) keeps WCAG AA (BUILD_PLAN A7): text on every colour a gradient passes
// through is checked here against the tokens in globals.css, Day and Night, so a later tweak can't drop it.

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/** A theme's custom properties: the `:root` block (Day) or the `.dark` block (Night). */
function tokens(selector: ":root" | ".dark"): Map<string, string> {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} block`).toBeGreaterThanOrEqual(0);
  const body = css.slice(start, css.indexOf("\n}", start));
  const map = new Map<string, string>();
  for (const [, name, value] of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) map.set(name, value.trim());
  return map;
}

/** The hex colour stops of a gradient value, in order. */
const stops = (gradient: string) => [...gradient.matchAll(/#[0-9a-f]{6}\b/gi)].map(([hex]) => hex);

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("contrast helper", () => {
  it("matches the WCAG formula's known values", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrast("#ffffff", "#767676")).toBeCloseTo(4.54, 2);
  });
});

describe.each([
  ["Day", ":root"],
  ["Night", ".dark"],
] as const)("%s theme gradients", (_, selector) => {
  const t = tokens(selector);
  const get = (name: string) => {
    const value = t.get(name);
    expect(value, name).toBeDefined();
    return value!;
  };

  it("defines every gradient token with at least two colour stops", () => {
    for (const name of ["--brand-gradient", "--brand-gradient-hover", "--accent-text", "--accent-strip", "--tile-gradient"]) {
      expect(stops(get(name)).length, name).toBeGreaterThanOrEqual(2);
    }
    expect(get("--page-wash")).toMatch(/gradient\(/);
  });

  it("keeps button text at AA (4.5:1) on both ends of the button gradient and its hover", () => {
    const onBrand = get("--on-brand");
    for (const name of ["--brand-gradient", "--brand-gradient-hover"]) {
      for (const stop of stops(get(name))) expect(contrast(onBrand, stop), `${name} ${stop}`).toBeGreaterThanOrEqual(4.5);
    }
    // The flat colour under the gradient (and the disabled state) too.
    expect(contrast(onBrand, get("--brand"))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the headline accent legible on the page: ≥ 4:1 at every stop (large text needs 3:1)", () => {
    const page = get("--page");
    for (const stop of stops(get("--accent-text"))) expect(contrast(stop, page), stop).toBeGreaterThanOrEqual(4);
    // The fallback colour where background-clip: text isn't supported.
    expect(contrast(get("--brand-ink"), page)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps every text colour at AA (4.5:1) on every surface it sits on (Step 6.2: axe found grey on sunken below it)", () => {
    for (const ink of ["--ink", "--ink-2", "--ink-3"]) {
      for (const bg of ["--surface", "--page", "--sunken", "--brand-soft"]) expect(contrast(get(ink), get(bg)), `${ink} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps brand-coloured icons readable on the soft icon tile", () => {
    for (const stop of stops(get("--tile-gradient"))) expect(contrast(get("--brand-ink"), stop), stop).toBeGreaterThanOrEqual(4.5);
  });
});
