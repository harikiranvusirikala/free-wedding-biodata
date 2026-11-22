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
  /**
   * A whole section set beside the photo (Classic: photo top-right of the first section). `second`: the second
   * photo's place (Step 4.4, D40), beside a later section; DocumentView hands such a block the second photo as its
   * `photo`, so a view that knows nothing about it still draws the right picture.
   */
  | { kind: "lead"; id: string; section: DocSection; second?: boolean }
  /** The photo on its own, when no section can sit beside it (`second`: the second photo, as for "lead"). */
  | { kind: "photo"; id: string; second?: boolean };

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

/**
 * The second photo on page 1 (Step 4.4, D40) is always in the tall 2:3 frame: it is meant for a full-length photo,
 * and one fixed shape keeps its crop the same in every design.
 */
export const SECOND_PHOTO_FRAME = "2:3" as const;

/** The picture a block draws: a block marked `second` gets the second photo, every other block the main one. */
export function blockPhoto(block: Block, photo: PhotoInput | undefined, second: PhotoInput | undefined): PhotoInput | undefined {
  return (block.kind === "lead" || block.kind === "photo") && block.second ? second : photo;
}

/** A picture drawn for a photo page: a JPEG (or the stored image) as a blob: URL, and its size in pixels. */
export interface PagePicture {
  src: string;
  width: number;
  height: number;
}

/**
 * What the pages after the biodata print (Step 4.2b, D40, D41): the extra photos in order, `perPage` to a page, and
 * the horoscope chart on its own page with its heading. A photo whose picture isn't drawn yet leaves its cell empty
 * (so the page count doesn't flicker while a new crop is drawn); a picture that can't be read is left out by the caller.
 */
export interface PhotoPagesInput {
  perPage: 1 | 2 | 4;
  photos: { id: string; picture?: PagePicture }[];
  chart?: { title: string; picture?: PagePicture };
}
