"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

// The app's drop-down menus (BUILD_PLAN A7; the sibling apps' pattern): the theme menu and the drafts menu.
// The WAI-ARIA menu button: when it opens, the checked item (or the first) takes the focus; arrows, Home and
// End move; Escape closes and returns to the button; Tab closes. A tap anywhere else closes it
// (pointerdown, so a touch counts too). A page Next.js keeps for Back comes back with its menus closed.

const ITEMS = '[role="menuitem"]:not([disabled]), [role="menuitemradio"]:not([disabled]), [role="menuitemcheckbox"]:not([disabled])';

const ITEM = "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm outline-none disabled:opacity-55 pointer-coarse:min-h-11";

export const menuItem = `${ITEM} text-ink-2 hover:bg-sunken hover:text-ink focus-visible:bg-sunken focus-visible:text-ink aria-checked:font-semibold aria-checked:text-ink`;

/** An item that removes or deletes something. */
export const dangerMenuItem = `${ITEM} text-danger hover:bg-danger-soft focus-visible:bg-danger-soft`;

/** The floating panel (exported for the dev gallery's still picture of an open menu). */
export const menuPanel = "rounded-xl border border-line bg-surface p-1.5 text-ink shadow-pop";

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">{children}</div>;
}

export function MenuSeparator() {
  return <div role="separator" className="my-1.5 h-px bg-line" />;
}

export function Menu(props: {
  /** The menu's name, for screen readers. */
  label: string;
  /** What the button shows; give it `buttonLabel` when that isn't text. */
  button: ReactNode;
  buttonLabel?: string;
  buttonClassName: string;
  buttonTitle?: string;
  disabled?: boolean;
  align?: "start" | "end";
  menuClassName?: string;
  /** Called as the menu opens (the drafts menu refreshes its list). */
  onOpen?: () => void;
  /** The items; `close` closes the menu and returns the focus to its button. */
  children: (close: () => void) => ReactNode;
}) {
  const { label, button, buttonLabel, buttonClassName, buttonTitle, disabled, align = "end", menuClassName = "w-56", onOpen, children } = props;
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  useLayoutEffect(() => () => setOpen(false), []); // its page hidden (React's Activity): closed when it's back

  // Found by id rather than a ref: `close` is handed to the items while they render.
  const close = () => {
    setOpen(false);
    document.getElementById(`${id}-button`)?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const items = [...(panel.current?.querySelectorAll<HTMLElement>(ITEMS) ?? [])];
    (items.find((item) => item.getAttribute("aria-checked") === "true") ?? items[0])?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
      return;
    }
    const items = [...(panel.current?.querySelectorAll<HTMLElement>(ITEMS) ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: items.length - 1 }[event.key];
    if (to === undefined || !items.length) return;
    event.preventDefault();
    items[(to + items.length) % items.length].focus();
  }

  return (
    <div ref={root} className="relative">
      <button
        id={`${id}-button`}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={buttonLabel}
        title={buttonTitle}
        disabled={disabled}
        onClick={() => {
          if (!open) onOpen?.();
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          // ArrowDown or ArrowUp on the closed button opens it, as Enter and Space do (they click).
          if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !open) {
            event.preventDefault();
            onOpen?.();
            setOpen(true);
          }
        }}
        className={buttonClassName}
      >
        {button}
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={onKeyDown}
          className={`absolute top-full z-50 mt-2 max-w-[calc(100vw-1.5rem)] animate-menu-in motion-reduce:animate-none ${menuPanel} ${align === "end" ? "right-0 origin-top-right" : "left-0 origin-top-left"} ${menuClassName}`}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}
