import { createProfile } from "@/biodata/defaults";
import type { MigrateErrorCode } from "@/biodata/migrate";
import type { BiodataProfile } from "@/biodata/types";
import type { ProfileRepo, RepoErrorKind } from "./profile-repo";

// Which draft the editor opens (BUILD_PLAN A5, Step 1.3): the one in the address (?d=<id>), else the last one
// opened in this browser, else a new one. Framework-free so it is unit-tested against fake-indexeddb; the editor
// only puts the id in the address and shows the result. A draft that can't be opened is reported, never replaced
// or deleted.

export type OpenDraftResult =
  | {
      kind: "ready";
      profile: BiodataProfile;
      /** True when a new draft was made because there was nothing to reopen. */
      created: boolean;
    }
  /** The address names a draft this browser doesn't have. */
  | { kind: "missing"; id: string }
  /** The record exists but can't be read (too new, damaged); it is left exactly as it is. */
  | { kind: "broken"; id: string; code: MigrateErrorCode }
  /** IndexedDB can't be used here at all (private mode, storage blocked). */
  | { kind: "unavailable" }
  /** Anything else went wrong while reading or creating; nothing was changed. */
  | { kind: "failed"; reason: RepoErrorKind };

type Repo = Pick<ProfileRepo, "load" | "create" | "getLastOpened" | "setLastOpened">;

export async function openDraft(
  repo: Repo,
  requestedId: string | null,
  makeProfile: () => BiodataProfile = () => createProfile(),
): Promise<OpenDraftResult> {
  if (requestedId) return remember(repo, await openById(repo, requestedId));

  const last = await repo.getLastOpened();
  if (!last.ok) return failure(last.error.kind);
  if (last.value !== undefined) {
    const result = await openById(repo, last.value);
    // A last-opened draft that has since vanished (site data partly cleared) just means "start fresh"; a broken
    // one is shown, so the person learns about it instead of it being skipped silently.
    if (result.kind !== "missing") return remember(repo, result);
  }
  return remember(repo, await createDraft(repo, makeProfile));
}

/** Makes and stores a new draft (the "Start a new draft" action, and the first visit). */
export async function createDraft(repo: Pick<ProfileRepo, "create">, makeProfile: () => BiodataProfile = () => createProfile()): Promise<OpenDraftResult> {
  const created = await repo.create(makeProfile());
  if (!created.ok) return failure(created.error.kind);
  return { kind: "ready", profile: created.profile, created: true };
}

async function openById(repo: Repo, id: string): Promise<OpenDraftResult> {
  const loaded = await repo.load(id);
  if (loaded.ok) return { kind: "ready", profile: loaded.profile, created: false };
  const { error } = loaded;
  if (error.kind === "missing") return { kind: "missing", id };
  if (error.kind === "broken") return { kind: "broken", id, code: error.code };
  return failure(error.kind);
}

/** Notes the opened draft as the last one. Failing to note it doesn't stop the editor: the address still has it. */
async function remember(repo: Repo, result: OpenDraftResult): Promise<OpenDraftResult> {
  if (result.kind === "ready") await repo.setLastOpened(result.profile.id);
  return result;
}

function failure(kind: RepoErrorKind): OpenDraftResult {
  return kind === "unavailable" ? { kind: "unavailable" } : { kind: "failed", reason: kind };
}
