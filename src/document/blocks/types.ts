import type { DocParagraph, DocRow, DocSection } from "@/biodata/document";

// The blocks a template turns a document into (BUILD_PLAN A4 step 2): the units that are measured and placed
// on pages. Rows never split; a paragraph splits between lines; a heading keeps with what follows it.

export type Block =
  /** Page 1's top: motif, invocation line, title (Classic) or the name header with the photo (Minimal). */
  | { kind: "header"; id: string }
  /** A section heading. */
  | { kind: "heading"; id: string; title: string }
  /** A label/value row: a field, the age or a family member. `wide` rows span the page (no photo beside them). */
  | { kind: "row"; id: string; row: DocRow; wide: boolean }
  /** A paragraph field; `showLabel` when the section holds more than this paragraph. */
  | { kind: "paragraph"; id: string; paragraph: DocParagraph; showLabel: boolean }
  /** A whole section set beside the photo (Classic: photo top-right of the first section). */
  | { kind: "lead"; id: string; section: DocSection }
  /** The photo on its own, when no section can sit beside it. */
  | { kind: "photo"; id: string };

export interface BlockSpec {
  block: Block;
  /** Space above the block in em of the body size, dropped at the top of a page. */
  spaceBefore: number;
  /** Keep on the same page as the start of the next block (headings). */
  keepWithNext?: boolean;
}

/** What a template needs to draw a photo: the picture (a data/blob URL) and the frame shape. */
export interface PhotoInput {
  src: string;
  frame: "3:4" | "2:3";
}
