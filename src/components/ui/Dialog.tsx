"use client";

import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { t } from "@/lib/i18n";
import { iconButton } from "./button";
import { Icon } from "./icons";

// The app's dialogs (BUILD_PLAN A7; the sibling apps' pattern): the browser's own modal <dialog>, which makes
// the page behind inert, takes the focus and gives it back to the button that opened it. Escape, a click on
// the backdrop or Close end it; React keeps whether it's open (`open`), so the parent stays the truth.
// Hiding its page (React's Activity, which Next.js uses to keep a page for Back) closes it, because a modal
// left open in a hidden page would make the next page inert.

const FIRST_FIELD = "[data-autofocus], input:not([type='hidden']):not([type='file']):not([disabled]), select, textarea";

/** The box (exported for the dev gallery's still picture of a dialog). */
export const dialogBox = "rounded-2xl border border-line bg-surface text-ink shadow-pop";

export function Dialog(props: {
  open: boolean;
  onClose: () => void;
  /** Its heading, which also names it for screen readers. */
  title: string;
  description?: ReactNode;
  /** Wider, for previews. */
  wide?: boolean;
  children: ReactNode;
}) {
  const { open, onClose, title, description, wide = false, children } = props;
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    if (!element.open) element.showModal();
    // The browser focuses the first thing it can (Close); the first field is where people start.
    element.querySelector<HTMLElement>(FIRST_FIELD)?.focus();
    return () => element.close(); // closed, unmounted, or its page hidden
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault(); // Escape: the parent closes it, so `open` stays the truth
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose(); // the backdrop, around the box
      }}
      className={`m-auto max-h-[min(90dvh,52rem)] w-[calc(100vw-1.5rem)] overflow-y-auto overscroll-contain p-0 backdrop:bg-stone-950/45 backdrop:backdrop-blur-[2px] open:animate-dialog-in motion-reduce:open:animate-none ${dialogBox} ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}
    >
      {open && (
        <div className="p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold tracking-tight text-balance">
                {title}
              </h2>
              {description && <p className="mt-1 text-sm text-pretty text-ink-3">{description}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label={t("ui.close")} className={`${iconButton} -mt-1.5 -mr-2`}>
              <Icon name="x" className="size-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

/** A dialog's foot: Cancel, then the main button on the right (on top, full width, on phones). */
export function DialogActions({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{children}</div>;
}
