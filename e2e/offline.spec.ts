import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { expect, test, type Download, type Page } from "@playwright/test";
import { SAVED, openStoredDraft, readStored, sampleDraft, storedField } from "./editor-helpers";

// Step 5.2: the offline worker (public/sw.js) and the privacy promise (VISION D15). Every other spec blocks service
// workers (playwright.config.ts); this one lets the production build register it. After one visit the editor opens,
// saves and downloads with the network off; and loading and exporting never asks another site for anything, the
// worker's own requests included (the context's request log has them in Chromium).

test.use({ serviceWorkers: "allow" });

const FONTS = readdirSync("public/fonts").filter((name) => name.endsWith(".ttf"));

let requests: string[] = [];
let workerRequests: string[] = [];
let origin = "";
test.beforeEach(async ({ context, baseURL }) => {
  requests = [];
  workerRequests = [];
  origin = new URL(baseURL!).origin;
  context.on("request", (request) => {
    requests.push(request.url());
    if (request.serviceWorker()) workerRequests.push(request.url());
  });
});
test.afterEach(() => {
  const foreign = requests.filter((url) => !url.startsWith("data:") && !url.startsWith("blob:") && new URL(url).origin !== origin);
  expect(foreign, "requests to another origin").toEqual([]);
});

/** Waits until the worker has kept every file and controls the page (it claims the page as soon as it activates). */
async function waitForWorker(page: Page) {
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 60_000 });
}

/** Where the actions are: the preview column on desktop, the sheet (opened) on phones. */
async function actions(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByTestId("preview-pill").click();
    await expect(page.getByRole("dialog", { name: "Preview" })).toBeVisible();
  }
  return page.getByTestId("export-actions").filter({ visible: true });
}

/** Downloads the PDF and the page images (JPEG, one per page) from the open editor. */
async function exportBoth(page: Page, isMobile: boolean, name: string, pages: number) {
  const bar = await actions(page, isMobile);
  const [pdf] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), bar.getByRole("button", { name: "Download PDF" }).click()]);
  expect(pdf.suggestedFilename()).toBe(`${name} Biodata.pdf`);
  const pdfBytes = await readFile((await pdf.path())!);
  expect(pdfBytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  expect(pdfBytes.length).toBeGreaterThan(10_000);

  const images: Download[] = [];
  page.on("download", (download) => images.push(download));
  await bar.getByRole("button", { name: "Save as image" }).click();
  await page.getByRole("menuitem", { name: /^Save as JPEG/ }).click();
  await expect.poll(() => images.length, { timeout: 60_000 }).toBe(pages);
  expect(images[0].suggestedFilename()).toBe(pages === 1 ? `${name} Biodata.jpg` : `${name} Biodata - page 1.jpg`);
  const jpeg = await readFile((await images[0].path())!);
  expect([...jpeg.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
}

test("after one visit, the editor opens, saves and downloads with the network off", async ({ page, context, isMobile }) => {
  test.setTimeout(150_000);
  const id = `offline-${isMobile ? "phone" : "desktop"}`;
  await openStoredDraft(page, sampleDraft(id));
  await waitForWorker(page);

  // What the worker kept: the editor page, every font and the PDF engine's WebAssembly; nothing about the draft.
  const kept = await page.evaluate(async () => {
    const paths: string[] = [];
    for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) paths.push(new URL(request.url).pathname + new URL(request.url).search);
    return paths;
  });
  expect(kept).toContain("/editor");
  for (const font of FONTS) expect(kept).toContain(`/fonts/${font}`);
  expect(kept.filter((path) => path.endsWith(".wasm")).length).toBeGreaterThanOrEqual(2);
  expect(kept.filter((path) => path.includes(id)), "the draft's id is never in the cache").toEqual([]);
  // The storage card says so only now that it is true.
  await expect(page.getByTestId("storage-offline")).toHaveText(/^Works offline/);

  await context.setOffline(true);
  // The worker's own network is off too: a file it doesn't have can't be fetched (a 404 would mean it still can).
  expect(await page.evaluate(() => fetch("/_next/static/offline-probe.js").then((r) => `HTTP ${r.status}`, () => "failed"))).toBe("failed");

  const reload = await page.reload();
  expect(reload?.fromServiceWorker(), "the page came from the worker's cache").toBe(true);
  await expect(page.getByTestId("editor-form")).toBeVisible();
  const name = page.getByLabel("Name", { exact: true });
  await expect(name).toHaveValue("Sai Teja Mandapati");
  await name.fill("Ravi Kumar Mandapati");
  await expect(page.getByTestId("save-status")).toHaveText(SAVED);
  expect(storedField(await readStored(page, id), "fullName")?.value).toBe("Ravi Kumar Mandapati");
  await expect(page.locator('[data-testid="preview-pages"] [data-doc-ready="1"]').first()).toContainText("Ravi Kumar Mandapati");

  // The PDF engine (its script chunk, HarfBuzz's WebAssembly, the fonts) loads for the first time here, offline.
  await exportBoth(page, isMobile, "Ravi Kumar Mandapati", 2);
  await context.setOffline(false);
});

test("loading the editor and downloading asks no other site for anything, the worker included (D15)", async ({ page, isMobile }) => {
  test.setTimeout(120_000);
  await page.goto("/editor?new=1");
  await page.getByLabel("Name", { exact: true }).fill("Sai Teja Mandapati");
  await page.getByLabel("Place of Birth", { exact: true }).fill("Hyderabad");
  await expect(page.getByTestId("save-status")).toHaveText(SAVED);
  await waitForWorker(page);
  await exportBoth(page, isMobile, "Sai Teja Mandapati", 1);

  // The log holds the worker's own requests too (it kept every font and the WebAssembly), all to this site.
  expect(workerRequests.some((url) => url.endsWith("/fonts/NotoSansTelugu-Regular.ttf"))).toBe(true);
  expect(workerRequests.some((url) => url.endsWith(".wasm"))).toBe(true);
  expect(requests.some((url) => url.endsWith(".wasm"))).toBe(true);
  // (afterEach: every request was to this site)
});

// A7: the storage card's offline line, at phone, tablet and desktop size, Day and Night.
test("the storage card's offline line at every size, Day and Night", async ({ page, isMobile }) => {
  test.skip(isMobile, "sizes are set here, so one project is enough");
  test.setTimeout(120_000);
  await openStoredDraft(page, sampleDraft("offline-screens"));
  await waitForWorker(page);
  for (const size of [
    { name: "phone", width: 390, height: 844 },
    { name: "tablet", width: 810, height: 1080 },
    { name: "desktop", width: 1440, height: 900 },
  ]) {
    await page.setViewportSize({ width: size.width, height: size.height });
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await page.reload();
      const cards = page.getByTestId("kept-cards");
      await expect(cards.getByTestId("storage-offline")).toBeVisible();
      await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
      await cards.scrollIntoViewIfNeeded();
      await cards.screenshot({ path: `test-results/screenshots/offline-storage-${size.name}-${theme === "light" ? "day" : "night"}.png`, animations: "disabled" });
    }
  }
});
