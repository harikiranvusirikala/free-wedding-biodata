import { useId, type ReactNode } from "react";
import type { Palette } from "../tokens";
import { darken, H, isDark, lighten, W } from "./geometry";

// What every illustrated frame shares (Step 4.3): the page-sized SVG it draws in, the palette colours it uses and
// a stroke helper. Frames sit behind the content box; each design's margins keep its text clear of the artwork.

/** The page-sized SVG behind the content (A4 at 96 px per inch, the display list's space). */
export function FrameSvg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden style={{ position: "absolute", inset: 0, display: "block" }}>
      {children}
    </svg>
  );
}

/** A gradient id unique to this frame instance (two pages never share an id; the display list renames them). */
export function useFrameId(prefix: string): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
}

/** The ornament colours a frame draws with: main line, second colour, pale tint, the paper, and whether it's dark. */
export function ornament(p: Palette) {
  return { line: p.rule, accent: p.accent ?? p.label, soft: p.soft ?? p.inkBase, paper: p.paper, dark: isDark(p.paper) };
}

/** Fill-less round-capped stroke attributes. */
export const stroke = (color: string, width: number) =>
  ({ fill: "none", stroke: color, strokeWidth: width, strokeLinecap: "round", strokeLinejoin: "round" }) as const;

/** A sideways metallic gradient for gold-like solids (bells, lamps, filigree). */
export function Metal({ id, color, dark }: { id: string; color: string; dark: boolean }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor={darken(color, 0.18)} />
      <stop offset="0.42" stopColor={lighten(color, dark ? 0.3 : 0.38)} />
      <stop offset="0.6" stopColor={color} />
      <stop offset="1" stopColor={darken(color, 0.22)} />
    </linearGradient>
  );
}
