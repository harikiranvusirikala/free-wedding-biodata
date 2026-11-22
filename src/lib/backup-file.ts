import Dexie from "dexie";
import { saveBlob } from "@/app/editor/preview/export-files";
import { MAX_BACKUP_BYTES, backupFileName, buildBackupBlob, parseBackup, withOpenDraft, type BackupEntry, type ParseResult } from "./backup";
import { DB_NAME, openDb } from "./db";
import { createProfileRepo, type BackupSource, type PhotoInput, type ProfileRepo, type RepoErrorKind, type Result } from "./profile-repo";
import type { BiodataProfile } from "@/biodata/types";

// The browser side of backups (Step 5.1): reading drafts and pictures for a file, saving it through a download link,
// and reading a file the person picked. The checking and building is in backup.ts (pure); the writing is the repo's.
// Nothing here talks to a network: the file is made and read on this device.

/** What the file picker offers: JSON, which is what backups are. (A person may still pick anything: it's checked.) */
export const BACKUP_ACCEPT = ".json,application/json";

/** The draft the editor has open, as it is now (its newest typing may not have reached the database yet). */
export interface OpenDraftState {
  profile: BiodataProfile;
  pendingPhotos: readonly PhotoInput[];
}

/** Which drafts go in a backup. No ids = all of them. */
export interface BackupScope {
  ids?: readonly string[];
  /** Reads the open draft as the editor holds it; used for it instead of the stored copy when it is in scope. */
  open?: () => OpenDraftState;
}

/** The drafts to back up, from the database, with the open draft as the editor has it. */
export async function loadBackupEntries(repo: Pick<ProfileRepo, "listForBackup">, scope: BackupScope = {}): Promise<Result<BackupSource>> {
  const loaded = await repo.listForBackup(scope.ids);
  if (!loaded.ok) return loaded;
  const open = scope.open?.();
  if (!open || (scope.ids && !scope.ids.includes(open.profile.id))) return loaded;
  return { ok: true, value: { ...loaded.value, entries: withOpenDraft(loaded.value.entries, open) } };
}

export type DownloadOutcome =
  | { ok: true; name: string; bytes: number; count: number; unreadable: number }
  /** `empty`: no drafts to put in it; `failed`: the file couldn't be made (the browser ran out of memory, say). */
  | { ok: false; kind: "empty" | "failed" | RepoErrorKind };

/** Makes the file for `entries` and hands it to the browser's download. Resolves when the download has been started. */
export async function saveBackup(entries: readonly BackupEntry[], unreadable: number, now: Date = new Date(), onProgress?: (done: number, total: number) => void): Promise<DownloadOutcome> {
  if (entries.length === 0) return { ok: false, kind: "empty" };
  try {
    const blob = await buildBackupBlob(entries, now, onProgress);
    const name = backupFileName(now);
    saveBlob(blob, name);
    return { ok: true, name, bytes: blob.size, count: entries.length, unreadable };
  } catch {
    return { ok: false, kind: "failed" };
  }
}

/** Reads the drafts and downloads their backup in one go ("Download a backup first"). */
export async function downloadBackup(repo: Pick<ProfileRepo, "listForBackup">, scope: BackupScope = {}, now: Date = new Date()): Promise<DownloadOutcome> {
  const loaded = await loadBackupEntries(repo, scope);
  if (!loaded.ok) return { ok: false, kind: loaded.error.kind };
  return saveBackup(loaded.value.entries, loaded.value.unreadable.length, now);
}

/**
 * Backs up everything this browser holds, for pages that have no database open (the privacy page's Delete all). It
 * never creates the database: a browser that has none has nothing to back up.
 */
export async function downloadBackupFromDevice(name: string = DB_NAME): Promise<DownloadOutcome> {
  try {
    if (!(await Dexie.exists(name))) return { ok: false, kind: "empty" };
  } catch {
    return { ok: false, kind: "unavailable" };
  }
  const db = openDb(name);
  try {
    return await downloadBackup(createProfileRepo(db));
  } finally {
    db.close();
  }
}

/**
 * Reads and checks a file the person picked. A file over the size limit is refused before it is read; a file the
 * browser can't read (it moved, or the permission was withdrawn) gives `unreadable`.
 */
export async function readBackupFile(file: File, onProgress?: (done: number, total: number) => void): Promise<ParseResult> {
  if (file.size > MAX_BACKUP_BYTES) return { ok: false, reason: "tooBig", detail: `The file is ${file.size} bytes; the limit is ${MAX_BACKUP_BYTES}` };
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, reason: "unreadable", detail: "The browser couldn't read the file" };
  }
  return parseBackup(text, { onProgress });
}
