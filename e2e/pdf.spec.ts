import { mkdir, writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { expect, test, type Page } from "@playwright/test";

// The Download engine (BUILD_PLAN Step 4.1, VISION D49, D38), run in the browser on the static build.
// 1. /dev/pdf: the display list records alignment, justified lines, spaces between runs, italic, the whole font
//    stack and exact baselines, and the PDF's shaped widths match the browser's on every line (per-glyph fallback
//    on a Kannada page included).
// 2. /dev/document: Classic Gold and Minimal Ivory in English and Telugu (short and long), the short Classic Gold
//    page in all ten languages, and designs 3–10 (Step 4.3: English short and long, Telugu, one more Indic language,
//    all three colours, dark paper included): the PDF and JPEG page images are written to test-results/pdf/ next to Chrome's
//    screenshots of the same pages (for the PDFKit side-by-side check), page counts match, sizes are sane, every
//    line's width matches, times are logged (desktop and CPU ÷4), and nothing is requested from another origin.

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
] as const;
const VARIANTS = [
  ...["classic-gold", "minimal-ivory"].flatMap((t) => ["en", "te"].flatMap((lang) => [`${t}-${lang}-short`, `${t}-${lang}-long`])),
  ...LANGS.filter((l) => l !== "en" && l !== "te").map((lang) => `classic-gold-${lang}-short`),
  ...NEW_DESIGNS.flatMap(([d, lang, c2, c3]) => [`${d}-en-short`, `${d}-en-long`, `${d}-te-short`, `${d}-${lang}-short`, `${d}-en-short-${c2}`, `${d}-en-short-${c3}`]),
  "executive-navy-en-split",
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

test("real templates in ten languages: PDF and page images, page counts, sizes, widths, timings", async ({ page }) => {
  test.setTimeout(600_000);
  const offsite = watchOffsite(page);
  await mkdir(OUT, { recursive: true });
  await page.setViewportSize({ width: 900, height: 1200 });
  await page.goto("/dev/document");
  await expect(page.locator("body")).toHaveAttribute("data-doc-ready", "1", { timeout: 60_000 });

  const timings: Record<string, { pdfMs: number; imagesMs: number; pdfKB: number; jpegKB: number[] }> = {};
  for (const id of VARIANTS) {
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

  const report = { desktop: timings, cpu4x: slow, pngKB: Math.round(png.bytes[0] / 1024) };
  await writeFile(`${OUT}/timings.json`, JSON.stringify(report, null, 2));
  console.log("Download engine:", JSON.stringify(report));
  expect(offsite).toEqual([]);
});
