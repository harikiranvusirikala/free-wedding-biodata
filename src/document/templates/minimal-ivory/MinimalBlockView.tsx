import type { DocModel } from "@/biodata/document";
import { HeadingBar, type HeadingLook } from "../../blocks/HeadingBar";
import { Paragraph, type ParagraphLook } from "../../blocks/Paragraph";
import { Photo, photoHeight } from "../../blocks/Photo";
import { Row, type RowLook } from "../../blocks/Row";
import { isMotif, Motif } from "../../motifs";
import { mixedFontStack, scriptFamilies, textFontStack } from "../../scripts";
import { isLatin, relaxed, type Palette } from "../../tokens";
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

function Header({ doc, palette, photo, secondPhoto }: Pick<BlockViewProps, "doc" | "palette" | "photo" | "secondPhoto">) {
  // Step 2.0: the invocation line and a title of the user's own print in their own script (scripts.ts).
  const latin = isLatin(doc.lang) && !scriptFamilies(doc.title ?? "").length;
  const subtitle = minimalSubtitle(doc);
  return (
    // One band: the words on the left (motif and invocation, if chosen, above the title kicker, name and subtitle),
    // the photo on the right, centred against each other so no height is wasted.
    <div style={{ display: "flex", alignItems: "center", gap: 30, paddingBottom: relaxed("1.2em"), borderBottom: `1px solid ${palette.rule}` }}>
        <div style={{ flex: "1 1 0", minWidth: 0 }}>
          {isMotif(doc.motif) || doc.invocation ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.7em", paddingBottom: relaxed("0.8em") }}>
              <Motif id={doc.motif} ink={palette.ink} base={palette.inkBase} paper={palette.paper} size={44} />
              {doc.invocation ? (
                <div style={{ color: palette.label, fontFamily: mixedFontStack(doc.lang, doc.invocation), minWidth: 0, overflowWrap: "anywhere" }}>{doc.invocation}</div>
              ) : null}
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
                paddingBottom: relaxed("0.7em"),
                fontFamily: mixedFontStack(doc.lang, doc.title),
                overflowWrap: "anywhere",
              }}
            >
              {doc.title}
            </div>
          ) : null}
          {doc.name ? (
            <div style={{ color: palette.text, fontSize: "2.5em", lineHeight: 1.15, overflowWrap: "anywhere", fontFamily: textFontStack(doc.lang, doc.name) }}>{doc.name}</div>
          ) : null}
          {subtitle ? <div style={{ color: palette.label, paddingTop: relaxed("0.5em"), fontFamily: textFontStack(doc.lang, subtitle) }}>{subtitle}</div> : null}
        </div>
        {photo ? (
          // The second photo (Step 4.4) stands beside the main one at the same height, so the pair reads as one.
          <div style={{ display: "flex", gap: 10, flex: "none" }}>
            <Photo photo={photo} width={PHOTO_WIDTH[photo.frame]} radius={2} />
            {secondPhoto ? <Photo photo={secondPhoto} width={Math.round((photoHeight(photo.frame, PHOTO_WIDTH[photo.frame]) * 2) / 3)} radius={2} /> : null}
          </div>
        ) : null}
    </div>
  );
}

export function MinimalBlockView({ block, doc, palette, photo, secondPhoto, text, continued }: BlockViewProps) {
  switch (block.kind) {
    case "header":
      return <Header doc={doc} palette={palette} photo={photo} secondPhoto={secondPhoto} />;
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
    default:
      // Minimal has no lead or standalone photo block: the photo is in the header.
      return null;
  }
}
