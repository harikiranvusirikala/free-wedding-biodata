import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

/**
 * A large name in a narrow column (the Modern side panel) whose longest word must not break in the middle: when a
 * word is wider than the column at `em`, the text is set smaller, just enough for that word to fit (never below
 * `minScale` of it; past that, `overflowWrap: anywhere` still keeps it inside). Measured on the laid-out text after
 * the fonts have loaded (DocumentView shows pages only then), so the PDF and the images, which read the same DOM,
 * get the same size. Remount with `key={text}` when the text changes, so it starts again from `em`.
 */
export function FitWords({ text, em, minScale = 0.6, style }: { text: string; em: number; minScale?: number; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    const node = el?.firstChild;
    if (!el || !(node instanceof Text) || scale !== 1) return;
    const widest = widestWord(node);
    const room = el.clientWidth;
    // 0.99: a hair of room so rounding never wraps the word again.
    if (room > 0 && widest > room) setScale(Math.max(minScale, (room / widest) * 0.99));
  }, [text, scale, minScale]);
  return (
    <div ref={ref} style={{ ...style, fontSize: `${Math.round(em * scale * 1000) / 1000}em`, overflowWrap: "anywhere" }}>
      {text}
    </div>
  );
}

/** The width of the widest space-separated word of a text node as drawn (a word broken over lines adds up its parts). */
function widestWord(node: Text): number {
  let widest = 0;
  let at = 0;
  for (const word of node.data.split(" ")) {
    if (word) {
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + word.length);
      widest = Math.max(widest, [...range.getClientRects()].reduce((sum, box) => sum + box.width, 0));
    }
    at += word.length + 1;
  }
  return widest;
}
