import "fake-indexeddb/auto";
import { Blob as NodeBlob } from "node:buffer";
import { afterEach, describe, expect, it } from "vitest";
import { createProfile } from "@/biodata/defaults";
import type { BiodataProfile } from "@/biodata/types";
import { openDb, type BiodataDb } from "./db";
import { createProfileRepo, toRepoError, type PhotoInput } from "./profile-repo";

// jsdom's Blob can't be structured-cloned by fake-indexeddb (it comes back as {}), while Node's can; a real
// browser stores either. So the tests use Node's Blob.
const blob = (text: string) => new NodeBlob([text], { type: "image/jpeg" }) as unknown as Blob;
const photo = (id: string, text = id): PhotoInput => ({
  id,
  blob: blob(text),
  mimeType: "image/jpeg",
  width: 30,
  height: 40,
});

const SAVED_AT = new Date("2026-11-21T10:00:00.000Z");
const now = () => SAVED_AT;

const opened: BiodataDb[] = [];
let dbCount = 0;
function freshName() {
  return `repo-test-${++dbCount}-${crypto.randomUUID()}`;
}
function setup(name = freshName()) {
  const db = openDb(name);
  opened.push(db);
  return { db, repo: createProfileRepo(db, { now }), name };
}

afterEach(() => {
  for (const db of opened.splice(0)) db.close();
});

function newProfile(draftName = "Mine", at = "2026-11-20T08:00:00.000Z"): BiodataProfile {
  return createProfile({ draftName, now: () => new Date(at) });
}

describe("profile repo: save and load", () => {
  it("round-trips a created draft and bumps the revision on every save", async () => {
    const { repo } = setup();
    const profile = newProfile();
    expect(await repo.create(profile)).toEqual({ ok: true, profile });

    const loaded = await repo.load(profile.id);
    expect(loaded).toEqual({ ok: true, profile, fromVersion: 1 });

    const first = await repo.save({ ...profile, draftName: "Renamed" }, { expectedRevision: 0 });
    expect(first.ok && first.profile).toMatchObject({ revision: 1, draftName: "Renamed", updatedAt: SAVED_AT.toISOString() });

    const second = await repo.save({ ...profile, draftName: "Again" }, { expectedRevision: 1 });
    expect(second.ok && second.profile.revision).toBe(2);
    const reloaded = await repo.load(profile.id);
    expect(reloaded.ok && reloaded.profile).toMatchObject({ revision: 2, draftName: "Again" });
  });

  it("reports a missing draft", async () => {
    const { repo } = setup();
    const result = await repo.load("nope");
    expect(result.ok === false && result.error.kind).toBe("missing");
  });

  it("refuses to create a draft whose id is taken, leaving the first one alone", async () => {
    const { repo } = setup();
    const profile = newProfile("First");
    await repo.create(profile);
    const again = await repo.create({ ...profile, draftName: "Second" });
    expect(again.ok).toBe(false);
    const loaded = await repo.load(profile.id);
    expect(loaded.ok && loaded.profile.draftName).toBe("First");
  });
});

describe("profile repo: two tabs (D9)", () => {
  it("returns conflict to the tab whose revision is stale and keeps the other tab's save", async () => {
    const tabA = setup();
    const tabB = setup(tabA.name);
    const profile = newProfile();
    await tabA.repo.create(profile);

    const fromB = await tabB.repo.save({ ...profile, draftName: "From B" }, { expectedRevision: 0 });
    expect(fromB.ok).toBe(true);

    const fromA = await tabA.repo.save({ ...profile, draftName: "From A" }, { expectedRevision: 0 });
    expect(fromA.ok === false && fromA.error.kind).toBe("conflict");
    const stored = await tabA.repo.load(profile.id);
    expect(stored.ok && stored.profile).toMatchObject({ draftName: "From B", revision: 1 });
  });

  it("treats a draft deleted in another tab as a conflict instead of bringing it back", async () => {
    const { repo } = setup();
    const profile = newProfile();
    await repo.create(profile);
    await repo.remove(profile.id);
    const result = await repo.save(profile, { expectedRevision: 0 });
    expect(result.ok === false && result.error.kind).toBe("conflict");
    expect((await repo.load(profile.id)).ok).toBe(false);
  });
});

describe("profile repo: broken records are kept and reported", () => {
  it("lists a corrupted record as broken, never deletes it and never overwrites it", async () => {
    const { db, repo } = setup();
    const good = newProfile("Good", "2026-11-19T08:00:00.000Z");
    const newer = newProfile("Newer", "2026-11-20T08:00:00.000Z");
    await repo.create(good);
    await repo.create(newer);
    const garbage = { id: "broken-1", schemaVersion: 1, draftName: "Old draft", sections: "not a list", revision: 3 };
    await db.profiles.put(garbage as unknown as BiodataProfile);

    const listed = await repo.list();
    expect(listed.ok && listed.value.map((d) => [d.id, d.ok])).toEqual([
      [newer.id, true],
      [good.id, true],
      ["broken-1", false],
    ]);
    const broken = listed.ok ? listed.value[2] : undefined;
    expect(broken).toMatchObject({ draftName: "Old draft", updatedAt: "", error: { code: "invalid" } });

    const loaded = await repo.load("broken-1");
    expect(loaded.ok === false && loaded.error).toMatchObject({ kind: "broken", code: "invalid" });

    // A tab can't save over it without holding its exact revision, and a record with no usable revision can never
    // be saved over at all. The raw records are still exactly as they were.
    const stale = await repo.save({ ...good, id: "broken-1" }, { expectedRevision: 0 });
    expect(stale.ok === false && stale.error.kind).toBe("conflict");
    const noRevision = { id: "broken-2", schemaVersion: 99 };
    await db.profiles.put(noRevision as unknown as BiodataProfile);
    for (const expectedRevision of [0, 1, Number.NaN]) {
      const result = await repo.save({ ...good, id: "broken-2" }, { expectedRevision });
      expect(result.ok === false && result.error.kind).toBe("conflict");
    }
    expect(await db.profiles.get("broken-1")).toEqual(garbage);
    expect(await db.profiles.get("broken-2")).toEqual(noRevision);
    const tooNew = await repo.load("broken-2");
    expect(tooNew.ok === false && tooNew.error).toMatchObject({ kind: "broken", code: "too-new" });
  });
});

describe("profile repo: photos", () => {
  it("writes the profile and its photos together, and deletes only this draft's photos", async () => {
    const { db, repo } = setup();
    const mine = newProfile("Mine");
    const other = newProfile("Other");
    await repo.create(mine);
    await repo.create(other);
    await repo.save(other, { expectedRevision: 0, photos: { put: [photo("other-photo")] } });

    const result = await repo.save(mine, { expectedRevision: 0, photos: { put: [photo("p1", "jpeg bytes")] } });
    expect(result.ok).toBe(true);
    const stored = await repo.getPhoto("p1");
    expect(stored.ok && stored.value).toMatchObject({
      id: "p1",
      profileId: mine.id,
      width: 30,
      height: 40,
      updatedAt: SAVED_AT.toISOString(),
    });
    expect(stored.ok && (await stored.value?.blob.text())).toBe("jpeg bytes");

    await repo.save(mine, { expectedRevision: 1, photos: { delete: ["p1", "other-photo"] } });
    expect(await db.photos.get("p1")).toBeUndefined();
    expect(await db.photos.get("other-photo")).toBeDefined();
  });

  it("leaves the profile unwritten when the photo write fails in the same transaction", async () => {
    const { db, repo } = setup();
    const profile = newProfile("Before");
    await repo.create(profile);
    // A function can't be stored in IndexedDB: the photo put throws DataCloneError mid-transaction.
    const unstorable = { ...photo("p1"), blob: (() => "not a blob") as unknown as Blob };

    const result = await repo.save({ ...profile, draftName: "After" }, { expectedRevision: 0, photos: { put: [unstorable] } });
    expect(result.ok === false && result.error.kind).toBe("unknown");
    expect(await db.profiles.get(profile.id)).toEqual(profile);
    expect(await db.photos.count()).toBe(0);
  });

  it("maps a full disk to quota and rolls the whole save back", async () => {
    const { db, repo } = setup();
    const profile = newProfile("Before");
    await repo.create(profile);
    db.photos.hook("creating", () => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });

    const result = await repo.save({ ...profile, draftName: "After" }, { expectedRevision: 0, photos: { put: [photo("p1")] } });
    expect(result.ok === false && result.error.kind).toBe("quota");
    expect(await db.profiles.get(profile.id)).toEqual(profile);
  });
});

describe("profile repo: remove and last opened", () => {
  it("deletes a draft with all its photos and forgets it as last opened", async () => {
    const { db, repo } = setup();
    const mine = newProfile("Mine");
    const other = newProfile("Other");
    await repo.create(mine);
    await repo.create(other);
    await repo.save(mine, { expectedRevision: 0, photos: { put: [photo("a"), photo("b")] } });
    await repo.save(other, { expectedRevision: 0, photos: { put: [photo("c")] } });
    await repo.setLastOpened(mine.id);
    expect(await repo.getLastOpened()).toEqual({ ok: true, value: mine.id });

    expect(await repo.remove(mine.id)).toEqual({ ok: true, value: undefined });
    expect((await repo.load(mine.id)).ok).toBe(false);
    expect((await db.photos.toArray()).map((p) => p.id)).toEqual(["c"]);
    expect(await repo.getLastOpened()).toEqual({ ok: true, value: undefined });
  });

  it("keeps last opened when another draft is removed", async () => {
    const { repo } = setup();
    const mine = newProfile("Mine");
    const other = newProfile("Other");
    await repo.create(mine);
    await repo.create(other);
    await repo.setLastOpened(mine.id);
    await repo.remove(other.id);
    expect(await repo.getLastOpened()).toEqual({ ok: true, value: mine.id });
  });
});

describe("profile repo: errors", () => {
  it("reports unavailable when IndexedDB can't be opened (private mode, storage disabled)", async () => {
    const refusing = {
      open() {
        throw new DOMException("The database can't be opened here.", "InvalidStateError");
      },
    } as unknown as IDBFactory;
    const db = openDb(freshName(), { indexedDB: refusing, IDBKeyRange });
    const repo = createProfileRepo(db);

    const loaded = await repo.load("x");
    expect(loaded.ok === false && loaded.error.kind).toBe("unavailable");
    const listed = await repo.list();
    expect(listed.ok === false && listed.error.kind).toBe("unavailable");
    const saved = await repo.save(newProfile(), { expectedRevision: 0 });
    expect(saved.ok === false && saved.error.kind).toBe("unavailable");
  });

  it("finds a quota error however Dexie wraps it", () => {
    const quota = new DOMException("full", "QuotaExceededError");
    expect(toRepoError(quota).kind).toBe("quota");
    expect(toRepoError({ name: "AbortError", message: "aborted", inner: quota }).kind).toBe("quota");
    expect(toRepoError({ name: "OpenFailedError", inner: { name: "QuotaExceededError" } }).kind).toBe("quota");
    expect(toRepoError({ name: "BulkError", failures: [quota] }).kind).toBe("quota");
    expect(toRepoError(new Error("x", { cause: quota })).kind).toBe("quota");
  });

  it("maps blocked or missing IndexedDB to unavailable and anything else to unknown", () => {
    expect(toRepoError({ name: "MissingAPIError" }).kind).toBe("unavailable");
    expect(toRepoError({ name: "DatabaseClosedError", inner: { name: "SecurityError" } }).kind).toBe("unavailable");
    expect(toRepoError(new TypeError("boom")).kind).toBe("unknown");
    expect(toRepoError("a string").kind).toBe("unknown");
  });
});

describe("profile repo: duplicate (Step 1.4)", () => {
  const crop = { x: 0, y: 0, zoom: 1, rotation: 0 as const };

  it("copies the draft and its photos under new ids, with the given name, leaving the original alone", async () => {
    const { db, repo } = setup();
    const source = { ...newProfile("Original"), photo: { id: "main", crop, frame: "3:4" as const }, horoscopeChart: { id: "chart", crop } };
    await repo.create(source);
    const saved = await repo.save(source, { expectedRevision: 0, photos: { put: [photo("main", "face"), photo("chart", "chart")] } });
    expect(saved.ok).toBe(true);

    const result = await repo.duplicate(source.id, { draftName: "Original (copy)" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const copy = result.profile;
    expect(copy.id).not.toBe(source.id);
    expect(copy).toMatchObject({ draftName: "Original (copy)", revision: 0, createdAt: SAVED_AT.toISOString(), updatedAt: SAVED_AT.toISOString() });
    expect(copy.sections).toEqual(source.sections);
    expect(copy.photo?.id).not.toBe("main");
    expect(copy.horoscopeChart?.id).not.toBe("chart");

    const copiedPhoto = await db.photos.get(copy.photo!.id);
    expect(copiedPhoto).toMatchObject({ profileId: copy.id, width: 30 });
    expect(await copiedPhoto?.blob.text()).toBe("face");
    expect(await db.photos.where("profileId").equals(copy.id).count()).toBe(2);

    // Each draft owns its photos: deleting the copy leaves the original's pictures.
    await repo.remove(copy.id);
    expect(await db.photos.where("profileId").equals(source.id).count()).toBe(2);
    const original = await repo.load(source.id);
    expect(original.ok && original.profile).toMatchObject({ draftName: "Original", photo: { id: "main" }, revision: 1 });
  });

  it("the copy is a draft like any other: it loads, lists and saves", async () => {
    const { repo } = setup();
    const source = newProfile("Mine");
    await repo.create(source);
    const result = await repo.duplicate(source.id, { draftName: "Mine (copy)" });
    if (!result.ok) throw new Error("not copied");
    expect((await repo.load(result.profile.id)).ok).toBe(true);
    const listed = await repo.list();
    expect(listed.ok && listed.value.map((d) => d.draftName).sort()).toEqual(["Mine", "Mine (copy)"]);
    expect((await repo.save(result.profile, { expectedRevision: 0 })).ok).toBe(true);
  });

  it("refuses to copy a missing or broken draft", async () => {
    const { db, repo } = setup();
    const missing = await repo.duplicate("nope", { draftName: "x" });
    expect(missing.ok === false && missing.error.kind).toBe("missing");
    await db.profiles.put({ id: "broken", schemaVersion: 1, revision: 1, sections: 3 } as unknown as BiodataProfile);
    const broken = await repo.duplicate("broken", { draftName: "x" });
    expect(broken.ok === false && broken.error).toMatchObject({ kind: "broken", code: "invalid" });
    expect(await db.profiles.count()).toBe(1);
  });

  it("lists each draft with its Full name, for its automatic name", async () => {
    const { repo } = setup();
    const profile = newProfile("");
    const sections = profile.sections.map((s) =>
      s.kind === "fields" ? { ...s, fields: s.fields.map((f) => (f.key === "fullName" ? { ...f, value: "Asha Rani" } : f)) } : s,
    );
    await repo.create({ ...profile, sections });
    const listed = await repo.list();
    expect(listed.ok && listed.value[0]).toMatchObject({ ok: true, draftName: "", fullName: "Asha Rani" });
  });
});
