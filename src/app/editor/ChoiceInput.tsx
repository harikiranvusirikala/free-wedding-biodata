"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { filterChoices, matchChoice, type Choice } from "@/biodata/inputs";
import { field as fieldClass } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import { dimValue, useAutoCapital, type ValueProps } from "./FieldInputs";

// A select field (VISION §6, D33): an editable combobox (WAI-ARIA 1.2 "list autocomplete with manual selection").
// The box takes any text; the list below it only saves typing. Picking stores the option's key, so it prints in
// the document language; typing anything else clears the key and prints exactly as typed. Typing an option's name
// in full counts as picking it. Chosen over a <select> with an "Other…" box: one control, typing works the same
// on every field, and long lists (27 nakshatras, 13 languages) filter as you type.

export function ChoiceValue({
  label,
  choices,
  optionKey,
  placeholder,
  onPick,
  ...props
}: ValueProps & {
  label: string;
  choices: readonly Choice[];
  optionKey?: string;
  placeholder?: string;
  onPick: (choice: Choice) => void;
}) {
  const { id, value, readOnly, describedBy, dim, onCommit } = props;
  const listId = `${id}-list`;
  const optionId = (key: string) => `${id}-option-${key}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  /** What the list is filtered by: null shows every choice (opened with the button or the arrow keys). */
  const [filter, setFilter] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const capital = useAutoCapital(value, onCommit);

  const picked = optionKey === undefined ? undefined : choices.find((c) => c.key === optionKey);
  const text = picked?.label ?? value;
  const shown = useMemo(() => (filter === null ? [...choices] : filterChoices(filter, choices)), [filter, choices]);
  const expanded = open && shown.length > 0;

  useEffect(() => {
    if (!expanded || active < 0 || !shown[active]) return;
    document.getElementById(`${id}-option-${shown[active].key}`)?.scrollIntoView({ block: "nearest" });
  }, [expanded, active, shown, id]);

  function showAll() {
    setFilter(null);
    setOpen(true);
    setActive(Math.max(0, choices.findIndex((c) => c.key === optionKey)));
  }

  function close() {
    setOpen(false);
    setFilter(null);
    setActive(-1);
  }

  function pick(choice: Choice) {
    onPick(choice);
    close();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (readOnly) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!expanded) showAll();
      else setActive((i) => Math.min(i + 1, shown.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!expanded) showAll();
      else setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      if (expanded && active >= 0 && shown[active]) {
        event.preventDefault();
        pick(shown[active]);
      }
    } else if (event.key === "Escape") {
      if (expanded) {
        event.preventDefault();
        close();
      }
    }
  }

  function onBlur() {
    close();
    // Typed in full, an option's name is the option (D33); anything else gets its first letter capitalised (D47).
    if (optionKey === undefined) {
      const match = matchChoice(value, choices);
      if (match) {
        onPick(match);
        return;
      }
    }
    capital.blur();
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        value={text}
        readOnly={readOnly}
        placeholder={placeholder}
        autoComplete="off"
        autoCapitalize="sentences"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && active >= 0 && shown[active] ? optionId(shown[active].key) : undefined}
        aria-describedby={describedBy}
        className={`${fieldClass} pr-10 pointer-coarse:pr-12 ${dim ? dimValue : ""}`}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        onClick={() => {
          if (!readOnly && !expanded) showAll();
        }}
        onChange={(event) => {
          capital.typed();
          onCommit(event.target.value);
          setFilter(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={t("editor.select.open", { label })}
        disabled={readOnly}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          inputRef.current?.focus();
          if (expanded) close();
          else showAll();
        }}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-lg text-ink-3 hover:text-ink disabled:opacity-55 pointer-coarse:w-11"
      >
        <Icon name="chevronDown" className={`size-4 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} />
      </button>
      <ul
        id={listId}
        role="listbox"
        aria-label={label}
        hidden={!expanded}
        className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 animate-menu-in overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface p-1 shadow-pop motion-reduce:animate-none"
      >
        {shown.map((choice, index) => {
          const selected = choice.key === optionKey;
          return (
            <li
              key={choice.key}
              id={optionId(choice.key)}
              role="option"
              aria-selected={index === active}
              className={`flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-sm pointer-coarse:min-h-11 ${index === active ? "bg-sunken text-ink" : "text-ink-2"} ${selected ? "font-semibold text-ink" : ""}`}
              onMouseDown={(event) => event.preventDefault()}
              onMouseMove={() => setActive(index)}
              onClick={() => pick(choice)}
            >
              <span className="min-w-0 flex-1 truncate">{choice.label}</span>
              {selected && <Icon name="check" className="size-4 text-brand-ink" />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
