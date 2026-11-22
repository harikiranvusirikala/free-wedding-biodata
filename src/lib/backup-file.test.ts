import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProfile } from "@/biodata/defaults";
import type { BiodataProfile } from "@/biodata/types";
import { MAX_BACKUP_BYTES, type BackupEntry } from "./backup";
import { downloadBackup, loadBackupEntries, readBackupFile, saveBackup } from "./backup-file";
import type { BackupSource, ProfileRepo } from "./profile-repo";

const saved: { blob: Blob; name: string }[] = [];
vi.mock("@/app/editor/preview/export-files", () => ({ saveBlob: (blob: Blob, name: string) => void saved.push({ blob, name }) }));

beforeEach(() => {
  saved.length = 0;
});

const NOW = new Date(2026, 10, 22, 9, 30);
const entry = (name: string): BackupEntry => ({ profile: createProfile({ draftName: name }), photos: [] });
const repoWith = (entries: BackupEntry[], unreadable: BackupSource["unreadable"] = []): Pick<ProfileRepo, "listForBackup"> => ({
  listForBackup: async (ids) => ({ ok: true, value: { entries: entries.filter((e) => !ids || ids.includes(e.profile.id)), unreadable } }),
});

describe("saveBackup", () => {
  it("makes the file and starts its download under the day's name", async () => {
    const outcome = await saveBackup([entry("A"), entry("B")], 1, NOW);
    expect(outcome).toMatchObject({ ok: true, name: "Biodata-backup-2026-11-22.json", count: 2, unreadable: 1 });
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe("Biodata-backup-2026-11-22.json");
    expect(outcome.ok && outcome.bytes).toBe(saved[0].blob.size);
    expect(JSON.parse(await saved[0].blob.text()).drafts).toHaveLength(2);
  });

  it("downloads nothing when there is nothing to back up", async () => {
    expect(await saveBackup([], 0, NOW)).toEqual({ ok: false, kind: "empty" });
    expect(saved).toHaveLength(0);
  });

  it("says so when the file can't be made, and downloads nothing", async () => {
    const broken: BackupEntry = { profile: createProfile({ draftName: "A" }), photos: [{ id: "x", blob: {} as Blob, mimeType: "image/jpeg", width: 1, height: 1 }] };
    broken.profile.photo = { id: "x", frame: "3:4", crop: { x: 0, y: 0, zoom: 1, rotation: 0 } };
    expect(await saveBackup([broken], 0, NOW)).toEqual({ ok: false, kind: "failed" });
    expect(saved).toHaveLength(0);
  });
});

describe("loadBackupEntries and downloadBackup", () => {
  it("reads the drafts in scope, and uses the open draft as the editor holds it", async () => {
    const stored = entry("Stored name");
    const other = entry("Other");
    const typed: BiodataProfile = { ...stored.profile, draftName: "Typed since the last save" };
    const open = () => ({ profile: typed, pendingPhotos: [] });

    const all = await loadBackupEntries(repoWith([stored, other]), { open });
    expect(all.ok && all.value.entries.map((e) => e.profile.draftName)).toEqual(["Typed since the last save", "Other"]);

    const justOther = await loadBackupEntries(repoWith([stored, other]), { ids: [other.profile.id], open });
    expect(justOther.ok && justOther.value.entries.map((e) => e.profile.draftName)).toEqual(["Other"]);

    const justOpen = await loadBackupEntries(repoWith([stored, other]), { ids: [stored.profile.id], open });
    expect(justOpen.ok && justOpen.value.entries.map((e) => e.profile.draftName)).toEqual(["Typed since the last save"]);
  });

  it("passes a read failure on", async () => {
    const repo: Pick<ProfileRepo, "listForBackup"> = { listForBackup: async () => ({ ok: false, error: { kind: "unavailable", message: "blocked" } }) };
    expect(await downloadBackup(repo)).toEqual({ ok: false, kind: "unavailable" });
    expect(saved).toHaveLength(0);
  });

  it("downloads in one go", async () => {
    const outcome = await downloadBackup(repoWith([entry("A")], [{ id: "bad", draftName: "" }]), {}, NOW);
    expect(outcome).toMatchObject({ ok: true, count: 1, unreadable: 1 });
    expect(saved).toHaveLength(1);
  });
});

describe("readBackupFile", () => {
  it("refuses a file over the size limit without reading it", async () => {
    const text = vi.fn();
    const result = await readBackupFile({ size: MAX_BACKUP_BYTES + 1, text } as unknown as File);
    expect(result).toMatchObject({ ok: false, reason: "tooBig" });
    expect(text).not.toHaveBeenCalled();
  });

  it("says when the browser can't read the file", async () => {
    const result = await readBackupFile({ size: 10, text: () => Promise.reject(new Error("gone")) } as unknown as File);
    expect(result).toMatchObject({ ok: false, reason: "unreadable" });
  });

  it("reads and checks a real file", async () => {
    const file = new File([await (await import("./backup")).buildBackupBlob([entry("From a file")], NOW)], "Biodata-backup-2026-11-22.json", { type: "application/json" });
    const result = await readBackupFile(file);
    expect(result.ok && result.drafts.map((d) => d.profile.draftName)).toEqual(["From a file"]);
    expect(await readBackupFile(new File(["not a backup"], "x.json"))).toMatchObject({ ok: false, reason: "notJson" });
  });
});
