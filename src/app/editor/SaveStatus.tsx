"use client";

import { BackupButton } from "@/components/BackupButton";
import { button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import type { AutosaveStatus } from "@/lib/autosave";
import type { DownloadOutcome } from "@/lib/backup-file";
import { t } from "@/lib/i18n";

// The open draft's save status (VISION §9, BUILD_PLAN A5): a short line in the header that screen readers hear
// politely, and, when a save fails, a message above the form saying what happened and what to do. "Saved" comes
// only from a committed transaction (autosave.ts); the time is the device's local time.

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

/** The header line: Saving…, Saved on this device · 4:12 PM, or Not saved. Phones see a shorter "Saved · 4:12 PM". */
export function SaveStatus({ status }: { status: AutosaveStatus }) {
  let dot = "bg-good";
  let text: React.ReactNode;
  if (status.state === "saving") {
    dot = "bg-ink-3 animate-pulse motion-reduce:animate-none";
    text = t("save.saving");
  } else if (status.state === "error") {
    dot = "bg-danger";
    text = <span className="font-semibold text-danger">{t("save.failed")}</span>;
  } else if (status.state === "saved") {
    const time = timeFormat.format(status.at);
    text = (
      <>
        <span aria-hidden className="sm:hidden">
          {t("save.savedShort", { time })}
        </span>
        <span className="max-sm:sr-only">{t("save.saved", { time })}</span>
      </>
    );
  } else {
    text = t("save.idle");
  }
  return (
    <p role="status" aria-live="polite" data-testid="save-status" data-state={status.state} className="flex min-w-0 items-center gap-2 text-[13px] text-ink-3">
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${dot}`} />
      <span className="truncate">{text}</span>
    </p>
  );
}

const PROBLEMS = {
  quota: { title: "save.quota.title", text: "save.quota.text", action: "retry" },
  conflict: { title: "save.conflict.title", text: "save.conflict.text", action: "reload" },
  unavailable: { title: "save.unavailable.title", text: "save.unavailable.text", action: "retry" },
  unknown: { title: "save.unknown.title", text: "save.unknown.text", action: "retry" },
} as const;

/**
 * Why the last save failed, above the form. Another tab's newer save (conflict, D9) offers Reload, which opens the
 * stored version; everything else offers Try again, which writes the pending changes now. Out of space also
 * offers "Download a backup" (Step 5.1), which holds the changes the database couldn't take: it is made from the
 * draft as it is in this tab.
 */
export function SaveProblem({ status, onRetry, backup }: { status: AutosaveStatus; onRetry: () => void; backup?: () => Promise<DownloadOutcome> }) {
  if (status.state !== "error") return null;
  const problem = PROBLEMS[status.kind];
  const conflict = status.kind === "conflict";
  return (
    <div
      role="alert"
      data-testid="save-problem"
      className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5 ${conflict ? "border-warn/30 bg-warn-soft" : "border-danger-line bg-danger-soft"}`}
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <Icon name="alert" className={`mt-0.5 size-5 ${conflict ? "text-warn" : "text-danger"}`} />
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink">{t(problem.title)}</h2>
          <p className="mt-1 text-sm text-pretty text-ink-2">{t(problem.text)}</p>
          {status.kind === "quota" && backup && (
            <div className="mt-3">
              <BackupButton run={backup} label={t("save.quota.backup")} doneKey="save.quota.backupDone" />
            </div>
          )}
        </div>
      </div>
      <button
        type="button"
        className={`${button("secondary")} max-sm:ml-8 max-sm:self-start`}
        onClick={problem.action === "reload" ? () => window.location.reload() : onRetry}
      >
        <Icon name="refresh" className="size-4" />
        {t(problem.action === "reload" ? "save.reload" : "save.retry")}
      </button>
    </div>
  );
}
