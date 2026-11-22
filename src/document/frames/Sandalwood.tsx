import type { Palette } from "../tokens";
import { CORNERS, H, leafD, mix, R, W } from "./geometry";
import { FrameSvg, ornament, stroke, useFrameId } from "./svg";

// The sandalwood frame family (Sandalwood, VISION D44 letterhead, D46, D51): a warm wash on the paper, deeper at
// the top and bottom like sandal paste brushed on, and a quiet double rule with a small four-petal blossom in each
// corner and a diamond at the foot. Restrained on purpose: the letterhead (blocks/Letterhead) is the ornament. Our
// own drawing; linear gradients and solids only (the PDF writer's subset, src/pdf/svg-to-pdf.ts).
//
// The rules sit 22 and 27 px in; a blossom reaches 41 px from its corner. Sandalwood's margins (68 top and bottom,
// 62 sides, 50 at the top of page 1 above the letterhead) keep text clear of both.

const OUTER = 22;
const INNER = 27;
/** The corner blossom's centre (on the diagonal, between the two rules). */
const C = 24.5;

const rect = (i: number) => `M${i} ${i}H${W - i}V${H - i}H${i}Z`;
const dot = (x: number, y: number, r: number) => `M${R(x - r)} ${R(y)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

const PETAL = leafD(13, 4.6);
const LEAF = leafD(11, 3);
/** Small leaves running out from the blossom along both rules, and the dots beyond them. */
const SPRIGS = [
  { x: C + 10, y: C, deg: 0 },
  { x: C, y: C + 10, deg: 90 },
];
const SPRIG_DOTS = dot(C + 25, C, 1.4) + dot(C, C + 25, 1.4) + dot(C + 30, C, 0.9) + dot(C, C + 30, 0.9);
const FOOT = `M${W / 2} ${H - INNER - 4.5}l5 4.5l-5 4.5l-5 -4.5Z` + dot(W / 2 - 12, H - INNER + 2.5, 1.5) + dot(W / 2 + 12, H - INNER + 2.5, 1.5);

export function SandalwoodFrame({ palette }: { palette: Palette }) {
  const { line, accent, soft, paper } = ornament(palette);
  const id = useFrameId("sandal");
  const wash = mix(paper, soft, 0.9);
  const corner = (
    <>
      {/* A disc of the wash colour parts the rules under the blossom. */}
      <path d={dot(C, C, 12)} fill={wash} />
      {SPRIGS.map((s) => (
        <g key={s.deg} transform={`translate(${s.x} ${s.y}) rotate(${s.deg})`}>
          <path d={LEAF} fill={line} transform="rotate(-24)" />
          <path d={LEAF} fill={line} transform="rotate(24)" />
        </g>
      ))}
      <path d={SPRIG_DOTS} fill={accent} />
      {[45, 135, 225, 315].map((deg) => (
        <path key={deg} d={PETAL} fill={`url(#${id}g)`} transform={`translate(${C} ${C}) rotate(${deg})`} />
      ))}
      <path d={dot(C, C, 2.6)} fill={accent} />
    </>
  );
  return (
    <FrameSvg>
      <defs>
        {/* The wash: deeper at the top and the foot, plain paper through the middle of the page. */}
        <linearGradient id={`${id}w`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={H}>
          <stop offset="0" stopColor={wash} />
          <stop offset="0.24" stopColor={paper} />
          <stop offset="0.8" stopColor={paper} />
          <stop offset="1" stopColor={wash} />
        </linearGradient>
        {/* Each petal is darker at its base, lighter at its tip (drawn along +x before it is turned). */}
        <linearGradient id={`${id}g`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="13" y2="0">
          <stop offset="0" stopColor={line} />
          <stop offset="1" stopColor={mix(line, paper, 0.45)} />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${id}w)`} />
      <path d={rect(OUTER)} {...stroke(line, 1.2)} />
      <path d={rect(INNER)} {...stroke(line, 0.6)} />
      {CORNERS.map((t, i) => (
        <g key={i} transform={t}>
          {corner}
        </g>
      ))}
      <path d={FOOT} fill={line} />
    </FrameSvg>
  );
}
