// Candidate C in the browser (BUILD_PLAN Step 0.2): the same writer, with fonts fetched from /fonts and the
// subsetter's WebAssembly emitted by the bundler. Loaded only when a PDF is made.
import type { DisplayList } from "../display-list";
import { writePdf } from "./write-pdf";

const FAMILY_FILES: Record<string, string> = {
  "Noto Sans": "NotoSans",
  "Noto Sans Telugu": "NotoSansTelugu",
  "Noto Sans Devanagari": "NotoSansDevanagari",
  "Noto Sans Tamil": "NotoSansTamil",
  "Noto Sans Kannada": "NotoSansKannada",
  "Noto Sans Malayalam": "NotoSansMalayalam",
  "Noto Sans Gujarati": "NotoSansGujarati",
  "Noto Sans Bengali": "NotoSansBengali",
  "Noto Sans Gurmukhi": "NotoSansGurmukhi",
};

const SUBSET_WASM = new URL("../../../node_modules/harfbuzzjs/dist/harfbuzz-subset.wasm", import.meta.url);

const fetchBytes = async (url: string | URL) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.arrayBuffer();
};

export function browserPdf(list: DisplayList): Promise<Uint8Array> {
  return writePdf(list, (family, weight) => fetchBytes(`/fonts/${FAMILY_FILES[family] ?? "NotoSans"}-${weight >= 600 ? "Bold" : "Regular"}.ttf`), {
    subsetWasm: () => fetchBytes(SUBSET_WASM),
    fallbackFamilies: ["Noto Sans"],
    title: "Biodata",
  });
}
