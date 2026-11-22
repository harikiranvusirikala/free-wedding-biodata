import type { Palette } from "../tokens";
import { H, mix, W } from "./geometry";
import { useFrameId } from "./svg";

// A soft gradient wash over the whole paper (VISION D51, Step 4.4): the paper deepens a little towards the top and
// bottom edges in the palette's pale `soft` tint and stays plain through the middle, where most text sits. A
// vertical linear gradient on one page-sized rect, so the PDF draws it as a real shading (no raster, no opacity).
// Drawn first inside a frame's FrameSvg; a frame that hides its rules behind an ornament paints the backing with
// `washAt` so it matches the wash. Every text colour must read on each stop as well as on the paper (designs.test).

const OFFSETS = [0, 0.3, 0.72, 1] as const;

/** The wash's colours at OFFSETS, top to bottom: the top edge, the plain middle (twice), the bottom edge. */
export function washStops(p: Palette): readonly [string, string, string, string] {
  const soft = p.soft ?? p.inkBase;
  return [mix(p.paper, soft, 0.7), p.paper, p.paper, mix(p.paper, soft, 0.5)];
}

/** The wash's colour at height y (px from the top of the page). */
export function washAt(p: Palette, y: number): string {
  const stops = washStops(p);
  const t = Math.min(1, Math.max(0, y / H));
  let i = 0;
  while (i < OFFSETS.length - 2 && t > OFFSETS[i + 1]) i++;
  return mix(stops[i], stops[i + 1], (t - OFFSETS[i]) / (OFFSETS[i + 1] - OFFSETS[i]));
}

export function PaperWash({ palette }: { palette: Palette }) {
  const id = useFrameId("wash");
  const stops = washStops(palette);
  return (
    <>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={H}>
          {stops.map((c, i) => (
            <stop key={i} offset={OFFSETS[i]} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${id})`} />
    </>
  );
}
