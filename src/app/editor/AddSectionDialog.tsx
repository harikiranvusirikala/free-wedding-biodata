"use client";

import { useId, useState } from "react";
import { newUuid } from "@/biodata/defaults";
import { addCustomSection, addPresetSection, availablePresetSections } from "@/biodata/edits";
import type { BiodataProfile } from "@/biodata/types";
import { button } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { field as fieldClass, fieldLabel as fieldLabelClass } from "@/components/ui/field";
import { Icon, type IconName } from "@/components/ui/icons";
import { t, type AppKey } from "@/lib/i18n";
import en from "@/i18n/app/en.json";
import type { Edit } from "./FieldRow";
import { SECTION_ICONS, sectionTitle } from "./labels";

// "Add a section" (BUILD_PLAN Step 2.2, VISION §6, D44): the ready-made sections not in the draft (References, and
// any default section the user removed, back with its usual fields), each added with one tap at the end; or the
// user's own section, which starts empty. The new card is scrolled to and its title focused.

const hasKey = (key: string): key is AppKey => Object.hasOwn(en, key);

export function AddSectionDialog({
  open,
  profile,
  edit,
  onClose,
  onAdded,
}: {
  open: boolean;
  profile: BiodataProfile;
  edit: Edit;
  onClose: () => void;
  onAdded: (sectionId: string) => void;
}) {
  const inputId = useId();
  const [title, setTitle] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setTitle("");
  }
  const presets = availablePresetSections(profile);

  function add(change: (id: string) => (p: BiodataProfile) => BiodataProfile) {
    const id = newUuid();
    edit(change(id));
    onClose();
    onAdded(id);
  }

  return (
    <Dialog open={open} onClose={onClose} title={t("manage.addSection")} description={t("manage.addSection.description")}>
      {presets.length > 0 && (
        <div className="mb-5 border-b border-line pb-5" role="group" aria-label={t("manage.addSection.ready")}>
          <h3 className="text-[12px] font-semibold tracking-[0.06em] text-ink-3 uppercase">{t("manage.addSection.ready")}</h3>
          <ul className="mt-2 grid gap-2">
            {presets.map((def, index) => {
              const descKey = `manage.addSection.desc.${def.key}`;
              const icon: IconName = SECTION_ICONS[def.key] ?? "list";
              return (
                <li key={def.key}>
                  <button
                    type="button"
                    data-autofocus={index === 0 ? "" : undefined}
                    className="flex w-full items-center gap-3 rounded-xl border border-line-strong bg-surface px-3.5 py-3 text-left shadow-card transition-colors outline-none hover:border-brand/40 hover:bg-brand-soft focus-visible:ring-[3px] focus-visible:ring-ring"
                    onClick={() => add((id) => (p) => addPresetSection(p, def.key, idFirst(id)))}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-gold-soft text-gold">
                      <Icon name={icon} className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{sectionTitle({ key: def.key })}</span>
                      <span className="block text-[13px] leading-snug text-pretty text-ink-3">{hasKey(descKey) ? t(descKey) : t("manage.addSection.removed")}</span>
                    </span>
                    <Icon name="plus" className="size-[18px] text-brand-ink" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const typed = title.trim();
          if (typed) add((id) => (p) => addCustomSection(p, typed, () => id));
        }}
      >
        <h3 className="mb-3 text-[15px] font-semibold tracking-tight">{t("manage.addSection.custom")}</h3>
        <label htmlFor={inputId} className={fieldLabelClass}>
          {t("manage.addSection.label")}
        </label>
        <input
          id={inputId}
          className={`mt-1.5 ${fieldClass}`}
          value={title}
          placeholder={t("manage.addSection.placeholder")}
          onChange={(event) => setTitle(event.target.value)}
          autoComplete="off"
          autoCapitalize="sentences"
        />
        <DialogActions>
          <button type="button" className={button("secondary")} onClick={onClose}>
            {t("ui.cancel")}
          </button>
          <button type="submit" className={button("primary")} disabled={!title.trim()}>
            <Icon name="plus" className="size-4" />
            {t("manage.addSection.add")}
          </button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

/** The section's own id first (addPresetSection asks for it first), fresh ids for its fields after that. */
function idFirst(first: string) {
  let used = false;
  return () => {
    if (used) return newUuid();
    used = true;
    return first;
  };
}
