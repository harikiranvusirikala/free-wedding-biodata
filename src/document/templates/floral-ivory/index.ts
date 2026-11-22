import { BlossomFrame } from "../../frames/Blossom";
import { classicSkeleton } from "../../skeletons/classic";
import { AUTO_STEPS, type Palette } from "../../tokens";
import type { TemplateDef } from "../types";

// Floral Ivory (VISION D46, D51): ivory paper with soft corner glows, delicate blossoms with sage leaves in every
// corner and at the middle of each side joined by a fine rule, pale filled heading bars, and a tall 2:3 photo.
// Frame: frames/Blossom (blossoms in `accent`, leaves in the frame gradient, stems and rule in `rule`, glows in
// `soft`).

const SAGE = ["#5f7f50", "#b3cda2", "#7c9a6a"] as const;

export const FLORAL_IVORY_COLORS: readonly Palette[] = [
  {
    id: "blush",
    name: "Blush",
    swatch: "#e889a3",
    paper: "#fffaf8",
    text: "#2a1d21",
    label: "#a13e5d",
    bar: "#f9e3e8",
    barText: "#7b2741",
    rule: "#cf8ea1",
    ink: "#a13e5d",
    inkBase: "#fbe4ea",
    frame: SAGE,
    accent: "#e27c99",
    soft: "#fbe6eb",
  },
  {
    id: "lavender",
    name: "Lavender",
    swatch: "#a78bfa",
    paper: "#fcfaff",
    text: "#221d2b",
    label: "#6a46b5",
    bar: "#eee7fc",
    barText: "#4c2f8f",
    rule: "#ad97e0",
    ink: "#6a46b5",
    inkBase: "#ece4fb",
    frame: SAGE,
    accent: "#a083f0",
    soft: "#eee8fc",
  },
  {
    id: "marigold",
    name: "Marigold",
    swatch: "#f59e0b",
    paper: "#fffbf3",
    text: "#261c10",
    label: "#94500f",
    bar: "#fcebc9",
    barText: "#733c08",
    rule: "#d9a650",
    ink: "#94500f",
    inkBase: "#fbe8c6",
    frame: SAGE,
    accent: "#f0a024",
    soft: "#fcefd3",
  },
];

export const floralIvory: TemplateDef = {
  id: "floral-ivory",
  name: "Floral Ivory",
  colors: FLORAL_IVORY_COLORS,
  autoSteps: AUTO_STEPS,
  ...classicSkeleton({
    bar: "solid",
    margins: { top: 72, topWithElement: 52, side: 66, bottom: 72 },
    // Drawn for the tall frame (D51's softer photo): a slightly wider 2:3 photo with rounder corners.
    photoWidth: { "3:4": 200, "2:3": 196 },
    photoRadius: 16,
    top: { motifSize: 92, titleStyle: "diamonds" },
  }),
  Frame: BlossomFrame,
  photoFrame: "2:3",
};
