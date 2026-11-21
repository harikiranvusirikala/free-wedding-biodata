import { systemClock, type Clock } from "@/biodata/defaults";
import { migrate, type MigrateErrorCode } from "@/biodata/migrate";
import type { BiodataProfile } from "@/biodata/types";
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
  | { ok: true; id: string; draftName: string; updatedAt: string }
  /** A record that can't be opened. Its name and time are shown when they can still be read, else "". */
  | { ok: false; id: string; draftName: string; updatedAt: string; error: { code: MigrateErrorCode; message: string } };

export type Result<T> = { ok: true; value: T } | { ok: false; error: RepoError };
export type SaveResult = { ok: true; profile: BiodataProfile } | { ok: false; error: RepoError };

/** A photo to store with a save; its profileId and updatedAt are filled in by the repo. */
export type PhotoInput = Pick<PhotoRecord, "id" | "blob" | "mimeType" | "width" | "height">;

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

export function createProfileRepo(db: BiodataDb, { now = systemClock }: { now?: Clock } = {}): ProfileRepo {
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
    return { ok: true, id, draftName, updatedAt };
  }
  return {
    ok: false,
    id: String(record.id),
    draftName: typeof record.draftName === "string" ? record.draftName : "",
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
    error: result.error,
  };
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

