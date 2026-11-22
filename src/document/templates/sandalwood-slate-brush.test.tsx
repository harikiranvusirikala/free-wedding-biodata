import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { toDocument, type DocModel } from "@/biodata/document";
import { getDocDictionary } from "@/i18n/doc";
import { documentVariants, FIXTURE_TODAY } from "../../../test/fixtures/documents";
import { blockTexts } from "../blocks/texts";
import { contrast, luminance, mix } from "../frames/geometry";
import { SIDE_PANEL_WIDTH } from "../frames/SidePanel";
import { MODERN_BOX } from "../skeletons/modern/layout";
import { hasLetterhead, letterheadBlocks } from "../skeletons/letterhead";
import { classicBlocks } from "./classic-gold/layout";
import { getTemplate } from "./index";

// Step 4.4's Sandalwood (letterhead, D44) and Slate Brush (brush-wash Modern, D46, D51): the letterhead's block list
// and margins, colours that read on the sandal wash and on the brush-stroke panel, and the brush frame's keep-outs.

const docFor = (id: string): DocModel => {
  const v = documentVariants().find((x) => x.id === id);
  if (!v) throw new Error(`no fixture ${id}`);
  return toDocument(v.profile, getDocDictionary(v.lang), FIXTURE_TODAY);
};

describe("Sandalwood (letterhead)", () => {
  const t = getTemplate("sandalwood");

  it("opens page 1 with the name as a letterhead and drops the name row from the details", () => {
    const doc = docFor("sandalwood-en-short");
    const specs = t.blocks(doc, { photo: true });
    expect(specs[0].block.kind).toBe("header");
    expect(specs.filter((s) => s.block.kind === "header")).toHaveLength(1);
    const rows = specs.flatMap((s) => (s.block.kind === "row" ? [s.block.row] : s.block.kind === "lead" ? s.block.section.items : []));
    expect(rows.some((r) => r.kind === "row" && r.key === "fullName")).toBe(false);
    const html = renderToStaticMarkup(<t.BlockView block={specs[0].block} doc={doc} palette={t.colors[0]} />);
    expect(html).toContain(doc.name!);
    expect(html).toContain("Senior Software Engineer · Hyderabad");
    // Every value is still printed (the name in the letterhead).
    const printed = blockTexts(specs, doc);
    for (const s of doc.sections) for (const i of s.items) expect(printed).toContain(i.kind === "row" ? i.value : i.text);
  });

  it("has a letterhead even without a top element, and starts page 1 higher only then", () => {
    const doc = { ...docFor("sandalwood-en-short"), motif: null, title: undefined, invocation: undefined };
    expect(hasLetterhead(doc)).toBe(true);
    expect(letterheadBlocks(doc, { photo: true })[0].block.kind).toBe("header");
    expect(t.pageBox(0, doc).top).toBeLessThan(t.pageBox(1, doc).top);
    const nameless = { ...doc, name: undefined };
    expect(hasLetterhead(nameless)).toBe(false);
    expect(letterheadBlocks(nameless, { photo: true })).toEqual(classicBlocks(nameless, { photo: true }));
    expect(t.pageBox(0, nameless).top).toBe(t.pageBox(1, nameless).top);
  });

  it("drops a section the name row was the only item of", () => {
    const doc = docFor("sandalwood-en-short");
    const lone = { ...doc, sections: [{ ...doc.sections[0], id: "n", title: "Name", items: doc.sections[0].items.filter((i) => i.kind === "row" && i.key === "fullName") }, ...doc.sections.slice(1)] };
    expect(lone.sections[0].items).toHaveLength(1);
    expect(letterheadBlocks(lone, { photo: false }).some((s) => s.block.kind === "heading" && s.block.title === "Name")).toBe(false);
  });

  it("keeps every text colour readable on the wash's deepest tint and on the heading bars", () => {
    for (const p of t.colors) {
      const wash = mix(p.paper, p.soft!, 0.9);
      expect(contrast(p.text, wash), `${p.id} text`).toBeGreaterThanOrEqual(7);
      expect(contrast(p.label, wash), `${p.id} label`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.barText, p.bar), `${p.id} heading`).toBeGreaterThanOrEqual(7);
    }
  });

  it("draws the wash as a page-sized vertical gradient under a quiet double rule", () => {
    const Frame = t.Frame!;
    const markup = renderToStaticMarkup(<Frame palette={t.colors[0]} />);
    expect(markup).toMatch(/<rect width="794" height="1123" fill="url\(#sandal[^)]+w\)"/);
    expect(markup.match(/<path d="M2[27] 2[27]H/g)).toHaveLength(2);
  });
});

/** The points of path data made of M, L (absolute) and c, s, a (relative) commands, as the frames write it. */
function pathPoints(d: string): [number, number][] {
  const out: [number, number][] = [];
  let x = 0;
  let y = 0;
  for (const [, cmd, args] of d.matchAll(/([MLcsaZ])([^MLcsaZ]*)/g)) {
    const n = (args.match(/-?\d*\.?\d+/g) ?? []).map(Number);
    if (cmd === "M" || cmd === "L") {
      [x, y] = n;
      out.push([x, y]);
    } else if (cmd === "c") {
      for (let i = 0; i + 5 < n.length; i += 6) {
        out.push([x + n[i], y + n[i + 1]], [x + n[i + 2], y + n[i + 3]]);
        x += n[i + 4];
        y += n[i + 5];
        out.push([x, y]);
      }
    } else if (cmd === "s") {
      for (let i = 0; i + 3 < n.length; i += 4) {
        out.push([x + n[i], y + n[i + 1]]);
        x += n[i + 2];
        y += n[i + 3];
        out.push([x, y]);
      }
    } else if (cmd === "a") {
      for (let i = 0; i + 6 < n.length; i += 7) {
        x += n[i + 5];
        y += n[i + 6];
        out.push([x, y]);
      }
    }
  }
  return out;
}

describe("Slate Brush (brush-wash Modern)", () => {
  const t = getTemplate("slate-brush");

  it("is the Modern skeleton: photo, name and contact in the panel, one main column on every page", () => {
    const doc = docFor("slate-brush-en-long");
    expect(t.skeleton).toBe("modern");
    for (const i of [0, 1]) expect(t.pageBox(i, doc)).toEqual(MODERN_BOX);
    expect(t.asideTexts!(doc, { photo: false }).slice(0, 2)).toEqual(["Sai Teja Mandapati", "Senior Software Engineer · Hyderabad"]);
  });

  it("keeps the panel text readable on the stroke's fullest colour and lighter tints only inside the text column", () => {
    for (const p of t.colors) {
      expect(contrast(p.sideText!, p.side!), `${p.id} side text`).toBeGreaterThanOrEqual(7);
      expect(contrast(p.sideMuted!, p.side!), `${p.id} side muted`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.barText, p.paper), `${p.id} heading`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("draws strokes, no border: the panel stroke covers the panel, and nothing reaches into the main column", () => {
    const Frame = t.Frame!;
    const markup = renderToStaticMarkup(<Frame palette={t.colors[0]} />);
    expect(markup).not.toMatch(/stroke=/);
    // Every end and control point of every path, in absolute coordinates (the frame has no transforms).
    const points = [...markup.matchAll(/<path d="([^"]+)"/g)].flatMap(([, d]) => pathPoints(d));
    const main = { left: MODERN_BOX.left, right: 794 - MODERN_BOX.right, top: MODERN_BOX.top, bottom: 1123 - MODERN_BOX.bottom };
    const inside = points.filter(([x, y]) => x > main.left && x < main.right && y > main.top + 2 && y < main.bottom - 2);
    expect(inside).toEqual([]);
    // Paint darker than the panel's fullest colour never reaches into its text column (26 px inside the 250 px panel).
    for (const p of t.colors) {
      const html = renderToStaticMarkup(<Frame palette={p} />);
      for (const [, d, fill] of html.matchAll(/<path d="([^"]+)" fill="(#[0-9a-f]{6})"/g)) {
        if (luminance(fill) >= luminance(p.side!)) continue;
        expect(Math.min(...pathPoints(d).map(([x]) => x)), `${p.id} ${fill}`).toBeGreaterThanOrEqual(SIDE_PANEL_WIDTH - 26 + 4);
      }
    }
    // The panel stroke is the first path and starts above the page at its left.
    expect(points[0][0]).toBeLessThan(0);
    expect(points[0][1]).toBeLessThan(0);
    expect(SIDE_PANEL_WIDTH).toBeLessThan(MODERN_BOX.left);
  });
});
