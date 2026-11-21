import { z } from "zod";
import {
  CURRENT_SCHEMA_VERSION,
  DATE_FORMATS,
  FIELD_TYPES,
  HEIGHT_FORMATS,
  LABEL_CASES,
  LANG_CODES,
  MAX_EXTRA_PHOTOS,
  PHOTO_FRAMES,
  PHOTOS_PER_PAGE,
  PHOTO_ROTATIONS,
  TEXT_SIZES,
  type BiodataProfile,
} from "./types";

// The zod schema for a current-version profile, mirroring types.ts exactly. Every database read and every backup
// import goes through migrate(), which ends here, so nothing malformed reaches the editor or the document.
//
// Strict about types, lenient about content: values are any string (typing is never blocked, D6), but every
// structural field must have the right type, enums must be known, and ids must be unique.
//
// Unknown keys are dropped, not rejected (zod's default "strip"), at every level. Backups promise this (VISION §9:
// "Unknown keys are dropped"), and it lets a later release add an optional property without bumping schemaVersion:
// an older copy of the app still opens the draft. Nothing unknown is ever kept and passed to rendering. Data from
// a newer schemaVersion never gets here (migrate() refuses it first), so stripping can't silently lose it.

const id = z.string().min(1);
const isoTimestamp = z.iso.datetime({ offset: true });

export const fieldSchema = z
  .object({
    id,
    key: z.string().min(1).optional(),
    label: z.string().optional(),
    type: z.enum(FIELD_TYPES),
    value: z.string(),
    visible: z.boolean(),
    multiline: z.boolean().optional(),
    optionKey: z.string().min(1).optional(),
    note: z.string().optional(),
    help: z.string().optional(),
  })
  // A custom field has nothing else to be called by.
  .refine((f) => f.key !== undefined || f.label !== undefined, { message: "A field needs a key or a label" });

export const familyMemberSchema = z.object({
  id,
  relationKey: z.string().min(1).optional(),
  relation: z.string(),
  details: z.string(),
  visible: z.boolean(),
});

const sectionBase = {
  id,
  key: z.string().min(1).optional(),
  title: z.string().optional(),
  visible: z.boolean(),
};

export const sectionSchema = z
  .discriminatedUnion("kind", [
    z.object({ ...sectionBase, kind: z.literal("fields"), fields: z.array(fieldSchema) }),
    z.object({ ...sectionBase, kind: z.literal("family"), members: z.array(familyMemberSchema) }),
  ])
  .refine((s) => s.key !== undefined || s.title !== undefined, { message: "A section needs a key or a title" });

export const optionsSchema = z.object({
  showAge: z.boolean(),
  dateFormat: z.enum(DATE_FORMATS),
  heightFormat: z.enum(HEIGHT_FORMATS),
  textSize: z.enum(TEXT_SIZES),
  labelCase: z.enum(LABEL_CASES),
  titleKey: z.string().min(1).optional(),
  title: z.string().optional(),
  motif: z.string().min(1).nullable(),
  invocation: z.string(),
});

export const photoCropSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  zoom: z.number().min(1).max(20),
  rotation: z.literal(PHOTO_ROTATIONS),
});

export const photoRefSchema = z.object({ id, crop: photoCropSchema });

export const profileSchema = z
  .object({
    id,
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    revision: z.int().min(0),
    draftName: z.string(),
    createdAt: isoTimestamp,
    updatedAt: isoTimestamp,
    docLanguage: z.enum(LANG_CODES),
    templateId: id,
    colorId: id,
    options: optionsSchema,
    sections: z.array(sectionSchema),
    photo: photoRefSchema.extend({ frame: z.enum(PHOTO_FRAMES) }).optional(),
    secondPhoto: photoRefSchema.optional(),
    photoPages: z
      .object({
        perPage: z.literal(PHOTOS_PER_PAGE),
        photos: z.array(photoRefSchema).max(MAX_EXTRA_PHOTOS),
      })
      .optional(),
    horoscopeChart: photoRefSchema.optional(),
  })
  .superRefine((profile, ctx) => {
    // Edits find sections, fields, members and photos by id, so a duplicate would make them act on the wrong one.
    const seen = new Set<string>();
    const check = (value: string, path: (string | number)[]) => {
      if (seen.has(value)) ctx.addIssue({ code: "custom", message: `Duplicate id "${value}"`, path });
      seen.add(value);
    };
    profile.sections.forEach((section, s) => {
      check(section.id, ["sections", s, "id"]);
      if (section.kind === "fields") section.fields.forEach((f, i) => check(f.id, ["sections", s, "fields", i, "id"]));
      else section.members.forEach((m, i) => check(m.id, ["sections", s, "members", i, "id"]));
    });
    const photos = new Set<string>();
    const checkPhoto = (value: string, path: (string | number)[]) => {
      if (photos.has(value)) ctx.addIssue({ code: "custom", message: `Duplicate photo id "${value}"`, path });
      photos.add(value);
    };
    if (profile.photo) checkPhoto(profile.photo.id, ["photo", "id"]);
    if (profile.secondPhoto) checkPhoto(profile.secondPhoto.id, ["secondPhoto", "id"]);
    profile.photoPages?.photos.forEach((p, i) => checkPhoto(p.id, ["photoPages", "photos", i, "id"]));
    if (profile.horoscopeChart) checkPhoto(profile.horoscopeChart.id, ["horoscopeChart", "id"]);
  });

// The schema and the hand-written types must describe the same thing; this fails to compile if they drift.
// (schema.test.ts checks that they are exactly equal.)
profileSchema satisfies z.ZodType<BiodataProfile>;
