import { PeacockFrame } from "../../frames/Peacock";
import { CLASSIC_PHOTO, classicSkeleton } from "../../skeletons/classic";
import { AUTO_STEPS, type Palette } from "../../tokens";
import type { TemplateDef } from "../types";

// Peacock (VISION D46 design 10, D51): a fan of peacock feathers in each top corner, a fine double border, a lotus
// at the bottom centre and a cool paper wash, with deep solid heading bars. Teal, royal blue and a deep festive
// emerald (gold feathers and lettering on dark green paper). Frame: frames/Peacock (shafts, barbs and border in
// `rule`; the eyes in `accent` with a `soft` rim).

export const PEACOCK_COLORS: readonly Palette[] = [
  {
    id: "teal",
    name: "Teal",
    swatch: "#0f6e74",
    paper: "#f6fbfa",
    text: "#10211f",
    label: "#0d5d63",
    bar: "#0f6e74",
    barText: "#f6fbfa",
    rule: "#1b7f86",
    ink: "#0f6e74",
    inkBase: "#d9efed",
    frame: ["#0d5d63", "#7cc4c0", "#1b7f86"],
    accent: "#2f6db0",
    soft: "#d6eeeb",
  },
  {
    id: "blue",
    name: "Royal blue",
    swatch: "#1e3a8a",
    paper: "#f7f9fe",
    text: "#121a2e",
    label: "#1e3a8a",
    bar: "#1e3a8a",
    barText: "#f7f9fe",
    rule: "#2c55a8",
    ink: "#1e3a8a",
    inkBase: "#dfe7f8",
    frame: ["#1e3a8a", "#93b0e6", "#2c55a8"],
    accent: "#0e8a8a",
    soft: "#dde6f7",
  },
  {
    id: "emerald",
    name: "Festive emerald",
    swatch: "#0f2f25",
    paper: "#0f2f25",
    text: "#eef6f1",
    label: "#ecc96a",
    bar: "#d4a748",
    barText: "#0f2f25",
    rule: "#d4a748",
    ink: "#ecc96a",
    inkBase: "#1b4537",
    frame: ["#b07a14", "#f2cd6b", "#d4a748"],
    accent: "#3fb0a4",
    soft: "#173f32",
  },
];

export const peacock: TemplateDef = {
  id: "peacock",
  name: "Peacock",
  colors: PEACOCK_COLORS,
  autoSteps: AUTO_STEPS,
  ...classicSkeleton({
    bar: "solid",
    // The feathers fan 63 px down from the top edge and in from the sides near their eyes (255 px from the corner);
    // the border sits 27 and 32 px in, the lotus rises 39 px above the bottom edge. A top element starts at the
    // same height: an invocation spread across the width would meet the middle feathers' eyes.
    margins: { top: 70, topWithElement: 70, side: 66, bottom: 64 },
    photoWidth: CLASSIC_PHOTO,
    photoRadius: 10,
    top: { motifSize: 92, titleStyle: "rules" },
  }),
  Frame: PeacockFrame,
};
