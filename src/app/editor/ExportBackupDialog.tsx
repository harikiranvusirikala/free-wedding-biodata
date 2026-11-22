"use client";

import { useEffect, useRef, useState } from "react";
import { fullNameOf } from "@/biodata/draft-name";
import { button } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { choice, fieldLabel, formError, formSuccess } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";
import { estimateBackupBytes, type BackupEntry } from "@/lib/backup";
import { loadBackupEntries, saveBackup, type OpenDraftState } from "@/lib/backup-file";
import { downloadFailureText } from "@/lib/backup-text";
import { titleOf } from "@/lib/draft-title";
import { t } from "@/lib/i18n";
import type { ProfileRepo } from "@/lib/profile-repo";
import { formatBytes } from "@/lib/storage-status";

// "Download a backup" (BUILD_PLAN Step 5.1, VISION §9): choose all drafts or the open one, see about how big the
// file is, and download `Biodata-backup-YYYY-MM-DD.json`. The file is made here, on this device, and saved where the
// person chooses; the words say it is a copy they keep, never that it is safe.

type Load =
  | { kind: "loading" }
  | { kind: "ready"; entries: BackupEntry[]; unreadable: number; open: { id: string; name: string } }
  | { kind: "failed"; text: string };

type Run = { kind: "idle" } | { kind: "working"; done: number; total: number } | { kind: "done"; text: string } | { kind: "failed"; text: string };

export function ExportBackupDialog({ open, onClose, repo, getOpen }: { open: boolean; onClose: () => void; repo: ProfileRepo; getOpen: () => OpenDraftState }) {
  return (
    <Dialog open={open} onClose={onClose} title={t("backup.export.title")} description={t("backup.export.description")}>
      <ExportBody repo={repo} getOpen={getOpen} onClose={onClose} />
    </Dialog>
  );
}

// The body mounts each time the dialog opens (the Dialog renders its children only while open), so every opening
// reads the drafts afresh.
function ExportBody({ repo, getOpen, onClose }: { repo: ProfileRepo; getOpen: () => OpenDraftState; onClose: () => void }) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [scope, setScope] = useState<"all" | "open">("all");
  const [run, setRun] = useState<Run>({ kind: "idle" });
  const first = useRef<HTMLInputElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let live = true;
    void loadBackupEntries(repo, { open: getOpen }).then((result) => {
      if (!live) return;
      if (!result.ok) return setLoad({ kind: "failed", text: downloadFailureText(result.error.kind === "unavailable" ? "unavailable" : "unknown") });
      const current = getOpen().profile;
      setLoad({
        kind: "ready",
        entries: result.value.entries,
        unreadable: result.value.unreadable.length,
        open: { id: current.id, name: titleOf({ draftName: current.draftName, fullName: fullNameOf(current) }) },
      });
    });
    return () => {
      live = false;
    };
  }, [repo, getOpen]);

  const ready = load.kind === "ready";
  // Where the keyboard starts once the choices are there: the first choice, or the button when there is only one.
  useEffect(() => {
    if (ready) (first.current ?? confirm.current)?.focus();
  }, [ready]);

  if (load.kind === "loading") {
    return (
      <p role="status" className="flex items-center gap-2.5 py-3 text-sm text-ink-3">
        <Spinner />
        {t("backup.export.reading")}
      </p>
    );
  }
  if (load.kind === "failed") {
    return (
      <>
        <p role="alert" className={formError}>
          {load.text}
        </p>
        <DialogActions>
          <button type="button" className={button("secondary")} onClick={onClose}>
            {t("backup.restore.close")}
          </button>
        </DialogActions>
      </>
    );
  }

  const { entries, unreadable, open } = load;
  if (entries.length === 0) {
    return (
      <>
        <p role="status" className="text-sm text-ink-2">
          {t("backup.failed.empty")}
        </p>
        <DialogActions>
          <button type="button" className={button("secondary")} onClick={onClose}>
            {t("backup.restore.close")}
          </button>
        </DialogActions>
      </>
    );
  }

  const chosen = scope === "open" ? entries.filter((entry) => entry.profile.id === open.id) : entries;
  const size = formatBytes(estimateBackupBytes(chosen));
  const working = run.kind === "working";

  async function download() {
    setRun({ kind: "working", done: 0, total: chosen.length });
    const outcome = await saveBackup(chosen, unreadable, new Date(), (done, total) => setRun({ kind: "working", done, total }));
    if (!outcome.ok) return setRun({ kind: "failed", text: downloadFailureText(outcome.kind) });
    setRun({ kind: "done", text: t("backup.export.done", { name: outcome.name, size: formatBytes(outcome.bytes) }) });
  }

  if (run.kind === "done") {
    return (
      <>
        <p role="status" className={`flex gap-2.5 ${formSuccess}`} data-testid="backup-export-done">
          <Icon name="check" className="mt-0.5 size-4 shrink-0" />
          <span>{run.text}</span>
        </p>
        <DialogActions>
          <button type="button" className={button("primary")} onClick={onClose} data-autofocus>
            {t("backup.restore.close")}
          </button>
        </DialogActions>
      </>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!working) void download();
      }}
    >
      {entries.length > 1 ? (
        <fieldset disabled={working} className="space-y-2.5">
          <legend className={`${fieldLabel} mb-2.5`}>{t("backup.export.scope")}</legend>
          <ScopeChoice
            inputRef={first}
            checked={scope === "all"}
            onSelect={() => setScope("all")}
            label={t("backup.export.all", { count: entries.length })}
            hint={t("backup.export.allHint")}
          />
          <ScopeChoice checked={scope === "open"} onSelect={() => setScope("open")} label={t("backup.export.open")} hint={t("backup.export.openHint", { name: open.name })} />
        </fieldset>
      ) : (
        <p className="text-sm text-ink-2">{t("backup.export.openHint", { name: open.name })}</p>
      )}

      <p className="mt-4 text-sm text-ink-2" data-testid="backup-size">
        {t("backup.export.size", { size })}
      </p>
      <p className="mt-1 text-[13px] text-pretty text-ink-3">{t("backup.export.local")}</p>
      {unreadable > 0 && <p className="mt-2 text-[13px] text-pretty text-warn">{t("backup.export.unreadable", { count: unreadable })}</p>}

      <p role={run.kind === "failed" ? "alert" : "status"} className={run.kind === "failed" ? `mt-4 ${formError}` : "sr-only"}>
        {run.kind === "failed" ? run.text : working ? t("backup.export.working") : ""}
      </p>

      <DialogActions>
        <button type="button" className={button("secondary")} onClick={onClose} disabled={working}>
          {t("ui.cancel")}
        </button>
        <button ref={confirm} type="submit" className={button("primary")} disabled={working}>
          {working ? <Spinner /> : <Icon name="download" className="size-4" />}
          {working ? t("backup.export.working") : t("backup.export.confirm")}
        </button>
      </DialogActions>
    </form>
  );
}

function ScopeChoice({ checked, onSelect, label, hint, inputRef }: { checked: boolean; onSelect: () => void; label: string; hint: string; inputRef?: React.Ref<HTMLInputElement> }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 transition-colors hover:bg-sunken has-checked:border-brand has-checked:bg-brand-soft pointer-coarse:min-h-11 has-disabled:cursor-default has-disabled:opacity-70">
      <input ref={inputRef} type="radio" name="backup-scope" className={`${choice} mt-0.5`} checked={checked} onChange={onSelect} />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="mt-0.5 block text-[13px] text-pretty text-ink-3">{hint}</span>
      </span>
    </label>
  );
}
