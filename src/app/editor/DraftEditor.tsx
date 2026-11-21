"use client";

import { useEffect } from "react";
import { cardTitle, noteCard } from "@/components/ui/card";
import { textLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { pageWidth } from "@/components/ui/page";
import type { AutosaveController } from "@/lib/autosave";
import { t } from "@/lib/i18n";
import { useAutosave } from "@/lib/use-autosave";
import { EditorFrame } from "./EditorFrame";
import { PersonalCard } from "./PersonalCard";
import { SaveProblem, SaveStatus } from "./SaveStatus";

/**
 * The open draft: save status in the header, the form, and a note on where it is kept. Edits go straight to the
 * autosave controller, which writes them after a pause and when the page is hidden or closed (VISION §9).
 */
export function DraftEditor({ controller }: { controller: AutosaveController }) {
  const { profile, status } = useAutosave(controller);
  const conflict = status.state === "error" && status.kind === "conflict";

  useEffect(() => {
    const detach = controller.attachLifecycle(window);
    return () => {
      detach();
      // Not dispose(): React's development double effects would stop autosave for good. A flush is enough.
      void controller.flush();
    };
  }, [controller]);

  /**
   * Links out of the editor (logo, Help) are full page loads; pagehide can't wait for a write, so a click with
   * changes pending writes them first and then follows the link. If the write fails the page stays, showing why,
   * unless another tab owns the draft (those changes can't be saved anyway).
   */
  function onClickCapture(event: React.MouseEvent) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element).closest?.("a[href]");
    if (!(link instanceof HTMLAnchorElement) || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
    const url = new URL(link.href);
    if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.hash)) return;
    if (!controller.getSnapshot().unsaved) return;
    event.preventDefault();
    void controller.flush().then(() => {
      const after = controller.getSnapshot();
      const lost = after.status.state === "error" && after.status.kind === "conflict";
      if (!after.unsaved || lost) window.location.assign(url);
    });
  }

  return (
    <div onClickCapture={onClickCapture} className="contents">
      <EditorFrame status={<SaveStatus status={status} />}>
        <div className={`${pageWidth} grid items-start gap-6 py-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-8`}>
          <div className="min-w-0 space-y-6">
            <PageHeader title={t("editor.title")} description={t("editor.lead")} />
            <SaveProblem status={status} onRetry={() => void controller.flush()} />
            <PersonalCard profile={profile} onChange={controller.update} readOnly={conflict} />
          </div>
          <aside className={`${noteCard} lg:sticky lg:top-24`}>
            <div className="flex gap-3">
              <Icon name="lock" className="mt-0.5 size-5 text-gold" />
              <div className="min-w-0">
                <h2 className={`${cardTitle} text-[15px]`}>{t("editor.note.title")}</h2>
                <p className="mt-1 text-[13.5px] leading-relaxed text-pretty text-ink-2">{t("editor.note.text")}</p>
                <a href="/help#saving" className={`mt-2.5 inline-flex items-center pointer-coarse:min-h-11 text-[13.5px] ${textLink}`}>
                  {t("editor.note.action")}
                </a>
              </div>
            </div>
          </aside>
        </div>
      </EditorFrame>
    </div>
  );
}
