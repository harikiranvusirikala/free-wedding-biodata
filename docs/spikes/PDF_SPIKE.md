# PDF and Indian-script spike (BUILD_PLAN Step 0.2)

**Date:** 2026-11-21 · **Decision:** candidate **C**, a vector PDF writer driven by the browser's own layout (HarfBuzz shaping + pdf-lib), with candidate D's canvas drawing for page images. Recorded as VISION D49.

## Question

Which engine turns the biodata into an A4 PDF that matches the preview glyph for glyph in all ten document languages (English, Telugu, Hindi, Tamil, Kannada, Malayalam, Marathi, Gujarati, Bengali, Punjabi), downloads in one click on phones, keeps one layout (D1), has selectable text, and adds the least code?

## Setup

- **Fixture** `test/fixtures/scripts.ts` (fictional, tested by `scripts.test.ts`): per language a label set and values that stress shaping (conjuncts and reph, pre-base vowel signs, two-part vowels, ZWJ/ZWNJ, chillus, Indic and Latin digits, English inside Indic text), a 60-character name, a long address and ~600 words of About text that must continue on page 2.
- **Fonts** `npm run fonts`: Noto Sans + eight script families, Regular and Bold, static TTF from `@expo-google-fonts/*` (OFL 1.1, `public/fonts/OFL.txt`). 18 files, **3.39 MB** in total; the largest is Noto Sans Latin (614 KB each weight, it carries Greek and Cyrillic too), the smallest Gurmukhi (57 KB). The PDF embeds only the glyphs used.
- **Reference page** `/dev/pdf-spike` (dev builds only): the fixture as 11 A4 pages in a Classic Gold look (gold foliage frame, motif, amber heading bars, label/value rows, photo top-right, About split onto page 2 by measuring). Chrome's screenshots of it are the ground truth.
- **Display list** `src/pdf-spike/display-list.ts`: walks the laid-out pages and records every line of text (split into lines with `Range.getClientRects()` over grapheme clusters, baseline, font, size, colour, letter spacing), every box, the photo and each SVG. All engines but A start from it, so the browser's layout is the only layout.
- **Evaluation:** every PDF rasterised with macOS PDFKit (the renderer behind Preview and iOS) and compared with Chrome's screenshots; text extracted per page; timings in Chrome (desktop, and with the CPU slowed 4× as a stand-in for a mid-range phone) and in Node.

## Results

| | A `@react-pdf/renderer` | B Chrome print-to-PDF | **C HarfBuzz + pdf-lib (vector)** | D 300 dpi canvas → JPEG pages |
|---|---|---|---|---|
| Glyphs match Chrome, 10 languages | **No.** te, ml, pa crash (fontkit bug on NULL mark anchors); hi, mr drop characters; bn garbled; kn misses one ligature | Yes | **Yes**, every stress cluster; lines within ½ px of the screenshot | Yes (the browser draws the text) |
| One layout (D1) | No, its own layout engine | Yes | **Yes** | Yes |
| Selectable / copyable text | Indic text in visual order | Indic text mostly missing (Chrome's PDF text layer breaks on Indic) | **Exact for all 437 lines via `/ActualText`** (Chrome, Acrobat, pdf.js); PDFKit ignores ActualText and falls back to a glyph map that mangles pre-base vowels and some conjuncts | None (images) |
| One-click download and Share on phones | Yes | **No**: print dialog → "Save as PDF" (several steps, worse on iOS) | **Yes** (a Blob → download / Web Share) | Yes |
| Page images (D38) | — | — | Not by itself | **Yes**: page 1 at 1240 × 1754 in 0.05–0.3 s on desktop; JPEG 387 KB, PNG 588 KB, identical to Chrome's page |
| File size, all 11 pages | 108 KB (only 8 pages render) | 1.6 MB | **177 KB** (fonts subset) | 6.3 MB |
| Time, all 11 pages in Chrome | — | 0.24 s | **0.33 s first (wasm load), 0.22 s warm; 0.59 s with CPU ÷4** | 0.94 s; 2.2 s with CPU ÷4 |
| Lazy-loaded download cost (gzip) | ≈ 441 KB | 0 | **≈ 656 KB** (harfbuzz.wasm 179, harfbuzz-subset.wasm 275, pdf-lib 179, own code 12, glue 12) | ≈ 180 KB (pdf-lib) |

Evidence in [pdf/](pdf/): `C-all.pdf`, `compare-C-<lang>.png` (Chrome left, C rendered by PDFKit right, every language), `A-all.pdf` / `A-all-patched.pdf` and `A-hi-p1.png` / `A-bn-p1.png` (A's failures), `compare-BD-te-bn.png` (Chrome, B and D for Telugu and Bengali, top to bottom), `image-p1.jpg` (D's page image), `C-browser-timings.json`, `D-timings.json`. The candidates' own reports: [candidate-A.md](candidate-A.md), [candidate-C.md](candidate-C.md). Regenerate everything with `npm run test:e2e` (writes `test-results/spike/`) and `node --import tsx scripts/spike-vector.mts`.

## Decision (decision rule, BUILD_PLAN Step 0.2)

1. **Glyph-for-glyph in ten languages:** B, C, D pass; A fails (and would need patches to its font engine).
2. **One-click download and Share, plus a matching page image:** C (PDF) and D (image) pass; B needs the print dialog.
3. **One layout:** B, C, D.
4. **Selectable text:** C is the only one with correct Indic copy/paste (in readers that honour ActualText).
5. **Least code:** B is zero code but fails 2 and 4; C costs ~650 KB gzip, loaded only on the first download.

**Chosen: C for Download/Share PDF, D's `drawPage` for Save/Share as image, `window.print()` for Print** (it prints the same pages, B's quality, no extra code). All three read the same laid-out pages.

## Found during the spike (carried into Step 4.1)

- **Turbopack and harfbuzzjs:** its Emscripten glue has a Node-only `await import("module")`; `next.config.ts` aliases `module` to an empty file for browser builds (`turbopack.resolveAlias`). With that, the static build emits both wasm files and C runs in the browser (`e2e/spike/vector.spec.ts`).
- **Display list gaps** to add before 4.1: `text-align` (justified lines are inferred today), an exact baseline from the font's metrics, spaces between separate text runs on one line (copy/paste shows "పేరు:" for "పేరు :"), italic.
- **Bundle:** ~650 KB gzip is acceptable lazily, but `harfbuzz-subset.wasm` (275 KB) could be replaced by a small TrueType subsetter (glyf/loca/hmtx/cmap with kept glyph IDs) and pdf-lib by a minimal writer, bringing it to ~200 KB. Not needed for launch; measure on real phones first.
- **Fonts:** Noto Sans Latin is 1.2 MB of the 3.4 MB; a Latin-only subset would cut first-download time on phones.
- **Print stylesheet:** the last page needs `break-after: auto`, or Chrome adds a blank page.

## Owner checks (real devices, not possible here)

- The spike page is dev-only (not deployed), so the phone checks wait for Step 4.1's Download button: on an iPhone (Safari) and an Android phone (Chrome), download and Share the PDF, open it in Files/Preview and WhatsApp, check a Telugu page looks like the screen, save a page image, and print once.
