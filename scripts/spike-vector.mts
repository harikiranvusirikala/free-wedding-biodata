// Step 0.2 spike, candidate C: the vector PDF writer driven by the browser's layout. Reads the display list Chrome
// produced from the reference page (test-results/spike/display-list.json, written by e2e/spike/reference.spec.ts) and the TTFs in public/fonts/, writes
// test-results/spike/C-all.pdf and one PDF per language (en = pages 1–2), and prints time, size and every run whose
// HarfBuzz advance differs from Chrome's width by more than 1.5 %.
// Run: node --import tsx scripts/spike-vector.mts

import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import type { DisplayList } from "../src/pdf-spike/display-list";
import { writePdf, type RunMeasure, type WritePdfOptions } from "../src/pdf-spike/vector";

const root = process.cwd();
const outDir = path.join(root, "test-results/spike");
const list = JSON.parse(await readFile(path.join(outDir, "display-list.json"), "utf8")) as DisplayList;
const subsetWasm = await readFile(path.join(root, "node_modules/harfbuzzjs/dist/harfbuzz-subset.wasm"));

const fontFiles = new Map<string, Promise<Buffer>>();
const fonts = (family: string, weight: number) => {
  const file = `${family.replace(/\s+/g, "")}-${weight >= 600 ? "Bold" : "Regular"}.ttf`;
  let p = fontFiles.get(file);
  if (!p) {
    p = readFile(path.join(root, "public/fonts", file));
    fontFiles.set(file, p);
  }
  return p.then((b) => new Uint8Array(b.buffer, b.byteOffset, b.byteLength));
};

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
const warnings = new Set<string>();

async function write(file: string, pages: DisplayList["pages"], extra: WritePdfOptions = {}) {
  const runs: RunMeasure[] = [];
  const start = performance.now();
  const bytes = await writePdf({ pages }, fonts, {
    subsetWasm,
    title: "Marriage biodata (spike)",
    onRun: (m) => runs.push(m),
    onWarning: (m) => warnings.add(m),
    ...extra,
  });
  const ms = performance.now() - start;
  if (file) await writeFile(path.join(outDir, file), bytes);
  return { ms, size: bytes.byteLength, runs };
}

// Languages in page order; English is pages 1–2.
const groups = new Map<string, DisplayList["pages"]>();
for (const page of list.pages) groups.set(page.lang, [...(groups.get(page.lang) ?? []), page]);

console.log("file           time      size   (unsubset)");
const all = await write("C-all.pdf", list.pages); // cold: loads HarfBuzz and every font
const warm = await write("C-all.pdf", list.pages);
const whole = await write("", list.pages, { subsetWasm: undefined });
console.log(`C-all.pdf  ${`${all.ms.toFixed(0)} ms`.padStart(8)} ${kb(all.size).padStart(10)} ${kb(whole.size).padStart(10)}   (cold; warm ${warm.ms.toFixed(0)} ms)`);
for (const [lang, pages] of groups) {
  const r = await write(`C-${lang}.pdf`, pages);
  const u = await write("", pages, { subsetWasm: undefined });
  console.log(`C-${lang}.pdf ${`${r.ms.toFixed(0)} ms`.padStart(9)} ${kb(r.size).padStart(10)} ${kb(u.size).padStart(10)}`);
}

// Width agreement between HarfBuzz and Chrome, over every run of the whole document.
const runs = warm.runs;
const abs = runs.map((r) => Math.abs(r.ratio)).sort((a, b) => a - b);
const pct = (x: number) => `${(x * 100).toFixed(2)} %`;
console.log(`\nRuns: ${runs.length}; |shaped − Chrome| / Chrome: median ${pct(abs[abs.length >> 1])}, p95 ${pct(abs[Math.floor(abs.length * 0.95)])}, max ${pct(abs[abs.length - 1])}`);
console.log(`Runs within 0.5 %: ${abs.filter((a) => a <= 0.005).length}, within 1.5 %: ${abs.filter((a) => a <= 0.015).length}`);
console.log(`Runs drawn partly with a fallback font: ${runs.filter((r) => r.fallback).length}`);
const byLang = new Map<string, number[]>();
for (const r of runs) {
  const lang = list.pages[r.page - 1].lang;
  byLang.set(lang, [...(byLang.get(lang) ?? []), r.ratio]);
}
for (const [lang, ratios] of byLang) {
  const mean = ratios.reduce((s, x) => s + x, 0) / ratios.length;
  const max = Math.max(...ratios.map(Math.abs));
  console.log(`  ${lang}: ${ratios.length} runs, mean ${pct(mean)}, max |Δ| ${pct(max)}`);
}
const justified = runs.filter((r) => r.justified);
console.log(`\nLines treated as justified (spaces widened to Chrome's width): ${justified.length}; their natural width was ${pct(Math.min(...justified.map((r) => r.ratio)))} to ${pct(Math.max(...justified.map((r) => r.ratio)))} of Chrome's`);
const plain = runs.filter((r) => !r.justified).map((r) => Math.abs(r.ratio)).sort((a, b) => a - b);
console.log(`Other runs: ${plain.length}; median ${pct(plain[plain.length >> 1])}, p95 ${pct(plain[Math.floor(plain.length * 0.95)])}, max ${pct(plain[plain.length - 1])}`);
const mismatches = runs.filter((r) => !r.justified && Math.abs(r.ratio) > 0.015);
console.log(`\nMismatches over 1.5 %: ${mismatches.length}`);
for (const m of mismatches) {
  console.log(`  p${m.page} ${m.fontFamily} ${m.fontWeight} ${m.fontSize}px: Chrome ${m.browserWidth.toFixed(2)} vs HarfBuzz ${m.shapedWidth.toFixed(2)} (${pct(m.ratio)}) "${m.text.slice(0, 60)}"`);
}
if (warnings.size) console.log(`\nWarnings:\n  ${[...warnings].join("\n  ")}`);
const sizes = await Promise.all(["C-all.pdf"].map(async (f) => (await stat(path.join(outDir, f))).size));
console.log(`\nWrote ${path.relative(root, outDir)}/C-*.pdf (C-all.pdf ${kb(sizes[0])})`);
