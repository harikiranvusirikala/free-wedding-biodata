import { useSyncExternalStore } from "react";
import type { AutosaveController, AutosaveSnapshot } from "./autosave";

/**
 * The open draft and its save status, re-rendering on every change. The editor creates the controller (one per
 * open draft) and owns its lifetime; this only reads it. The server snapshot is the same object: the editor is
 * a client page in a static export, so there is no server render to differ from.
 */
export function useAutosave(controller: AutosaveController): AutosaveSnapshot {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
}
