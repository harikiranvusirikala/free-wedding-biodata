"use client";

import { useId, useState } from "react";
import { RELATION_KEYS, newUuid } from "@/biodata/defaults";
import { addMember, editMemberRelation, type MemberRelation } from "@/biodata/edits";
import { matchChoice, type Choice } from "@/biodata/inputs";
import type { FamilyMember, FamilySection } from "@/biodata/types";
import { button } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { field as fieldClass, fieldHint, fieldLabel as fieldLabelClass, textArea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import type { Edit } from "./FieldRow";
import { memberLabel, relationName } from "./labels";

// "Add a family member" and "Change relation" (BUILD_PLAN Step 2.3, VISION §6 "Repeated family members", D28,
// D44): the relation is picked from the suggestions (printed in the biodata's language, like D33's options) or
// typed (printed exactly as typed); typing a suggestion's name in full counts as picking it. Adding also takes
// the details, which may run over several lines: a reference with two phone numbers puts each on its own line.

const RELATIONS: readonly Choice[] = RELATION_KEYS.map((key) => ({ key, label: relationName(key) }));

/** The relation pills: radio buttons that look like the Add a field pills, the picked one in the brand colour. */
const PILL =
  "relative inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink-2 shadow-card transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand-ink has-checked:border-brand has-checked:bg-brand has-checked:text-on-brand has-focus-visible:ring-[3px] has-focus-visible:ring-ring pointer-coarse:min-h-11 pointer-coarse:px-3.5 pointer-coarse:text-sm";

/** The relation to save: the picked suggestion, a typed suggestion's name (as if picked), or the typed words. */
function relationOf(picked: string | null, typed: string): MemberRelation | null {
  if (picked) return { relationKey: picked };
  if (!typed.trim()) return null;
  const match = matchChoice(typed, RELATIONS);
  return match ? { relationKey: match.key } : { relation: typed.trim() };
}

export type MemberDialogMode = { kind: "add"; section: FamilySection } | { kind: "edit"; member: FamilyMember };

/** References gets its own words (people who vouch for the family, D44); Family and custom lists the family's. */
const isReferences = (section: Pick<FamilySection, "key">) => section.key === "references";

export function MemberDialog({
  open,
  mode,
  edit,
  onClose,
  onDone,
}: {
  open: boolean;
  mode?: MemberDialogMode;
  edit: Edit;
  onClose: () => void;
  /** The added or changed member's id, to focus its row. */
  onDone: (memberId: string) => void;
}) {
  const typedId = useId();
  const typedHintId = useId();
  const detailsId = useId();
  const detailsHintId = useId();
  const radioName = useId();
  const [picked, setPicked] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [details, setDetails] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      const member = mode?.kind === "edit" ? mode.member : undefined;
      setPicked(member?.relationKey ?? null);
      setTyped(member && !member.relationKey ? member.relation : "");
      setDetails("");
    }
  }

  const adding = mode?.kind === "add";
  const references = adding && isReferences(mode.section);
  const relation = relationOf(picked, typed);

  function submit() {
    if (!mode || !relation) return;
    if (mode.kind === "add") {
      const id = newUuid();
      const sectionId = mode.section.id;
      edit((p) => addMember(p, sectionId, { ...relation, details }, () => id));
      onClose();
      onDone(id);
    } else {
      const id = mode.member.id;
      edit((p) => editMemberRelation(p, id, relation));
      onClose();
      onDone(id);
    }
  }

  const title = !mode ? "" : mode.kind === "edit" ? t("member.dialog.editTitle", { label: memberLabel(mode.member) }) : t(references ? "member.dialog.addReferenceTitle" : "member.dialog.addTitle");

  return (
    <Dialog open={open} onClose={onClose} title={title} description={t("member.dialog.description")} wide>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        data-testid="member-dialog"
      >
        <fieldset>
          <legend className="text-sm font-medium text-ink">
            {t("member.dialog.relation")}
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {RELATIONS.map((choice) => (
              <label key={choice.key} className={PILL}>
                <input
                  type="radio"
                  name={radioName}
                  value={choice.key}
                  checked={picked === choice.key}
                  data-autofocus={picked === choice.key ? "" : undefined}
                  onChange={() => {
                    setPicked(choice.key);
                    setTyped("");
                  }}
                  className="absolute inset-0 cursor-pointer appearance-none rounded-full outline-none"
                />
                {picked === choice.key && <Icon name="check" className="size-3.5" />}
                {choice.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label htmlFor={typedId} className={`mt-4 ${fieldLabelClass}`}>
          {t("member.dialog.typeLabel")}
        </label>
        <input
          id={typedId}
          className={`mt-1.5 ${fieldClass}`}
          value={typed}
          placeholder={t("member.dialog.typePlaceholder")}
          autoComplete="off"
          autoCapitalize="words"
          aria-describedby={typedHintId}
          onChange={(event) => {
            setTyped(event.target.value);
            if (event.target.value.trim()) setPicked(null);
          }}
        />
        <p id={typedHintId} className={`mt-1.5 ${fieldHint} text-pretty`}>
          {t("member.dialog.typeHint")}
        </p>

        {adding && (
          <>
            <label htmlFor={detailsId} className={`mt-4 ${fieldLabelClass}`}>
              {t("member.dialog.details")}
            </label>
            <textarea
              id={detailsId}
              className={`mt-1.5 ${textArea} min-h-[4.5rem]! field-sizing-content resize-none`}
              rows={2}
              value={details}
              placeholder={t(references ? "member.placeholder.reference" : "member.placeholder.family")}
              autoCapitalize="sentences"
              aria-describedby={detailsHintId}
              onChange={(event) => setDetails(event.target.value)}
            />
            <p id={detailsHintId} className={`mt-1.5 ${fieldHint} text-pretty`}>
              {t("member.dialog.detailsHint")}
            </p>
          </>
        )}

        <DialogActions>
          <button type="button" className={button("secondary")} onClick={onClose}>
            {t("ui.cancel")}
          </button>
          <button type="submit" className={button("primary")} disabled={!relation}>
            {adding && <Icon name="plus" className="size-4" />}
            {t(adding ? "member.dialog.add" : "manage.save")}
          </button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
