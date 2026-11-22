import type { DocModel } from "@/biodata/document";
import { mix } from "../frames/geometry";
import { Motif } from "../motifs";
import { mixedFontStack, scriptFamilies, textFontStack } from "../scripts";
import { minimalSubtitle } from "../templates/minimal-ivory/layout";
import { isLatin, relaxed, type Palette } from "../tokens";
import { Invocation } from "./TopElement";

// A large-name letterhead (VISION D44: 9 of 32 real biodatas head the page with the name; Sandalwood, D46): the
// invocation and motif when chosen, the title as a small spaced kicker, the name large in spaced capitals,
// designation · city under it, and a fine double rule with a small diamond across the width. Centred. Drawn
// with boxes and one small SVG, so the PDF draws it exactly; text in another script gets its font (scripts.ts).

export interface LetterheadLook {
  /** Motif size in px when one is chosen. */
  motifSize: number;
  /** The name's size in em of the body size (Latin; Indic names get a little more). */
  nameSize: number;
}

/** The ornament in the middle of the rule: a diamond between two dots. */
function RuleOrnament({ color }: { color: string }) {
  return (
    <svg width="34" height="10" viewBox="0 0 34 10" aria-hidden style={{ display: "block", flex: "none" }}>
      <path d="M17 0.5L21.5 5L17 9.5L12.5 5Z" fill={color} />
      <path d="M5.4 5a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0ZM25.4 5a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0Z" fill={color} />
    </svg>
  );
}

export function Letterhead({ doc, palette, look }: { doc: DocModel; palette: Palette; look: LetterheadLook }) {
  const latinPage = isLatin(doc.lang);
  const latinTitle = latinPage && !scriptFamilies(doc.title ?? "").length;
  const latinName = latinPage && !scriptFamilies(doc.name ?? "").length;
  const subtitle = minimalSubtitle(doc);
  const rule = mix(palette.rule, palette.paper, 0.15);
  // A fine double rule each side of the ornament: a 1.2 px line over a 0.7 px one.
  const line = (height: number) => <div aria-hidden style={{ height, background: rule }} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: relaxed("0.3em"), paddingBottom: relaxed("0.1em") }}>
      <Invocation doc={doc} palette={palette} />
      <Motif id={doc.motif} ink={palette.ink} base={palette.inkBase} paper={palette.paper} size={look.motifSize} />
      {doc.title ? (
        <div
          style={{
            color: palette.label,
            fontWeight: 700,
            fontSize: latinTitle ? "0.82em" : "1em",
            letterSpacing: latinTitle ? "0.34em" : 0,
            marginRight: latinTitle ? "-0.34em" : 0,
            textTransform: latinTitle ? "uppercase" : undefined,
            fontFamily: mixedFontStack(doc.lang, doc.title),
            overflowWrap: "anywhere",
          }}
        >
          {doc.title}
        </div>
      ) : null}
      {doc.name ? (
        <div
          style={{
            color: palette.label,
            fontWeight: 700,
            fontSize: `${latinName ? look.nameSize : look.nameSize + 0.15}em`,
            lineHeight: 1.2,
            letterSpacing: latinName ? "0.07em" : 0,
            marginRight: latinName ? "-0.07em" : 0,
            textTransform: latinName ? "uppercase" : undefined,
            fontFamily: textFontStack(doc.lang, doc.name),
            overflowWrap: "anywhere",
          }}
        >
          {doc.name}
        </div>
      ) : null}
      {subtitle ? <div style={{ color: palette.text, fontSize: "1.02em", fontFamily: textFontStack(doc.lang, subtitle), overflowWrap: "anywhere" }}>{subtitle}</div> : null}
      <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", marginTop: relaxed("0.45em") }}>
        <div style={{ flex: "1 1 0", display: "flex", flexDirection: "column", gap: 2 }}>
          {line(1.2)}
          {line(0.7)}
        </div>
        <RuleOrnament color={palette.rule} />
        <div style={{ flex: "1 1 0", display: "flex", flexDirection: "column", gap: 2 }}>
          {line(1.2)}
          {line(0.7)}
        </div>
      </div>
    </div>
  );
}
