import { FiligreeDarkFrame } from "../../frames/Filigree";
import { CLASSIC_PHOTO, classicSkeleton } from "../../skeletons/classic";
import { AUTO_STEPS, type Palette } from "../../tokens";
import type { TemplateDef } from "../types";

// Deepam (VISION D44 dark festive variant, D46): gold lettering and gold filigree corners on dark festive paper,
// with gold heading bars and dark text in them. The paper is a real page background (the PDF and page images draw
// it; print keeps it with print-color-adjust), and every text colour passes WCAG AA on it (templates.test).
// Frame: frames/Filigree (metal gradient of the gold `rule`; the corner jewel in `accent`).

export const DEEPAM_COLORS: readonly Palette[] = [
  {
    id: "maroon",
    name: "Festive maroon",
    swatch: "#3b0a14",
    paper: "#3b0a14",
    text: "#fdf3e1",
    label: "#f2cd6b",
    bar: "#d9a441",
    barText: "#2a0710",
    rule: "#d9a441",
    ink: "#f2cd6b",
    inkBase: "#5a1424",
    frame: ["#b07a14", "#f2cd6b", "#d9a441"],
    accent: "#f2cd6b",
    soft: "#5a1424",
  },
  {
    id: "purple",
    name: "Festive purple",
    swatch: "#2e1065",
    paper: "#2e1065",
    text: "#f7f0ff",
    label: "#f2cd6b",
    bar: "#d9a441",
    barText: "#1e0a45",
    rule: "#d9a441",
    ink: "#f2cd6b",
    inkBase: "#43207f",
    frame: ["#b07a14", "#f2cd6b", "#d9a441"],
    accent: "#f2cd6b",
    soft: "#43207f",
  },
  {
    id: "night",
    name: "Night",
    swatch: "#111827",
    paper: "#111827",
    text: "#f3f4f6",
    label: "#f2cd6b",
    bar: "#d9a441",
    barText: "#111827",
    rule: "#d9a441",
    ink: "#f2cd6b",
    inkBase: "#1f2937",
    frame: ["#b07a14", "#f2cd6b", "#d9a441"],
    accent: "#f2cd6b",
    soft: "#1f2937",
  },
];

export const deepam: TemplateDef = {
  id: "deepam",
  name: "Deepam",
  colors: DEEPAM_COLORS,
  autoSteps: AUTO_STEPS,
  ...classicSkeleton({
    bar: "solid",
    // Corner scrolls stay within 46 px of the edges (57 along the diagonal); the rules sit at 21.6 and 27 px.
    margins: { top: 66, topWithElement: 48, side: 62, bottom: 66 },
    photoWidth: CLASSIC_PHOTO,
    photoRadius: 10,
    top: { motifSize: 92, titleStyle: "diamonds" },
  }),
  Frame: FiligreeDarkFrame,
};
