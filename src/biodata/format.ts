import type { BiodataProfile, DateFormat, HeightFormat } from "./types";
import { fill, type DocDictionary } from "@/i18n/doc";

// How values are printed (VISION §6, D13, D14): dates, birth time, height and age. Pure functions of the stored
// string and the document dictionary. A value that doesn't parse (the user typed something else, D6) is printed
// exactly as typed, never dropped or "corrected".

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^(\d{1,2}):(\d{2})$/;

/** A stored "YYYY-MM-DD" as its parts, or null if it isn't a real calendar date. */
export function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const m = ISO_DATE.exec(value.trim());
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return { year, month, day };
}

/** The date the format picker shows its examples with when a draft has no date yet (13 January 1998). */
export const EXAMPLE_DATE = "1998-01-13";

/** The draft's own date for the date-format examples: the date of birth, else any other real date it holds. */
export function draftExampleDate(profile: Pick<BiodataProfile, "sections">): string | undefined {
  const dates = profile.sections.flatMap((s) => (s.kind === "fields" ? s.fields : [])).filter((f) => f.type === "date" && parseIsoDate(f.value));
  return (dates.find((f) => f.key === "dateOfBirth") ?? dates[0])?.value.trim();
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "14-08-1996" (default), "14 August 1996" or "14-August-1996", month names in the document language. */
export function formatDate(value: string, format: DateFormat, dict: DocDictionary): string {
  const date = parseIsoDate(value);
  if (!date) return value.trim();
  const { year, month, day } = date;
  const monthName = dict.months[month - 1];
  switch (format) {
    case "d month yyyy":
      return `${day} ${monthName} ${year}`;
    case "d-month-yyyy":
      return `${day}-${monthName}-${year}`;
    default:
      return `${pad2(day)}-${pad2(month)}-${year}`;
  }
}

/** A stored "HH:mm" (24 h) as 12-hour time with AM/PM (§6): "06:45" → "6:45 AM". */
export function formatTime(value: string, dict: DocDictionary): string {
  const m = TIME.exec(value.trim());
  if (!m) return value.trim();
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return value.trim();
  const h = hours % 12 === 0 ? 12 : hours % 12;
  return fill(dict.words.time, { h, mm: m[2], period: hours < 12 ? dict.words.am : dict.words.pm });
}

/** Height stored in cm (D13), printed as 5' 10", 178 cm, or 5' 10" (178 cm). */
export function formatHeight(value: string, format: HeightFormat, dict: DocDictionary): string {
  const text = value.trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return text;
  const cm = Number(text);
  if (!(cm > 0)) return text;
  const totalInches = Math.round(cm / 2.54);
  const ftIn = fill(dict.words.heightFtIn, { ft: Math.floor(totalInches / 12), in: totalInches % 12 });
  const cmText = fill(dict.words.heightCm, { cm: Math.round(cm) });
  if (format === "cm") return cmText;
  if (format === "ft-in-cm") return fill(dict.words.heightBoth, { ftIn, cm: cmText });
  return ftIn;
}

/**
 * Completed years from a "YYYY-MM-DD" date of birth to `today` (local calendar date), or null when the date
 * doesn't parse or lies in the future. Computed when the document is made, never stored (D13).
 */
export function ageOn(dateOfBirth: string, today: Date): number | null {
  const dob = parseIsoDate(dateOfBirth);
  if (!dob) return null;
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  const d = today.getDate();
  let age = y - dob.year;
  if (m < dob.month || (m === dob.month && d < dob.day)) age -= 1;
  return age >= 0 ? age : null;
}

/** "30 years" in the document language. */
export function formatAge(age: number, dict: DocDictionary): string {
  return fill(dict.words.ageValue, { n: age });
}
