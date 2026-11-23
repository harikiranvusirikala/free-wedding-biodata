import { SAMPLE_PROFILE } from "../../src/biodata/defaults";
import type { BiodataProfile, Field, LangCode } from "../../src/biodata/types";
import { ENGLISH_PAGE, LONG_ADDRESS, LONG_NAME, SCRIPT_PAGES, type FixturePage } from "./scripts";
import { ownerStyleDraft } from "./simple";

// Document fixtures (BUILD_PLAN Step 3.2): the fictional sample profile in three lengths, for the /dev/document
// page, its e2e screenshots and layout tests. Entirely made up (the 90000 number range is unassigned); nothing
// here comes from docs/references/.
//   short:  a typical one-page biodata (the sample with a few sections and fields hidden) and a motif;
//   sample: SAMPLE_PROFILE exactly as it is (no motif, title or invocation: D21's defaults);
//   long:   the sample plus long paragraphs and more family, a title and an invocation line, no photo;
//   split:  a very long About me and Personal details only, so a paragraph must continue on page 2;
//   mixed:  the short biodata with values typed in other scripts than the page's (Step 4.2), one page;
//   script: a one-page biodata whose values are typed in the page's own language (Step 4.2 part 2, VISION §15),
//           from the script fixture (scripts.ts), optional fields left empty;
//   scriptLong: the same with a 60-character name, a two-line address and three paragraphs of About me;
//   simple: the Simple form's one-page biodata shaped like the owner's (simple.ts), with a photo and the Ganesha
//           symbol: the site's pictures (Step 6.1, e2e/capture.spec.ts).

export type DocLength = "short" | "sample" | "long" | "split" | "mixed" | "script" | "scriptLong" | "simple";

export interface DocVariant {
  id: string;
  templateId: string;
  colorId: string;
  lang: LangCode;
  length: DocLength;
  /** Draw the placeholder photo, and in which frame. */
  photo: "3:4" | "2:3" | null;
  /** Draw the second placeholder photo on page 1 too (Step 4.4, D40; always the tall 2:3 frame). */
  secondPhoto?: boolean;
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
  "floral-ivory": "blush",
  "watercolour-rose": "rose",
  "mango-grove": "mango",
  "mint-vines": "green",
  "baroque-gold": "gold",
  peacock: "teal",
  "peach-filigree": "peach",
  "navy-rosette": "navy",
  sandalwood: "sandal",
  "slate-brush": "slate",
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
  { id: "floral-ivory", colors: ["blush", "lavender", "marigold"], lang: "kn", photo: "2:3" },
  { id: "watercolour-rose", colors: ["rose", "lilac", "coral"], lang: "hi", photo: "3:4" },
  { id: "mango-grove", colors: ["mango", "leaf", "berry"], lang: "ta", photo: "3:4" },
  { id: "mint-vines", colors: ["green", "teal", "olive"], lang: "ml", photo: "3:4" },
  { id: "baroque-gold", colors: ["gold", "maroon", "navy"], lang: "gu", photo: "3:4" },
  { id: "peacock", colors: ["teal", "blue", "emerald"], lang: "mr", photo: "3:4" },
  { id: "peach-filigree", colors: ["peach", "rose", "sage"], lang: "bn", photo: "3:4" },
  { id: "navy-rosette", colors: ["navy", "maroon", "green"], lang: "pa", photo: "3:4" },
  { id: "sandalwood", colors: ["sandal", "rosewood", "tulsi"], lang: "kn", photo: "3:4" },
  { id: "slate-brush", colors: ["slate", "heather", "sage"], lang: "hi", photo: "3:4" },
];

/** How many designs there are (Classic Gold and Minimal Ivory plus NEW_DESIGNS; designs.test checks it against TEMPLATES), for e2e counts. */
export const DESIGN_COUNT = NEW_DESIGNS.length + 2;

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

/**
 * Step 4.4's second photo on page 1 (D40), in every design given (the registry, so a new design is covered): the
 * short biodata in English with both photos, `<id>-en-short-two`; plus, for one design of each skeleton and the
 * letterhead, the same in Telugu and the full sample (more rows, so the second photo stands beside a longer
 * section and pagination is exercised).
 */
export function secondPhotoVariants(templates: readonly { id: string; skeleton: string; colors: readonly { id: string }[] }[]): DocVariant[] {
  const out: DocVariant[] = [];
  const two = (v: DocVariant): DocVariant => {
    v.profile.secondPhoto = { id: "placeholder-second", crop: { x: 0.5, y: 0.5, zoom: 1, rotation: 0 } };
    return { ...v, id: `${v.id}-two`, secondPhoto: true };
  };
  for (const t of templates) {
    const color = t.colors[0].id;
    out.push(two(variant(t.id, color, "en", "short", NEW_DESIGNS.find((d) => d.id === t.id)?.photo ?? "3:4")));
  }
  for (const id of ["classic-gold", "minimal-ivory", "executive-navy", "sandalwood", "slate-brush"]) {
    const t = templates.find((x) => x.id === id);
    if (!t) continue;
    out.push(two(variant(t.id, t.colors[0].id, "te", "short")), two(variant(t.id, t.colors[0].id, "en", "sample")));
  }
  return out;
}

/**
 * The 60-character name of the script fixture (LONG_NAME) as a Telugu family would write it on a biodata in each
 * language: the same fictional person, so the length is comparable, and each script's conjuncts (క్ష్మ, ङ्क, ਕ੍ਰਿ …).
 */
export const LONG_NAMES: Record<LangCode, string> = {
  en: LONG_NAME,
  te: "వెంకట సత్య సాయి లక్ష్మీ నరసింహ తేజ మండపాటి రామకృష్ణ",
  hi: "वेंकट सत्य साई लक्ष्मी नरसिंह तेजा मंडपाटि रामकृष्ण",
  ta: "வேங்கட சத்ய சாய் லக்ஷ்மி நரசிம்ம தேஜா மண்டபாடி ராமகிருஷ்ணா",
  kn: "ವೆಂಕಟ ಸತ್ಯ ಸಾಯಿ ಲಕ್ಷ್ಮೀ ನರಸಿಂಹ ತೇಜ ಮಂಡಪಾಟಿ ರಾಮಕೃಷ್ಣ",
  ml: "വെങ്കട സത്യ സായി ലക്ഷ്മി നരസിംഹ തേജ മണ്ഡപാടി രാമകൃഷ്ണ",
  mr: "वेंकट सत्य साई लक्ष्मी नरसिंह तेजा मंडपाटी रामकृष्ण",
  gu: "વેંકટ સત્ય સાઈ લક્ષ્મી નરસિંહ તેજા મંડપાટી રામકૃષ્ણ",
  bn: "ভেঙ্কট সত্য সাই লক্ষ্মী নরসিংহ তেজা মণ্ডপাটি রামকৃষ্ণ",
  pa: "ਵੈਂਕਟ ਸਤਿਆ ਸਾਈ ਲਕਸ਼ਮੀ ਨਰਸਿੰਘ ਤੇਜਾ ਮੰਡਪਾਟੀ ਰਾਮਕ੍ਰਿਸ਼ਨ",
};

/** The script fixture's rows by field: Indian-language pages share one row order, the English page has more rows. */
function fixtureValues(page: FixturePage) {
  const [personal, family] = page.sections;
  const row = (rows: FixturePage["sections"][number]["rows"], i: number) => ({ label: rows[i][0], value: rows[i][1] });
  if (page.lang === "en") {
    const byLabel = (rows: FixturePage["sections"][number]["rows"], label: string) => row(rows, rows.findIndex(([l]) => l === label));
    return {
      name: byLabel(personal.rows, "Name").value,
      born: byLabel(personal.rows, "Date of Birth"),
      place: byLabel(personal.rows, "Place of Birth").value,
      education: byLabel(personal.rows, "Education").value,
      work: byLabel(personal.rows, "Profession").value,
      father: byLabel(family.rows, "Father").value,
      mother: byLabel(family.rows, "Mother").value,
      address: byLabel(page.sections[2].rows, "Address").value,
      phone: byLabel(page.sections[2].rows, "Phone").value,
      about: page.about!.paragraphs.slice(0, 1),
    };
  }
  return {
    name: row(personal.rows, 0).value,
    born: row(personal.rows, 1),
    place: row(personal.rows, 2).value,
    education: row(personal.rows, 3).value,
    work: row(personal.rows, 4).value,
    father: row(family.rows, 0).value,
    mother: row(family.rows, 1).value,
    address: row(family.rows, 2).value,
    phone: row(family.rows, 3).value,
    about: page.about!.paragraphs,
  };
}

/**
 * A biodata typed in the page's own language (Step 4.2 part 2, VISION §15): name, a date of birth typed as text in
 * the script's digits, birth place, education and work in Personal details, father and mother, address and phone,
 * and About me, all from the script fixture (each language's shaping stress: conjuncts, reph, pre-base vowel signs,
 * ZWJ/ZWNJ, chillu letters, Indic digits, English inside Indic text). Every other field is left empty and so is
 * left out (VISION §15: missing optional fields), and the sections that end up empty don't print.
 */
function makeScript(p: BiodataProfile, lang: LangCode, long: boolean): BiodataProfile {
  const page = lang === "en" ? ENGLISH_PAGE : SCRIPT_PAGES.find((s) => s.lang === lang)!;
  const v = fixtureValues(page);
  const byKey = (key: string) => p.sections.find((s) => s.key === key);
  for (const f of fields(p)) {
    f.value = "";
    delete f.optionKey;
  }
  const personal = byKey("personal");
  if (personal?.kind !== "fields") throw new Error("the sample has Personal details");
  // Birth place, qualification and occupation in Personal details, in the fixture's order.
  for (const key of ["birthPlace", "highestQualification", "occupation"]) {
    for (const s of p.sections) {
      if (s.kind !== "fields" || s === personal) continue;
      const at = s.fields.findIndex((f) => f.key === key);
      if (at >= 0) personal.fields.push(...s.fields.splice(at, 1));
    }
  }
  const set = (key: string, value: string, extra: Partial<Field> = {}) => {
    const field = fields(p).find((f) => f.key === key);
    if (!field) throw new Error(`no ${key} field`);
    Object.assign(field, { value, visible: true }, extra);
  };
  set("fullName", long ? LONG_NAMES[lang] : v.name);
  set("birthPlace", v.place);
  set("highestQualification", v.education);
  set("occupation", v.work);
  set("phone", v.phone);
  // The long address: the script's own, then the fixture's long English one (the English page's is that one already).
  const twoLines = long && lang !== "en";
  set("address", twoLines ? `${v.address}\n${LONG_ADDRESS}` : v.address, twoLines ? { multiline: true } : {});
  set("aboutMe", long ? [...v.about, ...v.about, ...v.about].join("\n\n") : v.about.join("\n\n"));
  // The date typed as text in the page's digits (౨౨-ఆగస్టు-౧౯౯౭), as families do, in a field of their own.
  const name = personal.fields.findIndex((f) => f.key === "fullName");
  personal.fields.splice(name + 1, 0, { id: "script-born", label: v.born.label, type: "text", value: v.born.value, visible: true });
  const family = byKey("family");
  if (family?.kind === "family") {
    family.members = family.members.filter((m) => m.relationKey === "father" || m.relationKey === "mother");
    for (const m of family.members) m.details = m.relationKey === "father" ? v.father : v.mother;
  }
  for (const s of p.sections) if (s.key === "references") s.visible = false;
  p.options.showAge = false;
  p.options.motif = long ? null : "ganesha";
  return p;
}

/** The long script biodatas' designs, in turn: one of each other skeleton and both letterheads (Classic has the short ones). */
const SCRIPT_LONG_DESIGNS = ["minimal-ivory", "executive-navy", "sandalwood", "modern-two-column", "slate-brush"] as const;

/**
 * Step 4.2 part 2: the ten document languages, each typed in its own script: `classic-gold-<lang>-script` (one page,
 * with the photo and a motif) and `<design>-<lang>-scriptLong` in a design of another skeleton (long name, two-line
 * address, three paragraphs, with the photo), for the fixture PDFs (e2e/pdf.spec.ts) and their review.
 */
export function scriptVariants(templates: readonly { id: string; colors: readonly { id: string }[] }[]): DocVariant[] {
  const langs: LangCode[] = ["en", "te", "hi", "ta", "kn", "ml", "mr", "gu", "bn", "pa"];
  return langs.flatMap((lang, i) => {
    const designId = SCRIPT_LONG_DESIGNS[i % SCRIPT_LONG_DESIGNS.length];
    const design = templates.find((t) => t.id === designId)!;
    const make = (templateId: string, colorId: string, long: boolean): DocVariant => {
      const profile = makeScript(base(templateId, lang, colorId), lang, long);
      profile.photo = { id: "placeholder", frame: "3:4", crop: { x: 0.5, y: 0.5, zoom: 1, rotation: 0 } };
      return { id: `${templateId}-${lang}-${long ? "scriptLong" : "script"}`, templateId, colorId, lang, length: long ? "scriptLong" : "script", photo: "3:4", profile };
    };
    return [make("classic-gold", "gold", false), make(design.id, design.colors[0].id, true)];
  });
}

/**
 * Step 6.1: the Simple form's biodata (the four Simple sections, shaped like the owner's) in every design given, as
 * the site's pictures show it: `<id>-en-simple` in each design's first colour, plus Classic Gold in Telugu and
 * Deepam in its dark colour.
 */
export function simpleVariants(templates: readonly { id: string; colors: readonly { id: string }[] }[]): DocVariant[] {
  const make = (templateId: string, colorId: string, lang: LangCode, suffix = ""): DocVariant => {
    const profile = ownerStyleDraft(`simple-${templateId}-${lang}${suffix}`, (p) => {
      p.templateId = templateId;
      p.colorId = colorId;
      p.docLanguage = lang;
      p.options.motif = "ganesha";
    });
    const photo = NEW_DESIGNS.find((d) => d.id === templateId)?.photo ?? "3:4";
    profile.photo = { id: "placeholder", frame: photo, crop: { x: 0.5, y: 0.5, zoom: 1, rotation: 0 } };
    return { id: `${templateId}-${lang}-simple${suffix}`, templateId, colorId, lang, length: "simple", photo, profile };
  };
  return [
    ...templates.map((t) => make(t.id, t.colors[0].id, "en")),
    make("classic-gold", "gold", "te"),
    make("deepam", "night", "en", "-night"),
  ];
}
