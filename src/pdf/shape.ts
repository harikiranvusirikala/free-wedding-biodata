// Text shaping with HarfBuzz (harfbuzzjs) using the same TTFs the browser used. A run is split like Chrome splits
// it: by font (the first family in the CSS stack that draws every code point of a grapheme: in its cmap and in its
// @font-face unicode-range, which is how Chrome's glyph lookup treats a range) and by script (Common and Inherited
// characters join their neighbours), then each piece is shaped with the run's language, keeping the whole run as
// context.

import type * as HarfBuzz from "harfbuzzjs";

export type HarfBuzzModule = typeof HarfBuzz;

export interface ShapingFont {
  key: string;
  family: string;
  weight: number;
  bytes: Uint8Array;
  upem: number;
  font: HarfBuzz.Font;
  face: HarfBuzz.Face;
  unicodes: Set<number>;
  /** The font draws this code point: in its cmap and in its unicode-range. */
  covers(cp: number): boolean;
  /** Glyph IDs drawn, with the text each stands for (best effort, for the ToUnicode map). */
  used: Map<number, string | null>;
  /** How sure each `used` mapping is (3 nominal glyph, 2 whole cluster, 1 leftover, 0 none); better ones win. */
  usedRank: Map<number, number>;
  /** Advance in font units, cached. */
  advance(gid: number): number;
}

export function loadShapingFont(
  hb: HarfBuzzModule,
  family: string,
  weight: number,
  data: ArrayBuffer | Uint8Array,
  inRange: (cp: number) => boolean = () => true,
): ShapingFont {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const face = new hb.Face(new hb.Blob(bytes));
  const font = new hb.Font(face);
  const advances = new Map<number, number>();
  const unicodes = new Set(face.collectUnicodes());
  return {
    key: `${family}|${weight}`,
    family,
    weight,
    bytes,
    upem: face.upem,
    face,
    font,
    unicodes,
    covers: (cp) => unicodes.has(cp) && inRange(cp),
    used: new Map(),
    usedRank: new Map(),
    advance(gid) {
      let a = advances.get(gid);
      if (a === undefined) {
        a = font.glyphHAdvance(gid);
        advances.set(gid, a);
      }
      return a;
    },
  };
}

export interface PlacedGlyph {
  font: ShapingFont;
  gid: number;
  /** Pen-relative position of the glyph origin in px (x from the run start; y up, from the baseline). */
  x: number;
  y: number;
  cluster: number;
}

export interface ShapedRun {
  glyphs: PlacedGlyph[];
  /** Total advance in px, letter spacing included (after every cluster, as the browser measures it). */
  width: number;
  clusters: number;
  codePoints: number;
}

/** ISO 15924 tags HarfBuzz takes, for the scripts the app prints. */
const SCRIPTS: [string, RegExp][] = [
  ["Latn", /\p{Script=Latin}/u],
  ["Deva", /\p{Script=Devanagari}/u],
  ["Beng", /\p{Script=Bengali}/u],
  ["Guru", /\p{Script=Gurmukhi}/u],
  ["Gujr", /\p{Script=Gujarati}/u],
  ["Orya", /\p{Script=Oriya}/u],
  ["Taml", /\p{Script=Tamil}/u],
  ["Telu", /\p{Script=Telugu}/u],
  ["Knda", /\p{Script=Kannada}/u],
  ["Mlym", /\p{Script=Malayalam}/u],
];

function scriptOf(ch: string): string | null {
  for (const [tag, re] of SCRIPTS) if (re.test(ch)) return tag;
  return null;
}

/** Characters that never decide which font draws a cluster (joiners, variation selectors). */
const IGNORABLE = /[\u00AD\u200B-\u200F\u2060\uFE00-\uFE0F]/u;

let segmenter: Intl.Segmenter | null = null;

/**
 * Shapes one visual line run. `fonts` is the fallback list (primary first). `lang` is a BCP 47 tag (the page's
 * lang), which selects language-specific forms (e.g. Marathi in Devanagari).
 */
export function shapeRun(hb: HarfBuzzModule, text: string, fonts: ShapingFont[], fontSize: number, letterSpacing: number, lang: string): ShapedRun {
  segmenter ??= new Intl.Segmenter(undefined, { granularity: "grapheme" });
  // 1. Grapheme → font, code point → script.
  interface Piece {
    start: number;
    end: number;
    font: ShapingFont;
    script: string | null;
  }
  const pieces: Piece[] = [];
  for (const { segment, index } of segmenter.segment(text)) {
    const cps = [...segment];
    const font =
      fonts.find((f) => cps.every((c) => IGNORABLE.test(c) || f.covers(c.codePointAt(0)!))) ?? fonts[0];
    let offset = index;
    for (const c of cps) {
      const script = scriptOf(c);
      const last = pieces[pieces.length - 1];
      if (last && last.font === font && (script === null || last.script === null || last.script === script)) {
        last.end = offset + c.length;
        if (last.script === null) last.script = script;
      } else {
        pieces.push({ start: offset, end: offset + c.length, font, script });
      }
      offset += c.length;
    }
  }
  // A leading Common piece takes the script of what follows (it was only split off because of a font change).
  for (let i = 0; i < pieces.length; i++) if (pieces[i].script === null) pieces[i].script = pieces[i + 1]?.script ?? pieces[i - 1]?.script ?? null;

  // 2. Shape every piece with the full text as context.
  const glyphs: PlacedGlyph[] = [];
  let pen = 0;
  let clusters = 0;
  for (const piece of pieces) {
    const buffer = new hb.Buffer();
    buffer.addText(text, piece.start, piece.end - piece.start);
    buffer.setDirection(hb.Direction.LTR);
    if (piece.script) buffer.setScript(piece.script);
    buffer.setLanguage(lang);
    buffer.guessSegmentProperties();
    hb.shape(piece.font.font, buffer);
    const out = buffer.getGlyphInfosAndPositions();
    const k = fontSize / piece.font.upem;
    for (let i = 0; i < out.length; i++) {
      const g = out[i];
      glyphs.push({ font: piece.font, gid: g.codepoint, x: pen + (g.xOffset ?? 0) * k, y: (g.yOffset ?? 0) * k, cluster: g.cluster });
      pen += (g.xAdvance ?? 0) * k;
      // Letter spacing goes after the last glyph of each cluster.
      if (i === out.length - 1 || out[i + 1].cluster !== g.cluster) {
        pen += letterSpacing;
        clusters++;
      }
    }
  }
  recordToUnicode(text, glyphs);
  return { glyphs, width: pen, clusters, codePoints: [...text].length };
}

/**
 * Best-effort glyph → text for the ToUnicode map (used by extractors that ignore /ActualText, such as Apple's
 * PDFKit). Per cluster: a glyph that is the font's own glyph for one of the cluster's code points maps to it; a
 * cluster drawn with one glyph maps it to the whole cluster; otherwise the code points left over (conjunct parts,
 * reph, ligated vowel signs) go, in logical order, to the cluster's first other glyph and further glyphs get no
 * mapping. A glyph seen in several contexts keeps its surest mapping. Reordered vowel signs (Devanagari ि before
 * its consonant) still come out in visual order: only ActualText can fix that.
 */
function recordToUnicode(text: string, glyphs: PlacedGlyph[]) {
  const starts = [...new Set(glyphs.map((g) => g.cluster))].sort((a, b) => a - b);
  const byCluster = new Map<number, PlacedGlyph[]>();
  for (const g of glyphs) byCluster.set(g.cluster, [...(byCluster.get(g.cluster) ?? []), g]);
  for (const [cluster, members] of byCluster) {
    const end = starts[starts.indexOf(cluster) + 1] ?? text.length;
    const clusterText = text.slice(cluster, end);
    const cps = [...clusterText];
    const taken = new Array<boolean>(cps.length).fill(false);
    const assigned = new Map<PlacedGlyph, [string | null, number]>();
    for (const g of members) {
      const i = cps.findIndex((c, k) => !taken[k] && g.font.font.nominalGlyph(c.codePointAt(0)!) === g.gid);
      if (i >= 0) {
        taken[i] = true;
        assigned.set(g, [cps[i], 3]);
      }
    }
    const rest = cps.filter((_, k) => !taken[k]).join("");
    const other = members.find((g) => !assigned.has(g));
    if (other && rest.trim()) assigned.set(other, members.length === 1 ? [clusterText, 2] : [rest, 1]);
    for (const g of members) {
      const [str, rank] = assigned.get(g) ?? [null, 0];
      if (rank > (g.font.usedRank.get(g.gid) ?? -1)) {
        g.font.used.set(g.gid, str);
        g.font.usedRank.set(g.gid, rank);
      }
    }
  }
}
