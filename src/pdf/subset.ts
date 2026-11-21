// Font subsetting with HarfBuzz's own subsetter (harfbuzz-subset.wasm from harfbuzzjs, a standalone module with no
// imports). Keeps glyph IDs (retain-gids), so the IDs HarfBuzz shaped stay valid in the embedded font and the PDF
// can use CIDToGIDMap /Identity. Layout tables (GSUB/GPOS/GDEF) and hinting are dropped: a PDF needs only outlines.

interface SubsetExports {
  memory: WebAssembly.Memory;
  _initialize?: () => void;
  malloc(size: number): number;
  free(ptr: number): void;
  hb_blob_create(data: number, length: number, mode: number, userData: number, destroy: number): number;
  hb_blob_destroy(blob: number): void;
  hb_blob_get_data(blob: number, lengthPtr: number): number;
  hb_face_create(blob: number, index: number): number;
  hb_face_destroy(face: number): void;
  hb_face_reference_blob(face: number): number;
  hb_set_add(set: number, value: number): void;
  hb_subset_input_create_or_fail(): number;
  hb_subset_input_destroy(input: number): void;
  hb_subset_input_glyph_set(input: number): number;
  hb_subset_input_set(input: number, setType: number): number;
  hb_subset_input_get_flags(input: number): number;
  hb_subset_input_set_flags(input: number, flags: number): void;
  hb_subset_or_fail(face: number, input: number): number;
}

const HB_MEMORY_MODE_WRITABLE = 2;
const HB_SUBSET_FLAGS_NO_HINTING = 0x1;
const HB_SUBSET_FLAGS_RETAIN_GIDS = 0x2;
const HB_SUBSET_SETS_DROP_TABLE_TAG = 3;

const tag = (s: string) => ((s.charCodeAt(0) << 24) | (s.charCodeAt(1) << 16) | (s.charCodeAt(2) << 8) | s.charCodeAt(3)) >>> 0;

/** Tables a PDF renderer never reads from an embedded TrueType font. */
const DROP = ["GSUB", "GPOS", "GDEF", "BASE", "JSTF", "MATH", "DSIG", "kern", "morx", "feat", "STAT", "meta", "vhea", "vmtx"];

export interface Subsetter {
  /** Returns a TrueType font with only `glyphs` (and .notdef) kept, glyph IDs unchanged. */
  subset(font: Uint8Array, glyphs: Iterable<number>): Uint8Array;
}

export async function createSubsetter(wasm: ArrayBuffer | Uint8Array): Promise<Subsetter> {
  const bytes = wasm instanceof Uint8Array ? wasm : new Uint8Array(wasm);
  const { instance } = await WebAssembly.instantiate(bytes as BufferSource, {});
  const hb = instance.exports as unknown as SubsetExports;
  hb._initialize?.();
  return {
    subset(font, glyphs) {
      const fontPtr = hb.malloc(font.byteLength);
      new Uint8Array(hb.memory.buffer, fontPtr, font.byteLength).set(font);
      const blob = hb.hb_blob_create(fontPtr, font.byteLength, HB_MEMORY_MODE_WRITABLE, 0, 0);
      const face = hb.hb_face_create(blob, 0);
      hb.hb_blob_destroy(blob);
      const input = hb.hb_subset_input_create_or_fail();
      if (!input) throw new Error("hb_subset_input_create_or_fail failed");
      const glyphSet = hb.hb_subset_input_glyph_set(input);
      for (const g of glyphs) hb.hb_set_add(glyphSet, g);
      const drop = hb.hb_subset_input_set(input, HB_SUBSET_SETS_DROP_TABLE_TAG);
      for (const t of DROP) hb.hb_set_add(drop, tag(t));
      hb.hb_subset_input_set_flags(input, hb.hb_subset_input_get_flags(input) | HB_SUBSET_FLAGS_RETAIN_GIDS | HB_SUBSET_FLAGS_NO_HINTING);
      const result = hb.hb_subset_or_fail(face, input);
      hb.hb_subset_input_destroy(input);
      hb.hb_face_destroy(face);
      if (!result) {
        hb.free(fontPtr);
        throw new Error("hb_subset_or_fail failed");
      }
      const outBlob = hb.hb_face_reference_blob(result);
      const lengthPtr = hb.malloc(4);
      const dataPtr = hb.hb_blob_get_data(outBlob, lengthPtr);
      const length = new Uint32Array(hb.memory.buffer, lengthPtr, 1)[0];
      const out = new Uint8Array(hb.memory.buffer, dataPtr, length).slice();
      hb.free(lengthPtr);
      hb.hb_blob_destroy(outBlob);
      hb.hb_face_destroy(result);
      hb.free(fontPtr);
      if (!length) throw new Error("Subset font is empty");
      return out;
    },
  };
}
