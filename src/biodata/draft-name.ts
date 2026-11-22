import { systemClock, type Clock } from "./defaults";
import type { BiodataProfile } from "./types";

// A draft's name in the drafts menu (BUILD_PLAN Step 1.4). It is only ever shown in the app, never printed: the
// document has no idea it exists (VISION D35, nothing printed but the user's content).
//
// The rule: a stored `draftName` of "" means "automatic". An automatic name follows the Full name as it is typed
// ("Sai Teja Mandapati" → "Sai Teja Mandapati's biodata"), or is "Untitled biodata" while there is none. Renaming stores the
// typed name, which then stays put whatever the Full name becomes; renaming to nothing goes back to automatic.
// So nothing is written to the draft as the name changes, and an old draft picks the rule up with no migration.
//
// The words ("{name}'s biodata", "Untitled biodata") come from the app dictionary, passed in, so this stays pure.

export interface DraftNameWords {
  /** With the person's short name, e.g. "{name}'s biodata". */
  named: string;
  /** No name typed yet, e.g. "Untitled biodata". */
  untitled: string;
  /** A duplicate's name, e.g. "{name} (copy)". */
  copy: string;
}

/**
 * The name an automatic draft name uses: the whole Full name as typed, spaces tidied ("Vusirikala  Hari Kiran" →
 * "Vusirikala Hari Kiran"; owner's choice 2026-11-22, it used to be the given names only). The header and menus
 * cut a name too long for them with an ellipsis.
 */
export function titleName(fullName: string): string {
  return fullName.trim().split(/\s+/u).filter(Boolean).join(" ");
}

/** The Full name typed in the draft (the first field with the fullName key), or "". */
export function fullNameOf(profile: Pick<BiodataProfile, "sections">): string {
  for (const section of profile.sections) {
    if (section.kind !== "fields") continue;
    const field = section.fields.find((f) => f.key === "fullName");
    if (field) return field.value;
  }
  return "";
}

/** The name the drafts menu shows: the user's own name if they gave one, else the automatic one. */
export function draftTitle({ draftName, fullName }: { draftName: string; fullName: string }, words: DraftNameWords): string {
  const own = draftName.trim();
  if (own) return own;
  const name = titleName(fullName);
  return name ? words.named.replace("{name}", name) : words.untitled;
}

/** A duplicate's name: "<name> (copy)", stored, so the copy keeps it even when its Full name changes. */
export function copyName(title: string, words: DraftNameWords): string {
  return words.copy.replace("{name}", title);
}

/**
 * Renames a draft (D6, an edit like the others). The name is trimmed: it is typed in a dialog and saved once,
 * not on every keystroke. An empty name goes back to the automatic one. A no-op returns the same profile.
 */
export function renameDraft(profile: BiodataProfile, name: string, now: Clock = systemClock): BiodataProfile {
  const draftName = name.trim();
  if (draftName === profile.draftName) return profile;
  return { ...profile, draftName, updatedAt: now().toISOString() };
}

/**
 * True when there is nothing in the draft yet: no name of its own, no value typed, no family details and no
 * photo. "Create my biodata" reopens such a draft instead of making another empty one beside it.
 */
export function isBlankDraft(profile: BiodataProfile): boolean {
  if (profile.draftName.trim() || profile.photo || profile.secondPhoto || profile.photoPages?.photos.length || profile.horoscopeChart) return false;
  return profile.sections.every((section) =>
    section.kind === "fields"
      ? section.fields.every((field) => field.value.trim() === "")
      : section.members.every((member) => member.details.trim() === "" && member.relation.trim() === ""),
  );
}
