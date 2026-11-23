"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { DocModel } from "@/biodata/document";
import type { ProfileOptions } from "@/biodata/types";
import { iconButton } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import type { Edit } from "../FieldRow";
import { SheetActions, type ExportControls } from "./ExportActions";
import { ColourPicker, CurrentSwatch, DesignChoices, FitHint, LanguageButton, TextControls, type LayoutInfo } from "./PreviewControls";

// The preview below 1024 px (BUILD_PLAN Step 3.3, VISION §5 tablet and mobile, D45; mockups editor-phone,
// sheet-phone, preview-phone): a floating "Preview & download" pill (with the page count; hidden while the on-screen
// keyboard is up) opens a sheet: from the bottom on phones (92 % of the height; closed by a swipe down, ✕, the
// backdrop or Esc), from the right on tablets, so the form never sits cramped beside a tiny page. It holds the live
// pages, the design and colour chips, the text size and labels, and Download PDF / Share / Save as image / Print, so
// a phone user finishes without leaving the editor.
//
// On a phone the page comes first (owner's choice 2026-11-23, after the controls left only a strip of it): the page
// fills the sheet and scrolls on its own, and a row of tool tabs above the actions (Design, Colour, Text, Labels)
// opens one small tray at a time, so the page stays in view while a choice changes it. Tapping the open tab again
// closes its tray and gives the page the whole height. On a tablet (and a phone on its side) the controls and the
// pages scroll together under the header.
//
// The sheet stays mounted while closed (invisible, moved off-screen): its DocumentView keeps the page count for the
// pill and is ready the moment it opens. Its controls are drawn only while it is open.

const PHONE = "(max-width: 639px)";

/** The on-screen keyboard is up: a text field has the focus on a touch screen and the visible height shrank. */
function useKeyboardUp() {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)");
    let tallest = window.innerHeight;
    const editable = () => {
      const el = document.activeElement as HTMLElement | null;
      return !!el && (el.isContentEditable || el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && !["checkbox", "radio", "button", "submit", "file", "range"].includes((el as HTMLInputElement).type)));
    };
    const check = () => {
      tallest = Math.max(tallest, window.innerHeight);
      const viewport = window.visualViewport?.height ?? window.innerHeight;
      // iOS shrinks the visual viewport; Android shrinks the window.
      setUp(coarse.matches && editable() && (window.innerHeight - viewport > 150 || tallest - window.innerHeight > 150));
    };
    window.visualViewport?.addEventListener("resize", check);
    window.addEventListener("resize", check);
    document.addEventListener("focusin", check);
    document.addEventListener("focusout", check);
    return () => {
      window.visualViewport?.removeEventListener("resize", check);
      window.removeEventListener("resize", check);
      document.removeEventListener("focusin", check);
      document.removeEventListener("focusout", check);
    };
  }, []);
  return up;
}

function subscribePhone(callback: () => void) {
  const query = window.matchMedia(PHONE);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

/** A phone held upright (below 640 px): the sheet's page-first layout. True before React starts (the static page). */
export const usePhone = () => useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE).matches, () => true);

type Tool = "design" | "colour" | "text" | "labels";
const TOOLS: { id: Tool; icon?: IconName; label: () => string }[] = [
  { id: "design", icon: "layout", label: () => t("preview.design") },
  { id: "colour", label: () => t("preview.colour") },
  { id: "text", icon: "type", label: () => t("preview.tool.text") },
  { id: "labels", icon: "lines", label: () => t("preview.labels") },
];

/** What the open sheet makes inert behind it: the header, the skip link and the editor's panes. */
const BEHIND = 'body a[href="#main"], header, [data-editor-pane]';

export function PreviewSheet({
  open,
  onOpenChange,
  doc,
  options,
  layout,
  edit,
  readOnly,
  controls,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: DocModel;
  options: ProfileOptions;
  layout: LayoutInfo | null;
  edit: Edit;
  readOnly: boolean;
  controls: ExportControls;
  children: ReactNode;
}) {
  const titleId = useId();
  const pill = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const keyboardUp = useKeyboardUp();
  const phone = usePhone();
  const trayId = useId();
  const [tool, setTool] = useState<Tool | null>("design");
  const [drag, setDrag] = useState<number | null>(null);
  const dragStart = useRef<{ y: number; t: number } | null>(null);
  const wasOpen = useRef(false);

  // Open: the page behind is inert and doesn't scroll, the focus moves into the sheet, Esc closes it. Closed: the
  // focus goes back to the pill.
  useEffect(() => {
    if (!open) {
      if (wasOpen.current) pill.current?.focus();
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    const behind = [...document.querySelectorAll<HTMLElement>(BEHIND)];
    behind.forEach((el) => (el.inert = true));
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    title.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      // A menu inside closes first; a dialog over the sheet (the language list) handles its own Esc.
      if (event.key !== "Escape" || event.defaultPrevented || document.querySelector("dialog[open]")) return;
      onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      behind.forEach((el) => (el.inert = false));
      root.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  // A swipe down on the handle or the header closes the phone sheet.
  const onPointerDown = (event: ReactPointerEvent) => {
    if (!phone || (event.target as Element).closest("button, a, [role=radio]")) return;
    dragStart.current = { y: event.clientY, t: performance.now() };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent) => {
    if (!dragStart.current) return;
    setDrag(Math.max(0, event.clientY - dragStart.current.y));
  };
  const onPointerEnd = (event: ReactPointerEvent) => {
    const start = dragStart.current;
    dragStart.current = null;
    setDrag(null);
    if (!start) return;
    const distance = event.clientY - start.y;
    const speed = distance / Math.max(1, performance.now() - start.t);
    if (distance > 110 || (distance > 30 && speed > 0.6)) onOpenChange(false);
  };

  const pages = layout ? layout.pages + layout.photoPages + layout.chartPages : undefined;
  return (
    <>
      <button
        ref={pill}
        type="button"
        onClick={() => onOpenChange(true)}
        tabIndex={open ? -1 : 0}
        aria-hidden={open || undefined}
        className={`fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-30 inline-flex h-12 -translate-x-1/2 items-center gap-2.5 rounded-full bg-ink pr-2 pl-5 text-[15px] font-semibold whitespace-nowrap text-page shadow-pop transition-[opacity,translate] duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring motion-reduce:transition-none print:hidden ${
          open || keyboardUp ? "pointer-events-none translate-y-4 opacity-0" : "opacity-100"
        }`}
        data-testid="preview-pill"
      >
        <Icon name="eye" className="size-5" />
        {t("preview.open")}
        <span className="min-w-[4.25rem] rounded-full bg-page/15 px-2.5 py-1 text-center text-[12.5px] font-semibold tabular-nums" data-testid="pill-pages">
          {pages === undefined ? "…" : pages <= 1 ? t("preview.pill.one") : t("preview.pill.many", { pages })}
        </span>
      </button>

      <div className={`fixed inset-0 z-40 transition-[visibility] duration-300 motion-reduce:transition-none print:hidden ${open ? "visible" : "pointer-events-none invisible"}`} data-testid="preview-sheet" data-open={open ? "1" : undefined}>
        <div aria-hidden className={`absolute inset-0 bg-stone-950/45 transition-opacity duration-300 motion-reduce:transition-none ${open ? "opacity-100" : "opacity-0"}`} onClick={() => onOpenChange(false)} />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={`absolute inset-x-0 bottom-0 flex h-[92dvh] flex-col overflow-hidden rounded-t-3xl border-t border-line bg-surface shadow-pop duration-300 ease-out motion-reduce:transition-none sm:inset-y-0 sm:right-0 sm:left-auto sm:h-auto sm:w-[min(40rem,calc(100vw-4rem))] sm:rounded-none sm:rounded-l-2xl sm:border-t-0 sm:border-l ${
            drag === null ? "transition-[translate]" : ""
          } ${open ? "translate-x-0 translate-y-0" : "translate-y-full sm:translate-x-full sm:translate-y-0"}`}
          style={drag ? { translate: `0 ${drag}px` } : undefined}
        >
          <div className="touch-none select-none" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}>
            <div aria-hidden className="flex justify-center pt-2.5 sm:hidden">
              <span className="h-1.5 w-10 rounded-full bg-line-strong" />
            </div>
            <div className="flex items-center gap-2 px-4 pt-2 pb-2 sm:px-5 sm:pt-4">
              <h2 id={titleId} ref={title} tabIndex={-1} className="min-w-0 flex-1 text-xl font-bold tracking-tight outline-none">
                {t("preview.title")}
              </h2>
              <LanguageButton
                lang={doc.lang}
                edit={edit}
                disabled={readOnly}
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink transition-colors outline-none hover:bg-sunken focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-55 pointer-coarse:min-h-11"
              />
              <button type="button" className={`${iconButton} -mr-1.5`} aria-label={t("preview.close")} onClick={() => onOpenChange(false)}>
                <Icon name="x" className="size-5" />
              </button>
            </div>
          </div>
          {phone ? (
            <>
              {/* The page fills the space and scrolls on its own (LivePreview's PagesPane). */}
              <div className="relative flex min-h-0 flex-1 flex-col bg-sunken" data-testid="sheet-body">
                {children}
              </div>
              {open && (
                <div className="shrink-0 border-t border-line" data-testid="sheet-tools">
                  {tool && (
                    <div id={trayId} role="group" aria-label={TOOLS.find((x) => x.id === tool)!.label()} className="px-4 pt-2.5 pb-2" data-testid="sheet-tray" data-tool={tool}>
                      {tool === "design" && <DesignChoices doc={doc} edit={edit} disabled={readOnly} layout="strip" />}
                      {tool === "colour" && (
                        <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-2">
                          <ColourPicker doc={doc} edit={edit} disabled={readOnly} />
                          <FitHint textSize={options.textSize} layout={layout} />
                        </div>
                      )}
                      {tool === "text" && <TextControls doc={doc} options={options} layout={layout} edit={edit} disabled={readOnly} sheet part="size" />}
                      {tool === "labels" && <TextControls doc={doc} options={options} layout={layout} edit={edit} disabled={readOnly} sheet part="labels" />}
                    </div>
                  )}
                  <div className="flex border-t border-line" data-testid="sheet-tool-tabs">
                    {TOOLS.map(({ id, icon, label }) => {
                      const shown = tool === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          aria-expanded={shown}
                          aria-controls={shown ? trayId : undefined}
                          onClick={() => setTool(shown ? null : id)}
                          className={`relative flex min-h-13 flex-1 flex-col items-center justify-center gap-1 text-[12px] font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-inset ${
                            shown ? "text-brand-ink" : "text-ink-2 hover:text-ink"
                          }`}
                          data-tool={id}
                        >
                          {shown && <span aria-hidden className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-brand" />}
                          {icon ? <Icon name={icon} className="size-5" /> : <CurrentSwatch doc={doc} className="size-[18px]" />}
                          {label()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* A tablet: one scrolling column, the controls above the pages. */
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain" data-testid="sheet-body">
              {open && (
                <div className="shrink-0 space-y-3 border-b border-line px-4 pb-3 sm:px-5" data-testid="sheet-controls">
                  <DesignChoices doc={doc} edit={edit} disabled={readOnly} layout="strip" />
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <ColourPicker doc={doc} edit={edit} disabled={readOnly} />
                    <FitHint textSize={options.textSize} layout={layout} />
                  </div>
                  <TextControls doc={doc} options={options} layout={layout} edit={edit} disabled={readOnly} sheet />
                </div>
              )}
              <div className="relative flex shrink-0 grow flex-col bg-sunken">{children}</div>
            </div>
          )}
          <div className="border-t border-line bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
            <SheetActions controls={controls} />
          </div>
        </div>
      </div>
    </>
  );
}
