"use client";

import { startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { toDocument, type DocModel } from "@/biodata/document";
import type { BiodataProfile } from "@/biodata/types";
import { DocumentView, type DocumentLayoutInfo } from "@/document/DocumentView";
import type { PhotoInput } from "@/document/blocks/types";
import { getDocDictionary } from "@/i18n/doc";
import { button, iconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { useDocumentPhoto, type LoadBlob } from "@/lib/document-photo";
import { t } from "@/lib/i18n";
import type { Edit } from "../FieldRow";
import { ExportToast, ToolbarActions, useExport, type ExportSource } from "./ExportActions";
import { printFromBrowserMenu } from "./export-files";
import { fitScale, pageInView, pageTop, percent, resolveScale, stackHeight, stepZoom, PAGE_WIDTH, type Zoom } from "./layout-math";
import { DesignPopover, LanguageButton, TextSizePopover, type LayoutInfo } from "./PreviewControls";
import { PreviewSheet } from "./PreviewSheet";

// The live preview (BUILD_PLAN Step 3.3, VISION §5, §11, D1, D45): the real document, the same DocumentView, measure
// and paginate as the PDF, the images and print, laid out from the draft as it is typed.
//
// - Desktop (≥ 1024 px): the editor's right column, sticky under the header: the toolbar (design and colour,
//   printing language, text size and labels; Save as image, Print, Share, Download PDF), the pages fitted to the
//   pane (zoom − / Fit / +, page n of N) and how many pages it takes.
// - Below: a floating Preview pill opens a sheet (bottom sheet on phones, side sheet on tablets) with the same pages,
//   the design and colour chips, text size and the four outputs (PreviewSheet.tsx).
//
// Typing never waits for the layout: the draft reaches the document after a short pause (longer while the phone
// sheet is closed), and DocumentView keeps the previous pages on screen while it measures the new ones. A change that
// prints the same (a hidden field, the draft's name) doesn't lay the pages out again. There is one DocumentView, so
// one layout; downloads wait until it shows the latest edits (ExportActions.tsx).

const DESKTOP = "(min-width: 1024px)";
/** Pause after the last change before the pages are laid out again, and the longest wait while typing goes on. */
const DEBOUNCE_MS = 250;
const MAX_WAIT_MS = 1000;
/** While the phone sheet is closed only the pill's page count needs it: wait for a real pause. */
const HIDDEN_DEBOUNCE_MS = 900;

function subscribeMedia(callback: () => void) {
  const query = window.matchMedia(DESKTOP);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
const isDesktopNow = () => window.matchMedia(DESKTOP).matches;

/** The draft as the document shows it: follows `profile` after a pause; `flush` catches up at once. */
function useSettledProfile(profile: BiodataProfile, active: boolean) {
  const [shown, setShown] = useState(profile);
  const pendingSince = useRef<number | null>(null);
  useEffect(() => {
    if (shown === profile) {
      pendingSince.current = null;
      return;
    }
    const now = Date.now();
    pendingSince.current ??= now;
    const wait = active ? Math.max(0, Math.min(DEBOUNCE_MS, MAX_WAIT_MS - (now - pendingSince.current))) : HIDDEN_DEBOUNCE_MS;
    const timer = setTimeout(() => startTransition(() => setShown(profile)), wait);
    return () => clearTimeout(timer);
  }, [profile, shown, active]);
  return { shown, flush: setShown };
}

/** Polls (each frame, up to 15 s) until `check` gives something. */
function waitFor<T>(check: () => T | null | undefined | false, timeoutMs = 15_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const step = () => {
      const value = check();
      if (value) return resolve(value);
      if (performance.now() - start > timeoutMs) return reject(new Error("The preview didn't finish laying out"));
      requestAnimationFrame(step);
    };
    step();
  });
}

/** The pane's inner size, followed as it changes. */
function usePaneSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setSize((s) => (s.width === el.clientWidth && s.height === el.clientHeight ? s : { width: el.clientWidth, height: el.clientHeight }));
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

export interface LivePreviewProps {
  profile: BiodataProfile;
  edit: Edit;
  loadBlob: LoadBlob;
  readOnly: boolean;
}

export function LivePreview({ profile, edit, loadBlob, readOnly }: LivePreviewProps) {
  const desktop = useSyncExternalStore(subscribeMedia, isDesktopNow, () => true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const active = desktop || sheetOpen;
  const { shown, flush } = useSettledProfile(profile, active);

  // The document model, kept the same object while what prints is the same (so nothing is measured again).
  const docKey = useMemo(() => JSON.stringify(toDocument(shown, getDocDictionary(shown.docLanguage), new Date())), [shown]);
  const doc = useMemo(() => JSON.parse(docKey) as DocModel, [docKey]);

  const photo = useDocumentPhoto(profile.photo, loadBlob);
  // The first layout waits for the photo, so the page doesn't reflow when it arrives; later ones keep the old one.
  const [started, setStarted] = useState(false);
  if (!started && photo.ready) setStarted(true);

  const [layout, setLayout] = useState<LayoutInfo | null>(null);
  const onLayout = useCallback((info: DocumentLayoutInfo) => setLayout({ pages: info.pages, step: info.step }), []);

  // For downloads: the latest draft, what the pages show, and whether the photo is drawn.
  const latest = useRef(profile);
  const shownRef = useRef(shown);
  const photoReady = useRef(photo.ready);
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    latest.current = profile;
    shownRef.current = shown;
    photoReady.current = photo.ready;
  });

  const source = useMemo<ExportSource>(
    () => ({
      profile: () => latest.current,
      pages: async () => {
        flush(latest.current);
        return waitFor(() => shownRef.current === latest.current && photoReady.current && host.current?.querySelector('[data-doc-ready="1"] .doc-pages'));
      },
    }),
    [flush],
  );
  const controls = useExport(source);

  // Ctrl+P prints the pages, not the editor.
  useEffect(() => printFromBrowserMenu(() => host.current?.querySelector(".doc-pages") ?? null), []);

  // Growing to desktop width closes the sheet (the column takes over).
  if (desktop && sheetOpen) setSheetOpen(false);

  const pages = (
    <PagesPane
      hostRef={host}
      doc={started ? doc : null}
      photo={photo.photo}
      layout={layout}
      onLayout={onLayout}
      fit={desktop ? "page" : "width"}
      zoomable={desktop}
    />
  );

  if (!desktop) {
    return (
      <>
        <PreviewSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          doc={doc}
          options={profile.options}
          layout={layout}
          edit={edit}
          readOnly={readOnly}
          controls={controls}
        >
          {pages}
        </PreviewSheet>
        <ExportToast controls={controls} placement="sheet" />
      </>
    );
  }

  return (
    <aside
      aria-label={t("preview.region")}
      className="sticky top-14 flex h-[calc(100dvh-3.5rem)] min-w-0 flex-col self-start border-l border-line bg-sunken/60"
      data-testid="live-preview"
    >
      {/* Two rows: the pane's name with the four outputs (the main action top right, as in the mockup), then the
          three look controls sharing the full width. */}
      <div className="space-y-2.5 border-b border-line bg-surface/80 px-4 py-3 xl:px-5">
        <div className="flex items-center gap-3">
          <h2 className="min-w-0 flex-1 text-[15px] font-semibold tracking-tight text-ink">{t("preview.title")}</h2>
          <ToolbarActions controls={controls} />
        </div>
        <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2">
          <DesignPopover doc={doc} edit={edit} disabled={readOnly} />
          <LanguageButton lang={profile.docLanguage} edit={edit} disabled={readOnly} className={`${button("secondary")} w-full justify-start px-3`} />
          <TextSizePopover doc={doc} textSize={profile.options.textSize} labelCase={profile.options.labelCase} layout={layout} edit={edit} disabled={readOnly} />
        </div>
      </div>
      {pages}
      <ExportToast controls={controls} placement="pane" />
    </aside>
  );
}

/**
 * The pages, scaled: DocumentView at true size inside a box of the scaled size, its .doc-pages scaled with a CSS
 * transform (layout and measuring stay at true size; DocumentView's off-screen measuring columns are outside
 * .doc-pages, so they are never scaled). Desktop fits the whole page and zooms; phones fit the width and scroll.
 */
function PagesPane({
  hostRef,
  doc,
  photo,
  layout,
  onLayout,
  fit,
  zoomable,
}: {
  hostRef: RefObject<HTMLDivElement | null>;
  doc: DocModel | null;
  photo?: PhotoInput;
  layout: LayoutInfo | null;
  onLayout: (info: DocumentLayoutInfo) => void;
  fit: "page" | "width";
  zoomable: boolean;
}) {
  const pane = useRef<HTMLDivElement>(null);
  const size = usePaneSize(pane);
  const pad = fit === "page" ? 24 : 16;
  const fitted = fitScale({ width: size.width - 2 * pad, height: size.height - 2 * pad }, fit, fit === "page" ? 1.25 : 1);
  const [zoom, setZoom] = useState<Zoom>("fit");
  const scale = zoomable ? resolveScale(zoom, fitted) : fitted;
  const pageCount = layout?.pages ?? 1;
  const [current, setCurrent] = useState(0);
  const shownPage = Math.min(current, pageCount - 1);

  const goTo = useCallback(
    (index: number, atScale = scale) => {
      pane.current?.scrollTo({ top: Math.max(0, pageTop(index, atScale) + pad - 12), behavior: "instant" });
      setCurrent(index);
    },
    [scale, pad],
  );
  const changeZoom = (next: Zoom) => {
    setZoom(next);
    const nextScale = resolveScale(next, fitted);
    requestAnimationFrame(() => goTo(shownPage, nextScale));
  };

  return (
    <>
      <div
        ref={pane}
        className="relative min-h-0 flex-1 overflow-auto overscroll-contain"
        onScroll={(event) => setCurrent(pageInView(event.currentTarget.scrollTop, event.currentTarget.clientHeight, scale, pageCount))}
        data-testid="preview-pane"
      >
        <p className="sr-only">{t("preview.summary")}</p>
        <div className="w-max min-w-full" style={{ padding: pad }}>
          <div
            ref={hostRef}
            aria-hidden
            className="relative mx-auto"
            style={{ width: PAGE_WIDTH * scale, height: stackHeight(pageCount) * scale, ["--preview-scale" as string]: scale }}
            data-testid="preview-pages"
            data-scale={scale.toFixed(3)}
          >
            {doc ? (
              <DocumentView
                doc={doc}
                photo={photo}
                onLayout={onLayout}
                className="relative h-full w-full overflow-clip [overflow-clip-margin:2rem] [&_.doc-pages]:w-[794px] [&_.doc-pages]:origin-top-left [&_.doc-pages]:[transform:scale(var(--preview-scale))]"
              />
            ) : null}
            {!layout && <div className="absolute inset-0 animate-pulse rounded-[2px] bg-surface shadow-card motion-reduce:animate-none" />}
          </div>
        </div>
      </div>
      {zoomable && (
        <div className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 border-t border-line bg-surface/80 px-4 py-1.5 text-[13px] xl:px-5" data-testid="preview-footer">
          <p className="flex items-center gap-2 text-ink-2" data-testid="preview-status">
            <span aria-hidden className={`size-2 rounded-full ${pageCount <= 1 ? "bg-good" : "bg-gold"}`} />
            {layout ? (pageCount <= 1 ? t("preview.status.one") : t("preview.status.many", { pages: pageCount })) : t("preview.loading")}
          </p>
          {pageCount > 1 && (
            <div className="flex items-center gap-0.5" data-testid="page-nav">
              <button type="button" className={iconButton} aria-label={t("preview.prevPage")} disabled={shownPage === 0} onClick={() => goTo(shownPage - 1)}>
                <Icon name="chevronLeft" className="size-4" />
              </button>
              <span className="min-w-[5.5rem] text-center text-ink-2 tabular-nums" aria-live="polite">
                {t("preview.page", { page: shownPage + 1, pages: pageCount })}
              </span>
              <button type="button" className={iconButton} aria-label={t("preview.nextPage")} disabled={shownPage >= pageCount - 1} onClick={() => goTo(shownPage + 1)}>
                <Icon name="chevronRight" className="size-4" />
              </button>
            </div>
          )}
          <div className="ml-auto flex items-center gap-0.5" data-testid="zoom">
            <button type="button" className={iconButton} aria-label={t("preview.zoomOut")} title={t("preview.zoomOut")} onClick={() => changeZoom(stepZoom(scale, -1))}>
              <Icon name="zoomOut" className="size-[18px]" />
            </button>
            <button
              type="button"
              className="h-9 min-w-[5.5rem] rounded-lg px-2 text-ink-2 tabular-nums transition-colors outline-none hover:bg-sunken hover:text-ink focus-visible:ring-[3px] focus-visible:ring-ring"
              aria-label={zoom === "fit" ? t("preview.zoomFitLabel", { percent: percent(scale) }) : t("preview.zoomFixedLabel", { percent: percent(scale) })}
              onClick={() => changeZoom(zoom === "fit" ? 1 : "fit")}
              data-testid="zoom-value"
            >
              {zoom === "fit" ? t("preview.zoomFit", { percent: percent(scale) }) : percent(scale)}
            </button>
            <button type="button" className={iconButton} aria-label={t("preview.zoomIn")} title={t("preview.zoomIn")} onClick={() => changeZoom(stepZoom(scale, 1))}>
              <Icon name="zoomIn" className="size-[18px]" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
