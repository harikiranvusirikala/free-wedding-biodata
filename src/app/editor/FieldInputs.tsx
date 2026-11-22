"use client";

import { useRef, useState } from "react";
import {
  HEIGHT_INCHES,
  capitalizeFirst,
  dateToText,
  heightToInches,
  inchesToCm,
  parseDateText,
  parseTimeText,
  splitInches,
  timeToText,
} from "@/biodata/inputs";
import type { HeightFormat } from "@/biodata/types";
import { focusRing } from "@/components/ui/button";
import { field as fieldClass, fieldHint, textArea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { t } from "@/lib/i18n";

// The value inputs of the editor's rows (BUILD_PLAN Step 2.1, VISION §6). Each takes the stored string and calls
// `onCommit` with the string to store, on every keystroke, so autosave sees every change (typing stays instant:
// the row re-renders, nothing else). Dates and times are typed as text, with the device's own picker one tap
// away; height is picked in feet and inches and stored in cm (D13). Nothing typed is ever refused (D6).

/** What every value input gets from its row. */
export interface ValueProps {
  id: string;
  value: string;
  readOnly: boolean;
  /** The ids of hint lines under the input. */
  describedBy?: string;
  /** Dimmed: the field is hidden from the biodata (it stays editable). */
  dim: boolean;
  onCommit: (value: string) => void;
}

/** A hidden field's input: quieter, still clearly editable. */
export const dimValue = "bg-sunken! text-ink-3! shadow-none!";

/**
 * First letter in capitals when the field is left (D47), only if it was typed into this time, and never again
 * once the user has put a small letter back (that's the per-field undo). Returns the handlers to spread on the
 * input, and a `typed()` the caller uses for changes it commits itself.
 */
export function useAutoCapital(value: string, commit: (value: string) => void, enabled = true) {
  const typed = useRef(false);
  const auto = useRef<string | null>(null);
  const off = useRef(false);
  return {
    typed: () => {
      typed.current = true;
    },
    blur: (current: string = value) => {
      if (!enabled || !typed.current || off.current) return;
      typed.current = false;
      // The user changed only the first letter of what was capitalised for them: they want it that way.
      if (auto.current !== null && current.slice(1) === auto.current.slice(1) && current !== auto.current) {
        off.current = true;
        return;
      }
      const next = capitalizeFirst(current);
      if (next !== current) {
        auto.current = next;
        commit(next);
      }
    },
  };
}

/** Text, phone and email rows; `multiline` for a row that may wrap (an address). */
export function TextValue({
  kind,
  multiline,
  wrap,
  placeholder,
  ...props
}: ValueProps & {
  kind: "text" | "phone" | "email";
  /** May hold line breaks (an address). */
  multiline?: boolean;
  /**
   * Starts as one line and grows to show all of it (a family member's details). Enter adds a line, so a
   * reference can list a second phone number on its own line (D44); the biodata prints the lines as typed.
   */
  wrap?: boolean;
  placeholder?: string;
}) {
  const { id, value, readOnly, describedBy, dim, onCommit } = props;
  const capital = useAutoCapital(value, onCommit, kind === "text");
  const common = {
    id,
    value,
    readOnly,
    placeholder,
    "aria-describedby": describedBy,
    onBlur: () => capital.blur(),
  };
  if (multiline || wrap) {
    return (
      <textarea
        {...common}
        rows={multiline ? 2 : 1}
        autoCapitalize="sentences"
        className={`${textArea} min-h-9! py-[7px]! leading-5! field-sizing-content pointer-coarse:min-h-11! pointer-coarse:py-[11px]! ${multiline ? "resize-y" : "resize-none"} ${dim ? dimValue : ""}`}
        onChange={(event) => {
          capital.typed();
          onCommit(event.target.value);
        }}
      />
    );
  }
  return (
    <input
      {...common}
      type={kind === "phone" ? "tel" : kind === "email" ? "email" : "text"}
      inputMode={kind === "phone" ? "tel" : kind === "email" ? "email" : undefined}
      autoComplete="off"
      autoCapitalize={kind === "text" ? "sentences" : "off"}
      spellCheck={kind === "text" ? undefined : false}
      className={`${fieldClass} ${dim ? dimValue : ""}`}
      onChange={(event) => {
        capital.typed();
        onCommit(event.target.value);
      }}
    />
  );
}

/** A paragraph (About me, Partner expectations): grows with its text; an advisory count where D44 gives one. */
export function ParagraphValue({ placeholder, maxChars, ...props }: ValueProps & { placeholder?: string; maxChars?: number }) {
  const { id, value, readOnly, describedBy, dim, onCommit } = props;
  const capital = useAutoCapital(value, onCommit);
  const countId = `${id}-count`;
  const length = [...value.trim()].length;
  return (
    <>
      <textarea
        id={id}
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        rows={4}
        autoCapitalize="sentences"
        aria-describedby={[describedBy, maxChars ? countId : undefined].filter(Boolean).join(" ") || undefined}
        className={`${textArea} min-h-28 resize-y field-sizing-content ${dim ? dimValue : ""}`}
        onBlur={() => capital.blur()}
        onChange={(event) => {
          capital.typed();
          onCommit(event.target.value);
        }}
      />
      {maxChars !== undefined && (
        <p id={countId} className={`mt-1.5 text-right text-[12.5px] tabular-nums ${length > maxChars ? "font-medium text-warn" : "text-ink-3"}`}>
          <span aria-hidden>{t("editor.chars", { n: length, max: maxChars })}</span>
          <span className="sr-only">{t("editor.charsLabel", { n: length, max: maxChars })}</span>
        </p>
      )}
    </>
  );
}

/**
 * Text typed in a format, with the device's picker beside it (date, time). Typed text is stored in the format
 * when `parse` reads it, else exactly as typed. While the box has the focus it shows what was typed; afterwards
 * the value in its tidy form (`show`). A value saved before this input existed (Step 1.3 kept Date of birth as
 * free text) is shown tidy when it reads as one, and stored in the format the first time the box is left; one
 * that doesn't read stays as typed, with a hint that it prints that way.
 */
function PickerText({
  value,
  parse,
  show,
  picker,
  pickLabel,
  icon,
  placeholder,
  asTyped,
  ...props
}: ValueProps & {
  /** Text → the stored format ("YYYY-MM-DD", "HH:mm"), or null. */
  parse: (text: string) => string | null;
  /** The stored format → what the box shows ("15-03-1998", "6:45 AM"). */
  show: (stored: string) => string;
  picker: "date" | "time";
  pickLabel: string;
  icon: "calendar" | "clock";
  placeholder?: string;
  /** The hint under the box when a value doesn't read as a date or time. */
  asTyped: string;
}) {
  const { id, readOnly, describedBy, dim, onCommit } = props;
  const [draft, setDraft] = useState<string | null>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const hintId = `${id}-format`;
  const readable = parse(value);
  const tidy = readable === null ? value : show(readable);
  const unreadable = draft === null && value.trim() !== "" && readable === null;

  function openPicker() {
    const input = pickerRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
      input.click();
    }
  }

  return (
    <>
      <div className="relative">
        <input
          id={id}
          type="text"
          value={draft ?? tidy}
          readOnly={readOnly}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={[describedBy, unreadable ? hintId : undefined].filter(Boolean).join(" ") || undefined}
          className={`${fieldClass} pr-10 pointer-coarse:pr-12 ${dim ? dimValue : ""}`}
          onFocus={() => setDraft(tidy)}
          onBlur={() => {
            setDraft(null);
            if (!readOnly && readable !== null && readable !== value) onCommit(readable);
          }}
          onChange={(event) => {
            setDraft(event.target.value);
            onCommit(parse(event.target.value) ?? event.target.value);
          }}
        />
        <button
          type="button"
          aria-label={pickLabel}
          title={pickLabel}
          disabled={readOnly}
          onClick={openPicker}
          className={`absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-lg text-ink-3 transition-colors hover:text-ink disabled:opacity-55 pointer-coarse:w-11 ${focusRing}`}
        >
          <Icon name={icon} className="size-[18px]" />
        </button>
        {/* The device's own picker, opened by the button above; never focused or read on its own. */}
        <input
          ref={pickerRef}
          type={picker}
          tabIndex={-1}
          aria-hidden
          value={readable ?? ""}
          disabled={readOnly}
          onChange={(event) => {
            if (event.target.value) onCommit(event.target.value);
          }}
          className="pointer-events-none absolute inset-y-0 right-0 w-9 opacity-0 pointer-coarse:w-11"
        />
      </div>
      {unreadable && (
        <p id={hintId} className={`mt-1.5 ${fieldHint} text-pretty`}>
          {asTyped}
        </p>
      )}
    </>
  );
}

/** A date: typed dd-mm-yyyy (or picked), stored "YYYY-MM-DD", printed dd-mm-yyyy (D14). */
export function DateValue({ label, placeholder, ...props }: ValueProps & { label: string; placeholder?: string }) {
  return (
    <PickerText
      {...props}
      parse={parseDateText}
      show={dateToText}
      picker="date"
      icon="calendar"
      pickLabel={t("editor.date.pick", { label })}
      placeholder={placeholder}
      asTyped={t("editor.date.asTyped")}
    />
  );
}

/** A time: typed or picked, stored "HH:mm", shown 12-hour with AM/PM (§6). */
export function TimeValue({ label, placeholder, ...props }: ValueProps & { label: string; placeholder?: string }) {
  return (
    <PickerText
      {...props}
      parse={parseTimeText}
      show={timeToText}
      picker="time"
      icon="clock"
      pickLabel={t("editor.time.pick", { label })}
      placeholder={placeholder}
      asTyped={t("editor.time.asTyped")}
    />
  );
}

const HEIGHTS = Array.from({ length: HEIGHT_INCHES.max - HEIGHT_INCHES.min + 1 }, (_, i) => HEIGHT_INCHES.min + i);

/**
 * Height in feet and inches with centimetres alongside (§6, D13), stored in cm. One list from 4 ft to 7 ft 6 in;
 * cm first when the biodata prints cm only. A value from elsewhere that isn't a height in range is kept and
 * offered as "(as typed)" until another is picked.
 */
export function HeightValue({ heightFormat, ...props }: ValueProps & { heightFormat: HeightFormat }) {
  const { id, value, readOnly, describedBy, dim, onCommit } = props;
  const inches = heightToInches(value);
  const typed = inches === null && value.trim() !== "";
  const selected = inches !== null ? String(inches) : typed ? "typed" : "";
  return (
    <div className="relative">
      <select
        id={id}
        value={selected}
        disabled={readOnly}
        aria-describedby={describedBy}
        className={`${fieldClass} appearance-none pr-9 ${selected === "" ? "text-ink-3" : ""} ${dim ? dimValue : ""}`}
        onChange={(event) => {
          const next = event.target.value;
          if (next === "typed") return;
          onCommit(next === "" ? "" : inchesToCm(Number(next)));
        }}
      >
        <option value="">{t("editor.height.none")}</option>
        {typed && <option value="typed">{t("editor.height.typed", { value: value.trim() })}</option>}
        {HEIGHTS.map((n) => {
          const parts = { ...splitInches(n), cm: inchesToCm(n) };
          return (
            <option key={n} value={n}>
              {t(heightFormat === "cm" ? "editor.height.choiceCm" : "editor.height.choice", parts)}
            </option>
          );
        })}
      </select>
      <Icon name="chevronDown" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-3" />
    </div>
  );
}
