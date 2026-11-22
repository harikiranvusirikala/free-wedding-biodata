import { BrushWashFrame } from "../../frames/BrushWash";
import { modernSkeleton } from "../../skeletons/modern";
import { AUTO_STEPS, type Palette } from "../../tokens";
import type { TemplateDef } from "../types";

// Slate Brush (VISION D46 design 18, D51): the Modern skeleton on white paper with no border. The side panel is a
// broad soft brush stroke instead of a flat colour, a second stroke crosses the top of the main column, and a
// slim one the bottom margin. Frame: frames/BrushWash. `side` is the panel stroke's fullest colour (its text is
// checked against it), `accent` tints the top stroke, `frame[2]` draws the thin paint marks, `barText` and
// `barRule` are the main column's headings and their rule.

export const SLATE_BRUSH_COLORS: readonly Palette[] = [
  {
    id: "slate",
    name: "Slate",
    swatch: "#5b7083",
    paper: "#ffffff",
    text: "#18212b",
    label: "#4a5a6a",
    bar: "#3d5266",
    barText: "#3d5266",
    barRule: "#9fb1c2",
    rule: "#d6dee6",
    ink: "#3d5266",
    inkBase: "#e2e8ee",
    frame: ["#3d5266", "#9fb3c4", "#5b7083"],
    accent: "#8fa58c",
    soft: "#e2e8ee",
    side: "#dde5ec",
    sideText: "#16212c",
    sideMuted: "#45576a",
  },
  {
    id: "heather",
    name: "Heather",
    swatch: "#7c6a9a",
    paper: "#ffffff",
    text: "#1d1824",
    label: "#574d66",
    bar: "#4f4366",
    barText: "#5b4a7a",
    barRule: "#b2a6c8",
    rule: "#e0dbe8",
    ink: "#5b4a7a",
    inkBase: "#ebe6f2",
    frame: ["#4f4366", "#b3a6cc", "#7c6a9a"],
    accent: "#c49aa8",
    soft: "#ebe6f2",
    side: "#e6e0ee",
    sideText: "#211a2b",
    sideMuted: "#55496a",
  },
  {
    id: "sage",
    name: "Sage",
    swatch: "#7a8b6f",
    paper: "#ffffff",
    text: "#171d14",
    label: "#4d5946",
    bar: "#46553d",
    barText: "#4a5e3f",
    barRule: "#a7b79b",
    rule: "#dde5d8",
    ink: "#4a5e3f",
    inkBase: "#e6ede1",
    frame: ["#46553d", "#aebf9f", "#7a8b6f"],
    accent: "#c2a26b",
    soft: "#e6ede1",
    side: "#e1e9da",
    sideText: "#1a2216",
    sideMuted: "#4b5943",
  },
];

export const slateBrush: TemplateDef = {
  id: "slate-brush",
  name: "Slate Brush",
  colors: SLATE_BRUSH_COLORS,
  autoSteps: AUTO_STEPS,
  ...modernSkeleton,
  Frame: BrushWashFrame,
};
