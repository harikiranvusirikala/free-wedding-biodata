import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

// PDF spike (BUILD_PLAN Step 0.2): the reference page's screenshots (what every engine is compared with),
// its display list (input to the vector writer, candidate C) and candidate B, Chrome's own PDF.

const OUT = "test-results/spike"; // git-ignored; the curated evidence is in docs/spikes/

test.skip(({ isMobile }) => isMobile, "the spike runs once, on desktop Chrome");
test.use({ deviceScaleFactor: 2 }); // sharp screenshots, to compare glyph shapes with each PDF

test("reference page: screenshots, display list and Chrome's PDF (candidate B)", async ({ page }) => {
  test.setTimeout(120_000);
  await mkdir(OUT, { recursive: true });
  await page.setViewportSize({ width: 900, height: 1200 });
  await page.goto("/dev/pdf-spike");
  await expect(page.locator("body")).toHaveAttribute("data-spike-ready", "1", { timeout: 30_000 });

  const pages = page.locator("[data-page]");
  const count = await pages.count();
  expect(count).toBe(11);
  const langs = await pages.evaluateAll((els) => els.map((el) => el.getAttribute("lang")));
  for (let i = 0; i < count; i++) {
    const name = i < 2 ? `en-p${i + 1}` : langs[i];
    await pages.nth(i).screenshot({ path: `${OUT}/reference-${name}.png`, scale: "device" });
  }

  const list = await page.evaluate(() => window.__spike!.displayList());
  expect(list.pages).toHaveLength(11);
  await writeFile(`${OUT}/display-list.json`, JSON.stringify(list));

  const started = Date.now();
  await page.emulateMedia({ media: "print" });
  const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, preferCSSPageSize: true });
  await writeFile(`${OUT}/B-all.pdf`, pdf);
  console.log(`B: ${pdf.length} bytes in ${Date.now() - started} ms`);
});
