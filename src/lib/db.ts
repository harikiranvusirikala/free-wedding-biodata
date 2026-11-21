import Dexie, { type DexieOptions, type Table } from "dexie";
import type { BiodataProfile } from "@/biodata/types";

// The IndexedDB database (BUILD_PLAN A3, A5; VISION §9). Only profile-repo.ts writes to it; everything else asks
// the repo. Dexie's own version number is the database layout (stores and indexes), separate from a profile's
// schemaVersion: a new index bumps this, a new profile property bumps CURRENT_SCHEMA_VERSION and a migrate() step.

export const DB_NAME = "free-wedding-biodata";

/** A photo's image, stored apart from the profile so a profile stays small and quick to save on every keystroke. */
export interface PhotoRecord {
  /** The PhotoRef.id the profile points at. */
  id: string;
  profileId: string;
  /** The downscaled source image (D12); the crop lives in the profile. */
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  updatedAt: string;
}

/** Small app-wide values, such as the last opened draft. */
export interface AppMetaRecord {
  key: string;
  value: unknown;
}

export class BiodataDb extends Dexie {
  /**
   * Typed as the current profile for writing, but anything may come back out (an older format, or a record damaged
   * outside the app), so the repo treats every read as unknown and passes it through migrate().
   */
  profiles!: Table<BiodataProfile, string>;
  photos!: Table<PhotoRecord, string>;
  appMeta!: Table<AppMetaRecord, string>;

  constructor(name: string, options?: DexieOptions) {
    super(name, options);
    this.version(1).stores({
      // updatedAt is indexed so the drafts menu can list newest first without reading every draft in full later.
      profiles: "id, updatedAt",
      // profileId is indexed so deleting a draft can find and delete all of its photos in the same transaction.
      photos: "id, profileId",
      appMeta: "key",
    });
  }
}

/**
 * Opens (lazily, on first use) the database called `name`. Tests pass a fresh name, or their own `indexedDB`
 * factory, so no state leaks between them.
 */
export function openDb(name: string = DB_NAME, options?: Pick<DexieOptions, "indexedDB" | "IDBKeyRange">): BiodataDb {
  return new BiodataDb(name, options);
}
