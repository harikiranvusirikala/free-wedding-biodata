import type { AppKey } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import type { BackupRejection, DraftProblem, PhotoProblem } from "./backup";
import type { DownloadOutcome } from "./backup-file";
import type { RepoErrorKind } from "./profile-repo";

// The words for backups (Step 5.1): which dictionary key says each reason, and "3 drafts" / "1 draft". Pure, so the
// dialogs, the delete dialogs and the unit tests share them.

/** "1 draft", "3 drafts". */
export function draftCount(count: number): string {
  return count === 1 ? t("backup.count.drafts.one") : t("backup.count.drafts.many", { count });
}

/** "1 photo", "3 photos". */
export function photoCount(count: number): string {
  return count === 1 ? t("backup.count.photos.one") : t("backup.count.photos.many", { count });
}

/** Why a whole file is refused, with the reassurance that nothing was changed. */
export function rejectionText(reason: BackupRejection): string {
  return `${t(`backup.reject.${reason}`)} ${t("backup.reject.nothing")}`;
}

export const draftProblemText = (reason: DraftProblem): string => t(`backup.draftProblem.${reason}`);
export const photoProblemText = (reason: PhotoProblem): string => t(`backup.photoProblem.${reason}`);
export const importProblemText = (kind: RepoErrorKind): string => t(`backup.importProblem.${kind}`);

/** What went wrong with a download of a backup. */
export function downloadFailureText(kind: Extract<DownloadOutcome, { ok: false }>["kind"]): string {
  const keys: Record<typeof kind, AppKey> = {
    empty: "backup.failed.empty",
    failed: "backup.failed.failed",
    unavailable: "backup.failed.unavailable",
    quota: "backup.failed.read",
    conflict: "backup.failed.read",
    unknown: "backup.failed.read",
  };
  return t(keys[kind]);
}
