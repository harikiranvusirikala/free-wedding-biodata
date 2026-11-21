"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  insertField,
  insertSection,
  locateField,
  removeField,
  removeSection,
  renameField,
  renameSection,
  resetFieldLabel,
  resetSectionTitle,
} from "@/biodata/edits";
import type { BiodataProfile, Field, Section } from "@/biodata/types";
import { button, iconButton, textLink } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { field as fieldClass, fieldHint, fieldLabel as fieldLabelClass } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { Toast, toastAction } from "@/components/ui/Toast";
import { t } from "@/lib/i18n";
import { AddFieldDialog } from "./AddFieldDialog";
import { AddSectionDialog } from "./AddSectionDialog";
import type { Edit } from "./FieldRow";
import { defaultFieldLabel, defaultSectionTitle, fieldLabel, sectionTitle } from "./labels";

// Field and section management (BUILD_PLAN Step 2.2, VISION §6): the dialogs the ⋯ menus and the Add buttons open
// (rename, remove, add a field, add a section) and the toast that follows a change, with Undo after a removal.
// Rows and cards reach it through one stable context value, so opening a dialog never re-renders the form.
//
// Undo keeps what was removed and where, in memory only: it puts that one field or section back at its place in
// the profile as it is now (edits typed meanwhile survive), for as long as the toast shows (6 s, paused while the
// pointer or the focus is on it). A reload or another draft forgets it, so nothing comes back from the past.

export type ManageDialog =
  | { kind: "renameField"; fieldId: string }
  | { kind: "removeField"; fieldId: string }
  | { kind: "renameSection"; sectionId: string }
  | { kind: "removeSection"; sectionId: string }
  | { kind: "addField"; sectionId: string }
  | { kind: "addSection" };

export interface Manage {
  /** The latest profile (menus read it as they open, so rows needn't re-render when other parts change). */
  current(): BiodataProfile;
  edit: Edit;
  open(dialog: ManageDialog): void;
  /** A short message at the bottom of the screen, with Undo when `undo` is given. */
  notify(text: string, undo?: () => void): void;
  /** After the change just made is on screen: focus the element with this id and bring it into view. */
  focusSoon(id: string): void;
  /** Scrolls to a section's card and focuses its title (the section rail's jump). */
  jump(sectionId: string): void;
}

const ManageContext = createContext<Manage | null>(null);

export function useManage(): Manage {
  const manage = useContext(ManageContext);
  if (!manage) throw new Error("useManage outside ManageProvider");
  return manage;
}

/** The id of a field's ⋯ button and a section's ⋯ button (Menu `id` + "-button"), for putting the focus back. */
export const fieldMenuId = (fieldId: string) => `field-menu-${fieldId}`;
export const sectionMenuId = (sectionId: string) => `section-menu-${sectionId}`;

const TOAST_MS = 6000;

/** Runs after React has drawn the change just made (two frames: the store update, then the paint). */
const afterRender = (run: () => void) => requestAnimationFrame(() => requestAnimationFrame(run));

function findField(profile: BiodataProfile, fieldId: string): Field | undefined {
  const at = locateField(profile, fieldId);
  return at?.section.fields[at.index];
}

export function ManageProvider({
  profile,
  current,
  edit,
  jump,
  children,
}: {
  profile: BiodataProfile;
  current: () => BiodataProfile;
  edit: Edit;
  jump: (sectionId: string) => void;
  children: ReactNode;
}) {
  const [dialog, setDialog] = useState<ManageDialog | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string; undo?: () => void } | null>(null);
  const toastCount = useRef(0);

  const notify = useCallback((text: string, undo?: () => void) => setToast({ id: ++toastCount.current, text, undo }), []);

  const focusSoon = useCallback((id: string) => {
    afterRender(() => {
      const element = document.getElementById(id);
      if (!element) return;
      element.focus({ preventScroll: true });
      element.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
  }, []);

  const manage = useMemo<Manage>(
    () => ({ current, edit, open: setDialog, notify, focusSoon, jump: (id) => afterRender(() => jump(id)) }),
    [current, edit, notify, focusSoon, jump],
  );

  const close = () => setDialog(null);

  /** Removes a field, with Undo putting it back at its place; the focus goes to its section's title. */
  function confirmRemoveField(fieldId: string) {
    const at = locateField(current(), fieldId);
    close();
    if (!at) return;
    const removed = at.section.fields[at.index];
    const sectionId = at.section.id;
    const label = fieldLabel(removed);
    edit((p) => removeField(p, fieldId));
    focusSoon(`section-${sectionId}-title`);
    notify(t("manage.removed", { label }), () => {
      edit((p) => insertField(p, sectionId, at.index, removed));
      notify(t("manage.back.done", { label }));
      focusSoon(fieldMenuId(fieldId) + "-button");
    });
  }

  /** Removes a section, with Undo putting it back at its place; the focus goes to the next section's title. */
  function confirmRemoveSection(sectionId: string) {
    const sections = current().sections;
    const index = sections.findIndex((s) => s.id === sectionId);
    close();
    if (index < 0) return;
    const removed = sections[index];
    const next = sections[index + 1] ?? sections[index - 1];
    const title = sectionTitle(removed);
    edit((p) => removeSection(p, sectionId));
    focusSoon(next ? `section-${next.id}-title` : "add-section");
    notify(t("manage.removed", { label: title }), () => {
      edit((p) => insertSection(p, index, removed));
      notify(t("manage.back.done", { label: title }));
      focusSoon(sectionMenuId(sectionId) + "-button");
    });
  }

  const field = dialog && (dialog.kind === "renameField" || dialog.kind === "removeField") ? findField(profile, dialog.fieldId) : undefined;
  const section: Section | undefined =
    dialog && (dialog.kind === "renameSection" || dialog.kind === "removeSection" || dialog.kind === "addField")
      ? profile.sections.find((s) => s.id === dialog.sectionId)
      : undefined;

  return (
    <ManageContext.Provider value={manage}>
      {children}

      <RenameDialog
        open={dialog?.kind === "renameField" && !!field}
        title={field ? t("manage.renameField.title", { label: fieldLabel(field) }) : ""}
        label={t("manage.renameField.label")}
        current={field ? fieldLabel(field) : ""}
        usual={field ? defaultFieldLabel(field) : undefined}
        renamed={field?.label !== undefined}
        hint={field?.key ? t("manage.renameField.hintDefault") : t("manage.renameField.hintCustom")}
        resetText={(usual) => t("manage.renameField.reset", { label: usual })}
        onClose={close}
        onSave={(value) => {
          if (!field) return;
          const id = field.id;
          edit((p) => (value === null ? resetFieldLabel(p, id) : renameField(p, id, value)));
          close();
        }}
      />

      <RenameDialog
        open={dialog?.kind === "renameSection" && !!section}
        title={section ? t("manage.renameSection.title", { title: sectionTitle(section) }) : ""}
        label={t("manage.renameSection.label")}
        current={section ? sectionTitle(section) : ""}
        usual={section ? defaultSectionTitle(section) : undefined}
        renamed={section?.title !== undefined}
        hint={section?.key ? t("manage.renameField.hintDefault") : t("manage.renameField.hintCustom")}
        resetText={(usual) => t("manage.renameSection.reset", { title: usual })}
        onClose={close}
        onSave={(value) => {
          if (!section) return;
          const id = section.id;
          edit((p) => (value === null ? resetSectionTitle(p, id) : renameSection(p, id, value)));
          close();
        }}
      />

      <Dialog
        open={dialog?.kind === "removeField" && !!field}
        onClose={close}
        title={field ? t("manage.removeField.title", { label: fieldLabel(field) }) : ""}
        description={t("manage.removeField.text")}
      >
        <DialogActions>
          <button type="button" className={button("secondary")} onClick={close}>
            {t("ui.cancel")}
          </button>
          <button type="button" className={button("danger")} onClick={() => field && confirmRemoveField(field.id)}>
            <Icon name="trash" className="size-4" />
            {t("manage.removeConfirm")}
          </button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={dialog?.kind === "removeSection" && !!section}
        onClose={close}
        title={section ? t("manage.removeSection.title", { title: sectionTitle(section) }) : ""}
        description={t("manage.removeSection.text")}
      >
        <DialogActions>
          <button type="button" className={button("secondary")} onClick={close}>
            {t("ui.cancel")}
          </button>
          <button type="button" className={button("danger")} onClick={() => section && confirmRemoveSection(section.id)}>
            <Icon name="trash" className="size-4" />
            {t("manage.removeConfirm")}
          </button>
        </DialogActions>
      </Dialog>

      <AddFieldDialog
        open={dialog?.kind === "addField" && section?.kind === "fields"}
        section={section?.kind === "fields" ? section : undefined}
        profile={profile}
        edit={edit}
        onClose={close}
        onAdded={(fieldId) => focusSoon(`field-${fieldId}`)}
      />

      <AddSectionDialog
        open={dialog?.kind === "addSection"}
        profile={profile}
        edit={edit}
        onClose={close}
        onAdded={(sectionId) => manage.jump(sectionId)}
      />

      {toast && <UndoToast key={toast.id} text={toast.text} undo={toast.undo} onDone={() => setToast(null)} />}
    </ManageContext.Provider>
  );
}

/**
 * Rename a field or a section. Starts from the name shown; saving the usual (dictionary) name, or nothing, puts
 * the usual one back (`null`), so it keeps printing in the biodata's language. A custom field or section must
 * keep a name.
 */
function RenameDialog(props: {
  open: boolean;
  title: string;
  label: string;
  current: string;
  /** The dictionary's name, for default fields and sections. */
  usual?: string;
  /** The user has their own name on it now. */
  renamed: boolean;
  hint: string;
  resetText: (usual: string) => string;
  onClose: () => void;
  /** The new name, or null for the usual one. */
  onSave: (value: string | null) => void;
}) {
  const { open, title, label, current, usual, renamed, hint, resetText, onClose, onSave } = props;
  const inputId = useId();
  const hintId = useId();
  const [value, setValue] = useState(current);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setValue(current);
  }
  const typed = value.trim();
  const toUsual = usual !== undefined && (typed === "" || typed === usual);

  function save() {
    if (toUsual) {
      if (renamed) onSave(null);
      else onClose();
      return;
    }
    if (typed) onSave(typed);
  }

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <label htmlFor={inputId} className={fieldLabelClass}>
          {label}
        </label>
        <input
          id={inputId}
          className={`mt-1.5 ${fieldClass}`}
          value={value}
          placeholder={usual}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="off"
          aria-describedby={hintId}
        />
        <p id={hintId} className={`mt-1.5 ${fieldHint} text-pretty`}>
          {hint}
        </p>
        {usual !== undefined && renamed && (
          <button type="button" className={`mt-3 inline-flex items-center pointer-coarse:min-h-11 text-sm ${textLink}`} onClick={() => onSave(null)}>
            {resetText(usual)}
          </button>
        )}
        <DialogActions>
          <button type="button" className={button("secondary")} onClick={onClose}>
            {t("ui.cancel")}
          </button>
          <button type="submit" className={button("primary")} disabled={!typed && usual === undefined}>
            {t("manage.save")}
          </button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/** The toast after a change: says what happened, offers Undo after a removal; goes after 6 s, held while in use. */
function UndoToast({ text, undo, onDone }: { text: string; undo?: () => void; onDone: () => void }) {
  const [held, setHeld] = useState(false);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    if (held) return;
    const timer = setTimeout(() => done.current(), TOAST_MS);
    return () => clearTimeout(timer);
  }, [held]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4" data-testid="manage-toast">
      <div
        className="pointer-events-auto"
        onPointerEnter={() => setHeld(true)}
        onPointerLeave={() => setHeld(false)}
        onFocus={() => setHeld(true)}
        onBlur={() => setHeld(false)}
      >
        <Toast tone="good" className="py-1.5! pr-1.5!">
          <span className="min-w-0 py-1 break-words">{text}</span>
          {undo && (
            <button
              type="button"
              className={`${toastAction} inline-flex items-center gap-1.5`}
              onClick={() => {
                undo();
              }}
            >
              <Icon name="undo" className="size-4" />
              {t("manage.undo")}
            </button>
          )}
          <button type="button" aria-label={t("manage.dismiss")} className={`${iconButton} text-ink-3`} onClick={onDone}>
            <Icon name="x" className="size-4" />
          </button>
        </Toast>
      </div>
    </div>
  );
}
