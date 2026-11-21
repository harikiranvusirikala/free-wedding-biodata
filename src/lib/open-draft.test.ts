import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { createProfile } from "@/biodata/defaults";
import { openDb, type BiodataDb } from "./db";
import { createDraft, openDraft } from "./open-draft";
import { createProfileRepo, type ProfileRepo } from "./profile-repo";

const opened: BiodataDb[] = [];
afterEach(() => {
  for (const db of opened.splice(0)) db.close();
});

function setup() {
  const db = openDb(`open-draft-test-${crypto.randomUUID()}`);
  opened.push(db);
  return { db, repo: createProfileRepo(db) };
}

describe("openDraft", () => {
  it("creates, stores and remembers a new draft when there is nothing to reopen", async () => {
    const { repo } = setup();
    const result = await openDraft(repo, null);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.created).toBe(true);
    expect(result.profile.revision).toBe(0);
    expect((await repo.load(result.profile.id)).ok).toBe(true);
    expect(await repo.getLastOpened()).toEqual({ ok: true, value: result.profile.id });
  });

  it("reopens the last draft when the address names none", async () => {
    const { repo } = setup();
    const first = await openDraft(repo, null);
    const again = await openDraft(repo, null);
    expect(again).toMatchObject({ kind: "ready", created: false });
    expect(again.kind === "ready" && first.kind === "ready" && again.profile.id === first.profile.id).toBe(true);
  });

  it("opens the draft in the address and makes it the last one", async () => {
    const { repo } = setup();
    const a = createProfile({ draftName: "A" });
    const b = createProfile({ draftName: "B" });
    await repo.create(a);
    await repo.create(b);
    await repo.setLastOpened(a.id);
    expect(await openDraft(repo, b.id)).toEqual({ kind: "ready", profile: b, created: false });
    expect(await repo.getLastOpened()).toEqual({ ok: true, value: b.id });
  });

  it("reports an unknown id without creating anything or changing the last draft", async () => {
    const { repo, db } = setup();
    const a = createProfile();
    await repo.create(a);
    await repo.setLastOpened(a.id);
    expect(await openDraft(repo, "no-such-id")).toEqual({ kind: "missing", id: "no-such-id" });
    expect(await db.profiles.count()).toBe(1);
    expect(await repo.getLastOpened()).toEqual({ ok: true, value: a.id });
  });

  it("reports a broken record and keeps it untouched", async () => {
    const { repo, db } = setup();
    const raw = { id: "broken", schemaVersion: 1, sections: "not a list" };
    await db.profiles.put(raw as never);
    expect(await openDraft(repo, "broken")).toEqual({ kind: "broken", id: "broken", code: "invalid" });
    expect(await db.profiles.get("broken")).toEqual(raw);
  });

  it("shows a broken last draft rather than skipping it", async () => {
    const { repo, db } = setup();
    await db.profiles.put({ id: "too-new", schemaVersion: 99 } as never);
    await repo.setLastOpened("too-new");
    expect(await openDraft(repo, null)).toEqual({ kind: "broken", id: "too-new", code: "too-new" });
    expect(await db.profiles.count()).toBe(1);
  });

  it("starts a new draft when the last one has since disappeared", async () => {
    const { repo } = setup();
    await repo.setLastOpened("gone");
    const result = await openDraft(repo, null);
    expect(result).toMatchObject({ kind: "ready", created: true });
  });

  it("maps a storage that can't be used to unavailable, and other errors to failed", async () => {
    const unavailable = { kind: "unavailable" as const, message: "blocked" };
    const unknown = { kind: "unknown" as const, message: "odd" };
    const repo = (kind: typeof unavailable | typeof unknown): Pick<ProfileRepo, "load" | "create" | "getLastOpened" | "setLastOpened"> => ({
      load: async () => ({ ok: false, error: kind }),
      create: async () => ({ ok: false, error: kind }),
      getLastOpened: async () => ({ ok: false, error: kind }),
      setLastOpened: async () => ({ ok: false, error: kind }),
    });
    expect(await openDraft(repo(unavailable), null)).toEqual({ kind: "unavailable" });
    expect(await openDraft(repo(unavailable), "x")).toEqual({ kind: "unavailable" });
    expect(await openDraft(repo(unknown), "x")).toEqual({ kind: "failed", reason: "unknown" });
    expect(await createDraft(repo(unknown))).toEqual({ kind: "failed", reason: "unknown" });
  });

  it("reports storage the browser blocks (private modes, site data turned off) as unavailable", async () => {
    // As some browsers do in a private window: opening the database throws a SecurityError.
    const blockedFactory = {
      open: () => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    } as unknown as IDBFactory;
    const blocked = openDb(`blocked-${crypto.randomUUID()}`, { indexedDB: blockedFactory, IDBKeyRange });
    opened.push(blocked);
    expect(await openDraft(createProfileRepo(blocked), null)).toEqual({ kind: "unavailable" });
  });
});
