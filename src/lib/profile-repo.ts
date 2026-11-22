import { newUuid, systemClock, type Clock, type NewId } from "@/biodata/defaults";
import { fullNameOf } from "@/biodata/draft-name";
import { migrate, type MigrateErrorCode } from "@/biodata/migrate";
import { keepPhotoRefs, photoIdsOf, swapPhotoIds } from "@/biodata/photo-refs";
import type { BiodataProfile } from "@/biodata/types";
import type { BackupEntry } from "./backup";
import type { BiodataDb, PhotoRecord } from "./db";

// The only code that writes IndexedDB (BUILD_PLAN A5, VISION §9). Every method resolves to a result instead of
// throwing, so the editor can always say what went wrong in its own words and nothing is lost to an unhandled
// rejection. Reads go through migrate(); a record that fails is reported and left exactly as it is, never deleted.

/** Why a database operation failed. The editor picks its message (and action) from this. */
export type RepoErrorKind =
  /** The browser's storage for this site is full: the editor offers "Download a backup" (A5). */
  | "quota"
  /** Another tab saved (or deleted) this draft since this tab loaded it (D9): stop and offer to reload. */
  | "conflict"
  /** IndexedDB is missing, blocked or failed to open (some private modes, storage disabled by the user). */
  | "unavailable"
  | "unknown";

export interface RepoError {
  kind: RepoErrorKind;
  /** For logs and bug reports only. */
  message: string;
}

export type LoadError =
  | RepoError
  | { kind: "missing"; message: string }
  /** The record exists but can't be opened ("This draft couldn't be opened"); it is kept untouched. */
  | { kind: "broken"; message: string; code: MigrateErrorCode };

export type LoadResult =
  | {
      ok: true;
      profile: BiodataProfile;
      /** The format it was stored in; the next save writes it in the current format. */
      fromVersion: number;
    }
  | { ok: false; error: LoadError };

export type DraftSummary =
  /** `fullName` gives a draft with no name of its own its automatic one (src/biodata/draft-name.ts). */
  | { ok: true; id: string; draftName: string; fullName: string; updatedAt: string }
  /** A record that can't be opened. Its name and time are shown when they can still be read, else "". */
  | { ok: false; id: string; draftName: string; updatedAt: string; error: { code: MigrateErrorCode; message: string } };

export type Result<T> = { ok: true; value: T } | { ok: false; error: RepoError };
export type SaveResult = { ok: true; profile: BiodataProfile } | { ok: false; error: RepoError };
/** A copy can't be made of a draft that is missing or can't be opened (`missing`, `broken`). */
export type DuplicateResult = { ok: true; profile: BiodataProfile } | { ok: false; error: LoadError };

/** A photo to store with a save; its profileId and updatedAt are filled in by the repo. */
export type PhotoInput = Pick<PhotoRecord, "id" | "blob" | "mimeType" | "width" | "height">;

/** What a backup is made from (Step 5.1): every readable draft with its pictures, and the ones that can't be read. */
export interface BackupSource {
  /** Newest first. Each draft's pictures are only the ones it points at. */
  entries: BackupEntry[];
  /** Drafts that can't be opened, so can't go into a backup; they stay in the database untouched. */
  unreadable: { id: string; draftName: string }[];
}

/** A draft from a backup file that passed parseBackup, ready to write. Its id and revision are not trusted. */
export interface ImportDraft {
  profile: BiodataProfile;
  photos: PhotoInput[];
}

/**
 * Add: every draft becomes a new draft with a new id. Replace: a draft whose id a stored draft already has takes
 * that draft's place (and its pictures'); the others are added.
 */
export type ImportMode = "add" | "replace";

export interface ImportOptions {
  mode: ImportMode;
  /**
   * The name for a draft added beside a stored draft with the same id (the same biodata restored twice), the only
   * time a name is changed, so the two can be told apart. Other drafts keep the name they had.
   */
  restoredName: (profile: BiodataProfile) => string;
}

/** What happened to one draft of an import. `sourceId` is the id the file gave it; `id` is where it is now. */
export type ImportItem =
  | { ok: true; status: "added" | "replaced"; sourceId: string; id: string; draftName: string }
  | { ok: false; sourceId: string; error: RepoError };

export interface SaveOptions {
  /** The revision this tab last loaded or saved. Anything else in the database means another tab saved first. */
  expectedRevision: number;
  /** Photo changes written in the same transaction as the profile (D9), so a draft never points at a missing photo. */
  photos?: { put?: PhotoInput[]; delete?: string[] };
}

export interface ProfileRepo {
  load(id: string): Promise<LoadResult>;
  /** Every stored draft, newest first; broken ones last. */
  list(): Promise<Result<DraftSummary[]>>;
  save(profile: BiodataProfile, options: SaveOptions): Promise<SaveResult>;
  /** Stores a new draft as given (revision 0 from createProfile); fails if the id is already taken. */
  create(profile: BiodataProfile): Promise<SaveResult>;
  /**
   * Copies a draft and its photos in one transaction (Step 1.4): a new id for the draft and for each photo, the
   * given name, revision 0 and the time now; everything else exactly as stored.
   */
  duplicate(id: string, options: { draftName: string }): Promise<DuplicateResult>;
  /**
   * Every readable draft (or just those in `ids`) with the pictures it points at, for a backup file (Step 5.1),
   * read in one transaction so each draft matches its pictures. A draft that can't be opened is listed apart.
   */
  listForBackup(ids?: readonly string[]): Promise<Result<BackupSource>>;
  /**
   * Writes the drafts of a backup, one transaction each (the draft with its pictures), so one that fails (the
   * device is out of space) leaves the others written and nothing half-written. The file's ids and revisions
   * aren't trusted: a draft is added with a new id and revision 0 (add mode), or replaces the stored draft with
   * the same id at revision + 1, so a tab that has it open stops and offers a reload (D9). Pictures always get new
   * ids, in both modes, so a file can never overwrite another draft's picture; a replaced draft's old pictures
   * go with it. A stored draft that can't be opened is never replaced: the file's copy is added beside it.
   * Resolves with one item per draft, in order.
   */
  importDrafts(drafts: readonly ImportDraft[], options: ImportOptions): Promise<ImportItem[]>;
  /** Deletes a draft and all of its photos together; called only after the user confirms. */
  remove(id: string): Promise<Result<void>>;
  getPhoto(id: string): Promise<Result<PhotoRecord | undefined>>;
  getLastOpened(): Promise<Result<string | undefined>>;
  setLastOpened(id: string): Promise<Result<void>>;
}

const LAST_OPENED = "lastOpened";

/** Thrown inside a transaction to abort it; turned into a `conflict` result. */
class ConflictError extends Error {
  override name = "ConflictError";
}

/** Thrown inside a duplicate's transaction when the source can't be copied; turned into its LoadError. */
class SourceError extends Error {
  override name = "SourceError";
  constructor(readonly error: LoadError) {
    super(error.message);
  }
}

export function createProfileRepo(db: BiodataDb, { now = systemClock, newId = newUuid }: { now?: Clock; newId?: NewId } = {}): ProfileRepo {
  return {
    async load(id) {
      try {
        const raw: unknown = await db.profiles.get(id);
        if (raw === undefined) return { ok: false, error: { kind: "missing", message: `No draft ${id}` } };
        const result = migrate(raw);
        if (!result.ok) return { ok: false, error: { kind: "broken", ...result.error } };
        return { ok: true, profile: result.profile, fromVersion: result.fromVersion };
      } catch (error) {
        return { ok: false, error: toRepoError(error) };
      }
    },

    async list() {
      return attempt(async () => {
        const records: unknown[] = await db.profiles.toArray();
        const drafts = records.map(summarise);
        // Newest first, so the draft the user worked on last is at the top; broken ones sink to the end.
        return drafts.sort((a, b) => Number(b.ok) - Number(a.ok) || b.updatedAt.localeCompare(a.updatedAt));
      });
    },

    async save(profile, { expectedRevision, photos }) {
      try {
        const saved = await db.transaction("rw", [db.profiles, db.photos], async () => {
          // Read and write in the same transaction, so no other tab can slip a save in between the check and the
          // write (IndexedDB serialises overlapping read-write transactions).
          const stored: unknown = await db.profiles.get(profile.id);
          if (stored === undefined) throw new ConflictError(`Draft ${profile.id} was deleted elsewhere`);
          const storedRevision = revisionOf(stored);
          if (storedRevision !== expectedRevision) {
            throw new ConflictError(
              `Draft ${profile.id} is at revision ${storedRevision}, expected ${expectedRevision}`,
            );
          }
          const updatedAt = now().toISOString();
          const next: BiodataProfile = { ...profile, revision: expectedRevision + 1, updatedAt };
          await db.profiles.put(next);
          for (const photo of photos?.put ?? []) {
            await db.photos.put({ ...photo, profileId: profile.id, updatedAt });
          }
          for (const photoId of photos?.delete ?? []) {
            // Only this draft's own photos: a wrong id must never delete another draft's picture.
            const existing = await db.photos.get(photoId);
            if (existing?.profileId === profile.id) await db.photos.delete(photoId);
          }
          return next;
        });
        return { ok: true, profile: saved };
      } catch (error) {
        return { ok: false, error: toRepoError(error) };
      }
    },

    async create(profile) {
      try {
        await db.profiles.add(profile);
        return { ok: true, profile };
      } catch (error) {
        return { ok: false, error: toRepoError(error) };
      }
    },

    async duplicate(id, { draftName }) {
      try {
        const copy = await db.transaction("rw", [db.profiles, db.photos], async () => {
          const raw: unknown = await db.profiles.get(id);
          if (raw === undefined) throw new SourceError({ kind: "missing", message: `No draft ${id}` });
          const result = migrate(raw);
          if (!result.ok) throw new SourceError({ kind: "broken", ...result.error });
          const photos = await db.photos.where("profileId").equals(id).toArray();
          const photoIds = new Map(photos.map((photo) => [photo.id, newId()]));
          const timestamp = now().toISOString();
          const profile: BiodataProfile = {
            ...swapPhotoIds(structuredClone(result.profile), photoIds),
            id: newId(),
            revision: 0,
            draftName,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          await db.profiles.add(profile);
          for (const photo of photos) {
            await db.photos.add({ ...photo, id: photoIds.get(photo.id)!, profileId: profile.id, updatedAt: timestamp });
          }
          return profile;
        });
        return { ok: true, profile: copy };
      } catch (error) {
        return { ok: false, error: error instanceof SourceError ? error.error : toRepoError(error) };
      }
    },

    async listForBackup(ids) {
      return attempt(() =>
        db.transaction("r", [db.profiles, db.photos], async () => {
          const records: unknown[] = ids ? (await db.profiles.bulkGet([...ids])).filter((record) => record !== undefined) : await db.profiles.toArray();
          const entries: BackupEntry[] = [];
          const unreadable: BackupSource["unreadable"] = [];
          for (const raw of records) {
            const result = migrate(raw);
            if (!result.ok) {
              const record = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
              unreadable.push({ id: String(record.id), draftName: typeof record.draftName === "string" ? record.draftName : "" });
              continue;
            }
            const used = new Set(photoIdsOf(result.profile));
            const stored = await db.photos.where("profileId").equals(result.profile.id).toArray();
            const photos = stored.filter((photo) => used.has(photo.id)).map(({ id, blob, mimeType, width, height }) => ({ id, blob, mimeType, width, height }));
            entries.push({ profile: result.profile, photos });
          }
          entries.sort((a, b) => b.profile.updatedAt.localeCompare(a.profile.updatedAt));
          return { entries, unreadable };
        }),
      );
    },

    async importDrafts(drafts, { mode, restoredName }) {
      const items: ImportItem[] = [];
      for (const draft of drafts) {
        try {
          items.push(await db.transaction("rw", [db.profiles, db.photos], () => importOne(db, draft, mode, restoredName, newId)));
        } catch (error) {
          items.push({ ok: false, sourceId: draft.profile.id, error: toRepoError(error) });
        }
      }
      return items;
    },

    async remove(id) {
      return attempt(() =>
        db.transaction("rw", [db.profiles, db.photos, db.appMeta], async () => {
          await db.profiles.delete(id);
          await db.photos.where("profileId").equals(id).delete();
          // Don't leave "last opened" pointing at a draft that no longer exists.
          const last = await db.appMeta.get(LAST_OPENED);
          if (last?.value === id) await db.appMeta.delete(LAST_OPENED);
        }),
      );
    },

    async getPhoto(id) {
      return attempt(() => db.photos.get(id));
    },

    async getLastOpened() {
      return attempt(async () => {
        const value = (await db.appMeta.get(LAST_OPENED))?.value;
        return typeof value === "string" ? value : undefined;
      });
    },

    async setLastOpened(id) {
      return attempt(async () => {
        await db.appMeta.put({ key: LAST_OPENED, value: id });
      });
    },
  };
}

async function attempt<T>(run: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    return { ok: false, error: toRepoError(error) };
  }
}

function summarise(raw: unknown): DraftSummary {
  const record = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const result = migrate(raw);
  if (result.ok) {
    const { id, draftName, updatedAt } = result.profile;
    return { ok: true, id, draftName, fullName: fullNameOf(result.profile), updatedAt };
  }
  return {
    ok: false,
    id: String(record.id),
    draftName: typeof record.draftName === "string" ? record.draftName : "",
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
    error: result.error,
  };
}

/** An id the app could have made (a UUID or alike): the only kind a backup's draft may keep. Starts with a letter or digit, so never `__proto__`. */
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;

/** Writes one imported draft; runs inside the caller's transaction. */
async function importOne(db: BiodataDb, draft: ImportDraft, mode: ImportMode, restoredName: ImportOptions["restoredName"], newId: NewId): Promise<ImportItem> {
  const source = draft.profile;
  const stored: unknown = await db.profiles.get(source.id);
  const clash = stored !== undefined;

  let id = newId();
  let status: "added" | "replaced" = "added";
  let revision = 0;
  if (mode === "replace" && SAFE_ID.test(source.id)) {
    const existing = clash ? migrate(stored) : undefined;
    if (!clash) id = source.id; // not here yet: it comes back under its own id, so importing the file again replaces it
    else if (existing?.ok) {
      id = source.id;
      status = "replaced";
      revision = existing.profile.revision + 1;
    }
    // else: the stored draft can't be opened. It stays untouched and the file's copy is added beside it.
  }
  const draftName = status === "added" && clash ? restoredName(source) : source.draftName;

  // New picture ids, always; only the pictures the file actually brought, and nothing points at one it didn't.
  const photos = new Map(draft.photos.map((photo) => [photo.id, photo]));
  const fresh = new Map([...photos.keys()].map((photoId) => [photoId, newId()]));
  const profile: BiodataProfile = { ...swapPhotoIds(keepPhotoRefs(source, new Set(photos.keys())), fresh), id, revision, draftName };

  if (status === "replaced") await db.photos.where("profileId").equals(id).delete();
  await db.profiles.put(profile);
  for (const [photoId, photo] of photos) {
    const { blob, mimeType, width, height } = photo;
    await db.photos.add({ id: fresh.get(photoId)!, profileId: id, blob, mimeType, width, height, updatedAt: profile.updatedAt });
  }
  return { ok: true, status, sourceId: source.id, id, draftName };
}

/** A stored record's revision, or NaN when it has none: a broken record never matches, so it is never overwritten. */
function revisionOf(raw: unknown): number {
  const revision = typeof raw === "object" && raw !== null ? (raw as { revision?: unknown }).revision : undefined;
  return typeof revision === "number" ? revision : Number.NaN;
}

// Error names that mean IndexedDB can't be used at all here, as opposed to one write failing. Dexie reports a
// failed open as DatabaseClosedError/OpenFailedError with the browser's own error inside (e.g. Firefox's private
// mode raises InvalidStateError), and a missing indexedDB as MissingAPIError.
const UNAVAILABLE = new Set([
  "MissingAPIError",
  "OpenFailedError",
  "DatabaseClosedError",
  "InvalidStateError",
  "SecurityError",
  "VersionError",
]);

/** Maps anything thrown by Dexie or IndexedDB to the kinds the editor knows. */
export function toRepoError(error: unknown): RepoError {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  if (error instanceof ConflictError) return { kind: "conflict", message };
  const names = errorNames(error);
  // Quota first: Dexie may wrap it (an AbortError or OpenFailedError with the QuotaExceededError inside).
  if (names.includes("QuotaExceededError")) return { kind: "quota", message };
  if (names.some((name) => UNAVAILABLE.has(name))) return { kind: "unavailable", message };
  return { kind: "unknown", message };
}

/** The error's name and those of every error it wraps (Dexie's `inner`, a BulkError's failures, `cause`). */
function errorNames(error: unknown, depth = 0): string[] {
  if (typeof error !== "object" || error === null || depth > 5) return [];
  const e = error as { name?: unknown; inner?: unknown; cause?: unknown; failures?: unknown };
  const own = typeof e.name === "string" ? [e.name] : [];
  const failures = Array.isArray(e.failures) ? e.failures : [];
  return [...own, ...[e.inner, e.cause, ...failures].flatMap((inner) => errorNames(inner, depth + 1))];
}

