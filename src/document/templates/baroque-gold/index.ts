import { BaroqueFrame } from "../../frames/Baroque";
import { CLASSIC_PHOTO, classicSkeleton } from "../../skeletons/classic";
import { AUTO_STEPS, type Palette } from "../../tokens";
import type { TemplateDef } from "../types";

// Baroque Gold (VISION D46 design 8, D51): ornate gold scrollwork with acanthus fronds in the corners of a gold double
// rule, small cartouches at the top and bottom, a parchment wash and pale gold heading bars. A light parchment, a
// maroon and a deep festive navy colour (gold ornaments and lettering on dark paper, like Deepam). Frame:
// frames/Baroque (metal gradient of `rule`; jewels in `accent`; the wash from `soft`).

export const BAROQUE_GOLD_COLORS: readonly Palette[] = [
  {
    id: "gold",
    name: "Parchment gold",
    swatch: "#c9a24f",
    paper: "#fbf4e4",
    text: "#2a1f12",
    label: "#6b4a1e",
    bar: "#e8d3a0",
    barText: "#3d2a0e",
    rule: "#a07a2c",
    ink: "#7a5418",
    inkBase: "#f1e2bd",
    frame: ["#8a6420", "#e9cf8a", "#a07a2c"],
    accent: "#6b4a1e",
    soft: "#efdcb0",
  },
  {
    id: "maroon",
    name: "Maroon",
    swatch: "#7d1426",
    paper: "#fdf7ee",
    text: "#24151a",
    label: "#7d1426",
    bar: "#7d1426",
    barText: "#fbecc8",
    rule: "#a8802e",
    ink: "#7d1426",
    inkBase: "#f6e0e1",
    frame: ["#8a6420", "#e9cf8a", "#a8802e"],
    accent: "#7d1426",
    soft: "#f1dfc0",
  },
  {
    id: "navy",
    name: "Festive navy",
    swatch: "#14213d",
    paper: "#14213d",
    text: "#f6f1e4",
    label: "#f0cf7a",
    bar: "#d9ad4f",
    barText: "#14213d",
    rule: "#d9ad4f",
    ink: "#f0cf7a",
    inkBase: "#22325a",
    frame: ["#b07a14", "#f2cd6b", "#d9ad4f"],
    accent: "#f0cf7a",
    soft: "#1d2d52",
  },
];

export const baroqueGold: TemplateDef = {
  id: "baroque-gold",
  name: "Baroque Gold",
  colors: BAROQUE_GOLD_COLORS,
  autoSteps: AUTO_STEPS,
  ...classicSkeleton({
    bar: "solid",
    // The corners reach 49 px in from each edge (61 along the diagonal, 210 along the edges); between them only the
    // rules (23 and 30 px in) and the cartouches at the middle of the top and bottom edges (within 34 px).
    margins: { top: 72, topWithElement: 48, side: 64, bottom: 72 },
    photoWidth: CLASSIC_PHOTO,
    photoRadius: 10,
    top: { motifSize: 92, titleStyle: "diamonds" },
  }),
  Frame: BaroqueFrame,
};
