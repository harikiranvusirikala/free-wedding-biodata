import type { DocModel, DocRow } from "@/biodata/document";
import { BesideLead, FlowItem } from "../../blocks/BesideLead";
import { HeadingBar, type HeadingLook } from "../../blocks/HeadingBar";
import { Paragraph, type ParagraphLook } from "../../blocks/Paragraph";
import { Photo, secondPhotoWidth } from "../../blocks/Photo";
import { Row, type RowLook } from "../../blocks/Row";
import { Invocation } from "../../blocks/TopElement";
import { Motif, tint } from "../../motifs";
import { mixedFontStack, scriptFamilies } from "../../scripts";
import { isLatin, relaxed, SPACE, type Palette } from "../../tokens";
import type { BlockViewProps } from "../types";

// The Classic skeleton's drawings (VISION §7 Classic Gold, D29, D34), proportioned on the owner's reference:
// amber heading bars with bold dark text, bold warm-brown labels followed by " :", near-black values, the photo
// top-right beside the first section with soft corners, and an optional centred top element. Sizes are in em
// of the body size (tokens.ts), so the Auto text size scales everything but the frame, motif and photo.

/** Photo width in px: 3:4 → 224 × 299; tall 2:3 → 208 × 312 (owner, 2026-11-22: a little larger than the original, smaller than the first try). */
const PHOTO_WIDTH = { "3:4": 224, "2:3": 208 } as const;
/** The second photo (Step 4.4, D40), beside a later section: tall 2:3, a little smaller (149 × 224). */
const SECOND_WIDTH = secondPhotoWidth(PHOTO_WIDTH["2:3"]);
const PHOTO_GAP = 24;
const MOTIF_SIZE = 96;

const heading = (doc: DocModel, p: Palette): HeadingLook => ({
  fill: p.bar,
  color: p.barText,
  size: 1.1,
  weight: 700,
  padding: "0.3em 0.72em",
  letterSpacing: isLatin(doc.lang) ? "0.035em" : "0",
  uppercase: isLatin(doc.lang),
  underline: null,
  after: `${SPACE.afterHeading}em`,
});

/** The label column of every row (rows beside the photo and full-width rows share one value column). */
const LABEL_WIDTH = "11em";

const row = (doc: DocModel, p: Palette): RowLook => ({
  // One value column on the whole page (owner, 2026-11-22): rows beside the photo and full-width rows line up.
  labelWidth: LABEL_WIDTH,
  colon: true,
  labelColor: p.label,
  labelWeight: 700,
  valueColor: p.text,
  indent: `${SPACE.indent}em`,
  gap: `${SPACE.labelGap}em`,
  after: `${SPACE.row}em`,
  uppercaseLabel: doc.labelCase === "upper" && isLatin(doc.lang),
});

const paragraph = (doc: DocModel, p: Palette): ParagraphLook => ({
  indent: `${SPACE.indent}em`,
  rule: p.label,
  ruleWidth: 3,
  ruleGap: "0.8em",
  textColor: p.text,
  labelColor: p.label,
  uppercaseLabel: doc.labelCase === "upper" && isLatin(doc.lang),
  padTop: "0.05em",
  padBottom: `${SPACE.row}em`,
});

function TopElement({ doc, palette }: { doc: DocModel; palette: Palette }) {
  // Step 2.0: the invocation line and a title of the user's own print in their own script on any page (scripts.ts),
  // and only Latin titles get spaced capitals.
  const latin = isLatin(doc.lang) && !scriptFamilies(doc.title ?? "").length;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: relaxed("0.35em"), paddingBottom: relaxed("0.2em"), textAlign: "center" }}>
      <Invocation doc={doc} palette={palette} />
      <Motif id={doc.motif} ink={palette.ink} base={palette.inkBase} paper={palette.paper} size={MOTIF_SIZE} />
      {doc.title ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.7em", width: "100%" }}>
          <div aria-hidden style={{ width: 72, height: 1.5, background: tint(palette.label, 0.35), flex: "none" }} />
          <div
            style={{
              color: palette.label,
              fontWeight: 700,
              fontSize: latin ? "1.6em" : "1.75em",
              letterSpacing: latin ? "0.24em" : 0,
              textTransform: latin ? "uppercase" : undefined,
              lineHeight: 1.3,
              // Letter spacing adds space after the last letter too; shift it back so the title is centred.
              marginRight: latin ? "-0.24em" : 0,
              fontFamily: mixedFontStack(doc.lang, doc.title),
              overflowWrap: "anywhere",
            }}
          >
            {doc.title}
          </div>
          <div aria-hidden style={{ width: 72, height: 1.5, background: tint(palette.label, 0.35), flex: "none" }} />
        </div>
      ) : null}
    </div>
  );
}

function Rows({ rows, doc, palette }: { rows: DocRow[]; doc: DocModel; palette: Palette }) {
  const look = row(doc, palette);
  return rows.map((r) => <Row lang={doc.lang} key={r.id} label={r.label} value={r.value} note={r.note} multiline={r.multiline} look={look} />);
}

export function ClassicBlockView({ block, doc, palette, photo, mainFrame, text, continued }: BlockViewProps) {
  switch (block.kind) {
    case "header":
      return <TopElement doc={doc} palette={palette} />;
    case "heading":
      return <HeadingBar lang={doc.lang} title={block.title} look={heading(doc, palette)} />;
    case "row":
      return <Row lang={doc.lang} label={block.row.label} value={block.row.value} note={block.row.note} multiline={block.row.multiline} look={row(doc, palette)} />;
    case "paragraph":
      return (
        <Paragraph
          lang={doc.lang}
          text={text ?? block.paragraph.text}
          label={block.showLabel && !continued ? block.paragraph.label : undefined}
          look={paragraph(doc, palette)}
        />
      );
    case "photo":
      return photo ? (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Photo photo={photo} width={block.second ? SECOND_WIDTH : PHOTO_WIDTH[photo.frame]} radius={10} />
        </div>
      ) : null;
    case "lead": {
      const { section } = block;
      const width = block.second ? SECOND_WIDTH : photo ? PHOTO_WIDTH[photo.frame] : 0;
      // The photo floats at the top right; the heading and rows narrow beside it and take the full width below it.
      const picture =
          photo && block.second ? (
            // The second photo's column is as wide as the main photo's, so the heading bars beside both end in line.
            <div style={{ width: PHOTO_WIDTH[mainFrame ?? "3:4"], display: "flex", justifyContent: "flex-end" }}>
              <Photo photo={photo} width={width} radius={10} />
            </div>
          ) : photo ? (
            <Photo photo={photo} width={width} radius={10} />
          ) : null;
        return (
          <BesideLead photo={picture} gap={PHOTO_GAP}>
            <FlowItem>
              <HeadingBar lang={doc.lang} title={section.title} look={heading(doc, palette)} />
            </FlowItem>
            {section.items.map((item) =>
              item.kind === "row" ? (
                <FlowItem key={item.id}>
                  <Rows rows={[item]} doc={doc} palette={palette} />
                </FlowItem>
              ) : (
                <FlowItem key={item.id}>
                  <Paragraph lang={doc.lang} text={item.text} label={section.items.length > 1 ? item.label : undefined} look={paragraph(doc, palette)} />
                </FlowItem>
              ),
            )}
          </BesideLead>
        );
    }
  }
}
