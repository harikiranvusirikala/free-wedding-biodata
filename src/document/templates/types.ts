import type { ComponentType } from "react";
import type { DocModel } from "@/biodata/document";
import type { Block, BlockSpec, PhotoInput } from "../blocks/types";
import type { Box, Palette, TextStep } from "../tokens";

// What a design is (VISION D34, D39, D46): a skeleton's block list and block drawings, its margins, its frame
// and three colour variants. Twenty designs will share three skeletons (classic, modern, minimal), so most of a
// design is data; the code lives in the skeleton.

export interface BlockViewProps {
  block: Block;
  doc: DocModel;
  palette: Palette;
  /** The picture this block draws (the second photo for a block marked `second`, else the main photo). */
  photo?: PhotoInput;
  /**
   * The second photo on page 1 (Step 4.4, D40), only when the main photo is drawn too: for a block that draws both
   * pictures itself (Minimal's header). Classic's place for it is a block of its own (`second` on lead/photo).
   */
  secondPhoto?: PhotoInput;
  /** The main photo's frame (when it is drawn): a second-photo block sizes its column to line up with the main photo's. */
  mainFrame?: PhotoInput["frame"];
  /** For a paragraph split across pages: only this piece's text (later pieces drop the label). */
  text?: string;
  continued?: boolean;
}

export interface TemplateDef {
  id: string;
  /** Shown in the design picker (Step 3.3). */
  name: string;
  skeleton: "classic" | "modern" | "minimal";
  /** Three colour variants (D46); the first is the default. */
  colors: readonly Palette[];
  /** Text sizes Auto tries, largest first (D31). */
  autoSteps: readonly TextStep[];
  /** Margins of page `index` (0-based); left and right must be the same on every page. */
  pageBox: (index: number, doc: DocModel) => Box;
  /**
   * The document as blocks, in reading order. `photo` = a picture will be drawn; `secondPhoto` = the second photo
   * on page 1 will be drawn too (Step 4.4, D40; only ever true with `photo`).
   */
  blocks: (doc: DocModel, options: PhotoOptions) => BlockSpec[];
  /** The frame artwork drawn on every page, if any. */
  Frame?: ComponentType<{ palette: Palette }>;
  BlockView: ComponentType<BlockViewProps>;
  /**
   * Fixed artwork with content drawn on page 1 only, outside the content box (the Modern skeleton's side panel:
   * photo, name, contact). It isn't paginated, so it must fit the page by construction.
   */
  Aside?: ComponentType<AsideProps>;
  /** Every string the Aside prints (for the e2e check that the pages and the PDF carry them). */
  asideTexts?: (doc: DocModel, options: PhotoOptions) => string[];
  /** The photo frame the design is drawn for (D40): the cropper's default for this design (Step 3.3). */
  photoFrame?: PhotoInput["frame"];
  /** Corner radius in px of the design's photos, on page 1 and on the photo pages (Step 4.2b); default 10. */
  photoRadius?: number;
}

/** Which photos page 1 draws (Step 4.4: the second photo is drawn only with the main one). */
export interface PhotoOptions {
  photo: boolean;
  secondPhoto?: boolean;
}

export interface AsideProps {
  doc: DocModel;
  palette: Palette;
  photo?: PhotoInput;
  /** The second photo on page 1 (Step 4.4, D40), only with `photo`. */
  secondPhoto?: PhotoInput;
}
