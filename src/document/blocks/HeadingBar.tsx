import type { LangCode } from "@/biodata/types";
import { hasIndicScript, textFontStack } from "../scripts";
import { relaxed } from "../tokens";

// A section heading (D39 heading-bar styles): a filled bar with dark text (Classic) or a small spaced title over
// a hairline (Minimal). The fill and the hairline are a background and a bottom border, both of which the
// display list records as rectangles. A title of the user's own in another script than the page's gets that
// script's font, and no letter spacing (it would pull Indic clusters apart; scripts.ts).

export interface HeadingLook {
  fill: string;
  color: string;
  /** Font size in em of the body size. */
  size: number;
  weight: number;
  padding: string;
  letterSpacing: string;
  uppercase: boolean;
  /** A hairline under the heading: colour, or null. */
  underline: string | null;
  /** Its thickness in px (default 1; the underline bar style uses 2). */
  underlineWidth?: number;
  /** A 1 px outline all round the bar (the outline bar style; the display list draws it as the rect's stroke). */
  border?: string;
  /** The bar's corner radius in px, with `border`. */
  radius?: number;
  /** Space below the heading, before its first row. */
  after: string;
}

export function HeadingBar({ title, lang, look }: { title: string; lang: LangCode; look: HeadingLook }) {
  return (
    <div style={{ paddingBottom: relaxed(look.after) }}>
      <h2
        style={{
          margin: 0,
          padding: look.padding,
          background: look.fill,
          color: look.color,
          fontSize: `${look.size}em`,
          fontWeight: look.weight,
          lineHeight: 1.35,
          letterSpacing: hasIndicScript(title) ? 0 : look.letterSpacing,
          fontFamily: textFontStack(lang, title),
          textTransform: look.uppercase ? "uppercase" : undefined,
          borderBottom: look.border ? `1px solid ${look.border}` : look.underline ? `${look.underlineWidth ?? 1}px solid ${look.underline}` : undefined,
          ...(look.border ? { borderTop: `1px solid ${look.border}`, borderLeft: `1px solid ${look.border}`, borderRight: `1px solid ${look.border}`, borderRadius: look.radius } : null),
          overflowWrap: "anywhere",
        }}
      >
        {title}
      </h2>
    </div>
  );
}
