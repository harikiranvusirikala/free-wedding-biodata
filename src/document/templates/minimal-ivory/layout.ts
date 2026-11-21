import type { DocModel, DocRow } from "@/biodata/document";
import { sectionItemSpecs } from "../../blocks/sections";
import type { BlockSpec } from "../../blocks/types";
import { isMotif } from "../../motifs";
import type { Box } from "../../tokens";

// The Minimal skeleton's block list and margins (VISION D34, design 20 Minimal Ivory): a typographic header
// (the title as a small kicker, the name large, occupation and city under it, the photo on the right), then each
// section as a small spaced heading over a hairline with rows; generous white space and no frame. Pure.

/** More space between sections than Classic: Minimal is mostly white space. */
export const MINIMAL_SECTION_SPACE = 1.4;

const firstValue = (doc: DocModel, keys: readonly string[]) => {
  for (const key of keys) {
    for (const section of doc.sections) {
      const row = section.items.find((i): i is DocRow => i.kind === "row" && i.key === key);
      if (row) return row.value;
    }
  }
  return undefined;
};

/** The line under the name: designation (or occupation) · work city (or current city), from the user's values. */
export function minimalSubtitle(doc: DocModel): string | undefined {
  const parts = [firstValue(doc, ["designation", "occupation"]), firstValue(doc, ["workLocation", "currentCity"])].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}

export const hasMinimalHeader = (doc: DocModel, photo: boolean) =>
  photo || !!doc.name || !!doc.title || !!doc.invocation || isMotif(doc.motif);

export function minimalPageBox(): Box {
  return { top: 64, right: 76, bottom: 64, left: 76 };
}

export function minimalBlocks(doc: DocModel, { photo }: { photo: boolean }): BlockSpec[] {
  const out: BlockSpec[] = [];
  const header = hasMinimalHeader(doc, photo);
  if (header) out.push({ block: { kind: "header", id: "header" }, spaceBefore: 0 });
  for (const section of doc.sections) {
    // The name is the header's headline, so its row isn't repeated.
    const items = header && doc.name ? section.items.filter((i) => !(i.kind === "row" && i.key === "fullName")) : section.items;
    if (!items.length) continue;
    out.push({
      block: { kind: "heading", id: `${section.id}:heading`, title: section.title },
      spaceBefore: out.length ? MINIMAL_SECTION_SPACE : 0,
      keepWithNext: true,
    });
    out.push(...sectionItemSpecs(items));
  }
  return out;
}
