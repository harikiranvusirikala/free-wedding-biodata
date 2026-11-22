import { describe, expect, it } from "vitest";
import { createProfile } from "@/biodata/defaults";
import type { BiodataProfile } from "@/biodata/types";
import {
  BACKUP_APP,
  BACKUP_FORMAT_VERSION,
  MAX_BACKUP_BYTES,
  MAX_BACKUP_DRAFTS,
  MAX_PHOTO_BYTES,
  backupFileName,
  buildBackup,
  buildBackupBlob,
  estimateBackupBytes,
  imageSize,
  parseBackup,
  sniffImageType,
  withOpenDraft,
  type BackupEntry,
} from "./backup";
import type { PhotoInput } from "./profile-repo";

// ------------------------------------------------------------------------------------------- fixtures

const NOW = new Date("2026-11-22T10:30:00.000Z");
let counter = 0;
const newId = () => `id-${++counter}`;

const crop = { x: 0.5, y: 0.5, zoom: 1, rotation: 0 } as const;

function draft(name: string, change: (profile: BiodataProfile) => void = () => undefined): BiodataProfile {
  const profile = createProfile({ draftName: name, newId, now: () => new Date("2026-11-20T08:00:00.000Z") });
  change(profile);
  return profile;
}

const b64 = (bytes: ArrayLike<number>) => btoa(String.fromCharCode(...Array.from(bytes)));
const bytesOf = (...parts: number[][]) => new Uint8Array(parts.flat());
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

/** A 1 x 1 PNG: the signature, an IHDR and an end chunk (the checks read the header, not the pixels). */
const PNG = bytesOf([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], [0, 0, 0, 13], ascii("IHDR"), [0, 0, 0, 48, 0, 0, 0, 64, 8, 2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], ascii("IEND"), [0, 0, 0, 0]);
/** A JPEG header with a frame of 48 x 64 (height 0x40, width 0x30). */
const JPEG = bytesOf([0xff, 0xd8, 0xff, 0xe0, 0, 16], ascii("JFIF"), [0, 1, 1, 0, 0, 1, 0, 1, 0, 0], [0xff, 0xc0, 0, 17, 8, 0, 0x40, 0, 0x30, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1], [0xff, 0xd9]);
/** A lossless WebP of 100 x 200. */
const WEBP_L = bytesOf(ascii("RIFF"), [30, 0, 0, 0], ascii("WEBPVP8L"), [10, 0, 0, 0], [0x2f], [99, (199 & 3) << 6, (199 >> 2) & 0xff, (199 >> 10) & 0x0f], [0, 0, 0, 0, 0, 0]);
/** An extended WebP of 640 x 480. */
const WEBP_X = bytesOf(ascii("RIFF"), [30, 0, 0, 0], ascii("WEBPVP8X"), [10, 0, 0, 0], [0, 0, 0, 0], [639 & 255, 639 >> 8, 0], [479 & 255, 479 >> 8, 0]);
/** A lossy WebP of 320 x 240. */
const WEBP_Y = bytesOf(ascii("RIFF"), [30, 0, 0, 0], ascii("WEBPVP8 "), [10, 0, 0, 0], [0, 0, 0], [0x9d, 0x01, 0x2a], [320 & 255, 320 >> 8, 240 & 255, 240 >> 8]);

const photoOf = (id: string, bytes: Uint8Array, mimeType = "image/jpeg"): PhotoInput => ({ id, blob: new Blob([bytes as BlobPart], { type: mimeType }), mimeType, width: 48, height: 64 });

/** A draft with a main photo and the entry for it. */
function withPhoto(name: string, photoId = "photo-1", bytes = JPEG): BackupEntry {
  const profile = draft(name, (p) => {
    p.photo = { id: photoId, frame: "3:4", crop };
  });
  return { profile, photos: [photoOf(photoId, bytes)] };
}

/** The backup as the file's text. */
async function fileOf(entries: BackupEntry[]): Promise<string> {
  return JSON.stringify(await buildBackup(entries, NOW));
}

/** A hand-made file: a manifest and the given drafts. */
const handmade = (drafts: unknown[], manifest: Record<string, unknown> = {}) => ({ manifest: { app: BACKUP_APP, formatVersion: BACKUP_FORMAT_VERSION, exportedAt: NOW.toISOString(), ...manifest }, drafts });

const bytesFromBlob = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

async function expectRejected(input: unknown, reason: string) {
  const result = await parseBackup(input);
  expect(result.ok ? "ok" : result.reason).toBe(reason);
  return result;
}

// ----------------------------------------------------------------------------------------------- building

describe("backup file name and manifest", () => {
  it("names the file with the person's own date", () => {
    expect(backupFileName(new Date(2026, 10, 22, 23, 59))).toBe("Biodata-backup-2026-11-22.json");
    expect(backupFileName(new Date(2027, 0, 5, 0, 1))).toBe("Biodata-backup-2027-01-05.json");
  });

  it("starts with a manifest: app name, format version, export time and the number of drafts", async () => {
    const file = await buildBackup([{ profile: draft("One"), photos: [] }], NOW);
    expect(file.manifest).toEqual({ app: "free-wedding-biodata", formatVersion: 1, exportedAt: "2026-11-22T10:30:00.000Z", draftCount: 1 });
    expect(Object.keys(file)).toEqual(["manifest", "drafts"]);
  });

  it("holds photos as base64 and leaves out pictures the draft doesn't point at", async () => {
    const entry = withPhoto("With photo");
    entry.photos.push(photoOf("orphan", PNG, "image/png"));
    const file = await buildBackup([entry], NOW);
    expect(file.drafts[0].photos).toEqual([{ id: "photo-1", mimeType: "image/jpeg", width: 48, height: 64, data: b64(JPEG) }]);
  });

  it("the Blob version is the same file as the object version", async () => {
    const entries = [withPhoto("A"), { profile: draft("B"), photos: [] }];
    const blob = await buildBackupBlob(entries, NOW);
    expect(blob.type).toBe("application/json");
    expect(JSON.parse(await blob.text())).toEqual(JSON.parse(JSON.stringify(await buildBackup(entries, NOW))));
  });

  it("reports progress, one draft at a time", async () => {
    const seen: [number, number][] = [];
    await buildBackupBlob([{ profile: draft("A"), photos: [] }, { profile: draft("B"), photos: [] }], NOW, (done, total) => seen.push([done, total]));
    expect(seen).toEqual([[1, 2], [2, 2]]);
  });

  it("estimates about what the file will weigh", async () => {
    const entries = [withPhoto("A")];
    const estimate = estimateBackupBytes(entries);
    const real = (await buildBackupBlob(entries, NOW)).size;
    expect(estimate).toBeGreaterThan(real * 0.8);
    expect(estimate).toBeLessThan(real * 1.5);
  });
});

describe("withOpenDraft", () => {
  it("uses the open draft as the editor holds it, with the pictures it hasn't saved yet", () => {
    const stored = withPhoto("Stored");
    const other: BackupEntry = { profile: draft("Other"), photos: [] };
    const typed: BiodataProfile = { ...stored.profile, draftName: "Typed since the last save" };
    const fresh = photoOf("photo-2", PNG, "image/png");
    const merged = withOpenDraft([other, stored], { profile: typed, pendingPhotos: [fresh] });
    expect(merged).toHaveLength(2);
    expect(merged[0]).toBe(other);
    expect(merged[1].profile.draftName).toBe("Typed since the last save");
    expect(merged[1].photos.map((p) => p.id)).toEqual(["photo-1", "photo-2"]);
  });

  it("adds the open draft when the database had no copy", () => {
    const open = draft("Open");
    expect(withOpenDraft([], { profile: open, pendingPhotos: [] })).toEqual([{ profile: open, photos: [] }]);
  });
});

// ------------------------------------------------------------------------------------------- round trip

describe("build, then parse", () => {
  it("gives back the same drafts and the same picture bytes", async () => {
    const a = withPhoto("Sai Teja Mandapati", "p-a", JPEG);
    const b: BackupEntry = { profile: draft("Second"), photos: [] };
    const c = withPhoto("Third", "p-c", PNG);
    c.photos[0] = photoOf("p-c", PNG, "image/png");
    const result = await parseBackup(await fileOf([a, b, c]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
    expect(result.manifest).toEqual({ formatVersion: 1, exportedAt: NOW.toISOString() });
    expect(result.drafts.map((d) => d.index)).toEqual([0, 1, 2]);
    expect(result.drafts.map((d) => d.profile)).toEqual([a.profile, b.profile, c.profile]);

    const [first, , third] = result.drafts;
    expect(first.photos).toHaveLength(1);
    expect(first.photos[0]).toMatchObject({ id: "p-a", mimeType: "image/jpeg", width: 48, height: 64 });
    expect(await bytesFromBlob(first.photos[0].blob)).toEqual(JPEG);
    expect(third.photos[0]).toMatchObject({ id: "p-c", mimeType: "image/png", width: 48, height: 64 });
    expect(await bytesFromBlob(third.photos[0].blob)).toEqual(PNG);
  });

  it("round-trips a draft with every kind of photo reference: main, second, extra pages and horoscope chart", async () => {
    const profile = draft("Every photo", (p) => {
      p.photo = { id: "main", frame: "3:4", crop };
      p.secondPhoto = { id: "second", crop };
      p.photoPages = { perPage: 2, photos: [{ id: "extra-1", crop }, { id: "extra-2", crop }, { id: "extra-3", crop }] };
      p.horoscopeChart = { id: "chart", crop };
    });
    const ids = ["main", "second", "extra-1", "extra-2", "extra-3", "chart"];
    const entry: BackupEntry = { profile, photos: ids.map((id, i) => photoOf(id, i % 2 ? PNG : JPEG, i % 2 ? "image/png" : "image/jpeg")) };
    const file = await buildBackup([entry], NOW);
    expect(file.drafts[0].photos.map((p) => p.id)).toEqual(ids);
    const result = await parseBackup(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
    expect(result.drafts[0].profile).toEqual(profile);
    expect(result.drafts[0].photos.map((p) => p.id)).toEqual(ids);
    expect(await bytesFromBlob(result.drafts[0].photos[3].blob)).toEqual(PNG);
  });

  it("takes the parsed object as well as the text", async () => {
    const file = await buildBackup([withPhoto("A")], NOW);
    const result = await parseBackup(JSON.parse(JSON.stringify(file)));
    expect(result.ok && result.drafts).toHaveLength(1);
  });

  it("reads a file that starts with a byte order mark (some editors add one)", async () => {
    const result = await parseBackup(`﻿${await fileOf([{ profile: draft("A"), photos: [] }])}`);
    expect(result.ok).toBe(true);
  });

  it("reports how far the check has got", async () => {
    const seen: number[] = [];
    await parseBackup(await fileOf([{ profile: draft("A"), photos: [] }, { profile: draft("B"), photos: [] }]), { onProgress: (done) => seen.push(done) });
    expect(seen).toEqual([0, 1, 2]);
  });

  it("uses the picture's own size, not the one the file claims", async () => {
    const file = JSON.parse(await fileOf([withPhoto("A")]));
    file.drafts[0].photos[0].width = 9;
    file.drafts[0].photos[0].height = 9;
    const result = await parseBackup(file);
    expect(result.ok && result.drafts[0].photos[0]).toMatchObject({ width: 48, height: 64 });
  });
});

// ----------------------------------------------------------------------------------- rejecting a whole file

describe("a file that is refused as a whole", () => {
  it.each(["", "not json {", "<html></html>", "\u0000\u0001"])("is notJson: %j", async (text) => {
    await expectRejected(text, "notJson");
  });

  it.each([`{}`, `[]`, `42`, `null`, `"text"`, `true`, JSON.stringify({ manifest: { app: "someone-else", formatVersion: 1 }, drafts: [] }), JSON.stringify({ drafts: [] }), JSON.stringify({ manifest: "x" }), JSON.stringify(draft("A"))])(
    "is notBackup: %s",
    async (text) => {
      await expectRejected(text, "notBackup");
    },
  );

  it("is tooNew when the backup format is newer than this release reads", async () => {
    const result = await expectRejected(handmade([], { formatVersion: 2 }), "tooNew");
    expect(!result.ok && result.detail).toContain("format 2");
  });

  it.each(["1", 0, -1, 1.5, null])("is invalid when the format version is %j", async (formatVersion) => {
    await expectRejected(handmade([], { formatVersion }), "invalid");
  });

  it("is invalid when the drafts aren't a list", async () => {
    await expectRejected(handmade("nope" as unknown as unknown[]), "invalid");
    await expectRejected({ manifest: handmade([]).manifest }, "invalid");
  });

  it("is empty when there are no drafts", async () => {
    await expectRejected(handmade([]), "empty");
  });

  it("is tooBig over the file size limit, before anything is parsed", async () => {
    await expectRejected("x".repeat(MAX_BACKUP_BYTES + 1), "tooBig");
  });

  it("is tooBig with more drafts than the limit", async () => {
    await expectRejected(handmade(Array.from({ length: MAX_BACKUP_DRAFTS + 1 }, () => ({}))), "tooBig");
  });

  it("is invalid when no draft in it can be used", async () => {
    await expectRejected(handmade([null, 5, { profile: "x" }, { profile: { schemaVersion: 1 } }]), "invalid");
  });

  it("is tooNew when every draft was saved by a newer release", async () => {
    await expectRejected(handmade([{ profile: { ...draft("A"), schemaVersion: 2 } }]), "tooNew");
  });

  it("never throws, whatever it is given", async () => {
    for (const input of [undefined, null, 0, NaN, () => 1, Symbol("x"), BigInt(10), new Date(), new Map(), [[]], { manifest: {} }]) {
      await expect(parseBackup(input)).resolves.toMatchObject({ ok: false });
    }
  });
});

// ------------------------------------------------------------------------- one draft among others

describe("a draft that can't be used while the others can", () => {
  it("is skipped with its name and reason, and the others come in", async () => {
    const good1 = withPhoto("Good one");
    const good2: BackupEntry = { profile: draft("Good two"), photos: [] };
    const file = JSON.parse(await fileOf([good1, good2]));
    file.drafts.splice(1, 0, { profile: { ...draft("Broken one"), sections: "not a list" }, photos: [] });
    const result = await parseBackup(file);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.drafts.map((d) => d.profile.draftName)).toEqual(["Good one", "Good two"]);
    expect(result.drafts.map((d) => d.index)).toEqual([0, 2]);
    expect(result.warnings).toEqual([expect.objectContaining({ kind: "draftSkipped", index: 1, name: "Broken one", reason: "invalid", detail: expect.stringContaining("sections") })]);
  });

  it("is skipped as tooNew when its own format is newer, with the others in", async () => {
    const file = JSON.parse(await fileOf([{ profile: draft("Old"), photos: [] }]));
    file.drafts.push({ profile: { ...draft("From the future"), schemaVersion: 2 }, photos: [] });
    const result = await parseBackup(file);
    expect(result.ok && result.drafts).toHaveLength(1);
    expect(result.ok && result.warnings).toEqual([expect.objectContaining({ kind: "draftSkipped", reason: "tooNew", name: "From the future" })]);
  });

  it("keeps the first of two drafts with the same id and says so about the second", async () => {
    const one = draft("First copy");
    const two = { ...structuredClone(one), draftName: "Second copy" };
    const result = await parseBackup(handmade([{ profile: one }, { profile: two }]));
    expect(result.ok && result.drafts.map((d) => d.profile.draftName)).toEqual(["First copy"]);
    expect(result.ok && result.warnings).toEqual([expect.objectContaining({ kind: "draftSkipped", index: 1, reason: "duplicate", name: "Second copy" })]);
  });

  it("is skipped when two of its sections share an id", async () => {
    const profile = draft("Twins");
    profile.sections = [profile.sections[0], { ...structuredClone(profile.sections[1]), id: profile.sections[0].id }];
    const result = await parseBackup(handmade([{ profile }, { profile: draft("Fine") }]));
    expect(result.ok && result.warnings).toEqual([expect.objectContaining({ reason: "invalid", detail: expect.stringContaining("Duplicate") })]);
    expect(result.ok && result.drafts).toHaveLength(1);
  });

  it("is skipped as tooBig when its text is over the limit, however it is spread", async () => {
    const huge = draft("Huge", (p) => {
      const section = p.sections.find((s) => s.kind === "fields")!;
      if (section.kind === "fields") section.fields[0].value = "x".repeat(3 * 1024 * 1024);
    });
    const result = await parseBackup(handmade([{ profile: huge }, { profile: draft("Small") }]));
    expect(result.ok && result.warnings).toEqual([expect.objectContaining({ kind: "draftSkipped", reason: "tooBig" })]);
    expect(result.ok && result.drafts.map((d) => d.profile.draftName)).toEqual(["Small"]);
  });

  it("is skipped when it is nested absurdly deep", async () => {
    let deep: unknown = "x";
    for (let i = 0; i < 100; i++) deep = { deep };
    const result = await parseBackup(handmade([{ profile: { ...draft("Deep"), extra: deep } }, { profile: draft("Fine") }]));
    expect(result.ok && result.drafts.map((d) => d.profile.draftName)).toEqual(["Fine"]);
  });

  it("is skipped when it isn't plain data (a class instance, a function)", async () => {
    class Sneaky {
      draftName = "Sneaky";
    }
    const result = await parseBackup(handmade([{ profile: new Sneaky() }, { profile: { ...draft("Fn"), draftName: () => "x" } }, { profile: draft("Fine") }]));
    expect(result.ok && result.drafts.map((d) => d.profile.draftName)).toEqual(["Fine"]);
  });
});

// -------------------------------------------------------------------------------------------- pictures

describe("pictures in the file", () => {
  const entryFor = (data: string, mimeType: string, id = "photo-1") => ({ profile: withPhoto("A", id).profile, photos: [{ id, mimeType, width: 48, height: 64, data }] });

  async function dropped(entry: unknown) {
    const result = await parseBackup(handmade([entry]));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unexpected");
    return result;
  }

  it("a picture whose bytes aren't an image is dropped, labelled image/png or not, and the draft comes in without it", async () => {
    for (const mime of ["image/png", "image/jpeg", "image/webp"]) {
      const result = await dropped(entryFor(b64(ascii("<script>alert(1)</script>")), mime));
      expect(result.drafts[0].photos).toEqual([]);
      expect(result.drafts[0].profile.photo).toBeUndefined();
      expect(result.warnings).toEqual([expect.objectContaining({ kind: "photoDropped", index: 0, reason: "type" })]);
    }
  });

  it("a picture whose label doesn't match its bytes is dropped", async () => {
    const result = await dropped(entryFor(b64(JPEG), "image/png"));
    expect(result.warnings).toEqual([expect.objectContaining({ reason: "type" })]);
  });

  it.each(["image/gif", "image/svg+xml", "text/html", "application/pdf", "image/heic", ""])("a picture labelled %j is dropped", async (mime) => {
    const result = await dropped(entryFor(b64(PNG), mime));
    expect(result.warnings).toEqual([expect.objectContaining({ reason: "type" })]);
  });

  it("an SVG with a script is never a picture", async () => {
    const svg = b64(ascii('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>'));
    const result = await dropped(entryFor(svg, "image/svg+xml"));
    expect(result.drafts[0].photos).toEqual([]);
  });

  it("a picture that is too large is dropped without being decoded", async () => {
    const data = "A".repeat((Math.ceil(MAX_PHOTO_BYTES / 3) + 1) * 4);
    const result = await dropped(entryFor(data, "image/png"));
    expect(result.warnings).toEqual([expect.objectContaining({ reason: "size" })]);
  });

  it.each(["!!!!", "AAA", "", "AA=A", "A A A A", "not base64 at all"])("data %j isn't base64: dropped", async (data) => {
    const result = await dropped(entryFor(data, "image/png"));
    expect(result.warnings).toEqual([expect.objectContaining({ reason: "data" })]);
  });

  it("a picture whose header is cut short or claims an enormous size is dropped", async () => {
    const tooBigPng = new Uint8Array(PNG);
    new DataView(tooBigPng.buffer).setUint32(16, 20000);
    expect((await dropped(entryFor(b64(tooBigPng), "image/png"))).warnings).toEqual([expect.objectContaining({ reason: "dimensions" })]);
    expect((await dropped(entryFor(b64(PNG.subarray(0, 20)), "image/png"))).warnings).toEqual([expect.objectContaining({ reason: "dimensions" })]);
    expect((await dropped(entryFor(b64(JPEG.subarray(0, 12)), "image/jpeg"))).warnings).toEqual([expect.objectContaining({ reason: "dimensions" })]);
    const zero = new Uint8Array(PNG);
    new DataView(zero.buffer).setUint32(20, 0);
    expect((await dropped(entryFor(b64(zero), "image/png"))).warnings).toEqual([expect.objectContaining({ reason: "dimensions" })]);
  });

  it("a draft pointing at a picture the file doesn't hold comes in without that reference", async () => {
    const profile = draft("Pointing", (p) => {
      p.photo = { id: "gone", frame: "3:4", crop };
      p.secondPhoto = { id: "kept", crop };
      p.photoPages = { perPage: 2, photos: [{ id: "gone-2", crop }, { id: "kept-2", crop }] };
      p.horoscopeChart = { id: "gone-3", crop };
    });
    const photos = [
      { id: "kept", mimeType: "image/png", data: b64(PNG) },
      { id: "kept-2", mimeType: "image/webp", data: b64(WEBP_X) },
    ];
    const result = await parseBackup(handmade([{ profile, photos }]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [only] = result.drafts;
    expect(only.profile.photo).toBeUndefined();
    expect(only.profile.horoscopeChart).toBeUndefined();
    expect(only.profile.secondPhoto?.id).toBe("kept");
    expect(only.profile.photoPages?.photos.map((p) => p.id)).toEqual(["kept-2"]);
    expect(only.photos.map((p) => p.id)).toEqual(["kept", "kept-2"]);
    expect(result.warnings.map((w) => w.kind === "photoDropped" && w.reason)).toEqual(["missing", "missing", "missing"]);
  });

  it("an emptied group of extra photos is removed with its last picture", async () => {
    const profile = draft("Pages", (p) => {
      p.photoPages = { perPage: 1, photos: [{ id: "gone", crop }] };
    });
    const result = await parseBackup(handmade([{ profile }]));
    expect(result.ok && result.drafts[0].profile.photoPages).toBeUndefined();
  });

  it("pictures the draft doesn't point at are ignored, and the first entry with an id wins", async () => {
    const profile = withPhoto("A").profile;
    const photos = [
      { id: "photo-1", mimeType: "image/png", data: b64(PNG) },
      { id: "photo-1", mimeType: "image/jpeg", data: b64(JPEG) },
      { id: "orphan", mimeType: "image/png", data: b64(PNG) },
      { id: "", mimeType: "image/png", data: b64(PNG) },
      "junk",
    ];
    const result = await parseBackup(handmade([{ profile, photos }]));
    expect(result.ok && result.drafts[0].photos.map((p) => [p.id, p.mimeType])).toEqual([["photo-1", "image/png"]]);
    expect(result.ok && result.warnings).toEqual([]);
  });

  it("a draft with a huge list of picture entries is skipped", async () => {
    const photos = Array.from({ length: 40 }, (_, i) => ({ id: `p${i}`, mimeType: "image/png", data: "" }));
    const result = await parseBackup(handmade([{ profile: draft("A"), photos }, { profile: draft("B") }]));
    expect(result.ok && result.drafts.map((d) => d.profile.draftName)).toEqual(["B"]);
  });
});

describe("picture headers", () => {
  it("recognises JPEG, PNG and WebP by their first bytes and nothing else", () => {
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(WEBP_L)).toBe("image/webp");
    expect(sniffImageType(bytesOf(ascii("GIF89a"), [0, 0, 0, 0, 0, 0]))).toBeNull();
    expect(sniffImageType(bytesOf(ascii("RIFF"), [0, 0, 0, 0], ascii("WAVE")))).toBeNull();
    expect(sniffImageType(bytesOf(ascii("%PDF-1.7")))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
    expect(sniffImageType(bytesOf([0xff, 0xd8]))).toBeNull();
  });

  it("reads the size from the header of each kind", () => {
    expect(imageSize(PNG, "image/png")).toEqual({ width: 48, height: 64 });
    expect(imageSize(JPEG, "image/jpeg")).toEqual({ width: 48, height: 64 });
    expect(imageSize(WEBP_L, "image/webp")).toEqual({ width: 100, height: 200 });
    expect(imageSize(WEBP_X, "image/webp")).toEqual({ width: 640, height: 480 });
    expect(imageSize(WEBP_Y, "image/webp")).toEqual({ width: 320, height: 240 });
  });

  it("skips other JPEG segments to find the frame, and gives up where there isn't one", () => {
    const withComment = bytesOf([0xff, 0xd8], [0xff, 0xfe, 0, 6, 1, 2, 3, 4], [0xff, 0xff], [0xff, 0xc2, 0, 11, 8, 0x01, 0x00, 0x02, 0x00, 1, 1, 0x11, 0], [0xff, 0xd9]);
    expect(imageSize(withComment, "image/jpeg")).toEqual({ width: 512, height: 256 });
    expect(imageSize(bytesOf([0xff, 0xd8], [0xff, 0xda, 0, 4, 0, 0]), "image/jpeg")).toBeNull();
    expect(imageSize(bytesOf([0xff, 0xd8], [0xff, 0xfe, 0, 0, 0, 0]), "image/jpeg")).toBeNull();
  });
});

// -------------------------------------------------------------------------- unknown keys and plain text

describe("unknown keys and plain text", () => {
  it("drops unknown keys at every level, and keeps nothing it doesn't know", async () => {
    const entry = withPhoto("A");
    const file = JSON.parse(await fileOf([entry]));
    file.evilTop = "evil";
    file.manifest.evilManifest = "evil";
    file.drafts[0].evilDraft = "evil";
    file.drafts[0].photos[0].evilPhoto = "evil";
    const profile = file.drafts[0].profile;
    profile.evilProfile = { nested: "evil" };
    profile.options.evilOptions = "evil";
    profile.sections[0].evilSection = "evil";
    profile.sections[0].fields[0].evilField = "evil";
    profile.photo.evilPhotoRef = "evil";
    profile.photo.crop.evilCrop = "evil";
    const result = await parseBackup(file);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.stringify(result.drafts)).not.toContain("evil");
    expect(result.drafts[0].profile).toEqual(entry.profile);
    expect(Object.keys(result.manifest).sort()).toEqual(["exportedAt", "formatVersion"]);
  });

  it("lets nothing through under __proto__ or constructor, and pollutes nothing", async () => {
    const text = `{"manifest":{"app":"free-wedding-biodata","formatVersion":1,"__proto__":{"polluted":"manifest"}},"__proto__":{"polluted":"top"},"drafts":[{"__proto__":{"polluted":"draft"},"profile":${JSON.stringify(draft("A")).replace("{", '{"__proto__":{"polluted":"profile","isAdmin":true},"constructor":{"prototype":{"polluted":"ctor"}},')}}]}`;
    const result = await parseBackup(text);
    expect(result.ok).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();
    if (!result.ok) return;
    const profile = result.drafts[0].profile as unknown as Record<string, unknown>;
    expect(Object.hasOwn(profile, "__proto__")).toBe(false);
    expect(Object.hasOwn(profile, "constructor")).toBe(false);
    expect(profile.polluted).toBeUndefined();
    expect(Object.getPrototypeOf(profile)).toBe(Object.prototype);
  });

  it("keeps HTML and script text exactly as typed, as text", async () => {
    const html = '<img src=x onerror="alert(1)"> <script>alert("x")</script> &amp; javascript:alert(1)';
    const profile = draft(html, (p) => {
      const section = p.sections.find((s) => s.kind === "fields")!;
      if (section.kind === "fields") section.fields[0].value = html;
    });
    const result = await parseBackup(await fileOf([{ profile, photos: [] }]));
    expect(result.ok && result.drafts[0].profile.draftName).toBe(html);
    const first = result.ok ? result.drafts[0].profile.sections[0] : undefined;
    expect(first?.kind === "fields" && first.fields[0].value).toBe(html);
  });

  it("removes control characters but keeps line breaks and tabs", async () => {
    const profile = draft("A\u0000B\u0007C\u007fD", (p) => {
      const section = p.sections.find((s) => s.kind === "fields")!;
      if (section.kind === "fields") section.fields[0].value = "line one\nline two\r\n\tindented\u0000\u001b[31m";
    });
    const result = await parseBackup(await fileOf([{ profile, photos: [] }]));
    expect(result.ok && result.drafts[0].profile.draftName).toBe("ABCD");
    const first = result.ok ? result.drafts[0].profile.sections[0] : undefined;
    expect(first?.kind === "fields" && first.fields[0].value).toBe("line one\nline two\r\n\tindented[31m");
  });

  it("doesn't change the profile's own revision or ids (the repo decides those)", async () => {
    const profile = draft("A");
    profile.revision = 7;
    const result = await parseBackup(await fileOf([{ profile, photos: [] }]));
    expect(result.ok && result.drafts[0].profile).toMatchObject({ id: profile.id, revision: 7 });
  });

  it("opens a draft saved before the form layouts existed, as Detailed, the way the database does", async () => {
    const old = draft("Old");
    const { formLayout, ...optionsBefore } = old.options;
    expect(formLayout).toBeDefined();
    const result = await parseBackup(handmade([{ profile: { ...old, options: optionsBefore } }]));
    expect(result.ok && result.drafts[0].profile.options.formLayout).toBe("detailed");
  });

  it("treats an unreadable export time as missing rather than refusing the file", async () => {
    const result = await parseBackup(handmade([{ profile: draft("A") }], { exportedAt: "last Tuesday" }));
    expect(result.ok && result.manifest.exportedAt).toBeUndefined();
  });
});
