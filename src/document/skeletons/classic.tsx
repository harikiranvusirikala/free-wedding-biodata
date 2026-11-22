import type { DocModel } from "@/biodata/document";
import { HeadingBar, type HeadingLook } from "../blocks/HeadingBar";
import { Paragraph, type ParagraphLook } from "../blocks/Paragraph";
import { Photo } from "../blocks/Photo";
import { Row, type RowLook } from "../blocks/Row";
import { TopElement, type TopElementLook } from "../blocks/TopElement";
import { classicBlocks, hasTopElement } from "../templates/classic-gold/layout";
import type { BlockViewProps, TemplateDef } from "../templates/types";
import { isLatin, SPACE, type Box, type Palette } from "../tokens";

// The Classic skeleton as data (VISION D34, D39; Step 4.3): Classic Gold's block list (an optional top element,
// heading bars with label/value rows, the photo beside the first section that starts with rows) drawn with a
// design's own look: its margins clear of its frame, its heading-bar style, photo size and title flourish. Every
// framed Classic design (Kalyanam, Temple Bells, Rangoli, Paisley, Royal Maroon, Deepam; Step 4.4's ten more) is
// `classicSkeleton(look)` plus a frame and three palettes. Classic Gold keeps its own drawing (the owner's
// reference, D29) on the same block list.

export interface ClassicLook {
  /** Heading bars: a filled bar with `barText` (solid), or `barText` over a 2 px `barRule` underline. */
  bar: "solid" | "underline";
  /**
   * Margins clear of the frame in px. `topWithElement` is page 1's top when it has a top element: a frame that
   * leaves the middle of the top edge free lets the motif and title start higher.
   */
  margins: { top: number; topWithElement: number; side: number; bottom: number };
  /** Photo width per frame shape (px) and its corner radius. */
  photoWidth: { "3:4": number; "2:3": number };
  photoRadius: number;
  top: TopElementLook;
}

const PHOTO_GAP = 24;

export function classicPageBoxFor(look: ClassicLook) {
  return (index: number, doc: DocModel): Box => {
    const { top, topWithElement, side, bottom } = look.margins;
    return { top: index === 0 && hasTopElement(doc) ? topWithElement : top, right: side, bottom, left: side };
  };
}

function headingLook(look: ClassicLook, doc: DocModel, p: Palette): HeadingLook {
  const latin = isLatin(doc.lang);
  const underline = look.bar === "underline";
  return {
    fill: underline ? "transparent" : p.bar,
    color: p.barText,
    size: 1.1,
    weight: 700,
    padding: underline ? "0.2em 0.15em 0.22em" : "0.3em 0.72em",
    letterSpacing: latin ? "0.035em" : "0",
    uppercase: latin,
    underline: underline ? (p.barRule ?? p.label) : null,
    underlineWidth: 2,
    after: `${SPACE.afterHeading}em`,
  };
}

const rowLook = (doc: DocModel, p: Palette, wide: boolean, underline: boolean): RowLook => ({
  labelWidth: wide ? "15.5em" : "11em",
  colon: true,
  labelColor: p.label,
  labelWeight: 700,
  valueColor: p.text,
  // Underlined headings have no bar to indent from: rows start a little in from the heading's text.
  indent: underline ? "0.6em" : `${SPACE.indent}em`,
  gap: `${SPACE.labelGap}em`,
  after: `${SPACE.row}em`,
  uppercaseLabel: doc.labelCase === "upper" && isLatin(doc.lang),
});

const paragraphLook = (doc: DocModel, p: Palette, underline: boolean): ParagraphLook => ({
  indent: underline ? "0.6em" : `${SPACE.indent}em`,
  rule: p.label,
  ruleWidth: 3,
  ruleGap: "0.8em",
  textColor: p.text,
  labelColor: p.label,
  uppercaseLabel: doc.labelCase === "upper" && isLatin(doc.lang),
  padTop: "0.05em",
  padBottom: `${SPACE.row}em`,
});

/** Page margins, block list and drawings of a Classic design. */
export function classicSkeleton(look: ClassicLook): Pick<TemplateDef, "skeleton" | "pageBox" | "blocks" | "BlockView"> {
  const underline = look.bar === "underline";
  function ClassicView({ block, doc, palette, photo, text, continued }: BlockViewProps) {
    const heading = headingLook(look, doc, palette);
    const paragraph = paragraphLook(doc, palette, underline);
    const photoEl = photo ? <Photo photo={photo} width={look.photoWidth[photo.frame]} radius={look.photoRadius} /> : null;
    switch (block.kind) {
      case "header":
        return <TopElement doc={doc} palette={palette} look={look.top} />;
      case "heading":
        return <HeadingBar lang={doc.lang} title={block.title} look={heading} />;
      case "row":
        return <Row lang={doc.lang} label={block.row.label} value={block.row.value} note={block.row.note} multiline={block.row.multiline} look={rowLook(doc, palette, block.wide, underline)} />;
      case "paragraph":
        return <Paragraph lang={doc.lang} text={text ?? block.paragraph.text} label={block.showLabel && !continued ? block.paragraph.label : undefined} look={paragraph} />;
      case "photo":
        return photoEl ? <div style={{ display: "flex", justifyContent: "flex-end" }}>{photoEl}</div> : null;
      case "lead": {
        const { section } = block;
        const narrow = rowLook(doc, palette, false, underline);
        return (
          <div style={{ display: "flex", alignItems: "flex-start", gap: PHOTO_GAP }}>
            <div style={{ flex: "1 1 0", minWidth: 0 }}>
              <HeadingBar lang={doc.lang} title={section.title} look={heading} />
              {section.items.map((item) =>
                item.kind === "row" ? (
                  <Row lang={doc.lang} key={item.id} label={item.label} value={item.value} note={item.note} multiline={item.multiline} look={narrow} />
                ) : (
                  <Paragraph lang={doc.lang} key={item.id} text={item.text} label={section.items.length > 1 ? item.label : undefined} look={paragraph} />
                ),
              )}
            </div>
            {photoEl}
          </div>
        );
      }
    }
  }
  return { skeleton: "classic", pageBox: classicPageBoxFor(look), blocks: classicBlocks, BlockView: ClassicView };
}

/** Classic Gold's photo sizes: 3:4 → 200 × 267, tall 2:3 → 186 × 279. */
export const CLASSIC_PHOTO = { "3:4": 200, "2:3": 186 } as const;
