import type { DocModel } from "@/biodata/document";
import { invocationParts } from "@/biodata/invocations";
import { mix } from "../frames/geometry";
import { Motif } from "../motifs";
import { mixedFontStack, scriptFamilies } from "../scripts";
import { isLatin, relaxed, type Palette } from "../tokens";

// The top of page 1 (VISION D21, D39, D45), shared by the Step 4.3 designs: the invocation line, the chosen motif
// and the title, centred (an invocation of 2-4 parts joined by " · " is spread left, centre, right, as families print
// the Telugu trio), each only when the user picked it (nothing by default, never inferred). The motif takes
// the template's colours; the title sits between thin flourishes, drawn as SVG (plain rules, or rules ending in a
// small diamond) so the PDF draws them exactly. Latin titles are spaced capitals; Indic titles keep their shaping.
// An invocation or title in another script than the page's gets that script's font first (scripts.ts, Step 2.0).

export type TitleStyle = "rules" | "diamonds";

export interface TopElementLook {
  motifSize: number;
  titleStyle: TitleStyle;
  /** Font size of the title in em of the body size (Latin; Indic titles get a little more). */
  titleSize?: number;
}

const FLOURISH = 72;

function Flourish({ color, style, side }: { color: string; style: TitleStyle; side: "left" | "right" }) {
  const tip = side === "left" ? FLOURISH - 4 : 4;
  return (
    <svg width={FLOURISH} height="8" viewBox={`0 0 ${FLOURISH} 8`} aria-hidden style={{ display: "block", flex: "none" }}>
      <path d={`M0 4H${FLOURISH}`} stroke={color} strokeWidth="1.5" fill="none" />
      {style === "diamonds" ? <path d={`M${tip} 0.5L${tip + 3.5} 4L${tip} 7.5L${tip - 3.5} 4Z`} fill={color} /> : null}
    </svg>
  );
}

/**
 * The invocation line above the motif: centred, or, for a line of 2-4 parts joined by " · " (the Telugu trio
 * "శ్రీరస్తు · శుభమస్తు · అవిఘ్నమస్తు"), spread across the width with each part centred in an equal column, so the
 * middle part sits over the motif.
 */
export function Invocation({ doc, palette }: { doc: DocModel; palette: Palette }) {
  const parts = invocationParts(doc.invocation ?? "");
  if (!parts.length) return null;
  const text = {
    color: palette.label,
    fontWeight: 700,
    fontSize: "1.15em",
    lineHeight: 1.4,
    fontFamily: mixedFontStack(doc.lang, doc.invocation ?? ""),
  } as const;
  if (parts.length === 1) return <div style={{ ...text, overflowWrap: "anywhere" }}>{parts[0]}</div>;
  return (
    <div data-invocation-parts={parts.length} style={{ ...text, display: "flex", width: "100%" }}>
      {parts.map((part, i) => (
        <div key={i} style={{ flex: "1 1 0", minWidth: 0, overflowWrap: "anywhere" }}>
          {part}
        </div>
      ))}
    </div>
  );
}

export function TopElement({ doc, palette, look }: { doc: DocModel; palette: Palette; look: TopElementLook }) {
  // Only a Latin title gets spaced capitals (a title in another script keeps its shaping, as in Classic Gold).
  const latin = isLatin(doc.lang) && !scriptFamilies(doc.title ?? "").length;
  const size = look.titleSize ?? 1.6;
  const flourish = mix(palette.label, palette.paper, 0.45);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: relaxed("0.35em"), paddingBottom: relaxed("0.2em"), textAlign: "center" }}>
      <Invocation doc={doc} palette={palette} />
      <Motif id={doc.motif} ink={palette.ink} base={palette.inkBase} paper={palette.paper} size={look.motifSize} />
      {doc.title ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.7em", width: "100%" }}>
          <Flourish color={flourish} style={look.titleStyle} side="left" />
          <div
            style={{
              color: palette.label,
              fontWeight: 700,
              fontSize: `${latin ? size : size + 0.15}em`,
              letterSpacing: latin ? "0.24em" : 0,
              textTransform: latin ? "uppercase" : undefined,
              lineHeight: 1.3,
              fontFamily: mixedFontStack(doc.lang, doc.title),
              // Letter spacing adds space after the last letter too; shift it back so the title is centred.
              marginRight: latin ? "-0.24em" : 0,
              overflowWrap: "anywhere",
            }}
          >
            {doc.title}
          </div>
          <Flourish color={flourish} style={look.titleStyle} side="right" />
        </div>
      ) : null}
    </div>
  );
}
