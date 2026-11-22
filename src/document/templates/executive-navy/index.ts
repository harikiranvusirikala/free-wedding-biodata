import { SidePanelFrame } from "../../frames/SidePanel";
import { modernSkeleton } from "../../skeletons/modern";
import { AUTO_STEPS, type Palette } from "../../tokens";
import type { TemplateDef } from "../types";

// Executive Navy (VISION §7 design 5, D46): the Modern skeleton with a deep side panel (photo, name, contact in
// light text) and a white main column with small spaced headings in the accent colour. Frame: frames/SidePanel.
// `side`/`sideText`/`sideMuted` colour the panel; `barText` is the heading accent; `label` the muted row labels.

export const EXECUTIVE_NAVY_COLORS: readonly Palette[] = [
  {
    id: "navy",
    name: "Navy",
    swatch: "#14284b",
    paper: "#ffffff",
    text: "#141a26",
    label: "#4a5874",
    bar: "#14284b",
    barText: "#2f5aa8",
    rule: "#d3d9e4",
    ink: "#2f5aa8",
    inkBase: "#e3eaf7",
    frame: ["#14284b", "#2f5aa8", "#1f3c73"],
    side: "#14284b",
    sideText: "#eef2fa",
    sideMuted: "#a9b9d6",
  },
  {
    id: "forest",
    name: "Forest",
    swatch: "#1f4e3d",
    paper: "#ffffff",
    text: "#14201b",
    label: "#4a5e56",
    bar: "#1f4e3d",
    barText: "#2b7558",
    rule: "#d2e0d9",
    ink: "#2b7558",
    inkBase: "#dfeee7",
    frame: ["#1f4e3d", "#2b7558", "#245f4a"],
    side: "#1f4e3d",
    sideText: "#eef6f2",
    sideMuted: "#a9c9ba",
  },
  {
    id: "plum",
    name: "Plum",
    swatch: "#3d2b56",
    paper: "#ffffff",
    text: "#1b1624",
    label: "#5a4f6b",
    bar: "#3d2b56",
    barText: "#6a4b98",
    rule: "#dcd6e6",
    ink: "#6a4b98",
    inkBase: "#ebe4f5",
    frame: ["#3d2b56", "#6a4b98", "#523b74"],
    side: "#3d2b56",
    sideText: "#f4f0fa",
    sideMuted: "#c3b5da",
  },
];

export const executiveNavy: TemplateDef = {
  id: "executive-navy",
  name: "Executive Navy",
  colors: EXECUTIVE_NAVY_COLORS,
  autoSteps: AUTO_STEPS,
  ...modernSkeleton,
  Frame: SidePanelFrame,
};
