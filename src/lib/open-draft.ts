import { createProfile } from "@/biodata/defaults";
import { isBlankDraft } from "@/biodata/draft-name";
import type { MigrateErrorCode } from "@/biodata/migrate";
import type { BiodataProfile, LangCode } from "@/biodata/types";
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

/**
 * Which draft the address asks for: `?d=<id>`, `?new=1` (Create my biodata, New draft), or neither. With `?new=1`,
 * `&design=<id>` asks for the new draft in that design (the design gallery, Step 6.1) and `&lang=<code>` for its
 * headings in that language (the language pages, Step 6.1 part 2); the editor checks both against what exists.
 */
export function draftRequest(search: string): { id: string | null; fresh: boolean; design: string | null; lang: string | null } {
  const params = new URLSearchParams(search);
  const fresh = !params.has("d") && params.get("new") === "1";
  return { id: params.get("d"), fresh, design: fresh ? params.get("design") : null, lang: fresh ? params.get("lang") : null };
}

/** How a new draft starts when the address asks: its design and colour, and its document language. */
export interface DraftStart {
  templateId?: string;
  colorId?: string;
  docLanguage?: LangCode;
}

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

/**
 * A new draft, for "Create my biodata" and the drafts menu's New draft (`/editor?new=1`, Step 1.4). If the last
 * draft opened is still untouched (never saved, nothing in it), that one is reopened instead, so pressing Create
 * twice doesn't leave a trail of empty "Untitled biodata" drafts. Nothing is ever deleted to achieve that. With a
 * `start`, the new draft starts in that design and language.
 */
export async function openNewDraft(repo: Repo, makeProfile: () => BiodataProfile = () => createProfile(), start: DraftStart = {}): Promise<OpenDraftResult> {
  const last = await repo.getLastOpened();
  if (last.ok && last.value !== undefined) {
    const loaded = await repo.load(last.value);
    // An untouched draft that starts differently from what was asked for isn't reused: it is left as it is.
    const matches = loaded.ok && (Object.keys(start) as (keyof DraftStart)[]).every((k) => start[k] === undefined || loaded.profile[k] === start[k]);
    if (loaded.ok && loaded.profile.revision === 0 && isBlankDraft(loaded.profile) && matches) {
      return remember(repo, { kind: "ready", profile: loaded.profile, created: false });
    }
  }
  const given = Object.fromEntries(Object.entries(start).filter(([, v]) => v !== undefined));
  const make = Object.keys(given).length ? () => ({ ...makeProfile(), ...given }) : makeProfile;
  return remember(repo, await createDraft(repo, make));
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
