"use client";

import { useRef, type KeyboardEvent } from "react";

/**
 * A short row of choices with one picked (paper size, Day / Night / Follow device): a sunken track with the
 * chosen option raised. A radio group: Tab reaches the chosen option, arrows (and Home, End) move and choose,
 * as screen-reader users expect. `label` names the group; `describedBy` points at text explaining the choice.
 */
export function SegmentedControl<T extends string>(props: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; disabled?: boolean }[];
  onChange: (value: T) => void;
  className?: string;
  describedBy?: string;
}) {
  const { label, value, options, onChange, className = "", describedBy } = props;
  const group = useRef<HTMLDivElement>(null);
  const enabled = options.filter((o) => !o.disabled);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const at = enabled.findIndex((o) => o.value === value);
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    const to = step !== undefined ? (at + step + enabled.length) % enabled.length : event.key === "Home" ? 0 : event.key === "End" ? enabled.length - 1 : -1;
    if (to < 0 || !enabled.length) return;
    event.preventDefault();
    onChange(enabled[to].value);
    group.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(enabled[to].value)}"]`)?.focus();
  }

  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label={label}
      aria-describedby={describedBy}
      onKeyDown={onKeyDown}
      className={`inline-grid auto-cols-fr grid-flow-col gap-0.5 rounded-lg bg-sunken p-0.5 ring-1 ring-line ring-inset ${className}`}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            data-value={option.value}
            disabled={option.disabled}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={`h-8 rounded-md px-3 text-[13px] font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-45 motion-reduce:transition-none pointer-coarse:min-h-11 ${
              selected ? "bg-surface text-ink shadow-card ring-1 ring-line" : "text-ink-3 hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
