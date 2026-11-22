import type { Palette } from "../tokens";
import { at, darken, H, insetRect, leafD, mix, pol, R, W } from "./geometry";
import { FrameSvg, ornament, stroke, useFrameId } from "./svg";

// The thoranam frame family (Kalyanam, VISION D39, D46): a festive garland of mango leaves and marigolds hung
// across the top of a fine double border, a small garland knot at the bottom, and a faint mandala watermark behind
// the text. Our own drawing (cleaned up from the mockup's toran, docs/mockups/assets/doc.js). Colours: the border
// in `rule`, leaves in the palette's frame gradient, marigolds in `accent`, the watermark a whisper of `rule`.
//
// The garland hangs to y ≈ 66 at the middle of the page and the border sits 25 px in; Kalyanam's margins
// (88 px at the top, 60 elsewhere) keep the text clear of both.

const ROPE_Y = 28;
const SAG = 9;
const ropeY = (t: number) => ROPE_Y + 4 * SAG * t * (1 - t);

/** A scalloped disc (a marigold seen from the front) of radius 10 at the origin, scaled where it's used. */
const RUFFLE = (() => {
  const lobes = 13;
  let d = "";
  for (let i = 0; i < lobes; i++) {
    const a0 = (i / lobes) * 360;
    const a1 = ((i + 1) / lobes) * 360;
    const p0 = pol(0, 0, 8.6, a0);
    const c = pol(0, 0, 11.4, (a0 + a1) / 2);
    const p1 = pol(0, 0, 8.6, a1);
    d += `${i ? "" : `M${R(p0[0])} ${R(p0[1])}`}Q${R(c[0])} ${R(c[1])} ${R(p1[0])} ${R(p1[1])}`;
  }
  return `${d}Z`;
})();

const LEAF = leafD(34, 6.8, 1.5);
const MIDRIB = "M2 0Q17 -0.6 31 1.2";

/** Items along the rope: marigold pairs and mango leaves, alternating. */
const ITEMS = Array.from({ length: 23 }, (_, i) => {
  const t = i / 22;
  return { x: R(44 + t * (W - 88)), y: R(ropeY(t)), kind: i % 2 ? ("leaf" as const) : ("flower" as const) };
});

function Marigold({ x, y, s, color, heart }: { x: number; y: number; s: number; color: string; heart: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d={RUFFLE} fill={color} />
      <path d={RUFFLE} fill={heart} transform="scale(0.6) rotate(14)" />
      <circle r="2" fill={darken(color, 0.25)} />
    </g>
  );
}

/** A faint mandala behind the text (D39 background watermark), drawn in a near-paper tint, not with opacity. */
function Watermark({ color }: { color: string }) {
  const outer = Array.from({ length: 16 }, (_, k) => k * 22.5);
  const inner = Array.from({ length: 8 }, (_, k) => k * 45 + 22.5);
  return (
    <g transform={`translate(${W / 2} ${R(H * 0.56)})`} {...stroke(color, 2.4)}>
      <circle r="210" />
      <circle r="196" />
      {outer.map((a) => (
        <ellipse key={a} cy="-120" rx="26" ry="70" transform={`rotate(${a})`} />
      ))}
      {inner.map((a) => (
        <ellipse key={a} cy="-58" rx="18" ry="40" transform={`rotate(${a})`} />
      ))}
      <circle r="30" />
      <circle r="12" fill={color} />
    </g>
  );
}

export function ToranFrame({ palette }: { palette: Palette }) {
  const { line, accent, paper } = ornament(palette);
  const leafId = useFrameId("tor");
  const [leafDark, leafLight] = palette.frame;
  const heart = mix(accent, "#ffd447", 0.5);
  const second = darken(accent, 0.1);
  const rib = darken(leafDark, 0.25);
  const knot = (x: number, y: number, dir: 1 | -1) => (
    <g key={`k${x}`}>
      <path d={LEAF} fill={`url(#${leafId})`} transform={at(x, y, dir > 0 ? 0 : 180)} />
      <path d={MIDRIB} {...stroke(rib, 0.7)} transform={at(x, y, dir > 0 ? 0 : 180)} />
    </g>
  );
  return (
    <FrameSvg>
      <defs>
        <linearGradient id={leafId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={leafDark} />
          <stop offset="1" stopColor={leafLight} />
        </linearGradient>
      </defs>
      <Watermark color={mix(paper, line, 0.1)} />
      <path d={insetRect(18)} {...stroke(line, 2.5)} strokeLinecap="butt" />
      <path d={insetRect(25)} {...stroke(line, 1)} strokeLinecap="butt" />
      <path d={`M30 ${ROPE_Y}Q${W / 2} ${ROPE_Y + 2 * SAG} ${W - 30} ${ROPE_Y}`} {...stroke(darken(line, 0.15), 1.8)} />
      {ITEMS.map((it) =>
        it.kind === "leaf" ? (
          <g key={it.x}>
            <path d={LEAF} fill={`url(#${leafId})`} transform={at(it.x, it.y + 1, 90)} />
            <path d={MIDRIB} {...stroke(rib, 0.7)} transform={at(it.x, it.y + 1, 90)} />
          </g>
        ) : (
          <g key={it.x}>
            <Marigold x={it.x} y={R(it.y + 22)} s={0.62} color={second} heart={heart} />
            <Marigold x={it.x} y={R(it.y + 8)} s={0.82} color={accent} heart={heart} />
          </g>
        ),
      )}
      <circle cx="30" cy={ROPE_Y} r="3" fill={line} />
      <circle cx={W - 30} cy={ROPE_Y} r="3" fill={line} />
      {/* The bottom knot: two leaves and three marigolds over a break in the border. */}
      <rect x={W / 2 - 58} y={H - 34} width="116" height="20" fill={paper} />
      {knot(W / 2 + 10, H - 22, 1)}
      {knot(W / 2 - 10, H - 22, -1)}
      <Marigold x={W / 2 - 40} y={H - 22} s={0.5} color={second} heart={heart} />
      <Marigold x={W / 2 + 40} y={H - 22} s={0.5} color={second} heart={heart} />
      <Marigold x={W / 2} y={H - 22} s={0.85} color={accent} heart={heart} />
    </FrameSvg>
  );
}
