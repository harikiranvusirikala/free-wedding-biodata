import { systemClock, type Clock } from "@/biodata/defaults";
import type { BiodataProfile } from "@/biodata/types";
import type { PhotoInput, ProfileRepo, RepoErrorKind } from "./profile-repo";

// Autosave for the open draft (BUILD_PLAN A5, VISION §9). Framework-free so it can be tested with plain timers and
// a fake repo; React reads it through useSyncExternalStore (use-autosave.ts).
//
// The rules it keeps:
// - an edit changes the state at once; the write follows after a quiet pause (debounce), so typing isn't slowed;
// - "saved" appears only after the transaction has committed, never before (VISION §9);
// - one write at a time: edits made during a write are saved afterwards, against the revision that write produced;
// - if another tab saved first (`conflict`, D9) it stops for good, so neither tab overwrites the other; the editor
//   then offers "reload". Other errors keep the changes pending and are retried on the next edit or flush;
// - photo changes travel with the profile (D9, Step 3.1): a picture added or removed with an edit is written in the
//   same transaction as the profile that points at it, and stays pending until a save that included it commits.

export type AutosaveStatus =
  /** Nothing changed since the draft was opened. */
  | { state: "idle" }
  /** Unsaved changes are waiting for the pause or being written. */
  | { state: "saving" }
  /** Everything is on disk; `at` is when the last write committed. */
  | { state: "saved"; at: Date }
  | { state: "error"; kind: RepoErrorKind };

export interface AutosaveSnapshot {
  /** The latest profile: the editor renders from this. */
  profile: BiodataProfile;
  status: AutosaveStatus;
  /** True while there are edits not yet on disk (e.g. to warn before leaving). */
  unsaved: boolean;
}

/** Pictures to store or delete with an edit (PhotoField's put/delete, Step 3.1). */
export interface PhotoChanges {
  put?: PhotoInput[];
  delete?: string[];
}

export interface AutosaveController {
  getSnapshot(): AutosaveSnapshot;
  subscribe(listener: () => void): () => void;
  /** The new profile, with any pictures it now needs stored (`put`) or no longer uses (`delete`). */
  update(profile: BiodataProfile, photos?: PhotoChanges): void;
  /** Writes pending changes now; resolves when they are on disk or have failed (see the status). */
  flush(): Promise<void>;
  /** Flushes when the page is hidden or being unloaded; returns the cleanup that removes the listeners. */
  attachLifecycle(win: Window): () => void;
  /** Writes what is pending and stops scheduling further writes (the editor is closing this draft). */
  dispose(): Promise<void>;
}

export interface AutosaveOptions {
  repo: Pick<ProfileRepo, "save">;
  /** The profile as loaded from (or just created in) the database: its revision is the one on disk. */
  initial: BiodataProfile;
  debounceMs?: number;
  now?: Clock;
}

export function createAutosave({
  repo,
  initial,
  debounceMs = 400,
  now = systemClock,
}: AutosaveOptions): AutosaveController {
  let snapshot: AutosaveSnapshot = { profile: initial, status: { state: "idle" }, unsaved: false };
  const listeners = new Set<() => void>();

  // The revision on disk as far as this tab knows; every save must find exactly this one there.
  let revision = initial.revision;
  // Edits are counted so a finished write can tell whether newer edits arrived while it was running.
  let editCount = 0;
  let savedCount = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | undefined;
  // Set when a flush is asked for during a write, so the newer edits are written straight after it.
  let flushAgain = false;
  // After a conflict (or dispose) nothing is written any more.
  let stopped = false;
  let disposed = false;
  // Photo writes waiting for the next save, by id. A picture added and removed again before any save is still
  // deleted (harmless if it was never written), in case a save that included it is in flight.
  const pendingPuts = new Map<string, PhotoInput>();
  const pendingDeletes = new Set<string>();

  function set(next: Partial<AutosaveSnapshot>) {
    // A new object on every change, as useSyncExternalStore compares snapshots by identity.
    snapshot = { ...snapshot, ...next, unsaved: editCount !== savedCount };
    for (const listener of listeners) listener();
  }

  function clearTimer() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }

  async function saveOnce(): Promise<boolean> {
    const count = editCount;
    // A retry after a failed write (Try again) is a write in flight too: say so instead of the old error.
    if (snapshot.status.state !== "saving") set({ status: { state: "saving" } });
    const puts = [...pendingPuts.values()];
    const deletes = [...pendingDeletes];
    const photos = puts.length || deletes.length ? { put: puts, delete: deletes } : undefined;
    const result = await repo.save(snapshot.profile, photos ? { expectedRevision: revision, photos } : { expectedRevision: revision });
    if (!result.ok) {
      if (result.error.kind === "conflict") {
        stopped = true;
        clearTimer();
      }
      set({ status: { state: "error", kind: result.error.kind } });
      return false;
    }
    revision = result.profile.revision;
    savedCount = count;
    // Only what this save carried is done; anything queued while it ran waits for the next one.
    for (const put of puts) if (pendingPuts.get(put.id) === put) pendingPuts.delete(put.id);
    for (const id of deletes) pendingDeletes.delete(id);
    if (editCount === count) {
      // Nothing changed meanwhile: adopt the stored copy, so the profile in memory carries the new revision.
      set({ profile: result.profile, status: { state: "saved", at: now() } });
    } else {
      // Newer edits are still waiting: keep them, and keep saying "saving" until they are written too.
      set({ status: { state: "saving" } });
    }
    return true;
  }

  async function drain() {
    let ok = true;
    do {
      flushAgain = false;
      if (stopped || editCount === savedCount) return;
      ok = await saveOnce();
    } while (ok && flushAgain);
  }

  function flush(): Promise<void> {
    clearTimer();
    if (inFlight) {
      flushAgain = true;
      return inFlight;
    }
    inFlight = drain().finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  }

  return {
    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    update(profile, photos) {
      const photoChange = !!(photos?.put?.length || photos?.delete?.length);
      // The edit reducers return the same object for a no-op, so there is nothing to save.
      if (profile === snapshot.profile && !photoChange) return;
      for (const put of photos?.put ?? []) {
        pendingPuts.set(put.id, put);
        pendingDeletes.delete(put.id);
      }
      for (const id of photos?.delete ?? []) {
        pendingPuts.delete(id);
        pendingDeletes.add(id);
      }
      editCount++;
      // After a conflict the editor may still show typing, but the status stays on the conflict until reload.
      if (stopped || disposed) {
        set({ profile });
        return;
      }
      set({ profile, status: { state: "saving" } });
      clearTimer();
      timer = setTimeout(() => {
        timer = undefined;
        void flush();
      }, debounceMs);
    },

    flush,

    attachLifecycle(win) {
      // pagehide and a hidden tab are the last moments a browser reliably gives us; beforeunload isn't (VISION §9).
      const onVisibility = () => {
        if (win.document.visibilityState === "hidden") void flush();
      };
      const onPageHide = () => void flush();
      win.document.addEventListener("visibilitychange", onVisibility);
      win.addEventListener("pagehide", onPageHide);
      return () => {
        win.document.removeEventListener("visibilitychange", onVisibility);
        win.removeEventListener("pagehide", onPageHide);
      };
    },

    async dispose() {
      disposed = true;
      await flush();
    },
  };
}
