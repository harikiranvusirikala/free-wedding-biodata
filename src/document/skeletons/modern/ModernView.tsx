import type { DocModel } from "@/biodata/document";
import { HeadingBar, type HeadingLook } from "../../blocks/HeadingBar";
import { Paragraph, type ParagraphLook } from "../../blocks/Paragraph";
import { Photo, secondPhotoWidth } from "../../blocks/Photo";
import { Row, type RowLook } from "../../blocks/Row";
import { TopElement } from "../../blocks/TopElement";
import { hasIndicScript, textFontStack } from "../../scripts";
import { mix } from "../../frames/geometry";
import { SIDE_PANEL_WIDTH } from "../../frames/SidePanel";
import type { AsideProps, BlockViewProps } from "../../templates/types";
import { isLatin, VALUE_WEIGHT, type Palette } from "../../tokens";
import { modernSubtitle, SIDE_PAD, sideContact } from "./layout";

// The Modern skeleton's drawings (VISION D34, D46): a crisp two-column page. The side panel (page 1) holds the
// photo in a soft ring, the name large, designation · city, and the contact details as stacked label/value pairs;
// the main column has small spaced headings in the accent colour over a thin accent rule, and label/value rows
// with the colon aligned. No serif, no frame artwork: the colour panel is the design. Text in another script than
// the page's gets that script's font (scripts.ts).

/** The photo inside the panel: the panel's inner width less the 4 px ring on each side. */
const RING = 4;
const PHOTO_WIDTH = SIDE_PANEL_WIDTH - 2 * SIDE_PAD.x - 2 * RING;
/** The second photo: tall 2:3, a little smaller than the main one (152 × 228). */
const SECOND_WIDTH = secondPhotoWidth(PHOTO_WIDTH);

const sideColors = (p: Palette) => {
  const side = p.side ?? p.bar;
  const text = p.sideText ?? p.paper;
  return { side, text, muted: p.sideMuted ?? text, ring: mix(text, side, 0.8) };
};

const heading = (doc: DocModel, p: Palette): HeadingLook => {
  const latin = isLatin(doc.lang);
  return {
    fill: "transparent",
    color: p.barText,
    size: latin ? 0.88 : 1,
    weight: 700,
    padding: "0 0 0.4em 0",
    letterSpacing: latin ? "0.16em" : "0",
    uppercase: latin,
    underline: p.barRule ?? p.barText,
    underlineWidth: 1.5,
    after: "0.75em",
  };
};

const row = (doc: DocModel, p: Palette): RowLook => ({
  // Narrower than Classic's 15.5em: the main column is 456 px wide, and values need the room.
  labelWidth: "10em",
  colon: true,
  labelColor: p.label,
  labelWeight: 700,
  valueColor: p.text,
  indent: "0",
  gap: "0.9em",
  after: "0.42em",
  uppercaseLabel: doc.labelCase === "upper" && isLatin(doc.lang),
});

const paragraph = (doc: DocModel, p: Palette): ParagraphLook => ({
  indent: "0",
  rule: mix(p.barText, p.paper, 0.55),
  ruleWidth: 3,
  ruleGap: "0.85em",
  textColor: p.text,
  labelColor: p.label,
  uppercaseLabel: doc.labelCase === "upper" && isLatin(doc.lang),
  padTop: "0",
  padBottom: "0.42em",
});

export function ModernBlockView({ block, doc, palette, text, continued }: BlockViewProps) {
  switch (block.kind) {
    case "header":
      return <TopElement doc={doc} palette={palette} look={{ motifSize: 72, titleStyle: "rules", titleSize: 1.4 }} />;
    case "heading":
      return <HeadingBar lang={doc.lang} title={block.title} look={heading(doc, palette)} />;
    case "row":
      return <Row lang={doc.lang} label={block.row.label} value={block.row.value} note={block.row.note} multiline={block.row.multiline} look={row(doc, palette)} />;
    case "paragraph":
      return <Paragraph lang={doc.lang} text={text ?? block.paragraph.text} label={block.showLabel && !continued ? block.paragraph.label : undefined} look={paragraph(doc, palette)} />;
    default:
      // The photo is in the side panel: Modern has no lead or standalone photo block.
      return null;
  }
}

/** Page 1's side panel content (the panel itself is the frame, drawn on every page). */
const valueText = (item: { value: string; note?: string }) => (item.note ? `${item.value} (${item.note})` : item.value);

export function ModernAside({ doc, palette, photo, secondPhoto }: AsideProps) {
  const c = sideColors(palette);
  const latin = isLatin(doc.lang);
  const subtitle = modernSubtitle(doc);
  const second = photo ? secondPhoto : undefined;
  const contact = sideContact(doc, { secondPhoto: !!second });
  const upperLabels = doc.labelCase === "upper" && latin;
  const font = (text: string) => textFontStack(doc.lang, text);
  return (
    <div
      data-aside
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: SIDE_PANEL_WIDTH,
        boxSizing: "border-box",
        padding: `${SIDE_PAD.top}px ${SIDE_PAD.x}px ${SIDE_PAD.bottom}px`,
        color: c.text,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {photo ? (
        <div style={{ alignSelf: "flex-start", padding: RING, background: c.ring, borderRadius: 9 }}>
          <Photo photo={photo} width={PHOTO_WIDTH} radius={6} />
        </div>
      ) : null}
      {doc.name ? (
        <div style={{ fontSize: "1.75em", fontWeight: 700, lineHeight: 1.2, marginTop: photo ? "0.7em" : 0, overflowWrap: "anywhere", fontFamily: font(doc.name) }}>
          {doc.name}
        </div>
      ) : null}
      {subtitle ? (
        <div style={{ color: c.muted, fontSize: "0.92em", lineHeight: 1.4, marginTop: "0.45em", overflowWrap: "anywhere", fontFamily: font(subtitle) }}>{subtitle}</div>
      ) : null}
      {contact ? (
        <div style={{ marginTop: doc.name || subtitle || photo ? "2em" : 0 }}>
          <div
            style={{
              color: c.muted,
              fontSize: latin ? "0.78em" : "0.9em",
              fontWeight: 700,
              letterSpacing: latin && !hasIndicScript(contact.title) ? "0.16em" : 0,
              textTransform: latin ? "uppercase" : undefined,
              fontFamily: font(contact.title),
              paddingBottom: "0.5em",
              marginBottom: "0.8em",
              borderBottom: `1px solid ${c.ring}`,
            }}
          >
            {contact.title}
          </div>
          {contact.items.map((item) =>
            item.kind === "row" ? (
              <div key={item.id} style={{ paddingBottom: "0.65em" }}>
                {item.label ? (
                  <div style={{ color: c.muted, fontSize: "0.82em", fontWeight: 700, lineHeight: 1.35, textTransform: upperLabels ? "uppercase" : undefined, overflowWrap: "anywhere", fontFamily: font(item.label) }}>
                    {item.label}
                  </div>
                ) : null}
                <div style={{ fontSize: "0.94em", fontWeight: VALUE_WEIGHT, lineHeight: 1.4, overflowWrap: "anywhere", whiteSpace: item.multiline ? "pre-line" : undefined, fontFamily: font(valueText(item)) }}>
                  {valueText(item)}
                </div>
              </div>
            ) : null,
          )}
        </div>
      ) : null}
      {second ? (
        // The second photo (Step 4.4, D40) under the panel's text, a little smaller than the main one; the Contact
        // section stays in the panel only when it is short enough to leave room for it (layout.ts).
        <div style={{ alignSelf: "flex-start", padding: RING, background: c.ring, borderRadius: 9, marginTop: "1.6em", flex: "none" }}>
          <Photo photo={second} width={SECOND_WIDTH} radius={6} />
        </div>
      ) : null}
    </div>
  );
}
