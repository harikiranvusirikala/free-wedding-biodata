import type { CSSProperties } from "react";

// A label/value row (BUILD_PLAN A4): the label in a fixed column, the value wrapping beside it. Used for fields,
// the computed age and family members (relation : details, D28), so it is also the "family row". User text is
// always a text node, never HTML. One text node per cell, so the display list reads each as one run.

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

export function Row({ label, value, note, multiline, look }: { label: string; value: string; note?: string; multiline?: boolean; look: RowLook }) {
  const labelStyle: CSSProperties = {
    flex: `0 0 ${look.labelWidth}`,
    boxSizing: "border-box",
    paddingRight: look.gap,
    fontWeight: look.labelWeight,
    color: look.labelColor,
    overflowWrap: "anywhere",
    textTransform: look.uppercaseLabel ? "uppercase" : undefined,
  };
  const valueStyle: CSSProperties = {
    flex: "1 1 0",
    minWidth: 0,
    color: look.valueColor,
    overflowWrap: "anywhere",
    whiteSpace: multiline ? "pre-line" : undefined,
  };
  return (
    <div style={{ display: "flex", alignItems: "baseline", paddingLeft: look.indent, paddingBottom: look.after }}>
      <div style={labelStyle}>{label ? (look.colon ? `${label} :` : label) : ""}</div>
      <div style={valueStyle}>{note ? `${value} (${note})` : value}</div>
    </div>
  );
}
