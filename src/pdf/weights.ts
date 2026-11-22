// The font faces we ship per family (public/fonts, `npm run fonts`): Regular 400, Medium 500 and Bold 700. A CSS
// weight is matched to one of them the way the browser does (CSS Fonts 4 §5.2), so the PDF draws exactly the face
// the page showed: up to 400 → 400; above 400 up to 500 → 500; above 500 → 700.

export const FACE_WEIGHTS = [400, 500, 700] as const;
export type FaceWeight = (typeof FACE_WEIGHTS)[number];

export function faceWeight(weight: number): FaceWeight {
  return weight > 500 ? 700 : weight > 400 ? 500 : 400;
}

/** The file suffix of a face: `NotoSans-Medium.ttf`. */
export function faceSuffix(weight: number): "Regular" | "Medium" | "Bold" {
  return { 400: "Regular", 500: "Medium", 700: "Bold" }[faceWeight(weight)] as "Regular" | "Medium" | "Bold";
}
