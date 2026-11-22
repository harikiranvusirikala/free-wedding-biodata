import type { CSSProperties } from "react";
import type { LangCode } from "@/biodata/types";
import { textFontStack } from "../scripts";
import { relaxed } from "../tokens";

// A label/value row (BUILD_PLAN A4): the label in a fixed column, the value wrapping beside it. Used for fields,
// the computed age and family members (relation : details, D28), so it is also the "family row". User text is
// always a text node, never HTML. One text node per cell, so the display list reads each as one run. A label or
// value in another script than the page's gets that script's font (scripts.ts), so it prints as typed.

export interface RowLook {
  /** Width of the label column, any CSS length (em, so it scales with the text size). */
  labelWidth: string;
  /** Print " :" after the label (Classic), or nothing (Minimal). */
  colon: boolean;
  labelColor: string;
  labelWeight: number;
  valueColor: string;
  /** Left indent of the row. */
  indent: string;
  /** Space between the label column and the value. */
  gap: string;
  /** Space below the row. */
  after: string;
  uppercaseLabel: boolean;
}

export function Row({
  label,
  value,
  note,
  multiline,
  lang,
  look,
}: {
  label: string;
  value: string;
  note?: string;
  multiline?: boolean;
  /** The page's document language. */
  lang: LangCode;
  look: RowLook;
}) {
  const labelText = label ? (look.colon ? `${label} :` : label) : "";
  const valueText = note ? `${value} (${note})` : value;
  const labelStyle: CSSProperties = {
    flex: `0 0 ${look.labelWidth}`,
    boxSizing: "border-box",
    paddingRight: look.gap,
    fontWeight: look.labelWeight,
    color: look.labelColor,
    overflowWrap: "anywhere",
    textTransform: look.uppercaseLabel ? "uppercase" : undefined,
    fontFamily: textFontStack(lang, labelText),
  };
  const valueStyle: CSSProperties = {
    flex: "1 1 0",
    minWidth: 0,
    color: look.valueColor,
    overflowWrap: "anywhere",
    whiteSpace: multiline ? "pre-line" : undefined,
    fontFamily: textFontStack(lang, valueText),
  };
  return (
    <div style={{ display: "flex", alignItems: "baseline", paddingLeft: look.indent, paddingBottom: relaxed(look.after) }}>
      <div style={labelStyle}>{labelText}</div>
      <div style={valueStyle}>{valueText}</div>
    </div>
  );
}
