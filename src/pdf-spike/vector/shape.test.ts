import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadShapingFont, shapeRun, type HarfBuzzModule } from "./shape";
import { createSubsetter } from "./subset";

const fonts = path.join(process.cwd(), "public/fonts");
const hb = (await import("harfbuzzjs")) as HarfBuzzModule;
const load = (family: string, file: string) => loadShapingFont(hb, family, 400, readFileSync(path.join(fonts, file)));

describe("shapeRun", () => {
  const telugu = load("Noto Sans Telugu", "NotoSansTelugu-Regular.ttf");
  const latin = load("Noto Sans", "NotoSans-Regular.ttf");

  it("shapes the Telugu conjunct శ్రీ into fewer glyphs than code points", () => {
    const run = shapeRun(hb, "శ్రీ", [telugu, latin], 13.5, 0, "te");
    expect(run.codePoints).toBe(4);
    expect(run.glyphs.length).toBeLessThan(4);
    expect(run.glyphs.every((g) => g.gid !== 0)).toBe(true);
    expect(run.clusters).toBe(1);
  });

  it("adds letter spacing after every cluster", () => {
    const plain = shapeRun(hb, "బయోడేటా", [telugu], 26, 0, "te");
    const spaced = shapeRun(hb, "బయోడేటా", [telugu], 26, 2, "te");
    expect(spaced.width - plain.width).toBeCloseTo(2 * plain.clusters, 5);
  });

  it("keeps a ZWNJ from forming a conjunct (సాఫ్ట్‌వేర్)", () => {
    const withZwnj = shapeRun(hb, "ట్‌వ", [telugu], 13.5, 0, "te");
    const without = shapeRun(hb, "ట్వ", [telugu], 13.5, 0, "te");
    expect(withZwnj.glyphs.map((g) => g.gid)).not.toEqual(without.glyphs.map((g) => g.gid));
  });

  it("falls back to the next family for characters the first lacks", () => {
    expect(telugu.unicodes.has(0x3a9)).toBe(false);
    expect(latin.unicodes.has(0x3a9)).toBe(true);
    const run = shapeRun(hb, "ఆ Ω", [telugu, latin], 13.5, 0, "te");
    expect(run.glyphs.map((g) => g.font.family)).toEqual(["Noto Sans Telugu", "Noto Sans Telugu", "Noto Sans"]);
    expect(run.glyphs.every((g) => g.gid !== 0)).toBe(true);
  });
});

describe("createSubsetter", () => {
  it("keeps glyph IDs and shrinks the font", async () => {
    const bytes = readFileSync(path.join(fonts, "NotoSansTelugu-Regular.ttf"));
    const subsetter = await createSubsetter(readFileSync(path.join(process.cwd(), "node_modules/harfbuzzjs/dist/harfbuzz-subset.wasm")));
    const telugu = load("Noto Sans Telugu", "NotoSansTelugu-Regular.ttf");
    const gids = shapeRun(hb, "శ్రీ", [telugu], 13.5, 0, "te").glyphs.map((g) => g.gid);
    const out = subsetter.subset(new Uint8Array(bytes), gids);
    expect(out.byteLength).toBeLessThan(bytes.byteLength / 5);
    const sub = loadShapingFont(hb, "sub", 400, out);
    for (const g of gids) expect(sub.advance(g)).toBe(telugu.advance(g));
  });
});
