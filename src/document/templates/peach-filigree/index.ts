import { FiligreeBowFrame } from "../../frames/FiligreeBow";
import { CLASSIC_PHOTO, classicSkeleton } from "../../skeletons/classic";
import { AUTO_STEPS, type Palette } from "../../tokens";
import type { TemplateDef } from "../types";

// Peach Filigree (VISION D46 design 15, D51): light filigree corners on a fine double rule with a ribbon bow at the
// top centre, a warm peach wash, and pale heading bars with a thin outline and soft corners. Peach, rose and sage.
// Frame: frames/FiligreeBow (metal gradient of `rule`; the ribbon in `accent`; the wash from `soft`).

export const PEACH_FILIGREE_COLORS: readonly Palette[] = [
  {
    id: "peach",
    name: "Peach",
    swatch: "#e9a98a",
    paper: "#fff8f3",
    text: "#2a1a14",
    label: "#9c4529",
    bar: "#fbe5d8",
    barText: "#8a3a20",
    barRule: "#e2a587",
    rule: "#c98a66",
    ink: "#a14c31",
    inkBase: "#fbe3d6",
    frame: ["#a8603e", "#f2c3a8", "#c98a66"],
    accent: "#d27d62",
    soft: "#fbe1d2",
  },
  {
    id: "rose",
    name: "Rose",
    swatch: "#d9879f",
    paper: "#fff7f9",
    text: "#2a1a20",
    label: "#9b2c52",
    bar: "#fbe2ea",
    barText: "#8a2449",
    barRule: "#e2a0b4",
    rule: "#c47a92",
    ink: "#a3305a",
    inkBase: "#fbe2ea",
    frame: ["#a3305a", "#f0b9c9", "#c47a92"],
    accent: "#c2507a",
    soft: "#fadde6",
  },
  {
    id: "sage",
    name: "Sage",
    swatch: "#9aab72",
    paper: "#fafbf4",
    text: "#1c2214",
    label: "#4e6125",
    bar: "#e7eed8",
    barText: "#435420",
    barRule: "#b5c293",
    rule: "#9aa86b",
    ink: "#556b2a",
    inkBase: "#e7eed8",
    frame: ["#6b7d3a", "#d4deb0", "#9aa86b"],
    accent: "#c39a52",
    soft: "#e6edd5",
  },
];

export const peachFiligree: TemplateDef = {
  id: "peach-filigree",
  name: "Peach Filigree",
  colors: PEACH_FILIGREE_COLORS,
  autoSteps: AUTO_STEPS,
  ...classicSkeleton({
    bar: "outline",
    // The corners stay within 39 px of each edge (49 along the diagonal); the bow hangs 55 px from the top edge at
    // the centre, so page 1 starts at the same height with or without a top element.
    margins: { top: 64, topWithElement: 64, side: 60, bottom: 60 },
    photoWidth: CLASSIC_PHOTO,
    photoRadius: 12,
    top: { motifSize: 92, titleStyle: "rules" },
  }),
  Frame: FiligreeBowFrame,
};
