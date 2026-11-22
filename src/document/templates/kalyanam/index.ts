import { ToranFrame } from "../../frames/Toran";
import { CLASSIC_PHOTO, classicSkeleton } from "../../skeletons/classic";
import { AUTO_STEPS, type Palette } from "../../tokens";
import type { TemplateDef } from "../types";

// Kalyanam (VISION §7 design 2, D46): warm cream paper, a festive thoranam of mango leaves and marigolds across
// the top, a faint mandala watermark, and headings as coloured text over a gold underline. Frame: frames/Toran.
// `frame` is the leaves' gradient, `accent` the marigolds, `rule` the border.

const LEAVES = ["#2f6b2a", "#6fa94e", "#3f7d3a"] as const;

export const KALYANAM_COLORS: readonly Palette[] = [
  {
    id: "maroon",
    name: "Maroon",
    swatch: "#7a1420",
    paper: "#fff8ec",
    text: "#22160c",
    label: "#7a1420",
    bar: "transparent",
    barText: "#7a1420",
    barRule: "#c98a1b",
    rule: "#b7791f",
    ink: "#7a1420",
    inkBase: "#f6dfe3",
    frame: LEAVES,
    accent: "#ec7c10",
    soft: "#f6e6c4",
  },
  {
    id: "saffron",
    name: "Saffron",
    swatch: "#c2410c",
    paper: "#fff8ee",
    text: "#24160c",
    label: "#a8380b",
    bar: "transparent",
    barText: "#a8380b",
    barRule: "#d99a2b",
    rule: "#c07a26",
    ink: "#a8380b",
    inkBase: "#fbe3d3",
    frame: LEAVES,
    accent: "#e9a20f",
    soft: "#f8e4c8",
  },
  {
    id: "leaf",
    name: "Leaf",
    swatch: "#3f7d3a",
    paper: "#fbf9ee",
    text: "#18200f",
    label: "#2f6a2b",
    bar: "transparent",
    barText: "#2f6a2b",
    barRule: "#c98a1b",
    rule: "#a8861f",
    ink: "#2f6a2b",
    inkBase: "#e0eed9",
    frame: LEAVES,
    accent: "#ec7c10",
    soft: "#eef0d4",
  },
];

export const kalyanam: TemplateDef = {
  id: "kalyanam",
  name: "Kalyanam",
  colors: KALYANAM_COLORS,
  autoSteps: AUTO_STEPS,
  ...classicSkeleton({
    bar: "underline",
    // The garland hangs across the whole top edge, so a top element starts below it too.
    margins: { top: 88, topWithElement: 84, side: 60, bottom: 60 },
    photoWidth: CLASSIC_PHOTO,
    photoRadius: 10,
    top: { motifSize: 92, titleStyle: "rules" },
  }),
  Frame: ToranFrame,
};
