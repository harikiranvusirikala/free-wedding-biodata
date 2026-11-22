import { RangoliFrame } from "../../frames/Rangoli";
import { CLASSIC_PHOTO, classicSkeleton } from "../../skeletons/classic";
import { AUTO_STEPS, type Palette } from "../../tokens";
import type { TemplateDef } from "../types";

// Rangoli (VISION D46): blush paper inside a kolam band that runs all round the page, with rosettes at the corners,
// and light tinted heading bars with dark text. Frame: frames/Rangoli (lines in `rule`, dots in `accent`).

export const RANGOLI_COLORS: readonly Palette[] = [
  {
    id: "rose",
    name: "Rose",
    swatch: "#c2507a",
    paper: "#fff6f8",
    text: "#2a1720",
    label: "#a3294f",
    bar: "#f9d5de",
    barText: "#6e1a37",
    rule: "#c2507a",
    ink: "#a3294f",
    inkBase: "#fbe1e8",
    frame: ["#a3294f", "#f2a5bd", "#c2507a"],
    accent: "#e08a1e",
    soft: "#fbe1e8",
  },
  {
    id: "violet",
    name: "Violet",
    swatch: "#7c3aed",
    paper: "#faf7ff",
    text: "#1f1630",
    label: "#6d28d9",
    bar: "#e7ddfb",
    barText: "#3f1d7a",
    rule: "#7c3aed",
    ink: "#6d28d9",
    inkBase: "#ede5fd",
    frame: ["#5b21b6", "#c4b5fd", "#7c3aed"],
    accent: "#e08a1e",
    soft: "#ede5fd",
  },
  {
    id: "marigold",
    name: "Marigold",
    swatch: "#e08a1e",
    paper: "#fffaf1",
    text: "#26190b",
    label: "#a3540a",
    bar: "#fbe2bd",
    barText: "#5f3305",
    rule: "#d97e14",
    ink: "#a3540a",
    inkBase: "#fdebd0",
    frame: ["#a3540a", "#f8c77a", "#d97e14"],
    accent: "#c2507a",
    soft: "#fdebd0",
  },
];

export const rangoli: TemplateDef = {
  id: "rangoli",
  name: "Rangoli",
  colors: RANGOLI_COLORS,
  autoSteps: AUTO_STEPS,
  ...classicSkeleton({
    bar: "solid",
    // The band's inner rule is 50 px in all round; the corner rosettes reach 61 px.
    margins: { top: 70, topWithElement: 70, side: 68, bottom: 70 },
    photoWidth: CLASSIC_PHOTO,
    photoRadius: 10,
    top: { motifSize: 88, titleStyle: "rules" },
  }),
  Frame: RangoliFrame,
};
