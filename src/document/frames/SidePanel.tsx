import type { Palette } from "../tokens";
import { H } from "./geometry";
import { FrameSvg } from "./svg";

// The Modern skeleton's "frame" (VISION D34; Executive Navy and Modern Two-Column): a full-height coloured side
// panel at the left of every page, optionally with an accent band across its top. Page 1 sets the photo, name and
// contact in it (skeletons/modern); continuation pages keep the empty panel so the main column stays in the same
// place on every page. A plain rect, so the PDF draws it exactly.

/** Width of the side panel in px (a little under a third of the page, as in the mockup). */
export const SIDE_PANEL_WIDTH = 250;
const BAND = 10;

export function SidePanelFrame({ palette }: { palette: Palette }) {
  return (
    <FrameSvg>
      <rect width={SIDE_PANEL_WIDTH} height={H} fill={palette.side ?? palette.bar} />
    </FrameSvg>
  );
}

export function BandedSidePanelFrame({ palette }: { palette: Palette }) {
  return (
    <FrameSvg>
      <rect width={SIDE_PANEL_WIDTH} height={H} fill={palette.side ?? palette.inkBase} />
      <rect width={SIDE_PANEL_WIDTH} height={BAND} fill={palette.bar} />
    </FrameSvg>
  );
}
