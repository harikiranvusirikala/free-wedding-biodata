import { SandalwoodFrame } from "../../frames/Sandalwood";
import { CLASSIC_PHOTO } from "../../skeletons/classic";
import { classicLetterheadSkeleton } from "../../skeletons/letterhead";
import { AUTO_STEPS, type Palette } from "../../tokens";
import type { TemplateDef } from "../types";

// Sandalwood (VISION D44 letterhead, D46 design 9): warm sandal paper with a soft wash, the name as a large
// letterhead over a fine double rule, soft sandal heading bars, and a quiet double-rule border with small corner
// blossoms. Frame: frames/Sandalwood (`rule` the lines, `accent` the dots, `soft` the wash's deepest tint).
// Every text colour passes WCAG AA on the paper and on the wash's deepest tint (designs.test).

export const SANDALWOOD_COLORS: readonly Palette[] = [
  {
    id: "sandal",
    name: "Sandal",
    swatch: "#c99a5b",
    paper: "#fbf4e6",
    text: "#2a2117",
    label: "#6b4520",
    bar: "#eed9b2",
    barText: "#3b2810",
    rule: "#b08850",
    ink: "#8a5a1c",
    inkBase: "#f3e3c3",
    frame: ["#8a6430", "#e8cf9c", "#b08850"],
    accent: "#9a5f2a",
    soft: "#efdcb9",
  },
  {
    id: "rosewood",
    name: "Rosewood",
    swatch: "#b0705c",
    paper: "#fcf3ee",
    text: "#2a1916",
    label: "#7a2f24",
    bar: "#f1d6cb",
    barText: "#3d1610",
    rule: "#b0705c",
    ink: "#8a3a2c",
    inkBase: "#f6e0d7",
    frame: ["#8a4a3a", "#e9c0b0", "#b0705c"],
    accent: "#8a3a2c",
    soft: "#f0d8cc",
  },
  {
    id: "tulsi",
    name: "Tulsi",
    swatch: "#8c9a5a",
    paper: "#f9f7eb",
    text: "#1d2114",
    label: "#4a5a24",
    bar: "#e4e8c8",
    barText: "#26300f",
    rule: "#8c9a5a",
    ink: "#56692a",
    inkBase: "#ebeed6",
    frame: ["#5d6d33", "#d3dca6", "#8c9a5a"],
    accent: "#a0782f",
    soft: "#e6e8cb",
  },
];

export const sandalwood: TemplateDef = {
  id: "sandalwood",
  name: "Sandalwood",
  colors: SANDALWOOD_COLORS,
  autoSteps: AUTO_STEPS,
  ...classicLetterheadSkeleton({
    bar: "solid",
    // The rules sit 22 and 27 px in and the corner blossoms reach 41 px: text keeps 20 px clear of the inner rule.
    margins: { top: 68, topWithElement: 50, side: 62, bottom: 68 },
    photoWidth: CLASSIC_PHOTO,
    photoRadius: 6,
    top: { motifSize: 72, titleStyle: "diamonds" },
    letterhead: { motifSize: 64, nameSize: 2.15 },
  }),
  Frame: SandalwoodFrame,
};
