// A section heading (D39 heading-bar styles): a filled bar with dark text (Classic) or a small spaced title over
// a hairline (Minimal). The fill and the hairline are a background and a bottom border, both of which the
// display list records as rectangles.

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
  /** Space below the heading, before its first row. */
  after: string;
}

export function HeadingBar({ title, look }: { title: string; look: HeadingLook }) {
  return (
    <div style={{ paddingBottom: look.after }}>
      <h2
        style={{
          margin: 0,
          padding: look.padding,
          background: look.fill,
          color: look.color,
          fontSize: `${look.size}em`,
          fontWeight: look.weight,
          lineHeight: 1.35,
          letterSpacing: look.letterSpacing,
          textTransform: look.uppercase ? "uppercase" : undefined,
          borderBottom: look.underline ? `1px solid ${look.underline}` : undefined,
          overflowWrap: "anywhere",
        }}
      >
        {title}
      </h2>
    </div>
  );
}
