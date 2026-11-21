import { systemClock, type Clock } from "./defaults";
import type { BiodataProfile } from "./types";

// A draft's name in the drafts menu (BUILD_PLAN Step 1.4). It is only ever shown in the app, never printed: the
// document has no idea it exists (VISION D35, nothing printed but the user's content).
//
// The rule: a stored `draftName` of "" means "automatic". An automatic name follows the Full name as it is typed
// ("Sai Teja Mandapati" → "Sai Teja's biodata"), or is "Untitled biodata" while there is none. Renaming stores the
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

/** A name longer than this is shortened to its first word in an automatic draft name. */
const LONG_NAME = 32;

/** "K." or "K" or "K.S.": an initial, skipped when there are other words. */
const INITIALS = /^(\p{L}\.)+$|^\p{L}$/u;

/**
 * The part of a Full name an automatic draft name uses: the given name(s) without the family name, so
 * "Sai Teja Mandapati" → "Sai Teja", "Priya Sharma" → "Priya", "Lakshmi" → "Lakshmi". Initials are skipped
 * ("K. Sai Teja" → "Sai"), and a very long result falls back to the first word. Not a judgement about
 * which word is the family name in every tradition, just a short, recognisable label; the user can rename it.
 */
export function shortName(fullName: string): string {
  const words = fullName.trim().split(/\s+/u).filter(Boolean);
  const named = words.filter((word) => !INITIALS.test(word));
  const use = named.length ? named : words;
  if (use.length === 0) return "";
  const short = use.length <= 2 ? use[0] : use.slice(0, -1).join(" ");
  return short.length > LONG_NAME ? use[0] : short;
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
  const short = shortName(fullName);
  return short ? words.named.replace("{name}", short) : words.untitled;
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
