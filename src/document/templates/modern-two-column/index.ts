import { BandedSidePanelFrame } from "../../frames/SidePanel";
import { modernSkeleton } from "../../skeletons/modern";
import { AUTO_STEPS, type Palette } from "../../tokens";
import type { TemplateDef } from "../types";

// Modern Two-Column (VISION §7 design 8, D46): the Modern skeleton with a pale tinted side column under an accent
// band, dark text throughout, and accent headings. Frame: frames/SidePanel (banded: `bar` is the band).

export const MODERN_TWO_COLUMN_COLORS: readonly Palette[] = [
  {
    id: "teal",
    name: "Teal",
    swatch: "#127a6c",
    paper: "#ffffff",
    text: "#14211f",
    label: "#4e6662",
    bar: "#127a6c",
    barText: "#0f7064",
    rule: "#d5e5e2",
    ink: "#127a6c",
    inkBase: "#dcefeb",
    frame: ["#0f5f55", "#5fb8aa", "#127a6c"],
    side: "#eef6f4",
    sideText: "#163b36",
    sideMuted: "#4a6560",
  },
  {
    id: "amber",
    name: "Amber",
    swatch: "#b45309",
    paper: "#ffffff",
    text: "#211a12",
    label: "#6b5a4c",
    bar: "#b45309",
    barText: "#a54c08",
    rule: "#eadfd2",
    ink: "#a54c08",
    inkBase: "#fbe9d4",
    frame: ["#8a3f06", "#f0b06a", "#b45309"],
    side: "#fdf4ea",
    sideText: "#3d2410",
    sideMuted: "#735640",
  },
  {
    id: "rose",
    name: "Rose",
    swatch: "#be123c",
    paper: "#ffffff",
    text: "#221419",
    label: "#6e5560",
    bar: "#be123c",
    barText: "#b01238",
    rule: "#eed8dd",
    ink: "#b01238",
    inkBase: "#fbe0e6",
    frame: ["#8f0e2e", "#f08aa2", "#be123c"],
    side: "#fdf1f3",
    sideText: "#4a1022",
    sideMuted: "#7a5260",
  },
];

export const modernTwoColumn: TemplateDef = {
  id: "modern-two-column",
  name: "Modern Two-Column",
  colors: MODERN_TWO_COLUMN_COLORS,
  autoSteps: AUTO_STEPS,
  ...modernSkeleton,
  Frame: BandedSidePanelFrame,
};
