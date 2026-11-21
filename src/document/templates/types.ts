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
  photo?: PhotoInput;
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
  /** The document as blocks, in reading order. `photo` = a picture will be drawn. */
  blocks: (doc: DocModel, options: { photo: boolean }) => BlockSpec[];
  /** The frame artwork drawn on every page, if any. */
  Frame?: ComponentType<{ palette: Palette }>;
  BlockView: ComponentType<BlockViewProps>;
}
