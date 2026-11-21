import { FoliageFrame } from "../../frames/Foliage";
import { AUTO_STEPS, CLASSIC_GOLD_COLORS } from "../../tokens";
import type { TemplateDef } from "../types";
import { ClassicBlockView } from "./ClassicBlockView";
import { classicBlocks, classicPageBox } from "./layout";

/** Classic Gold (VISION §7 design 1, D29): the Classic skeleton with the foliage frame, in gold, rose and sage. */
export const classicGold: TemplateDef = {
  id: "classic-gold",
  name: "Classic Gold",
  skeleton: "classic",
  colors: CLASSIC_GOLD_COLORS,
  autoSteps: AUTO_STEPS,
  pageBox: classicPageBox,
  blocks: classicBlocks,
  Frame: FoliageFrame,
  BlockView: ClassicBlockView,
};
