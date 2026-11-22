import { z } from "zod";
import { migrate } from "@/biodata/migrate";
import { keepPhotoRefs, photoIdsOf } from "@/biodata/photo-refs";
import type { BiodataProfile } from "@/biodata/types";
import type { PhotoInput } from "./profile-repo";

// Backup files (BUILD_PLAN Step 5.1, VISION §9 "Backup format", D8): one JSON file with a manifest and the chosen
// drafts, each with its photos as base64. This module is the pure core: no DOM, no database. It builds the file
// from drafts the repo read and checks one a person picked, and nothing in it is trusted until it has passed:
//
// - the file must say it is this app's backup, in a format version this release reads (older versions are
//   upgraded by BACKUP_UPGRADES; each draft's own schemaVersion by migrate(), the same function the database
//   uses, so a draft opens the same from either);
// - every draft is checked on its own by migrate() and zod (unknown keys dropped, never kept), so one bad draft
//   is skipped with its reason and the others still come in;
// - every picture is decoded and its bytes checked, not its label: JPEG, PNG or WebP by their first bytes, with
//   the size read from the picture's own header, never more than the limits below;
// - text is plain text: control characters are removed and the strings are only ever rendered as text, never as
//   HTML (React escapes them; nothing here builds markup). Prototype keys (`__proto__`) never get through.
// What the file says about ids and revisions is not trusted either: profile-repo's importDrafts decides those.

export const BACKUP_APP = "free-wedding-biodata";
/** The backup file format this code writes and reads. */
export const BACKUP_FORMAT_VERSION = 1;
/** A file larger than this is refused before reading it (about the most an old phone can parse comfortably). */
export const MAX_BACKUP_BYTES = 100 * 1024 * 1024;
export const MAX_BACKUP_DRAFTS = 200;
/** One decoded picture. The editor keeps pictures at 3000 px, a few MB, so this leaves a wide margin. */
export const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
/** One picture's long edge in pixels (the editor stores at most 3000). */
export const MAX_PHOTO_EDGE = 8000;
/** One draft's text, as JSON, after cleaning: a long biodata is a few tens of KB. */
export const MAX_PROFILE_BYTES = 2 * 1024 * 1024;
/** Picture entries read per draft: a draft points at seven pictures at most, so more is not a real backup. */
const MAX_PHOTO_ENTRIES = 32;
/** How deeply nested a draft may be (a real one is about six levels deep). */
const MAX_DEPTH = 16;

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type PhotoType = (typeof PHOTO_TYPES)[number];

// ----------------------------------------------------------------------------------------------- the file

/** A picture inside the file. */
export interface BackupPhotoFile {
  id: string;
  mimeType: string;
  width: number;
  height: number;
  /** The picture's bytes, base64 (RFC 4648, with padding, no line breaks). */
  data: string;
}

export interface BackupDraftFile {
  /** The draft as stored (an older schemaVersion is upgraded on import). */
  profile: BiodataProfile;
  photos: BackupPhotoFile[];
}

export interface BackupFile {
  manifest: {
    app: typeof BACKUP_APP;
    formatVersion: typeof BACKUP_FORMAT_VERSION;
    /** ISO 8601, when the file was made. */
    exportedAt: string;
    draftCount: number;
  };
  drafts: BackupDraftFile[];
}

/** A draft to export: the profile and the pictures the database holds for it. */
export interface BackupEntry {
  profile: BiodataProfile;
  photos: PhotoInput[];
}

/** "Biodata-backup-2026-11-22.json": the day on the person's own clock. */
export function backupFileName(date: Date): string {
  const two = (n: number) => String(n).padStart(2, "0");
  return `Biodata-backup-${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}.json`;
}

/** Lets the browser paint and answer taps between pieces of heavy work. */
const breathe = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
/** Work done between breaths, in bytes. */
const SLICE = 2 * 1024 * 1024;

async function readBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === "function") return new Uint8Array(await blob.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.readAsArrayBuffer(blob);
  });
}

/** Base64 of a picture, in pieces (a multiple of three bytes each, so no padding inside) with breaths between. */
async function toBase64(blob: Blob): Promise<string> {
  const bytes = await readBytes(blob);
  const PIECE = 3 * 8192;
  const parts: string[] = [];
  let sinceBreath = 0;
  for (let i = 0; i < bytes.length; i += PIECE) {
    parts.push(btoa(String.fromCharCode.apply(null, bytes.subarray(i, i + PIECE) as unknown as number[])));
    sinceBreath += PIECE;
    if (sinceBreath >= SLICE) {
      sinceBreath = 0;
      await breathe();
    }
  }
  return parts.join("");
}

/** The draft as the file holds it. Only pictures the draft points at are included. */
async function draftFile({ profile, photos }: BackupEntry): Promise<BackupDraftFile> {
  const used = new Set(photoIdsOf(profile));
  const seen = new Set<string>();
  const files: BackupPhotoFile[] = [];
  for (const photo of photos) {
    if (!used.has(photo.id) || seen.has(photo.id)) continue;
    seen.add(photo.id);
    files.push({ id: photo.id, mimeType: photo.mimeType, width: photo.width, height: photo.height, data: await toBase64(photo.blob) });
  }
  return { profile, photos: files };
}

function manifestOf(count: number, now: Date): BackupFile["manifest"] {
  return { app: BACKUP_APP, formatVersion: BACKUP_FORMAT_VERSION, exportedAt: now.toISOString(), draftCount: count };
}

/**
 * The backup as a plain object, ready for JSON.stringify: a manifest, then each draft with its pictures as base64.
 * (The editor uses buildBackupBlob, which makes the same file without holding every picture's text at once.)
 */
export async function buildBackup(entries: readonly BackupEntry[], now: Date = new Date()): Promise<BackupFile> {
  const drafts: BackupDraftFile[] = [];
  for (const entry of entries) drafts.push(await draftFile(entry));
  return { manifest: manifestOf(entries.length, now), drafts };
}

/**
 * The same file as a Blob, built one draft at a time: each draft's text goes into the Blob (which the browser keeps
 * outside the page's memory) before the next is made, and the work yields to the browser between pieces so the page
 * stays responsive. `onProgress` is told how many drafts are done.
 */
export async function buildBackupBlob(entries: readonly BackupEntry[], now: Date = new Date(), onProgress?: (done: number, total: number) => void): Promise<Blob> {
  const parts: (string | Blob)[] = [`{"manifest":${JSON.stringify(manifestOf(entries.length, now))},"drafts":[`];
  for (const [i, entry] of entries.entries()) {
    if (i) parts.push(",");
    parts.push(new Blob([JSON.stringify(await draftFile(entry))]));
    onProgress?.(i + 1, entries.length);
    await breathe();
  }
  parts.push("]}");
  return new Blob(parts, { type: "application/json" });
}

/** About how big the file will be, in bytes (text as JSON plus the pictures at 4/3 for base64). */
export function estimateBackupBytes(entries: readonly BackupEntry[]): number {
  let total = 120;
  for (const { profile, photos } of entries) {
    const used = new Set(photoIdsOf(profile));
    total += JSON.stringify(profile).length + 40;
    for (const photo of photos) if (used.has(photo.id)) total += Math.ceil((photo.blob.size * 4) / 3) + 160;
  }
  return total;
}

/**
 * `entries` with the open draft as the editor holds it now (the typing the last save didn't carry yet, and a
 * picture added since), so a backup made when saving fails still has the latest. Added to the end when the
 * database had no copy.
 */
export function withOpenDraft(entries: readonly BackupEntry[], open: { profile: BiodataProfile; pendingPhotos: readonly PhotoInput[] }): BackupEntry[] {
  const stored = entries.find((entry) => entry.profile.id === open.profile.id);
  const photos = new Map<string, PhotoInput>();
  for (const photo of [...(stored?.photos ?? []), ...open.pendingPhotos]) photos.set(photo.id, photo);
  const merged: BackupEntry = { profile: open.profile, photos: [...photos.values()] };
  return stored ? entries.map((entry) => (entry === stored ? merged : entry)) : [...entries, merged];
}

// -------------------------------------------------------------------------------------------- checking one

/** Why the whole file is refused (the words are the app dictionary's `backup.reject.<reason>`). */
export type BackupRejection =
  /** Not JSON at all (a photo, a PDF, a text file renamed). */
  | "notJson"
  /** JSON, but not one of this app's backups. */
  | "notBackup"
  /** Made by a newer release than this one. */
  | "tooNew"
  /** Over a size limit: the file, the number of drafts. */
  | "tooBig"
  /** One of ours, but damaged or edited so that nothing in it can be used. */
  | "invalid"
  /** A backup with no drafts in it. */
  | "empty"
  /** The browser couldn't read the file at all (set by the code that reads it, not by parseBackup). */
  | "unreadable";

/** Why one draft is left out. */
export type DraftProblem = "invalid" | "tooNew" | "tooBig" | "duplicate";
/** Why one picture isn't restored (its draft still is). */
export type PhotoProblem = "missing" | "data" | "type" | "size" | "dimensions";

export type BackupWarning =
  | { kind: "draftSkipped"; index: number; name: string; reason: DraftProblem; detail: string }
  | { kind: "photoDropped"; index: number; name: string; reason: PhotoProblem };

export interface ParsedDraft {
  /** Where it was in the file (0 is the first), to match it with its warnings. */
  index: number;
  /** Upgraded to this release's format and validated; unknown keys are gone. Its id and revision are the file's. */
  profile: BiodataProfile;
  /** Checked pictures, as the repo stores them. Only those the profile points at. */
  photos: PhotoInput[];
}

export type ParseResult =
  | {
      ok: true;
      manifest: { formatVersion: number; exportedAt?: string };
      drafts: ParsedDraft[];
      warnings: BackupWarning[];
    }
  | { ok: false; reason: BackupRejection; detail: string };

export interface ParseOptions {
  /** Told how many drafts are checked, so a long check can show progress. */
  onProgress?: (done: number, total: number) => void;
}

/**
 * Upgrades from backup format n to n + 1, keyed by n, each taking and returning the whole file's object. Empty
 * while only format 1 exists; a later format adds its step here, with a fixture test (as migrate.ts does for
 * drafts). The drafts inside are upgraded separately, by migrate().
 */
const BACKUP_UPGRADES: Record<number, (file: Record<string, unknown>) => Record<string, unknown>> = {};

const photoEntrySchema = z.object({ id: z.string().min(1).max(200), mimeType: z.string().max(100), data: z.string() });
const draftEntrySchema = z.object({ profile: z.unknown(), photos: z.array(z.unknown()).max(MAX_PHOTO_ENTRIES).optional() });

const reject = (reason: BackupRejection, detail: string): ParseResult => ({ ok: false, reason, detail });

/** Looks at one value of unknown shape as an object (never an array), or undefined. */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

/**
 * Checks a backup: `input` is the file's text, or its already-parsed JSON. Resolves to the drafts that passed (with
 * a warning for everything left out or dropped) or the reason the whole file is refused. Never throws and never
 * touches the database: the caller shows the preview and only then writes what the person chose.
 */
export async function parseBackup(input: unknown, options: ParseOptions = {}): Promise<ParseResult> {
  let root: unknown = input;
  if (typeof input === "string") {
    if (input.length > MAX_BACKUP_BYTES) return reject("tooBig", `The file is larger than ${MAX_BACKUP_BYTES} bytes`);
    try {
      root = JSON.parse(input.charCodeAt(0) === 0xfeff ? input.slice(1) : input);
    } catch {
      return reject("notJson", "The file is not valid JSON");
    }
  }
  const start = asRecord(root);
  const manifest = asRecord(start?.manifest);
  if (!start || !manifest || manifest.app !== BACKUP_APP) return reject("notBackup", "No manifest from this app");
  let file: Record<string, unknown> = start;

  const version = manifest.formatVersion;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) return reject("invalid", `Unknown backup format ${JSON.stringify(version)}`);
  if (version > BACKUP_FORMAT_VERSION) return reject("tooNew", `Backup format ${version}, but this release reads formats up to ${BACKUP_FORMAT_VERSION}`);
  for (let v = version; v < BACKUP_FORMAT_VERSION; v++) {
    const upgrade = BACKUP_UPGRADES[v];
    if (!upgrade) return reject("invalid", `No upgrade from backup format ${v}`);
    try {
      file = upgrade(file);
    } catch {
      return reject("invalid", `Backup format ${v} could not be upgraded`);
    }
  }

  const list = file.drafts;
  if (!Array.isArray(list)) return reject("invalid", "The file has no list of drafts");
  if (list.length === 0) return reject("empty", "The backup has no drafts in it");
  if (list.length > MAX_BACKUP_DRAFTS) return reject("tooBig", `The backup has ${list.length} drafts; the limit is ${MAX_BACKUP_DRAFTS}`);

  const exported = z.iso.datetime({ offset: true }).safeParse(asRecord(file.manifest)?.exportedAt);
  const drafts: ParsedDraft[] = [];
  const warnings: BackupWarning[] = [];
  const seenIds = new Set<string>();
  let sinceBreath = 0;

  for (const [index, raw] of list.entries()) {
    options.onProgress?.(index, list.length);
    const checked = await checkDraft(raw, index);
    if (checked.ok) {
      const { profile } = checked.draft;
      if (seenIds.has(profile.id)) {
        warnings.push({ kind: "draftSkipped", index, name: profile.draftName.slice(0, 80), reason: "duplicate", detail: `Draft id ${profile.id} appears more than once; the first is kept` });
      } else {
        seenIds.add(profile.id);
        drafts.push(checked.draft);
      }
      warnings.push(...checked.warnings);
    } else {
      warnings.push(checked.warning);
    }
    sinceBreath += 1;
    if (sinceBreath >= 4) {
      sinceBreath = 0;
      await breathe();
    }
  }
  options.onProgress?.(list.length, list.length);

  if (drafts.length === 0) {
    const skipped = warnings.filter((w) => w.kind === "draftSkipped");
    if (skipped.length > 0 && skipped.every((w) => w.reason === "tooNew")) return reject("tooNew", "Every draft was saved by a newer release");
    return reject("invalid", "None of the drafts in the file could be used");
  }
  return { ok: true, manifest: { formatVersion: version, exportedAt: exported.success ? exported.data : undefined }, drafts, warnings };
}

type DraftCheck =
  | { ok: true; draft: ParsedDraft; warnings: BackupWarning[] }
  | { ok: false; warning: Extract<BackupWarning, { kind: "draftSkipped" }> };

async function checkDraft(raw: unknown, index: number): Promise<DraftCheck> {
  const record = asRecord(raw);
  const rawName = asRecord(record?.profile)?.draftName;
  const name = typeof rawName === "string" ? rawName.slice(0, 80) : "";
  const skip = (reason: DraftProblem, detail: string): DraftCheck => ({ ok: false, warning: { kind: "draftSkipped", index, name, reason, detail } });

  const entry = draftEntrySchema.safeParse(raw);
  if (!entry.success) return skip("invalid", "The draft is not an object with a profile");

  let cleaned: unknown;
  try {
    cleaned = cleanText(entry.data.profile, { budget: MAX_PROFILE_BYTES });
  } catch (error) {
    return error instanceof TooBig ? skip("tooBig", "The draft's text is larger than the limit") : skip("invalid", "The draft holds something that is not plain data");
  }
  const result = migrate(cleaned);
  if (!result.ok) return skip(result.error.code === "too-new" ? "tooNew" : "invalid", result.error.message);

  // Pictures the profile points at, from the entries the file holds (the first with an id wins; the rest are noise).
  const files = new Map<string, z.infer<typeof photoEntrySchema>>();
  for (const candidate of entry.data.photos ?? []) {
    const parsed = photoEntrySchema.safeParse(candidate);
    if (parsed.success && !files.has(parsed.data.id)) files.set(parsed.data.id, parsed.data);
  }
  const photos: PhotoInput[] = [];
  const warnings: BackupWarning[] = [];
  for (const id of photoIdsOf(result.profile)) {
    const file = files.get(id);
    const decoded = file ? await decodePhoto(file) : ({ ok: false, reason: "missing" } as const);
    if (decoded.ok) photos.push({ id, ...decoded.photo });
    else warnings.push({ kind: "photoDropped", index, name: result.profile.draftName.slice(0, 80), reason: decoded.reason });
  }
  const kept = new Set(photos.map((photo) => photo.id));
  const profile = warnings.length ? keepPhotoRefs(result.profile, kept) : result.profile;
  return { ok: true, draft: { index, profile, photos }, warnings };
}

// -------------------------------------------------------------------------------------------- plain text

class TooBig extends Error {}

const CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * A copy of plain JSON data with control characters taken out of every string (tab, newline and carriage return
 * stay: a paragraph needs them), `__proto__` keys left out, and nothing but JSON's own kinds of value allowed.
 * Throws TooBig when the strings add up to more than `budget`, and Error for anything that isn't plain data.
 */
function cleanText(value: unknown, state: { budget: number }, depth = 0): unknown {
  if (depth > MAX_DEPTH) throw new Error("Nested too deeply");
  if (typeof value === "string") {
    state.budget -= value.length;
    if (state.budget < 0) throw new TooBig();
    return value.replace(CONTROLS, "");
  }
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Not a number");
    return value;
  }
  if (Array.isArray(value)) {
    state.budget -= value.length * 2;
    if (state.budget < 0) throw new TooBig();
    return value.map((item) => cleanText(item, state, depth + 1));
  }
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value) as unknown;
    if (prototype !== Object.prototype && prototype !== null) throw new Error("Not plain data");
    const entries: [string, unknown][] = [];
    for (const [key, item] of Object.entries(value)) {
      if (key === "__proto__") continue;
      state.budget -= key.length + 4;
      if (state.budget < 0) throw new TooBig();
      entries.push([key, cleanText(item, state, depth + 1)]);
    }
    return Object.fromEntries(entries);
  }
  throw new Error("Not plain data");
}

// ----------------------------------------------------------------------------------------------- pictures

/** The picture type the bytes start with (JPEG, PNG or WebP), or null. The file's label is never used for this. */
export function sniffImageType(bytes: Uint8Array): PhotoType | null {
  const is = (offset: number, ...values: number[]) => values.every((value, i) => bytes[offset + i] === value);
  if (bytes.length >= 3 && is(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (bytes.length >= 8 && is(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (bytes.length >= 12 && is(0, 0x52, 0x49, 0x46, 0x46) && is(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  return null;
}

/** The picture's size in pixels, read from its own header; null when the header is cut short or makes no sense. */
export function imageSize(bytes: Uint8Array, type: PhotoType): { width: number; height: number } | null {
  const u16be = (i: number) => (bytes[i] << 8) | bytes[i + 1];
  const u32be = (i: number) => ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0;
  const text = (i: number, length: number) => String.fromCharCode(...bytes.subarray(i, i + length));
  let size: { width: number; height: number } | null = null;

  if (type === "image/png") {
    if (bytes.length >= 24 && text(12, 4) === "IHDR") size = { width: u32be(16), height: u32be(20) };
  } else if (type === "image/webp") {
    const kind = bytes.length >= 30 ? text(12, 4) : "";
    if (kind === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      size = { width: (bytes[26] | (bytes[27] << 8)) & 0x3fff, height: (bytes[28] | (bytes[29] << 8)) & 0x3fff };
    } else if (kind === "VP8L" && bytes[20] === 0x2f) {
      size = {
        width: 1 + (((bytes[22] & 0x3f) << 8) | bytes[21]),
        height: 1 + (((bytes[24] & 0x0f) << 10) | (bytes[23] << 2) | ((bytes[22] & 0xc0) >> 6)),
      };
    } else if (kind === "VP8X") {
      size = {
        width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)),
        height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)),
      };
    }
  } else {
    // JPEG: walk the markers until the first frame header (SOF), which holds the size.
    let i = 2;
    while (i + 4 <= bytes.length) {
      if (bytes[i] !== 0xff) break;
      const marker = bytes[i + 1];
      if (marker === 0xff) {
        i += 1; // fill byte
        continue;
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2; // markers with no length
        continue;
      }
      if (marker === 0xd9 || marker === 0xda) break; // the picture's data begins with no frame header seen
      const length = u16be(i + 2);
      if (length < 2) break;
      const frame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (frame) {
        if (i + 9 <= bytes.length) size = { width: u16be(i + 7), height: u16be(i + 5) };
        break;
      }
      i += 2 + length;
    }
  }
  return size && size.width > 0 && size.height > 0 ? size : null;
}

/** Base64 to bytes in pieces of 4 characters' multiples, without holding the whole binary string; null if it isn't valid. */
function fromBase64(data: string): Uint8Array | null {
  if (data.length === 0 || data.length % 4 !== 0) return null;
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  const bytes = new Uint8Array((data.length / 4) * 3 - padding);
  const PIECE = 4 * 4096;
  let offset = 0;
  try {
    for (let i = 0; i < data.length; i += PIECE) {
      const binary = atob(data.slice(i, i + PIECE));
      for (let j = 0; j < binary.length; j++) bytes[offset + j] = binary.charCodeAt(j);
      offset += binary.length;
    }
  } catch {
    return null;
  }
  return offset === bytes.length ? bytes : null;
}

type Decoded = { ok: true; photo: Omit<PhotoInput, "id"> } | { ok: false; reason: PhotoProblem };

async function decodePhoto(file: { mimeType: string; data: string }): Promise<Decoded> {
  const type = PHOTO_TYPES.find((candidate) => candidate === file.mimeType);
  if (!type) return { ok: false, reason: "type" };
  // The size the text decodes to, known before decoding it.
  const padding = file.data.endsWith("==") ? 2 : file.data.endsWith("=") ? 1 : 0;
  if ((file.data.length / 4) * 3 - padding > MAX_PHOTO_BYTES) return { ok: false, reason: "size" };
  await breathe();
  const bytes = fromBase64(file.data);
  if (!bytes) return { ok: false, reason: "data" };
  if (sniffImageType(bytes) !== type) return { ok: false, reason: "type" };
  const size = imageSize(bytes, type);
  if (!size || Math.max(size.width, size.height) > MAX_PHOTO_EDGE) return { ok: false, reason: "dimensions" };
  return { ok: true, photo: { blob: new Blob([bytes as BlobPart], { type }), mimeType: type, width: size.width, height: size.height } };
}
