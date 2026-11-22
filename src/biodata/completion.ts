import type { BiodataProfile, Section } from "./types";

// How much of a section is filled in, for the editor's section list and card headers (VISION §5 "completion
// indicators (informational only; do not force completion)"). Pure and cheap: it runs for every section on every
// keystroke.

export interface Completion {
  filled: number;
  total: number;
}

/**
 * "3 of 9 filled": the rows that will print (visible fields, visible family members) and how many of them have
 * something in them. Hidden rows are left out of both counts: the user chose to keep them off the biodata, so
 * they never count as missing. A value of only spaces is empty, as the document trims it.
 */
export function sectionCompletion(section: Section): Completion {
  let filled = 0;
  let total = 0;
  if (section.kind === "fields") {
    for (const field of section.fields) {
      if (!field.visible) continue;
      total += 1;
      if (field.value.trim() || field.optionKey) filled += 1;
    }
  } else {
    for (const member of section.members) {
      if (!member.visible) continue;
      total += 1;
      if (member.details.trim()) filled += 1;
    }
  }
  return { filled, total };
}

/** Where a section stands, for its dot: nothing yet, partly filled, or every row filled. */
export function completionState({ filled, total }: Completion): "empty" | "partial" | "complete" {
  if (filled === 0) return "empty";
  return filled >= total ? "complete" : "partial";
}

/** The whole biodata's completion: every visible section's printed rows. */
export interface ProfileCompletion extends Completion {
  /** 0–100, rounded down so "100%" means every row really is filled. */
  percent: number;
}

/**
 * "Your biodata is 72% filled" (Step 2.3): the rows of every visible section added up, hidden rows and hidden
 * sections left out (they won't print, so they never count as missing). Informational only (§5).
 */
export function profileCompletion(profile: Pick<BiodataProfile, "sections">): ProfileCompletion {
  let filled = 0;
  let total = 0;
  for (const section of profile.sections) {
    if (!section.visible) continue;
    const counts = sectionCompletion(section);
    filled += counts.filled;
    total += counts.total;
  }
  return { filled, total, percent: total === 0 ? 0 : Math.floor((filled / total) * 100) };
}
