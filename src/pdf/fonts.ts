// The browser's font and WebAssembly loading for the PDF writer: the same TTFs the page uses, from /fonts (usually
// already in the HTTP cache, since the page drew with them), and harfbuzz-subset.wasm, which the bundler emits as a
// static file through `new URL(…, import.meta.url)`. Nothing is requested from another origin.

import { FONT_FAMILY } from "@/document/tokens";
import { faceSuffix } from "./weights";

/** The font files in public/fonts by family (`npm run fonts`). */
const FAMILY_FILES: Record<string, string> = Object.fromEntries(
  [...new Set(Object.values(FONT_FAMILY))].map((family) => [family, family.replace(/\s+/g, "")]),
);

/** `/fonts/<File>-Regular.ttf`, `-Medium.ttf` or `-Bold.ttf` for a family and weight, or null for a family we don't ship. */
export function fontUrl(family: string, weight: number): string | null {
  const file = FAMILY_FILES[family];
  return file ? `/fonts/${file}-${faceSuffix(weight)}.ttf` : null;
}

const SUBSET_WASM = new URL("../../node_modules/harfbuzzjs/dist/harfbuzz-subset.wasm", import.meta.url);

const cache = new Map<string, Promise<ArrayBuffer>>();

export function fetchBytes(url: string | URL): Promise<ArrayBuffer> {
  const key = String(url);
  let p = cache.get(key);
  if (!p) {
    p = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`${key}: HTTP ${response.status}`);
      return response.arrayBuffer();
    });
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

export async function loadFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  const url = fontUrl(family, weight);
  return url ? fetchBytes(url) : null;
}

export const loadSubsetWasm = () => fetchBytes(SUBSET_WASM);
