import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MOTIF_IDS, MOTIF_TRADITIONS, MOTIFS_AWAITING_REVIEW, Motif, isMotif, motifTradition } from "./index";

// The motif library (Step 2.0, VISION D21, D45, D47): every drawing renders in the template's colours with only the
// SVG the PDF writer draws (src/pdf/svg-to-pdf.ts), no font glyphs, and None draws nothing.

const ALLOWED = new Set(["svg", "defs", "linearGradient", "stop", "g", "path", "circle", "rect", "polygon"]);

describe("motif library", () => {
  it("has the step's thirteen symbols, each in a tradition, in picker order", () => {
    expect(MOTIF_IDS).toEqual(["ganesha", "om", "kalash", "swastika", "lotus", "crescentStar", "cross", "ikOnkar", "khanda", "jain", "dharmaWheel", "floral", "rings"]);
    for (const id of MOTIF_IDS) expect(MOTIF_TRADITIONS).toContain(motifTradition(id));
    expect(MOTIFS_AWAITING_REVIEW).toEqual(["khanda", "jain"]);
  });

  it("draws each one with PDF-safe elements only, in the given colours", () => {
    for (const id of MOTIF_IDS) {
      const svg = renderToStaticMarkup(<Motif id={id} ink="#7d1426" base="#f6dfe3" size={96} />);
      const tags = [...svg.matchAll(/<([a-zA-Z]+)[\s>/]/g)].map((m) => m[1]);
      for (const tag of tags) expect(ALLOWED.has(tag), `${id}: <${tag}>`).toBe(true);
      expect(svg, id).toContain('viewBox="0 0 120 120"');
      expect(svg, id).toContain("#7d1426");
      expect(svg, id).not.toMatch(/mask=|paint-order|<text/);
    }
  });

  it("draws nothing for None or an unknown id", () => {
    expect(renderToStaticMarkup(<Motif id={null} ink="#000000" base="#ffffff" size={40} />)).toBe("");
    expect(renderToStaticMarkup(<Motif id="allah" ink="#000000" base="#ffffff" size={40} />)).toBe("");
    expect(isMotif("toString")).toBe(false);
  });
});
