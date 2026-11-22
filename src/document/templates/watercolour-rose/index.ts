import { WatercolourRoseFrame } from "../../frames/WatercolourRose";
import { CLASSIC_PHOTO, classicSkeleton } from "../../skeletons/classic";
import { AUTO_STEPS, type Palette } from "../../tokens";
import type { TemplateDef } from "../types";

// Watercolour Rose (VISION D46, D51): blush paper glowing softly from two corners, loose watercolour roses and
// leaves in the top-left and bottom-right corners, and airy headings in rose over a thin underline. Frame:
// frames/WatercolourRose (roses in `rule`, leaves in `accent`, washes in `soft`).

const LEAF = "#6f9160";

export const WATERCOLOUR_ROSE_COLORS: readonly Palette[] = [
  {
    id: "rose",
    name: "Rose",
    swatch: "#c2507a",
    paper: "#fff8fa",
    text: "#2a1a21",
    label: "#983360",
    bar: "transparent",
    barText: "#8a2a52",
    barRule: "#e3a3bb",
    rule: "#c2507a",
    ink: "#983360",
    inkBase: "#fbe4ec",
    frame: ["#983360", "#f2b8cb", "#c2507a"],
    accent: LEAF,
    soft: "#fadfe8",
  },
  {
    id: "lilac",
    name: "Lilac",
    swatch: "#9d7bd8",
    paper: "#fcf9ff",
    text: "#221a2c",
    label: "#6c47ad",
    bar: "transparent",
    barText: "#563592",
    barRule: "#c8b4ee",
    rule: "#9d7bd8",
    ink: "#6c47ad",
    inkBase: "#efe7fb",
    frame: ["#6c47ad", "#d6c7f3", "#9d7bd8"],
    accent: LEAF,
    soft: "#ece3fa",
  },
  {
    id: "coral",
    name: "Coral",
    swatch: "#e38b5c",
    paper: "#fff9f5",
    text: "#2a1a12",
    label: "#983d18",
    bar: "transparent",
    barText: "#8f3a18",
    barRule: "#f0b896",
    rule: "#e07f4c",
    ink: "#983d18",
    inkBase: "#fde6d8",
    frame: ["#983d18", "#f6c4a6", "#e07f4c"],
    accent: LEAF,
    soft: "#fce3d3",
  },
];

export const watercolourRose: TemplateDef = {
  id: "watercolour-rose",
  name: "Watercolour Rose",
  colors: WATERCOLOUR_ROSE_COLORS,
  autoSteps: AUTO_STEPS,
  ...classicSkeleton({
    bar: "underline",
    margins: { top: 86, topWithElement: 76, side: 70, bottom: 86 },
    photoWidth: CLASSIC_PHOTO,
    photoRadius: 12,
    top: { motifSize: 92, titleStyle: "rules" },
  }),
  Frame: WatercolourRoseFrame,
};
