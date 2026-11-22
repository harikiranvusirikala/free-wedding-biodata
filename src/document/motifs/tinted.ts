import { tonePixels } from "./tone";

// Browser side of the tinted symbol pictures (./tone.ts): a picture is decoded, recoloured on a canvas and kept as a
// PNG data URL, once per (picture, ink). A data URL, because the Download engine takes it as it is, with no fetch
// (the editor's CSP allows `img-src data:`, while `connect-src 'self'` refuses fetching data: or blob: addresses).
// `Motif` reads the cache as it renders (useTintedPicture) and shows an empty box of the same size until the
// tinted picture is ready, so the untinted picture is never on a page; DocumentView awaits tintPicture before it
// lays a document out, so `data-doc-ready` (and every preview, print and export after it) has the tinted one.

type Entry = { url: string; users: number };

const cache = new Map<string, Entry>();
const pending = new Map<string, Promise<string>>();
const listeners = new Set<() => void>();
/** Pictures kept that no symbol on screen shows; the oldest go first (a design browsed long ago). */
const SPARE = 120;

const keyOf = (src: string, ink: string) => `${ink}|${src}`;

function trim() {
  let spare = [...cache.values()].filter((entry) => !entry.users).length - SPARE;
  for (const [key, entry] of cache) {
    if (spare <= 0) break;
    if (entry.users) continue;
    cache.delete(key);
    spare -= 1;
  }
}

async function draw(src: string, ink: string): Promise<string> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No 2D canvas");
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  pixels.data.set(tonePixels(pixels.data, ink));
  ctx.putImageData(pixels, 0, 0);
  const url = canvas.toDataURL("image/png");
  canvas.width = canvas.height = 0;
  return url;
}

/** The tinted picture, if it has been made (no work is started). */
export function tintedNow(src: string, ink: string): string | undefined {
  return cache.get(keyOf(src, ink))?.url;
}

/**
 * The picture `src` in `ink` as a PNG data URL, made once and kept. If it can't be made (no canvas) the picture
 * itself is used, so the symbol still prints.
 */
export function tintPicture(src: string, ink: string): Promise<string> {
  const key = keyOf(src, ink);
  const hit = cache.get(key);
  if (hit) {
    // Most recently used: last to be dropped.
    cache.delete(key);
    cache.set(key, hit);
    return Promise.resolve(hit.url);
  }
  let job = pending.get(key);
  if (!job) {
    job = draw(src, ink)
      .catch(() => src)
      .then((url) => {
        pending.delete(key);
        cache.set(key, { url, users: 0 });
        trim();
        listeners.forEach((listener) => listener());
        return url;
      });
    pending.set(key, job);
  }
  return job;
}

export function subscribeTinted(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** A symbol on screen holds its picture, so it is never dropped while shown; returns the release. */
export function holdTinted(src: string, ink: string): () => void {
  const entry = cache.get(keyOf(src, ink));
  if (!entry) return () => {};
  entry.users += 1;
  return () => {
    entry.users -= 1;
  };
}
