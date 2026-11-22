import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { toDocument, type DocModel } from "@/biodata/document";
import { getDocDictionary } from "@/i18n/doc";
import { svgToPdf } from "@/pdf/svg-to-pdf";
import { DESIGN_COUNT, documentVariants, FIXTURE_TODAY, NEW_DESIGNS } from "../../../test/fixtures/documents";
import { blockTexts } from "../blocks/texts";
import { contrast } from "../frames/geometry";
import { washAt, washStops } from "../frames/paper-wash";
import { paginate, type BlockMetrics } from "../paginate";
import { MODERN_BOX, modernAsideTexts, modernBlocks, sideContact, SIDE_CONTACT_LIMIT } from "../skeletons/modern/layout";
import { PAGE } from "../tokens";
import { getTemplate, TEMPLATES } from "./index";

// The Step 4.3 designs (VISION D34, D39, D46): every design is complete (skeleton, frame, three colour variants),
// its frame stays inside the PDF writer's SVG subset and a size budget, its colours read well on its paper, and the
// Modern skeleton keeps the side panel out of the paginated main column.

const docFor = (id: string): DocModel => {
  const v = documentVariants().find((x) => x.id === id);
  if (!v) throw new Error(`no fixture ${id}`);
  return toDocument(v.profile, getDocDictionary(v.lang), FIXTURE_TODAY);
};

describe("design registry (D46)", () => {
  it("lists the twenty designs in D46's picker order, Minimal Ivory last", () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual([
      "classic-gold",
      "kalyanam",
      "temple-bells",
      "rangoli",
      "paisley",
      "royal-maroon",
      "deepam",
      "baroque-gold",
      "sandalwood",
      "peacock",
      "floral-ivory",
      "watercolour-rose",
      "mango-grove",
      "mint-vines",
      "peach-filigree",
      "executive-navy",
      "modern-two-column",
      "slate-brush",
      "navy-rosette",
      "minimal-ivory",
    ]);
  });

  it("gives every design a skeleton, three distinct colour variants and (but Minimal) a frame", () => {
    for (const t of TEMPLATES) {
      expect(["classic", "modern", "minimal"], t.id).toContain(t.skeleton);
      expect(t.colors, t.id).toHaveLength(3);
      expect(new Set(t.colors.map((c) => c.id)).size, t.id).toBe(3);
      expect(new Set(t.colors.map((c) => c.swatch)).size, t.id).toBe(3);
      if (t.skeleton !== "minimal") expect(t.Frame, t.id).toBeDefined();
      expect(t.autoSteps.length, t.id).toBeGreaterThan(0);
    }
    expect(TEMPLATES.filter((t) => t.skeleton === "modern").map((t) => t.id)).toEqual(["executive-navy", "modern-two-column", "slate-brush"]);
  });

  it("keeps left and right margins the same on every page (the paginator measures one column width)", () => {
    for (const t of TEMPLATES) {
      for (const id of [`${t.id}-en-long`, `${t.id}-en-short`]) {
        if (!documentVariants().some((v) => v.id === id)) continue;
        const doc = docFor(id);
        const [a, b] = [t.pageBox(0, doc), t.pageBox(1, doc)];
        expect([a.left, a.right], id).toEqual([b.left, b.right]);
      }
    }
  });

  it("has a fixture for each new design in English, Telugu, one more Indic language and all three colours", () => {
    const ids = new Set(documentVariants().map((v) => v.id));
    for (const d of NEW_DESIGNS) {
      for (const id of [`${d.id}-en-short`, `${d.id}-en-long`, `${d.id}-te-short`, `${d.id}-${d.lang}-short`, ...d.colors.slice(1).map((c) => `${d.id}-en-short-${c}`)]) {
        expect(ids, id).toContain(id);
      }
    }
    expect(new Set(NEW_DESIGNS.map((d) => d.lang)).size).toBe(8);
  });

  it("has fixtures for every design, so the e2e counts (DESIGN_COUNT) follow the registry", () => {
    expect(new Set(["classic-gold", "minimal-ivory", ...NEW_DESIGNS.map((d) => d.id)])).toEqual(new Set(TEMPLATES.map((t) => t.id)));
    expect(DESIGN_COUNT).toBe(TEMPLATES.length);
  });
});

describe("frames (PDF-safe artwork)", () => {
  const box = { x: 0, y: 0, width: PAGE.width, height: PAGE.height };
  for (const t of TEMPLATES.filter((x) => x.Frame)) {
    it(`${t.id}: every colour's frame draws in the PDF writer without warnings, within its size budget`, () => {
      for (const palette of t.colors) {
        const Frame = t.Frame!;
        const markup = renderToStaticMarkup(<Frame palette={palette} />);
        expect(markup, `${t.id}/${palette.id}`).not.toMatch(/radialGradient|<use|<text|<image|filter=|mask=|opacity=/);
        const warnings: string[] = [];
        let patterns = 0;
        const ops = svgToPdf(markup, box, [0.75, 0, 0, -0.75, 0, 841.89], { pattern: () => `P${++patterns}`, alpha: () => "GS" }, (w) => warnings.push(w));
        expect(warnings, `${t.id}/${palette.id}`).toEqual([]);
        expect(ops.length).toBeGreaterThan(50);
        // Frames repeat on every page of the display list: keep them light (Paisley and Deepam, the busiest, ≈ 34 KB).
        expect(markup.length, `${t.id}/${palette.id} markup bytes`).toBeLessThan(40_000);
      }
    });
  }
});

describe("colours (WCAG AA on the paper)", () => {
  it("text, labels and heading text read on their backgrounds in every variant, dark paper included", () => {
    for (const t of TEMPLATES) {
      for (const p of t.colors) {
        const where = `${t.id}/${p.id}`;
        expect(contrast(p.text, p.paper), `${where} text`).toBeGreaterThanOrEqual(7);
        expect(contrast(p.label, p.paper), `${where} label`).toBeGreaterThanOrEqual(4.5);
        const barBg = p.bar === "transparent" ? p.paper : p.bar;
        // Modern headings are accent text on the paper; Classic bars are text on the bar's fill.
        expect(contrast(p.barText, t.skeleton === "modern" ? p.paper : barBg), `${where} heading`).toBeGreaterThanOrEqual(4.5);
        if (p.side) {
          expect(contrast(p.sideText!, p.side), `${where} side text`).toBeGreaterThanOrEqual(7);
          expect(contrast(p.sideMuted!, p.side), `${where} side muted`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
});

describe("Classic designs on the shared skeleton", () => {
  it("use Classic Gold's block list (photo beside the first section) and start page 1 higher only with a top element", () => {
    for (const id of ["kalyanam", "temple-bells", "rangoli", "paisley", "royal-maroon", "deepam", "baroque-gold", "peacock", "peach-filigree", "navy-rosette"]) {
      const t = getTemplate(id);
      const short = docFor(`${id}-en-short`);
      const kinds = t.blocks(short, { photo: true }).map((s) => s.block.kind);
      expect(kinds[0], id).toBe("header");
      expect(kinds.filter((k) => k === "lead"), id).toHaveLength(1);
      expect(t.blocks(short, { photo: false }).some((s) => s.block.kind === "lead" || s.block.kind === "photo"), id).toBe(false);
      const sample = { ...short, motif: null, title: undefined, invocation: undefined };
      expect(t.pageBox(0, sample).top, id).toBe(t.pageBox(1, sample).top);
      expect(t.pageBox(0, short).top, id).toBeLessThanOrEqual(t.pageBox(1, short).top);
    }
  });

  it("Paisley is drawn for the tall 2:3 photo", () => {
    expect(getTemplate("paisley").photoFrame).toBe("2:3");
  });
});

describe("Step 4.4: Baroque Gold, Peacock, Peach Filigree, Navy Rosette (D46, D51)", () => {
  const WASHED = ["baroque-gold", "peacock", "peach-filigree", "navy-rosette"];

  it("keep every text colour readable on the paper wash, not only on the paper", () => {
    for (const id of WASHED) {
      for (const p of getTemplate(id).colors) {
        for (const stop of washStops(p)) {
          expect(contrast(p.text, stop), `${id}/${p.id} text on ${stop}`).toBeGreaterThanOrEqual(7);
          expect(contrast(p.label, stop), `${id}/${p.id} label on ${stop}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it("draw the wash as one linear gradient, plain through the middle of the page", () => {
    const p = getTemplate("baroque-gold").colors[0];
    const [top, middle, , bottom] = washStops(p);
    expect([washAt(p, 0), washAt(p, PAGE.height / 2), washAt(p, PAGE.height)]).toEqual([top, middle, bottom]);
    for (const id of WASHED) {
      const Frame = getTemplate(id).Frame!;
      const markup = renderToStaticMarkup(<Frame palette={getTemplate(id).colors[0]} />);
      // The first thing drawn: a page-sized rect filled with a vertical gradient.
      expect(markup, id).toMatch(new RegExp(`^<svg[^>]*><defs><linearGradient id="(wash[^"]+)" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${PAGE.height}">`));
      expect(markup, id).toMatch(new RegExp(`</defs><rect width="${PAGE.width}" height="${PAGE.height}" fill="url\\(#wash`));
    }
  });

  it("give each design a deep festive or a light variant set as D51 asks: gold on dark paper in Baroque Gold and Peacock", () => {
    const dark = (id: string) => getTemplate(id).colors.filter((c) => contrast(c.paper, "#000000") < 2).map((c) => c.id);
    expect(dark("baroque-gold")).toEqual(["navy"]);
    expect(dark("peacock")).toEqual(["emerald"]);
    expect(dark("peach-filigree")).toEqual([]);
    expect(dark("navy-rosette")).toEqual([]);
  });

  it("Peach Filigree's headings are pale bars with a thin outline and soft corners", () => {
    const t = getTemplate("peach-filigree");
    const doc = docFor("peach-filigree-en-short");
    const p = t.colors[0];
    const html = renderToStaticMarkup(<t.BlockView block={{ kind: "heading", id: "h", title: "Personal details" }} doc={doc} palette={p} />);
    expect(html).toContain(`background:${p.bar}`);
    for (const side of ["top", "right", "bottom", "left"]) expect(html).toContain(`border-${side}:1px solid ${p.barRule}`);
    expect(html).toContain("border-radius:6px");
    // The other bar styles keep no outline.
    const navy = getTemplate("navy-rosette");
    const solid = renderToStaticMarkup(<navy.BlockView block={{ kind: "heading", id: "h", title: "Personal details" }} doc={doc} palette={navy.colors[0]} />);
    expect(solid).not.toContain("border-top");
  });
});

describe("Modern skeleton (D34)", () => {
  it("puts name, designation · city and a short Contact section in the side panel, not in the main column", () => {
    const doc = docFor("executive-navy-en-long");
    const contact = sideContact(doc);
    expect(contact?.key).toBe("contact");
    const specs = modernBlocks(doc);
    expect(specs.some((s) => s.block.kind === "heading" && s.block.title === contact!.title)).toBe(false);
    expect(specs.some((s) => s.block.kind === "row" && s.block.row.key === "fullName")).toBe(false);
    expect(specs.some((s) => s.block.kind === "lead" || s.block.kind === "photo")).toBe(false);
    const aside = modernAsideTexts(doc);
    expect(aside.slice(0, 2)).toEqual(["Sai Teja Mandapati", "Senior Software Engineer · Hyderabad"]);
    expect(aside).toContain("+91 90000 00001");
    // Between the main column and the panel, every value of the document is printed.
    const printed = [...blockTexts(specs, doc), ...aside];
    for (const s of doc.sections) for (const i of s.items) expect(printed).toContain(i.kind === "row" ? i.value : i.text);
  });

  it("keeps a long Contact section in the main column, where it can paginate", () => {
    const doc = docFor("executive-navy-en-long");
    const long = {
      ...doc,
      sections: doc.sections.map((s) =>
        s.key === "contact"
          ? { ...s, items: [...s.items, ...Array.from({ length: SIDE_CONTACT_LIMIT.rows }, (_, i) => ({ kind: "row" as const, id: `x${i}`, label: "Phone", value: "+91 90000 00009" }))] }
          : s,
      ),
    };
    expect(sideContact(long)).toBeUndefined();
    expect(modernBlocks(long).some((s) => s.block.kind === "heading" && s.block.title === doc.sections.find((x) => x.key === "contact")!.title)).toBe(true);
    const wordy = { ...doc, sections: doc.sections.map((s) => (s.key === "contact" ? { ...s, items: s.items.map((i) => (i.kind === "row" ? { ...i, value: i.value.repeat(8) } : i)) } : s)) };
    expect(sideContact(wordy)).toBeUndefined();
  });

  it("has one main column, right of the panel, on every page", () => {
    const t = getTemplate("executive-navy");
    const doc = docFor("executive-navy-en-long");
    for (const i of [0, 1, 2]) expect(t.pageBox(i, doc)).toEqual(MODERN_BOX);
    expect(MODERN_BOX.left).toBeGreaterThan(250);
    expect(PAGE.width - MODERN_BOX.left - MODERN_BOX.right).toBeGreaterThan(400);
  });

  it("paginates the main column like any other: headings kept with their rows, page 2 continues it", () => {
    const t = getTemplate("executive-navy");
    const doc = docFor("executive-navy-en-long");
    const specs = t.blocks(doc, { photo: false });
    const box = t.pageBox(0, doc);
    const height = PAGE.height - box.top - box.bottom;
    // Stand-in measurements: headings 30 px, rows 24 px, paragraphs 20 px lines (enough to need two pages).
    const metrics: BlockMetrics[] = specs.map((s) =>
      s.block.kind === "paragraph"
        ? { height: 8 + 6 * 20, spaceBefore: s.spaceBefore * 14, keepWithNext: s.keepWithNext, lines: { count: 6, lineHeight: 20, padTop: 4, padBottom: 4 } }
        : { height: s.block.kind === "heading" ? 30 : s.block.kind === "header" ? 140 : 24, spaceBefore: s.spaceBefore * 14, keepWithNext: s.keepWithNext },
    );
    const pages = paginate(metrics, { pageHeight: (i) => PAGE.height - t.pageBox(i, doc).top - t.pageBox(i, doc).bottom });
    expect(pages.length).toBeGreaterThanOrEqual(2);
    for (const page of pages) {
      expect(page.used).toBeLessThanOrEqual(height + 0.01);
      const last = page.fragments[page.fragments.length - 1];
      expect(specs[last.block].block.kind).not.toBe("heading");
    }
    expect(pages.flatMap((p) => p.fragments.filter((f) => !f.fromLine).map((f) => f.block))).toEqual(specs.map((_, i) => i));
  });
});
