import { mkdir, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

// The motif library (Step 2.0, redrawn 2026-11-22; VISION D21, D45, D47):
// 1. The symbol picker: None first and chosen, then the nineteen symbols in tradition order, as 44 px targets, and
//    the larger dialog grouped by tradition.
// 2. Every symbol through the real PDF writer (no unsupported-SVG warning) and the page images, with Chrome's
//    screenshot of the same A4 pages next to them in test-results/motifs/ (for the PDFKit side-by-side check).
// 3. The A7 review images: the contact sheet (34 px and 96 px, four palettes), the top card and the dialog at three
//    sizes in Day and Night, and a printed page with a symbol.

const OUT = "test-results/motifs";
const top = (page: Page) => page.locator('[data-section="top"]');
const symbols = (page: Page) => top(page).getByRole("radiogroup", { name: "Symbol" });

async function openNewDraft(page: Page) {
  await page.goto("/editor?new=1");
  await expect(page).toHaveURL(/\/editor\?d=[0-9a-f-]{36}$/);
  await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
}

test("the symbol picker: None first, nineteen symbols by tradition, 44 px targets, a grouped dialog", async ({ page }) => {
  await openNewDraft(page);
  const tiles = symbols(page).getByRole("radio");
  await expect(tiles).toHaveCount(20);
  await expect(tiles.first()).toHaveAccessibleName("No symbol");
  await expect(tiles.first()).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("motif-ganeshaOrnate")).toHaveAccessibleName("Ganesha, ornate");
  for (const i of [0, 7, 19]) {
    const box = (await tiles.nth(i).boundingBox())!;
    expect(box.height, `tile ${i} height`).toBeGreaterThanOrEqual(44);
    expect(box.width, `tile ${i} width`).toBeGreaterThanOrEqual(44);
  }
  // No ragged last row: every row is full.
  const ys = await tiles.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  const rows = [...new Set(ys)];
  expect(rows.length === 2 || rows.length === 4, `rows: ${rows.length}`).toBe(true);
  for (const y of rows) expect(ys.filter((v) => v === y)).toHaveLength(20 / rows.length);

  await top(page).getByRole("button", { name: "See them larger" }).click();
  const dialog = page.getByTestId("motif-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("region")).toHaveCount(7);
  await expect(dialog.getByRole("region", { name: "Muslim" }).getByRole("button")).toHaveCount(3);
  await dialog.getByRole("region", { name: "Muslim" }).getByRole("button", { name: "Allah medallion" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("motif-allahMedallion")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("top-summary")).toHaveText("Allah medallion · in the design's colours");
});

test.describe("print and review", () => {
  test.skip(({ isMobile }) => isMobile, "pages are a fixed A4 size and sizes are set here; one project is enough");
  test.use({ deviceScaleFactor: 2 });

  test("every symbol goes through the PDF writer with no warning, next to Chrome's drawing", async ({ page }) => {
    test.setTimeout(120_000);
    await mkdir(OUT, { recursive: true });
    await page.setViewportSize({ width: 1240, height: 1000 });
    await page.goto("/dev/motifs");
    await expect(page.locator("body")).toHaveAttribute("data-motifs-ready", "1", { timeout: 60_000 });
    await page.getByTestId("motif-sheet").screenshot({ path: `${OUT}/sheet.png`, animations: "disabled" });
    const names = ["gold", "maroon", "navy"];
    for (const [i, name] of names.entries()) {
      const run = await page.evaluate((n) => window.__motifs!(n).pdf(), i);
      expect(run.warnings, `${name} warnings`).toEqual([]);
      expect(run.mismatches, `${name} lines whose width differs`).toEqual([]);
      await writeFile(`${OUT}/${name}.pdf`, Buffer.from(run.pdf, "base64"));
      const images = await page.evaluate((n) => window.__motifs!(n).images("png"), i);
      expect(images.images).toHaveLength(1);
      await writeFile(`${OUT}/${name}-page-1.png`, Buffer.from(images.images[0], "base64"));
      await page.locator("[data-sheet-page]").nth(i).locator("[data-page]").screenshot({ path: `${OUT}/${name}-chrome-p1.png`, scale: "device" });
    }
  });

  test("the top card, the dialog and a printed page with a symbol, at three sizes in Day and Night", async ({ page }) => {
    test.setTimeout(180_000);
    await openNewDraft(page);
    await page.getByLabel("Name", { exact: true }).fill("Sai Teja Mandapati");
    await top(page).getByRole("radio", { name: "Ganesha", exact: true }).click();
    await top(page).getByLabel("Invocation line").selectOption("shriGaneshaya");
    await top(page).getByRole("radiogroup", { name: "Title" }).getByRole("radio", { name: "Marriage Biodata", exact: true }).click();
    await expect(page.getByTestId("save-status")).toHaveText(/Saved on this device · \d/);
    const id = new URL(page.url()).searchParams.get("d")!;
    for (const size of [
      { name: "phone", width: 390, height: 844 },
      { name: "tablet", width: 810, height: 1080 },
      { name: "desktop", width: 1440, height: 900 },
    ]) {
      await page.setViewportSize({ width: size.width, height: size.height });
      for (const theme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: theme });
        const tag = `${size.name}-${theme === "light" ? "day" : "night"}`;
        await top(page).screenshot({ path: `${OUT}/top-card-${tag}.png`, animations: "disabled" });
        await top(page).getByRole("button", { name: "See them larger" }).click();
        await expect(page.getByTestId("motif-dialog")).toBeVisible();
        await page.getByRole("dialog").screenshot({ path: `${OUT}/dialog-${tag}.png`, animations: "disabled" });
        await page.getByRole("dialog").getByRole("button", { name: "Close" }).first().click();
      }
    }
    await page.emulateMedia({ colorScheme: "light" });
    await page.setViewportSize({ width: 900, height: 1200 });
    await page.goto(`/dev/draft?d=${id}`);
    await expect(page.locator("body[data-doc-ready]")).toHaveCount(1);
    await page.locator("[data-page]").first().screenshot({ path: `${OUT}/printed-ganesha.png`, scale: "device" });
  });
});
