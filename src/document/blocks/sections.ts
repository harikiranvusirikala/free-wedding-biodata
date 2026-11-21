import type { DocItem } from "@/biodata/document";
import type { BlockSpec } from "./types";

/**
 * A section's rows and paragraphs as blocks, shared by the skeletons. A paragraph is labelled only when the
 * section holds more than that paragraph. In a section of three or more items the last two stay together, so a
 * page never starts with a lone last row of the section before (with two items the heading already keeps them).
 */
export function sectionItemSpecs(items: readonly DocItem[]): BlockSpec[] {
  return items.map((item, i) => {
    const spec: BlockSpec =
      item.kind === "row"
        ? { block: { kind: "row", id: item.id, row: item, wide: true }, spaceBefore: 0 }
        : { block: { kind: "paragraph", id: item.id, paragraph: item, showLabel: items.length > 1 }, spaceBefore: 0 };
    if (items.length >= 3 && i === items.length - 2) spec.keepWithNext = true;
    return spec;
  });
}
