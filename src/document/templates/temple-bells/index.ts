import { BellsFrame } from "../../frames/Bells";
import { CLASSIC_PHOTO, classicSkeleton } from "../../skeletons/classic";
import { AUTO_STEPS, type Palette } from "../../tokens";
import type { TemplateDef } from "../types";

// Temple Bells (VISION D46): light sandal paper, hanging temple bells and diyas along the top, a temple band along
// the bottom, and solid coloured heading bars with light text. Frame: frames/Bells (metal parts in `rule`, beads,
// flames and band drops in `accent`, the band backing `soft`).

export const TEMPLE_BELLS_COLORS: readonly Palette[] = [
  {
    id: "maroon",
    name: "Maroon",
    swatch: "#8a1c2b",
    paper: "#fff7e8",
    text: "#24170e",
    label: "#8a1c2b",
    bar: "#8a1c2b",
    barText: "#fff4dc",
    rule: "#b7791f",
    ink: "#8a1c2b",
    inkBase: "#f8e3c4",
    frame: ["#8f5e12", "#f2cd6b", "#b7791f"],
    accent: "#d9621c",
    soft: "#f8e3c4",
  },
  {
    id: "amber",
    name: "Amber",
    swatch: "#b45309",
    paper: "#fff8ec",
    text: "#25180b",
    label: "#9a4708",
    bar: "#a84d08",
    barText: "#fff7ea",
    rule: "#b7791f",
    ink: "#9a4708",
    inkBase: "#fae6c9",
    frame: ["#8f5e12", "#f2cd6b", "#b7791f"],
    accent: "#8a1c2b",
    soft: "#f9e5c6",
  },
  {
    id: "blue",
    name: "Temple blue",
    swatch: "#1f4e79",
    paper: "#fbf8f1",
    text: "#151b24",
    label: "#1f4e79",
    bar: "#1f4e79",
    barText: "#f3f7fc",
    rule: "#b08a2a",
    ink: "#1f4e79",
    inkBase: "#e2ebf5",
    frame: ["#80641b", "#ecd27e", "#b08a2a"],
    accent: "#c2501c",
    soft: "#f1e6cc",
  },
];

export const templeBells: TemplateDef = {
  id: "temple-bells",
  name: "Temple Bells",
  colors: TEMPLE_BELLS_COLORS,
  autoSteps: AUTO_STEPS,
  ...classicSkeleton({
    bar: "solid",
    // The bells hang to y ≈ 55 all along the top; the side rules sit at 30/36 px; the temple band starts at 1074.
    margins: { top: 78, topWithElement: 72, side: 62, bottom: 72 },
    photoWidth: CLASSIC_PHOTO,
    photoRadius: 10,
    top: { motifSize: 92, titleStyle: "diamonds" },
  }),
  Frame: BellsFrame,
};
