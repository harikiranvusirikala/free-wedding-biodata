import type { ComponentType, ReactNode } from "react";
import type { LangCode } from "@/biodata/types";
import { fontStack, LINE_HEIGHT, PAGE, type Box, type Palette } from "./tokens";

// One A4 page (BUILD_PLAN A4): a fixed 794 × 1123 px box on the template's paper, the frame artwork behind, and
// the content box at the template's margins. Marked data-page and lang, so the display-list reader
// (src/pdf-spike/display-list.ts, the Download engine's input, D49) reads it unchanged; print prints one per sheet.

export function Page({
  lang,
  palette,
  Frame,
  box,
  bodyPx,
  number,
  children,
}: {
  lang: LangCode;
  palette: Palette;
  Frame?: ComponentType<{ palette: Palette }>;
  box: Box;
  bodyPx: number;
  number: number;
  children: ReactNode;
}) {
  return (
    <article
      className="doc-page"
      data-page={number}
      lang={lang}
      style={{
        position: "relative",
        width: PAGE.width,
        height: PAGE.height,
        overflow: "hidden",
        flex: "none",
        background: palette.paper,
        color: palette.text,
        fontFamily: fontStack(lang),
        fontSize: bodyPx,
        lineHeight: LINE_HEIGHT,
        textAlign: "left",
      }}
    >
      {Frame ? <Frame palette={palette} /> : null}
      <div
        data-content
        style={{ position: "absolute", top: box.top, left: box.left, right: box.right, bottom: box.bottom, display: "flex", flexDirection: "column" }}
      >
        {children}
      </div>
    </article>
  );
}
