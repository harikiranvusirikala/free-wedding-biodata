import { parseIsoDate } from "./format";

// What the editor's inputs turn typed text into, and back (BUILD_PLAN Step 2.1, VISION §6, D6, D13, D33, D47).
// Pure, so every conversion is a unit test. The rule throughout: a value is stored in its format ("YYYY-MM-DD",
// "HH:mm", cm) when the text can be read as one, and otherwise exactly as typed, so typing is never blocked and
// nothing typed is lost (the document prints an unreadable value as typed, format.ts).

const pad2 = (n: number) => String(n).padStart(2, "0");

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** A month number from an English month name or its first three letters ("Mar", "march", "Sept"). */
function monthFromName(name: string): number | null {
  const lower = name.toLowerCase();
  if (lower.length < 3) return null;
  const index = MONTHS.findIndex((month) => month.startsWith(lower));
  return index < 0 ? null : index + 1;
}

function isoOf(year: number, month: number, day: number): string | null {
  const iso = `${String(year).padStart(4, "0")}-${pad2(month)}-${pad2(day)}`;
  return parseIsoDate(iso) ? iso : null;
}

/**
 * A typed date as "YYYY-MM-DD", or null when it isn't one. Reads day first, as India writes dates: "15-03-1998",
 * "15/3/1998", "15.03.1998", "15 March 1998", "15-Mar-1998", and an ISO date as is. Two-digit years are refused
 * (is "98" 1998 or 2098?), as are dates that don't exist ("31-02-1998").
 */
export function parseDateText(text: string): string | null {
  const value = text.trim();
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return parseIsoDate(value) ? value : null;
  const numeric = /^(\d{1,2})\s*[-/. ]\s*(\d{1,2})\s*[-/. ]\s*(\d{4})$/.exec(value);
  if (numeric) return isoOf(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));
  const named = /^(\d{1,2})(?:st|nd|rd|th)?\s*[-/. ,]\s*([a-z]+)\.?\s*[-/. ,]\s*(\d{4})$/i.exec(value);
  if (named) {
    const month = monthFromName(named[2]);
    return month ? isoOf(Number(named[3]), month, Number(named[1])) : null;
  }
  return null;
}

/** A stored date as the editor shows it: "1998-03-15" → "15-03-1998"; anything else as it was typed. */
export function dateToText(value: string): string {
  const date = parseIsoDate(value);
  return date ? `${pad2(date.day)}-${pad2(date.month)}-${date.year}` : value;
}

/** What to store for typed date text: the ISO date when it reads as one, else the text as typed. */
export function dateTextToValue(text: string): string {
  return parseDateText(text) ?? text;
}

/**
 * A typed time as "HH:mm" (24 hours), or null. Reads 12-hour times with AM/PM ("6:45 AM", "6.45pm", "6 pm",
 * "645 p.m.") and 24-hour times ("06:45", "18:45").
 */
export function parseTimeText(text: string): string | null {
  const value = text.trim();
  const twelve = /^(\d{1,2})(?:\s*[:.]?\s*(\d{2}))?\s*([ap])\.?\s*m?\.?$/i.exec(value);
  if (twelve) {
    const hours = Number(twelve[1]);
    const minutes = twelve[2] === undefined ? 0 : Number(twelve[2]);
    if (hours < 1 || hours > 12 || minutes > 59) return null;
    const pm = twelve[3].toLowerCase() === "p";
    return `${pad2((hours % 12) + (pm ? 12 : 0))}:${pad2(minutes)}`;
  }
  const day = /^(\d{1,2})\s*[:.]\s*(\d{2})$/.exec(value);
  if (day) {
    const hours = Number(day[1]);
    const minutes = Number(day[2]);
    if (hours > 23 || minutes > 59) return null;
    return `${pad2(hours)}:${pad2(minutes)}`;
  }
  return null;
}

/** A stored "HH:mm" as the editor shows it, 12-hour with AM/PM (§6): "18:05" → "6:05 PM"; else as typed. */
export function timeToText(value: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return value;
  const hours = Number(m[1]);
  if (hours > 23 || Number(m[2]) > 59) return value;
  return `${hours % 12 === 0 ? 12 : hours % 12}:${m[2]} ${hours < 12 ? "AM" : "PM"}`;
}

/** What to store for typed time text: "HH:mm" when it reads as a time, else the text as typed. */
export function timeTextToValue(text: string): string {
  return parseTimeText(text) ?? text;
}

/** The heights the picker offers, in inches: 4 ft 0 in to 7 ft 6 in. */
export const HEIGHT_INCHES = { min: 48, max: 90 } as const;

/** Inches → the stored centimetres (whole numbers, D13). 70 in → "178". */
export function inchesToCm(inches: number): string {
  return String(Math.round(inches * 2.54));
}

/** Feet and inches for a number of inches: 70 → { ft: 5, in: 10 }. */
export function splitInches(inches: number): { ft: number; in: number } {
  return { ft: Math.floor(inches / 12), in: inches % 12 };
}

/**
 * The picker's choice for a stored height: the nearest whole inch of a value in cm, or null when the value is
 * empty, typed text ("5 feet 10") or outside the picker's range. Whole centimetres round-trip exactly through
 * whole inches (178 cm → 70 in → 178 cm), so picking never drifts.
 */
export function heightToInches(value: string): number | null {
  const text = value.trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const inches = Math.round(Number(text) / 2.54);
  return inches >= HEIGHT_INCHES.min && inches <= HEIGHT_INCHES.max ? inches : null;
}

export interface Choice {
  key: string;
  label: string;
}

/**
 * The option a typed text names exactly (ignoring case and outer spaces), if any: typing "never married" in full
 * is treated as picking it, so it still prints in the document language (D33). Anything else stays typed text.
 */
export function matchChoice(text: string, choices: readonly Choice[]): Choice | undefined {
  const wanted = text.trim().toLowerCase();
  if (!wanted) return undefined;
  return choices.find((choice) => choice.label.toLowerCase() === wanted);
}

/** The options worth showing while typing: labels containing the text, those starting with it first. */
export function filterChoices(text: string, choices: readonly Choice[]): Choice[] {
  const wanted = text.trim().toLowerCase();
  if (!wanted) return [...choices];
  const starts: Choice[] = [];
  const contains: Choice[] = [];
  for (const choice of choices) {
    const label = choice.label.toLowerCase();
    if (label.startsWith(wanted)) starts.push(choice);
    else if (label.includes(wanted)) contains.push(choice);
  }
  return [...starts, ...contains];
}

/**
 * The first letter in upper case (D47), for labels and values typed in Latin script: "software engineer" →
 * "Software engineer". The rest is left exactly as typed, and Indian scripts (which have no capitals) are never
 * changed. Leading spaces are kept; a first letter that becomes two (German ß) and words with their own capitals
 * ("iPhone") are left alone.
 */
export function capitalizeFirst(text: string): string {
  const start = text.search(/\S/);
  if (start < 0) return text;
  const first = text.codePointAt(start)!;
  // Latin letters only: Basic Latin, Latin-1, Latin Extended-A/B and Latin Extended Additional.
  const latin = first < 0x0250 || (first >= 0x1e00 && first <= 0x1eff);
  if (!latin) return text;
  const char = String.fromCodePoint(first);
  const upper = char.toUpperCase();
  if (upper === char || [...upper].length !== 1) return text;
  // A word written with its own capitals ("iPhone", "eSevai") is left as the user spelt it.
  const next = text.charAt(start + char.length);
  if (next && next !== next.toLowerCase()) return text;
  return text.slice(0, start) + upper + text.slice(start + char.length);
}
