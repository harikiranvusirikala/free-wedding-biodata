import type { DocModel } from "@/biodata/document";
import { Letterhead, type LetterheadLook } from "../blocks/Letterhead";
import { classicBlocks, hasTopElement } from "../templates/classic-gold/layout";
import type { BlockViewProps, PhotoOptions, TemplateDef } from "../templates/types";
import { SPACE, type Box } from "../tokens";
import { classicSkeleton, type ClassicLook } from "./classic";

// The Classic skeleton with a large-name letterhead (VISION D44, D46: Sandalwood): page 1 opens with the name in
// large spaced capitals, designation · city and a fine rule (blocks/Letterhead), so the name row isn't repeated in
// Personal details; everything else is the Classic skeleton (heading bars, rows, the photo beside the first section
// that starts with rows, the second photo beside a later one). Pure block list; the drawing is classicSkeleton's.

/** True when page 1 has a letterhead: a name, or any top element (invocation, motif, title). */
export const hasLetterhead = (doc: DocModel) => !!doc.name || hasTopElement(doc);

/** The Classic block list under a letterhead: the header first, the name row dropped (and a section it empties). */
export function letterheadBlocks(doc: DocModel, options: PhotoOptions) {
  if (!doc.name) return classicBlocks(doc, options);
  const sections = doc.sections
    .map((s) => ({ ...s, items: s.items.filter((i) => !(i.kind === "row" && i.key === "fullName")) }))
    .filter((s) => s.items.length);
  const specs = classicBlocks({ ...doc, sections }, options);
  if (specs[0]?.block.kind === "header") return specs;
  return [{ block: { kind: "header" as const, id: "header" }, spaceBefore: 0 }, ...specs.map((s, i) => (i === 0 ? { ...s, spaceBefore: SPACE.section } : s))];
}

export function classicLetterheadSkeleton(look: ClassicLook & { letterhead: LetterheadLook }): Pick<TemplateDef, "skeleton" | "pageBox" | "blocks" | "BlockView" | "photoRadius"> {
  const base = classicSkeleton(look);
  const ClassicView = base.BlockView;
  function LetterheadView(props: BlockViewProps) {
    if (props.block.kind === "header") return <Letterhead doc={props.doc} palette={props.palette} look={look.letterhead} />;
    return <ClassicView {...props} />;
  }
  const pageBox = (index: number, doc: DocModel): Box => {
    const { top, topWithElement, side, bottom } = look.margins;
    return { top: index === 0 && hasLetterhead(doc) ? topWithElement : top, right: side, bottom, left: side };
  };
  return { ...base, pageBox, blocks: letterheadBlocks, BlockView: LetterheadView };
}
