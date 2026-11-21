"use client";

import { useCallback, useEffect, useMemo } from "react";
import type { BiodataProfile } from "@/biodata/types";
import { cardTitle, noteCard } from "@/components/ui/card";
import { focusRing, textLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import type { AutosaveController } from "@/lib/autosave";
import type { BiodataDb } from "@/lib/db";
import type { ProfileRepo } from "@/lib/profile-repo";
import { t } from "@/lib/i18n";
import { useAutosave } from "@/lib/use-autosave";
import { DraftsMenu } from "./DraftsMenu";
import { EditorFrame } from "./EditorFrame";
import { ManageProvider, useManage } from "./ManageProvider";
import { SaveProblem, SaveStatus } from "./SaveStatus";
import { SectionCard } from "./SectionCard";
import { SectionJump, SectionRail, useCurrentSection } from "./SectionNav";
import { StorageCard } from "./StorageCard";

/**
 * The open draft: the drafts menu and save status in the header; the section rail (chips on tablets and phones),
 * the form as one scroll of section cards, and the right column, which holds where the draft is kept (with the
 * storage status) until the live preview takes it in Step 3.3 (BUILD_PLAN A7 Editor rule). Edits go straight to
 * the autosave controller, which writes them after a pause and when the page is hidden or closed (VISION §9).
 */
export function DraftEditor({ controller, repo, db }: { controller: AutosaveController; repo: ProfileRepo; db: BiodataDb }) {
  const { profile, status } = useAutosave(controller);
  const conflict = status.state === "error" && status.kind === "conflict";
  const ids = useMemo(() => profile.sections.map((s) => s.id), [profile.sections]);
  const { current: currentSection, jump } = useCurrentSection(ids);

  // One stable function for every row: it applies the edit to the latest profile, so memoised cards and rows
  // re-render only when their own part of the profile changes.
  const edit = useCallback(
    (change: (profile: BiodataProfile) => BiodataProfile) => controller.update(change(controller.getSnapshot().profile)),
    [controller],
  );
  const current = useCallback(() => controller.getSnapshot().profile, [controller]);

  useEffect(() => {
    const detach = controller.attachLifecycle(window);
    return () => {
      detach();
      // Not dispose(): React's development double effects would stop autosave for good. A flush is enough.
      void controller.flush();
    };
  }, [controller]);

  /**
   * Leaves the editor, or this draft (the drafts menu), with a full page load. pagehide can't wait for a write,
   * so changes pending are written first. If the write fails the page stays, showing why, unless another tab
   * owns the draft (those changes can't be saved anyway).
   */
  async function leave(url: string | URL) {
    if (controller.getSnapshot().unsaved) await controller.flush();
    const after = controller.getSnapshot();
    const lost = after.status.state === "error" && after.status.kind === "conflict";
    if (!after.unsaved || lost) window.location.assign(url);
  }

  /** Links out of the editor (logo, Help): with changes pending, they're written before the link is followed. */
  function onClickCapture(event: React.MouseEvent) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element).closest?.("a[href]");
    if (!(link instanceof HTMLAnchorElement) || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
    const url = new URL(link.href);
    if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.hash)) return;
    if (!controller.getSnapshot().unsaved) return;
    event.preventDefault();
    void leave(url);
  }

  return (
    <div onClickCapture={onClickCapture} className="contents">
      <EditorFrame
        status={<SaveStatus status={status} />}
        drafts={<DraftsMenu controller={controller} profile={profile} repo={repo} db={db} leave={leave} locked={conflict} />}
      >
        <ManageProvider profile={profile} current={current} edit={edit} jump={jump}>
          <h1 className="sr-only">{t("editor.title")}</h1>
          <div className="flex-1 lg:grid lg:grid-cols-[4rem_minmax(27.5rem,36.25rem)_minmax(0,1fr)] xl:grid-cols-[14.5rem_minmax(27.5rem,36.25rem)_minmax(0,1fr)]">
            <div className="border-r border-line bg-surface max-lg:hidden">
              <SectionRail sections={profile.sections} current={currentSection} onJump={jump} canAdd={!conflict} />
            </div>
            {/* Sticky here, not inside: the chips stay under the header for the whole form. */}
            <div className="sticky top-14 z-20 lg:hidden">
              <SectionJump sections={profile.sections} current={currentSection} onJump={jump} />
            </div>
            <div className="mx-auto w-full max-w-3xl min-w-0 space-y-4 px-4 pt-4 pb-6 sm:px-6 sm:pt-6 lg:mx-0 lg:max-w-none lg:px-5 lg:pb-8" data-testid="editor-form">
              <SaveProblem status={status} onRetry={() => void controller.flush()} />
              {profile.sections.map((section) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  edit={edit}
                  readOnly={conflict}
                  dateFormat={profile.options.dateFormat}
                  heightFormat={profile.options.heightFormat}
                />
              ))}
              <AddSectionButton disabled={conflict} />
            </div>
            {/* The live preview's place from Step 3.3; for now, how the draft is kept. */}
            <aside className="mx-auto w-full max-w-3xl px-4 pb-8 sm:px-6 lg:mx-0 lg:max-w-none lg:border-l lg:border-line lg:bg-sunken/40 lg:px-6 lg:py-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:sticky lg:top-20 lg:max-w-[34rem] lg:grid-cols-1">
                <div className={`${noteCard} flex gap-3`}>
                  <Icon name="lock" className="mt-0.5 size-5 text-gold" />
                  <div className="min-w-0">
                    <h2 className={`${cardTitle} text-[15px]`}>{t("editor.note.title")}</h2>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-pretty text-ink-2">{t("editor.note.text")}</p>
                    <a href="/help#saving" className={`mt-2.5 inline-flex items-center pointer-coarse:min-h-11 text-[13.5px] ${textLink}`}>
                      {t("editor.note.action")}
                    </a>
                  </div>
                </div>
                <StorageCard savedAt={status.state === "saved" ? status.at.getTime() : undefined} />
              </div>
            </aside>
          </div>
        </ManageProvider>
      </EditorFrame>
    </div>
  );
}

/** "Add a section", after the last card (VISION §6): opens the dialog with the ready-made sections and your own. */
function AddSectionButton({ disabled }: { disabled: boolean }) {
  const manage = useManage();
  return (
    <button
      id="add-section"
      type="button"
      disabled={disabled}
      onClick={() => manage.open({ kind: "addSection" })}
      className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong px-4 py-3 text-[15px] font-semibold text-brand-ink transition-colors hover:border-brand/40 hover:bg-brand-soft disabled:opacity-55 ${focusRing}`}
    >
      <Icon name="plus" className="size-5" />
      {t("manage.addSection")}
    </button>
  );
}
