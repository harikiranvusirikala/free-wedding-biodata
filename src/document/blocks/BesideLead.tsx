import type { ReactNode } from "react";

// A section that stands beside its photo (Classic, owner's request 2026-11-22): the photo floats at the top right and
// each heading and row is its own block-formatting root, so a line is narrowed only while it sits beside the photo,
// and everything below the photo's bottom takes the full line width (rows used to stay narrow beside it). The whole
// section is still one measured block, so pagination is unchanged.

/** The section: `photo` floats right, `gap` clears it from the text. */
export function BesideLead({ photo, gap, children }: { photo: ReactNode; gap: number; children: ReactNode }) {
  return (
    <div style={{ display: "flow-root" }}>
      <div style={{ float: "right", marginLeft: gap }}>{photo}</div>
      {children}
    </div>
  );
}

/** One heading, row or paragraph of a beside-the-photo section: narrowed beside the photo, full width below it. */
export function FlowItem({ children }: { children: ReactNode }) {
  return <div style={{ display: "flow-root" }}>{children}</div>;
}
