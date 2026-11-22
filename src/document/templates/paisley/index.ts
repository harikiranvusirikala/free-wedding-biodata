import { PaisleyFrame } from "../../frames/Paisley";
import { classicSkeleton } from "../../skeletons/classic";
import { AUTO_STEPS, type Palette } from "../../tokens";
import type { TemplateDef } from "../types";

// Paisley (VISION D46): warm ivory paper, a mango paisley at each corner joined by a fine double rule, headings as
// coloured text over an underline, and a tall 2:3 photo frame (a full-length photo, D40). Frame: frames/Paisley.

export const PAISLEY_COLORS: readonly Palette[] = [
  {
    id: "copper",
    name: "Copper",
    swatch: "#b5651d",
    paper: "#fdf7ef",
    text: "#24180f",
    label: "#8b3a1a",
    bar: "transparent",
    barText: "#8b3a1a",
    barRule: "#b5651d",
    rule: "#b5651d",
    ink: "#8b3a1a",
    inkBase: "#f7e2c8",
    frame: ["#8b3a1a", "#f0b98a", "#b5651d"],
    accent: "#3f7d3a",
    soft: "#f7e2c8",
  },
  {
    id: "maroon",
    name: "Maroon",
    swatch: "#8a1c2b",
    paper: "#fdf7f2",
    text: "#24151a",
    label: "#8a1c2b",
    bar: "transparent",
    barText: "#8a1c2b",
    barRule: "#b8871f",
    rule: "#8a1c2b",
    ink: "#8a1c2b",
    inkBase: "#f6e0e0",
    frame: ["#8a1c2b", "#e8a6ae", "#a8384a"],
    accent: "#b8871f",
    soft: "#f5e3d6",
  },
  {
    id: "teal",
    name: "Teal",
    swatch: "#2f6a5b",
    paper: "#f8fbf6",
    text: "#13201c",
    label: "#2a5f51",
    bar: "transparent",
    barText: "#2a5f51",
    barRule: "#b8871f",
    rule: "#2f6a5b",
    ink: "#2a5f51",
    inkBase: "#dcece6",
    frame: ["#2a5f51", "#9fd0c0", "#2f6a5b"],
    accent: "#b8871f",
    soft: "#dcece6",
  },
];

export const paisley: TemplateDef = {
  id: "paisley",
  name: "Paisley",
  colors: PAISLEY_COLORS,
  autoSteps: AUTO_STEPS,
  ...classicSkeleton({
    bar: "underline",
    // Corner pieces reach ~50 px in within 168 px of each corner; a top element sits between them, under the rules.
    margins: { top: 68, topWithElement: 52, side: 66, bottom: 66 },
    // Drawn for the tall frame: a slightly wider 2:3 photo than Classic Gold's.
    photoWidth: { "3:4": 200, "2:3": 196 },
    photoRadius: 10,
    top: { motifSize: 92, titleStyle: "rules" },
  }),
  Frame: PaisleyFrame,
  photoFrame: "2:3",
};
