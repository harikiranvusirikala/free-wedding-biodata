// The biodata profile: one draft, as saved in IndexedDB and in backups (BUILD_PLAN A3, VISION §6, §18).
// Pure types only. Printed labels are never stored here: a default field or section carries a `key` and its label
// comes from the document dictionary (src/i18n/doc/<lang>.json), so switching the document language relabels
// everything. Only what the user typed (values, renamed labels, custom fields) is stored as text.

/** The ten document languages (VISION §8, D11). The editor itself is English at launch (D23). */
export const LANG_CODES = ["en", "te", "hi", "ta", "kn", "ml", "mr", "gu", "bn", "pa"] as const;
export type LangCode = (typeof LANG_CODES)[number];

export const FIELD_TYPES = ["text", "textarea", "date", "time", "select", "height", "phone", "email"] as const;
/**
 * The input a field uses. `textarea` is a paragraph (About me, Partner expectations), printed as a short block;
 * `text` with `multiline` is a row whose value may wrap onto several lines (an address).
 */
export type FieldType = (typeof FIELD_TYPES)[number];

export interface Field {
  /** crypto.randomUUID(), stable forever: edits, moves and the editor's focus all follow it. */
  id: string;
  /** Default fields only (e.g. "dateOfBirth"): gives the dictionary label, the help text and the option list. */
  key?: string;
  /**
   * The user's own label. Absent on a default field until it is renamed (a blank one also falls back to the
   * dictionary label when printed); always present on a custom field, which has no key.
   */
  label?: string;
  type: FieldType;
  /** Always a string, so typing is never blocked (D6): dates "YYYY-MM-DD", time "HH:mm" (24 h), height in cm. */
  value: string;
  /** Hidden fields keep their value; they are only left out of the document (§6). */
  visible: boolean;
  /** Display style for `text` fields: let the value wrap (§6 "single line or multiline"). */
  multiline?: boolean;
  /**
   * Set when the value was picked from the field's option list (D33): the key is printed in the document language
   * and wins over `value`, which keeps the typed text as a fallback. Typing clears it. The lists themselves are not
   * stored; they come from the field's key (OPTION_LISTS in defaults.ts), so new options reach old drafts.
   */
  optionKey?: string;
  /** A short note printed after the value, e.g. the relation on a second phone number, "(Mother)" (D44). */
  note?: string;
  /** Help text on a custom field. Default fields get theirs from the app dictionary by key. */
  help?: string;
}

/**
 * One row of a relation list (D28): the relation is printed as the label, the details (name, occupation, place,
 * phone) as the value. Used by the Family section and by the References section (D44).
 */
export interface FamilyMember {
  id: string;
  /** A relation picked from the suggestions (e.g. "father"), printed in the document language like D33's options. */
  relationKey?: string;
  /** The relation as typed. Ignored when `relationKey` is set; typing a relation clears the key. */
  relation: string;
  details: string;
  visible: boolean;
}

/** What the sections share. A section with a `key` takes its title from the dictionary unless `title` is set. */
interface SectionBase {
  id: string;
  key?: string;
  title?: string;
  visible: boolean;
}

/** Label/value rows: every section except the relation lists. */
export interface FieldsSection extends SectionBase {
  kind: "fields";
  fields: Field[];
}

/** A relation list (D28): Family, and References from the "Add a section" quick picks (D44). */
export interface FamilySection extends SectionBase {
  kind: "family";
  members: FamilyMember[];
}

export type Section = FieldsSection | FamilySection;

export const DATE_FORMATS = ["dd-mm-yyyy", "d month yyyy", "d-month-yyyy"] as const;
/**
 * A stored date style. Kept for compatibility only, and ignored: every biodata prints dates as dd-mm-yyyy (D14; the
 * Dates choice of D53 was withdrawn). Drafts and backups saved with another value still validate and open, with no
 * format bump and no rewrite.
 */
export type DateFormat = (typeof DATE_FORMATS)[number];

export const HEIGHT_FORMATS = ["ft-in", "cm", "ft-in-cm"] as const;
/** Height is stored in cm and printed the way the user picks (§6, D13): 5' 10", 178 cm, or both. */
export type HeightFormat = (typeof HEIGHT_FORMATS)[number];

export const TEXT_SIZES = ["auto", "xs", "s", "m", "l", "xl"] as const;
/** Auto = the largest size that fits one page, never below 9 pt body (D31). */
export type TextSize = (typeof TEXT_SIZES)[number];

export const LABEL_CASES = ["normal", "upper"] as const;
export type LabelCase = (typeof LABEL_CASES)[number];

export const LABEL_STYLES = ["standard", "telugu"] as const;
/**
 * The wording of the printed English labels: "standard" (Nakshatra, Rashi, Gotra, Maternal Gotra) or "telugu", the
 * four words Telugu families use in English (Star, Raasi, Swagothram, Maternal Gothram); every other label stays
 * standard. Only English pages use it; every other document language prints its own dictionary whatever the style
 * is. Absent = standard.
 */
export type LabelStyle = (typeof LABEL_STYLES)[number];

export const FORM_LAYOUTS = ["simple", "detailed"] as const;
/**
 * Which set of default sections and fields the draft follows (D50): Simple (four sections, the fields most biodatas
 * print; new drafts) or Detailed (every default section; drafts saved before D50). It decides where the editor's
 * switch puts fields and what "Restore default fields" brings back; the sections themselves are always stored.
 */
export type FormLayout = (typeof FORM_LAYOUTS)[number];

export interface ProfileOptions {
  /** Print the age computed from the date of birth on the day the document is made (opt-in, D13). */
  showAge: boolean;
  /** Kept for compatibility and ignored: dates always print dd-mm-yyyy (see DateFormat). */
  dateFormat: DateFormat;
  heightFormat: HeightFormat;
  textSize: TextSize;
  labelCase: LabelCase;
  /** English label wording (see LabelStyle). Added without a format bump: absent in older drafts and new ones = standard. */
  labelStyle?: LabelStyle;
  /** Simple or Detailed form (D50). Drafts saved before it was added read as "detailed" (schema default). */
  formLayout: FormLayout;
  /** A preset title (e.g. "biodata"), printed in the document language (D45). Neither this nor `title` = no title. */
  titleKey?: string;
  /** A title the user typed, printed exactly as typed. Ignored when `titleKey` is set. */
  title?: string;
  /** Motif id from the motif library, or null for "None", the default (D21). Never inferred. */
  motif: string | null;
  /** The invocation line as text ("" = none, the default). Picked lines are copied in so they stay editable (§7). */
  invocation: string;
  /**
   * The "details common in your family" chips the user has tapped (D32, D43; ids from TRADITIONS), so a second tap
   * can unselect one. Absent in drafts saved before it was added: read from the fields then (appliedTraditions).
   */
  traditions?: string[];
}

export const PHOTO_ROTATIONS = [0, 90, 180, 270] as const;

/**
 * Where the picture sits in its frame (D12): the centre of the frame as fractions of the source image's width and
 * height (0–1), zoom 1 = the image just covers the frame, and a quarter-turn rotation. Drawn at render time, so
 * re-cropping never loses quality.
 */
export interface PhotoCrop {
  x: number;
  y: number;
  zoom: number;
  rotation: (typeof PHOTO_ROTATIONS)[number];
}

/** A picture whose image lives in the database's photos table under `id` (never inside the profile). */
export interface PhotoRef {
  id: string;
  crop: PhotoCrop;
}

export const PHOTO_FRAMES = ["3:4", "2:3"] as const;
/** The main photo's frame: portrait 3:4 or tall 2:3 for full-length photos (D30, D40). */
export type PhotoFrame = (typeof PHOTO_FRAMES)[number];

/** The main photo on page 1 (D12, D40), with its frame shape. */
export interface MainPhoto extends PhotoRef {
  frame: PhotoFrame;
}

export const PHOTOS_PER_PAGE = [1, 2, 4] as const;
/**
 * Photo pages hold at most this many extra photos. VISION D40 said 4; the owner agreed to 8 (Step 4.2b), since
 * families send frequently changing pictures. Relaxing a maximum needs no format bump: older drafts hold fewer.
 */
export const MAX_EXTRA_PHOTOS = 8;

/** The extra photos printed on pages after the biodata (D40), 1, 2 or 4 to a page. */
export interface PhotoPages {
  perPage: (typeof PHOTOS_PER_PAGE)[number];
  photos: PhotoRef[];
  /**
   * False: the photos stay in the draft but print nothing (Step 4.2b: switch the pages off without deleting the
   * pictures). Absent = true, so drafts saved before the switch print their pages as they did.
   */
  include?: boolean;
}

/** A photo or scan of the horoscope chart (D41), printed as its own framed page; `include` works as for PhotoPages. */
export interface HoroscopeChart extends PhotoRef {
  include?: boolean;
}

/** The saved format's version this code reads and writes. migrate() upgrades older ones and refuses newer ones. */
export const CURRENT_SCHEMA_VERSION = 1;

export interface BiodataProfile {
  id: string;
  /** A profile in memory is always the current version: older saved ones are upgraded by migrate() on read. */
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  /** +1 on every save, owned by persistence (D9): a tab holding an older revision stops autosaving. */
  revision: number;
  /** Shown in the drafts menu; "" until the user names it (the menu then shows the full name or a placeholder). */
  draftName: string;
  /** ISO 8601 timestamps. */
  createdAt: string;
  updatedAt: string;
  /** The language of the printed labels (D11). Values are always printed as typed. */
  docLanguage: LangCode;
  /** Design and colour variant ids (D39, D46). An id that no longer exists falls back at render time, never here. */
  templateId: string;
  colorId: string;
  options: ProfileOptions;
  /** Array order is display order (no separate order numbers). */
  sections: Section[];
  photo?: MainPhoto;
  /** An optional second photo on page 1 (D40). */
  secondPhoto?: PhotoRef;
  /** Up to MAX_EXTRA_PHOTOS photos on their own pages, 1, 2 or 4 to a page (D40). */
  photoPages?: PhotoPages;
  /** A photo or scan of the horoscope chart, printed as its own framed page (D41). */
  horoscopeChart?: HoroscopeChart;
}
