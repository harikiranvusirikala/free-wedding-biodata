"use client";

import { memo, useId } from "react";
import { setFormLayout, undoFormLayout } from "@/biodata/edits";
import type { FormLayout } from "@/biodata/types";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { t } from "@/lib/i18n";
import { useManage } from "./ManageProvider";

// The Simple / Detailed switch at the top of the form (BUILD_PLAN Step 2.4, VISION D50), with one line saying what
// the chosen form holds. Switching is one pure edit (setFormLayout) that never loses anything typed; the toast
// offers Undo for 6 s, which puts the draft back as it was (undoFormLayout). The rail, the chips, the completion
// figure and the preview all follow the sections the draft now has.

const LAYOUTS: readonly FormLayout[] = ["simple", "detailed"];


/**
 * `designSlot`: where the desktop preview puts its design picker (LivePreview, owner's request 2026-11-23), beside the
 * switch, so the open design panel covers the form, not the page it changes. Empty, and so hidden, below 1024 px.
 */
export const FormLayoutSwitch = memo(function FormLayoutSwitch({ layout, readOnly, designSlot }: { layout: FormLayout; readOnly: boolean; designSlot?: (el: HTMLDivElement | null) => void }) {
  const manage = useManage();
  const hintId = useId();

  function change(next: FormLayout) {
    const before = manage.current();
    if (before.options.formLayout === next) return;
    manage.edit((p) => setFormLayout(p, next));
    const after = manage.current();
    manage.notify(t(`layout.switched.${next}`), () => {
      manage.edit((p) => undoFormLayout(p, before, after));
      manage.notify(t(`layout.undone.${before.options.formLayout}`));
    });
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-2 shadow-card sm:flex-row sm:items-center sm:gap-3.5 lg:pr-2"
      data-testid="form-layout"
    >
      <SegmentedControl
        label={t("layout.label")}
        value={layout}
        options={LAYOUTS.map((value) => ({ value, label: t(`layout.${value}`), disabled: readOnly }))}
        onChange={change}
        describedBy={hintId}
        className="w-full shrink-0 sm:w-auto [&>button]:min-w-20"
      />
      <div ref={designSlot} className="min-w-0 empty:hidden lg:ml-auto lg:w-56" />
      {/* Said by screen readers, not shown (owner's request 2026-11-24: the line made the bar untidy). */}
      <p id={hintId} className="sr-only">
        {t(`layout.hint.${layout}`)}
      </p>
    </div>
  );
});
