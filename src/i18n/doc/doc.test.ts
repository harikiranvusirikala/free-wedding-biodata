import { describe, expect, it } from "vitest";
import { DEFAULT_SECTIONS, FIELD_CATALOG, OPTION_LISTS, QUICK_PICK_SECTIONS, RELATION_KEYS } from "@/biodata/defaults";
import { fill, getDocDictionary, getTranslation, type PartialDocDictionary } from "./index";

// Every key the profile model can print has an English label, and the Telugu dictionary covers them all
// (VISION §8, D11). Missing Telugu keys are listed by name, so a gap is easy to find.

const SECTION_KEYS = [...DEFAULT_SECTIONS, ...QUICK_PICK_SECTIONS].map((s) => s.key);
const FIELD_KEYS = Object.keys(FIELD_CATALOG);
const OPTION_PATHS = Object.entries(OPTION_LISTS).flatMap(([list, keys]) => keys.map((k) => [list, k] as const));

/** Every printed key, as "group.key" paths, with the text a dictionary has for it. */
function labels(dict: PartialDocDictionary): [string, string | undefined][] {
  const options = dict.options as Record<string, Record<string, string> | undefined> | undefined;
  return [
    ...SECTION_KEYS.map((k) => [`sections.${k}`, (dict.sections as Record<string, string> | undefined)?.[k]] as [string, string | undefined]),
    ...FIELD_KEYS.map((k) => [`fields.${k}`, (dict.fields as Record<string, string> | undefined)?.[k]] as [string, string | undefined]),
    ...OPTION_PATHS.map(([list, k]) => [`options.${list}.${k}`, options?.[list]?.[k]] as [string, string | undefined]),
    ...RELATION_KEYS.map((k) => [`relations.${k}`, (dict.relations as Record<string, string> | undefined)?.[k]] as [string, string | undefined]),
    ...Object.keys(getDocDictionary("en").titles).map((k) => [`titles.${k}`, (dict.titles as Record<string, string> | undefined)?.[k]] as [string, string | undefined]),
    ...Object.keys(getDocDictionary("en").words).map((k) => [`words.${k}`, (dict.words as Record<string, string> | undefined)?.[k]] as [string, string | undefined]),
  ];
}

const missing = (dict: PartialDocDictionary) => labels(dict).filter(([, text]) => !text?.trim()).map(([path]) => path);

describe("document dictionaries", () => {
  it("English has a label for every section, field, option, relation, title and word", () => {
    expect(missing(getTranslation("en")!)).toEqual([]);
    expect(getDocDictionary("en").months).toHaveLength(12);
  });

  it("Telugu covers every default label (missing keys are listed here)", () => {
    expect(missing(getTranslation("te")!)).toEqual([]);
    expect(getTranslation("te")!.months).toHaveLength(12);
  });

  it("Telugu is marked as not yet reviewed, and its review notes point at real keys", () => {
    const te = getTranslation("te")!;
    expect(te.meta.reviewed).toBe(false);
    const paths = new Set(labels(te).map(([path]) => path));
    for (const path of Object.keys(te.meta.reviewNotes ?? {})) expect(paths, path).toContain(path);
  });

  it("has no keys English doesn't have (a typo would never print)", () => {
    const en = getDocDictionary("en") as unknown as Record<string, Record<string, unknown>>;
    const te = getTranslation("te") as unknown as Record<string, Record<string, unknown>>;
    for (const group of ["sections", "fields", "relations", "titles", "words"]) {
      for (const key of Object.keys(te[group] ?? {})) expect(Object.keys(en[group]), `${group}.${key}`).toContain(key);
    }
    for (const [list, keys] of Object.entries(te.options ?? {})) {
      for (const key of Object.keys(keys as object)) expect(Object.keys((en.options as Record<string, object>)[list]), `options.${list}.${key}`).toContain(key);
    }
  });

  it("falls back to English for a language without labels, and key by key for a partial one", () => {
    expect(getDocDictionary("hi").fields.fullName).toBe("Name");
    expect(getDocDictionary("te").fields.fullName).toBe("పేరు");
    expect(getDocDictionary("te").months[7]).toBe("ఆగస్టు");
  });

  it("fills placeholders and leaves unknown ones visible", () => {
    expect(fill("{n} years", { n: 30 })).toBe("30 years");
    expect(fill("{n} {unit}", { n: 1 })).toBe("1 {unit}");
  });
});
