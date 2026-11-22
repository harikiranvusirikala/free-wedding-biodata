import "fake-indexeddb/auto";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProfile } from "@/biodata/defaults";
import type { BiodataProfile } from "@/biodata/types";
import { createAutosave, type AutosaveStatus } from "./autosave";
import { openDb, type BiodataDb } from "./db";
import { createProfileRepo, type ProfileRepo, type SaveOptions, type SaveResult } from "./profile-repo";
import { useAutosave } from "./use-autosave";

// Only setTimeout is faked: fake-indexeddb schedules its work with setImmediate and promises stay real, so real
// database writes still complete while the debounce is driven by hand.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

const opened: BiodataDb[] = [];
afterEach(() => {
  vi.useRealTimers();
  for (const db of opened.splice(0)) db.close();
});

const SAVED_AT = new Date("2026-11-21T10:00:00.000Z");
const now = () => SAVED_AT;

async function realRepo(name = `autosave-test-${crypto.randomUUID()}`) {
  const db = openDb(name);
  opened.push(db);
  const repo = createProfileRepo(db, { now });
  const profile = createProfile({ draftName: "Start" });
  return { db, repo, profile, name };
}

/** A repo whose saves wait until the test resolves them, to look at the status while a write is in flight. */
function deferredRepo() {
  const calls: { profile: BiodataProfile; options: SaveOptions; resolve: (result: SaveResult) => void }[] = [];
  const repo: Pick<ProfileRepo, "save"> = {
    save: (profile, options) => new Promise<SaveResult>((resolve) => calls.push({ profile, options, resolve })),
  };
  const succeed = (index: number) => {
    const call = calls[index];
    const revision = call.options.expectedRevision + 1;
    call.resolve({ ok: true, profile: { ...call.profile, revision, updatedAt: SAVED_AT.toISOString() } });
  };
  return { repo, calls, succeed };
}

/** Lets pending promise callbacks (and fake-indexeddb's setImmediate tasks) run. */
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

function renamed(profile: BiodataProfile, draftName: string): BiodataProfile {
  return { ...profile, draftName };
}

describe("autosave: debounce", () => {
  it("coalesces a burst of edits into one write, 400 ms after the last one", async () => {
    const { repo, profile } = await realRepo();
    await repo.create(profile);
    const save = vi.spyOn(repo, "save");
    const autosave = createAutosave({ repo, initial: profile, now });

    let current = profile;
    for (let i = 1; i <= 10; i++) {
      current = renamed(current, `Name ${i}`);
      autosave.update(current);
      vi.advanceTimersByTime(100);
    }
    expect(save).not.toHaveBeenCalled();
    expect(autosave.getSnapshot()).toMatchObject({ profile: current, status: { state: "saving" }, unsaved: true });

    vi.advanceTimersByTime(300);
    expect(save).toHaveBeenCalledTimes(1);
    await autosave.flush();

    const loaded = await repo.load(profile.id);
    expect(loaded.ok && loaded.profile).toMatchObject({ draftName: "Name 10", revision: 1 });
    expect(autosave.getSnapshot()).toMatchObject({ status: { state: "saved", at: SAVED_AT }, unsaved: false });
    expect(autosave.getSnapshot().profile.revision).toBe(1);
  });

  it("ignores an update that returns the same profile (a no-op edit)", () => {
    const { repo, calls } = deferredRepo();
    const profile = createProfile();
    const autosave = createAutosave({ repo, initial: profile });
    autosave.update(profile);
    vi.advanceTimersByTime(1000);
    expect(calls).toHaveLength(0);
    expect(autosave.getSnapshot().status).toEqual({ state: "idle" });
  });
});

describe("autosave: honest status", () => {
  it("never reads saved before the write resolves", async () => {
    const { repo, calls, succeed } = deferredRepo();
    const profile = createProfile();
    const autosave = createAutosave({ repo, initial: profile, now });
    const seen: AutosaveStatus["state"][] = [];
    autosave.subscribe(() => seen.push(autosave.getSnapshot().status.state));

    autosave.update(renamed(profile, "A"));
    vi.advanceTimersByTime(400);
    expect(calls).toHaveLength(1);
    await settle();
    expect(autosave.getSnapshot().status).toEqual({ state: "saving" });
    expect(seen).not.toContain("saved");

    succeed(0);
    await settle();
    expect(autosave.getSnapshot().status).toEqual({ state: "saved", at: SAVED_AT });
  });

  it("shows saved only once the real transaction has committed", async () => {
    const { repo, profile } = await realRepo();
    await repo.create(profile);
    let committed = false;
    const watched: Pick<ProfileRepo, "save"> = {
      save: async (p, options) => {
        const result = await repo.save(p, options);
        committed = result.ok;
        return result;
      },
    };
    const autosave = createAutosave({ repo: watched, initial: profile, now });
    const savedBeforeCommit: boolean[] = [];
    autosave.subscribe(() => {
      if (autosave.getSnapshot().status.state === "saved") savedBeforeCommit.push(!committed);
    });

    autosave.update(renamed(profile, "Typed"));
    await autosave.flush();
    expect(savedBeforeCommit).toEqual([false]);
  });

  it("saves edits made during a write afterwards, against the new revision", async () => {
    const { repo, calls, succeed } = deferredRepo();
    const profile = createProfile();
    const autosave = createAutosave({ repo, initial: profile, now });

    autosave.update(renamed(profile, "First"));
    const firstFlush = autosave.flush();
    autosave.update(renamed(profile, "Second"));
    expect(calls).toHaveLength(1);

    succeed(0);
    await settle();
    // The first write is on disk, but "Second" isn't yet: still saving, and the newer profile is kept.
    expect(autosave.getSnapshot()).toMatchObject({ status: { state: "saving" }, unsaved: true });
    expect(autosave.getSnapshot().profile.draftName).toBe("Second");
    await firstFlush;

    vi.advanceTimersByTime(400);
    expect(calls).toHaveLength(2);
    expect(calls[1].profile.draftName).toBe("Second");
    expect(calls[1].options.expectedRevision).toBe(1);
    succeed(1);
    await settle();
    expect(autosave.getSnapshot()).toMatchObject({ status: { state: "saved" }, unsaved: false, profile: { revision: 2 } });
  });

  it("writes the newer edits straight after the current write when flushed during it", async () => {
    const { repo, calls, succeed } = deferredRepo();
    const profile = createProfile();
    const autosave = createAutosave({ repo, initial: profile, now });

    autosave.update(renamed(profile, "First"));
    const first = autosave.flush();
    autosave.update(renamed(profile, "Second"));
    const second = autosave.flush();
    succeed(0);
    await settle();
    expect(calls).toHaveLength(2);
    expect(calls[1].options.expectedRevision).toBe(1);
    succeed(1);
    await Promise.all([first, second]);
    expect(autosave.getSnapshot()).toMatchObject({ status: { state: "saved" }, profile: { draftName: "Second", revision: 2 } });
  });
});

describe("autosave: failures", () => {
  it("stops for good when another tab saved first", async () => {
    const tabA = await realRepo();
    await tabA.repo.create(tabA.profile);
    const tabB = await realRepo(tabA.name);
    await tabB.repo.save(renamed(tabA.profile, "From B"), { expectedRevision: 0 });

    const save = vi.spyOn(tabA.repo, "save");
    const autosave = createAutosave({ repo: tabA.repo, initial: tabA.profile, now });
    autosave.update(renamed(tabA.profile, "From A"));
    await autosave.flush();
    expect(autosave.getSnapshot().status).toEqual({ state: "error", kind: "conflict" });

    // Later edits still show (the editor offers reload), but nothing more is written.
    autosave.update(renamed(tabA.profile, "Still typing"));
    vi.advanceTimersByTime(1000);
    await autosave.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(autosave.getSnapshot()).toMatchObject({
      status: { state: "error", kind: "conflict" },
      profile: { draftName: "Still typing" },
    });
    const stored = await tabB.repo.load(tabA.profile.id);
    expect(stored.ok && stored.profile.draftName).toBe("From B");
  });

  it("keeps changes pending after another error and retries on the next flush", async () => {
    const { repo, calls } = deferredRepo();
    const profile = createProfile();
    const autosave = createAutosave({ repo, initial: profile, now });

    autosave.update(renamed(profile, "A"));
    const failed = autosave.flush();
    calls[0].resolve({ ok: false, error: { kind: "quota", message: "full" } });
    await failed;
    expect(autosave.getSnapshot()).toMatchObject({ status: { state: "error", kind: "quota" }, unsaved: true });

    const retry = autosave.flush();
    expect(autosave.getSnapshot().status).toEqual({ state: "saving" });
    expect(calls).toHaveLength(2);
    expect(calls[1].options.expectedRevision).toBe(0);
    calls[1].resolve({ ok: true, profile: { ...calls[1].profile, revision: 1 } });
    await retry;
    expect(autosave.getSnapshot()).toMatchObject({ status: { state: "saved" }, unsaved: false });
  });
});

describe("autosave: page lifecycle", () => {
  function setVisibility(state: DocumentVisibilityState) {
    Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  }
  afterEach(() => {
    setVisibility("visible");
  });

  it("flushes when the page is hidden or unloaded, and stops listening after cleanup", async () => {
    const { repo, calls, succeed } = deferredRepo();
    const profile = createProfile();
    const autosave = createAutosave({ repo, initial: profile, now });
    const detach = autosave.attachLifecycle(window);

    autosave.update(renamed(profile, "A"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(calls).toHaveLength(0); // still visible: nothing to do yet
    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(calls).toHaveLength(1); // no timer advanced: the hidden page flushed at once
    succeed(0);
    await settle();

    autosave.update(renamed(profile, "B"));
    window.dispatchEvent(new Event("pagehide"));
    expect(calls).toHaveLength(2);
    succeed(1);
    await settle();

    detach();
    autosave.update(renamed(profile, "C"));
    window.dispatchEvent(new Event("pagehide"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(calls).toHaveLength(2);
  });

  it("dispose writes what is pending and schedules nothing afterwards", async () => {
    const { repo, calls, succeed } = deferredRepo();
    const profile = createProfile();
    const autosave = createAutosave({ repo, initial: profile, now });
    autosave.update(renamed(profile, "A"));
    const disposed = autosave.dispose();
    expect(calls).toHaveLength(1);
    succeed(0);
    await disposed;
    autosave.update(renamed(profile, "B"));
    vi.advanceTimersByTime(1000);
    expect(calls).toHaveLength(1);
  });
});

describe("autosave: photos (Step 3.1)", () => {
  const picture = (id: string, bytes = "jpeg") => ({ id, blob: new Blob([bytes], { type: "image/jpeg" }), mimeType: "image/jpeg", width: 600, height: 800 });
  const withPhoto = (profile: BiodataProfile, id: string | undefined): BiodataProfile =>
    id ? { ...profile, photo: { id, frame: "3:4", crop: { x: 0.5, y: 0.5, zoom: 1, rotation: 0 } } } : { ...profile, photo: undefined };

  it("writes a new picture in the same transaction as the profile that points at it", async () => {
    const { db, repo, profile } = await realRepo();
    await repo.create(profile);
    const save = vi.spyOn(repo, "save");
    const autosave = createAutosave({ repo, initial: profile, now });
    autosave.update(withPhoto(profile, "p1"), { put: [picture("p1")] });
    await autosave.flush();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][1]).toEqual({ expectedRevision: 0, photos: { put: [expect.objectContaining({ id: "p1" })], delete: [] } });
    expect((await db.photos.get("p1"))?.profileId).toBe(profile.id);
    expect(((await repo.load(profile.id)) as { profile: BiodataProfile }).profile.photo?.id).toBe("p1");

    // Later saves don't write the picture again; replacing it stores the new one and deletes the old one together.
    autosave.update(renamed(autosave.getSnapshot().profile, "Typed"));
    await autosave.flush();
    expect(save.mock.calls[1][1]).toEqual({ expectedRevision: 1 });
    autosave.update(withPhoto(autosave.getSnapshot().profile, "p2"), { put: [picture("p2")], delete: ["p1"] });
    await autosave.flush();
    expect(await db.photos.get("p1")).toBeUndefined();
    expect(await db.photos.get("p2")).toBeDefined();
  });

  it("deletes a removed picture, and counts a photo change as an edit even if the profile object is the same", async () => {
    const { db, repo, profile } = await realRepo();
    await repo.create(profile);
    const autosave = createAutosave({ repo, initial: profile, now });
    autosave.update(withPhoto(profile, "p1"), { put: [picture("p1")] });
    await autosave.flush();
    const current = autosave.getSnapshot().profile;
    autosave.update(withPhoto(current, undefined), { delete: ["p1"] });
    expect(autosave.getSnapshot().unsaved).toBe(true);
    await autosave.flush();
    expect(await db.photos.get("p1")).toBeUndefined();
    autosave.update(autosave.getSnapshot().profile, { delete: ["stray"] });
    expect(autosave.getSnapshot().unsaved).toBe(true);
    autosave.update(autosave.getSnapshot().profile);
    await autosave.flush();
    expect(autosave.getSnapshot().unsaved).toBe(false);
  });

  it("keeps photo writes pending after a failed save and sends them again", async () => {
    const { repo, calls } = deferredRepo();
    const profile = createProfile();
    const autosave = createAutosave({ repo, initial: profile, now });
    autosave.update(withPhoto(profile, "p1"), { put: [picture("p1")] });
    const failed = autosave.flush();
    calls[0].resolve({ ok: false, error: { kind: "quota", message: "full" } });
    await failed;
    const retry = autosave.flush();
    expect(calls[1].options.photos?.put?.map((p) => p.id)).toEqual(["p1"]);
    calls[1].resolve({ ok: true, profile: { ...calls[1].profile, revision: 1 } });
    await retry;
    autosave.update(renamed(autosave.getSnapshot().profile, "Next"));
    const next = autosave.flush();
    expect(calls[2].options.photos).toBeUndefined();
    calls[2].resolve({ ok: true, profile: { ...calls[2].profile, revision: 2 } });
    await next;
  });

  it("a picture removed while the save that adds it is in flight is deleted by the next save", async () => {
    const { repo, calls, succeed } = deferredRepo();
    const profile = createProfile();
    const autosave = createAutosave({ repo, initial: profile, now });
    autosave.update(withPhoto(profile, "p1"), { put: [picture("p1")] });
    const first = autosave.flush();
    expect(calls[0].options.photos).toEqual({ put: [expect.objectContaining({ id: "p1" })], delete: [] });
    autosave.update(withPhoto(profile, undefined), { delete: ["p1"] });
    succeed(0);
    await first;
    const second = autosave.flush();
    expect(calls[1].options.photos).toEqual({ put: [], delete: ["p1"] });
    succeed(1);
    await second;
    expect(autosave.getSnapshot().unsaved).toBe(false);
  });

  it("a picture added and removed before any save is only deleted, never written", async () => {
    const { repo, calls, succeed } = deferredRepo();
    const profile = createProfile();
    const autosave = createAutosave({ repo, initial: profile, now });
    autosave.update(withPhoto(profile, "p1"), { put: [picture("p1")] });
    autosave.update(withPhoto(profile, "p2"), { put: [picture("p2")], delete: ["p1"] });
    const flushed = autosave.flush();
    expect(calls[0].options.photos).toEqual({ put: [expect.objectContaining({ id: "p2" })], delete: ["p1"] });
    expect(calls[0].profile.photo?.id).toBe("p2");
    succeed(0);
    await flushed;
  });
});

describe("useAutosave", () => {
  it("re-renders with the latest profile and status", async () => {
    const { repo, succeed } = deferredRepo();
    const profile = createProfile();
    const autosave = createAutosave({ repo, initial: profile, now });
    const { result } = renderHook(() => useAutosave(autosave));
    expect(result.current.status).toEqual({ state: "idle" });

    act(() => autosave.update(renamed(profile, "Typed")));
    expect(result.current).toMatchObject({ profile: { draftName: "Typed" }, status: { state: "saving" } });

    const flushed = autosave.flush();
    await act(async () => {
      succeed(0);
      await flushed;
    });
    expect(result.current.status).toEqual({ state: "saved", at: SAVED_AT });
  });
});
