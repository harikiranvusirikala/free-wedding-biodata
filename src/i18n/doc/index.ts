import type { LabelStyle, LangCode } from "@/biodata/types";
import bn from "./bn.json";
import en from "./en.json";
import gu from "./gu.json";
import hi from "./hi.json";
import kn from "./kn.json";
import ml from "./ml.json";
import mr from "./mr.json";
import pa from "./pa.json";
import ta from "./ta.json";
import te from "./te.json";

// The printed labels (BUILD_PLAN A2, VISION §8, D11): one dictionary per document language. English is complete
// and is the fallback for anything another language leaves out, key by key, so a half-translated dictionary
// still prints every label. The nine Indian languages are drafted and marked "not yet reviewed by a native speaker"
// (D11, D47) in their meta, with notes on the words a reviewer should check (Step 3.2 for Telugu, 4.2 for the rest).
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

const TRANSLATIONS: Partial<Record<LangCode, PartialDocDictionary>> = { te, hi, ta, kn, ml, mr, gu, bn, pa };

/** The languages that have a dictionary of their own (any other prints in English). */
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

/** A translation with English filling every key it leaves out or leaves empty (exported for tests). */
export function withEnglishFallback(translation: PartialDocDictionary): DocDictionary {
  return { ...merge(ENGLISH, translation), meta: translation.meta };
}

const cache = new Map<LangCode, DocDictionary>();

/** The dictionary for a document language, with English filling every gap. */
export function getDocDictionary(lang: LangCode): DocDictionary {
  let dict = cache.get(lang);
  if (!dict) {
    const translation = TRANSLATIONS[lang];
    dict = translation ? withEnglishFallback(translation) : ENGLISH;
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

/** The section titles and field labels a page prints: the dictionary's, with a label style's wording laid over them. */
export interface LabelTables {
  sections: Record<string, string>;
  fields: Record<string, string>;
}

const tableCache = new Map<DocDictionary, Map<LabelStyle, LabelTables>>();

/**
 * The section and field labels for a document language and label style. "telugu" re-words some English labels
 * (Birth Star, Swagothram, Salary…; the overlay in en.json's `labelVariants`) and, like the dictionaries themselves,
 * falls back to the standard label key by key. Any other language ignores the style: Telugu families print their
 * own language's words there. A label the user renamed always wins; that is the caller's rule, not this table's.
 */
export function labelTables(dict: DocDictionary, lang: LangCode, style: LabelStyle = "standard"): LabelTables {
  const variant = style === "telugu" && lang === "en" ? dict.labelVariants.telugu : undefined;
  if (!variant) return dict;
  let byStyle = tableCache.get(dict);
  if (!byStyle) tableCache.set(dict, (byStyle = new Map()));
  let tables = byStyle.get(style);
  if (!tables) {
    tables = { sections: { ...dict.sections, ...variant.sections }, fields: { ...dict.fields, ...variant.fields } };
    byStyle.set(style, tables);
  }
  return tables;
}
