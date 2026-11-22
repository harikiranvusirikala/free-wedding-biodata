import type { TemplateDef } from "../../templates/types";
import { modernAsideTexts, modernBlocks, modernPageBox } from "./layout";
import { ModernAside, ModernBlockView } from "./ModernView";

/** The Modern skeleton (D34): a design is this plus a side-panel frame and three palettes. */
export const modernSkeleton: Pick<TemplateDef, "skeleton" | "pageBox" | "blocks" | "BlockView" | "Aside" | "asideTexts" | "photoRadius"> = {
  skeleton: "modern",
  pageBox: modernPageBox,
  blocks: modernBlocks,
  BlockView: ModernBlockView,
  Aside: ModernAside,
  asideTexts: modernAsideTexts,
  photoRadius: 6,
};
