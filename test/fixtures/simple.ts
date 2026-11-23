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

