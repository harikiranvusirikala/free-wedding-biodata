import { MandalaCornersFrame } from "../../frames/MandalaCorners";
import { CLASSIC_PHOTO, classicSkeleton } from "../../skeletons/classic";
import { AUTO_STEPS, type Palette } from "../../tokens";
import type { TemplateDef } from "../types";

// Royal Maroon (VISION §7 design 4, D46): ivory paper, deep solid heading bars with cream text and gold mandala
// corners joined by a fine gold rule. Frame: frames/MandalaCorners (gold `rule`, `accent` dots and leaves).

export const ROYAL_MAROON_COLORS: readonly Palette[] = [
  {
    id: "maroon",
    name: "Maroon",
    swatch: "#7d1426",
    paper: "#fffaf3",
    text: "#21151a",
    label: "#7d1426",
    bar: "#7d1426",
    barText: "#fff4dc",
    rule: "#b8871f",
    ink: "#7d1426",
    inkBase: "#f6dfe3",
    frame: ["#7d1426", "#e9b8bf", "#9a2a3c"],
    accent: "#7d1426",
    soft: "#f6e3c4",
  },
  {
    id: "purple",
    name: "Royal purple",
    swatch: "#4c1d95",
    paper: "#fdfaf6",
    text: "#1d1626",
    label: "#4c1d95",
    bar: "#4c1d95",
    barText: "#f6f0ff",
    rule: "#b8871f",
    ink: "#4c1d95",
    inkBase: "#ece3fa",
    frame: ["#4c1d95", "#c9b6f0", "#6531b8"],
    accent: "#4c1d95",
    soft: "#f2e6cf",
  },
  {
    id: "wine",
    name: "Wine",
    swatch: "#3b1219",
    paper: "#fdf8f1",
    text: "#211416",
    label: "#5a1a26",
    bar: "#3b1219",
    barText: "#f8e7c8",
    rule: "#b08226",
    ink: "#5a1a26",
    inkBase: "#f1e0e0",
    frame: ["#3b1219", "#d9b0b6", "#5a1a26"],
    accent: "#5a1a26",
    soft: "#f2e2c6",
  },
];

export const royalMaroon: TemplateDef = {
  id: "royal-maroon",
  name: "Royal Maroon",
  colors: ROYAL_MAROON_COLORS,
  autoSteps: AUTO_STEPS,
  ...classicSkeleton({
    bar: "solid",
    // The quarter mandalas reach 83 px from each corner; between them only the rule (18 px in) and its diamond.
    margins: { top: 76, topWithElement: 44, side: 64, bottom: 76 },
    photoWidth: CLASSIC_PHOTO,
    photoRadius: 10,
    top: { motifSize: 92, titleStyle: "diamonds" },
  }),
  Frame: MandalaCornersFrame,
};
