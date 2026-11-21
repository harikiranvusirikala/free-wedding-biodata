import type { LangCode } from "@/biodata/types";
import en from "./en.json";
import te from "./te.json";

// The printed labels (BUILD_PLAN A2, VISION §8, D11): one dictionary per document language. English is complete
// and is the fallback for anything another language leaves out, key by key, so a half-translated dictionary
// still prints every label. Telugu is drafted and marked "not yet reviewed by a native speaker" (D47) in its
// meta, with notes on the words a reviewer should check. The other eight languages arrive in Step 4.2.
// Pure: no browser APIs, so the document model and its tests use it directly.

type Widen<T> = T extends string ? string : T extends readonly (infer U)[] ? Widen<U>[] : { [K in keyof T]: Widen<T[K]> };
type DeepPartial<T> = T extends string ? string : T extends readonly (infer U)[] ? U[] : { [K in keyof T]?: DeepPartial<T[K]> };

/** A complete document dictionary: the shape of en.json, with plain strings. */
export type DocDictionary = Widen<Omit<typeof en, "meta">> & {
  meta: { name: string; reviewed: boolean; reviewNotes?: Record<string, string> };
};

/** What a translation may contain: any subset of the English keys. */
export type PartialDocDictionary = DeepPartial<Omit<DocDictionary, "meta">> & { meta: DocDictionary["meta"] };

const ENGLISH: DocDictionary = en;

const TRANSLATIONS: Partial<Record<LangCode, PartialDocDictionary>> = { te };

/** The languages that have a dictionary of their own (others print in English until Step 4.2). */
export const DOC_LANGUAGES_WITH_LABELS = ["en", ...Object.keys(TRANSLATIONS)] as LangCode[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `base` with every string `over` provides; arrays (months) are taken whole only when complete. */
function merge<T>(base: T, over: unknown): T {
  if (Array.isArray(base)) {
    return (Array.isArray(over) && over.length === base.length && over.every((v) => typeof v === "string" && v) ? over : base) as T;
  }
  if (isRecord(base)) {
    if (!isRecord(over)) return base;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(base)) out[key] = merge(base[key], over[key]);
    return out as T;
  }
  return (typeof over === "string" && over.trim() ? over : base) as T;
}

const cache = new Map<LangCode, DocDictionary>();

/** The dictionary for a document language, with English filling every gap. */
export function getDocDictionary(lang: LangCode): DocDictionary {
  let dict = cache.get(lang);
  if (!dict) {
    const translation = TRANSLATIONS[lang];
    dict = translation ? { ...merge(ENGLISH, translation), meta: translation.meta } : ENGLISH;
    cache.set(lang, dict);
  }
  return dict;
}

/** The raw translation (no English filled in), for completeness tests and the review-status notice. */
export function getTranslation(lang: LangCode): PartialDocDictionary | undefined {
  return lang === "en" ? ENGLISH : TRANSLATIONS[lang];
}

/** Fills `{name}` placeholders. A placeholder with no value is left as it is, so it shows up in review. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));
}
