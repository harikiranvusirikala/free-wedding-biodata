"use client";

import { memo, useCallback } from "react";
import { pickFieldOption, setFieldValue, setFieldVisible, setMemberDetails, setMemberVisible } from "@/biodata/edits";
import type { Choice } from "@/biodata/inputs";
import type { BiodataProfile, FamilyMember, Field, HeightFormat } from "@/biodata/types";
import { iconButton } from "@/components/ui/button";
import { fieldHint } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { t, type AppKey } from "@/lib/i18n";
import en from "@/i18n/app/en.json";
import { ChoiceValue } from "./ChoiceInput";
import { FieldMenu, MemberMenu } from "./ManageMenus";
import { DateValue, HeightValue, ParagraphValue, TextValue, TimeValue } from "./FieldInputs";
import { choicesFor, fieldLabel, memberLabel, useLabelStyle } from "./labels";

// One row of a section card (mockup: editor): the label, the value's input, the eye that hides the row from the
// biodata (its value is kept, §6) and the ⋯ menu (rename, type, move, remove: Step 2.2). From tablets up the label
// sits beside the input; on phones above it, with the eye and ⋯ at the end of the label line (mockup: editor-phone). Paragraphs always take the full width under their label.
// Rows are memoised on their field, so typing re-renders only the row being typed in.

/** Applies a profile edit to the latest profile (the open draft's controller). Stable for the editor's lifetime. */
export type Edit = (change: (profile: BiodataProfile) => BiodataProfile) => void;

/** Characters that fit well on a one-page biodata (D44): advisory only, never enforced. */
const CHAR_GUIDE: Partial<Record<string, number>> = { aboutMe: 600, partnerExpectations: 500 };

const hasKey = (key: string): key is AppKey => Object.hasOwn(en, key);

function placeholderFor(field: Field): string | undefined {
  const key = field.key ? `editor.placeholder.${field.key}` : "";
  if (key && hasKey(key)) return t(key);
  if (field.type === "select") return t("editor.placeholder.select");
  if (field.type === "date") return t("editor.placeholder.dateOfBirth");
  if (field.type === "time") return t("editor.placeholder.birthTime");
  return field.type === "textarea" || field.type === "height" ? undefined : t("editor.placeholder.text");
}

function hintFor(field: Field): string | undefined {
  if (field.help?.trim()) return field.help;
  // Said once, under the main phone number (§6: a format hint; never checked or blocked).
  return field.key === "phone" ? t("editor.hint.phone") : undefined;
}

/** The row's grid: [label | input | eye ⋯] from tablets up; label, eye and ⋯ over a full-width input on phones. */
const ROW = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1.5 px-4 py-3 sm:grid-cols-[10.5rem_minmax(0,1fr)_auto] sm:gap-x-3 sm:px-5 sm:py-2.5";

function RowShell({
  inputId,
  label,
  visible,
  stacked,
  readOnly,
  onVisible,
  hint,
  hintId,
  testId,
  menu,
  children,
}: {
  inputId: string;
  label: string;
  visible: boolean;
  /** Label above the input at every width (paragraphs). */
  stacked?: boolean;
  readOnly: boolean;
  onVisible: (visible: boolean) => void;
  hint?: string;
  hintId: string;
  testId?: string;
  /** The row's ⋯ menu. */
  menu?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={ROW} data-testid={testId} data-hidden={visible ? undefined : ""}>
      <div className="col-start-1 row-start-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 self-center sm:min-h-9 sm:self-start">
        <label htmlFor={inputId} className={`min-w-0 text-sm font-medium break-words ${visible ? "text-ink-2" : "text-ink-3"}`}>
          {label}
        </label>
        {!visible && (
          <span className="rounded-full bg-sunken px-2 py-0.5 text-[11.5px] font-semibold text-ink-3 ring-1 ring-line-strong ring-inset">{t("editor.hidden")}</span>
        )}
      </div>
      <div className={`col-span-2 row-start-2 min-w-0 ${stacked ? "sm:col-span-3" : "sm:col-span-1 sm:col-start-2 sm:row-start-1"}`}>
        {children}
        {hint && (
          <p id={hintId} className={`mt-1.5 ${fieldHint} text-pretty`}>
            {hint}
          </p>
        )}
      </div>
      <div className="col-start-2 row-start-1 flex items-center gap-0.5 self-center sm:col-start-3 sm:self-start">
        <button
          type="button"
          aria-pressed={visible}
          aria-label={t("editor.show", { label })}
          title={t(visible ? "editor.shownTip" : "editor.hiddenTip")}
          disabled={readOnly}
          onClick={() => onVisible(!visible)}
          className={`${iconButton} ${visible ? "text-ink-3" : "text-brand-ink"}`}
        >
          <Icon name={visible ? "eye" : "eyeOff"} className="size-[18px]" />
        </button>
        {menu}
      </div>
    </div>
  );
}

interface FieldRowProps {
  field: Field;
  edit: Edit;
  readOnly: boolean;
  heightFormat: HeightFormat;
}

export const FieldRow = memo(function FieldRow({ field, edit, readOnly, heightFormat }: FieldRowProps) {
  const id = `field-${field.id}`;
  const labelStyle = useLabelStyle();
  const label = fieldLabel(field, labelStyle);
  const hint = hintFor(field);
  const hintId = `${id}-hint`;
  const fieldId = field.id;
  const commit = useCallback((value: string) => edit((p) => setFieldValue(p, fieldId, value)), [edit, fieldId]);
  const pick = useCallback((choice: Choice) => edit((p) => pickFieldOption(p, fieldId, choice.key, choice.label)), [edit, fieldId]);
  const onVisible = useCallback((visible: boolean) => edit((p) => setFieldVisible(p, fieldId, visible)), [edit, fieldId]);

  const value = {
    id,
    value: field.value,
    readOnly,
    describedBy: hint ? hintId : undefined,
    dim: !field.visible,
    onCommit: commit,
  };
  const placeholder = placeholderFor(field);
  const choices = field.type === "select" ? choicesFor(field) : undefined;

  let input: React.ReactNode;
  switch (field.type) {
    case "textarea":
      input = <ParagraphValue {...value} placeholder={placeholder} maxChars={field.key ? CHAR_GUIDE[field.key] : undefined} />;
      break;
    case "date":
      input = <DateValue {...value} label={label} placeholder={placeholder} />;
      break;
    case "time":
      input = <TimeValue {...value} label={label} placeholder={placeholder} />;
      break;
    case "height":
      input = <HeightValue {...value} heightFormat={heightFormat} />;
      break;
    case "select":
      input = choices ? (
        <ChoiceValue {...value} label={label} choices={choices} optionKey={field.optionKey} placeholder={placeholder} onPick={pick} />
      ) : (
        // A select field without a list of its own (not one the catalogue knows) is typed like text.
        <TextValue {...value} kind="text" placeholder={placeholder} />
      );
      break;
    case "phone":
    case "email":
      input = <TextValue {...value} kind={field.type} placeholder={placeholder} />;
      break;
    default:
      input = <TextValue {...value} kind="text" multiline={field.multiline} placeholder={placeholder} />;
  }

  return (
    <RowShell
      inputId={id}
      label={label}
      visible={field.visible}
      stacked={field.type === "textarea"}
      readOnly={readOnly}
      onVisible={onVisible}
      hint={hint}
      hintId={hintId}
      testId={`row-${field.key ?? field.id}`}
      menu={<FieldMenu field={field} readOnly={readOnly} />}
    >
      {input}
    </RowShell>
  );
});

/** A family member (D28): the relation as the label, the details typed beside it, and the row's ⋯ menu (Step 2.3). */
export const MemberRow = memo(function MemberRow({
  member,
  edit,
  readOnly,
  placeholder,
}: {
  member: FamilyMember;
  edit: Edit;
  readOnly: boolean;
  /** What to write: a family member's or a reference's details. */
  placeholder: string;
}) {
  const id = `member-${member.id}`;
  const memberId = member.id;
  const commit = useCallback((details: string) => edit((p) => setMemberDetails(p, memberId, details)), [edit, memberId]);
  const onVisible = useCallback((visible: boolean) => edit((p) => setMemberVisible(p, memberId, visible)), [edit, memberId]);
  return (
    <RowShell
      inputId={id}
      label={memberLabel(member)}
      visible={member.visible}
      readOnly={readOnly}
      onVisible={onVisible}
      hintId={`${id}-hint`}
      testId={`member-${member.relationKey ?? member.id}`}
      menu={<MemberMenu member={member} readOnly={readOnly} />}
    >
      <TextValue id={id} kind="text" wrap value={member.details} readOnly={readOnly} dim={!member.visible} onCommit={commit} placeholder={placeholder} />
    </RowShell>
  );
});
