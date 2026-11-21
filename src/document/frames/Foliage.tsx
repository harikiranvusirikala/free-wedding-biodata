import { useId } from "react";
import { PAGE, type Palette } from "../tokens";

// The foliage frame family (VISION §7 Classic Gold, D29, D46): leafy sprays from each corner along the edges,
// joined by thin double rules, and a small spray at the middle of each side. Our own drawing (ported from the
// spike's reference page and the mockups), coloured from the palette's frame gradient so each colour variant gets
// its own frame. Ellipses, paths and circles with linear gradients only (the PDF writer's SVG subset).
//
// Everything stays inside a band about 84 px deep at the top and bottom and 70 px at the sides; Classic's margins
// (templates/classic-gold) keep the text clear of it.

const { width: W, height: H } = PAGE;
const r2 = (v: number) => Math.round(v * 100) / 100;

type P = readonly [number, number];

/** Leaves alternating along a quadratic curve, shrinking towards its end, with a berry every third leaf. */
function spray(from: P, ctrl: P, to: P, n: number, size: number, flip: boolean, key: string, g: string, berry: string) {
  const q = (t: number, a: number, b: number, c: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
  const parts = [<path key={`${key}s`} d={`M${from[0]} ${from[1]} Q${ctrl[0]} ${ctrl[1]} ${to[0]} ${to[1]}`} stroke={g} strokeWidth="2.2" fill="none" strokeLinecap="round" />];
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const x = q(t, from[0], ctrl[0], to[0]);
    const y = q(t, from[1], ctrl[1], to[1]);
    const dx = 2 * (1 - t) * (ctrl[0] - from[0]) + 2 * t * (to[0] - ctrl[0]);
    const dy = 2 * (1 - t) * (ctrl[1] - from[1]) + 2 * t * (to[1] - ctrl[1]);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const side = i % 2 ? 1 : -1;
    const s = size * (1.15 - 0.55 * t);
    parts.push(
      <ellipse
        key={`${key}l${i}`}
        cx={r2(x)}
        cy={r2(y)}
        rx={r2(s)}
        ry={r2(s * 0.42)}
        fill={g}
        transform={`rotate(${r2(angle + side * 42 * (flip ? -1 : 1))} ${r2(x)} ${r2(y)}) translate(${r2(s * 0.85)} 0)`}
      />,
    );
    if (i % 3 === 0) parts.push(<circle key={`${key}b${i}`} cx={r2(x + side * 6)} cy={r2(y - 7 * (flip ? -1 : 1))} r="3" fill={berry} />);
  }
  return parts;
}

export function FoliageFrame({ palette }: { palette: Palette }) {
  const id = `fol${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const g = `url(#${id})`;
  const [dark, light, mid] = palette.frame;
  const corner = [
    ...spray([22, 22], [140, 10], [292, 30], 13, 13.5, false, "a", g, mid),
    ...spray([22, 22], [10, 150], [30, 292], 13, 13.5, true, "b", g, mid),
    ...spray([34, 34], [70, 44], [104, 70], 5, 9, false, "c", g, mid),
  ];
  const side = spray([24, 476], [58, 561], [24, 646], 7, 11.5, false, "s", g, mid);
  const corners = [
    { key: "tl", transform: undefined },
    { key: "tr", transform: `translate(${W} 0) scale(-1 1)` },
    { key: "bl", transform: `translate(0 ${H}) scale(1 -1)` },
    { key: "br", transform: `translate(${W} ${H}) scale(-1 -1)` },
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden style={{ position: "absolute", inset: 0, display: "block" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={dark} />
          <stop offset=".5" stopColor={light} />
          <stop offset="1" stopColor={mid} />
        </linearGradient>
      </defs>
      <path d={`M300 24H${W - 300}M300 ${H - 24}H${W - 300}M22 300V${H - 300}M${W - 22} 300V${H - 300}`} stroke={g} strokeWidth="2" fill="none" />
      <path d={`M300 30H${W - 300}M300 ${H - 30}H${W - 300}M28 300V${H - 300}M${W - 28} 300V${H - 300}`} stroke={g} strokeWidth="0.9" fill="none" />
      {corners.map((c) => (
        <g key={c.key} transform={c.transform}>
          {corner}
        </g>
      ))}
      <g>{side}</g>
      <g transform={`translate(${W} 0) scale(-1 1)`}>{side}</g>
    </svg>
  );
}
