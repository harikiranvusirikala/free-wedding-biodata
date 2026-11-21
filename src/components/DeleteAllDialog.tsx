"use client";

import { useId, useState } from "react";
import { button } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { field, fieldLabel, formError } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import type { BiodataDb } from "@/lib/db";
import { t } from "@/lib/i18n";

/**
 * "Delete all my local data" (VISION §9, Step 1.4), from the drafts menu and the privacy page: a dialog that
 * says what goes and asks for the word DELETE before its button works, then deletes the database and this
 * site's settings and goes to the home page. The storage code is loaded only when it's confirmed, so the
 * privacy page doesn't carry it. The editor passes its own open database, which is then closed for good, so
 * a late autosave can't bring an empty one back.
 */
export function DeleteAllDialog({ open, onClose, db }: { open: boolean; onClose: () => void; db?: () => BiodataDb }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const inputId = useId();
  const errorId = useId();
  const confirmed = typed.trim().toUpperCase() === t("deleteAll.word");

  function close() {
    if (busy) return;
    setTyped("");
    setFailed(false);
    onClose();
  }

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    if (!confirmed || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const { deleteAllLocalData } = await import("@/lib/local-data");
      const result = await deleteAllLocalData(db?.());
      if (result.ok) {
        // A full page load: every tab's state of this site is gone, so start from the home page afresh.
        window.location.assign(new URL("/", window.location.href));
        return;
      }
    } catch {
      // The module couldn't load (offline before Step 5.2's service worker): nothing was deleted.
    }
    setBusy(false);
    setFailed(true);
  }

  return (
    <Dialog open={open} onClose={close} title={t("deleteAll.title")} description={t("deleteAll.text")}>
      <form onSubmit={confirm} data-testid="delete-all-dialog">
        <label htmlFor={inputId} className={fieldLabel}>
          {t("deleteAll.label")}
        </label>
        <input
          id={inputId}
          className={`mt-1.5 ${field}`}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-describedby={failed ? errorId : undefined}
        />
        {failed && (
          <p id={errorId} role="alert" className={`mt-3 ${formError}`}>
            {t("deleteAll.failed")}
          </p>
        )}
        <DialogActions>
          <button type="button" className={button("secondary")} onClick={close} disabled={busy}>
            {t("ui.cancel")}
          </button>
          <button type="submit" className={button("danger")} disabled={!confirmed || busy}>
            <Icon name="trash" className="size-4" />
            {t("deleteAll.confirm")}
          </button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/** The privacy page's card: what it does, and the button that opens the dialog. */
export function DeleteAllCard() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3.5 rounded-2xl border border-danger-line bg-surface p-[18px] shadow-card sm:flex-row sm:items-center sm:gap-6 xl:flex-col xl:items-stretch xl:gap-3.5">
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-semibold tracking-tight text-danger">{t("privacy.deleteAll.title")}</h2>
        <p className="mt-1 text-[13.5px] text-pretty text-ink-3">{t("privacy.deleteAll.text")}</p>
      </div>
      <button type="button" className={`${button("dangerOutline")} sm:self-center xl:self-stretch`} onClick={() => setOpen(true)}>
        <Icon name="trash" className="size-4" />
        {t("privacy.deleteAll.action")}
      </button>
      <DeleteAllDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
