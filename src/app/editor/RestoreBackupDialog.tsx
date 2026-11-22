"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { fullNameOf } from "@/biodata/draft-name";
import type { BiodataProfile } from "@/biodata/types";
import { BackupButton } from "@/components/BackupButton";
import { button, textLink } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { choice, formError } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";
import type { BackupWarning, ParsedDraft } from "@/lib/backup";
import { BACKUP_ACCEPT, downloadBackup, readBackupFile } from "@/lib/backup-file";
import { draftCount, draftProblemText, importProblemText, photoCount, photoProblemText, rejectionText } from "@/lib/backup-text";
import type { AutosaveController } from "@/lib/autosave";
import { editedAgo, restoredTitleOf, titleOf } from "@/lib/draft-title";
import { t } from "@/lib/i18n";
import type { ImportItem, ImportMode, ProfileRepo } from "@/lib/profile-repo";

// "Restore from a backup" (BUILD_PLAN Step 5.1, VISION §9): pick a file (or drop it), check it, show what is in it,
// let the person choose which drafts and whether to add them as new drafts or replace the ones they already have,
// then import and say what happened, draft by draft. Nothing is written until Import is pressed, and Replace says
// plainly what it overwrites and offers a backup first. Everything is read on this device; nothing is uploaded.

type Step =
  | { kind: "pick"; error?: string }
  | { kind: "checking"; file: string; done: number; total: number }
  | { kind: "preview" }
  | { kind: "importing" }
  | { kind: "result" };

interface Checked {
  file: string;
  exportedAt?: string;
  drafts: ParsedDraft[];
  warnings: BackupWarning[];
}

interface Outcome {
  chosen: ParsedDraft[];
  items: ImportItem[];
  /** The draft open in this tab was overwritten, so what the form shows is out of date. */
  replacedOpen: boolean;
}

type PhotoWarning = Extract<BackupWarning, { kind: "photoDropped" }>;

const nameOf = (profile: BiodataProfile) => titleOf({ draftName: profile.draftName, fullName: fullNameOf(profile) });

/** What the body tells the dialog's own close controls (Close, Escape, the backdrop): whether closing is allowed, and whether the page must reload. */
interface CloseGuard {
  /** A file is being checked or drafts are being written: closing waits. */
  busy: boolean;
  /** The draft open in this tab was overwritten, so what the form shows is out of date. */
  stale: boolean;
}

export function RestoreBackupDialog({ open, onClose, repo, controller }: { open: boolean; onClose: () => void; repo: ProfileRepo; controller: AutosaveController }) {
  const guard = useRef<CloseGuard>({ busy: false, stale: false });
  const close = () => {
    if (guard.current.busy) return;
    // Typing into the overwritten draft would only be refused (D9), so reloading is the way out.
    if (guard.current.stale) window.location.reload();
    else onClose();
  };
  return (
    <Dialog open={open} onClose={close} title={t("backup.restore.title")} wide>
      <RestoreBody repo={repo} controller={controller} report={(next) => (guard.current = next)} close={close} />
    </Dialog>
  );
}

// The body mounts each time the dialog opens, so every opening starts at "choose a file".
function RestoreBody({ repo, controller, report, close }: { repo: ProfileRepo; controller: AutosaveController; report: (guard: CloseGuard) => void; close: () => void }) {
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [checked, setChecked] = useState<Checked | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [mode, setMode] = useState<ImportMode>("add");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  /** What this browser already has, by draft id, so the preview can say what Replace would overwrite. */
  const [here, setHere] = useState<ReadonlyMap<string, string>>(new Map());
  const [dragging, setDragging] = useState(false);
  const alive = useRef(true);
  const input = useRef<HTMLInputElement>(null);
  const intro = useRef<HTMLParagraphElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    alive.current = true;
    void repo.list().then((listed) => {
      if (alive.current && listed.ok) setHere(new Map(listed.value.flatMap((draft) => (draft.ok ? [[draft.id, draft.updatedAt] as const] : []))));
    });
    return () => {
      alive.current = false;
    };
  }, [repo]);

  // Each step puts the keyboard and the screen reader where the news is.
  const kind = step.kind;
  useEffect(() => {
    if (kind === "preview") intro.current?.focus();
    if (kind === "result") heading.current?.focus();
  }, [kind]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setStep({ kind: "checking", file: file.name, done: 0, total: 0 });
    const result = await readBackupFile(file, (done, total) => {
      if (alive.current) setStep({ kind: "checking", file: file.name, done, total });
    });
    if (!alive.current) return;
    if (!result.ok) return setStep({ kind: "pick", error: rejectionText(result.reason) });
    setChecked({ file: file.name, exportedAt: result.manifest.exportedAt, drafts: result.drafts, warnings: result.warnings });
    setSelected(new Set(result.drafts.map((draft) => draft.index)));
    setStep({ kind: "preview" });
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void pick(event.dataTransfer.files[0]);
  }

  async function runImport() {
    if (!checked) return;
    const chosen = checked.drafts.filter((draft) => selected.has(draft.index));
    if (chosen.length === 0) return;
    setStep({ kind: "importing" });
    // What was typed in the open draft is written first, so a pending save can't land in the middle of the import.
    await controller.flush();
    const items = await repo.importDrafts(
      chosen.map(({ profile, photos }) => ({ profile, photos })),
      { mode, restoredName: (profile) => restoredTitleOf({ draftName: profile.draftName, fullName: fullNameOf(profile) }) },
    );
    if (!alive.current) return;
    const openId = controller.getSnapshot().profile.id;
    setOutcome({ chosen, items, replacedOpen: items.some((item) => item.ok && item.status === "replaced" && item.id === openId) });
    setStep({ kind: "result" });
  }

  const busy = step.kind === "importing" || step.kind === "checking";
  const stale = step.kind === "result" && !!outcome?.replacedOpen;
  useEffect(() => {
    report({ busy, stale });
  });

  if (step.kind === "pick" || step.kind === "checking") {
    const checking = step.kind === "checking";
    return (
      <div>
        <p className="-mt-3 mb-4 text-sm text-pretty text-ink-3">{t("backup.restore.pickDescription")}</p>
        <div
          onDragOver={(event) => {
            if (checking || !event.dataTransfer.types.includes("Files")) return;
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
          }}
          onDrop={(event) => (checking ? event.preventDefault() : onDrop(event))}
          data-testid="backup-drop"
          className={`flex flex-col items-center gap-3 rounded-2xl border border-dashed px-4 py-8 text-center transition-colors sm:py-10 ${dragging ? "border-brand bg-brand-soft" : "border-line-strong bg-sunken"}`}
        >
          {checking ? (
            <p role="status" className="flex flex-col items-center gap-3 text-sm text-ink-2">
              <Spinner className="size-6" />
              <span className="break-all">{t("backup.restore.checking", { name: step.file })}</span>
              {step.total > 0 && <span className="text-[13px] text-ink-3">{t("backup.restore.checkingProgress", { done: Math.min(step.done + 1, step.total), total: step.total })}</span>}
            </p>
          ) : (
            <>
              <span className="flex size-11 items-center justify-center rounded-xl bg-surface text-ink-3 shadow-card">
                <Icon name="backup" className="size-5" />
              </span>
              <button type="button" className={button("primary", "lg")} data-autofocus onClick={() => input.current?.click()}>
                <Icon name="file" className="size-4" />
                {t("backup.restore.choose")}
              </button>
              <p className="text-[13px] text-ink-3">{dragging ? t("backup.restore.dropActive") : t("backup.restore.drop")}</p>
              <p className="max-w-sm text-[13px] text-pretty text-ink-3">
                {t("backup.restore.fileHint")} <span className="whitespace-nowrap">{t("backup.restore.fileExample")}</span>.
              </p>
            </>
          )}
          <input
            ref={input}
            type="file"
            accept={BACKUP_ACCEPT}
            className="hidden"
            tabIndex={-1}
            data-testid="backup-input"
            onChange={(event) => {
              void pick(event.target.files?.[0]);
              event.target.value = ""; // so choosing the same file again still counts
            }}
          />
        </div>
        {step.kind === "pick" && step.error && (
          <p role="alert" data-testid="backup-error" className={`mt-4 ${formError}`}>
            {step.error}
          </p>
        )}
        <DialogActions>
          <button type="button" className={button("secondary")} onClick={close} disabled={checking}>
            {t("ui.cancel")}
          </button>
        </DialogActions>
      </div>
    );
  }

  if (!checked) return null;

  if (step.kind === "result" && outcome) {
    return <Result outcome={outcome} checked={checked} onClose={close} heading={heading} />;
  }

  // Preview (also shown, disabled, while importing).
  const importing = step.kind === "importing";
  const skipped = checked.warnings.filter((warning) => warning.kind === "draftSkipped");
  const count = selected.size;
  const allSelected = count === checked.drafts.length;
  const date = checked.exportedAt ? new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(Date.parse(checked.exportedAt)) : null;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!importing && count > 0) void runImport();
      }}
      data-testid="backup-preview"
    >
      <p ref={intro} tabIndex={-1} className="-mt-3 text-sm text-pretty text-ink-2 outline-none">
        {date ? t("backup.restore.found", { drafts: draftCount(checked.drafts.length), date }) : t("backup.restore.foundNoDate", { drafts: draftCount(checked.drafts.length) })}
      </p>
      <p className="mt-0.5 text-xs break-all text-ink-3">{checked.file}</p>

      <fieldset disabled={importing} className="mt-4 min-w-0">
        <legend className="sr-only">{t("backup.restore.list")}</legend>
        <div className="overflow-hidden rounded-xl border border-line">
          <SelectAll
            checked={allSelected}
            indeterminate={count > 0 && !allSelected}
            onChange={(on) => setSelected(on ? new Set(checked.drafts.map((draft) => draft.index)) : new Set())}
            summary={t("backup.restore.selected", { count, total: checked.drafts.length })}
          />
          <ul className="max-h-[min(34dvh,18rem)] divide-y divide-line overflow-y-auto overscroll-contain" data-testid="backup-drafts">
            {checked.drafts.map((draft) => (
              <DraftRow
                key={draft.index}
                draft={draft}
                warnings={checked.warnings.filter((w): w is PhotoWarning => w.kind === "photoDropped" && w.index === draft.index)}
                checked={selected.has(draft.index)}
                onChange={(on) =>
                  setSelected((current) => {
                    const next = new Set(current);
                    if (on) next.add(draft.index);
                    else next.delete(draft.index);
                    return next;
                  })
                }
                mode={mode}
                local={here.get(draft.profile.id)}
              />
            ))}
          </ul>
        </div>
      </fieldset>

      {skipped.length > 0 && <Skipped warnings={skipped} className="mt-3" />}

      <fieldset disabled={importing} className="mt-5 min-w-0 space-y-2.5">
        <legend className="mb-2.5 text-sm font-medium text-ink">{t("backup.restore.mode")}</legend>
        <ModeChoice mode="add" current={mode} onSelect={setMode} label={t("backup.restore.mode.add")} hint={t("backup.restore.mode.addHint")} />
        <ModeChoice mode="replace" current={mode} onSelect={setMode} label={t("backup.restore.mode.replace")} hint={t("backup.restore.mode.replaceHint")} />
      </fieldset>

      {mode === "replace" && (
        <div className="mt-3 rounded-xl border border-line bg-sunken p-3">
          <BackupButton run={() => downloadBackup(repo, { open: () => ({ profile: controller.getSnapshot().profile, pendingPhotos: controller.pendingPhotos() }) })} hint={t("backup.first.replaceHint")} disabled={importing} />
        </div>
      )}

      <p role="status" className={count === 0 ? "mt-3 text-[13px] text-ink-3" : "sr-only"}>
        {count === 0 ? t("backup.restore.noneSelected") : importing ? t("backup.restore.importing") : ""}
      </p>
      <DialogActions>
        <button
          type="button"
          className={button("secondary")}
          disabled={importing}
          onClick={() => {
            setChecked(null);
            setStep({ kind: "pick" });
          }}
        >
          {t("backup.restore.back")}
        </button>
        <button type="submit" className={button("primary")} disabled={importing || count === 0} data-testid="backup-import">
          {importing ? <Spinner /> : <Icon name="backup" className="size-4" />}
          {importing ? t("backup.restore.importing") : count === 1 ? t("backup.restore.confirm.one") : t("backup.restore.confirm.many", { count })}
        </button>
      </DialogActions>
    </form>
  );
}

function SelectAll({ checked, indeterminate, onChange, summary }: { checked: boolean; indeterminate: boolean; onChange: (on: boolean) => void; summary: string }) {
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (box.current) box.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label className="flex cursor-pointer items-center gap-3 border-b border-line bg-sunken px-3 py-2.5 text-sm font-medium text-ink pointer-coarse:min-h-11">
      <input ref={box} type="checkbox" className={choice} checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="flex-1">{t("backup.restore.selectAll")}</span>
      <span className="text-[13px] font-normal text-ink-3">{summary}</span>
    </label>
  );
}

function DraftRow({
  draft,
  warnings,
  checked,
  onChange,
  mode,
  local,
}: {
  draft: ParsedDraft;
  warnings: PhotoWarning[];
  checked: boolean;
  onChange: (on: boolean) => void;
  mode: ImportMode;
  /** When the draft with this id was last edited in this browser, if there is one. */
  local: string | undefined;
}) {
  const { profile, photos } = draft;
  let status: { text: string; tone: "plain" | "brand" | "warn" } | null = null;
  if (mode === "replace") {
    if (local === undefined) status = { text: t("backup.restore.row.new"), tone: "plain" };
    else {
      const newer = Date.parse(local) > Date.parse(profile.updatedAt);
      status = { text: t(newer ? "backup.restore.row.replacesNewer" : "backup.restore.row.replaces", { edited: editedAgo(local) }), tone: newer ? "warn" : "brand" };
    }
  } else if (local !== undefined) {
    status = { text: t("backup.restore.row.copy"), tone: "plain" };
  }
  return (
    <li>
      <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-sunken pointer-coarse:min-h-11 has-disabled:cursor-default has-disabled:hover:bg-transparent">
        <input type="checkbox" className={`${choice} mt-[3px]`} checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink" data-testid="backup-draft-name">
            {nameOf(profile)}
          </span>
          <span className="block text-[13px] text-ink-3">
            {editedAgo(profile.updatedAt)} · {photos.length ? (photos.length === 1 ? t("backup.restore.hasPhoto") : photoCount(photos.length)) : t("backup.restore.noPhoto")}
          </span>
          {status && <span className={`block text-[13px] ${status.tone === "brand" ? "text-brand-ink" : status.tone === "warn" ? "text-warn" : "text-ink-3"}`}>{status.text}</span>}
        </span>
      </label>
      {warnings.map((warning) => (
        <p key={warning.reason} className="flex gap-2 px-3 pb-2.5 pl-10 text-[13px] text-warn">
          <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
          {t("backup.restore.photoNote", { reason: photoProblemText(warning.reason) })}
        </p>
      ))}
    </li>
  );
}

function ModeChoice({ mode, current, onSelect, label, hint }: { mode: ImportMode; current: ImportMode; onSelect: (mode: ImportMode) => void; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 transition-colors hover:bg-sunken has-checked:border-brand has-checked:bg-brand-soft pointer-coarse:min-h-11 has-disabled:cursor-default has-disabled:opacity-70">
      <input type="radio" name="backup-mode" className={`${choice} mt-0.5`} checked={current === mode} onChange={() => onSelect(mode)} />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="mt-0.5 block text-[13px] text-pretty text-ink-3">{hint}</span>
      </span>
    </label>
  );
}

/** The drafts of the file that can't be restored, and why. */
function Skipped({ warnings, className = "" }: { warnings: BackupWarning[]; className?: string }) {
  return (
    <div className={`rounded-xl border border-warn/30 bg-warn-soft p-3 ${className}`} data-testid="backup-skipped">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon name="alert" className="size-4 text-warn" />
        {t("backup.restore.skipped.title")}
      </p>
      <p className="mt-1 text-[13px] text-ink-2">{t("backup.restore.skipped.text")}</p>
      <ul className="mt-1.5 space-y-1 text-[13px] text-ink-2">
        {warnings.map((warning, i) =>
          warning.kind === "draftSkipped" ? (
            <li key={i} className="break-words">
              {t("backup.restore.skipped.item", { name: warning.name.trim() || t("drafts.untitled"), reason: draftProblemText(warning.reason) })}
            </li>
          ) : null,
        )}
      </ul>
    </div>
  );
}

function Result({ outcome, checked, onClose, heading }: { outcome: Outcome; checked: Checked; onClose: () => void; heading: React.RefObject<HTMLHeadingElement | null> }) {
  const { chosen, items, replacedOpen } = outcome;
  const added = items.filter((item) => item.ok && item.status === "added").length;
  const replaced = items.filter((item) => item.ok && item.status === "replaced").length;
  const left = checked.warnings.filter((warning) => warning.kind === "draftSkipped");
  const skipped = items.filter((item) => !item.ok).length + left.length;
  const parts = [
    added && t(added === 1 ? "backup.result.added.one" : "backup.result.added.many", { count: added }),
    replaced && t(replaced === 1 ? "backup.result.replaced.one" : "backup.result.replaced.many", { count: replaced }),
    skipped && t(skipped === 1 ? "backup.result.skipped.one" : "backup.result.skipped.many", { count: skipped }),
  ].filter(Boolean);
  const anyFailed = items.some((item) => !item.ok);

  return (
    <div data-testid="backup-result">
      <h3 ref={heading} tabIndex={-1} className="text-base font-semibold text-ink outline-none">
        {added + replaced > 0 ? t("backup.restore.done") : t("backup.restore.doneNone")}
      </h3>
      <p role="status" className="mt-1 text-sm text-ink-2" data-testid="backup-summary">
        {parts.join(", ")}
        {parts.length > 0 ? "." : ""}
      </p>

      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line">
        {items.map((item, i) => {
          const draft = chosen[i];
          const name = item.ok ? titleOf({ draftName: item.draftName, fullName: fullNameOf(draft.profile) }) : nameOf(draft.profile);
          const notes = checked.warnings.filter((warning): warning is PhotoWarning => warning.kind === "photoDropped" && warning.index === draft.index);
          return (
            <li key={draft.index} className="flex items-start gap-3 px-3 py-2.5 pointer-coarse:min-h-11">
              <Icon name={item.ok ? "check" : "alert"} className={`mt-0.5 size-4 shrink-0 ${item.ok ? "text-good" : "text-danger"}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{name}</p>
                <p className={`text-[13px] ${item.ok ? "text-ink-3" : "text-danger"}`}>
                  {item.ok ? t(item.status === "added" ? "backup.restore.added" : "backup.restore.replaced") : t("backup.restore.notImported", { reason: importProblemText(item.error.kind) })}
                </p>
                {notes.map((note) => (
                  <p key={note.reason} className="text-[13px] text-warn">
                    {t("backup.restore.photoNote", { reason: photoProblemText(note.reason) })}
                  </p>
                ))}
              </div>
              {item.ok && (
                <a href={`/editor?d=${encodeURIComponent(item.id)}`} className={`${textLink} -my-1 inline-flex items-center px-1 py-1 text-sm pointer-coarse:min-h-11`} aria-label={t("backup.restore.openLabel", { name })}>
                  {t("backup.restore.open")}
                </a>
              )}
            </li>
          );
        })}
      </ul>

      {left.length > 0 && <Skipped warnings={left} className="mt-3" />}
      {anyFailed && <p className="mt-3 text-[13px] text-pretty text-ink-3">{t("backup.restore.failedNote")}</p>}
      {replacedOpen && (
        <p role="status" className="mt-3 rounded-xl border border-brand/20 bg-brand-soft p-3 text-sm text-pretty text-ink-2">
          {t("backup.restore.replacedOpen")}
        </p>
      )}
      <DialogActions>
        <button type="button" className={button("primary")} onClick={onClose}>
          {replacedOpen ? <Icon name="refresh" className="size-4" /> : null}
          {replacedOpen ? t("backup.restore.reload") : t("backup.restore.close")}
        </button>
      </DialogActions>
    </div>
  );
}
