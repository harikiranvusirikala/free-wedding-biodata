import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

// The document engine (BUILD_PLAN Step 3.2) on /dev/document: every fixture variant (Classic Gold and Minimal
// Ivory, English and Telugu, short / sample / long, the other colour variants) laid out as A4 pages. Screenshots
// of each page go to test-results/screenshots/document-<variant>-p<n>.png to be looked at (A7); the checks are the
// page counts under Auto text size (D31), that no block runs past its page's content box, that the display list
// (the Download engine's input, D49) carries every printed string, and that nothing is requested off this site.

const OUT = "test-results/screenshots";

test.skip(({ isMobile }) => isMobile, "pages are a fixed A4 size; one project is enough");
test.use({ deviceScaleFactor: 2 });

/** Case and whitespace don't matter: lines wrap anywhere and English headings print in capitals. */
const squash = (s: string) => s.toLowerCase().replace(/\s+/g, "");

test("document pages: page counts, no overflow, display list text, screenshots, no other origin", async ({ page }) => {
  test.setTimeout(180_000);
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
  expect(variants.length).toBeGreaterThanOrEqual(19);

  // Soft checks: every variant is checked and screenshotted even when one fails.
  for (const v of variants) {
    const section = page.locator(`[data-variant="${v.id}"]`);
    const pages = section.locator("[data-page]");

    // Auto text size: a typical biodata fits one page; the long one flows onto exactly two (D31).
    await expect(pages, v.id).toHaveCount(v.pages);
    if (v.length === "short") expect.soft(v.pages, `${v.id} pages`).toBe(1);
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
