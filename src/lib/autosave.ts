import { systemClock, type Clock } from "@/biodata/defaults";
import type { BiodataProfile } from "@/biodata/types";
import type { ProfileRepo, RepoErrorKind } from "./profile-repo";

// Autosave for the open draft (BUILD_PLAN A5, VISION §9). Framework-free so it can be tested with plain timers and
// a fake repo; React reads it through useSyncExternalStore (use-autosave.ts).
//
// The rules it keeps:
// - an edit changes the state at once; the write follows after a quiet pause (debounce), so typing isn't slowed;
// - "saved" appears only after the transaction has committed, never before (VISION §9);
// - one write at a time: edits made during a write are saved afterwards, against the revision that write produced;
// - if another tab saved first (`conflict`, D9) it stops for good, so neither tab overwrites the other; the editor
//   then offers "reload". Other errors keep the changes pending and are retried on the next edit or flush.

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

export interface AutosaveController {
  getSnapshot(): AutosaveSnapshot;
  subscribe(listener: () => void): () => void;
  update(profile: BiodataProfile): void;
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
    const result = await repo.save(snapshot.profile, { expectedRevision: revision });
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

    update(profile) {
      // The edit reducers return the same object for a no-op, so there is nothing to save.
      if (profile === snapshot.profile) return;
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
