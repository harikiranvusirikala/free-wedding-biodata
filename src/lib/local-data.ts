import Dexie from "dexie";
import { DB_NAME, openDb, type BiodataDb } from "./db";
import { createProfileRepo, toRepoError, type Result } from "./profile-repo";

// Everything this site keeps in this browser, as a whole (BUILD_PLAN Step 1.4, VISION §9): finding the draft to
// continue (the landing page's Continue editing) and "Delete all my local data". The landing page imports this
// module only after hydration (import()), so Dexie isn't part of the public pages' first load.

/** The draft the landing page offers to continue: the last one opened, else the newest that can be opened. */
export interface ContinueDraft {
  id: string;
  draftName: string;
  fullName: string;
}

/**
 * The draft to continue in this browser, or null when there is none (or storage can't be read: then the
 * landing simply doesn't offer it). It never creates the database: a first visit leaves nothing behind.
 */
export async function findContinueDraft(name: string = DB_NAME): Promise<ContinueDraft | null> {
  try {
    if (!(await Dexie.exists(name))) return null;
  } catch {
    return null;
  }
  const db = openDb(name);
  try {
    const repo = createProfileRepo(db);
    const [listed, last] = await Promise.all([repo.list(), repo.getLastOpened()]);
    if (!listed.ok) return null;
    const drafts = listed.value.filter((draft) => draft.ok);
    const pick = drafts.find((draft) => last.ok && draft.id === last.value) ?? drafts[0];
    return pick ? { id: pick.id, draftName: pick.draftName, fullName: pick.fullName } : null;
  } finally {
    db.close();
  }
}

/**
 * Deletes every draft and photo (the whole IndexedDB database) and this site's settings in localStorage (the
 * theme), after the person has confirmed. The database is closed first and stays closed, so a pending autosave
 * in this tab can't create it again; other tabs' connections are closed by Dexie when the deletion starts.
 * Resolves when the database is gone, or with why it couldn't be deleted (nothing is half-deleted: IndexedDB
 * deletes a database as one operation).
 */
export async function deleteAllLocalData(
  db: BiodataDb = openDb(),
  storage: Pick<Storage, "clear"> | undefined = typeof localStorage === "undefined" ? undefined : localStorage,
): Promise<Result<void>> {
  try {
    await db.delete({ disableAutoOpen: true });
  } catch (error) {
    return { ok: false, error: toRepoError(error) };
  }
  try {
    // This origin's own storage only: the browser keeps every site's localStorage apart.
    storage?.clear();
  } catch {
    // Blocked storage has nothing in it to clear.
  }
  return { ok: true, value: undefined };
}
