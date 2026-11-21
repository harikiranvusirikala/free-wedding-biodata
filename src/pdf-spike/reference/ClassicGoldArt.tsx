// The Classic Gold look for the spike's reference page: gold corner foliage and a simple Ganesha line motif.
// Original drawings (VISION D21); the final artwork is drawn in Step 3.2.

const W = 794;
const H = 1123;

/** Leaves along a quadratic curve. */
function leafSpray(from: [number, number], ctrl: [number, number], to: [number, number], n: number, size: number, flip = false, key = "") {
  const q = (t: number, a: number, b: number, c: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
  const parts = [<path key={`${key}s`} d={`M${from[0]} ${from[1]} Q${ctrl[0]} ${ctrl[1]} ${to[0]} ${to[1]}`} stroke="url(#spike-gold)" strokeWidth="2.4" fill="none" />];
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const x = q(t, from[0], ctrl[0], to[0]);
    const y = q(t, from[1], ctrl[1], to[1]);
    const dx = 2 * (1 - t) * (ctrl[0] - from[0]) + 2 * t * (to[0] - ctrl[0]);
    const dy = 2 * (1 - t) * (ctrl[1] - from[1]) + 2 * t * (to[1] - ctrl[1]);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const side = i % 2 ? 1 : -1;
    const s = size * (1.15 - 0.55 * t);
    const r = (v: number) => Math.round(v * 100) / 100;
    parts.push(
      <ellipse key={`${key}l${i}`} cx={r(x)} cy={r(y)} rx={r(s)} ry={r(s * 0.42)} fill="url(#spike-gold)" transform={`rotate(${r(angle + side * 42 * (flip ? -1 : 1))} ${r(x)} ${r(y)}) translate(${r(s * 0.85)} 0)`} />,
    );
    if (i % 3 === 0) parts.push(<circle key={`${key}b${i}`} cx={r(x + side * 6)} cy={r(y - 7)} r="3.2" fill="#d9a43a" />);
  }
  return parts;
}

function corner() {
  return [
    ...leafSpray([22, 22], [140, 8], [300, 30], 13, 14, false, "a"),
    ...leafSpray([22, 22], [8, 150], [30, 300], 13, 14, true, "b"),
    ...leafSpray([36, 36], [92, 46], [150, 92], 6, 10, false, "c"),
  ];
}

export function FoliageFrame() {
  const side = leafSpray([24, 470], [60, 540], [26, 640], 7, 12, false, "s");
  return (
    <svg className="spike-frame" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden>
      <defs>
        <linearGradient id="spike-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b07a14" />
          <stop offset=".5" stopColor="#f2cd6b" />
          <stop offset="1" stopColor="#c08a22" />
        </linearGradient>
      </defs>
      <path d={`M300 24H${W - 300}M300 ${H - 24}H${W - 300}M22 300V${H - 300}M${W - 22} 300V${H - 300}`} stroke="url(#spike-gold)" strokeWidth="2" />
      <path d={`M300 30H${W - 300}M300 ${H - 30}H${W - 300}M28 300V${H - 300}M${W - 28} 300V${H - 300}`} stroke="url(#spike-gold)" strokeWidth="1" />
      <g>{corner()}</g>
      <g transform={`translate(${W} 0) scale(-1 1)`}>{corner()}</g>
      <g transform={`translate(0 ${H}) scale(1 -1)`}>{corner()}</g>
      <g transform={`translate(${W} ${H}) scale(-1 -1)`}>{corner()}</g>
      <g>{side}</g>
      <g transform={`translate(${W} 0) scale(-1 1)`}>{side}</g>
    </svg>
  );
}

export function GaneshaMotif({ color = "#9a5b13" }: { color?: string }) {
  return (
    <svg className="spike-motif" viewBox="0 0 120 130" width="84" height="91" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="60" cy="9" r="4" fill={color} stroke="none" />
      <path d="M52 17h16M48 25h24M44 33h32" />
      <path d="M40 44c-14-10-30-4-30 12 0 14 12 22 24 18" />
      <path d="M80 44c14-10 30-4 30 12 0 14-12 22-24 18" />
      <path d="M40 44c4-6 36-6 40 0" />
      <path d="M60 40v10" strokeWidth="4" />
      <path d="M48 58c3-3 7-3 9 0M63 58c2-3 6-3 9 0" strokeWidth="4" />
      <path d="M60 62c0 18-6 30-16 38-8 7-4 20 8 20 9 0 12-8 7-13" />
      <path d="M72 70l10 10" strokeWidth="5" />
    </svg>
  );
}

/** A placeholder portrait as SVG markup (no real photo is ever used in fixtures). */
export const PORTRAIT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" width="600" height="800">
  <defs><linearGradient id="p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9dcc8"/><stop offset="1" stop-color="#cdb79b"/></linearGradient></defs>
  <rect width="300" height="400" fill="url(#p)"/>
  <circle cx="150" cy="150" r="62" fill="#8d6e5a"/>
  <path d="M38 400c0-92 50-150 112-150s112 58 112 150z" fill="#3d6b5c"/>
  <path d="M122 252l28 40 28-40" fill="none" stroke="#f3eadf" stroke-width="10" stroke-linejoin="round"/>
</svg>`;
