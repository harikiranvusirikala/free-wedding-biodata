"use client";

import { useId } from "react";
import { focusRing } from "./button";

/**
 * An on/off setting ("Show on the biodata"): the whole row is one button with role="switch", so a tap on
 * the words works too and screen readers say "on" or "off". Named by the label alone; `hint`, a line under
 * it, is its description.
 */
export function Switch(props: { checked: boolean; onChange: (checked: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  const { checked, onChange, label, hint, disabled = false } = props;
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={`${id}-label`}
      aria-describedby={hint ? hintId : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`group flex w-full items-center justify-between gap-4 rounded-lg py-1.5 text-left disabled:opacity-55 pointer-coarse:min-h-11 ${focusRing}`}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span id={`${id}-label`} className="text-sm font-medium text-ink">
          {label}
        </span>
        {hint && (
          <span id={hintId} className="text-[13px] text-pretty text-ink-3">
            {hint}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className={`flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors duration-150 motion-reduce:transition-none ${checked ? "bg-brand" : "bg-line-strong"}`}
      >
        <span className={`size-5 rounded-full bg-white shadow-sm transition-transform duration-150 motion-reduce:transition-none ${checked ? "translate-x-4" : "translate-x-0"}`} />
      </span>
    </button>
  );
}
