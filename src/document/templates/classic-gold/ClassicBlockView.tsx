import type { DocModel, DocRow } from "@/biodata/document";
import { HeadingBar, type HeadingLook } from "../../blocks/HeadingBar";
import { Paragraph, type ParagraphLook } from "../../blocks/Paragraph";
import { Photo } from "../../blocks/Photo";
import { Row, type RowLook } from "../../blocks/Row";
import { Invocation } from "../../blocks/TopElement";
import { Motif, tint } from "../../motifs";
import { mixedFontStack, scriptFamilies } from "../../scripts";
import { isLatin, SPACE, type Palette } from "../../tokens";
import type { BlockViewProps } from "../types";

// The Classic skeleton's drawings (VISION §7 Classic Gold, D29, D34), proportioned on the owner's reference:
// amber heading bars with bold dark text, bold warm-brown labels followed by " :", near-black values, the photo
// top-right beside the first section with soft corners, and an optional centred top element. Sizes are in em
// of the body size (tokens.ts), so the Auto text size scales everything but the frame, motif and photo.

/** Photo width in px: 3:4 → 200 × 267; tall 2:3 → 186 × 279. */
const PHOTO_WIDTH = { "3:4": 200, "2:3": 186 } as const;
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

const row = (doc: DocModel, p: Palette, wide: boolean): RowLook => ({
  labelWidth: wide ? "15.5em" : "11em",
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.35em", paddingBottom: "0.2em", textAlign: "center" }}>
      <Invocation doc={doc} palette={palette} />
      <Motif id={doc.motif} ink={palette.ink} base={palette.inkBase} size={MOTIF_SIZE} />
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

function Rows({ rows, doc, palette, wide }: { rows: DocRow[]; doc: DocModel; palette: Palette; wide: boolean }) {
  const look = row(doc, palette, wide);
  return rows.map((r) => <Row lang={doc.lang} key={r.id} label={r.label} value={r.value} note={r.note} multiline={r.multiline} look={look} />);
}

export function ClassicBlockView({ block, doc, palette, photo, text, continued }: BlockViewProps) {
  switch (block.kind) {
    case "header":
      return <TopElement doc={doc} palette={palette} />;
    case "heading":
      return <HeadingBar lang={doc.lang} title={block.title} look={heading(doc, palette)} />;
    case "row":
      return <Row lang={doc.lang} label={block.row.label} value={block.row.value} note={block.row.note} multiline={block.row.multiline} look={row(doc, palette, block.wide)} />;
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
          <Photo photo={photo} width={PHOTO_WIDTH[photo.frame]} radius={10} />
        </div>
      ) : null;
    case "lead": {
      const { section } = block;
      return (
        <div style={{ display: "flex", alignItems: "flex-start", gap: PHOTO_GAP }}>
          <div style={{ flex: "1 1 0", minWidth: 0 }}>
            <HeadingBar lang={doc.lang} title={section.title} look={heading(doc, palette)} />
            {section.items.map((item) =>
              item.kind === "row" ? (
                <Rows key={item.id} rows={[item]} doc={doc} palette={palette} wide={false} />
              ) : (
                <Paragraph lang={doc.lang} key={item.id} text={item.text} label={section.items.length > 1 ? item.label : undefined} look={paragraph(doc, palette)} />
              ),
            )}
          </div>
          {photo ? <Photo photo={photo} width={PHOTO_WIDTH[photo.frame]} radius={10} /> : null}
        </div>
      );
    }
  }
}
