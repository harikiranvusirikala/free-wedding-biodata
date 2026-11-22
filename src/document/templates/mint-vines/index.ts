import { VinesFrame } from "../../frames/Vines";
import { CLASSIC_PHOTO, classicSkeleton } from "../../skeletons/classic";
import { AUTO_STEPS, type Palette } from "../../tokens";
import type { TemplateDef } from "../types";

// Mint Vines (VISION D46, D51): fresh mint paper with soft corner glows, fine green vines with golden buds climbing
// both sides and curling along the top, and deep solid heading bars with light text. Frame: frames/Vines (stems in
// `rule`, leaves in the frame gradient, buds in `accent`, glows in `soft`).

export const MINT_VINES_COLORS: readonly Palette[] = [
  {
    id: "green",
    name: "Green",
    swatch: "#3f7d3a",
    paper: "#f4faf2",
    text: "#132012",
    label: "#2f6a2b",
    bar: "#3f7d3a",
    barText: "#f6fbf4",
    rule: "#3f7d3a",
    ink: "#2f6a2b",
    inkBase: "#dcefd8",
    frame: ["#2f6a2b", "#8fc486", "#3f7d3a"],
    accent: "#c8962e",
    soft: "#dcefd7",
  },
  {
    id: "teal",
    name: "Teal",
    swatch: "#0f766e",
    paper: "#f1faf8",
    text: "#0f1f1d",
    label: "#0d6a62",
    bar: "#0f766e",
    barText: "#f2fbf9",
    rule: "#127a70",
    ink: "#0d6a62",
    inkBase: "#d3eee9",
    frame: ["#0d6a62", "#7fcdbf", "#127a70"],
    accent: "#d0892e",
    soft: "#d4eee9",
  },
  {
    id: "olive",
    name: "Olive",
    swatch: "#6b8e23",
    paper: "#f8faef",
    text: "#1a1f0e",
    label: "#536d1b",
    bar: "#5a7a1c",
    barText: "#f9fbf1",
    rule: "#6b8e23",
    ink: "#536d1b",
    inkBase: "#e6edcf",
    frame: ["#536d1b", "#b8cf7c", "#6b8e23"],
    accent: "#c0642e",
    soft: "#e7eecf",
  },
];

export const mintVines: TemplateDef = {
  id: "mint-vines",
  name: "Mint Vines",
  colors: MINT_VINES_COLORS,
  autoSteps: AUTO_STEPS,
  ...classicSkeleton({
    bar: "solid",
    margins: { top: 64, topWithElement: 54, side: 66, bottom: 64 },
    photoWidth: CLASSIC_PHOTO,
    photoRadius: 10,
    top: { motifSize: 92, titleStyle: "rules" },
  }),
  Frame: VinesFrame,
};
