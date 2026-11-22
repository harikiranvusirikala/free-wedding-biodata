import { SAMPLE_PROFILE } from "../../src/biodata/defaults";
import type { BiodataProfile, Field, LangCode } from "../../src/biodata/types";

// Document fixtures (BUILD_PLAN Step 3.2): the fictional sample profile in three lengths, for the /dev/document
// page, its e2e screenshots and layout tests. Entirely made up (the 90000 number range is unassigned); nothing
// here comes from docs/references/.
//   short:  a typical one-page biodata (the sample with a few sections and fields hidden) and a motif;
//   sample: SAMPLE_PROFILE exactly as it is (no motif, title or invocation: D21's defaults);
//   long:   the sample plus long paragraphs and more family, a title and an invocation line, no photo;
//   split:  a very long About me and Personal details only, so a paragraph must continue on page 2;
//   mixed:  the short biodata with values typed in other scripts than the page's (Step 4.2), one page.

export type DocLength = "short" | "sample" | "long" | "split" | "mixed";

export interface DocVariant {
  id: string;
  templateId: string;
  colorId: string;
  lang: LangCode;
  length: DocLength;
  /** Draw the placeholder photo, and in which frame. */
  photo: "3:4" | "2:3" | null;
  profile: BiodataProfile;
}

const LONG_ABOUT = [
  "I grew up in Guntur in a close family where Sunday lunch was the event of the week, and I still try to keep",
  "that habit wherever I live. After engineering I moved to Hyderabad for work, where I build software that helps",
  "small shops keep their accounts.",
  "Outside work I cook a lot, mostly Andhra food my mother taught me over the phone, and I am slowly learning",
  "to bake bread. I play cricket with old college friends on weekends, read history and travel books, and I have",
  "been learning the veena for two years, badly but happily.",
  "\n\nI would like a home where both of us have room to grow, where we share the work of the house, and where",
  "both families feel welcome.",
].join(" ").replace(/ \n\n/g, "\n\n");

const LONG_EXPECTATIONS =
  "Someone kind, family-minded and independent, who enjoys travel and simple living, and who values honesty " +
  "and respect for both families. Working or not is her choice; we would like to live in Hyderabad or " +
  "Bengaluru. Caste no bar.";

const LONG_FAMILY_INFO =
  "We are a family of teachers and engineers. My grandfather started the village school library, and my " +
  "parents still help run it on weekends. We visit our native village for Sankranti every year.";

function base(templateId: string, lang: LangCode, colorId: string): BiodataProfile {
  const p = structuredClone(SAMPLE_PROFILE) as BiodataProfile;
  p.templateId = templateId;
  p.colorId = colorId;
  p.docLanguage = lang;
  return p;
}

function fields(p: BiodataProfile) {
  return p.sections.flatMap((s) => (s.kind === "fields" ? s.fields : []));
}

/**
 * A typical one-page biodata, shaped like the printed ones families use (structure only): education and work in
 * Personal details beside the photo, then horoscope, family, contact and a short partner paragraph, a motif on top.
 */
function makeShort(p: BiodataProfile): BiodataProfile {
  const byKey = (key: string) => p.sections.find((s) => s.key === key);
  // Move qualification, designation, company and work place into Personal details, as many real biodatas do.
  const personal = byKey("personal");
  for (const [from, keys] of [
    ["education", ["highestQualification", "college"]],
    ["career", ["designation", "employer", "workLocation"]],
  ] as const) {
    const source = byKey(from);
    if (personal?.kind !== "fields" || source?.kind !== "fields") continue;
    const moved = source.fields.filter((f) => f.key && (keys as readonly string[]).includes(f.key));
    source.fields = source.fields.filter((f) => !moved.includes(f));
    personal.fields.push(...moved);
  }
  for (const s of p.sections) {
    if (["aboutMe", "religion", "education", "career", "familyBackground", "references"].includes(s.key ?? "")) s.visible = false;
  }
  const hide = new Set([
    "gender",
    "nationality",
    "currentCity",
    "nakshatraPada",
    "manglik",
    "contactPerson",
    "contactRelation",
    "alternatePhone",
    "email",
    "partnerAgeRange",
    "partnerHeightRange",
    "partnerEducation",
    "partnerOccupation",
    "partnerLocation",
  ]);
  for (const f of fields(p)) if (f.key && hide.has(f.key)) f.visible = false;
  p.options.showAge = false;
  p.options.dateFormat = "d-month-yyyy";
  p.options.motif = "ganesha";
  return p;
}

function makeLong(p: BiodataProfile, lang: LangCode): BiodataProfile {
  for (const f of fields(p)) {
    if (f.key === "aboutMe") f.value = LONG_ABOUT;
    if (f.key === "partnerExpectations") f.value = LONG_EXPECTATIONS;
    if (f.key === "otherFamilyInfo") f.value = LONG_FAMILY_INFO;
  }
  const family = p.sections.find((s) => s.key === "family");
  if (family?.kind === "family") {
    family.members.push(
      { id: "long-gf", relationKey: "grandfather", relation: "", details: "(Late) Mandapati Subba Rao, Farmer, Guntur", visible: true },
    );
  }
  p.options.titleKey = "marriageBiodata";
  p.options.invocation = lang === "te" ? "శ్రీరస్తు · శుభమస్తు · అవిఘ్నమస్తు" : "|| Shri Ganeshaya Namah ||";
  return p;
}

/**
 * Values typed in other scripts than the page's (BUILD_PLAN Steps 2.0 and 4.2; the help page promises any script
 * prints as typed): a Telugu name, a Kannada native place, a Hindi address, a Telugu label, a Gurmukhi note, a
 * Tamil + English section title, Bengali in a family row, Malayalam and Gujarati in a paragraph, and a list of
 * languages in four scripts. The sample's own English labels ("Blood group", "Company") stay, so an Indic page
 * also shows bold English labels.
 */
function makeMixed(p: BiodataProfile): BiodataProfile {
  const set = (key: string, change: Partial<Field>) => {
    const field = fields(p).find((f) => f.key === key);
    if (field) Object.assign(field, change);
  };
  set("fullName", { value: "రవి తేజ మండపాటి" });
  set("nativePlace", { value: "ಉಡುಪಿ (Udupi)" });
  set("address", { value: "फ्लैट 402, सैंपल रेजीडेंसी,\nहैदराबाद – 500081", multiline: true });
  set("phone", { note: "ਪਿਤਾ ਜੀ" });
  set("gotra", { label: "గోత్రం" });
  set("partnerExpectations", { value: "Someone kind and family-minded. ദയയും ക്ഷമയും ഉള്ള ഒരാൾ. ગુજરાતી પણ ચાલે." });
  const personal = p.sections.find((s) => s.key === "personal");
  if (personal?.kind === "fields") {
    personal.fields.push({ id: "mixed-languages", label: "Languages", type: "text", value: "తెలుగు, ಕನ್ನಡ, हिन्दी, English", visible: true });
  }
  const family = p.sections.find((s) => s.key === "family");
  if (family?.kind === "family") {
    family.title = "குடும்பம் / Family";
    const mother = family.members.find((m) => m.relationKey === "mother");
    if (mother) mother.details = "মন্ডপাটি লক্ষ্মী, Homemaker";
  }
  return p;
}

function makeSplit(p: BiodataProfile): BiodataProfile {
  for (const s of p.sections) if (s.key !== "aboutMe" && s.key !== "personal") s.visible = false;
  for (const f of fields(p)) if (f.key === "aboutMe") f.value = Array.from({ length: 7 }, () => LONG_ABOUT).join("\n\n");
  return p;
}

/** Each design's first (default) colour: a variant in it has no colour part in its id. */
const DEFAULT_COLOR: Record<string, string> = {
  "classic-gold": "gold",
  "minimal-ivory": "ink",
  kalyanam: "maroon",
  "temple-bells": "maroon",
  rangoli: "rose",
  paisley: "copper",
  "royal-maroon": "maroon",
  deepam: "maroon",
  "executive-navy": "navy",
  "modern-two-column": "teal",
};

/**
 * The Step 4.3 designs: default colour, the other two colours, one more Indic language each (so every script is
 * seen in a new design) and the photo frame each is drawn for.
 */
export const NEW_DESIGNS: readonly { id: string; colors: readonly [string, string, string]; lang: LangCode; photo: "3:4" | "2:3" }[] = [
  { id: "kalyanam", colors: ["maroon", "saffron", "leaf"], lang: "hi", photo: "3:4" },
  { id: "temple-bells", colors: ["maroon", "amber", "blue"], lang: "ta", photo: "3:4" },
  { id: "rangoli", colors: ["rose", "violet", "marigold"], lang: "kn", photo: "3:4" },
  { id: "paisley", colors: ["copper", "maroon", "teal"], lang: "ml", photo: "2:3" },
  { id: "royal-maroon", colors: ["maroon", "purple", "wine"], lang: "mr", photo: "3:4" },
  { id: "deepam", colors: ["maroon", "purple", "night"], lang: "gu", photo: "3:4" },
  { id: "executive-navy", colors: ["navy", "forest", "plum"], lang: "bn", photo: "3:4" },
  { id: "modern-two-column", colors: ["teal", "amber", "rose"], lang: "pa", photo: "3:4" },
];

function variant(templateId: string, colorId: string, lang: LangCode, length: DocLength, photo: DocVariant["photo"] = "3:4"): DocVariant {
  let profile = base(templateId, lang, colorId);
  if (length === "short" || length === "mixed") profile = makeShort(profile);
  if (length === "mixed") profile = makeMixed(profile);
  if (length === "long") profile = makeLong(profile, lang);
  if (length === "split") profile = makeSplit(profile);
  const usedPhoto = length === "long" || length === "split" ? null : photo;
  if (usedPhoto) profile.photo = { id: "placeholder", frame: usedPhoto, crop: { x: 0.5, y: 0.5, zoom: 1, rotation: 0 } };
  const colorPart = DEFAULT_COLOR[templateId] === colorId ? "" : `-${colorId}`;
  return { id: `${templateId}-${lang}-${length}${colorPart}`, templateId, colorId, lang, length, photo: usedPhoto, profile };
}

/**
 * Every variant the dev page shows: Classic Gold and Minimal Ivory × en/te × three lengths and their other colours,
 * plus the Step 4.3 designs (NEW_DESIGNS).
 */
export function documentVariants(): DocVariant[] {
  const out: DocVariant[] = [];
  for (const [templateId, colorId] of [
    ["classic-gold", "gold"],
    ["minimal-ivory", "ink"],
  ] as const) {
    for (const lang of ["en", "te"] as const) {
      for (const length of ["short", "sample", "long"] as const) {
        // One tall 2:3 frame, so both photo shapes are seen.
        out.push(variant(templateId, colorId, lang, length, templateId === "classic-gold" && lang === "te" && length === "short" ? "2:3" : "3:4"));
      }
    }
  }
  out.push(variant("classic-gold", "rose", "en", "short"), variant("classic-gold", "sage", "en", "short"));
  out.push(variant("minimal-ivory", "maroon", "en", "short"), variant("minimal-ivory", "navy", "en", "short"));
  out.push(variant("classic-gold", "gold", "en", "split"), variant("classic-gold", "gold", "te", "split"), variant("minimal-ivory", "ink", "en", "split"));
  // Step 4.3: each new design short and long in English, short in Telugu and in one more Indic language, and short
  // in its other two colours; the Modern skeleton also split across pages.
  for (const d of NEW_DESIGNS) {
    const [first, ...others] = d.colors;
    out.push(
      variant(d.id, first, "en", "short", d.photo),
      variant(d.id, first, "en", "long", d.photo),
      variant(d.id, first, "te", "short", d.photo),
      variant(d.id, first, d.lang, "short", d.photo),
      ...others.map((c) => variant(d.id, c, "en", "short", d.photo)),
    );
  }
  out.push(variant("executive-navy", "navy", "en", "split"));
  return out;
}

/**
 * Step 4.2's mixed-script variants: an English page in Classic Gold and Minimal Ivory (the name as the large
 * header), a Kannada page (bold English labels beside Telugu and Hindi values) and a Tamil page in the Modern
 * skeleton (the name and contact in the side panel).
 */
export function mixedScriptVariants(): DocVariant[] {
  return [
    variant("classic-gold", "gold", "en", "mixed"),
    variant("minimal-ivory", "ink", "en", "mixed"),
    variant("classic-gold", "gold", "kn", "mixed"),
    variant("modern-two-column", "teal", "ta", "mixed"),
  ];
}

/** The fixed "today" for fixtures, so ages don't change from run to run. */
export const FIXTURE_TODAY = new Date(2026, 10, 21);
