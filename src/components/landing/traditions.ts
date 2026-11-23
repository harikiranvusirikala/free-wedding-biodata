import type { Tradition } from "@/biodata/defaults";
import { TRADITION_FIELD_SETS } from "@/biodata/defaults";

// The five tradition pages (Step 6.1 part 2, VISION D36): /biodata-format/<tradition>. Wording in
// src/i18n/app/en.json (tradition.*); what Personal details holds comes from the same data as the editor's chips
// (TRADITION_FIELD_SETS), so the page and the app never disagree.

export const TRADITION_PAGES = ["hindu", "muslim", "christian", "sikh", "jain"] as const;
export type TraditionPage = (typeof TRADITION_PAGES)[number];

/** The editor chips each page talks about. */
const CHIPS: Record<TraditionPage, readonly Tradition[]> = {
  hindu: ["hinduTelugu", "hinduTamil", "hinduMarathi", "hindu"],
  muslim: ["muslim"],
  christian: ["christian"],
  sikh: ["sikh"],
  jain: ["jain"],
};

const HOROSCOPE = ["birthTime", "nakshatra", "rashi", "gotra", "maternalGotra"];
const AFTER = ["height", "complexion", "highestQualification", "occupation", "annualIncome"];

/** Personal details' rows on a typical biodata of this tradition, as field keys in print order. */
export function personalRows(page: TraditionPage): string[] {
  if (page === "hindu") return ["fullName", "dateOfBirth", "birthTime", "birthPlace", "nakshatra", "rashi", "gotra", "maternalGotra", ...AFTER];
  const own = [...new Set(CHIPS[page].flatMap((chip) => TRADITION_FIELD_SETS[chip].map((f) => f.field as string)))];
  const community = page === "jain" ? ["caste"] : [];
  return ["fullName", "dateOfBirth", "birthPlace", ...own.filter((k) => !HOROSCOPE.includes(k) || k === "gotra"), ...community, ...AFTER];
}

/** The fields a page's chips add (for "Tap … to add …"). */
export function chipFields(page: TraditionPage): string[] {
  return [...new Set(CHIPS[page].flatMap((chip) => TRADITION_FIELD_SETS[chip].map((f) => f.field as string)))];
}

/** The sample picture (public/designs/): Hindu is the owner-style biodata with the Ganesha picture. */
export const samplePicture = (page: TraditionPage) => (page === "hindu" ? "classic-gold" : `tradition-${page}`);
