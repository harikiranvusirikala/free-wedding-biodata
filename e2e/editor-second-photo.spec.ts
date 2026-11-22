import { expect, test, type Page } from "@playwright/test";
import { SAVED, drawnPng, readStored } from "./editor-helpers";

// Step 4.4: the second photo on page 1 (VISION D40), at the foot of the Photo card. It is written with the draft
// (one transaction, D9), restored after a reload, printed on page 1 beside the main photo in the live preview and
// the printed pages (/dev/draft), removed with Undo, kept in a duplicate, and printed only while there is a main
// photo. Pictures are drawn on a canvas by the test, never a real person's photo. Screenshots of the card go to
// test-results/screenshots/ (e2e/screens.spec.ts covers the card at every size).

const status = (page: Page) => page.getByTestId("save-status");
const idOf = (page: Page) => new URL(page.url()).searchParams.get("d")!;
const card = (page: Page) => page.locator('[data-section="photo"]');
const second = (page: Page) => card(page).getByTestId("second-photo");

function storedPhotoIds(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open("free-wedding-biodata");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const all = db.transaction("photos").objectStore("photos").getAllKeys();
          all.onerror = () => reject(all.error);
          all.onsuccess = () => {
            db.close();
            resolve((all.result as string[]).sort());
          };
        };
      }),
  );
}

async function cropDone(page: Page, zoom?: string) {
  const cropper = page.getByRole("dialog", { name: "Crop your photo" });
  await expect(cropper).toBeVisible();
  await expect.poll(() => cropper.locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0 && img.style.transform !== "")).toBe(true);
  if (zoom) await cropper.getByRole("slider", { name: "Zoom" }).fill(zoom);
  await cropper.getByRole("button", { name: "Done" }).click();
  await expect(cropper).toBeHidden();
}

async function draftWithTwoPhotos(page: Page) {
  await page.goto("/editor?new=1");
  await expect(page).toHaveURL(/\/editor\?d=[0-9a-f-]{36}$/);
  await page.getByLabel("Name", { exact: true }).fill("Sai Teja Mandapati");
  // No second photo control before there is a main photo.
  await expect(second(page)).toHaveCount(0);
  await card(page).getByTestId("photo-input").setInputFiles({ name: "drawn.png", mimeType: "image/png", buffer: await drawnPng(page, 1500, 2000) });
  await cropDone(page);
  await expect(second(page).getByRole("heading", { name: "Second photo" })).toBeVisible();
  await second(page).getByTestId("second-photo-input").setInputFiles({ name: "full.png", mimeType: "image/png", buffer: await drawnPng(page, 1200, 2000) });
  await cropDone(page, "1.5");
  await expect(status(page)).toHaveText(SAVED);
  return idOf(page);
}

test("a second photo is saved with the draft, restored after a reload and kept in a duplicate", async ({ page }) => {
  const id = await draftWithTwoPhotos(page);
  const stored = await readStored(page, id);
  expect(stored.secondPhoto).toMatchObject({ crop: { zoom: 1.5, rotation: 0 } });
  expect(stored.secondPhoto!.id).not.toBe(stored.photo!.id);
  expect(await storedPhotoIds(page)).toEqual([stored.photo!.id, stored.secondPhoto!.id].sort());
  await expect(card(page).getByTestId("photo-summary")).toHaveText("Portrait 3:4 and a second photo · printed on page 1");
  await second(page).screenshot({ path: `test-results/screenshots/second-photo-card-${test.info().project.name}.png`, animations: "disabled" });

  await page.reload();
  await expect(second(page).getByTestId("second-photo-thumb")).toHaveAttribute("data-crop", /"zoom":1.5/);
  await expect(second(page).getByTestId("second-photo-thumb").locator("img")).toHaveJSProperty("complete", true);

  await page.getByTestId("draft-title").click();
  await page.getByRole("menuitem", { name: "Duplicate" }).click();
  await expect(page).not.toHaveURL(new RegExp(id));
  const copy = await readStored(page, idOf(page));
  expect(copy.secondPhoto?.id).toBeTruthy();
  expect(copy.secondPhoto!.id).not.toBe(stored.secondPhoto!.id);
  expect(await storedPhotoIds(page)).toHaveLength(4);
  await expect(second(page).getByTestId("second-photo-thumb").locator("img")).toHaveJSProperty("complete", true);
});

test("the second photo prints on page 1 beside the main one, in the preview and the printed pages", async ({ page, isMobile }) => {
  test.skip(isMobile, "the printed page is the same on every screen; the preview column is a desktop layout");
  const id = await draftWithTwoPhotos(page);
  const preview = page.locator('[data-testid="preview-pages"] [data-page="1"] img[src^="data:image/jpeg"]');
  await expect(preview).toHaveCount(2);

  await page.goto(`/dev/draft?d=${id}`);
  await expect(page.locator("body[data-doc-ready]")).toHaveCount(1);
  const photos = page.locator("[data-page]").first().locator('img[src^="data:image/jpeg"]');
  await expect(photos).toHaveCount(2);
  const sizes = await photos.evaluateAll((imgs) => imgs.map((img) => ({ w: (img as HTMLImageElement).width, h: (img as HTMLImageElement).height, nw: (img as HTMLImageElement).naturalWidth })));
  // The main photo 3:4; the second tall 2:3, smaller, drawn at 300 dpi for its 42 mm.
  expect(sizes[0].h / sizes[0].w).toBeCloseTo(4 / 3, 1);
  expect(sizes[1].h / sizes[1].w).toBeCloseTo(1.5, 1);
  expect(sizes[1].w).toBeLessThan(sizes[0].w);
  expect(sizes[1].nw).toBe(Math.round((42 / 25.4) * 300));
  await page.locator("[data-page]").first().screenshot({ path: "test-results/screenshots/document-second-photo-page.png", animations: "disabled" });
});

test("Remove offers Undo; without a main photo the second photo waits and doesn't print", async ({ page, isMobile }) => {
  const id = await draftWithTwoPhotos(page);
  const { secondPhoto } = await readStored(page, id);

  await second(page).getByRole("button", { name: "Remove the second photo" }).click();
  await expect(page.getByTestId("manage-toast")).toContainText("Second photo removed.");
  await expect(second(page).getByRole("button", { name: "Add second photo" })).toBeVisible();
  await expect(status(page)).toHaveText(SAVED);
  expect(await readStored(page, id)).not.toHaveProperty("secondPhoto");
  expect(await storedPhotoIds(page)).not.toContain(secondPhoto!.id);

  await page.getByTestId("manage-toast").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("manage-toast")).toContainText("Second photo is back.");
  await expect(second(page).getByTestId("second-photo-thumb").locator("img")).toHaveJSProperty("complete", true);
  await expect(status(page)).toHaveText(SAVED);
  expect((await readStored(page, id)).secondPhoto).toEqual(secondPhoto);
  expect(await storedPhotoIds(page)).toContain(secondPhoto!.id);

  // The main photo goes: the second stays in the draft, says it waits for a main photo, and doesn't print.
  await card(page).getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("dialog", { name: "Remove this photo?" }).getByRole("button", { name: "Remove photo" }).click();
  await expect(second(page).getByTestId("second-photo-needs-main")).toHaveText("Printed only with a main photo: add one above.");
  await expect(status(page)).toHaveText(SAVED);
  expect((await readStored(page, id)).secondPhoto).toEqual(secondPhoto);
  if (isMobile) return;
  await page.goto(`/dev/draft?d=${id}`);
  await expect(page.locator("body[data-doc-ready]")).toHaveCount(1);
  await expect(page.locator("[data-page] img")).toHaveCount(0);
});

test("the Photo card with both photos at phone, tablet and desktop size, Day and Night (A7)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the sizes are set here");
  await draftWithTwoPhotos(page);
  for (const size of [
    { name: "phone", width: 390, height: 844 },
    { name: "tablet", width: 810, height: 1080 },
    { name: "desktop", width: 1440, height: 900 },
  ]) {
    await page.setViewportSize({ width: size.width, height: size.height });
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
      await card(page).scrollIntoViewIfNeeded();
      await expect(second(page).getByTestId("second-photo-thumb").locator("img")).toHaveJSProperty("complete", true);
      await card(page).screenshot({ path: `test-results/screenshots/editor-second-photo-${size.name}-${theme === "light" ? "day" : "night"}.png`, animations: "disabled" });
      if (size.name === "desktop") await page.screenshot({ path: `test-results/screenshots/editor-second-photo-page-${theme === "light" ? "day" : "night"}.png`, animations: "disabled" });
    }
  }
  // The card stays inside a 360 px phone without scrolling sideways.
  await page.setViewportSize({ width: 360, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
