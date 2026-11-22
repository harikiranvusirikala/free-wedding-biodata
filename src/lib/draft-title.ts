import { copyName, draftTitle, type DraftNameWords } from "@/biodata/draft-name";
import { t } from "./i18n";

// The drafts menu's words (Step 1.4): a draft's name through the pure rule in src/biodata/draft-name.ts with the
// app dictionary's words, and "Edited 2 days ago" for when it was last changed.

export const DRAFT_NAME_WORDS: DraftNameWords = { named: t("drafts.named"), untitled: t("drafts.untitled"), copy: t("drafts.copy") };

/** The name to show for a draft: its own, else "Sai Teja's biodata" from its Full name, else "Untitled biodata". */
export function titleOf(draft: { draftName: string; fullName: string }): string {
  return draftTitle(draft, DRAFT_NAME_WORDS);
}

/** The name a duplicate of this draft gets. */
export function copyTitleOf(draft: { draftName: string; fullName: string }): string {
  return copyName(titleOf(draft), DRAFT_NAME_WORDS);
}

/** The name for a draft restored beside a draft that is already here (Step 5.1): "<name> (restored)". */
export function restoredTitleOf(draft: { draftName: string; fullName: string }): string {
  return t("drafts.restored", { name: titleOf(draft) });
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "Edited just now", "Edited 5 minutes ago", "Edited yesterday", "Edited 3 days ago", then the date from a week
 * on ("Edited 12 Nov 2026" or the device's own order). "" for a time that can't be read (a damaged draft).
 */
export function editedAgo(updatedAt: string, now: Date = new Date(), locale?: string): string {
  const then = Date.parse(updatedAt);
  if (Number.isNaN(then)) return "";
  const ago = Math.max(0, now.getTime() - then);
  if (ago < MINUTE) return t("drafts.editedNow");
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  let when: string;
  if (ago < HOUR) when = relative.format(-Math.floor(ago / MINUTE), "minute");
  else if (ago < DAY) when = relative.format(-Math.floor(ago / HOUR), "hour");
  else if (ago < 7 * DAY) when = relative.format(-Math.floor(ago / DAY), "day");
  else return t("drafts.editedOn", { date: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(then) });
  return t("drafts.edited", { when });
}
