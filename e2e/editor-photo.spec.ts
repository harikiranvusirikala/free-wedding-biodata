import { expect, test, type Page } from "@playwright/test";
import { SAVED, drawnPng, readStored } from "./editor-helpers";

// Step 3.1 in the editor: the photo card writes its picture with the draft (one transaction, D9), restores it
// after a reload, removes it with the draft's next save, keeps it in a duplicate, and the printed page shows the
// cropped photo (/dev/draft renders a stored draft through src/lib/document-photo.ts). Pictures are drawn on a
// canvas by the test, never a real person's photo.

const status = (page: Page) => page.getByTestId("save-status");
const idOf = (page: Page) => new URL(page.url()).searchParams.get("d")!;
const card = (page: Page) => page.locator('[data-section="photo"]');

/** The photo records in this browser's database (id → owning draft), read straight from IndexedDB. */
function storedPhotos(page: Page): Promise<{ id: string; profileId: string; width: number; height: number }[]> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open("free-wedding-biodata");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const all = db.transaction("photos").objectStore("photos").getAll();
          all.onerror = () => reject(all.error);
          all.onsuccess = () => {
            db.close();
            resolve((all.result as { id: string; profileId: string; width: number; height: number }[]).map(({ id, profileId, width, height }) => ({ id, profileId, width, height })));
          };
        };
      }),
  );
}

async function newDraftWithPhoto(page: Page) {
  await page.goto("/editor?new=1");
  await expect(page).toHaveURL(/\/editor\?d=[0-9a-f-]{36}$/);
  await page.getByLabel("Name", { exact: true }).fill("Sai Teja Mandapati");
  await expect(card(page).getByRole("heading", { name: "Add your photo" })).toBeVisible();
  await card(page).getByTestId("photo-input").setInputFiles({ name: "drawn.png", mimeType: "image/png", buffer: await drawnPng(page, 1500, 2000) });
  const cropper = page.getByRole("dialog", { name: "Crop your photo" });
  await expect(cropper).toBeVisible();
  await expect.poll(() => cropper.locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0 && img.style.transform !== "")).toBe(true);
  await cropper.getByRole("slider", { name: "Zoom" }).fill("2");
  await cropper.getByRole("button", { name: "Done" }).click();
  await expect(cropper).toBeHidden();
  await expect(status(page)).toHaveText(SAVED);
  return idOf(page);
}

const cropOf = async (page: Page) => JSON.parse((await card(page).getByTestId("photo-thumb").getAttribute("data-crop")) ?? "null") as { x: number; y: number; zoom: number; rotation: number } | null;

test("a photo added and cropped is saved with the draft and restored after a reload", async ({ page }) => {
  const id = await newDraftWithPhoto(page);
  expect((await cropOf(page))?.zoom).toBeCloseTo(2, 2);
  await expect(card(page).getByTestId("photo-summary")).toHaveText("Portrait 3:4 · printed beside your details on page 1");

  const stored = await readStored(page, id);
  expect(stored.photo).toMatchObject({ frame: "3:4", crop: { zoom: 2, rotation: 0 } });
  expect(await storedPhotos(page)).toEqual([{ id: stored.photo!.id, profileId: id, width: 1500, height: 2000 }]);

  await page.reload();
  await expect(card(page).getByTestId("photo-thumb")).toHaveAttribute("data-crop", /"zoom":2/);
  await expect(card(page).getByTestId("photo-thumb").locator("img")).toHaveJSProperty("complete", true);

  // Tall 2:3 is kept too.
  await card(page).getByRole("radio", { name: "Tall 2:3" }).click();
  await expect(status(page)).toHaveText(SAVED);
  await page.reload();
  await expect(card(page).getByTestId("photo-thumb")).toHaveAttribute("data-frame", "2:3");
  expect((await readStored(page, id)).photo?.frame).toBe("2:3");
});

test("Remove asks first, and the photo is gone from the draft and the database after a reload", async ({ page }) => {
  const id = await newDraftWithPhoto(page);
  await card(page).getByRole("button", { name: "Remove", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Remove this photo?" });
  await confirm.getByRole("button", { name: "Remove photo" }).click();
  await expect(card(page).getByRole("heading", { name: "Add your photo" })).toBeVisible();
  await expect(status(page)).toHaveText(SAVED);

  await page.reload();
  await expect(card(page).getByRole("heading", { name: "Add your photo" })).toBeVisible();
  await expect(card(page).getByTestId("photo-summary")).toHaveText("Not added yet · optional");
  expect(await readStored(page, id)).not.toHaveProperty("photo");
  expect(await storedPhotos(page)).toEqual([]);
});

test("Change replaces the picture in the same save, and a duplicate keeps its own copy of the photo", async ({ page }) => {
  const id = await newDraftWithPhoto(page);
  const first = (await readStored(page, id)).photo!.id;
  await card(page).getByTestId("photo-input").setInputFiles({ name: "other.png", mimeType: "image/png", buffer: await drawnPng(page, 1200, 1600) });
  await page.getByRole("dialog", { name: "Crop your photo" }).getByRole("button", { name: "Done" }).click();
  await expect(status(page)).toHaveText(SAVED);
  const second = (await readStored(page, id)).photo!.id;
  expect(second).not.toBe(first);
  expect(await storedPhotos(page)).toEqual([{ id: second, profileId: id, width: 1200, height: 1600 }]);

  await page.getByTestId("draft-title").click();
  await page.getByRole("menuitem", { name: "Duplicate" }).click();
  await expect(page).not.toHaveURL(new RegExp(id));
  const copyId = idOf(page);
  await expect(card(page).getByTestId("photo-thumb")).toHaveAttribute("data-crop", /"zoom"/);
  const copy = await readStored(page, copyId);
  expect(copy.photo?.id).not.toBe(second);
  const photos = await storedPhotos(page);
  expect(photos).toHaveLength(2);
  expect(photos).toContainEqual({ id: copy.photo!.id, profileId: copyId, width: 1200, height: 1600 });

  // Deleting the copy deletes its photo only.
  await page.getByTestId("draft-title").click();
  await page.getByRole("menuitem", { name: "Delete…" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete draft" }).click();
  await expect(page).toHaveURL(new RegExp(id));
  expect(await storedPhotos(page)).toEqual([{ id: second, profileId: id, width: 1200, height: 1600 }]);
});

test("the stored photo, cropped, is printed on page 1", async ({ page, isMobile }) => {
  test.skip(isMobile, "the printed page is the same on every screen");
  const id = await newDraftWithPhoto(page);
  await page.goto(`/dev/draft?d=${id}`);
  await expect(page.locator("body[data-doc-ready]")).toHaveCount(1);
  const photo = page.locator("[data-page]").first().locator('img[src^="data:image/jpeg"]');
  await expect(photo).toHaveCount(1);
  const size = await photo.evaluate((img: HTMLImageElement) => ({ w: img.naturalWidth, h: img.naturalHeight, cssW: img.width, cssH: img.height }));
  // Zoom 2 on a 1500 px wide picture leaves 750 source pixels across, more than the 300 dpi frame needs.
  expect(size.w).toBe(Math.round((56 / 25.4) * 300));
  expect(size.h / size.w).toBeCloseTo(4 / 3, 2);
  expect(size.cssH / size.cssW).toBeCloseTo(4 / 3, 1);
  await page.locator("[data-page]").first().screenshot({ path: "test-results/screenshots/document-photo-page.png", animations: "disabled" });

  // Without a photo, no frame is drawn.
  await page.goto(`/editor?d=${id}`);
  await card(page).getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("dialog", { name: "Remove this photo?" }).getByRole("button", { name: "Remove photo" }).click();
  await expect(status(page)).toHaveText(SAVED);
  await page.goto(`/dev/draft?d=${id}`);
  await expect(page.locator("body[data-doc-ready]")).toHaveCount(1);
  await expect(page.locator("[data-page] img")).toHaveCount(0);
});

test("a newly added photo shows in the live preview at once, without changing the frame (desktop)", async ({ page, isMobile }) => {
  test.skip(isMobile, "the preview column is a desktop layout");
  // The picture is written with the next save, a moment after Done; the preview must not wait for that (or for a
  // frame change, the bug this guards against) to draw it.
  await newDraftWithPhoto(page);
  const printed = page.locator('[data-testid="preview-pages"] [data-page="1"] img[src^="data:image/jpeg"]');
  await expect(printed).toHaveCount(1);
  await expect(printed).toHaveJSProperty("complete", true);
});
