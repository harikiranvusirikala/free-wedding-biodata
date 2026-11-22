import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS, TRADITIONS, TRADITION_FIELD_SETS, createProfile } from "./defaults";
import { toDocument } from "./document";
import {
  addTraditionFields,
  appliedTraditions,
  removeTradition,
  traditionRemoval,
  removeField,
  removeFields,
  removeSection,
  setDocLanguage,
  setFieldValue,
  setInvocation,
  setMotif,
  setTitle,
  titleChoice,
  traditionFieldsToAdd,
} from "./edits";
import { INVOCATIONS, TITLE_KEYS, findInvocation } from "./invocations";
import { profileSchema } from "./schema";
import type { BiodataProfile, FieldsSection } from "./types";
import { getDocDictionary } from "@/i18n/doc";

// Step 2.0: the top of the biodata (motif, invocation line, title: None first, never inferred, D21), the document
// language (D11) and the tradition chips (D32, D43). Each edit is immutable (the original is deep-frozen), returns
// the same profile when it changes nothing and leaves a profile the schema accepts.

const CREATED = new Date("2026-11-21T10:00:00.000Z");
const LATER = new Date("2026-11-21T10:05:00.000Z");
const later = () => LATER;
const TODAY = new Date("2026-11-21T12:00:00.000Z");

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function setup() {
  let n = 0;
  const profile = freeze(createProfile({ newId: () => `id-${++n}`, now: () => CREATED, formLayout: "detailed" }));
  let m = 0;
  const newId = () => `new-${++m}`;
  return { profile, newId };
}

const section = (profile: BiodataProfile, key: string) => profile.sections.find((s) => s.key === key) as FieldsSection;
const keys = (profile: BiodataProfile, key: string) => section(profile, key).fields.map((f) => f.key ?? f.label);
const allKeys = (profile: BiodataProfile) => profile.sections.flatMap((s) => (s.kind === "fields" ? s.fields.map((f) => f.key) : []));
const valid = (profile: BiodataProfile) => expect(profileSchema.safeParse(profile).success).toBe(true);

describe("a new draft's top (D21)", () => {
  it("starts with no motif, no invocation line and no title", () => {
    const { profile } = setup();
    expect(profile.options.motif).toBeNull();
    expect(profile.options.invocation).toBe("");
    expect(titleChoice(profile.options)).toEqual({ kind: "none" });
    expect(DEFAULT_OPTIONS).not.toHaveProperty("titleKey");
    const doc = toDocument(profile, getDocDictionary("en"), TODAY);
    expect(doc.motif).toBeNull();
    expect(doc.invocation).toBeUndefined();
    expect(doc.title).toBeUndefined();
  });
});

describe("setMotif", () => {
  it("sets and clears the motif, sharing the sections", () => {
    const { profile } = setup();
    const next = setMotif(profile, "ganesha", later);
    expect(next.options.motif).toBe("ganesha");
    expect(next.updatedAt).toBe(LATER.toISOString());
    expect(next.sections).toBe(profile.sections);
    valid(next);
    const none = setMotif(next, null, later);
    expect(none.options.motif).toBeNull();
    expect(setMotif(next, "", later).options.motif).toBeNull();
    valid(none);
  });

  it("is a no-op for the motif already chosen", () => {
    const { profile } = setup();
    expect(setMotif(profile, null, later)).toBe(profile);
    const next = setMotif(profile, "om", later);
    expect(setMotif(next, "om", later)).toBe(next);
  });
});

describe("setInvocation", () => {
  it("stores the line exactly as given, so a picked line stays editable", () => {
    const { profile } = setup();
    const line = INVOCATIONS[0].text;
    const next = setInvocation(profile, line, later);
    expect(next.options.invocation).toBe(line);
    const edited = setInvocation(next, `${line} `, later);
    expect(edited.options.invocation).toBe(`${line} `);
    expect(findInvocation(edited.options.invocation)?.id).toBe("shriGaneshaya");
    expect(setInvocation(edited, `${line} `, later)).toBe(edited);
    expect(setInvocation(edited, "", later).options.invocation).toBe("");
    valid(edited);
  });

  it("prints the line trimmed, and nothing for a blank one", () => {
    const { profile } = setup();
    expect(toDocument(setInvocation(profile, "  ॐ ", later), getDocDictionary("te"), TODAY).invocation).toBe("ॐ");
    expect(toDocument(setInvocation(profile, "   ", later), getDocDictionary("en"), TODAY).invocation).toBeUndefined();
  });

  it("offers lines for every group, each with a unique id and text", () => {
    expect(new Set(INVOCATIONS.map((l) => l.id)).size).toBe(INVOCATIONS.length);
    expect(new Set(INVOCATIONS.map((l) => l.text)).size).toBe(INVOCATIONS.length);
    expect(findInvocation("")).toBeUndefined();
    expect(findInvocation("My own line")).toBeUndefined();
  });
});

describe("setTitle", () => {
  it("moves between none, a preset and the user's own words", () => {
    const { profile } = setup();
    const preset = setTitle(profile, { kind: "preset", key: "marriageBiodata" }, later);
    expect(preset.options.titleKey).toBe("marriageBiodata");
    expect(preset.options).not.toHaveProperty("title");
    valid(preset);
    const custom = setTitle(preset, { kind: "custom", text: "" }, later);
    expect(custom.options).not.toHaveProperty("titleKey");
    expect(titleChoice(custom.options)).toEqual({ kind: "custom", text: "" });
    const typed = setTitle(custom, { kind: "custom", text: "Kalyana Patrika" }, later);
    expect(typed.options.title).toBe("Kalyana Patrika");
    valid(typed);
    const none = setTitle(typed, { kind: "none" }, later);
    expect(none.options).not.toHaveProperty("title");
    expect(none.options).not.toHaveProperty("titleKey");
    expect(titleChoice(none.options)).toEqual({ kind: "none" });
  });

  it("is a no-op when nothing changes", () => {
    const { profile } = setup();
    expect(setTitle(profile, { kind: "none" }, later)).toBe(profile);
    const preset = setTitle(profile, { kind: "preset", key: "biodata" }, later);
    expect(setTitle(preset, { kind: "preset", key: "biodata" }, later)).toBe(preset);
    const custom = setTitle(profile, { kind: "custom", text: "x" }, later);
    expect(setTitle(custom, { kind: "custom", text: "x" }, later)).toBe(custom);
  });

  it("prints a preset in the document language and the user's words as typed", () => {
    const { profile } = setup();
    for (const key of TITLE_KEYS) {
      const p = setTitle(profile, { kind: "preset", key }, later);
      expect(toDocument(p, getDocDictionary("en"), TODAY).title).toBe(getDocDictionary("en").titles[key]);
      expect(toDocument(p, getDocDictionary("te"), TODAY).title).toBe(getDocDictionary("te").titles[key]);
    }
    const own = setTitle(profile, { kind: "custom", text: " Our son " }, later);
    expect(toDocument(own, getDocDictionary("hi"), TODAY).title).toBe("Our son");
    expect(toDocument(setTitle(profile, { kind: "custom", text: "" }, later), getDocDictionary("en"), TODAY).title).toBeUndefined();
  });
});

describe("setDocLanguage", () => {
  it("changes the printed labels, never the values (D11)", () => {
    const { profile } = setup();
    const name = section(profile, "personal").fields[0];
    const typed = setFieldValue(profile, name.id, "Sai Teja", later);
    const te = setDocLanguage(typed, "te", later);
    expect(te.docLanguage).toBe("te");
    expect(te.sections).toBe(typed.sections);
    expect(setDocLanguage(te, "te", later)).toBe(te);
    valid(te);
    const doc = toDocument(te, getDocDictionary("te"), TODAY);
    const row = doc.sections[0].items[0];
    expect(row.kind === "row" && row.label).toBe(getDocDictionary("te").fields.fullName);
    expect(row.kind === "row" && row.value).toBe("Sai Teja");
  });
});

describe("tradition chips (D32, D43)", () => {
  it("adds a chip's fields at the end of their sections, empty and shown", () => {
    const { profile, newId } = setup();
    const next = addTraditionFields(profile, "hinduMarathi", newId, later);
    expect(keys(next, "religion").slice(-2)).toEqual(["devak", "kulaDevata"]);
    expect(keys(next, "horoscope").slice(-2)).toEqual(["gan", "nadi"]);
    const devak = section(next, "religion").fields.at(-2);
    expect(devak).toEqual({ id: "new-1", key: "devak", type: "text", value: "", visible: true });
    expect(section(next, "horoscope").fields.at(-1)).toMatchObject({ key: "nadi", type: "select" });
    expect(next.sections.find((s) => s.key === "personal")).toBe(profile.sections.find((s) => s.key === "personal"));
    expect(next.updatedAt).toBe(LATER.toISOString());
    valid(next);
  });

  it("adds nothing the second time, nor a field already anywhere in the draft", () => {
    const { profile, newId } = setup();
    const once = addTraditionFields(profile, "hinduTamil", newId, later);
    expect(addTraditionFields(once, "hinduTamil", newId, later)).toBe(once);
    expect(traditionFieldsToAdd(once, "hinduTamil")).toEqual([]);
    // Telugu shares Lagnam and Dosham with Tamil: only Intiperu is new.
    const telugu = addTraditionFields(once, "hinduTelugu", newId, later);
    expect(allKeys(telugu).filter((k) => k === "lagnam")).toHaveLength(1);
    expect(keys(telugu, "personal").at(-1)).toBe("intiPeru");
    // Gotra is a default field (Horoscope): the Sikh chip adds only its own field.
    const sikh = addTraditionFields(profile, "sikh", newId, later);
    expect(keys(sikh, "religion").slice(-1)).toEqual(["sikhPractice"]);
    expect(allKeys(sikh).filter((k) => k === "gotra")).toHaveLength(1);
  });

  it("puts a field whose section is gone in Religion, then Horoscope, Personal or the first fields section", () => {
    const { profile, newId } = setup();
    const noHoroscope = removeSection(profile, section(profile, "horoscope").id, later);
    const sikh = addTraditionFields(noHoroscope, "sikh", newId, later);
    expect(keys(sikh, "religion").slice(-2)).toEqual(["sikhPractice", "gotra"]);
    const noReligion = removeSection(profile, section(profile, "religion").id, later);
    const christian = addTraditionFields(noReligion, "christian", newId, later);
    expect(keys(christian, "horoscope").slice(-2)).toEqual(["denomination", "church"]);
    const bare: BiodataProfile = { ...profile, sections: profile.sections.filter((s) => s.kind === "family") };
    expect(addTraditionFields(bare, "muslim", newId, later)).toBe(bare);
  });

  it("is undone by removing the fields it added, keeping everything else", () => {
    const { profile } = setup();
    const ids: string[] = [];
    let k = 0;
    const next = addTraditionFields(profile, "muslim", () => {
      const id = `t-${++k}`;
      ids.push(id);
      return id;
    }, later);
    expect(ids).toEqual(["t-1", "t-2"]);
    const name = section(next, "personal").fields[0];
    const typed = setFieldValue(next, name.id, "Ayesha", later);
    const undone = removeFields(typed, ids, later);
    expect(keys(undone, "religion")).toEqual(keys(profile, "religion"));
    expect(section(undone, "personal").fields[0].value).toBe("Ayesha");
    expect(removeFields(undone, ids, later)).toBe(undone);
    expect(removeFields(undone, [], later)).toBe(undone);
  });

  it("has a set for every chip, each field in the catalogue", () => {
    for (const tradition of TRADITIONS) expect(TRADITION_FIELD_SETS[tradition].length).toBeGreaterThan(0);
    const { profile } = setup();
    // A removed tradition field can be added again by its chip.
    let n = 0;
    const withMuslim = addTraditionFields(profile, "muslim", () => `m-${++n}`, later);
    const removed = removeField(withMuslim, "m-1", later);
    expect(traditionFieldsToAdd(removed, "muslim").map((a) => a.key)).toEqual(["muslimSect"]);
  });
});

describe("unselecting a tradition chip (a second tap)", () => {
  const counter = (prefix: string) => {
    let n = 0;
    return () => `${prefix}-${++n}`;
  };

  it("records the chips tapped, so two chips with the same fields are told apart", () => {
    const { profile } = setup();
    expect(appliedTraditions(profile)).toEqual([]);
    const tamil = addTraditionFields(profile, "hinduTamil", counter("t"), later);
    // Hindu – other has the same three fields, but wasn't tapped.
    expect(appliedTraditions(tamil)).toEqual(["hinduTamil"]);
    expect(tamil.options.traditions).toEqual(["hinduTamil"]);
    const both = addTraditionFields(tamil, "hindu", counter("h"), later);
    expect(allKeys(both)).toEqual(allKeys(tamil));
    expect(appliedTraditions(both)).toEqual(["hinduTamil", "hindu"]);
    valid(both);
  });

  it("reads a draft saved before chips were recorded from its fields", () => {
    const { profile } = setup();
    const tamil = addTraditionFields(profile, "hinduTamil", counter("t"), later);
    const legacy = { ...tamil, options: { ...tamil.options, traditions: undefined } };
    expect(appliedTraditions(legacy)).toEqual(["hinduTamil", "hindu"]);
  });

  it("removes the chip's empty fields and forgets it", () => {
    const { profile } = setup();
    const marathi = addTraditionFields(profile, "hinduMarathi", counter("m"), later);
    const off = removeTradition(marathi, "hinduMarathi", later);
    expect(allKeys(off)).toEqual(allKeys(profile));
    expect(appliedTraditions(off)).toEqual([]);
    expect(off.options.traditions).toEqual([]);
    expect(removeTradition(off, "hinduMarathi", later)).toBe(off);
    valid(off);
  });

  it("keeps fields another tapped chip uses, and fields the form has by default", () => {
    const { profile } = setup();
    const telugu = addTraditionFields(profile, "hinduTelugu", counter("te"), later);
    const tamil = addTraditionFields(telugu, "hinduTamil", counter("ta"), later);
    // Tamil off: Kuladeivam goes; Lagnam and Dosham stay for Telugu.
    const off = removeTradition(tamil, "hinduTamil", later);
    expect(allKeys(off).filter((k) => ["lagnam", "dosham", "kulaDevata", "intiPeru"].includes(k!))).toEqual(["intiPeru", "lagnam", "dosham"]);
    expect(appliedTraditions(off)).toEqual(["hinduTelugu"]);
    // Sikh off: its own field goes, the default Gotra stays.
    const sikh = addTraditionFields(profile, "sikh", counter("s"), later);
    const sikhOff = removeTradition(sikh, "sikh", later);
    expect(allKeys(sikhOff)).toEqual(allKeys(profile));
    expect(allKeys(sikhOff)).toContain("gotra");
  });

  it("keeps a field the user typed in, and says which", () => {
    const { profile } = setup();
    const muslim = addTraditionFields(profile, "muslim", counter("mu"), later);
    const typed = setFieldValue(muslim, "mu-2", "Hanafi", later);
    expect(traditionRemoval(typed, "muslim")).toEqual({ remove: ["mu-1"], kept: ["maslak"] });
    const off = removeTradition(typed, "muslim", later);
    expect(allKeys(off)).toContain("maslak");
    expect(allKeys(off)).not.toContain("muslimSect");
    expect(appliedTraditions(off)).toEqual([]);
  });

  it("records a chip whose fields are already all there, but not one with nowhere to put them", () => {
    const { profile } = setup();
    const tamil = addTraditionFields(profile, "hinduTamil", counter("t"), later);
    const untracked = { ...tamil, options: { ...tamil.options, traditions: [] } };
    const other = addTraditionFields(untracked, "hindu", counter("h"), later);
    expect(allKeys(other)).toEqual(allKeys(tamil));
    expect(appliedTraditions(other)).toEqual(["hindu"]);
  });
});
