import type { DocModel } from "@/biodata/document";
import { sectionItemSpecs } from "../../blocks/sections";
import type { BlockSpec } from "../../blocks/types";
import { isMotif } from "../../motifs";
import { SPACE, type Box } from "../../tokens";

// The Classic skeleton's block list and margins (VISION D34; the owner's reference, D29): an optional top
// element (motif, invocation line, title), then every section as a heading bar with label/value rows; the photo
// sits top-right beside the first section that starts with rows. Pure, so the order is unit-tested.

/** True when page 1 has a top element (motif, invocation or title): it then starts higher, in the top band. */
export const hasTopElement = (doc: DocModel) => isMotif(doc.motif) || !!doc.invocation || !!doc.title;

/**
 * Margins clear of the foliage frame: the corner sprays fill a band about 84 px deep, so text starts at 88 px;
 * a top element is centred between the corner sprays, so on page 1 it may start at 56 px.
 */
export function classicPageBox(index: number, doc: DocModel): Box {
  return { top: index === 0 && hasTopElement(doc) ? 56 : 88, right: 64, bottom: 88, left: 64 };
}

export function classicBlocks(doc: DocModel, { photo }: { photo: boolean }): BlockSpec[] {
  const out: BlockSpec[] = [];
  if (hasTopElement(doc)) out.push({ block: { kind: "header", id: "header" }, spaceBefore: 0 });
  let photoPlaced = !photo;
  for (const section of doc.sections) {
    const spaceBefore = out.length ? SPACE.section : 0;
    if (!photoPlaced && section.items[0]?.kind === "row") {
      out.push({ block: { kind: "lead", id: section.id, section }, spaceBefore });
      photoPlaced = true;
      continue;
    }
    out.push({ block: { kind: "heading", id: `${section.id}:heading`, title: section.title }, spaceBefore, keepWithNext: true });
    out.push(...sectionItemSpecs(section.items));
  }
  // No section starts with rows: the photo stands alone at the top, under the top element.
  if (!photoPlaced) {
    const at = hasTopElement(doc) ? 1 : 0;
    out.splice(at, 0, { block: { kind: "photo", id: "photo" }, spaceBefore: 0 });
    if (out[at + 1]) out[at + 1] = { ...out[at + 1], spaceBefore: SPACE.section };
  }
  return out;
}
