import type { DocModel } from "@/biodata/document";
import { BesideLead, FlowItem } from "../blocks/BesideLead";
import { HeadingBar, type HeadingLook } from "../blocks/HeadingBar";
import { Paragraph, type ParagraphLook } from "../blocks/Paragraph";
import { Photo, secondPhotoWidth } from "../blocks/Photo";
import { Row, type RowLook } from "../blocks/Row";
import { TopElement, type TopElementLook } from "../blocks/TopElement";
import { classicBlocks, hasTopElement } from "../templates/classic-gold/layout";
import type { BlockViewProps, TemplateDef } from "../templates/types";
import { isLatin, SPACE, type Box, type Palette } from "../tokens";

// The Classic skeleton as data (VISION D34, D39; Step 4.3): Classic Gold's block list (an optional top element,
// heading bars with label/value rows, the photo beside the first section that starts with rows, the second photo
// beside a later one) drawn with a
// design's own look: its margins clear of its frame, its heading-bar style, photo size and title flourish. Every
// framed Classic design (Kalyanam, Temple Bells, Rangoli, Paisley, Royal Maroon, Deepam; Step 4.4's ten more) is
// `classicSkeleton(look)` plus a frame and three palettes. Classic Gold keeps its own drawing (the owner's
// reference, D29) on the same block list.

export interface ClassicLook {
  /**
   * Heading bars: a filled bar with `barText` (solid), `barText` over a 2 px `barRule` underline, or a pale filled
   * bar with a 1 px `barRule` outline and soft corners (outline, Peach Filigree).
   */
  bar: "solid" | "underline" | "outline";
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
    ...(look.bar === "outline" ? { border: p.barRule ?? p.rule, radius: 6 } : null),
    after: `${SPACE.afterHeading}em`,
  };
}

/** The label column of every row (rows beside the photo and full-width rows share one value column). */
const LABEL_WIDTH = "11em";

const rowLook = (doc: DocModel, p: Palette, underline: boolean): RowLook => ({
  // One value column on the whole page (owner, 2026-11-22): rows beside the photo and full-width rows line up.
  labelWidth: LABEL_WIDTH,
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
export function classicSkeleton(look: ClassicLook): Pick<TemplateDef, "skeleton" | "pageBox" | "blocks" | "BlockView" | "photoRadius"> {
  const underline = look.bar === "underline";
  function ClassicView({ block, doc, palette, photo, mainFrame, text, continued }: BlockViewProps) {
    const heading = headingLook(look, doc, palette);
    const paragraph = paragraphLook(doc, palette, underline);
    // The second photo (Step 4.4) beside a later section, a little smaller than the main one.
    const second = (block.kind === "lead" || block.kind === "photo") && !!block.second;
    // It sits in a column as wide as the main photo's, at its right, so the heading bars beside both end in line.
    const photoEl = !photo ? null : second ? (
      <div style={{ width: look.photoWidth[mainFrame ?? "3:4"], display: "flex", justifyContent: "flex-end", flex: "none" }}>
        <Photo photo={photo} width={secondPhotoWidth(look.photoWidth["2:3"])} radius={look.photoRadius} />
      </div>
    ) : (
      <Photo photo={photo} width={look.photoWidth[photo.frame]} radius={look.photoRadius} />
    );
    switch (block.kind) {
      case "header":
        return <TopElement doc={doc} palette={palette} look={look.top} />;
      case "heading":
        return <HeadingBar lang={doc.lang} title={block.title} look={heading} />;
      case "row":
        return <Row lang={doc.lang} label={block.row.label} value={block.row.value} note={block.row.note} multiline={block.row.multiline} look={rowLook(doc, palette, underline)} />;
      case "paragraph":
        return <Paragraph lang={doc.lang} text={text ?? block.paragraph.text} label={block.showLabel && !continued ? block.paragraph.label : undefined} look={paragraph} />;
      case "photo":
        return photoEl ? <div style={{ display: "flex", justifyContent: "flex-end" }}>{photoEl}</div> : null;
      case "lead": {
        const { section } = block;
        const narrow = rowLook(doc, palette, underline);
        return (
          // The photo floats at the top right; the heading and rows narrow beside it and take the full width below it.
          <BesideLead photo={photoEl} gap={PHOTO_GAP}>
            <FlowItem>
              <HeadingBar lang={doc.lang} title={section.title} look={heading} />
            </FlowItem>
            {section.items.map((item) =>
              item.kind === "row" ? (
                <FlowItem key={item.id}>
                  <Row lang={doc.lang} label={item.label} value={item.value} note={item.note} multiline={item.multiline} look={narrow} />
                </FlowItem>
              ) : (
                <FlowItem key={item.id}>
                  <Paragraph lang={doc.lang} text={item.text} label={section.items.length > 1 ? item.label : undefined} look={paragraph} />
                </FlowItem>
              ),
            )}
          </BesideLead>
        );
      }
    }
  }
  return { skeleton: "classic", pageBox: classicPageBoxFor(look), blocks: classicBlocks, BlockView: ClassicView, photoRadius: look.photoRadius };
}

/** Classic's photo sizes: 3:4 → 224 × 299, tall 2:3 → 208 × 312 (the owner's request, 2026-11-22). */
export const CLASSIC_PHOTO = { "3:4": 224, "2:3": 208 } as const;
