"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { fullNameOf } from "@/biodata/draft-name";
import { pageImageFileName, pdfFileName } from "@/biodata/filename";
import type { BiodataProfile } from "@/biodata/types";
import { button, iconButton, outlineIconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Menu, menuItem } from "@/components/ui/Menu";
import { Toast, toastAction } from "@/components/ui/Toast";
import { t, type AppKey } from "@/lib/i18n";
import { canShareFiles, copyPages, printPages, saveBlobs, shareFiles } from "./export-files";

// Download PDF, Share PDF, Save as image and Print (BUILD_PLAN Step 4.1 part 2, VISION §11, D38, D49). The Download
// engine (src/pdf, HarfBuzz + pdf-lib, ≈ 635 KB gzip) loads on the first use, never with the editor. Every output
// comes from the preview's laid-out pages, once they show the latest edits (D1), copied at true size
// (export-files.ts). One job at a time: the buttons are disabled while one runs; a toast says what is happening
// (after a short moment, so quick jobs don't flash), what was saved, or what went wrong.

export interface ExportSource {
  /** Waits until the preview shows the latest edits, then gives its laid-out pages (DocumentView's .doc-pages). */
  pages: () => Promise<Element>;
  /** The draft as it is now (for the filenames and the PDF's title). */
  profile: () => BiodataProfile;
}

type Job = "pdf" | "share" | "jpeg" | "png" | "shareImages" | "print";
type Format = "jpeg" | "png";

interface ToastState {
  id: number;
  tone: "neutral" | "good" | "danger";
  text: string;
  action?: { label: string; run: () => void };
}

const PDF = "application/pdf";
const JPEG = "image/jpeg";

/** Loads the engine; started early when a pointer reaches a button, so the first click is quick. */
const loadEngine = () => import("@/pdf");

const noSubscribe = () => () => {};
const shareSupport = { pdf: undefined as boolean | undefined, images: undefined as boolean | undefined };
const sharesPdf = () => (shareSupport.pdf ??= canShareFiles([PDF]));
const sharesImages = () => (shareSupport.images ??= canShareFiles([JPEG]));

function pdfTitle(profile: BiodataProfile) {
  const name = fullNameOf(profile).trim();
  return name ? t("export.pdfTitle", { name }) : t("export.pdfTitleNoName");
}

export function useExport(source: ExportSource) {
  const [job, setJob] = useState<Job | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastId = useRef(0);
  const working = useRef<string | null>(null);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const canSharePdf = useSyncExternalStore(noSubscribe, sharesPdf, () => false);
  const canShareImages = useSyncExternalStore(noSubscribe, sharesImages, () => false);

  const show = useCallback((tone: ToastState["tone"], text: string, action?: ToastState["action"]) => setToast({ id: ++toastId.current, tone, text, action }), []);
  const dismiss = useCallback(() => setToast(null), []);

  /** The "working" sentence: shown after 300 ms, then kept up to date. */
  const progress = useCallback(
    (text: string) => {
      working.current = text;
      if (slowTimer.current === undefined) show("neutral", text);
    },
    [show],
  );

  const run = useCallback(
    async (kind: Job, task: () => Promise<void>, failure: AppKey) => {
      if (job) return;
      setJob(kind);
      working.current = t("export.working.start");
      slowTimer.current = setTimeout(() => {
        slowTimer.current = undefined;
        if (working.current) show("neutral", working.current);
      }, 300);
      try {
        await task();
      } catch (error) {
        console.error(error);
        show("danger", t(error instanceof NotReadyError ? "export.failed.notReady" : failure));
      } finally {
        clearTimeout(slowTimer.current);
        slowTimer.current = undefined;
        working.current = null;
        setJob(null);
        setToast((current) => (current?.tone === "neutral" ? null : current));
      }
    },
    [job, show],
  );

  /** The pages copied at true size, the engine loaded meanwhile. */
  async function withPages<T>(make: (root: HTMLElement, engine: Awaited<ReturnType<typeof loadEngine>>) => Promise<T>): Promise<T> {
    const [pages, engine] = await Promise.all([source.pages().catch(() => Promise.reject(new NotReadyError())), loadEngine()]);
    const copy = await copyPages(pages);
    try {
      return await make(copy.root, engine);
    } finally {
      copy.dispose();
    }
  }

  const makePdf = (profile: BiodataProfile) =>
    withPages((root, { createPdf }) =>
      createPdf(root, { title: pdfTitle(profile), onProgress: (done, total) => total > 1 && progress(t("export.working.pdf", { done, total })) }),
    );

  const makeImages = (format: Format) =>
    withPages((root, { createPageImages }) =>
      createPageImages(root, { format, onProgress: (done, total) => total > 1 && done < total && progress(t("export.working.images", { done: done + 1, total })) }),
    );

  const downloadPdf = () =>
    run(
      "pdf",
      async () => {
        const profile = source.profile();
        const blob = await makePdf(profile);
        const name = pdfFileName(profile);
        await saveBlobs([{ blob, name }]);
        show("good", t("export.done.pdf", { name }));
      },
      "export.failed.pdf",
    );

  /** Hands files to the share sheet; when the browser wants a fresh tap first, the toast offers one. */
  const shareOrOffer = async (files: File[], title: string, ready: AppKey) => {
    const result = await shareFiles(files, title);
    if (result === "needs-tap") {
      show("neutral", t(ready), {
        label: t("export.shareNow"),
        run: () => {
          dismiss();
          void shareFiles(files, title).catch(() => show("danger", t("export.failed.share")));
        },
      });
    } else if (result === "unsupported") {
      throw new Error("Sharing these files isn't supported");
    }
  };

  const sharePdf = () =>
    run(
      "share",
      async () => {
        const profile = source.profile();
        const blob = await makePdf(profile);
        await shareOrOffer([new File([blob], pdfFileName(profile), { type: PDF })], pdfTitle(profile), "export.ready.pdf");
      },
      "export.failed.share",
    );

  const saveImages = (format: Format) =>
    run(
      format,
      async () => {
        const profile = source.profile();
        const blobs = await makeImages(format);
        const files = blobs.map((blob, i) => ({ blob, name: pageImageFileName(profile, i + 1, format) }));
        await saveBlobs(files);
        show("good", files.length === 1 ? t("export.done.image", { name: files[0].name }) : t("export.done.images", { count: files.length }));
      },
      "export.failed.images",
    );

  const shareImages = () =>
    run(
      "shareImages",
      async () => {
        const profile = source.profile();
        const blobs = await makeImages("jpeg");
        const files = blobs.map((blob, i) => new File([blob], pageImageFileName(profile, i + 1, "jpeg"), { type: JPEG }));
        await shareOrOffer(files, pdfTitle(profile), "export.ready.images");
      },
      "export.failed.share",
    );

  const print = () =>
    run(
      "print",
      async () => {
        const pages = await source.pages().catch(() => Promise.reject(new NotReadyError()));
        await printPages(pages);
      },
      "export.failed.print",
    );

  // Success and error toasts go by themselves; one with a Share button stays a little longer.
  useEffect(() => {
    if (!toast || toast.tone === "neutral" && !toast.action) return;
    const timer = setTimeout(() => setToast((current) => (current?.id === toast.id ? null : current)), toast.action ? 15_000 : toast.tone === "danger" ? 9000 : 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  return { job, toast, dismiss, canSharePdf, canShareImages, downloadPdf, sharePdf, saveImages, shareImages, print };
}

export type ExportControls = ReturnType<typeof useExport>;

class NotReadyError extends Error {}

const warm = () => void loadEngine().catch(() => undefined);

/** A small spinner for the button whose job is running. */
function Spinner() {
  return <span aria-hidden className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />;
}

/** Save as image: JPEG (default), PNG, and Share as image where the share sheet takes pictures. */
function ImageMenu({ controls, buttonClassName, inSheet }: { controls: ExportControls; buttonClassName: string; inSheet?: boolean }) {
  const busy = controls.job !== null;
  const imageJob = controls.job === "jpeg" || controls.job === "png" || controls.job === "shareImages";
  const item = (icon: "image" | "share", label: string, hint: string, onPick: () => void, close: () => void) => (
    <button
      type="button"
      role="menuitem"
      className={`${menuItem} items-start`}
      onClick={() => {
        close();
        onPick();
      }}
    >
      <Icon name={icon} className="mt-0.5 size-[18px] text-ink-3" />
      <span className="min-w-0">
        <span className="block font-medium text-ink">{label}</span>
        <span className="block text-[12.5px] text-ink-3">{hint}</span>
      </span>
    </button>
  );
  return (
    <div onPointerEnter={warm}>
      <Menu
        label={t("export.image")}
        buttonLabel={t("export.image")}
        buttonTitle={t("export.image")}
        buttonClassName={buttonClassName}
        disabled={busy}
        autoPlace={inSheet ? { reserve: 0 } : undefined}
        align={inSheet ? "start" : "end"}
        menuClassName="w-64"
        button={imageJob ? <Spinner /> : <Icon name="image" className="size-5" />}
      >
        {(close) => (
          <>
            {item("image", t("export.image.jpeg"), t("export.image.jpegHint"), () => void controls.saveImages("jpeg"), close)}
            {item("image", t("export.image.png"), t("export.image.pngHint"), () => void controls.saveImages("png"), close)}
            {controls.canShareImages && item("share", t("export.image.share"), t("export.image.shareHint"), () => void controls.shareImages(), close)}
          </>
        )}
      </Menu>
    </div>
  );
}

/** The desktop pane's actions, top right (mockup: editor): Save as image, Print, Share (where it works), Download PDF. */
export function ToolbarActions({ controls }: { controls: ExportControls }) {
  const busy = controls.job !== null;
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={t("export.actions")} data-testid="export-actions">
      <ImageMenu controls={controls} buttonClassName={outlineIconButton} />
      <button type="button" className={outlineIconButton} aria-label={t("export.print")} title={t("export.print")} disabled={busy} onClick={() => void controls.print()}>
        {controls.job === "print" ? <Spinner /> : <Icon name="printer" className="size-5" />}
      </button>
      {controls.canSharePdf && (
        <button type="button" className={outlineIconButton} aria-label={t("export.share")} title={t("export.share")} disabled={busy} onPointerEnter={warm} onClick={() => void controls.sharePdf()}>
          {controls.job === "share" ? <Spinner /> : <Icon name="share" className="size-5" />}
        </button>
      )}
      <button type="button" className={`${button("primary")} max-xl:px-3`} disabled={busy} onPointerEnter={warm} onFocus={warm} onClick={() => void controls.downloadPdf()}>
        {controls.job === "pdf" ? <Spinner /> : <Icon name="download" className="size-[18px]" />}
        {t("export.download")}
      </button>
    </div>
  );
}

const sheetIcon = `${outlineIconButton} size-12! rounded-xl pointer-coarse:size-12!`;

/** The sheet's foot (mockups: sheet-phone, preview-phone): Save as image, Share, Print, then Download PDF filling the rest. */
export function SheetActions({ controls }: { controls: ExportControls }) {
  const busy = controls.job !== null;
  return (
    <div className="flex items-center gap-2.5" role="group" aria-label={t("export.actions")} data-testid="export-actions">
      <ImageMenu controls={controls} buttonClassName={sheetIcon} inSheet />
      {controls.canSharePdf && (
        <button type="button" className={sheetIcon} aria-label={t("export.share")} title={t("export.share")} disabled={busy} onClick={() => void controls.sharePdf()}>
          {controls.job === "share" ? <Spinner /> : <Icon name="share" className="size-5" />}
        </button>
      )}
      <button type="button" className={sheetIcon} aria-label={t("export.print")} title={t("export.print")} disabled={busy} onClick={() => void controls.print()}>
        {controls.job === "print" ? <Spinner /> : <Icon name="printer" className="size-5" />}
      </button>
      <button type="button" className={`${button("primary", "lg")} h-12 min-w-0 flex-1 rounded-xl text-base`} disabled={busy} onClick={() => void controls.downloadPdf()}>
        {controls.job === "pdf" ? <Spinner /> : <Icon name="download" className="size-5" />}
        {t("export.download")}
      </button>
    </div>
  );
}

/** What an export is doing, did, or why it failed: over the desktop pane, above its footer; above the sheet's buttons. */
export function ExportToast({ controls, placement }: { controls: ExportControls; placement: "pane" | "sheet" }) {
  const { toast, dismiss } = controls;
  if (!toast) return null;
  return (
    <div
      className={`pointer-events-none inset-x-0 z-[60] flex justify-center px-4 ${placement === "sheet" ? "fixed bottom-[calc(6rem+env(safe-area-inset-bottom))]" : "absolute bottom-16"}`}
      data-testid="export-toast"
    >
      <Toast key={toast.id} tone={toast.tone === "neutral" ? "neutral" : toast.tone} role={toast.tone === "danger" ? "alert" : "status"} className="py-1.5! pr-1.5!">
        {toast.tone === "neutral" && !toast.action && <Spinner />}
        <span className="min-w-0 py-1 break-words">{toast.text}</span>
        {toast.action && (
          <button type="button" className={`${toastAction} inline-flex items-center gap-1.5`} onClick={toast.action.run}>
            <Icon name="share" className="size-4" />
            {toast.action.label}
          </button>
        )}
        <button type="button" aria-label={t("export.dismiss")} className={`${iconButton} text-ink-3`} onClick={dismiss}>
          <Icon name="x" className="size-4" />
        </button>
      </Toast>
    </div>
  );
}
