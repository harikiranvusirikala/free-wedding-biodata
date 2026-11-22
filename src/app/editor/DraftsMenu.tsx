"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { createSampleProfile } from "@/biodata/defaults";
import { fullNameOf, renameDraft } from "@/biodata/draft-name";
import type { BiodataProfile } from "@/biodata/types";
import { DeleteAllDialog } from "@/components/DeleteAllDialog";
import { button, focusRing } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { field, fieldHint, fieldLabel } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { Menu, MenuLabel, MenuSeparator, dangerMenuItem, menuItem } from "@/components/ui/Menu";
import { Toast } from "@/components/ui/Toast";
import type { AutosaveController } from "@/lib/autosave";
import type { BiodataDb } from "@/lib/db";
import { copyTitleOf, editedAgo, titleOf } from "@/lib/draft-title";
import { t } from "@/lib/i18n";
import type { DraftSummary, ProfileRepo } from "@/lib/profile-repo";

// The drafts menu in the editor's header (BUILD_PLAN Step 1.4, VISION §5 "Draft manager", mockup: editor): the
// open draft's name as the button; the drafts in this browser, newest first, each opening with a full page load
// after the open draft's changes are written; New draft, Rename, Duplicate, Delete; and Delete all my local data.
// A draft that can't be opened is listed as such, with Delete only. Nothing is deleted without a confirmation.

type Leave = (url: string) => Promise<void>;

/** A draft's address in the editor, as a full URL (a full page load, never the router: see Editor.tsx `started`). */
function editorUrl(id: string): URL {
  const url = new URL("/editor", window.location.href);
  url.searchParams.set("d", id);
  return url;
}

/** Where the editor goes after the open draft is deleted: the newest remaining draft, else a new one. */
function nextAfterDelete(drafts: DraftSummary[], deletedId: string): string {
  const next = drafts.find((draft) => draft.ok && draft.id !== deletedId);
  return next ? `/editor?d=${encodeURIComponent(next.id)}` : "/editor?new=1";
}

export function DraftsMenu(props: {
  controller: AutosaveController;
  profile: BiodataProfile;
  repo: ProfileRepo;
  db: BiodataDb;
  /** Writes pending changes, then loads `url` (stays, showing why, if they can't be written). */
  leave: Leave;
  /** Another tab owns this draft (D9): renaming and copying would be lost or stale, so they're off. */
  locked: boolean;
}) {
  const { controller, profile, repo, db, leave, locked } = props;
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [dialog, setDialog] = useState<{ kind: "rename" } | { kind: "delete"; draft: { id: string; name: string; broken: boolean } } | { kind: "deleteAll" } | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: "good" | "danger" } | null>(null);
  const [busy, setBusy] = useState(false);

  const title = titleOf({ draftName: profile.draftName, fullName: fullNameOf(profile) });

  const refresh = useCallback(async () => {
    const listed = await repo.list();
    if (listed.ok) setDrafts(listed.value);
  }, [repo]);

  useEffect(() => {
    let live = true;
    void repo.list().then((listed) => {
      if (live && listed.ok) setDrafts(listed.value);
    });
    return () => {
      live = false;
    };
  }, [repo]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  const fail = (text = t("drafts.failed")) => setToast({ text, tone: "danger" });

  /** The open draft's changes are on disk (or can't be saved by this tab at all). */
  async function written(): Promise<boolean> {
    await controller.flush();
    const after = controller.getSnapshot();
    return !after.unsaved;
  }

  async function duplicate() {
    setBusy(true);
    if (!(await written())) {
      setBusy(false);
      return fail(t("drafts.notSaved"));
    }
    const result = await repo.duplicate(profile.id, { draftName: copyTitleOf({ draftName: profile.draftName, fullName: fullNameOf(profile) }) });
    if (result.ok) {
      window.location.assign(editorUrl(result.profile.id));
      return;
    }
    setBusy(false);
    fail();
  }

  /**
   * Open a sample (Step 2.3): the fictional sample as a new draft, opened with a full page load. The open draft's
   * changes are written first and the draft itself is never touched; if they can't be written, nothing happens.
   */
  async function openSample() {
    setBusy(true);
    await controller.flush();
    const after = controller.getSnapshot();
    const lost = after.status.state === "error" && after.status.kind === "conflict";
    if (after.unsaved && !lost) {
      setBusy(false);
      return fail(t("drafts.notSaved"));
    }
    const created = await repo.create(createSampleProfile());
    if (created.ok) {
      window.location.assign(editorUrl(created.profile.id));
      return;
    }
    setBusy(false);
    fail();
  }

  async function remove(target: { id: string; broken: boolean }) {
    setBusy(true);
    const current = target.id === profile.id;
    // Nothing of the open draft may be written after it's gone (a save would only report a conflict).
    if (current) await controller.flush();
    const removed = await repo.remove(target.id);
    if (!removed.ok) {
      setBusy(false);
      setDialog(null);
      return fail();
    }
    if (current) {
      const listed = await repo.list();
      window.location.assign(new URL(nextAfterDelete(listed.ok ? listed.value : [], target.id), window.location.href));
      return;
    }
    await refresh();
    setBusy(false);
    setDialog(null);
    setToast({ text: t("drafts.deleted"), tone: "good" });
  }

  const others = drafts.filter((draft) => draft.id !== profile.id);
  const openDrafts = [{ id: profile.id, name: title, updatedAt: profile.updatedAt, current: true }, ...others.filter((d) => d.ok).map((d) => ({ id: d.id, name: titleOf(d as Extract<DraftSummary, { ok: true }>), updatedAt: d.updatedAt, current: false }))];
  // Newest first, the open one in its place by its own (live) time.
  openDrafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const broken = others.filter((d) => !d.ok);

  return (
    <>
      <Menu
        label={t("drafts.menu")}
        buttonTitle={t("drafts.buttonTitle")}
        buttonClassName={`flex min-w-0 max-w-full gap-1.5 rounded-lg text-left font-semibold text-ink transition-colors hover:bg-sunken aria-expanded:bg-sunken ${focusRing} h-12 w-full items-start px-2 pt-1 text-[15px] leading-5 sm:h-9 sm:w-auto sm:max-w-[16rem] sm:items-center sm:bg-sunken sm:px-2.5 sm:pt-0 sm:text-sm lg:max-w-[20rem] sm:hover:bg-line/70`}
        button={
          <>
            <span className="truncate" data-testid="draft-title">
              {title}
            </span>
            <Icon name="chevronDown" className="mt-0.5 size-4 text-ink-3 sm:mt-0" />
          </>
        }
        align="start"
        menuClassName="w-80 max-sm:fixed max-sm:inset-x-3 max-sm:top-[3.75rem] max-sm:w-auto max-sm:max-w-none"
        onOpen={() => void refresh()}
      >
        {(close) => (
          <>
            <MenuLabel>{t("drafts.list")}</MenuLabel>
            <div className="max-h-[min(42dvh,18rem)] overflow-y-auto overscroll-contain" data-testid="drafts-list">
              {openDrafts.map((draft) => (
                <button
                  key={draft.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={draft.current}
                  className={`${menuItem} items-start`}
                  onClick={() => {
                    close();
                    if (!draft.current) void leave(`/editor?d=${encodeURIComponent(draft.id)}`);
                  }}
                >
                  <Icon name="file" className={`mt-0.5 size-[18px] ${draft.current ? "text-brand-ink" : "text-ink-3"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{draft.name}</span>
                    <span className="block text-xs font-normal text-ink-3">{editedAgo(draft.updatedAt)}</span>
                  </span>
                  {draft.current && <Icon name="check" className="mt-0.5 size-[18px] text-brand-ink" />}
                </button>
              ))}
              {broken.map((draft) => {
                const name = draft.draftName.trim() || t("drafts.unnamedBroken");
                return (
                  <button
                    key={draft.id}
                    type="button"
                    role="menuitem"
                    className={`${menuItem} items-start`}
                    data-testid="broken-draft"
                    onClick={() => {
                      close();
                      setDialog({ kind: "delete", draft: { id: draft.id, name, broken: true } });
                    }}
                  >
                    <Icon name="alert" className="mt-0.5 size-[18px] text-danger" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{name}</span>
                      <span className="block text-xs font-normal text-danger">{t("drafts.broken")}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-danger">
                      <Icon name="trash" className="size-4" />
                      {t("drafts.deleteBroken")}
                    </span>
                  </button>
                );
              })}
            </div>
            <MenuSeparator />
            <button type="button" role="menuitem" className={menuItem} disabled={busy} onClick={() => {
              close();
              void leave("/editor?new=1");
            }}>
              <Icon name="plus" className="size-[18px]" />
              {t("drafts.new")}
            </button>
            <button type="button" role="menuitem" className={`${menuItem} items-start`} disabled={busy} onClick={() => {
              close();
              void openSample();
            }}>
              <Icon name="sparkle" className="mt-0.5 size-[18px]" />
              <span className="min-w-0 flex-1">
                <span className="block">{t("drafts.sample")}</span>
                <span className="block text-xs font-normal text-ink-3">{t("drafts.sampleHint")}</span>
              </span>
            </button>
            <button type="button" role="menuitem" className={menuItem} disabled={locked || busy} onClick={() => {
              close();
              setDialog({ kind: "rename" });
            }}>
              <Icon name="edit" className="size-[18px]" />
              {t("drafts.rename")}
            </button>
            <button type="button" role="menuitem" className={menuItem} disabled={locked || busy} onClick={() => {
              close();
              void duplicate();
            }}>
              <Icon name="copy" className="size-[18px]" />
              {t("drafts.duplicate")}
            </button>
            <button type="button" role="menuitem" className={dangerMenuItem} disabled={busy} onClick={() => {
              close();
              setDialog({ kind: "delete", draft: { id: profile.id, name: title, broken: false } });
            }}>
              <Icon name="trash" className="size-[18px]" />
              {t("drafts.delete")}
            </button>
            <MenuSeparator />
            <button type="button" role="menuitem" className={dangerMenuItem} disabled={busy} onClick={() => {
              close();
              setDialog({ kind: "deleteAll" });
            }}>
              <Icon name="alert" className="size-[18px]" />
              {t("drafts.deleteAll")}
            </button>
          </>
        )}
      </Menu>

      <RenameDialog
        open={dialog?.kind === "rename"}
        profile={profile}
        onClose={() => setDialog(null)}
        onSave={async (name) => {
          controller.update(renameDraft(profile, name));
          setDialog(null);
          await controller.flush();
          void refresh();
        }}
      />

      <Dialog
        open={dialog?.kind === "delete"}
        onClose={() => !busy && setDialog(null)}
        title={dialog?.kind === "delete" ? t("delete.title", { name: dialog.draft.name }) : ""}
        description={dialog?.kind === "delete" && dialog.draft.broken ? t("delete.brokenText") : t("delete.text")}
      >
        <DialogActions>
          <button type="button" className={button("secondary")} onClick={() => setDialog(null)} disabled={busy}>
            {t("ui.cancel")}
          </button>
          <button type="button" className={button("danger")} disabled={busy} onClick={() => dialog?.kind === "delete" && void remove(dialog.draft)}>
            <Icon name="trash" className="size-4" />
            {t("delete.confirm")}
          </button>
        </DialogActions>
      </Dialog>

      <DeleteAllDialog open={dialog?.kind === "deleteAll"} onClose={() => setDialog(null)} db={() => db} />

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 lg:bottom-5 flex justify-center px-4">
          <Toast tone={toast.tone} role={toast.tone === "danger" ? "alert" : "status"}>
            {toast.text}
          </Toast>
        </div>
      )}
    </>
  );
}

/** Rename: the name only you see (never printed). Empty goes back to the automatic name from the Full name. */
function RenameDialog({ open, profile, onClose, onSave }: { open: boolean; profile: BiodataProfile; onClose: () => void; onSave: (name: string) => Promise<void> }) {
  const inputId = useId();
  const hintId = useId();
  const [name, setName] = useState(profile.draftName);
  const automatic = titleOf({ draftName: "", fullName: fullNameOf(profile) });

  // Each opening starts from the stored name.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setName(profile.draftName);
  }

  return (
    <Dialog open={open} onClose={onClose} title={t("rename.title")} description={t("rename.description")}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onSave(name);
        }}
      >
        <label htmlFor={inputId} className={fieldLabel}>
          {t("rename.label")}
        </label>
        <input
          id={inputId}
          className={`mt-1.5 ${field}`}
          value={name}
          placeholder={automatic}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
          aria-describedby={hintId}
        />
        <p id={hintId} className={`mt-1.5 ${fieldHint}`}>
          {t("rename.hint", { example: automatic })}
        </p>
        <DialogActions>
          <button type="button" className={button("secondary")} onClick={onClose}>
            {t("ui.cancel")}
          </button>
          <button type="submit" className={button("primary")}>
            {t("rename.save")}
          </button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
