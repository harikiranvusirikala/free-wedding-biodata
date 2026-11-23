import { createProfile } from "../../src/biodata/defaults";
import type { BiodataProfile, Field } from "../../src/biodata/types";

// A Simple-form biodata shaped like the owner's (Step 4.5 specs, the /dev/document "simple" variants and the site's
// pictures, Step 6.1): a Simple-form draft like the one the owner made for M1 (the four Simple sections, a
// photo beside Personal details, a long family list), with entirely fictional data (VISION D29; phone numbers in the
// unassigned +91 90000 range). Never copy a value from docs/references/ here.

const VALUES: Record<string, Partial<Pick<Field, "value" | "optionKey">>> = {
  fullName: { value: "Sai Teja Mandapati" },
  dateOfBirth: { value: "1998-01-13" },
  birthTime: { value: "22:55" },
  birthPlace: { value: "Hyderabad" },
  nakshatra: { value: "Pushya (3rd Pada)" },
  rashi: { value: "Karka", optionKey: "karka" },
  caste: { value: "Sample Community" },
  gotra: { value: "Bharadwaja" },
  maternalGotra: { value: "Kashyapa" },
  height: { value: "173" },
  complexion: { value: "Fair" },
  highestQualification: { value: "B.Tech (Computer Science), Sample Institute of Engineering (A)" },
  occupation: { value: "Software Engineer (L3), Example Technologies, Hyderabad" },
  annualIncome: { value: "24 LPA" },
  phone: { value: "+91 90000 00001" },
  address: { value: "5-8-8, Sample Street, Guntur, Andhra Pradesh - 500001" },
  partnerExpectations: { value: "A kind, well-educated and family-minded girl who is cheerful and supportive, and who respects tradition while staying open to new ideas." },
};

const FAMILY: { relationKey?: string; relation?: string; details: string }[] = [
  { relationKey: "father", details: "Mandapati Venkata Rao, Sri Sai Traders, +91 90000 00003" },
  { relationKey: "mother", details: "Mandapati Lakshmi (Home Maker), +91 90000 00004" },
  { relationKey: "elderBrother", details: "Mandapati Rahul (M.S., Sample University), Staff Engineer at Example Labs, California, US" },
  { relationKey: "sisterInLaw", details: "Mandapati Anitha, Senior Software Engineer at Example Cloud, California, US" },
  { relationKey: "grandfather", details: "(Late) Mandapati Narayana Murthy (Nani Garu)" },
  { relationKey: "fatherInLaw", details: "Example Srinivas, Hyderabad, +91 90000 00005" },
];

/** The owner's-style Simple draft: personal, family, contact and partner preferences filled in. */
export function ownerStyleDraft(id: string, change?: (profile: BiodataProfile) => void): BiodataProfile {
  let n = 0;
  const profile = createProfile({ newId: () => `${id}-${++n}`, now: () => new Date("2026-11-22T09:00:00.000Z"), formLayout: "simple" });
  profile.id = id;
  profile.revision = 1;
  for (const section of profile.sections) {
    if (section.kind === "fields") {
      for (const field of section.fields) {
        const values = field.key ? VALUES[field.key] : undefined;
        if (values) Object.assign(field, values);
      }
    } else if (section.key === "family") {
      section.members = FAMILY.map((m) => ({ id: `${id}-m${++n}`, relationKey: m.relationKey, relation: m.relation ?? "", details: m.details, visible: true }));
    }
  }
  change?.(profile);
  return profile;
}


/** The five tradition pages' samples (Step 6.1 part 2, D36): a tradition, its symbol (our own drawings, none awaiting review). */
export const TRADITION_SAMPLES = ["hindu", "muslim", "christian", "sikh", "jain"] as const;
export type TraditionSample = (typeof TRADITION_SAMPLES)[number];

/** Each tradition's own fictional family (entirely made up; phone numbers in the unassigned +91 90000 range). */
const TRADITION_PEOPLE: Record<Exclude<TraditionSample, "hindu">, {
  motif: string | null;
  name: string;
  place: string;
  /** Hidden rows the tradition doesn't print. */
  hide: string[];
  /** Fields the tradition chip adds, with their values, after Personal details' first rows. */
  add: { key: string; value: string; optionKey?: string }[];
  family: { relationKey: string; details: string }[];
  address: string;
  partner: string;
}> = {
  muslim: {
    motif: "crescentStar",
    name: "Mohammed Imran Shaikh",
    place: "Hyderabad",
    hide: ["birthTime", "nakshatra", "rashi", "caste", "gotra", "maternalGotra"],
    add: [
      { key: "muslimSect", value: "Sunni", optionKey: "sunni" },
      { key: "maslak", value: "Hanafi" },
    ],
    family: [
      { relationKey: "father", details: "Shaikh Abdul Rahman, Retired Lecturer, +91 90000 00003" },
      { relationKey: "mother", details: "Shaikh Fathima (Home Maker), +91 90000 00004" },
      { relationKey: "elderBrother", details: "Shaikh Salman, Civil Engineer, Dubai" },
      { relationKey: "elderSister", details: "Ayesha Siddiqui (M.Sc), Teacher, Hyderabad (married)" },
    ],
    address: "4-1-22, Sample Nagar, Hyderabad, Telangana - 500001",
    partner: "A kind, educated and practising girl from a respectful family, who values faith, family and simple living.",
  },
  christian: {
    motif: "cross",
    name: "Joseph Daniel Kommu",
    place: "Secunderabad",
    hide: ["birthTime", "nakshatra", "rashi", "caste", "gotra", "maternalGotra"],
    add: [
      { key: "denomination", value: "Protestant", optionKey: "protestant" },
      { key: "church", value: "Sample CSI Church, Secunderabad" },
    ],
    family: [
      { relationKey: "father", details: "Kommu David, Retired Headmaster, +91 90000 00003" },
      { relationKey: "mother", details: "Kommu Mary Grace, Staff Nurse, +91 90000 00004" },
      { relationKey: "youngerSister", details: "Kommu Esther, Software Engineer, Pune" },
    ],
    address: "12, Sample Church Road, Secunderabad, Telangana - 500003",
    partner: "A God-fearing, kind and well-educated girl who loves family and serving others.",
  },
  sikh: {
    motif: "ikOnkar",
    name: "Harpreet Singh Gill",
    place: "Ludhiana",
    hide: ["birthTime", "nakshatra", "rashi", "caste", "maternalGotra"],
    add: [{ key: "sikhPractice", value: "Keshdhari", optionKey: "keshdhari" }],
    family: [
      { relationKey: "father", details: "S. Kirpal Singh Gill, Agriculture, Ludhiana, +91 90000 00003" },
      { relationKey: "mother", details: "S. Parkash Kaur (Home Maker), +91 90000 00004" },
      { relationKey: "elderBrother", details: "Gurpreet Singh Gill, Doctor, Toronto, Canada" },
    ],
    address: "House 45, Sample Nagar, Ludhiana, Punjab - 141001",
    partner: "A well-educated, cheerful girl from a Gursikh family, who respects tradition and is open to new ideas.",
  },
  jain: {
    motif: null,
    name: "Rohan Sunil Mehta",
    place: "Ahmedabad",
    hide: ["birthTime", "nakshatra", "rashi", "maternalGotra"],
    add: [{ key: "jainSect", value: "Shwetambar", optionKey: "shwetambar" }],
    family: [
      { relationKey: "father", details: "Sunil Mehta, Textile Business, Ahmedabad, +91 90000 00003" },
      { relationKey: "mother", details: "Meena Mehta (Home Maker), +91 90000 00004" },
      { relationKey: "youngerSister", details: "Riya Mehta, Chartered Accountant, Mumbai" },
    ],
    address: "B-402, Sample Residency, Ahmedabad, Gujarat - 380001",
    partner: "A well-educated, vegetarian girl from a Jain family, who is cheerful and close to her family.",
  },
};

/**
 * A tradition page's sample: the owner-style Simple biodata (Hindu, with the Ganesha picture), or another family's,
 * printing what that tradition's chip adds (TRADITION_FIELD_SETS) and leaving out what it doesn't print.
 */
export function traditionDraft(id: string, tradition: TraditionSample): BiodataProfile {
  if (tradition === "hindu") return ownerStyleDraft(id, (p) => (p.options.motif = "ganesha"));
  const who = TRADITION_PEOPLE[tradition];
  return ownerStyleDraft(id, (p) => {
    p.options.motif = who.motif;
    let n = 0;
    for (const section of p.sections) {
      if (section.kind === "fields") {
        for (const field of section.fields) {
          if (field.key && who.hide.includes(field.key)) field.visible = false;
          if (field.key === "fullName") field.value = who.name;
          if (field.key === "birthPlace") field.value = who.place;
          if (field.key === "address") field.value = who.address;
          if (field.key === "partnerExpectations") field.value = who.partner;
          if (field.key === "gotra" && tradition === "sikh") field.value = "Gill";
          if (field.key === "gotra" && tradition === "jain") field.value = "Kashyap";
          if (field.key === "caste" && tradition === "jain") field.value = "Oswal";
        }
        if (section.key === "personal") {
          const at = section.fields.findIndex((f) => f.key === "height");
          const added = who.add.map((a) => ({ id: `${id}-t${++n}`, key: a.key, type: (a.optionKey ? "select" : "text") as Field["type"], value: a.value, visible: true, ...(a.optionKey ? { optionKey: a.optionKey } : {}) }));
          section.fields.splice(at, 0, ...added);
        }
      } else if (section.key === "family") {
        section.members = who.family.map((m) => ({ id: `${id}-f${++n}`, relationKey: m.relationKey, relation: "", details: m.details, visible: true }));
      }
    }
  });
}
