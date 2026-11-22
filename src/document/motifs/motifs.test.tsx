import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "@/i18n/app/en.json";
import { IDENTITY } from "@/pdf/matrix";
import { svgToPdf } from "@/pdf/svg-to-pdf";
import { MOTIF_IDS, MOTIF_TRADITIONS, MOTIFS_AWAITING_REVIEW, Motif, isMotif, motifTradition } from "./index";

// The motif library (Step 2.0, redrawn 2026-11-22; VISION D21, D45, D47): every drawing renders in the template's
// colours with only the SVG the PDF writer draws (src/pdf/svg-to-pdf.ts), no font glyphs, and None draws nothing.

const ALLOWED = new Set(["svg", "defs", "linearGradient", "stop", "g", "path", "circle", "rect", "polygon"]);
const draw = (id: string | null, size = 96) => renderToStaticMarkup(<Motif id={id} ink="#7d1426" base="#f6dfe3" paper="#fff8f4" size={size} />);

describe("motif library", () => {
  it("has nineteen symbols in picker order, grouped by tradition", () => {
    expect(MOTIF_IDS).toEqual([
      "ganesha",
      "ganeshaOrnate",
      "om",
      "kalash",
      "swastika",
      "lotus",
      "crescentStar",
      "allah",
      "allahMedallion",
      "cross",
      "crossBudded",
      "ikOnkar",
      "khanda",
      "jain",
      "dharmaWheel",
      "dharmaWheelSolid",
      "floral",
      "paisley",
      "rings",
    ]);
    const order = MOTIF_IDS.map((id) => MOTIF_TRADITIONS.indexOf(motifTradition(id)!));
    expect(order.every((t) => t >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(order).size).toBe(MOTIF_TRADITIONS.length);
  });

  it("keeps every id a stored draft may hold (ids are never renamed)", () => {
    for (const id of ["ganesha", "om", "kalash", "swastika", "lotus", "crescentStar", "cross", "ikOnkar", "khanda", "jain", "dharmaWheel", "floral", "rings"]) expect(isMotif(id), id).toBe(true);
  });

  it("marks the symbols that await a community's review", () => {
    expect(MOTIFS_AWAITING_REVIEW).toEqual(["om", "allah", "allahMedallion", "khanda", "jain"]);
  });

  it("names every symbol in the app text", () => {
    for (const id of MOTIF_IDS) expect(Object.hasOwn(en, `top.motif.${id}`), id).toBe(true);
  });

  it("draws each one with PDF-safe elements only, in the given colours, with no transformed gradient", () => {
    for (const id of MOTIF_IDS) {
      const svg = draw(id);
      const tags = [...svg.matchAll(/<([a-zA-Z]+)[\s>/]/g)].map((m) => m[1]);
      for (const tag of tags) expect(ALLOWED.has(tag), `${id}: <${tag}>`).toBe(true);
      expect(svg, id).toContain('viewBox="0 0 120 120"');
      expect(svg, id).toContain("#7d1426");
      expect(svg, id).not.toMatch(/mask=|paint-order|<text|NaN|Infinity/);
      // Turning a gradient-filled shape would tilt its gradient: the drawings turn paths with xf instead.
      expect(svg, id).not.toMatch(/transform=/);
    }
  });

  it("cuts details in the paper colour, never as a pale disc behind the symbol", () => {
    for (const id of MOTIF_IDS) {
      const svg = draw(id);
      expect(svg, id).not.toContain("#f6dfe3");
    }
  });

  it("converts to PDF operators without a single unsupported-SVG warning", () => {
    const resources = { pattern: () => "P0", alpha: () => "A0" };
    for (const id of MOTIF_IDS) {
      const warnings: string[] = [];
      const ops = svgToPdf(draw(id), { x: 0, y: 0, width: 96, height: 96 }, IDENTITY, resources, (m) => warnings.push(m));
      expect(warnings, id).toEqual([]);
      expect(ops.length, id).toBeGreaterThan(200);
    }
  });

  it("draws nothing for None or an unknown id", () => {
    expect(draw(null, 40)).toBe("");
    expect(draw("trident", 40)).toBe("");
    expect(isMotif("toString")).toBe(false);
  });
});
