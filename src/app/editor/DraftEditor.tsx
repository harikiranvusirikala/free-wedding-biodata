"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { setPhoto } from "@/biodata/edits";
import type { BiodataProfile } from "@/biodata/types";
import type { PhotoChange } from "@/components/photo/PhotoField";
import { cardTitle, noteCard } from "@/components/ui/card";
import { focusRing, textLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import type { AutosaveController } from "@/lib/autosave";
import { downloadBackup } from "@/lib/backup-file";
import type { BiodataDb } from "@/lib/db";
import type { PhotoInput, ProfileRepo } from "@/lib/profile-repo";
import { t } from "@/lib/i18n";
import { useAutosave } from "@/lib/use-autosave";
import { BackupProvider } from "./BackupProvider";
import { DraftsMenu } from "./DraftsMenu";
import { EditorFrame } from "./EditorFrame";
import { ManageProvider, useManage } from "./ManageProvider";
import { SaveProblem, SaveStatus } from "./SaveStatus";
import { SectionCard } from "./SectionCard";
import { SectionJump, SectionRail, useCurrentSection } from "./SectionNav";
import { StorageCard } from "./StorageCard";
import { FormLayoutSwitch } from "./FormLayoutSwitch";
import { LanguageNotice } from "./LanguageNotice";
import { PHOTO_ID, PhotoCard } from "./PhotoCard";
import { PHOTO_PAGES_ID, PhotoPagesCard, type PhotoPagesChange } from "./PhotoPagesCard";
import { TOP_ID, TopCard } from "./TopCard";
import { doneTraditions, showsTraditions } from "./TraditionChips";
import { LivePreview } from "./preview/LivePreview";

/**
 * The open draft: the drafts menu and save status in the header; the section rail (chips on tablets and phones),
 * the form as one scroll of section cards ending with where the draft is kept (and the storage status), and the live
 * preview: the right column on desktop, a pill and sheet below (Step 3.3, BUILD_PLAN A7 Editor rule). Edits go straight to
 * the autosave controller, which writes them after a pause and when the page is hidden or closed (VISION §9).
 */
export function DraftEditor({ controller, repo, db }: { controller: AutosaveController; repo: ProfileRepo; db: BiodataDb }) {
  const { profile, status } = useAutosave(controller);
  const conflict = status.state === "error" && status.kind === "conflict";
  // The form's order, also the rail's and the chips': the top card (Step 2.0), the photo (Step 3.1), the sections,
  // then more photos (Step 4.2b), whose pages print after the biodata.
  const ids = useMemo(() => [TOP_ID, PHOTO_ID, ...profile.sections.map((s) => s.id), PHOTO_PAGES_ID], [profile.sections]);
  const traditionsDone = useMemo(() => doneTraditions({ sections: profile.sections, options: profile.options }), [profile.sections, profile.options]);
  const { current: currentSection, jump } = useCurrentSection(ids);

  // One stable function for every row: it applies the edit to the latest profile, so memoised cards and rows
  // re-render only when their own part of the profile changes.
  const edit = useCallback(
    (change: (profile: BiodataProfile) => BiodataProfile) => controller.update(change(controller.getSnapshot().profile)),
    [controller],
  );
  const current = useCallback(() => controller.getSnapshot().profile, [controller]);

  // The photo (Step 3.1): its picture is read from the database, and a new or removed picture is written in the
  // same transaction as the profile that points at it (D9), through autosave.
  // A picture just picked is only written with the next save (autosave waits a moment), so the pictures handed
  // over in this session are kept here too: the preview can draw a new photo at once instead of finding nothing in
  // the database and waiting for the next frame or crop change. Pictures are ids that never change content.
  const given = useRef(new Map<string, PhotoInput>());
  const loadBlob = useCallback(async (id: string) => {
    const picture = given.current.get(id);
    if (picture) return picture.blob;
    const result = await repo.getPhoto(id);
    return result.ok ? result.value?.blob : undefined;
  }, [repo]);
  /** The whole record of a picture (to put it back when a removal is undone). */
  const readPicture = useCallback(
    async (id: string): Promise<PhotoInput | undefined> => {
      const picture = given.current.get(id);
      if (picture) return picture;
      const result = await repo.getPhoto(id);
      if (!result.ok || !result.value) return undefined;
      const { blob, mimeType, width, height } = result.value;
      return { id, blob, mimeType, width, height };
    },
    [repo],
  );
  const onPhotoChange = useCallback(
    (change: PhotoChange) => {
      if (change.put) given.current.set(change.put.id, change.put);
      if (change.delete) given.current.delete(change.delete);
      controller.update(setPhoto(controller.getSnapshot().profile, change.photo), {
        put: change.put ? [change.put] : undefined,
        delete: change.delete ? [change.delete] : undefined,
      });
    },
    [controller],
  );
  // More photos (Step 4.2b) and the second photo (Step 4.4): the card's pure edit runs on the latest profile, its
  // pictures travel with the same save.
  const onPagesChange = useCallback(
    (change: PhotoPagesChange) => {
      for (const put of change.put ?? []) given.current.set(put.id, put);
      for (const id of change.delete ?? []) given.current.delete(id);
      controller.update(change.edit(controller.getSnapshot().profile), { put: change.put, delete: change.delete });
    },
    [controller],
  );

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

  // "Download a backup" beside the out-of-space message: made from the draft as this tab holds it, newest typing included.
  const backupNow = useCallback(
    () => downloadBackup(repo, { open: () => ({ profile: controller.getSnapshot().profile, pendingPhotos: controller.pendingPhotos() }) }),
    [repo, controller],
  );

  return (
    <div onClickCapture={onClickCapture} className="contents">
      <BackupProvider controller={controller} repo={repo}>
        <EditorFrame
          status={<SaveStatus status={status} />}
          drafts={<DraftsMenu controller={controller} profile={profile} repo={repo} db={db} leave={leave} locked={conflict} />}
        >
          <ManageProvider profile={profile} current={current} edit={edit} jump={jump}>
            <h1 className="sr-only">{t("editor.title")}</h1>
            <div className="flex-1 lg:grid lg:grid-cols-[4rem_minmax(27.5rem,36.25rem)_minmax(0,1fr)] xl:grid-cols-[14.5rem_minmax(27.5rem,36.25rem)_minmax(0,1fr)]">
              <div className="border-r border-line bg-surface max-lg:hidden" data-editor-pane>
                <SectionRail sections={profile.sections} hasPhoto={!!profile.photo} hasMorePhotos={!!profile.photoPages || !!profile.horoscopeChart} current={currentSection} onJump={jump} canAdd={!conflict} />
              </div>
              {/* Sticky here, not inside: the chips stay under the header for the whole form. */}
              <div className="sticky top-14 z-20 lg:hidden" data-editor-pane>
                <SectionJump sections={profile.sections} current={currentSection} onJump={jump} />
              </div>
              {/* Below lg the bottom padding keeps the last card clear of the floating Preview pill. */}
              <div className="mx-auto w-full max-w-3xl min-w-0 space-y-4 px-4 pt-4 pb-24 sm:px-6 sm:pt-6 lg:mx-0 lg:max-w-none lg:px-5 lg:pb-8" data-testid="editor-form" data-editor-pane>
                <SaveProblem status={status} onRetry={() => void controller.flush()} backup={backupNow} />
                <FormLayoutSwitch layout={profile.options.formLayout} readOnly={conflict} />
                <TopCard
                  options={profile.options}
                  lang={profile.docLanguage}
                  templateId={profile.templateId}
                  colorId={profile.colorId}
                  edit={edit}
                  readOnly={conflict}
                />
                <LanguageNotice lang={profile.docLanguage} edit={edit} readOnly={conflict} />
                <PhotoCard
                  photo={profile.photo}
                  secondPhoto={profile.secondPhoto}
                  loadBlob={loadBlob}
                  readPicture={readPicture}
                  onChange={onPhotoChange}
                  onSecondChange={onPagesChange}
                  readOnly={conflict}
                />
                {profile.sections.map((section) => (
                  <SectionCard
                    key={section.id}
                    section={section}
                    edit={edit}
                    readOnly={conflict}
                    heightFormat={profile.options.heightFormat}
                    traditions={showsTraditions(profile, section.id) ? traditionsDone : undefined}
                  />
                ))}
                <AddSectionButton disabled={conflict} />
                {/* More photos and the horoscope chart last: their pages print after the biodata (owner, D53 refinement). */}
                <PhotoPagesCard
                  photoPages={profile.photoPages}
                  chart={profile.horoscopeChart}
                  loadBlob={loadBlob}
                  readPicture={readPicture}
                  onChange={onPagesChange}
                  readOnly={conflict}
                />
                {/* Where the draft is kept, after the last section (the right column is the preview since Step 3.3). */}
                <aside aria-label={t("editor.keptLabel")} className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-1" data-testid="kept-cards">
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
                </aside>
              </div>
              {/* The live preview (Step 3.3): the right column on desktop; a pill and a sheet below 1024 px. */}
              <LivePreview profile={profile} edit={edit} loadBlob={loadBlob} readOnly={conflict} />
            </div>
          </ManageProvider>
        </EditorFrame>
      </BackupProvider>
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
