import { describe, expect, it } from "vitest";
import { toDocument } from "@/biodata/document";
import { getDocDictionary } from "@/i18n/doc";
import { documentVariants, FIXTURE_TODAY } from "../../../test/fixtures/documents";
import { blockTexts } from "../blocks/texts";
import { classicBlocks, classicPageBox, hasTopElement } from "./classic-gold/layout";
import { getPalette, getTemplate, TEMPLATES } from "./index";
import { minimalBlocks, minimalSubtitle } from "./minimal-ivory/layout";

// The skeletons' block lists (pure): order, the photo beside the first section, headings kept with their rows,
// and the registry's fallbacks.

const docFor = (id: string) => {
  const v = documentVariants().find((x) => x.id === id)!;
  return toDocument(v.profile, getDocDictionary(v.lang), FIXTURE_TODAY);
};

describe("Classic blocks", () => {
  it("starts with the top element only when there is one (D21: none by default)", () => {
    const sample = docFor("classic-gold-en-sample");
    expect(hasTopElement(sample)).toBe(false);
    expect(classicBlocks(sample, { photo: false })[0].block.kind).toBe("heading");
    const short = docFor("classic-gold-en-short");
    expect(short.motif).toBe("ganesha");
    expect(classicBlocks(short, { photo: false })[0].block.kind).toBe("header");
  });

  it("puts the photo beside the first section that starts with rows, after a leading paragraph section", () => {
    const blocks = classicBlocks(docFor("classic-gold-en-sample"), { photo: true }).map((s) => s.block);
    expect(blocks.slice(0, 3).map((b) => b.kind)).toEqual(["heading", "paragraph", "lead"]);
    const lead = blocks[2];
    expect(lead.kind === "lead" && lead.section.key).toBe("personal");
    expect(blocks.filter((b) => b.kind === "lead")).toHaveLength(1);
  });

  it("without a photo every section is a heading with wide rows", () => {
    const blocks = classicBlocks(docFor("classic-gold-en-sample"), { photo: false }).map((s) => s.block);
    expect(blocks.some((b) => b.kind === "lead" || b.kind === "photo")).toBe(false);
    expect(blocks.filter((b) => b.kind === "row").every((b) => b.kind === "row" && b.wide)).toBe(true);
  });

  it("keeps every heading with what follows and spaces sections, not the first block", () => {
    const specs = classicBlocks(docFor("classic-gold-en-sample"), { photo: false });
    expect(specs[0].spaceBefore).toBe(0);
    for (const s of specs) {
      if (s.block.kind === "heading") expect(s.keepWithNext).toBe(true);
      if (s.block.kind === "row") expect(s.spaceBefore).toBe(0);
    }
    expect(specs.filter((s) => s.block.kind === "heading" && s.spaceBefore > 0)).toHaveLength(10);
  });

  it("keeps a section's last two items together when it has three or more", () => {
    const specs = classicBlocks(docFor("classic-gold-en-sample"), { photo: false });
    const career = specs.filter((s) => s.block.kind === "row" && ["occupation", "designation", "employer", "employmentType", "workLocation"].includes(s.block.row.key ?? ""));
    expect(career.map((s) => !!s.keepWithNext)).toEqual([false, false, false, true, false]);
    const religion = specs.find((s) => s.block.kind === "row" && s.block.row.key === "religion")!;
    expect(religion.keepWithNext).toBeUndefined();
  });

  it("labels a paragraph only when its section holds more than the paragraph", () => {
    const specs = classicBlocks(docFor("classic-gold-en-sample"), { photo: false });
    const paragraphs = specs.flatMap((s) => (s.block.kind === "paragraph" ? [s.block] : []));
    expect(paragraphs.map((p) => [p.paragraph.key, p.showLabel])).toEqual([
      ["aboutMe", false],
      ["partnerExpectations", true],
    ]);
  });

  it("stands the photo alone when no section starts with rows", () => {
    const doc = docFor("classic-gold-en-sample");
    const onlyAbout = { ...doc, sections: doc.sections.slice(0, 1) };
    const specs = classicBlocks(onlyAbout, { photo: true });
    expect(specs.map((s) => s.block.kind)).toEqual(["photo", "heading", "paragraph"]);
    expect(specs[1].spaceBefore).toBeGreaterThan(0);
  });

  it("lets page 1 start in the top band only with a top element", () => {
    expect(classicPageBox(0, docFor("classic-gold-en-short")).top).toBeLessThan(classicPageBox(1, docFor("classic-gold-en-short")).top);
    expect(classicPageBox(0, docFor("classic-gold-en-sample")).top).toBe(classicPageBox(1, docFor("classic-gold-en-sample")).top);
  });

  it("prints every value of the document", () => {
    const doc = docFor("classic-gold-te-long");
    const texts = blockTexts(classicBlocks(doc, { photo: true }), doc);
    for (const s of doc.sections) for (const i of s.items) expect(texts).toContain(i.kind === "row" ? i.value : i.text);
    expect(texts).toContain("వివాహ బయోడేటా");
  });
});

describe("Minimal blocks", () => {
  it("heads the page with the name and drops the name row", () => {
    const doc = docFor("minimal-ivory-en-sample");
    const specs = minimalBlocks(doc, { photo: true });
    expect(specs[0].block.kind).toBe("header");
    expect(specs.some((s) => s.block.kind === "row" && s.block.row.key === "fullName")).toBe(false);
    expect(blockTexts(specs, doc)).toContain("Sai Teja Mandapati");
  });

  it("writes the subtitle from the user's designation and city", () => {
    expect(minimalSubtitle(docFor("minimal-ivory-en-sample"))).toBe("Senior Software Engineer · Hyderabad");
  });

  it("has no lead or standalone photo block", () => {
    const specs = minimalBlocks(docFor("minimal-ivory-en-sample"), { photo: true });
    expect(specs.some((s) => s.block.kind === "lead" || s.block.kind === "photo")).toBe(false);
  });
});

describe("template registry", () => {
  it("has Classic Gold first with three colour variants each (D46)", () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(["classic-gold", "minimal-ivory"]);
    for (const t of TEMPLATES) expect(t.colors).toHaveLength(3);
    expect(getTemplate("classic-gold").colors[0].id).toBe("gold");
  });

  it("falls back to the first design and its first colour for unknown ids", () => {
    expect(getTemplate("gone").id).toBe("classic-gold");
    const minimal = getTemplate("minimal-ivory");
    expect(getPalette(minimal, "gold").id).toBe("ink");
    expect(getPalette(minimal, "navy").id).toBe("navy");
  });
});
