import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

// The document engine (BUILD_PLAN Step 3.2) on /dev/document: every fixture variant (Classic Gold and Minimal
// Ivory, English and Telugu, short / sample / long, the other colour variants, the short Classic Gold biodata in
// Hindi, Tamil, Kannada, Malayalam, Marathi, Gujarati, Bengali and Punjabi, Step 4.2, and designs 3–10 in English,
// Telugu, one more Indic language and all three colours, Step 4.3; values typed in other scripts, Step 4.2) laid out
// as A4 pages. Screenshots
// of each page go to test-results/screenshots/document-<variant>-p<n>.png to be looked at (A7); the checks are the
// page counts under Auto text size (D31), that no block runs past its page's content box, that the display list
// (the Download engine's input, D49) carries every printed string, and that nothing is requested off this site.

const OUT = "test-results/screenshots";

/** Step 4.3's designs and the extra Indic language each is shown in (test/fixtures/documents.ts NEW_DESIGNS). */
const NEW_DESIGNS = [
  ["kalyanam", "hi"],
  ["temple-bells", "ta"],
  ["rangoli", "kn"],
  ["paisley", "ml"],
  ["royal-maroon", "mr"],
  ["deepam", "gu"],
  ["executive-navy", "bn"],
  ["modern-two-column", "pa"],
  ["floral-ivory", "kn"],
  ["watercolour-rose", "hi"],
  ["mango-grove", "ta"],
  ["mint-vines", "ml"],
  // Step 4.4
  ["baroque-gold", "gu"],
  ["peacock", "mr"],
  ["peach-filigree", "bn"],
  ["navy-rosette", "pa"],
  ["sandalwood", "kn"],
  ["slate-brush", "hi"],
] as const;

test.skip(({ isMobile }) => isMobile, "pages are a fixed A4 size; one project is enough");
test.use({ deviceScaleFactor: 2 });

/** Case and whitespace don't matter: lines wrap anywhere and English headings print in capitals. */
const squash = (s: string) => s.toLowerCase().replace(/\s+/g, "");

test("document pages: page counts, no overflow, display list text, screenshots, no other origin", async ({ page }) => {
  test.setTimeout(900_000); // ≈ 250 variants since Step 4.4 (20 designs, second photo)
  const offsite: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!["localhost", "127.0.0.1"].includes(url.hostname) && url.protocol !== "data:" && url.protocol !== "blob:") offsite.push(url.href);
  });
  await mkdir(OUT, { recursive: true });
  await page.setViewportSize({ width: 900, height: 1200 });
  await page.goto("/dev/document");
  await expect(page.locator("body")).toHaveAttribute("data-doc-ready", "1", { timeout: 60_000 });

  const variants = await page.evaluate(() => window.__doc!.variants);
  expect(variants.length).toBeGreaterThanOrEqual(76);
  const ids = variants.map((v) => v.id);
  for (const lang of ["hi", "ta", "kn", "ml", "mr", "gu", "bn", "pa"]) expect(ids).toContain(`classic-gold-${lang}-short`);
  // Step 4.3: designs 3–10, each in English (short and long), Telugu and one more Indic language.
  for (const [design, lang] of NEW_DESIGNS) for (const id of [`${design}-en-short`, `${design}-en-long`, `${design}-te-short`, `${design}-${lang}-short`]) expect(ids).toContain(id);

  // Soft checks: every variant is checked and screenshotted even when one fails.
  for (const v of variants) {
    const section = page.locator(`[data-variant="${v.id}"]`);
    const pages = section.locator("[data-page]");

    // Auto text size: a typical biodata fits one page; the long one flows onto exactly two (D31).
    await expect(pages, v.id).toHaveCount(v.pages);
    if (v.length === "short" || v.length === "mixed") expect.soft(v.pages, `${v.id} pages`).toBe(1);
    if (v.length === "long" || v.length === "split") expect.soft(v.pages, `${v.id} pages`).toBe(2);
    if (v.length === "split") {
      // The long paragraph continues from the bottom of page 1 to the top of page 2, split between lines.
      const lastOnFirst = await pages.nth(0).locator("[data-content] > [data-block]").last().getAttribute("data-block");
      const firstOnSecond = await pages.nth(1).locator("[data-content] > [data-block]").first().getAttribute("data-block");
      expect.soft(firstOnSecond, `${v.id} paragraph continues`).toBe(lastOnFirst);
    }
    expect.soft(v.overflow, `${v.id} overflow`).toBe(false);

    // Every block ends inside its page's content box, and nothing is wider than it.
    const problems = await pages.evaluateAll((els) =>
      els.flatMap((pageEl, p) => {
        const content = pageEl.querySelector<HTMLElement>("[data-content]")!.getBoundingClientRect();
        return [...pageEl.querySelectorAll<HTMLElement>("[data-content] > [data-block]")].flatMap((block) => {
          const r = block.getBoundingClientRect();
          const out: string[] = [];
          if (r.bottom > content.bottom + 0.5) out.push(`page ${p + 1} block ${block.dataset.block} ends ${(r.bottom - content.bottom).toFixed(1)} px below`);
          if (block.scrollWidth > block.clientWidth + 1) out.push(`page ${p + 1} block ${block.dataset.block} is too wide`);
          return out;
        });
      }),
    );
    expect.soft(problems, v.id).toEqual([]);

    // A Modern side panel (fixed, not paginated) never clips its content, and no photo frame without a photo.
    const aside = await pages.first().evaluate((pageEl) => {
      const el = pageEl.querySelector<HTMLElement>("[data-aside]");
      return el ? { clipped: el.scrollHeight > el.clientHeight + 1, photos: el.querySelectorAll("img").length } : null;
    });
    if (aside) {
      expect.soft(aside.clipped, `${v.id} side panel clipped`).toBe(false);
      expect.soft(aside.photos, `${v.id} side panel photo`).toBe(v.photos);
    }

    // Step 4.4: page 1 draws as many photos as the variant has (the second only with the main one), each inside its
    // page's content box (clear of the frame) or the Modern panel's padding, and no photo overlaps another or any text.
    const photoProblems = await pages.first().evaluate((pageEl) => {
      const out: string[] = [];
      const page = pageEl.getBoundingClientRect();
      const content = pageEl.querySelector<HTMLElement>("[data-content]")!.getBoundingClientRect();
      const aside = pageEl.querySelector<HTMLElement>("[data-aside]");
      // The photos are the dev page's JPEG placeholders (motif pictures are files).
      const imgs = [...pageEl.querySelectorAll<HTMLImageElement>('img[src^="data:image/jpeg"]')].map((img) => img.getBoundingClientRect());
      const within = (r: DOMRect, b: { left: number; right: number; top: number; bottom: number }) => r.left >= b.left - 0.5 && r.right <= b.right + 0.5 && r.top >= b.top - 0.5 && r.bottom <= b.bottom + 0.5;
      const overlap = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
      let panel: { left: number; right: number; top: number; bottom: number } | null = null;
      if (aside) {
        const r = aside.getBoundingClientRect();
        const cs = getComputedStyle(aside);
        panel = { left: r.left + parseFloat(cs.paddingLeft), right: r.right - parseFloat(cs.paddingRight), top: r.top + parseFloat(cs.paddingTop), bottom: r.bottom - parseFloat(cs.paddingBottom) };
      }
      imgs.forEach((r, i) => {
        if (!within(r, content) && !(panel && within(r, panel))) out.push(`photo ${i + 1} outside the content box (${Math.round(r.left - page.left)},${Math.round(r.top - page.top)} ${Math.round(r.width)}×${Math.round(r.height)})`);
        imgs.forEach((o, j) => j > i && overlap(r, o) && out.push(`photos ${i + 1} and ${j + 1} overlap`));
      });
      // Every piece of text on the page, by its line boxes.
      const walker = document.createTreeWalker(pageEl, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const line of range.getClientRects()) imgs.forEach((r, i) => overlap(line, r as DOMRect) && out.push(`photo ${i + 1} overlaps "${node!.textContent!.slice(0, 24)}"`));
      }
      return { count: imgs.length, problems: out };
    });
    expect.soft(photoProblems.count, `${v.id} photos on page 1`).toBe(v.photos);
    expect.soft(photoProblems.problems, `${v.id} photos`).toEqual([]);

    // The display list (what the PDF writer draws) has the text of every printed field.
    const text = await page.evaluate((id) => {
      const list = window.__doc!.displayList(id);
      return list.pages.map((pg) => pg.items.map((i) => (i.kind === "text" ? i.text : "")).join(" ")).join(" ");
    }, v.id);
    const printed = squash(text);
    const missing = v.expected.filter((s) => !printed.includes(squash(s)));
    expect.soft(missing, `${v.id} missing from the display list`).toEqual([]);

    const count = await pages.count();
    for (let i = 0; i < count; i++) await pages.nth(i).screenshot({ path: `${OUT}/document-${v.id}-p${i + 1}.png`, scale: "device" });
  }

  expect(offsite).toEqual([]);
});
