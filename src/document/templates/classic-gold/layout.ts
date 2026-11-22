import type { DocModel, DocSection } from "@/biodata/document";
import { sectionItemSpecs } from "../../blocks/sections";
import type { BlockSpec } from "../../blocks/types";
import { isMotif } from "../../motifs";
import { SPACE, type Box } from "../../tokens";
import type { PhotoOptions } from "../types";

// The Classic skeleton's block list and margins (VISION D34; the owner's reference, D29): an optional top
// element (motif, invocation line, title), then every section as a heading bar with label/value rows; the photo
// sits top-right beside the first section that starts with rows, and the second photo (Step 4.4) top-right beside a
// later one. Pure, so the order is unit-tested.

/** True when page 1 has a top element (motif, invocation or title): it then starts higher, in the top band. */
export const hasTopElement = (doc: DocModel) => isMotif(doc.motif) || !!doc.invocation || !!doc.title;

/**
 * Margins clear of the foliage frame: the corner sprays fill a band about 84 px deep, so text starts at 88 px;
 * a top element is centred between the corner sprays, so on page 1 it may start at 56 px.
 */
export function classicPageBox(index: number, doc: DocModel): Box {
  return { top: index === 0 && hasTopElement(doc) ? 56 : 88, right: 64, bottom: 88, left: 64 };
}

const startsWithRows = (section: DocSection) => section.items[0]?.kind === "row";

/**
 * Where the second photo goes (Step 4.4, D40): beside the first section after the main photo's that starts with
 * rows and has at least three items (so the rows can stand beside a full-length photo), else the first that starts
 * with rows; undefined when there is none.
 */
function secondPhotoSection(doc: DocModel, after: number): DocSection | undefined {
  const later = doc.sections.slice(after + 1).filter(startsWithRows);
  return later.find((s) => s.items.length >= 3) ?? later[0];
}

export function classicBlocks(doc: DocModel, { photo, secondPhoto = false }: PhotoOptions): BlockSpec[] {
  const out: BlockSpec[] = [];
  if (hasTopElement(doc)) out.push({ block: { kind: "header", id: "header" }, spaceBefore: 0 });
  const leadAt = photo ? doc.sections.findIndex(startsWithRows) : -1;
  const secondAt = secondPhoto && leadAt >= 0 ? doc.sections.indexOf(secondPhotoSection(doc, leadAt)!) : -1;
  doc.sections.forEach((section, i) => {
    const spaceBefore = out.length ? SPACE.section : 0;
    if (i === leadAt || i === secondAt) {
      out.push({ block: i === leadAt ? { kind: "lead", id: section.id, section } : { kind: "lead", id: section.id, section, second: true }, spaceBefore });
      return;
    }
    out.push({ block: { kind: "heading", id: `${section.id}:heading`, title: section.title }, spaceBefore, keepWithNext: true });
    out.push(...sectionItemSpecs(section.items));
  });
  // No section starts with rows: the photo stands alone at the top, under the top element; the second photo, with
  // no later section to stand beside, stands alone after the main photo's section.
  if (photo && leadAt < 0) {
    const at = hasTopElement(doc) ? 1 : 0;
    out.splice(at, 0, { block: { kind: "photo", id: "photo" }, spaceBefore: 0 });
    if (out[at + 1]) out[at + 1] = { ...out[at + 1], spaceBefore: SPACE.section };
  }
  if (secondPhoto && photo && secondAt < 0) {
    const lead = out.findIndex((s) => s.block.kind === "lead" || s.block.kind === "photo");
    // After the main photo's block and the rest of its section (up to the next heading).
    let at = lead + 1;
    while (at < out.length && out[at].block.kind !== "heading") at++;
    out.splice(at, 0, { block: { kind: "photo", id: "photo:second", second: true }, spaceBefore: SPACE.section * 0.5 });
  }
  return out;
}
