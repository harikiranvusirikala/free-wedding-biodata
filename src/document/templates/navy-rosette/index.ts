import { RosetteFrame } from "../../frames/Rosette";
import { CLASSIC_PHOTO, classicSkeleton } from "../../skeletons/classic";
import { AUTO_STEPS, type Palette } from "../../tokens";
import type { TemplateDef } from "../types";

// Navy Rosette (VISION D46 design 19, D51): a formal double border with a fine gold line inside it, rosettes in the
// corners and at the middle of each side with laurel sprigs, a cool paper wash and deep solid heading bars with white
// text. Navy, maroon and forest green, each with gold. Frame: frames/Rosette (lines, petals and leaves in `rule`;
// rosette centres, dots and the inner line in `accent`).

export const NAVY_ROSETTE_COLORS: readonly Palette[] = [
  {
    id: "navy",
    name: "Navy",
    swatch: "#1f3c73",
    paper: "#fbfcff",
    text: "#141a26",
    label: "#1f3c73",
    bar: "#1f3c73",
    barText: "#ffffff",
    rule: "#1f3c73",
    ink: "#1f3c73",
    inkBase: "#e3eaf7",
    frame: ["#14284b", "#7f9bd0", "#1f3c73"],
    accent: "#c8962e",
    soft: "#e6ecf7",
  },
  {
    id: "maroon",
    name: "Maroon",
    swatch: "#7d1426",
    paper: "#fffbfa",
    text: "#21151a",
    label: "#7d1426",
    bar: "#7d1426",
    barText: "#ffffff",
    rule: "#7d1426",
    ink: "#7d1426",
    inkBase: "#f6dfe3",
    frame: ["#5a0e1b", "#e9b8bf", "#7d1426"],
    accent: "#c8962e",
    soft: "#f6e6e6",
  },
  {
    id: "green",
    name: "Forest green",
    swatch: "#14532d",
    paper: "#fafdfa",
    text: "#132017",
    label: "#14532d",
    bar: "#14532d",
    barText: "#ffffff",
    rule: "#14532d",
    ink: "#14532d",
    inkBase: "#dcefe2",
    frame: ["#0e3b20", "#9fd0b0", "#14532d"],
    accent: "#c8962e",
    soft: "#e2efe5",
  },
];

export const navyRosette: TemplateDef = {
  id: "navy-rosette",
  name: "Navy Rosette",
  colors: NAVY_ROSETTE_COLORS,
  autoSteps: AUTO_STEPS,
  ...classicSkeleton({
    bar: "solid",
    // The border sits 22, 29 and 34 px in; the corner rosettes reach 43 px from each edge, the side rosettes 38 px.
    margins: { top: 62, topWithElement: 50, side: 60, bottom: 62 },
    photoWidth: CLASSIC_PHOTO,
    photoRadius: 8,
    top: { motifSize: 92, titleStyle: "diamonds" },
  }),
  Frame: RosetteFrame,
};
