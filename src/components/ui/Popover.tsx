"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { menuPanel } from "./Menu";

// A button that opens a small panel of controls beside it (the live preview's design and text-size pickers): a
// non-modal dialog, unlike Menu's list of actions. When it opens, the chosen option (or the first control) takes the
// focus; Escape closes it and returns to the button; a tap outside, or the focus leaving it, closes it.

const CHECKED = '[aria-checked="true"]:not([disabled])';
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Popover(props: {
  /** Names the panel for screen readers. */
  label: string;
  /** What the button shows; give it `buttonLabel` when that isn't enough text. */
  button: ReactNode;
  buttonLabel?: string;
  buttonClassName: string;
  buttonTitle?: string;
  disabled?: boolean;
  align?: "start" | "end";
  panelClassName?: string;
  /** Marks the panel for tests. */
  testId?: string;
  children: ReactNode;
}) {
  const { label, button, buttonLabel, buttonClassName, buttonTitle, disabled, align = "start", panelClassName = "w-72", testId, children } = props;
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  useLayoutEffect(() => () => setOpen(false), []); // its page hidden (React's Activity): closed when it's back

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    (panel.current?.querySelector<HTMLElement>(CHECKED) ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  return (
    <div
      ref={root}
      className="relative"
      onBlur={(event) => {
        if (open && event.relatedTarget && !root.current?.contains(event.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-haspopup="dialog"
        aria-label={buttonLabel}
        title={buttonTitle}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={buttonClassName}
      >
        {button}
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          role="dialog"
          aria-label={label}
          data-testid={testId}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              close();
            }
          }}
          className={`absolute top-full z-50 mt-2 max-w-[calc(100vw-1.5rem)] animate-menu-in p-3 motion-reduce:animate-none ${menuPanel} ${align === "end" ? "right-0 origin-top-right" : "left-0 origin-top-left"} ${panelClassName}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
