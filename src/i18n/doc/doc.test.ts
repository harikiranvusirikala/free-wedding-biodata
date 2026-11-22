import { describe, expect, it } from "vitest";
import { DEFAULT_SECTIONS, FIELD_CATALOG, OPTION_LISTS, QUICK_PICK_SECTIONS, RELATION_KEYS } from "@/biodata/defaults";
import { LANG_CODES, type LangCode } from "@/biodata/types";
import { DOC_LANGUAGES_WITH_LABELS, fill, getDocDictionary, getTranslation, labelTables, withEnglishFallback, type PartialDocDictionary } from "./index";

// Every key the profile model can print has an English label, and each of the nine Indian-language dictionaries
// (VISION §8, D11) has exactly the English key set, in its own script, marked "not yet reviewed" until a native
// speaker checks it (D47). Failures list the offending keys by path, so a gap is easy to find.

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

/**
 * Every leaf of a dictionary (meta left out) as [path, value]; array items are "months.0" … "months.11".
 * `labelVariants` (the English Telugu-families overlay) isn't part of a translation's key set.
 */
function leaves(value: unknown, prefix = ""): [string, unknown][] {
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, v]) => (prefix === "" && (key === "meta" || key === "labelVariants") ? [] : leaves(v, prefix ? `${prefix}.${key}` : key)));
  }
  return [[prefix, value]];
}

const EN_LEAVES = new Map(leaves(getTranslation("en")));

/**
 * Values a translation may leave identical to English: digits (pada), unit and time patterns made only of
 * placeholders and punctuation, and AM/PM, which printed Indian biodatas keep in Latin letters.
 */
const SAME_AS_ENGLISH_ALLOWED = new Set([
  "options.pada.1",
  "options.pada.2",
  "options.pada.3",
  "options.pada.4",
  "words.heightFtIn",
  "words.heightBoth",
  "words.time",
  "words.am",
  "words.pm",
]);

/** The Unicode block each language is written in (Hindi and Marathi share Devanagari). */
const SCRIPT: Record<Exclude<LangCode, "en">, { name: string; block: RegExp }> = {
  te: { name: "Telugu", block: /[\u0C00-\u0C7F]/ },
  hi: { name: "Devanagari", block: /[\u0900-\u097F]/ },
  mr: { name: "Devanagari", block: /[\u0900-\u097F]/ },
  ta: { name: "Tamil", block: /[\u0B80-\u0BFF]/ },
  kn: { name: "Kannada", block: /[\u0C80-\u0CFF]/ },
  ml: { name: "Malayalam", block: /[\u0D00-\u0D7F]/ },
  gu: { name: "Gujarati", block: /[\u0A80-\u0AFF]/ },
  bn: { name: "Bengali", block: /[\u0980-\u09FF]/ },
  pa: { name: "Gurmukhi", block: /[\u0A00-\u0A7F]/ },
};

/** Characters any script may use: spaces, digits, common punctuation, and zero-width (non-)joiners. */
const NEUTRAL = /[\s0-9.,:;'"()/\-\u2013\u00b7|?!\u200c\u200d]/;

const PLACEHOLDERS = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();

/** Characters of `text` that are neither in the language's block nor neutral, once placeholders are removed. */
function foreignChars(text: string, block: RegExp): string[] {
  return [...text.replace(/\{\w+\}/g, "")].filter((ch) => !block.test(ch) && !NEUTRAL.test(ch));
}

const TRANSLATED = LANG_CODES.filter((l): l is Exclude<LangCode, "en"> => l !== "en");

describe("document dictionaries", () => {
  it("English has a label for every section, field, option, relation, title and word", () => {
    expect(missing(getTranslation("en")!)).toEqual([]);
    expect(getDocDictionary("en").months).toHaveLength(12);
  });

  it("every document language has a dictionary of its own (VISION §8)", () => {
    expect([...DOC_LANGUAGES_WITH_LABELS].sort()).toEqual([...LANG_CODES].sort());
  });

  describe.each(TRANSLATED)("%s", (lang) => {
    const dict = getTranslation(lang)!;
    const own = new Map(leaves(dict));
    const { name: scriptName, block } = SCRIPT[lang];

    it("has exactly the English key set (missing and extra keys are listed)", () => {
      expect([...EN_LEAVES.keys()].filter((path) => !own.has(path)), "missing").toEqual([]);
      expect([...own.keys()].filter((path) => !EN_LEAVES.has(path)), "extra").toEqual([]);
      expect(missing(dict)).toEqual([]);
      expect(dict.months).toHaveLength(12);
    });

    it("has no empty or non-string values", () => {
      expect([...own].filter(([, v]) => typeof v !== "string" || !v.trim()).map(([path]) => path)).toEqual([]);
    });

    it("translates every value (only allowlisted digits, patterns and AM/PM stay as in English)", () => {
      expect([...own].filter(([path, v]) => v === EN_LEAVES.get(path) && !SAME_AS_ENGLISH_ALLOWED.has(path)).map(([path]) => path)).toEqual([]);
    });

    it(`is written in ${scriptName} (apart from digits, punctuation and allowlisted values)`, () => {
      const wrong = [...own].flatMap(([path, v]) => {
        if (SAME_AS_ENGLISH_ALLOWED.has(path) || typeof v !== "string") return [];
        const foreign = foreignChars(v, block);
        const hasScript = [...v.replace(/\{\w+\}/g, "")].some((ch) => block.test(ch));
        return foreign.length || !hasScript ? [`${path}: ${v}`] : [];
      });
      expect(wrong).toEqual([]);
      expect(foreignChars(dict.meta.name, block), "meta.name").toEqual([]);
    });

    it("keeps every {placeholder} of the English pattern", () => {
      const changed = [...own].filter(([path, v]) => typeof v === "string" && PLACEHOLDERS(v).join() !== PLACEHOLDERS(String(EN_LEAVES.get(path))).join());
      expect(changed.map(([path]) => path)).toEqual([]);
    });

    it("is marked not yet reviewed, with review notes that point at real keys", () => {
      // A reviewer flips `reviewed` to true (and this expectation with it) once a native speaker has checked it (D47).
      expect(dict.meta.reviewed).toBe(false);
      const notes = Object.keys(dict.meta.reviewNotes ?? {});
      expect(notes.length).toBeGreaterThan(0);
      expect(notes.filter((path) => !EN_LEAVES.has(path))).toEqual([]);
    });
  });

  it("falls back to English key by key for a partial dictionary", () => {
    const partial = withEnglishFallback({
      meta: { name: "Test", reviewed: false },
      fields: { fullName: "Naam", gender: "  " },
      months: ["only one"],
    });
    expect(partial.fields.fullName).toBe("Naam");
    expect(partial.fields.gender).toBe("Gender");
    expect(partial.sections.personal).toBe("Personal Details");
    expect(partial.months[0]).toBe("January");
    expect(partial.meta.name).toBe("Test");
  });

  describe("the Telugu families' English wording (labelVariants.telugu)", () => {
    const en = getDocDictionary("en");
    const overlay = en.labelVariants.telugu;

    it("re-words only keys English already has, with no empty value, and is marked confirmed (by the owner)", () => {
      const sections: Record<string, string> = overlay.sections;
      const fields: Record<string, string> = overlay.fields;
      expect(Object.keys(fields).filter((k) => !(k in en.fields))).toEqual([]);
      expect(Object.keys(sections).filter((k) => !(k in en.sections))).toEqual([]);
      expect([...Object.values(fields), ...Object.values(sections)].filter((v) => !v.trim())).toEqual([]);
      expect(overlay.meta.reviewed).toBe(true);
      const notes = Object.keys(overlay.meta.reviewNotes ?? {});
      expect(notes.length).toBeGreaterThan(0);
      expect(notes.filter((n) => n !== "all" && !(n.startsWith("fields.") ? n.slice(7) in fields : n.startsWith("sections.") && n.slice(9) in sections))).toEqual([]);
    });

    it("changes exactly four labels on English pages and leaves every other label standard", () => {
      const tables = labelTables(en, "en", "telugu");
      expect(overlay.fields).toEqual({ nakshatra: "Star", rashi: "Raasi", gotra: "Swagothram", maternalGotra: "Maternal Gothram" });
      expect(overlay.sections).toEqual({});
      const changed = Object.keys(tables.fields).filter((k) => tables.fields[k] !== (en.fields as Record<string, string>)[k]);
      expect(changed.sort()).toEqual(["gotra", "maternalGotra", "nakshatra", "rashi"]);
      expect(tables.sections).toEqual(en.sections);
      // What the earlier, longer overlay re-worded now prints the standard way.
      expect(tables.fields).toMatchObject({
        dateOfBirth: "Date of Birth",
        birthTime: "Time of Birth",
        birthPlace: "Place of Birth",
        highestQualification: en.fields.highestQualification,
        occupation: "Occupation",
        annualIncome: "Annual Income",
      });
      expect(tables.sections.contact).toBe("Contact Details");
      expect(tables.fields.fullName).toBe("Name");
      expect(labelTables(en, "en", "standard")).toBe(en);
      expect(labelTables(en, "en").fields.nakshatra).toBe("Nakshatra");
      expect(en.fields.gotra).toBe("Gotra");
    });

    it("is ignored by every other language", () => {
      for (const lang of TRANSLATED) {
        const dict = getDocDictionary(lang);
        expect(labelTables(dict, lang, "telugu")).toBe(dict);
      }
    });
  });

  it("serves each language's own labels", () => {
    expect(getDocDictionary("te").fields.fullName).toBe("పేరు");
    expect(getDocDictionary("te").months[7]).toBe("ఆగస్టు");
    expect(getDocDictionary("hi").fields.dateOfBirth).toBe("जन्म तिथि");
    expect(getDocDictionary("mr").fields.dateOfBirth).toBe("जन्मतारीख");
    expect(getDocDictionary("ta").fields.nakshatra).toBe("நட்சத்திரம்");
    expect(getDocDictionary("pa").months[0]).toBe("ਜਨਵਰੀ");
  });

  it("fills placeholders and leaves unknown ones visible", () => {
    expect(fill("{n} years", { n: 30 })).toBe("30 years");
    expect(fill("{n} {unit}", { n: 1 })).toBe("1 {unit}");
  });
});
