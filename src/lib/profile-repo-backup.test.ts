import "fake-indexeddb/auto";
import { Blob as NodeBlob } from "node:buffer";
import { afterEach, describe, expect, it } from "vitest";
import { createProfile } from "@/biodata/defaults";
import { MAX_EXTRA_PHOTOS } from "@/biodata/types";
import { photoIdsOf } from "@/biodata/photo-refs";
import type { BiodataProfile } from "@/biodata/types";
import { parseBackup } from "./backup";
import { openDb, type BiodataDb } from "./db";
import { createProfileRepo, type ImportDraft, type ImportOptions, type PhotoInput } from "./profile-repo";

// Step 5.1: the repo's side of backups: reading every draft with its pictures for a file, and writing a file's
// drafts back, add or replace, one transaction per draft. (Node's Blob: jsdom's can't be stored by fake-indexeddb.)

const crop = { x: 0.5, y: 0.5, zoom: 1, rotation: 0 } as const;
const blob = (text: string) => new NodeBlob([text], { type: "image/jpeg" }) as unknown as Blob;
const photo = (id: string, text = id, height = 40): PhotoInput => ({ id, blob: blob(text), mimeType: "image/jpeg", width: 30, height });
const text = async (b: Blob) => b.text();

const NOW = new Date("2026-11-22T09:00:00.000Z");
const opened: BiodataDb[] = [];
let dbCount = 0;
function setup() {
  const db = openDb(`backup-test-${++dbCount}-${crypto.randomUUID()}`);
  opened.push(db);
  const repo = createProfileRepo(db, { now: () => NOW });
  /** Stores a draft with pictures, as the editor leaves them (the draft's own times are kept). */
  async function store(profile: BiodataProfile, photos: PhotoInput[] = []) {
    expect((await repo.create(profile)).ok).toBe(true);
    await db.photos.bulkPut(photos.map((p) => ({ ...p, profileId: profile.id, updatedAt: profile.updatedAt })));
  }
  return { db, repo, store };
}
afterEach(() => {
  for (const db of opened.splice(0)) db.close();
});

function draft(name: string, at = "2026-11-20T08:00:00.000Z", change: (p: BiodataProfile) => void = () => undefined): BiodataProfile {
  const profile = createProfile({ draftName: name, now: () => new Date(at) });
  change(profile);
  return profile;
}
/** A draft pointing at a main picture and a second one. */
const pictured = (name: string, main: string, second?: string, at?: string) =>
  draft(name, at, (p) => {
    p.photo = { id: main, frame: "3:4", crop };
    if (second) p.secondPhoto = { id: second, crop };
  });

const options = (mode: ImportOptions["mode"]): ImportOptions => ({ mode, restoredName: (p) => `${p.draftName || "Untitled"} (restored)` });

describe("listForBackup", () => {
  it("returns every readable draft with the pictures it points at, newest first", async () => {
    const { db, repo, store } = setup();
    const older = pictured("Older", "o-1", undefined, "2026-11-10T08:00:00.000Z");
    const newer = pictured("Newer", "n-1", "n-2", "2026-11-21T08:00:00.000Z");
    await store(older, [photo("o-1", "older pic")]);
    await store(newer, [photo("n-1", "newer main"), photo("n-2", "newer second"), photo("n-orphan", "not used by the draft")]);
    await db.profiles.put({ id: "broken", schemaVersion: 1, revision: 3, draftName: "Damaged" } as unknown as BiodataProfile);

    const result = await repo.listForBackup();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.entries.map((e) => e.profile.draftName)).toEqual(["Newer", "Older"]);
    expect(result.value.entries[0].photos.map((p) => p.id).sort()).toEqual(["n-1", "n-2"]);
    expect(await text(result.value.entries[0].photos.find((p) => p.id === "n-1")!.blob)).toBe("newer main");
    expect(result.value.entries[0].photos[0]).toEqual({ id: expect.any(String), blob: expect.anything(), mimeType: "image/jpeg", width: 30, height: 40 });
    expect(result.value.unreadable).toEqual([{ id: "broken", draftName: "Damaged" }]);
    // The damaged record is untouched.
    expect(await db.profiles.get("broken")).toMatchObject({ draftName: "Damaged" });
  });

  it("can be limited to some drafts, ignoring ids that aren't there", async () => {
    const { repo, store } = setup();
    const a = pictured("A", "a-1");
    const b = draft("B");
    await store(a, [photo("a-1")]);
    await store(b);
    const result = await repo.listForBackup([a.id, "no-such-draft"]);
    expect(result.ok && result.value.entries.map((e) => e.profile.draftName)).toEqual(["A"]);
  });

  it("an empty database gives an empty backup source", async () => {
    const { repo } = setup();
    expect(await repo.listForBackup()).toEqual({ ok: true, value: { entries: [], unreadable: [] } });
  });

  it("what it reads makes a file that comes back as the same drafts", async () => {
    const { repo, store } = setup();
    const a = pictured("A", "a-1", "a-2");
    await store(a, [photo("a-1", "one"), photo("a-2", "two")]);
    const listed = await repo.listForBackup();
    if (!listed.ok) throw new Error("not read");
    const { buildBackup } = await import("./backup");
    const file = await buildBackup(listed.value.entries, NOW);
    const parsed = await parseBackup(JSON.stringify(file));
    // Not real images, so the pictures are dropped by the checks; the drafts themselves come back unchanged.
    expect(parsed.ok && parsed.drafts[0].profile.draftName).toBe("A");
    expect(parsed.ok && parsed.warnings.filter((w) => w.kind === "photoDropped")).toHaveLength(2);
  });
});

describe("importDrafts: add", () => {
  it("adds each draft as a new draft: a new id, revision 0, new picture ids, everything else as in the file", async () => {
    const { db, repo } = setup();
    const source = pictured("Sai Teja Mandapati", "file-photo-1", "file-photo-2", "2026-11-15T08:00:00.000Z");
    source.revision = 41;
    const items = await repo.importDrafts([{ profile: source, photos: [photo("file-photo-1", "main bytes"), photo("file-photo-2", "second bytes")] }], options("add"));

    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item).toMatchObject({ ok: true, status: "added", sourceId: source.id, draftName: "Sai Teja Mandapati" });
    if (!item.ok) return;
    expect(item.id).not.toBe(source.id);

    const stored = await repo.load(item.id);
    expect(stored.ok && stored.profile).toMatchObject({ id: item.id, revision: 0, draftName: "Sai Teja Mandapati", createdAt: source.createdAt, updatedAt: "2026-11-15T08:00:00.000Z" });
    if (!stored.ok) return;
    const ids = photoIdsOf(stored.profile);
    expect(ids).toHaveLength(2);
    expect(ids).not.toContain("file-photo-1");
    expect(ids).not.toContain("file-photo-2");
    const records = await db.photos.where("profileId").equals(item.id).toArray();
    expect(records.map((r) => r.id).sort()).toEqual([...ids].sort());
    const main = await db.photos.get(stored.profile.photo!.id);
    expect(await text(main!.blob)).toBe("main bytes");
    expect(main).toMatchObject({ profileId: item.id, mimeType: "image/jpeg", width: 30, height: 40 });
    // Sections, fields and options come over as they were.
    expect(stored.profile.sections).toEqual(source.sections);
    expect(stored.profile.options).toEqual(source.options);
  });

  it("gives every kind of photo reference a new id (main, second, extra pages, horoscope chart), and rewrites them all", async () => {
    const { db, repo } = setup();
    const extras = Array.from({ length: MAX_EXTRA_PHOTOS }, (_, i) => i + 1); // as many as a draft may hold
    const source = draft("Every photo", undefined, (p) => {
      p.photo = { id: "main", frame: "3:4", crop };
      p.secondPhoto = { id: "second", crop };
      p.photoPages = { perPage: 4, photos: extras.map((n) => ({ id: `extra-${n}`, crop })) };
      p.horoscopeChart = { id: "chart", crop };
    });
    const fileIds = photoIdsOf(source);
    expect(fileIds).toHaveLength(extras.length + 3);
    const items = await repo.importDrafts([{ profile: source, photos: fileIds.map((id) => photo(id, `bytes of ${id}`)) }], options("add"));
    const item = items[0];
    if (!item.ok) throw new Error("not imported");
    const stored = await repo.load(item.id);
    if (!stored.ok) throw new Error("not loaded");
    const newIds = photoIdsOf(stored.profile);
    expect(newIds).toHaveLength(fileIds.length);
    expect(new Set(newIds).size).toBe(fileIds.length);
    for (const id of fileIds) expect(newIds).not.toContain(id);
    expect(stored.profile.photoPages?.photos).toHaveLength(extras.length);
    expect(stored.profile.photoPages?.perPage).toBe(4);
    // Each new id holds the bytes of the picture it replaces, in the same place.
    const bytes = async (id: string) => text((await db.photos.get(id))!.blob);
    expect(await bytes(stored.profile.photo!.id)).toBe("bytes of main");
    expect(await bytes(stored.profile.secondPhoto!.id)).toBe("bytes of second");
    expect(await bytes(stored.profile.horoscopeChart!.id)).toBe("bytes of chart");
    expect(await Promise.all(stored.profile.photoPages!.photos.map((p) => bytes(p.id)))).toEqual(extras.map((n) => `bytes of extra-${n}`));
    expect((await db.photos.where("profileId").equals(item.id).toArray()).map((p) => p.id).sort()).toEqual([...newIds].sort());
  });

  it("replacing a draft that has every kind of picture removes all of its old pictures", async () => {
    const { db, repo, store } = setup();
    const mine = draft("Mine", undefined, (p) => {
      p.photo = { id: "old-main", frame: "3:4", crop };
      p.secondPhoto = { id: "old-second", crop };
      p.photoPages = { perPage: 2, photos: [{ id: "old-extra-1", crop }, { id: "old-extra-2", crop }] };
      p.horoscopeChart = { id: "old-chart", crop };
    });
    await store(mine, photoIdsOf(mine).map((id) => photo(id)));
    const fromFile = pictured("From the file", "file-main");
    fromFile.id = mine.id;
    await repo.importDrafts([{ profile: fromFile, photos: [photo("file-main")] }], options("replace"));
    expect(await db.photos.count()).toBe(1);
    const after = await repo.load(mine.id);
    expect(after.ok && photoIdsOf(after.profile)).toHaveLength(1);
  });

  it("never touches what is already stored, not even a draft with the same id", async () => {
    const { db, repo, store } = setup();
    const mine = pictured("Mine", "mine-1");
    await store(mine, [photo("mine-1", "my picture")]);
    const before = await db.profiles.get(mine.id);

    const items = await repo.importDrafts([{ profile: { ...mine, draftName: "From the file" }, photos: [photo("mine-1", "the file's picture")] }], options("add"));
    expect(items[0]).toMatchObject({ ok: true, status: "added" });
    expect(await db.profiles.get(mine.id)).toEqual(before);
    expect(await text((await db.photos.get("mine-1"))!.blob)).toBe("my picture");
    expect(await db.profiles.count()).toBe(2);
    expect(await db.photos.count()).toBe(2);
  });

  it("names a draft '(restored)' only when the same draft is already here", async () => {
    const { repo, store } = setup();
    const here = draft("Here");
    await store(here);
    const elsewhere = draft("Brand new");
    const items = await repo.importDrafts(
      [{ profile: { ...here, draftName: "Here" }, photos: [] }, { profile: elsewhere, photos: [] }],
      options("add"),
    );
    expect(items.map((i) => i.ok && i.draftName)).toEqual(["Here (restored)", "Brand new"]);
    const stored = await repo.load((items[0] as { id: string }).id);
    expect(stored.ok && stored.profile.draftName).toBe("Here (restored)");
  });

  it("drops a reference to a picture it wasn't given", async () => {
    const { repo } = setup();
    const source = pictured("Dangling", "not-sent", "sent");
    const items = await repo.importDrafts([{ profile: source, photos: [photo("sent")] }], options("add"));
    const id = (items[0] as { id: string }).id;
    const stored = await repo.load(id);
    expect(stored.ok && stored.profile.photo).toBeUndefined();
    expect(stored.ok && stored.profile.secondPhoto?.id).not.toBe("sent");
    expect(stored.ok && photoIdsOf(stored.profile)).toHaveLength(1);
  });

  it("a stale tab that had a draft open is not affected, and importing twice gives two drafts", async () => {
    const { repo } = setup();
    const source = draft("Twice");
    await repo.importDrafts([{ profile: source, photos: [] }], options("add"));
    await repo.importDrafts([{ profile: source, photos: [] }], options("add"));
    const listed = await repo.list();
    expect(listed.ok && listed.value).toHaveLength(2);
  });
});

describe("importDrafts: replace", () => {
  it("overwrites the stored draft with the same id and its pictures, and bumps the revision", async () => {
    const { db, repo, store } = setup();
    const mine = pictured("Mine", "old-1", "old-2");
    await store(mine, [photo("old-1", "old main"), photo("old-2", "old second")]);
    await repo.save({ ...mine, draftName: "Mine, edited" }, { expectedRevision: 0 });
    const stored = await repo.load(mine.id);
    expect(stored.ok && stored.profile.revision).toBe(1);

    const fromFile = pictured("From the file", "file-1", undefined, "2026-11-01T08:00:00.000Z");
    fromFile.id = mine.id;
    fromFile.revision = 999;
    const items = await repo.importDrafts([{ profile: fromFile, photos: [photo("file-1", "file main")] }], options("replace"));
    expect(items[0]).toMatchObject({ ok: true, status: "replaced", id: mine.id, sourceId: mine.id });

    const after = await repo.load(mine.id);
    expect(after.ok && after.profile).toMatchObject({ id: mine.id, draftName: "From the file", revision: 2, updatedAt: "2026-11-01T08:00:00.000Z" });
    if (!after.ok) return;
    expect(photoIdsOf(after.profile)).toHaveLength(1);
    expect(photoIdsOf(after.profile)[0]).not.toBe("file-1");
    expect(await db.photos.get("old-1")).toBeUndefined();
    expect(await db.photos.get("old-2")).toBeUndefined();
    expect(await text((await db.photos.get(after.profile.photo!.id))!.blob)).toBe("file main");
    expect(await db.profiles.count()).toBe(1);
    expect(await db.photos.count()).toBe(1);
  });

  it("makes a tab that has the draft open stop, so it can't write over the restored version (D9)", async () => {
    const { repo, store } = setup();
    const mine = draft("Mine");
    await store(mine);
    await repo.importDrafts([{ profile: { ...mine, draftName: "Restored" }, photos: [] }], options("replace"));
    const stale = await repo.save({ ...mine, draftName: "Typed in the old tab" }, { expectedRevision: 0 });
    expect(stale.ok === false && stale.error.kind).toBe("conflict");
    const stored = await repo.load(mine.id);
    expect(stored.ok && stored.profile.draftName).toBe("Restored");
  });

  it("adds drafts it doesn't have, under their own id, so importing the same file again replaces them", async () => {
    const { repo } = setup();
    const source = draft("Came from elsewhere");
    const first = await repo.importDrafts([{ profile: source, photos: [] }], options("replace"));
    expect(first[0]).toMatchObject({ ok: true, status: "added", id: source.id });
    const again = await repo.importDrafts([{ profile: { ...source, draftName: "Changed in the file" }, photos: [] }], options("replace"));
    expect(again[0]).toMatchObject({ ok: true, status: "replaced", id: source.id });
    const stored = await repo.load(source.id);
    expect(stored.ok && stored.profile).toMatchObject({ draftName: "Changed in the file", revision: 1 });
  });

  it("gives a draft whose id is odd a new id instead of trusting it", async () => {
    const { repo } = setup();
    for (const odd of ["__proto__", "../../etc/passwd", "a b", "x".repeat(300), "<script>"]) {
      const items = await repo.importDrafts([{ profile: { ...draft("Odd"), id: odd }, photos: [] }], options("replace"));
      const item = items[0];
      expect(item).toMatchObject({ ok: true, status: "added", sourceId: odd });
      expect(item.ok && item.id).not.toBe(odd);
    }
  });

  it("never lets a file's picture id overwrite another draft's picture", async () => {
    const { db, repo, store } = setup();
    const other = pictured("Other", "shared-id");
    await store(other, [photo("shared-id", "other's picture")]);
    const mine = pictured("Mine", "mine-1");
    await store(mine, [photo("mine-1")]);

    const fromFile = pictured("Replacing", "shared-id");
    fromFile.id = mine.id;
    await repo.importDrafts([{ profile: fromFile, photos: [photo("shared-id", "from the file")] }], options("replace"));
    expect(await text((await db.photos.get("shared-id"))!.blob)).toBe("other's picture");
    expect((await db.photos.get("shared-id"))!.profileId).toBe(other.id);
    const after = await repo.load(mine.id);
    expect(after.ok && photoIdsOf(after.profile)[0]).not.toBe("shared-id");
  });

  it("leaves a stored draft that can't be opened alone, and adds the file's copy beside it", async () => {
    const { db, repo } = setup();
    const source = draft("From the file");
    const damaged = { id: source.id, schemaVersion: 1, revision: 4, draftName: "Damaged", sections: "x" } as unknown as BiodataProfile;
    await db.profiles.put(damaged);
    const items = await repo.importDrafts([{ profile: source, photos: [] }], options("replace"));
    expect(items[0]).toMatchObject({ ok: true, status: "added", draftName: "From the file (restored)" });
    expect(items[0].ok && items[0].id).not.toBe(source.id);
    expect(await db.profiles.get(source.id)).toEqual(damaged);
  });
});

describe("importDrafts: failures", () => {
  it("a draft that runs out of space is reported by itself and writes nothing, the others are written", async () => {
    const { db, repo } = setup();
    // The second draft's picture is the one the device has no room for (marked by its height).
    db.photos.hook("creating", (_key, record) => {
      if (record.height === 777) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });
    const drafts: ImportDraft[] = [
      { profile: pictured("Fits", "a"), photos: [photo("a")] },
      { profile: pictured("Too big", "b"), photos: [photo("b", "b", 777)] },
      { profile: pictured("Also fits", "c"), photos: [photo("c")] },
    ];
    const items = await repo.importDrafts(drafts, options("add"));
    expect(items.map((i) => (i.ok ? i.status : i.error.kind))).toEqual(["added", "quota", "added"]);
    expect(items[1]).toMatchObject({ ok: false, sourceId: drafts[1].profile.id });
    const names = (await db.profiles.toArray()).map((p) => p.draftName).sort();
    expect(names).toEqual(["Also fits", "Fits"]);
    expect((await db.photos.toArray()).map((p) => p.height)).not.toContain(777);
  });

  it("a replace that fails leaves the stored draft and its pictures as they were", async () => {
    const { db, repo, store } = setup();
    const mine = pictured("Mine", "mine-1");
    await store(mine, [photo("mine-1", "kept")]);
    const before = await db.profiles.get(mine.id);
    db.photos.hook("creating", (_key, record) => {
      if (record.height === 777) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });
    const fromFile = pictured("From the file", "x");
    fromFile.id = mine.id;
    const items = await repo.importDrafts([{ profile: fromFile, photos: [photo("x", "x", 777)] }], options("replace"));
    expect(items[0]).toMatchObject({ ok: false, error: { kind: "quota" } });
    expect(await db.profiles.get(mine.id)).toEqual(before);
    expect(await text((await db.photos.get("mine-1"))!.blob)).toBe("kept");
  });

  it("reports unavailable storage per draft and doesn't throw", async () => {
    const { db, repo } = setup();
    await db.open();
    db.close();
    const items = await repo.importDrafts([{ profile: draft("A"), photos: [] }, { profile: draft("B"), photos: [] }], options("add"));
    expect(items.map((i) => !i.ok && i.error.kind)).toEqual(["unavailable", "unavailable"]);
  });
});
