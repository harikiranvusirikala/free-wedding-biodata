import { WatercolourLeavesFrame } from "../../frames/WatercolourLeaves";
import { CLASSIC_PHOTO, classicSkeleton } from "../../skeletons/classic";
import { AUTO_STEPS, type Palette } from "../../tokens";
import type { TemplateDef } from "../types";

// Mango Grove (VISION D46, D51): warm paper glowing from two corners, watercolour mango leaves falling from the
// top-right and bottom-left corners with two ripe mangoes, and soft filled heading bars. Frame:
// frames/WatercolourLeaves (leaves in `rule`, `accent` and their mixes, washes in `soft`, mangoes in `frame`).

const MANGO = ["#d9731c", "#f8cf55", "#ee9f2a"] as const;

export const MANGO_GROVE_COLORS: readonly Palette[] = [
  {
    id: "mango",
    name: "Mango",
    swatch: "#c8691c",
    paper: "#fffaf2",
    text: "#25170c",
    label: "#984610",
    bar: "#f9e0b8",
    barText: "#6b3410",
    rule: "#c8691c",
    ink: "#984610",
    inkBase: "#fbe7c6",
    frame: MANGO,
    accent: "#6a8f2e",
    soft: "#fbe6c4",
  },
  {
    id: "leaf",
    name: "Leaf green",
    swatch: "#6a8f2e",
    paper: "#fafbf1",
    text: "#1a2210",
    label: "#4d6b1d",
    bar: "#e4edcb",
    barText: "#3a5316",
    rule: "#6a8f2e",
    ink: "#4d6b1d",
    inkBase: "#e6efd0",
    frame: MANGO,
    accent: "#c8691c",
    soft: "#e7efd2",
  },
  {
    id: "berry",
    name: "Berry",
    swatch: "#b8456b",
    paper: "#fff9f8",
    text: "#2a1418",
    label: "#9f3a5c",
    bar: "#f7dfe5",
    barText: "#80284a",
    rule: "#b8456b",
    ink: "#9f3a5c",
    inkBase: "#f9e2e9",
    frame: MANGO,
    accent: "#6a8f2e",
    soft: "#f8e0e7",
  },
];

export const mangoGrove: TemplateDef = {
  id: "mango-grove",
  name: "Mango Grove",
  colors: MANGO_GROVE_COLORS,
  autoSteps: AUTO_STEPS,
  ...classicSkeleton({
    bar: "solid",
    margins: { top: 80, topWithElement: 74, side: 70, bottom: 80 },
    photoWidth: CLASSIC_PHOTO,
    photoRadius: 12,
    top: { motifSize: 92, titleStyle: "diamonds" },
  }),
  Frame: WatercolourLeavesFrame,
};
