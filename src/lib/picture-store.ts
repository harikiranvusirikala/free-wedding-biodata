import type { PhotoCrop, PhotoFrame } from "@/biodata/types";
import { releasePictureUrl } from "./picture-urls";

// A small store of pictures drawn from stored photos (Step 4.2b): the photo pages of the document (full resolution)
// and the editor's thumbnails (small) both need "this stored picture, drawn like so". Each request has a key that
// says exactly what the drawing depends on; the store draws what it has no picture for, one at a time (decoding a
// 3000 px photo takes a lot of memory on a phone), keeps a picture until nothing wants its key, and keeps the previous
// picture of a photo until its new crop is drawn, so a page never goes blank while a crop is redrawn. Framework-free
// (the hook is src/lib/use-pictures.ts), so it is tested with a fake `draw`.

export type PictureSpec =
  /** The picture cropped into a frame (the cropper's crop, kept covering the frame), `outWidth` px across. */
  | { kind: "crop"; crop: PhotoCrop; frame: PhotoFrame; outWidth: number; quality: number }
  /** The whole picture, turned by quarter turns (the horoscope chart: fitted, never cropped); `maxSide` shrinks it for a thumbnail. */
  | { kind: "fit"; rotation: PhotoCrop["rotation"]; maxSide?: number };

export interface PictureRequest {
  /** Everything the drawing depends on: equal keys give the same picture. */
  key: string;
  /** The stored photo's id. */
  id: string;
  spec: PictureSpec;
}

/** A drawn picture: a blob: URL and its size in pixels. */
export interface DrawnPicture {
  src: string;
  width: number;
  height: number;
}

export type LoadBlob = (id: string) => Promise<Blob | undefined>;
export type DrawPicture = (blob: Blob, spec: PictureSpec) => Promise<DrawnPicture>;

export interface PictureSnapshot {
  /** Drawn pictures by key; null = the picture couldn't be read or drawn. */
  drawn: ReadonlyMap<string, DrawnPicture | null>;
  /** The latest picture drawn for each photo (any crop), shown while a new crop is being drawn. */
  latest: ReadonlyMap<string, DrawnPicture>;
}

export interface PictureStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): PictureSnapshot;
  /** Says which pictures are wanted now: starts drawing the missing ones and lets go of those nobody wants. */
  sync(requests: readonly PictureRequest[]): void;
  /** Where pictures are read and how they are drawn from now on (the owner's callbacks may change between renders). */
  configure(load: LoadBlob, draw: DrawPicture): void;
  /** Lets go of everything (the owner is going away, or React is re-running its effects). */
  reset(): void;
}

/** The key of a crop request: the picture, the frame, the crop and the drawing's size. */
export function cropKey(id: string, crop: PhotoCrop, frame: PhotoFrame, outWidth: number, quality: number): string {
  return ["crop", id, frame, crop.x, crop.y, crop.zoom, crop.rotation, outWidth, quality].join("|");
}

/** The key of a fit request. */
export function fitKey(id: string, rotation: PhotoCrop["rotation"], maxSide?: number): string {
  return ["fit", id, rotation, maxSide ?? "full"].join("|");
}

const EMPTY: PictureSnapshot = { drawn: new Map(), latest: new Map() };

export function createPictureStore(initialLoad: LoadBlob, initialDraw: DrawPicture, release: (src: string) => void = (src) => releasePictureUrl(src)): PictureStore {
  const listeners = new Set<() => void>();
  let load = initialLoad;
  let draw = initialDraw;
  // Insertion order is drawing order, so the last entry of a photo is its latest picture.
  const entries = new Map<string, { id: string; picture: DrawnPicture | null }>();
  let snapshot = EMPTY;
  let wanted: readonly PictureRequest[] = [];
  const queue: PictureRequest[] = [];
  const queued = new Set<string>();
  let running = false;
  /** The key being drawn now. */
  let current: string | undefined;

  function emit() {
    const latest = new Map<string, DrawnPicture>();
    for (const { id, picture } of entries.values()) if (picture) latest.set(id, picture);
    snapshot = { drawn: new Map([...entries].map(([key, entry]) => [key, entry.picture])), latest };
    for (const listener of listeners) listener();
  }

  /** Lets go of pictures nobody wants, except a photo's latest while its new picture isn't drawn yet. */
  function prune(): boolean {
    const wantedKeys = new Set(wanted.map((r) => r.key));
    const pending = new Set<string>(); // photos whose wanted picture isn't drawn
    for (const r of wanted) if (!entries.get(r.key)?.picture) pending.add(r.id);
    const latest = new Map<string, string>();
    for (const [key, { id, picture }] of entries) if (picture) latest.set(id, key);
    let changed = false;
    for (const [key, { id, picture }] of entries) {
      if (wantedKeys.has(key) || (pending.has(id) && latest.get(id) === key)) continue;
      entries.delete(key);
      if (picture) release(picture.src);
      changed = true;
    }
    return changed;
  }

  async function pump() {
    if (running) return;
    running = true;
    try {
      for (let request = queue.shift(); request; request = queue.shift()) {
        queued.delete(request.key);
        current = request.key;
        let picture: DrawnPicture | null = null;
        try {
          const blob = await load(request.id);
          picture = blob ? await draw(blob, request.spec) : null;
        } catch {
          picture = null;
        }
        current = undefined;
        // A key still wanted is kept even if the store was reset meanwhile: the key says exactly what was drawn.
        if (!wanted.some((r) => r.key === request.key)) {
          if (picture) release(picture.src);
          continue;
        }
        entries.set(request.key, { id: request.id, picture });
        prune();
        emit();
      }
    } finally {
      running = false;
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    configure(nextLoad, nextDraw) {
      load = nextLoad;
      draw = nextDraw;
    },
    sync(requests) {
      wanted = requests;
      const keys = new Set(requests.map((r) => r.key));
      // What was waiting to be drawn but is no longer wanted leaves the queue.
      for (let i = queue.length - 1; i >= 0; i--) {
        if (!keys.has(queue[i].key)) {
          queued.delete(queue[i].key);
          queue.splice(i, 1);
        }
      }
      for (const request of requests) {
        if (entries.has(request.key) || queued.has(request.key) || current === request.key) continue;
        queued.add(request.key);
        queue.push(request);
      }
      if (prune()) emit();
      void pump();
    },
    reset() {
      queue.length = 0;
      queued.clear();
      wanted = [];
      for (const { picture } of entries.values()) if (picture) release(picture.src);
      const had = entries.size > 0;
      entries.clear();
      if (had) emit();
    },
  };
}

/**
 * The picture to show for a request: the one drawn for its key, else the latest picture of the same photo (an older
 * crop, while the new one is drawn), else undefined (not drawn yet). null: it can't be drawn at all.
 */
export function resolvePicture(snapshot: PictureSnapshot, request: Pick<PictureRequest, "key" | "id">): DrawnPicture | null | undefined {
  const own = snapshot.drawn.get(request.key);
  if (own !== undefined) return own;
  return snapshot.latest.get(request.id);
}
