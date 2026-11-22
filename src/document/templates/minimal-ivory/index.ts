import { AUTO_STEPS, MINIMAL_IVORY_COLORS } from "../../tokens";
import type { TemplateDef } from "../types";
import { minimalBlocks, minimalPageBox } from "./layout";
import { MinimalBlockView } from "./MinimalBlockView";

/** Minimal Ivory (VISION §7 design 20): the Minimal skeleton, no frame, in ink, maroon and navy. */
export const minimalIvory: TemplateDef = {
  id: "minimal-ivory",
  name: "Minimal Ivory",
  skeleton: "minimal",
  colors: MINIMAL_IVORY_COLORS,
  autoSteps: AUTO_STEPS,
  pageBox: minimalPageBox,
  blocks: minimalBlocks,
  BlockView: MinimalBlockView,
  photoRadius: 2,
};
