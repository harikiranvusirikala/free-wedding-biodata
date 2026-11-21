import {
  CURRENT_SCHEMA_VERSION,
  type BiodataProfile,
  type FamilyMember,
  type Field,
  type FieldType,
  type LangCode,
  type ProfileOptions,
  type Section,
} from "./types";

// What a new draft starts with (VISION §6, D28, D39), the field catalogue every default field comes from, the
// option lists behind select fields (D33), the extra field sets the editor offers as chips (D32, D43), the
// References quick pick (D44), and a fictional sample profile.
//
// Everything here is data keyed by stable keys; labels, help text and placeholders come from the dictionaries
// (src/i18n/doc for printed labels, src/i18n/app for the editor) by the same keys. Nothing is ever pre-selected or
// inferred from another field: every value starts empty (§6), and religious options stay "None" (D21).

/** Makes a new id. Injected so tests get predictable ids; the app uses crypto.randomUUID(). */
export type NewId = () => string;
/** The current time. Injected so tests get fixed timestamps. */
export type Clock = () => Date;

export const newUuid: NewId = () => crypto.randomUUID();
export const systemClock: Clock = () => new Date();

/**
 * Option keys for select fields, printed in the document language from the dictionary (D33). Lists are read from
 * here by field key rather than stored in each draft, so a list fixed or extended later reaches existing drafts.
 * A select field always accepts a typed value too (§6), so the lists only save typing and needn't be exhaustive.
 */
export const OPTION_LISTS = {
  gender: ["male", "female"],
  maritalStatus: ["neverMarried", "divorced", "widowed", "awaitingDivorce"],
  motherTongue: [
    "telugu",
    "hindi",
    "tamil",
    "kannada",
    "malayalam",
    "marathi",
    "gujarati",
    "bengali",
    "punjabi",
    "urdu",
    "odia",
    "konkani",
    "english",
  ],
  religion: ["hindu", "muslim", "christian", "sikh", "jain", "buddhist"],
  rashi: [
    "mesha",
    "vrishabha",
    "mithuna",
    "karka",
    "simha",
    "kanya",
    "tula",
    "vrishchika",
    "dhanu",
    "makara",
    "kumbha",
    "meena",
  ],
  nakshatra: [
    "ashwini",
    "bharani",
    "krittika",
    "rohini",
    "mrigashira",
    "ardra",
    "punarvasu",
    "pushya",
    "ashlesha",
    "magha",
    "purvaPhalguni",
    "uttaraPhalguni",
    "hasta",
    "chitra",
    "swati",
    "vishakha",
    "anuradha",
    "jyeshtha",
    "mula",
    "purvaAshadha",
    "uttaraAshadha",
    "shravana",
    "dhanishta",
    "shatabhisha",
    "purvaBhadrapada",
    "uttaraBhadrapada",
    "revati",
  ],
  pada: ["1", "2", "3", "4"],
  manglik: ["yes", "no", "partial"],
  employmentType: ["privateSector", "government", "business", "selfEmployed", "notWorking"],
  familyType: ["nuclear", "joint"],
  familyValues: ["traditional", "moderate", "liberal"],
  muslimSect: ["sunni", "shia"],
  denomination: ["catholic", "protestant", "orthodox"],
  sikhPractice: ["amritdhari", "keshdhari", "sahajdhari"],
  jainSect: ["digambar", "shwetambar"],
} as const satisfies Record<string, readonly string[]>;

export type OptionListId = keyof typeof OPTION_LISTS;

interface FieldDef {
  type: FieldType;
  /** The option list of a select field. */
  options?: OptionListId;
  /** A row whose value may wrap (an address), as opposed to a `textarea` paragraph. */
  multiline?: true;
}

/**
 * Every default field, by key. The key is also the dictionary key for its printed label and the editor's help and
 * example text. Default sections, "Restore default fields" (Step 2.2) and the tradition chips all build fields
 * from here, so one key always means one kind of field.
 */
export const FIELD_CATALOG = {
  // Personal details (the §6 "Profile" row lives here: the title is options.title, the photo is profile.photo)
  fullName: { type: "text" },
  gender: { type: "select", options: "gender" },
  dateOfBirth: { type: "date" },
  height: { type: "height" },
  maritalStatus: { type: "select", options: "maritalStatus" },
  nationality: { type: "text" },
  motherTongue: { type: "select", options: "motherTongue" },
  currentCity: { type: "text" },
  nativePlace: { type: "text" },
  // Religion and community
  religion: { type: "select", options: "religion" },
  community: { type: "text" },
  caste: { type: "text" },
  subCaste: { type: "text" },
  // Horoscope (D28: Nakshatra pada and maternal Gotra are default fields)
  birthTime: { type: "time" },
  birthPlace: { type: "text" },
  rashi: { type: "select", options: "rashi" },
  nakshatra: { type: "select", options: "nakshatra" },
  nakshatraPada: { type: "select", options: "pada" },
  gotra: { type: "text" },
  maternalGotra: { type: "text" },
  manglik: { type: "select", options: "manglik" },
  // Education
  highestQualification: { type: "text" },
  university: { type: "text" },
  college: { type: "text" },
  additionalQualifications: { type: "text" },
  // Career
  occupation: { type: "text" },
  designation: { type: "text" },
  employer: { type: "text" },
  employmentType: { type: "select", options: "employmentType" },
  workLocation: { type: "text" },
  annualIncome: { type: "text" },
  // Family background (family type and values live here because the Family section is a relation list, D28)
  familyType: { type: "select", options: "familyType" },
  familyValues: { type: "select", options: "familyValues" },
  familyOrigin: { type: "text" },
  residence: { type: "text" },
  otherFamilyInfo: { type: "textarea" },
  // About me (one paragraph, §6)
  aboutMe: { type: "textarea" },
  // Partner preferences: rows plus a free paragraph (D44 lets it print as rows or a paragraph)
  partnerAgeRange: { type: "text" },
  partnerHeightRange: { type: "text" },
  partnerEducation: { type: "text" },
  partnerOccupation: { type: "text" },
  partnerLocation: { type: "text" },
  partnerExpectations: { type: "textarea" },
  // Contact
  contactPerson: { type: "text" },
  contactRelation: { type: "text" },
  phone: { type: "phone" },
  alternatePhone: { type: "phone" },
  email: { type: "email" },
  address: { type: "text", multiline: true },
  // Tradition chips only (D32, D43), never added by default
  lagnam: { type: "select", options: "rashi" },
  dosham: { type: "text" },
  kulaDevata: { type: "text" },
  muslimSect: { type: "select", options: "muslimSect" },
  denomination: { type: "select", options: "denomination" },
  church: { type: "text" },
  sikhPractice: { type: "select", options: "sikhPractice" },
  jainSect: { type: "select", options: "jainSect" },
} as const satisfies Record<string, FieldDef>;

export type FieldKey = keyof typeof FIELD_CATALOG;

const isFieldKey = (key: string): key is FieldKey => Object.hasOwn(FIELD_CATALOG, key);

/** The option keys a field offers, or none for a custom field or one without a list. */
export function optionsFor(field: Pick<Field, "key">): readonly string[] | undefined {
  if (field.key === undefined || !isFieldKey(field.key)) return undefined;
  const def: FieldDef = FIELD_CATALOG[field.key];
  return def.options ? OPTION_LISTS[def.options] : undefined;
}

/**
 * Relation suggestions for the Family and References lists (D28, D44), printed in the document language when
 * picked. The relation stays free text: anything else is typed and printed as typed.
 */
export const RELATION_KEYS = [
  "father",
  "mother",
  "elderBrother",
  "youngerBrother",
  "elderSister",
  "youngerSister",
  "brotherInLaw",
  "sisterInLaw",
  "grandfather",
  "grandmother",
  "paternalUncle",
  "maternalUncle",
  "paternalAunt",
  "maternalAunt",
  "uncle",
  "aunt",
  "fatherInLaw",
  "motherInLaw",
  "cousin",
] as const;

export type RelationKey = (typeof RELATION_KEYS)[number];

/** A section a draft can start with or add: its key is also the dictionary key of its title. */
export type SectionDef =
  | { key: string; kind: "fields"; fields: readonly FieldKey[] }
  | { key: string; kind: "family"; members: readonly RelationKey[] };

/**
 * The sections of a new draft, in the default reading order (D39: About me first, then Personal details,
 * Horoscope, Education and career, Family, Contact, Partner preferences), with §6's other default sections in
 * their natural places. Fields are §6's, minus complexion (never a default field) and age (computed, D13).
 */
export const DEFAULT_SECTIONS: readonly SectionDef[] = [
  { key: "aboutMe", kind: "fields", fields: ["aboutMe"] },
  {
    key: "personal",
    kind: "fields",
    fields: [
      "fullName",
      "gender",
      "dateOfBirth",
      "height",
      "maritalStatus",
      "nationality",
      "motherTongue",
      "currentCity",
      "nativePlace",
    ],
  },
  { key: "religion", kind: "fields", fields: ["religion", "community", "caste", "subCaste"] },
  {
    key: "horoscope",
    kind: "fields",
    fields: ["birthTime", "birthPlace", "rashi", "nakshatra", "nakshatraPada", "gotra", "maternalGotra", "manglik"],
  },
  {
    key: "education",
    kind: "fields",
    fields: ["highestQualification", "university", "college", "additionalQualifications"],
  },
  {
    key: "career",
    kind: "fields",
    fields: ["occupation", "designation", "employer", "employmentType", "workLocation", "annualIncome"],
  },
  // Father and Mother pre-added; everyone else is added freely (D28).
  { key: "family", kind: "family", members: ["father", "mother"] },
  {
    key: "familyBackground",
    kind: "fields",
    fields: ["familyType", "familyValues", "familyOrigin", "residence", "otherFamilyInfo"],
  },
  {
    key: "contact",
    kind: "fields",
    fields: ["contactPerson", "contactRelation", "phone", "alternatePhone", "email", "address"],
  },
  {
    key: "partnerPreferences",
    kind: "fields",
    fields: [
      "partnerAgeRange",
      "partnerHeightRange",
      "partnerEducation",
      "partnerOccupation",
      "partnerLocation",
      "partnerExpectations",
    ],
  },
];

/** Ready-made sections in "Add a section" (D44), not in a new draft. References: people who vouch for the family. */
export const QUICK_PICK_SECTIONS: readonly SectionDef[] = [{ key: "references", kind: "family", members: [] }];

export const TRADITIONS = ["hindu", "muslim", "christian", "sikh", "jain"] as const;
export type Tradition = (typeof TRADITIONS)[number];

/**
 * The one-tap chips inside Religion and Horoscope ("Add Hindu fields"…, D32 as refined by D43). Only ever added
 * when the user taps one, never inferred from the Religion value; a field already in the draft is skipped. A
 * starting list for Step 2.0 to review; the General set is simply the default sections.
 */
export const TRADITION_FIELD_SETS: Record<Tradition, readonly { section: string; field: FieldKey }[]> = {
  hindu: [
    { section: "horoscope", field: "lagnam" },
    { section: "horoscope", field: "dosham" },
    { section: "religion", field: "kulaDevata" },
  ],
  muslim: [{ section: "religion", field: "muslimSect" }],
  christian: [
    { section: "religion", field: "denomination" },
    { section: "religion", field: "church" },
  ],
  sikh: [{ section: "religion", field: "sikhPractice" }],
  jain: [{ section: "religion", field: "jainSect" }],
};

/** A new, empty, visible default field. A keyed field has no label: it comes from the dictionary. */
export function createField(key: FieldKey, newId: NewId = newUuid): Field {
  const def: FieldDef = FIELD_CATALOG[key];
  const field: Field = { id: newId(), key, type: def.type, value: "", visible: true };
  if (def.multiline) field.multiline = true;
  return field;
}

/** A new section from its definition, with fresh ids throughout. */
export function createSection(def: SectionDef, newId: NewId = newUuid): Section {
  if (def.kind === "fields") {
    const fields = def.fields.map((k) => createField(k, newId));
    return { id: newId(), kind: "fields", key: def.key, visible: true, fields };
  }
  return {
    id: newId(),
    kind: "family",
    key: def.key,
    visible: true,
    members: def.members.map((relationKey) => ({ id: newId(), relationKey, relation: "", details: "", visible: true })),
  };
}

export const DEFAULT_TEMPLATE_ID = "classic-gold";
export const DEFAULT_COLOR_ID = "gold";

/** Age is opt-in (D13); dates DD-MM-YYYY (D14); text size Auto (D31); no title, motif or invocation (D21). */
export const DEFAULT_OPTIONS: Readonly<ProfileOptions> = {
  showAge: false,
  dateFormat: "dd-mm-yyyy",
  heightFormat: "ft-in",
  textSize: "auto",
  labelCase: "normal",
  motif: null,
  invocation: "",
};

export interface CreateProfileOptions {
  newId?: NewId;
  now?: Clock;
  draftName?: string;
  docLanguage?: LangCode;
}

/** A new draft with the default sections, all empty. Revision 0 = never saved (persistence bumps it on save). */
export function createProfile({
  newId = newUuid,
  now = systemClock,
  draftName = "",
  docLanguage = "en",
}: CreateProfileOptions = {}): BiodataProfile {
  const timestamp = now().toISOString();
  return {
    id: newId(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    revision: 0,
    draftName,
    createdAt: timestamp,
    updatedAt: timestamp,
    docLanguage,
    templateId: DEFAULT_TEMPLATE_ID,
    colorId: DEFAULT_COLOR_ID,
    options: { ...DEFAULT_OPTIONS },
    sections: DEFAULT_SECTIONS.map((def) => createSection(def, newId)),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The sample ("Open a sample", Step 2.3; template previews, Step 6.1). Entirely fictional: phone numbers are in the
// unassigned +91 90000 0000x range and the address is made up. Never copy anything from docs/references/ here.

/** Picked values keep their English text as the fallback (types.ts, Field.optionKey). */
type SampleValue = string | Pick<Field, "value" | "optionKey" | "note">;

const SAMPLE_VALUES: Partial<Record<FieldKey, SampleValue>> = {
  aboutMe:
    "I am a calm and cheerful person who enjoys cooking, weekend cricket and Carnatic music. I value honesty, " +
    "time with family and keeping my word, and I am looking for a partner who is kind and curious about the world.",
  fullName: "Sai Teja Mandapati",
  gender: { value: "Male", optionKey: "male" },
  dateOfBirth: "1996-08-14",
  height: "178",
  maritalStatus: { value: "Never married", optionKey: "neverMarried" },
  nationality: "Indian",
  motherTongue: { value: "Telugu", optionKey: "telugu" },
  currentCity: "Hyderabad",
  nativePlace: "Guntur",
  religion: { value: "Hindu", optionKey: "hindu" },
  birthTime: "06:45",
  birthPlace: "Guntur",
  rashi: { value: "Simha", optionKey: "simha" },
  nakshatra: { value: "Magha", optionKey: "magha" },
  nakshatraPada: { value: "2", optionKey: "2" },
  gotra: "Bharadwaja",
  maternalGotra: "Kashyapa",
  manglik: { value: "No", optionKey: "no" },
  highestQualification: "B.Tech (Computer Science)",
  university: "Sample Technological University",
  college: "Sample Institute of Engineering, Guntur",
  additionalQualifications: "Cloud developer certification",
  occupation: "Software Engineer",
  designation: "Senior Software Engineer",
  employer: "Example Technologies Pvt. Ltd.",
  employmentType: { value: "Private sector", optionKey: "privateSector" },
  workLocation: "Hyderabad",
  annualIncome: "₹ 18 lakh per year",
  familyType: { value: "Nuclear", optionKey: "nuclear" },
  familyValues: { value: "Traditional", optionKey: "traditional" },
  familyOrigin: "Guntur, Andhra Pradesh",
  residence: "Own house in Guntur",
  contactPerson: "Mandapati Venkata Rao",
  contactRelation: "Father",
  phone: "+91 90000 00001",
  alternatePhone: { value: "+91 90000 00002", note: "Mother" },
  email: "saiteja.sample@example.com",
  address: "Plot 12, Sample Colony, Guntur, Andhra Pradesh",
  partnerAgeRange: "25 to 29 years",
  partnerHeightRange: "5 ft 2 in and above",
  partnerEducation: "Graduate or above",
  partnerOccupation: "Working or not, her choice",
  partnerLocation: "Hyderabad or Bengaluru preferred",
  partnerExpectations:
    "Someone kind, family-minded and independent, who enjoys travel and simple living. Caste no bar.",
};

function buildSample(): BiodataProfile {
  let n = 0;
  const newId: NewId = () => `sample-${++n}`;
  const profile = createProfile({
    newId,
    now: () => new Date("2026-11-21T09:00:00.000Z"),
    draftName: "Sample: Sai Teja Mandapati",
  });
  profile.options.showAge = true;

  for (const section of profile.sections) {
    if (section.kind === "family") {
      // Father and Mother, then wider family as real biodatas list it (D28).
      const member = (relationKey: RelationKey, details: string) =>
        ({ id: newId(), relationKey, relation: "", details, visible: true }) satisfies FamilyMember;
      section.members = [
        member("father", "Mandapati Venkata Rao, Retired Headmaster, Guntur"),
        member("mother", "Mandapati Lakshmi, Homemaker"),
        member("elderSister", "Sravani Kolli, Software Tester, Bengaluru (married)"),
        member("brotherInLaw", "Kolli Ravi Kumar, Bank Officer, Bengaluru"),
      ];
      continue;
    }
    for (const field of section.fields) {
      const sample = field.key && isFieldKey(field.key) ? SAMPLE_VALUES[field.key] : undefined;
      if (sample === undefined) continue;
      if (typeof sample === "string") field.value = sample;
      else Object.assign(field, sample);
    }
  }

  // A renamed default field, a custom field and a hidden field, so previews exercise each (§6).
  const personal = profile.sections.find((s) => s.key === "personal");
  const career = profile.sections.find((s) => s.key === "career");
  if (personal?.kind === "fields") {
    personal.fields.push({ id: newId(), label: "Blood group", type: "text", value: "B+", visible: true });
  }
  if (career?.kind === "fields") {
    const income = career.fields.find((f) => f.key === "annualIncome");
    if (income) income.visible = false;
    const employer = career.fields.find((f) => f.key === "employer");
    if (employer) employer.label = "Company";
  }

  // The References quick pick (D44), added at the end as a user would.
  const references = createSection(QUICK_PICK_SECTIONS[0], newId);
  if (references.kind === "family") {
    references.members.push({
      id: newId(),
      relationKey: "maternalUncle",
      relation: "",
      details: "Pothuri Srinivas, Textile Business, Vijayawada, +91 90000 00003",
      visible: true,
    });
  }
  profile.sections.push(references);
  return profile;
}

/** Frozen all the way down, so nothing can change the shared sample by accident. */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/** A complete fictional profile with fixed ids. Copy it (structuredClone) and give it a new id before saving. */
export const SAMPLE_PROFILE: BiodataProfile = deepFreeze(buildSample());
