import type { CSSProperties } from "react";

// A paragraph block (About me, Partner expectations, §6 "printed as a short quoted block"): an optional label,
// then the text beside a thin quote rule. The text element is marked data-lines: the measure step counts its
// lines and the paginator splits it between them; a continued piece gets only its own lines as `text`.
// The rule is a filled box (not a CSS border) so the display list records it as a rectangle.

export interface ParagraphLook {
  indent: string;
  /** Colour of the quote rule, or null for none. */
  rule: string | null;
  /** Rule width in px and the gap from rule to text. */
  ruleWidth: number;
  ruleGap: string;
  textColor: string;
  labelColor: string;
  uppercaseLabel: boolean;
  padTop: string;
  padBottom: string;
}

export function Paragraph({ text, label, look }: { text: string; label?: string; look: ParagraphLook }) {
  const labelStyle: CSSProperties = {
    paddingLeft: look.indent,
    paddingBottom: "0.15em",
    fontWeight: 700,
    color: look.labelColor,
    textTransform: look.uppercaseLabel ? "uppercase" : undefined,
  };
  return (
    <div style={{ paddingTop: look.padTop, paddingBottom: look.padBottom }}>
      {label ? <div style={labelStyle}>{label}</div> : null}
      <div style={{ position: "relative", marginLeft: look.indent, paddingLeft: look.rule ? `calc(${look.ruleWidth}px + ${look.ruleGap})` : 0 }}>
        {look.rule ? (
          <div aria-hidden style={{ position: "absolute", left: 0, top: "0.2em", bottom: "0.2em", width: look.ruleWidth, background: look.rule }} />
        ) : null}
        <p data-lines style={{ margin: 0, color: look.textColor, whiteSpace: "pre-line", overflowWrap: "anywhere" }}>
          {text}
        </p>
      </div>
    </div>
  );
}
