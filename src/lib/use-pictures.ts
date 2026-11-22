import { useEffect, useState, useSyncExternalStore } from "react";
import { drawPicture } from "./photos";
import { createPictureStore, resolvePicture, type DrawPicture, type DrawnPicture, type LoadBlob, type PictureRequest, type PictureSnapshot, type PictureStore } from "./picture-store";

// React's side of the picture store (Step 4.2b): `usePictures(requests, loadBlob)` draws the pictures the requests
// ask for, one at a time, and says which are ready. Used for the photo pages of the document and the editor's
// thumbnails. `requests` must keep its identity while it asks for the same pictures (build it with useMemo).

export interface Pictures {
  /** What is drawn so far; changes whenever a picture is drawn or let go (memoise derived values on it). */
  snapshot: PictureSnapshot;
  /** The picture for a request: its own, else the previous crop of the same photo; null when it can't be drawn. */
  get(request: Pick<PictureRequest, "key" | "id">): DrawnPicture | null | undefined;
  /** True when every requested picture has been drawn (or found unreadable). */
  ready: boolean;
}

export function usePictures(requests: readonly PictureRequest[], loadBlob: LoadBlob, draw: DrawPicture = drawPicture): Pictures {
  const [store] = useState<PictureStore>(() => createPictureStore(loadBlob, draw));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  useEffect(() => {
    store.configure(loadBlob, draw);
    store.sync(requests);
  }, [store, requests, loadBlob, draw]);
  // React may run an effect twice in development: the cleanup lets everything go, and the sync above draws again.
  useEffect(() => () => store.reset(), [store]);

  return {
    snapshot,
    get: (request) => resolvePicture(snapshot, request),
    ready: requests.every((request) => snapshot.drawn.has(request.key)),
  };
}
