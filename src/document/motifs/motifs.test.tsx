import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "@/i18n/app/en.json";
import { IDENTITY } from "@/pdf/matrix";
import { svgToPdf } from "@/pdf/svg-to-pdf";
import { DRAWN_IDS, HINDU_SECTIONS, MOTIF_IDS, MOTIF_TRADITIONS, MOTIFS_AWAITING_REVIEW, Motif, PICTURE_IDS, TINTED_PICTURE_IDS, isMotif, motifInDesignColours, motifSections, motifTradition } from "./index";

// The motif library (Step 2.0, redrawn 2026-11-22; VISION D21, D45, D47): every drawing renders in the template's
// colours with only the SVG the PDF writer draws (src/pdf/svg-to-pdf.ts), no font glyphs, and None draws nothing.

const ALLOWED = new Set(["svg", "defs", "linearGradient", "stop", "g", "path", "circle", "rect", "polygon"]);
const draw = (id: string | null, size = 96) => renderToStaticMarkup(<Motif id={id} ink="#7d1426" base="#f6dfe3" paper="#fff8f4" size={size} />);

describe("motif library", () => {
  it("has the seventeen drawn symbols, then the pictures, grouped by tradition", () => {
    expect(DRAWN_IDS).toEqual([
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
    expect(PICTURE_IDS).toHaveLength(30);
    expect(MOTIF_IDS[0]).toBe("ganesha");
    const order = MOTIF_IDS.map((id) => MOTIF_TRADITIONS.indexOf(motifTradition(id)!));
    expect(order.every((t) => t >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(new Set(order).size).toBe(MOTIF_TRADITIONS.length);
  });

  it("organises the Hindu symbols in sets, the classic Ganesha first, each symbol in exactly one set", () => {
    expect(HINDU_SECTIONS.map((section) => section.key)).toEqual(["ganesha", "ganeshaColour", "om", "gods", "auspicious"]);
    const hindu = MOTIF_IDS.filter((id) => motifTradition(id) === "hindu");
    const listed = HINDU_SECTIONS.flatMap((section) => section.ids);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual([...hindu].sort());
    expect(hindu).toEqual(listed);
    expect(MOTIF_IDS[0]).toBe("ganesha");
    const sets = motifSections("hindu");
    expect(sets.map((set) => set.key)).toEqual(["ganesha", "ganeshaColour", "om", "gods", "auspicious"]);
    expect(sets.flatMap((set) => set.ids)).toEqual(hindu);
    // The other traditions are one set each, without a heading.
    expect(motifSections("muslim")).toEqual([{ key: null, ids: MOTIF_IDS.filter((id) => motifTradition(id) === "muslim") }]);
    for (const set of sets) expect(Object.hasOwn(en, `top.set.${set.key}`), String(set.key)).toBe(true);
  });

  it("keeps every id a stored draft may hold (ids are never renamed)", () => {
    for (const id of ["ganesha", "ganeshaOrnate", "om", "kalash", "swastika", "lotus", "crescentStar", "cross", "ikOnkar", "khanda", "jain", "dharmaWheel", "floral", "rings"]) expect(isMotif(id), id).toBe(true);
  });

  it("marks the symbols that await a community's review", () => {
    expect([...MOTIFS_AWAITING_REVIEW].sort()).toEqual(["allah", "allahMedallion", "allahMedallionSheet", "allahWreath", "jain", "jainHand", "jainMotto", "khanda", "khandaSheet", "om", "ramaWithBow", "venkateswara"]);
  });

  it("names every symbol in the app text", () => {
    for (const id of MOTIF_IDS) expect(Object.hasOwn(en, `top.motif.${id}`), id).toBe(true);
  });

  it("prints the single-colour pictures in the design's colours and keeps the colour pictures' own", () => {
    // Measured (hues and saturation of the opaque pixels: one gold hue, no white) and checked by eye, 2026-11-22.
    const tinted = ["ganesha", "ganeshaLine", "ganeshaOutline", "ganeshaStencil", "ganeshaSeatedRight", "ganeshaSeatedLeft", "ganeshaMandala", "ganeshaLotus", "ganeshaThrone", "ganeshaTrunk"];
    tinted.push("omGold", "omMandala", "ganeshaNamah", "allahWreath", "allahMedallionSheet", "crossLatinSheet", "crossBuddedSheet", "ikOnkarDisc", "khandaSheet", "jainHand", "jainMotto", "dharmaLight", "dharmaSolid");
    expect([...TINTED_PICTURE_IDS].sort()).toEqual(tinted.sort());
    const colour = PICTURE_IDS.filter((id) => !TINTED_PICTURE_IDS.includes(id));
    expect(colour.sort()).toEqual(["ganeshaLotusFrame", "ganeshaOrangeFrame", "ganeshaSeated", "ganeshaTrident", "omSeal", "ramaWithBow", "venkateswara"]);
    for (const id of [...DRAWN_IDS, ...TINTED_PICTURE_IDS, "ganeshaOrnate"]) expect(motifInDesignColours(id), id).toBe(true);
    for (const id of colour) expect(motifInDesignColours(id), id).toBe(false);
  });

  it("shows a colour picture as an image of its own file, and a gold one as an empty box until it is tinted", () => {
    for (const id of PICTURE_IDS) {
      const html = draw(id);
      expect(html, id).not.toContain("<svg");
      if (TINTED_PICTURE_IDS.includes(id)) {
        // Rendered before the browser has recoloured it (the server, the first paint): never the gold original.
        expect(html, id).not.toContain("<img");
        expect(html, id).toContain("data-motif-pending");
        expect(html, id).toContain("width:96px;height:96px");
      } else {
        expect(html, id).toMatch(/<img [^>]*src="[^"]+"/);
        expect(html, id).toContain('width="96" height="96"');
      }
    }
  });

  it("draws each one with PDF-safe elements only, in the given colours, with no transformed gradient", () => {
    for (const id of DRAWN_IDS) {
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
    for (const id of DRAWN_IDS) {
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
