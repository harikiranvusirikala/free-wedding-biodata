import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { toDocument, type DocModel } from "@/biodata/document";
import { getDocDictionary } from "@/i18n/doc";
import { documentVariants, FIXTURE_TODAY, secondPhotoVariants } from "../../test/fixtures/documents";
import { secondPhotoWidth } from "./blocks/Photo";
import { blockTexts } from "./blocks/texts";
import { blockPhoto, SECOND_PHOTO_FRAME, type PhotoInput } from "./blocks/types";
import { paginate, type BlockMetrics } from "./paginate";
import { sideContact, SIDE_CONTACT_LIMIT_TWO_PHOTOS } from "./skeletons/modern/layout";
import { getTemplate, TEMPLATES } from "./templates";
import { PAGE } from "./tokens";

// The second photo on page 1 (Step 4.4, VISION D40): every design places it (Classic beside a later section,
// Modern low in the side panel, Minimal beside the main photo), only together with a main photo, and it is part of
// the measured, paginated blocks. The browser check that it never overlaps text or a frame is e2e/document.spec.ts.

const MAIN: PhotoInput = { src: "data:image/jpeg;base64,main", frame: "3:4" };
const SECOND: PhotoInput = { src: "data:image/jpeg;base64,second", frame: SECOND_PHOTO_FRAME };

const docOf = (v: { profile: Parameters<typeof toDocument>[0]; lang: Parameters<typeof getDocDictionary>[0] }): DocModel =>
  toDocument(v.profile, getDocDictionary(v.lang), FIXTURE_TODAY);
const variantDoc = (id: string) => {
  const v = [...documentVariants(), ...secondPhotoVariants(TEMPLATES)].find((x) => x.id === id);
  if (!v) throw new Error(`no fixture ${id}`);
  return docOf(v);
};

/** Renders every block of a design's page 1 the way DocumentView does (the right picture to each block). */
function renderBlocks(templateId: string, doc: DocModel, photo?: PhotoInput, second?: PhotoInput): string {
  const t = getTemplate(templateId);
  const s = photo ? second : undefined;
  const specs = t.blocks(doc, { photo: !!photo, secondPhoto: !!s });
  const blocks = specs.map((spec) => renderToStaticMarkup(<t.BlockView block={spec.block} doc={doc} palette={t.colors[0]} photo={blockPhoto(spec.block, photo, s)} secondPhoto={s} />));
  const aside = t.Aside ? renderToStaticMarkup(<t.Aside doc={doc} palette={t.colors[0]} photo={photo} secondPhoto={s} />) : "";
  return blocks.join("") + aside;
}

const count = (html: string, src: string) => html.split(`src="${src}"`).length - 1;

describe("second photo on page 1 (D40)", () => {
  it("has a fixture with both photos for every design in the registry", () => {
    const ids = secondPhotoVariants(TEMPLATES).map((v) => v.id);
    for (const t of TEMPLATES) expect(ids, t.id).toContain(`${t.id}-en-short-two`);
    expect(secondPhotoVariants(TEMPLATES).every((v) => v.secondPhoto && v.photo && v.profile.secondPhoto)).toBe(true);
  });

  it("is drawn exactly once, with the main photo drawn once too, in every design", () => {
    for (const t of TEMPLATES) {
      const doc = variantDoc(`${t.id}-en-short-two`);
      const html = renderBlocks(t.id, doc, MAIN, SECOND);
      expect(count(html, SECOND.src), `${t.id} second`).toBe(1);
      expect(count(html, MAIN.src), `${t.id} main`).toBe(1);
    }
  });

  it("is never drawn without a main photo, and leaves the blocks as they were", () => {
    for (const t of TEMPLATES) {
      const doc = variantDoc(`${t.id}-en-short-two`);
      expect(count(renderBlocks(t.id, doc, undefined, SECOND), SECOND.src), t.id).toBe(0);
      const without = t.blocks(doc, { photo: false });
      expect(t.blocks(doc, { photo: false, secondPhoto: true }), t.id).toEqual(without);
    }
  });

  it("prints a little smaller than the main photo, in the tall 2:3 frame", () => {
    for (const t of TEMPLATES) {
      const html = renderBlocks(t.id, variantDoc(`${t.id}-en-short-two`), MAIN, SECOND);
      const size = (src: string) => {
        const m = html.match(new RegExp(`src="${src.replace(/[+/]/g, "\\$&")}"[^>]*width="(\\d+)" height="(\\d+)"`));
        return m ? { w: Number(m[1]), h: Number(m[2]) } : null;
      };
      const main = size(MAIN.src)!;
      const second = size(SECOND.src)!;
      expect(second.h / second.w, t.id).toBeCloseTo(1.5, 1);
      expect(second.w, t.id).toBeLessThan(main.w);
      // Never taller than the main photo by more than a few px (Minimal: the same height, beside it).
      expect(second.h, t.id).toBeLessThanOrEqual(main.h + 2);
    }
  });

  it("Classic: stands beside a later section with three or more items, as its own measured block", () => {
    for (const t of TEMPLATES.filter((x) => x.skeleton === "classic")) {
      const doc = variantDoc(`${t.id}-en-short-two`);
      const specs = t.blocks(doc, { photo: true, secondPhoto: true });
      const leads = specs.flatMap((s, i) => (s.block.kind === "lead" ? [{ i, block: s.block }] : []));
      expect(leads.map((l) => !!l.block.second), t.id).toEqual([false, true]);
      const [main, second] = leads;
      expect(second.i, t.id).toBeGreaterThan(main.i);
      expect(second.block.section.items.length, t.id).toBeGreaterThanOrEqual(3);
      expect(second.block.section.items[0].kind, t.id).toBe("row");
      // The same text is printed with or without the second photo; only the blocks are grouped differently.
      expect(new Set(blockTexts(specs, doc)), t.id).toEqual(new Set(blockTexts(t.blocks(doc, { photo: true }), doc)));
    }
  });

  it("Classic: with no later section to stand beside, stands alone after the main photo's section", () => {
    const t = getTemplate("classic-gold");
    const doc = variantDoc("classic-gold-en-short-two");
    const first = doc.sections.findIndex((s) => s.items[0]?.kind === "row");
    const only = { ...doc, sections: doc.sections.slice(0, first + 1) };
    const specs = t.blocks(only, { photo: true, secondPhoto: true });
    const at = specs.findIndex((s) => s.block.kind === "photo");
    expect(specs[at].block).toMatchObject({ kind: "photo", second: true });
    expect(specs.findIndex((s) => s.block.kind === "lead")).toBeLessThan(at);
    expect(at).toBe(specs.length - 1);
    expect(blockPhoto(specs[at].block, MAIN, SECOND)).toBe(SECOND);
  });

  it("Classic: the second photo's width follows the design's tall photo", () => {
    const html = renderBlocks("kalyanam", variantDoc("kalyanam-en-short-two"), MAIN, SECOND);
    expect(html).toContain(`width="${secondPhotoWidth(186)}"`);
  });

  it("Modern: keeps Contact in the panel only when it leaves room for the second photo", () => {
    const doc = variantDoc("executive-navy-en-short-two");
    const contact = doc.sections.find((s) => s.key === "contact")!;
    expect(contact.items.length).toBeLessThanOrEqual(SIDE_CONTACT_LIMIT_TWO_PHOTOS.rows);
    expect(sideContact(doc, { secondPhoto: true })).toBe(contact);
    const long = { ...doc, sections: doc.sections.map((s) => (s === contact ? { ...s, items: [...s.items, ...[2, 3].flatMap((n) => s.items.map((i) => ({ ...i, id: `${i.id}${n}` })))] } : s)) };
    expect(sideContact(long)?.key).toBe("contact");
    expect(sideContact(long, { secondPhoto: true })).toBeUndefined();
    const t = getTemplate("executive-navy");
    expect(t.blocks(long, { photo: true, secondPhoto: true }).some((s) => s.block.kind === "heading" && s.block.title === contact.title)).toBe(true);
    expect(t.asideTexts!(long, { photo: true, secondPhoto: true })).not.toContain(contact.title);
  });

  it("Minimal: stands beside the main photo in the header, at the same height", () => {
    const t = getTemplate("minimal-ivory");
    const doc = variantDoc("minimal-ivory-en-short-two");
    const specs = t.blocks(doc, { photo: true, secondPhoto: true });
    expect(specs[0].block.kind).toBe("header");
    const html = renderToStaticMarkup(<t.BlockView block={specs[0].block} doc={doc} palette={t.colors[0]} photo={MAIN} secondPhoto={SECOND} />);
    expect(html).toMatch(/src="data:image\/jpeg;base64,main"[^>]*height="168"/);
    expect(html).toMatch(/src="data:image\/jpeg;base64,second"[^>]*width="112" height="168"/);
  });

  it("is paginated like any block: a Classic second-photo block never splits and its heading is never left alone", () => {
    const t = getTemplate("classic-gold");
    const doc = variantDoc("classic-gold-en-sample-two");
    const specs = t.blocks(doc, { photo: true, secondPhoto: true });
    // Stand-in heights: the leads as tall as their photos (267 and 224 px), rows 24 px, headings 32 px, paragraphs.
    const metrics: BlockMetrics[] = specs.map((s) => ({
      height: s.block.kind === "lead" ? (s.block.second ? 224 : 267) : s.block.kind === "heading" ? 32 : s.block.kind === "paragraph" ? 90 : 24,
      spaceBefore: s.spaceBefore * 15,
      keepWithNext: s.keepWithNext,
      lines: s.block.kind === "paragraph" ? { count: 4, lineHeight: 21, padTop: 3, padBottom: 3 } : undefined,
    }));
    const box = t.pageBox(0, doc);
    const pages = paginate(metrics, { pageHeight: (i) => PAGE.height - t.pageBox(i, doc).top - t.pageBox(i, doc).bottom });
    for (const page of pages) expect(page.used).toBeLessThanOrEqual(PAGE.height - box.top - box.bottom + 0.01);
    const second = specs.findIndex((s) => s.block.kind === "lead" && s.block.second);
    const fragments = pages.flatMap((p) => p.fragments.filter((f) => f.block === second));
    expect(fragments).toHaveLength(1);
    expect(fragments[0].fromLine).toBeUndefined();
  });
});
