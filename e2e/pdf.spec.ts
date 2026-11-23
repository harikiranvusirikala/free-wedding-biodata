import { mkdir, writeFile } from "node:fs/promises";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { expect, test, type CDPSession, type Page } from "@playwright/test";

// The Download engine (BUILD_PLAN Step 4.1, VISION D49, D38), run in the browser on the static build.
// 1. /dev/pdf: the display list records alignment, justified lines, spaces between runs, italic, the whole font
//    stack and exact baselines, and the PDF's shaped widths match the browser's on every line (per-glyph fallback
//    on a Kannada page included).
// 2. /dev/document: Classic Gold and Minimal Ivory in English and Telugu (short and long), the short Classic Gold
//    page in all ten languages, and designs 3–10 (Step 4.3: English short and long, Telugu, one more Indic language,
//    all three colours, dark paper included): the PDF and JPEG page images are written to test-results/pdf/ next to Chrome's
//    screenshots of the same pages (for the PDFKit side-by-side check), page counts match, sizes are sane, every
//    line's width matches, times are logged (desktop and CPU ÷4), and nothing is requested from another origin.
// 3. Values typed in other scripts than the page's (Step 4.2: a Telugu name and a Hindi address on an English page,
//    bold English labels on a Kannada page, …): Chrome draws every text element with exactly the fonts, and as many
//    glyphs in each, as the PDF does, those are our Noto fonts (never a system font), and nothing is drawn as tofu.
// 4. The script fixtures (Step 4.2 part 2, VISION §15): the ten languages each typed in its own script, short in
//    Classic Gold and long in the other skeletons; the same font check, and copy and paste read back from the PDF
//    file (ActualText, ToUnicode). PDFs, page images and Chrome's screenshots go to test-results/pdf/ for review.

const OUT = "test-results/pdf";

test.skip(({ isMobile }) => isMobile, "pages are a fixed A4 size; one project is enough");
test.use({ deviceScaleFactor: 2 });

const LANGS = ["en", "te", "hi", "ta", "kn", "ml", "mr", "gu", "bn", "pa"];
/** Step 4.3's designs: their extra Indic language and their other two colours (test/fixtures/documents.ts). */
const NEW_DESIGNS = [
  ["kalyanam", "hi", "saffron", "leaf"],
  ["temple-bells", "ta", "amber", "blue"],
  ["rangoli", "kn", "violet", "marigold"],
  ["paisley", "ml", "maroon", "teal"],
  ["royal-maroon", "mr", "purple", "wine"],
  ["deepam", "gu", "purple", "night"],
  ["executive-navy", "bn", "forest", "plum"],
  ["modern-two-column", "pa", "amber", "rose"],
  ["floral-ivory", "kn", "lavender", "marigold"],
  ["watercolour-rose", "hi", "lilac", "coral"],
  ["mango-grove", "ta", "leaf", "berry"],
  ["mint-vines", "ml", "teal", "olive"],
  // Step 4.4
  ["baroque-gold", "gu", "maroon", "navy"],
  ["peacock", "mr", "blue", "emerald"],
  ["peach-filigree", "bn", "rose", "sage"],
  ["navy-rosette", "pa", "maroon", "green"],
  ["sandalwood", "kn", "rosewood", "tulsi"],
  ["slate-brush", "hi", "heather", "sage"],
] as const;
/** Step 4.4: the second photo on page 1, in one design of each skeleton and the letterhead (fixtures secondPhotoVariants). */
const TWO_PHOTOS = ["classic-gold-en-short-two", "classic-gold-en-sample-two", "minimal-ivory-en-short-two", "executive-navy-en-short-two", "sandalwood-en-short-two", "slate-brush-en-short-two"];
/** Step 4.2: values in other scripts than the page's (test/fixtures/documents.ts mixedScriptVariants). */
const MIXED = ["classic-gold-en-mixed", "minimal-ivory-en-mixed", "classic-gold-kn-mixed", "modern-two-column-ta-mixed"];
const VARIANTS = [
  ...["classic-gold", "minimal-ivory"].flatMap((t) => ["en", "te"].flatMap((lang) => [`${t}-${lang}-short`, `${t}-${lang}-long`])),
  ...LANGS.filter((l) => l !== "en" && l !== "te").map((lang) => `classic-gold-${lang}-short`),
  ...NEW_DESIGNS.flatMap(([d, lang, c2, c3]) => [`${d}-en-short`, `${d}-en-long`, `${d}-te-short`, `${d}-${lang}-short`, `${d}-en-short-${c2}`, `${d}-en-short-${c3}`]),
  "executive-navy-en-split",
  ...MIXED,
  ...TWO_PHOTOS,
];

function watchOffsite(page: Page): string[] {
  const offsite: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!["localhost", "127.0.0.1"].includes(url.hostname) && url.protocol !== "data:" && url.protocol !== "blob:") offsite.push(url.href);
  });
  return offsite;
}

const pdfPages = async (base64: string) => {
  const doc = await PDFDocument.load(Buffer.from(base64, "base64"), { updateMetadata: false });
  return doc.getPages().map((p) => p.getSize());
};

test("feature page: the display list carries what the writers need, and the PDF matches the browser", async ({ page }) => {
  test.setTimeout(120_000);
  const offsite = watchOffsite(page);
  await mkdir(OUT, { recursive: true });
  await page.goto("/dev/pdf");
  await expect(page.locator("body")).toHaveAttribute("data-pdf-ready", "1", { timeout: 30_000 });

  const facts = await page.evaluate(() => {
    const list = window.__pdf!.displayList();
    const pageEl = document.querySelector<HTMLElement>("[data-page]")!;
    const top = pageEl.getBoundingClientRect().top;
    const textIn = (check: string) => {
      const el = document.querySelector<HTMLElement>(`[data-check="${check}"]`)!;
      const r = el.getBoundingClientRect();
      const box = { top: r.top - top, bottom: r.bottom - top };
      return list.pages[0].items.filter((i) => i.kind === "text" && i.y > box.top && i.y < box.bottom);
    };
    const markers = [...document.querySelectorAll<HTMLElement>("[data-marker]")].map((m) => m.getBoundingClientRect().bottom - top);
    return {
      center: textIn("center"),
      right: textIn("right"),
      justify: textIn("justify"),
      justifyKn: textIn("justify-kn"),
      runs: textIn("runs"),
      fallback: textIn("fallback"),
      italic: textIn("italic"),
      baseline: textIn("baseline"),
      baselineKn: textIn("baseline-kn"),
      caps: textIn("caps"),
      markers,
      images: list.pages[0].items.filter((i) => i.kind === "image"),
      svgs: list.pages[0].items.filter((i) => i.kind === "svg").map((i) => (i.kind === "svg" ? i.markup : "")),
    };
  });
  type T = { text: string; align: string; justified: boolean; spaceAfter: boolean; fontStyle: string; fontFamilies: string[]; y: number; width: number };
  const t = (items: unknown[]) => items as T[];

  expect(t(facts.center).map((i) => i.align)).toEqual(["center"]);
  expect(t(facts.right).map((i) => i.align)).toEqual(["right"]);
  // Justified paragraphs: every line but the last is stretched to the column.
  for (const lines of [t(facts.justify), t(facts.justifyKn)]) {
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.map((l) => l.justified)).toEqual([...lines.slice(1).map(() => true), false]);
    for (const l of lines.slice(0, -1)) expect(Math.abs(l.width - lines[0].width)).toBeLessThan(1);
  }
  // Separate runs on one line keep their space for copy and paste: "ಹೆಸರು :  Sai Teja Mandapati".
  expect(t(facts.runs).map((i) => [i.text, i.spaceAfter])).toEqual([
    ["ಹೆಸರು", true],
    [":", true],
    ["Sai Teja Mandapati", false],
  ]);
  expect(t(facts.fallback)[0].fontFamilies).toEqual(["Noto Sans Kannada", "Noto Sans"]);
  expect(t(facts.italic).map((i) => i.fontStyle)).toEqual(["italic"]);
  expect(t(facts.caps).map((i) => i.text)).toEqual(["FAMILY DETAILS"]);
  // Exact baselines (fractional line positions included): the baseline marker sits where the item says.
  expect(Math.abs(t(facts.baseline)[0].y - facts.markers[0])).toBeLessThan(0.02);
  expect(Math.abs(t(facts.baselineKn)[0].y - facts.markers[1])).toBeLessThan(0.02);
  expect(facts.images.map((i) => (i as { fit: string }).fit)).toEqual(["cover", "fill"]);
  expect(facts.svgs[0]).toContain('id="i0"');
  expect(facts.svgs[0]).not.toContain(":r1:");

  const run = await page.evaluate(() => window.__pdf!.pdf());
  await writeFile(`${OUT}/features.pdf`, Buffer.from(run.pdf, "base64"));
  expect(run.mismatches).toEqual([]);
  expect(run.warnings).toEqual([]);
  expect(run.fallbackRuns).toBeGreaterThan(0);
  expect(await pdfPages(run.pdf)).toEqual([{ width: 595.28, height: 841.89 }]);
  const images = await page.evaluate(() => window.__pdf!.images("png"));
  await writeFile(`${OUT}/features-page-1.png`, Buffer.from(images.images[0], "base64"));
  await page.locator("[data-page]").screenshot({ path: `${OUT}/features-chrome-p1.png`, scale: "device" });
  expect(offsite).toEqual([]);
});

/** The real templates are written in parts that run side by side (one test took over four minutes alone). */
const PDF_SHARDS = 4;

async function openDocumentPage(page: Page) {
  await mkdir(OUT, { recursive: true });
  await page.setViewportSize({ width: 900, height: 1200 });
  await page.goto("/dev/document");
  await expect(page.locator("body")).toHaveAttribute("data-doc-ready", "1", { timeout: 60_000 });
}

for (let shard = 0; shard < PDF_SHARDS; shard++)
test(`real templates in ten languages, part ${shard + 1} of ${PDF_SHARDS}: PDF and page images, page counts, sizes, widths, timings`, async ({ page }) => {
  test.setTimeout(300_000);
  const offsite = watchOffsite(page);
  await openDocumentPage(page);

  const timings: Record<string, { pdfMs: number; imagesMs: number; pdfKB: number; jpegKB: number[] }> = {};
  for (const id of VARIANTS.filter((_, i) => i % PDF_SHARDS === shard)) {
    const pages = page.locator(`[data-variant="${id}"] [data-page]`);
    const count = await pages.count();
    expect(count, id).toBeGreaterThan(0);

    const run = await page.evaluate((v) => window.__doc!.pdf(v).pdf(), id);
    await writeFile(`${OUT}/${id}.pdf`, Buffer.from(run.pdf, "base64"));
    const sizes = await pdfPages(run.pdf);
    expect.soft(sizes, `${id} PDF pages`).toEqual(Array.from({ length: count }, () => ({ width: 595.28, height: 841.89 })));
    expect.soft(run.mismatches, `${id} lines whose width differs from the browser's`).toEqual([]);
    expect.soft(run.warnings, `${id} warnings`).toEqual([]);
    if (id.endsWith("-short")) expect.soft(run.bytes, `${id} PDF size`).toBeLessThan(400_000);

    const images = await page.evaluate((v) => window.__doc!.pdf(v).images("jpeg"), id);
    expect.soft(images.images.length, `${id} images`).toBe(count);
    for (const [i, b64] of images.images.entries()) await writeFile(`${OUT}/${id}-page-${i + 1}.jpg`, Buffer.from(b64, "base64"));
    for (let i = 0; i < count; i++) await pages.nth(i).screenshot({ path: `${OUT}/${id}-chrome-p${i + 1}.png`, scale: "device" });

    timings[id] = { pdfMs: Math.round(run.ms), imagesMs: Math.round(images.ms), pdfKB: Math.round(run.bytes / 1024), jpegKB: images.bytes.map((b) => Math.round(b / 1024)) };
  }
  await writeFile(`${OUT}/timings-part-${shard + 1}.json`, JSON.stringify({ desktop: timings }, null, 2));
  expect(offsite).toEqual([]);
});

test("the Download engine's timings on a slowed CPU, and a PNG page", async ({ page }) => {
  test.setTimeout(180_000);
  const offsite = watchOffsite(page);
  await openDocumentPage(page);
  // Warm up as the parts above do (fonts and WebAssembly loaded) before timing.
  await page.evaluate(() => window.__doc!.pdf("classic-gold-en-short").pdf());

  // A mid-range phone stand-in: the CPU slowed 4×, warm (fonts and WebAssembly already loaded).
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const slow: Record<string, { pdfMs: number; imagesMs: number }> = {};
  for (const id of ["classic-gold-en-short", "classic-gold-te-long"]) {
    const run = await page.evaluate((v) => window.__doc!.pdf(v).pdf(), id);
    const images = await page.evaluate((v) => window.__doc!.pdf(v).images("jpeg"), id);
    slow[id] = { pdfMs: Math.round(run.ms), imagesMs: Math.round(images.ms) };
  }
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

  const png = await page.evaluate(() => window.__doc!.pdf("classic-gold-en-short").images("png"));
  await writeFile(`${OUT}/classic-gold-en-short-page-1.png`, Buffer.from(png.images[0], "base64"));

  const report = { cpu4x: slow, pngKB: Math.round(png.bytes[0] / 1024) };
  await writeFile(`${OUT}/timings.json`, JSON.stringify(report, null, 2));
  console.log("Download engine:", JSON.stringify(report));
  expect(offsite).toEqual([]);
});

type Line = { page: number; text: string; fonts: Record<string, number> };

/** Removes from `lines` the first line, or run of consecutive lines, on `page` whose texts join (with spaces) to `text`. */
function takeLines(lines: Line[], page: number, text: string): { fonts: Record<string, number>; lines: number } | undefined {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].page !== page || !text.startsWith(lines[i].text)) continue;
    let joined = lines[i].text;
    let j = i;
    while (joined.length < text.length && j + 1 < lines.length && lines[j + 1].page === page && text.startsWith(`${joined} ${lines[j + 1].text}`)) joined += ` ${lines[++j].text}`;
    if (joined !== text) continue;
    const fonts: Record<string, number> = {};
    for (const l of lines.splice(i, j - i + 1)) for (const [f, n] of Object.entries(l.fonts)) fonts[f] = (fonts[f] ?? 0) + n;
    return { fonts, lines: j - i + 1 };
  }
  return undefined;
}

type Fonts = Record<string, number>;
type Probe = { text: string; screen: Fonts; pdf?: { fonts: Fonts; lines: number } };
type Run = { pdf: string; lines: Line[]; warnings: string[]; mismatches: unknown[] };

/**
 * Compares a variant's page on screen with its PDF, element by element: every text element is drawn with our
 * self-hosted Noto fonts (never a system font), with the same fonts and as many glyphs in each as the PDF's lines
 * that hold its text; and the PDF uses exactly the fonts the page does.
 */
async function compareFonts(page: Page, cdp: CDPSession, id: string): Promise<{ probes: Probe[]; run: Run }> {
  // Every element that holds text, in page order, with the text as drawn (text-transform applied).
  const probes = await page.evaluate((v) => {
    const out: { page: number; text: string }[] = [];
    document.querySelectorAll(`[data-variant="${v}"] [data-page]`).forEach((pageEl, p) => {
      for (const el of pageEl.querySelectorAll<HTMLElement>("*")) {
        if (![...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim())) continue;
        el.dataset.probe = String(out.length);
        out.push({ page: p + 1, text: el.innerText.replace(/\s+/g, " ").trim() });
      }
    });
    return out;
  }, id);
  const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
  const run: Run = await page.evaluate((v) => window.__doc!.pdf(v).pdf(), id);
  expect(run.warnings, `${id} warnings`).toEqual([]);
  expect(run.mismatches, `${id} widths`).toEqual([]);

  const lines = [...run.lines];
  const out: Probe[] = [];
  for (const [i, probe] of probes.entries()) {
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: `[data-variant="${id}"] [data-probe="${i}"]` });
    const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
    const screen: Fonts = {};
    for (const f of fonts) {
      // Only our self-hosted Noto fonts: a system font here would mean the PDF can't match the page.
      expect.soft(f.isCustomFont, `${id} "${probe.text}" drawn with the system font ${f.familyName}`).toBe(true);
      const name = (f as { postScriptName?: string }).postScriptName || f.familyName;
      screen[name] = (screen[name] ?? 0) + f.glyphCount;
    }
    // A one-line element is one PDF line with the same text; a wrapped one is consecutive lines that join to it
    // (lines are taken in page order). A space where a line wraps is drawn by neither, so it isn't compared.
    const pdf = takeLines(lines, probe.page, probe.text);
    out.push({ text: probe.text, screen, pdf });
    if (pdf) {
      const wraps = pdf.lines - 1;
      const glyphs = (f: Fonts) => Object.values(f).reduce((a, b) => a + b, 0);
      expect.soft(Object.keys(pdf.fonts).sort(), `${id} "${probe.text}": fonts, PDF vs screen`).toEqual(Object.keys(screen).sort());
      if (!wraps) expect.soft(pdf.fonts, `${id} "${probe.text}": glyphs per font, PDF vs screen`).toEqual(screen);
      else expect.soft(glyphs(screen) - glyphs(pdf.fonts), `${id} "${probe.text}": glyphs, PDF vs screen`).toBeGreaterThanOrEqual(0);
      if (wraps) expect.soft(glyphs(screen) - glyphs(pdf.fonts), `${id} "${probe.text}": glyphs, PDF vs screen`).toBeLessThanOrEqual(wraps);
    }
  }
  expect.soft(out.filter((p) => !p.pdf).map((p) => p.text), `${id} elements with no PDF lines`).toEqual([]);
  // And the PDF uses exactly the fonts the page does.
  const screenFonts = new Set(out.flatMap((p) => Object.keys(p.screen)));
  const pdfFonts = new Set(run.lines.flatMap((l) => Object.keys(l.fonts)));
  expect.soft([...pdfFonts].sort(), `${id} fonts in the PDF`).toEqual([...screenFonts].sort());
  return { probes: out, run };
}

/**
 * What copy and paste gives from each page of a PDF, read from the file itself: the /ActualText of every text run in
 * the page's content stream, in order (VISION §15 "verify text selection"). Also returns the Type0 fonts that have
 * no ToUnicode map (extractors that ignore ActualText fall back to it).
 */
async function copiedText(base64: string): Promise<{ pages: string[][]; fontsWithoutToUnicode: number }> {
  const doc = await PDFDocument.load(Buffer.from(base64, "base64"), { updateMetadata: false });
  const pages = doc.getPages().map((p) => {
    const contents = p.node.Contents();
    const streams = contents instanceof PDFArray ? contents.asArray().map((ref) => doc.context.lookup(ref)) : [contents];
    let ops = "";
    for (const stream of streams) if (stream instanceof PDFRawStream) ops += Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
    return [...ops.matchAll(/\/ActualText <FEFF([0-9A-Fa-f]*)>/g)].map((m) => Buffer.from(m[1], "hex").swap16().toString("utf16le"));
  });
  let fontsWithoutToUnicode = 0;
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (object instanceof PDFDict && object.get(PDFName.of("Subtype")) === PDFName.of("Type0") && !object.has(PDFName.of("ToUnicode"))) fontsWithoutToUnicode++;
  }
  return { pages, fontsWithoutToUnicode };
}

test("values in other scripts: the same fonts and glyphs on screen as in the PDF", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 900, height: 1200 });
  await page.goto("/dev/document");
  await expect(page.locator("body")).toHaveAttribute("data-doc-ready", "1", { timeout: 60_000 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");

  const byVariant: Record<string, Probe[]> = {};
  for (const id of MIXED) byVariant[id] = (await compareFonts(page, cdp, id)).probes;
  await writeFile(`${OUT}/mixed-fonts.json`, JSON.stringify(byVariant, null, 2));

  const fontsOf = (id: string, text: string) => byVariant[id].find((p) => p.text === text)?.screen;
  // A Telugu name on an English page: Telugu letters in Noto Sans Telugu, the spaces in Noto Sans; a value, so Medium
  // (D59: values print a touch heavier than body text).
  expect(Object.keys(fontsOf("classic-gold-en-mixed", "రవి తేజ మండపాటి") ?? {}).sort()).toEqual(["NotoSans-Medium", "NotoSansTelugu-Medium"]);
  // A label typed in Telugu stays bold.
  expect(Object.keys(fontsOf("classic-gold-en-mixed", "గోత్రం :") ?? {}).sort()).toEqual(["NotoSans-Bold", "NotoSansTelugu-Bold"]);
  // A Tamil section title on an English page (letter spacing dropped, the Latin part in capitals).
  expect(Object.keys(fontsOf("classic-gold-en-mixed", "குடும்பம் / FAMILY") ?? {}).sort()).toEqual(["NotoSans-Bold", "NotoSansTamil-Bold"]);
  // Bold English labels on a Kannada page: Latin in Noto Sans Bold, never the Kannada font's lighter Latin.
  expect(Object.keys(fontsOf("classic-gold-kn-mixed", "Blood group :") ?? {}).sort()).toEqual(["NotoSans-Bold", "NotoSansKannada-Bold"]);
  expect(fontsOf("classic-gold-kn-mixed", "Blood group :")?.["NotoSans-Bold"]).toBe("Bloodgroup:".length);
  // The Modern side panel: a Telugu name on a Tamil page, bold.
  expect(Object.keys(fontsOf("modern-two-column-ta-mixed", "రవి తేజ మండపాటి") ?? {}).sort()).toEqual(["NotoSansTamil-Bold", "NotoSansTelugu-Bold"]);
});

test("the second photo on page 1 is embedded in the PDF once more than without it (Step 4.4)", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 900, height: 1200 });
  await page.goto("/dev/document");
  await expect(page.locator("body")).toHaveAttribute("data-doc-ready", "1", { timeout: 60_000 });
  // Image XObjects are streams, which are never packed into object streams, so they can be counted in the file.
  const images = async (id: string) => {
    const run = await page.evaluate((v) => window.__doc!.pdf(v).pdf(), id);
    expect.soft(run.warnings, `${id} warnings`).toEqual([]);
    return (Buffer.from(run.pdf, "base64").toString("latin1").match(/\/Subtype\s*\/Image/g) ?? []).length;
  };
  for (const id of ["classic-gold-en-short", "minimal-ivory-en-short", "executive-navy-en-short", "sandalwood-en-short", "slate-brush-en-short"]) {
    expect.soft(await images(`${id}-two`), id).toBe((await images(id)) + 1);
  }
});

/** Step 4.2 part 2: the ten languages, each typed in its own script (test/fixtures/documents.ts scriptVariants). */
const SCRIPT_LONG = ["minimal-ivory", "executive-navy", "sandalwood", "modern-two-column", "slate-brush"];
const SCRIPT = LANGS.flatMap((lang, i) => [`classic-gold-${lang}-script`, `${SCRIPT_LONG[i % SCRIPT_LONG.length]}-${lang}-scriptLong`]);
/** A few of each language's hardest sequences (conjuncts, reph, pre-base vowels, joiners, Indic digits), as copied. */
const COPIED: Record<string, string[]> = {
  en: ["Venkata Satya Sai Lakshmi Narasimha Teja Mandapati Ramakrishna"],
  te: ["కృష్ణమూర్తి", "సాఫ్ట్\u200cవేర్", "౨౨", "స్త్రీ"],
  hi: ["द्वितीय", "कार्यालय", "२२"],
  ta: ["ஸ்ரீ", "கொ"],
  kn: ["ಕರ್ನಾಟಕ", "೨೨"],
  ml: ["ക്ഷ", "നാരായണൻ"],
  mr: ["महाराष्ट्र", "र्\u200dय"],
  gu: ["શ્રી", "૨૨"],
  bn: ["ক্ষ", "র্য", "২২"],
  pa: ["ਸ਼੍ਰੀ", "੨੨"],
};

test("script fixtures: ten languages typed in their own script, as PDFs that match the page and copy as typed", async ({ page }) => {
  test.setTimeout(600_000);
  await mkdir(OUT, { recursive: true });
  const offsite = watchOffsite(page);
  await page.setViewportSize({ width: 900, height: 1200 });
  await page.goto("/dev/document");
  await expect(page.locator("body")).toHaveAttribute("data-doc-ready", "1", { timeout: 60_000 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");

  const report: Record<string, { pages: number; pdfKB: number; fonts: string[] }> = {};
  for (const id of SCRIPT) {
    const lang = id.split("-").at(-2)!;
    const pages = page.locator(`[data-variant="${id}"] [data-page]`);
    const count = await pages.count();
    if (id.endsWith("-script")) expect.soft(count, `${id} pages`).toBe(1);

    const { run } = await compareFonts(page, cdp, id);
    await writeFile(`${OUT}/${id}.pdf`, Buffer.from(run.pdf, "base64"));
    expect.soft(await pdfPages(run.pdf), `${id} PDF pages`).toEqual(Array.from({ length: count }, () => ({ width: 595.28, height: 841.89 })));

    // Copy and paste: the PDF's own ActualText, page by page, is the text of every line the page draws, in order.
    const copied = await copiedText(run.pdf);
    expect.soft(copied.fontsWithoutToUnicode, `${id} fonts without a ToUnicode map`).toBe(0);
    for (let p = 0; p < count; p++) {
      const fromPdf = copied.pages[p].map((t) => t.replace(/ $/, ""));
      expect.soft(fromPdf, `${id} page ${p + 1}: copied text vs the page's lines`).toEqual(run.lines.filter((l) => l.page === p + 1).map((l) => l.text));
    }
    const all = copied.pages.flat().join(" ");
    if (id.endsWith("-script")) for (const sequence of COPIED[lang]) expect.soft(all, `${id} copies "${sequence}"`).toContain(sequence);

    const images = await page.evaluate((v) => window.__doc!.pdf(v).images("jpeg"), id);
    expect.soft(images.images.length, `${id} images`).toBe(count);
    for (const [i, b64] of images.images.entries()) await writeFile(`${OUT}/${id}-page-${i + 1}.jpg`, Buffer.from(b64, "base64"));
    for (let i = 0; i < count; i++) await pages.nth(i).screenshot({ path: `${OUT}/${id}-chrome-p${i + 1}.png`, scale: "device" });
    report[id] = { pages: count, pdfKB: Math.round(Buffer.from(run.pdf, "base64").length / 1024), fonts: [...new Set(run.lines.flatMap((l) => Object.keys(l.fonts)))].sort() };
  }
  await writeFile(`${OUT}/script-fixtures.json`, JSON.stringify(report, null, 2));
  expect(offsite).toEqual([]);
});
