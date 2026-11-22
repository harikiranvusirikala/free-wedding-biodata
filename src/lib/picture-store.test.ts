import { describe, expect, it, vi } from "vitest";
import { cropKey, createPictureStore, fitKey, resolvePicture, type DrawPicture, type PictureRequest } from "./picture-store";

// The store behind the photo pages and the editor's thumbnails (Step 4.2b): draws what is missing one at a time,
// keeps a photo's previous picture until its new crop is drawn, lets go of pictures nobody wants, and never draws a
// picture that is no longer wanted. `draw` is faked (a real canvas is checked in e2e).

const crop = { x: 0.5, y: 0.5, zoom: 1, rotation: 0 } as const;
const request = (id: string, zoom = 1): PictureRequest => {
  const c = { ...crop, zoom };
  return { key: cropKey(id, c, "2:3", 800, 0.88), id, spec: { kind: "crop", crop: c, frame: "2:3", outWidth: 800, quality: 0.88 } };
};
const blob = new Blob(["x"]);

function setup(draw?: DrawPicture) {
  const released: string[] = [];
  const drawn: string[] = [];
  let n = 0;
  const fake: DrawPicture = draw ?? (async (_b, spec) => {
    const src = `blob:${++n}`;
    drawn.push(src + (spec.kind === "crop" ? `@${spec.crop.zoom}` : ""));
    return { src, width: 10, height: 15 };
  });
  const store = createPictureStore(async (id) => (id === "missing" ? undefined : blob), fake, (src) => released.push(src));
  return { store, released, drawn };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("cropKey / fitKey", () => {
  it("say exactly what a drawing depends on", () => {
    const base = request("a").key;
    expect(request("a").key).toBe(base);
    expect(request("a", 2).key).not.toBe(base);
    expect(request("b").key).not.toBe(base);
    expect(cropKey("a", crop, "3:4", 800, 0.88)).not.toBe(base);
    expect(cropKey("a", crop, "2:3", 400, 0.88)).not.toBe(base);
    expect(fitKey("c", 0)).not.toBe(fitKey("c", 90));
    expect(fitKey("c", 0, 400)).not.toBe(fitKey("c", 0));
  });
});

describe("createPictureStore", () => {
  it("draws each wanted picture once, in order, and says when it is drawn", async () => {
    const { store, drawn } = setup();
    const wanted = [request("a"), request("b"), request("c")];
    const heard = vi.fn();
    store.subscribe(heard);
    store.sync(wanted);
    store.sync(wanted); // asking again for the same pictures draws nothing more
    await settle();
    await settle();
    await settle();
    expect(drawn).toHaveLength(3);
    expect(wanted.every((r) => store.getSnapshot().drawn.get(r.key))).toBe(true);
    expect(heard).toHaveBeenCalled();
    expect(resolvePicture(store.getSnapshot(), wanted[1])).toEqual({ src: "blob:2", width: 10, height: 15 });
  });

  it("draws one at a time", async () => {
    let running = 0;
    let most = 0;
    const { store } = setup(async () => {
      most = Math.max(most, ++running);
      await settle();
      running--;
      return { src: "blob:x", width: 1, height: 1 };
    });
    store.sync([request("a"), request("b"), request("c")]);
    for (let i = 0; i < 6; i++) await settle();
    expect(most).toBe(1);
  });

  it("keeps a photo's previous picture while its new crop is drawn, then lets it go", async () => {
    const { store, released } = setup();
    store.sync([request("a")]);
    await settle();
    await settle();
    const first = resolvePicture(store.getSnapshot(), request("a"))!;
    const next = request("a", 2);
    store.sync([next]);
    // Not drawn yet: the old crop's picture stands in, and has not been released.
    expect(resolvePicture(store.getSnapshot(), next)).toEqual(first);
    expect(released).toEqual([]);
    await settle();
    await settle();
    const second = resolvePicture(store.getSnapshot(), next)!;
    expect(second.src).not.toBe(first.src);
    expect(released).toEqual([first.src]);
    expect(store.getSnapshot().drawn.has(request("a").key)).toBe(false);
  });

  it("lets go of a photo that is no longer wanted, and never draws a queued one that stopped being wanted", async () => {
    const { store, released, drawn } = setup();
    store.sync([request("a"), request("b")]);
    store.sync([request("b")]); // a is still being drawn (or queued), then dropped
    for (let i = 0; i < 4; i++) await settle();
    expect(store.getSnapshot().drawn.has(request("a").key)).toBe(false);
    expect(store.getSnapshot().drawn.has(request("b").key)).toBe(true);
    expect(released.length + drawn.length).toBeGreaterThan(0);
    store.sync([]);
    expect(store.getSnapshot().drawn.size).toBe(0);
    expect(released).toContain("blob:" + (drawn.length)); // b's picture was released
  });

  it("records a picture that can't be read or drawn as null, and carries on", async () => {
    const { store } = setup(async (_b, spec) => {
      if (spec.kind === "crop" && spec.crop.zoom === 3) throw new Error("no canvas");
      return { src: "blob:ok", width: 1, height: 1 };
    });
    const bad = request("a", 3);
    const gone = request("missing");
    const fine = request("b");
    store.sync([bad, gone, fine]);
    for (let i = 0; i < 6; i++) await settle();
    const snapshot = store.getSnapshot();
    expect(snapshot.drawn.get(bad.key)).toBeNull();
    expect(snapshot.drawn.get(gone.key)).toBeNull();
    expect(snapshot.drawn.get(fine.key)?.src).toBe("blob:ok");
    expect(resolvePicture(snapshot, bad)).toBeNull();
  });

  it("reset lets go of everything and can be synced again (React runs effects twice in development)", async () => {
    const { store, released } = setup();
    store.sync([request("a")]);
    await settle();
    await settle();
    store.reset();
    expect(released).toEqual(["blob:1"]);
    expect(store.getSnapshot().drawn.size).toBe(0);
    store.sync([request("a")]);
    await settle();
    await settle();
    expect(store.getSnapshot().drawn.get(request("a").key)?.src).toBe("blob:2");
  });

  it("keeps a picture whose drawing finishes after a reset if it is wanted again", async () => {
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => (finish = resolve));
    const { store } = setup(async () => {
      await gate;
      return { src: "blob:late", width: 1, height: 1 };
    });
    store.sync([request("a")]);
    await settle();
    store.reset();
    store.sync([request("a")]);
    finish();
    for (let i = 0; i < 4; i++) await settle();
    expect(store.getSnapshot().drawn.get(request("a").key)?.src).toBe("blob:late");
  });
});
