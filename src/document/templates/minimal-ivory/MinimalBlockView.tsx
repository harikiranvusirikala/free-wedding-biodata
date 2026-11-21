import type { DocModel } from "@/biodata/document";
import { HeadingBar, type HeadingLook } from "../../blocks/HeadingBar";
import { Paragraph, type ParagraphLook } from "../../blocks/Paragraph";
import { Photo } from "../../blocks/Photo";
import { Row, type RowLook } from "../../blocks/Row";
import { Motif } from "../../motifs";
import { isLatin, type Palette } from "../../tokens";
import type { BlockViewProps } from "../types";
import { minimalSubtitle } from "./layout";

// The Minimal skeleton's drawings (VISION §7 Minimal Ivory, D34): pure typography. A small spaced kicker (the
// title), the name large, a quiet subtitle and the photo at the right over a hairline; section headings small and
// spaced in the accent colour over a hairline; labels in the muted colour without colons. A chosen motif sits
// small beside the invocation line, at the top left, rather than centred above everything.

const PHOTO_WIDTH = { "3:4": 126, "2:3": 116 } as const;

const heading = (doc: DocModel, p: Palette): HeadingLook => {
  const latin = isLatin(doc.lang);
  return {
    fill: "transparent",
    color: p.label,
    size: latin ? 0.84 : 1,
    weight: 700,
    padding: "0 0 0.4em 0",
    letterSpacing: latin ? "0.2em" : "0",
    uppercase: latin,
    underline: p.rule,
    after: "0.6em",
  };
};

const row = (doc: DocModel, p: Palette): RowLook => ({
  labelWidth: "12.5em",
  colon: false,
  labelColor: p.label,
  labelWeight: 400,
  valueColor: p.text,
  indent: "0",
  gap: "1em",
  after: "0.32em",
  uppercaseLabel: doc.labelCase === "upper" && isLatin(doc.lang),
});

const paragraph = (doc: DocModel, p: Palette): ParagraphLook => ({
  indent: "0",
  rule: p.rule,
  ruleWidth: 2,
  ruleGap: "0.9em",
  textColor: p.text,
  labelColor: p.label,
  uppercaseLabel: doc.labelCase === "upper" && isLatin(doc.lang),
  padTop: "0",
  padBottom: "0.32em",
});

function Header({ doc, palette, photo }: Pick<BlockViewProps, "doc" | "palette" | "photo">) {
  const latin = isLatin(doc.lang);
  const subtitle = minimalSubtitle(doc);
  return (
    // One band: the words on the left (motif and invocation, if chosen, above the title kicker, name and subtitle),
    // the photo on the right, centred against each other so no height is wasted.
    <div style={{ display: "flex", alignItems: "center", gap: 30, paddingBottom: "1.2em", borderBottom: `1px solid ${palette.rule}` }}>
        <div style={{ flex: "1 1 0", minWidth: 0 }}>
          {doc.motif || doc.invocation ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.7em", paddingBottom: "0.8em" }}>
              <Motif id={doc.motif} ink={palette.ink} base={palette.inkBase} size={44} />
              {doc.invocation ? <div style={{ color: palette.label }}>{doc.invocation}</div> : null}
            </div>
          ) : null}
          {doc.title ? (
            <div
              style={{
                color: palette.label,
                fontSize: latin ? "0.8em" : "0.95em",
                fontWeight: 700,
                letterSpacing: latin ? "0.3em" : 0,
                textTransform: latin ? "uppercase" : undefined,
                paddingBottom: "0.7em",
              }}
            >
              {doc.title}
            </div>
          ) : null}
          {doc.name ? (
            <div style={{ color: palette.text, fontSize: "2.5em", lineHeight: 1.15, overflowWrap: "anywhere" }}>{doc.name}</div>
          ) : null}
          {subtitle ? <div style={{ color: palette.label, paddingTop: "0.5em" }}>{subtitle}</div> : null}
        </div>
        {photo ? <Photo photo={photo} width={PHOTO_WIDTH[photo.frame]} radius={2} /> : null}
    </div>
  );
}

export function MinimalBlockView({ block, doc, palette, photo, text, continued }: BlockViewProps) {
  switch (block.kind) {
    case "header":
      return <Header doc={doc} palette={palette} photo={photo} />;
    case "heading":
      return <HeadingBar title={block.title} look={heading(doc, palette)} />;
    case "row":
      return <Row label={block.row.label} value={block.row.value} note={block.row.note} multiline={block.row.multiline} look={row(doc, palette)} />;
    case "paragraph":
      return (
        <Paragraph
          text={text ?? block.paragraph.text}
          label={block.showLabel && !continued ? block.paragraph.label : undefined}
          look={paragraph(doc, palette)}
        />
      );
    default:
      // Minimal has no lead or standalone photo block: the photo is in the header.
      return null;
  }
}
