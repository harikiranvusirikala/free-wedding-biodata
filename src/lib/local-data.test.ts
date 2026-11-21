import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { createProfile } from "@/biodata/defaults";
import { openDb, type BiodataDb } from "./db";
import { deleteAllLocalData, findContinueDraft } from "./local-data";
import { createProfileRepo } from "./profile-repo";

const opened: BiodataDb[] = [];
afterEach(() => {
  for (const db of opened.splice(0)) db.close();
});

function setup() {
  const name = `local-data-test-${crypto.randomUUID()}`;
  const db = openDb(name);
  opened.push(db);
  return { name, db, repo: createProfileRepo(db) };
}

const at = (iso: string) => () => new Date(iso);

describe("findContinueDraft", () => {
  it("finds nothing, and creates nothing, on a first visit", async () => {
    const name = `never-opened-${crypto.randomUUID()}`;
    expect(await findContinueDraft(name)).toBeNull();
    expect(await Dexie.exists(name)).toBe(false);
  });

  it("offers the last draft opened, else the newest one that opens", async () => {
    const { name, db, repo } = setup();
    const older = createProfile({ draftName: "Older", now: at("2026-11-01T00:00:00Z") });
    const newer = createProfile({ draftName: "Newer", now: at("2026-11-10T00:00:00Z") });
    await repo.create(older);
    await repo.create(newer);
    await db.profiles.put({ id: "broken", schemaVersion: 1, updatedAt: "2026-12-01T00:00:00Z" } as never);
    expect(await findContinueDraft(name)).toEqual({ id: newer.id, draftName: "Newer", fullName: "" });
    await repo.setLastOpened(older.id);
    expect(await findContinueDraft(name)).toMatchObject({ id: older.id });
  });

  it("finds nothing when the only draft can't be opened, or all were deleted", async () => {
    const { name, db, repo } = setup();
    await db.profiles.put({ id: "broken", schemaVersion: 99 } as never);
    expect(await findContinueDraft(name)).toBeNull();
    await repo.remove("broken");
    expect(await findContinueDraft(name)).toBeNull();
  });
});

describe("deleteAllLocalData", () => {
  it("deletes the database with every draft and photo, and this site's settings", async () => {
    const { name, db, repo } = setup();
    const profile = createProfile({ draftName: "Mine" });
    await repo.create(profile);
    await repo.setLastOpened(profile.id);
    const storage = new Map([["theme", "dark"]]);

    const result = await deleteAllLocalData(db, { clear: () => storage.clear() });
    expect(result).toEqual({ ok: true, value: undefined });
    expect(await Dexie.exists(name)).toBe(false);
    expect(storage.size).toBe(0);
    expect(await findContinueDraft(name)).toBeNull();
  });

  it("leaves the database closed, so a late autosave in this tab can't bring it back", async () => {
    const { name, db, repo } = setup();
    const profile = createProfile();
    await repo.create(profile);
    await deleteAllLocalData(db, undefined);
    const late = await repo.save(profile, { expectedRevision: 0 });
    expect(late.ok).toBe(false);
    expect(await Dexie.exists(name)).toBe(false);
  });

  it("reports storage the browser blocks instead of throwing", async () => {
    const blockedFactory = {
      open: () => {
        throw new DOMException("insecure", "SecurityError");
      },
      deleteDatabase: () => {
        throw new DOMException("insecure", "SecurityError");
      },
    } as unknown as IDBFactory;
    const blocked = openDb(`blocked-${crypto.randomUUID()}`, { indexedDB: blockedFactory, IDBKeyRange });
    const result = await deleteAllLocalData(blocked, undefined);
    expect(result.ok === false && result.error.kind).toBe("unavailable");
  });

  it("still deletes the drafts when localStorage itself is blocked", async () => {
    const { name, db } = setup();
    await db.open();
    const result = await deleteAllLocalData(db, {
      clear: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    });
    expect(result.ok).toBe(true);
    expect(await Dexie.exists(name)).toBe(false);
  });
});
