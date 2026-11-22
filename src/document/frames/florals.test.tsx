import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { toDocument } from "@/biodata/document";
import { getDocDictionary } from "@/i18n/doc";
import { documentVariants, FIXTURE_TODAY } from "../../../test/fixtures/documents";
import { getTemplate } from "../templates";
import type { Palette } from "../tokens";
import { blossomTint } from "./Blossom";
import { contrast, H, W } from "./geometry";
import { vinesTint } from "./Vines";
import { blobPts, fade } from "./wash";
import { watercolourLeavesTint } from "./WatercolourLeaves";
import { watercolourRoseTint } from "./WatercolourRose";

// Step 4.4's floral designs (VISION D46, D51): Floral Ivory, Watercolour Rose, Mango Grove and Mint Vines. Their
// frames lay soft corner glows under the text, so every text colour must also read on the darkest glow; the glows
// must fade exactly to the paper (no visible edge); and the designs use the shared Classic skeleton. The PDF-subset
// and size checks for every frame live in templates/designs.test.tsx.

const FLORALS: { id: string; tint: (p: Palette) => string }[] = [
  { id: "floral-ivory", tint: blossomTint },
  { id: "watercolour-rose", tint: watercolourRoseTint },
  { id: "mango-grove", tint: watercolourLeavesTint },
  { id: "mint-vines", tint: vinesTint },
];

const docFor = (id: string) => {
  const v = documentVariants().find((x) => x.id === id)!;
  return toDocument(v.profile, getDocDictionary(v.lang), FIXTURE_TODAY);
};

describe("floral designs (Step 4.4)", () => {
  it("keep every text colour WCAG AA on the darkest corner glow, not only on the paper", () => {
    for (const { id, tint } of FLORALS) {
      for (const p of getTemplate(id).colors) {
        const glow = tint(p);
        const where = `${id}/${p.id}`;
        expect(contrast(p.text, glow), `${where} text`).toBeGreaterThanOrEqual(7);
        expect(contrast(p.label, glow), `${where} label`).toBeGreaterThanOrEqual(4.5);
        if (p.bar === "transparent") expect(contrast(p.barText, glow), `${where} heading`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("fade their corner glows to exactly the paper, drawn as linear gradients on page-corner triangles", () => {
    expect(fade("#ffffff", "#000000")).toHaveLength(6);
    expect(fade("#fff8fa", "#c2507a").at(-1)).toBe("#fff8fa");
    expect(fade("#fff8fa", "#c2507a")[0]).toBe("#c2507a");
    for (const { id } of FLORALS) {
      const Frame = getTemplate(id).Frame!;
      for (const p of getTemplate(id).colors) {
        const markup = renderToStaticMarkup(<Frame palette={p} />);
        const glows = [...markup.matchAll(/<linearGradient id="([^"]+)" gradientUnits="userSpaceOnUse"[^>]*>(.*?)<\/linearGradient>/g)];
        expect(glows.length, `${id}/${p.id}`).toBeGreaterThanOrEqual(2);
        for (const [, gid, stops] of glows) {
          expect(stops.match(/stop-color="(#[0-9a-f]{6})"/g)!.at(-1), `${id}/${p.id} ${gid}`).toBe(`stop-color="${p.paper}"`);
          expect(markup, gid).toMatch(new RegExp(`<path d="M(0|${W}) (0|${H})H[\\d.]+L(0|${W}) [\\d.]+Z" fill="url\\(#${gid}\\)"`));
        }
      }
    }
  });

  it("draw the same wobbly washes every time (seeded), so every page and the PDF match", () => {
    expect(blobPts(10, 10, 30, 12, 5, 0.16, 7)).toEqual(blobPts(10, 10, 30, 12, 5, 0.16, 7));
    expect(blobPts(10, 10, 30, 12, 5, 0.16, 7)).not.toEqual(blobPts(10, 10, 30, 12, 5, 0.16, 8));
  });

  it("use Classic's block list and frame, and start page 1 no lower with a top element", () => {
    for (const { id } of FLORALS) {
      const t = getTemplate(id);
      expect(t.id).toBe(id);
      expect(t.skeleton).toBe("classic");
      const short = docFor(`${id}-en-short`);
      const kinds = t.blocks(short, { photo: true }).map((s) => s.block.kind);
      expect(kinds[0], id).toBe("header");
      expect(kinds.filter((k) => k === "lead"), id).toHaveLength(1);
      const plain = { ...short, motif: null, title: undefined, invocation: undefined };
      expect(t.pageBox(0, plain), id).toEqual(t.pageBox(1, plain));
      expect(t.pageBox(0, short).top, id).toBeLessThanOrEqual(t.pageBox(1, short).top);
    }
    expect(getTemplate("floral-ivory").photoFrame).toBe("2:3");
  });
});
