import type { Palette } from "../tokens";
import { CORNERS, darken, H, MY, rev, spiral, taper, W } from "./geometry";
import { FiligreeCorner, sideRules, type FiligreeOptions } from "./Filigree";
import { PaperWash, washAt } from "./paper-wash";
import { FrameSvg, Metal, ornament, stroke, useFrameId } from "./svg";

// The baroque frame family (Baroque Gold, VISION D46, D51): the filigree corner (frames/Filigree) drawn larger and
// heavier, with acanthus fronds on its scrolls and an echo line, over a gold double rule, and a small scroll
// cartouche with a jewel at the middle of the top and bottom edges, on a soft paper wash. Our own drawing, ported
// from the mockup library (docs/mockups/assets/frames.js, "baroque"). Scrolls and fronds are filled with a sideways
// metal gradient of `rule`; the fronds' veins are a darker `rule`, the jewels `accent`.
//
// Each corner reaches 210 px along the edges and 49 px in from them (61 px along the diagonal); the rules sit at
// 23.1 and 29.5 px, the cartouches within 31 px of the edge and 20 px of the centre line.

const OPTIONS: FiligreeOptions = { k: 1.05, w: 1.15, leaves: true, step: 3.4 };

const CARTOUCHE = taper(rev(spiral(-14, 2, 5, 1.3, 0, 1, -1)).concat(spiral(14, 2, 5, 1.3, 180, 1, 1)), [0.5, 2.6, 0.5]);

export function BaroqueFrame({ palette }: { palette: Palette }) {
  const { line, accent, dark } = ornament(palette);
  const id = useFrameId("brq");
  const metal = `url(#${id})`;
  const vein = dark ? darken(line, 0.45) : darken(line, 0.25);
  // The backing hides the rules behind the cartouche; it takes the wash's colour where it sits.
  const cartouche = (backing: string) => (
    <g transform={`translate(${W / 2} 22) scale(1.3)`}>
      <rect x="-24" y="-9" width="48" height="20" fill={backing} />
      <path d={CARTOUCHE} fill={metal} />
      <path d="M0 -6L5 0L0 6L-5 0Z" fill={accent} stroke={line} strokeWidth="0.6" />
    </g>
  );
  return (
    <FrameSvg>
      <PaperWash palette={palette} />
      <defs>
        <Metal id={id} color={line} dark={dark} />
      </defs>
      <path d={sideRules(205, 23.1)} {...stroke(line, 1.9)} />
      <path d={sideRules(205, 29.5)} {...stroke(line, 0.7)} />
      {CORNERS.map((t, i) => (
        <g key={i} transform={t}>
          <FiligreeCorner o={OPTIONS} fill={metal} line={line} accent={accent} leafFill={metal} vein={vein} />
        </g>
      ))}
      {cartouche(washAt(palette, 22))}
      <g transform={MY}>{cartouche(washAt(palette, H - 22))}</g>
    </FrameSvg>
  );
}
