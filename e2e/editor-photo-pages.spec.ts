import { mkdir, readFile, writeFile } from "node:fs/promises";
import { PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { expect, test, type Download, type Locator, type Page } from "@playwright/test";
import type { BiodataProfile } from "../src/biodata/types";
import { SAVED, drawnPhoto, openStoredDraft, readStored, sampleDraft, switchToDetailed } from "./editor-helpers";

// Step 4.2b: photo pages and the attached horoscope page (VISION D40, D41). The "More photos" card adds up to 8 extra
// photos and a horoscope chart picture; the preview, the PDF, the page images and print all show them after the
// biodata's own pages (D1), the pages can be switched off without losing a photo, every picture lives and dies with
// its draft (duplicate, delete, backup), and nothing is requested from another origin. Pictures are drawn on a canvas
// by the test, never a real person's photo.

const status = (page: Page) => page.getByTestId("save-status");
const card = (page: Page) => page.locator('[data-section="photoPages"]');
const tiles = (page: Page) => card(page).getByTestId("pages-tile");
const idOf = (page: Page) => new URL(page.url()).searchParams.get("d")!;
const docRoot = (page: Page) => page.locator('[data-testid="preview-pages"] [data-doc-ready="1"]');
const HUES = [20, 110, 200, 290, 60, 150, 240, 330];

let foreign: string[] = [];
test.beforeEach(async ({ page, baseURL }) => {
  foreign = [];
  const origin = new URL(baseURL!).origin;
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith("data:") && !url.startsWith("blob:")) foreign.push(url);
  });
});
test.afterEach(() => {
  expect(foreign, "requests to another origin").toEqual([]);
});

/** The photo records in this browser's database. */
function storedPhotos(page: Page): Promise<{ id: string; profileId: string }[]> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open("free-wedding-biodata");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const all = open.result.transaction("photos").objectStore("photos").getAll();
          all.onerror = () => reject(all.error);
          all.onsuccess = () => {
            open.result.close();
            resolve((all.result as { id: string; profileId: string }[]).map(({ id, profileId }) => ({ id, profileId })));
          };
        };
      }),
  );
}

async function files(page: Page, count: number, { size = [1500, 2000], grain = false }: { size?: [number, number]; grain?: boolean } = {}) {
  const out = [];
  // Heavy drawings go in as JPEGs, as a phone's photos are (a PNG of 3000 px with grain is 20 MB).
  const jpeg = grain;
  for (let i = 0; i < count; i++) out.push({ name: `p${i + 1}.${jpeg ? "jpg" : "png"}`, mimeType: jpeg ? "image/jpeg" : "image/png", buffer: await drawnPhoto(page, size[0], size[1], HUES[i % HUES.length], `Photo ${i + 1}`, { grain, jpeg }) });
  return out;
}

async function newDraft(page: Page, name = "Sai Teja Mandapati") {
  await page.goto("/editor?new=1");
  await expect(page).toHaveURL(/\/editor\?d=[0-9a-f-]{36}$/);
  await page.getByLabel("Name", { exact: true }).fill(name);
  await expect(status(page)).toHaveText(SAVED);
}

async function addPhotos(page: Page, count: number, options?: Parameters<typeof files>[2]) {
  await card(page).getByTestId("pages-input").setInputFiles(await files(page, count, options));
  // Preparing each picture (decode, shrink, JPEG) takes a moment on a busy machine.
  await expect(tiles(page)).toHaveCount(count, { timeout: 30_000 });
  await expect(card(page).getByTestId("pages-counter")).toContainText("of 8 photos");
  await expect(status(page)).toHaveText(SAVED, { timeout: 15_000 });
}

async function addChart(page: Page) {
  await card(page).getByTestId("chart-input").setInputFiles({ name: "chart.png", mimeType: "image/png", buffer: await drawnPhoto(page, 1600, 1600, 200, "Chart") });
  await expect(card(page).getByTestId("chart-thumb").locator("img")).toBeVisible();
  await expect(status(page)).toHaveText(SAVED);
}

const order = (page: Page) => tiles(page).evaluateAll((els) => els.map((el) => el.getAttribute("data-photo-id")!));

/** The average colour of a picture, to tell the drawn photos apart. */
const colourOf = (img: Locator) =>
  img.evaluate((el: HTMLImageElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const c = canvas.getContext("2d")!;
    c.drawImage(el, 0, 0, 1, 1);
    return [...c.getImageData(0, 0, 1, 1).data.slice(0, 3)];
  });
const near = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const previewPages = (page: Page) => page.locator('[data-testid="preview-pages"] [data-page]');
const extraPhotoImgs = (page: Page) => page.locator('[data-testid="preview-pages"] [data-extra-page="photos"] img');

test.describe("desktop", () => {
  test.skip(({ isMobile }) => isMobile, "the preview column and the page checks are desktop layouts");

  test("3 photos and a horoscope scan: 1 page of details + 3 photo pages + the chart's page; reorder, replace, remove with Undo", async ({ page }) => {
    test.setTimeout(90_000);
    await newDraft(page);
    await expect(card(page).getByRole("heading", { name: "Add photos on extra pages" })).toBeVisible();
    await expect(card(page).getByTestId("pages-summary")).toHaveText("Not added yet · optional");
    await addPhotos(page, 3);
    await addChart(page);

    await expect(card(page).getByTestId("pages-counter")).toHaveText("3 of 8 photos");
    await expect(card(page).getByTestId("pages-summary")).toHaveText("3 of 8 photos · horoscope chart");
    await expect(docRoot(page)).toHaveAttribute("data-doc-pages", "1");
    await expect(docRoot(page)).toHaveAttribute("data-doc-photo-pages", "3");
    await expect(docRoot(page)).toHaveAttribute("data-doc-chart-page", "1");
    await expect(previewPages(page)).toHaveCount(5);
    await expect(page.getByTestId("preview-status")).toHaveText("1 page of details + 3 photo pages + horoscope page · A4");
    await expect(extraPhotoImgs(page)).toHaveCount(3);
    // The photo pages are real pages in the design's frame: numbered on, and drawn with blob: pictures.
    await expect(page.locator('[data-testid="preview-pages"] [data-page="4"] img')).toHaveAttribute("src", /^blob:/);

    const stored = await readStored(page, idOf(page));
    expect(stored.photoPages).toMatchObject({ perPage: 1 });
    expect(stored.photoPages!.photos).toHaveLength(3);
    expect(stored.horoscopeChart?.id).toBeTruthy();
    expect(await storedPhotos(page)).toHaveLength(4);
    const ids = await order(page);
    expect(stored.photoPages!.photos.map((p) => p.id)).toEqual(ids);

    // Each preview page shows its own photo, in order.
    const tileColours: number[][] = [];
    for (const tile of await tiles(page).all()) tileColours.push(await colourOf(tile.locator("img")));
    const pageColours = async () => Promise.all((await extraPhotoImgs(page).all()).map((img) => colourOf(img)));
    for (const [i, colour] of (await pageColours()).entries()) expect(near(colour, tileColours[i])).toBeLessThan(40);

    // Reorder: photo 3 earlier.
    await card(page).getByRole("button", { name: "Move photo 3 earlier" }).click();
    await expect(status(page)).toHaveText(SAVED);
    expect(await order(page)).toEqual([ids[0], ids[2], ids[1]]);
    expect((await readStored(page, idOf(page))).photoPages!.photos.map((p) => p.id)).toEqual([ids[0], ids[2], ids[1]]);
    await expect(card(page).getByRole("button", { name: "Move photo 1 earlier" })).toBeDisabled();
    await expect(card(page).getByRole("button", { name: "Move photo 3 later" })).toBeDisabled();
    await expect.poll(async () => near((await pageColours())[1], tileColours[2])).toBeLessThan(40);
    await card(page).getByRole("button", { name: "Move photo 2 later" }).click();
    expect(await order(page)).toEqual(ids);

    // Replace photo 2: a new picture in the same place, the old one gone from the database.
    await card(page).getByRole("button", { name: "Replace photo 2" }).click();
    await card(page).getByTestId("pages-replace-input").setInputFiles({ name: "new.png", mimeType: "image/png", buffer: await drawnPhoto(page, 1200, 1600, 330, "New") });
    const cropper = page.getByRole("dialog", { name: "Crop your photo" });
    await expect(cropper).toBeVisible();
    await cropper.getByRole("button", { name: "Done" }).click();
    await expect(cropper).toBeHidden();
    await expect(status(page)).toHaveText(SAVED);
    const afterReplace = await order(page);
    expect(afterReplace[0]).toBe(ids[0]);
    expect(afterReplace[1]).not.toBe(ids[1]);
    expect(afterReplace[2]).toBe(ids[2]);
    const records = (await storedPhotos(page)).map((p) => p.id);
    expect(records).toContain(afterReplace[1]);
    expect(records).not.toContain(ids[1]);
    await expect.poll(async () => near((await pageColours())[1], await colourOf(tiles(page).nth(1).locator("img")))).toBeLessThan(40);

    // Remove photo 1, then Undo: it comes back in its place, with its picture.
    await card(page).getByRole("button", { name: "Remove photo 1" }).click();
    await expect(tiles(page)).toHaveCount(2);
    await expect(page.getByTestId("manage-toast")).toContainText("Photo 1 removed.");
    await expect(docRoot(page)).toHaveAttribute("data-doc-photo-pages", "2");
    await expect(status(page)).toHaveText(SAVED);
    expect((await storedPhotos(page)).map((p) => p.id)).not.toContain(ids[0]);
    await page.getByTestId("manage-toast").getByRole("button", { name: "Undo" }).click();
    await expect(tiles(page)).toHaveCount(3);
    expect(await order(page)).toEqual(afterReplace);
    await expect(docRoot(page)).toHaveAttribute("data-doc-photo-pages", "3");
    await expect(status(page)).toHaveText(SAVED);
    expect((await storedPhotos(page)).map((p) => p.id)).toContain(ids[0]);
    await expect(tiles(page).first().locator("img")).toBeVisible();

    // The chart: rotate, remove with Undo.
    await card(page).getByRole("button", { name: "Rotate" }).click();
    await expect(status(page)).toHaveText(SAVED);
    expect((await readStored(page, idOf(page))).horoscopeChart!.crop.rotation).toBe(90);
    await card(page).getByRole("button", { name: "Remove", exact: true }).click();
    await expect(docRoot(page)).toHaveAttribute("data-doc-chart-page", "0");
    await page.getByTestId("manage-toast").getByRole("button", { name: "Undo" }).click();
    await expect(docRoot(page)).toHaveAttribute("data-doc-chart-page", "1");
    await expect(status(page)).toHaveText(SAVED);
    expect((await readStored(page, idOf(page))).horoscopeChart?.crop.rotation).toBe(90);

    // Everything survives a reload, and the preview draws it again.
    await page.reload();
    await expect(tiles(page)).toHaveCount(3);
    expect(await order(page)).toEqual(afterReplace);
    await expect(card(page).getByTestId("chart-thumb").locator("img")).toBeVisible();
    await expect(docRoot(page)).toHaveAttribute("data-doc-photo-pages", "3");
    await expect(previewPages(page)).toHaveCount(5);
  });

  test("switching 'Include photo pages' off removes the pages but keeps the photos; the chart has its own switch", async ({ page }) => {
    await newDraft(page);
    await addPhotos(page, 2);
    await addChart(page);
    await expect(previewPages(page)).toHaveCount(4);
    const photoSwitch = card(page).getByRole("switch", { name: "Include photo pages" });
    await expect(photoSwitch).toHaveAttribute("aria-checked", "true");
    await photoSwitch.click();
    await expect(photoSwitch).toHaveAttribute("aria-checked", "false");
    await expect(docRoot(page)).toHaveAttribute("data-doc-photo-pages", "0");
    await expect(previewPages(page)).toHaveCount(2);
    await expect(card(page).getByTestId("pages-off-note")).toBeVisible();
    await expect(card(page).getByTestId("pages-summary")).toHaveText("2 of 8 photos · horoscope chart · pages switched off");
    await expect(tiles(page)).toHaveCount(2);
    await expect(status(page)).toHaveText(SAVED);
    expect((await readStored(page, idOf(page))).photoPages).toMatchObject({ include: false });
    expect(await storedPhotos(page)).toHaveLength(3);

    const chartSwitch = card(page).getByRole("switch", { name: "Include horoscope page" });
    await chartSwitch.click();
    await expect(previewPages(page)).toHaveCount(1);
    await expect(page.getByTestId("preview-status")).toHaveText("Fits on 1 page · A4");
    await expect(status(page)).toHaveText(SAVED);

    // Reload: still off, photos still there; turning on brings the pages back.
    await page.reload();
    await expect(tiles(page)).toHaveCount(2);
    await expect(photoSwitch).toHaveAttribute("aria-checked", "false");
    await expect(previewPages(page)).toHaveCount(1);
    await photoSwitch.click();
    await chartSwitch.click();
    await expect(previewPages(page)).toHaveCount(4);
    await expect(status(page)).toHaveText(SAVED);
    expect((await readStored(page, idOf(page))).photoPages).not.toHaveProperty("include");
  });

  test("2 and 4 to a page: the pages follow the layout; eight photos is the most", async ({ page }) => {
    test.setTimeout(90_000);
    await newDraft(page);
    await addPhotos(page, 8);
    await expect(card(page).getByTestId("pages-counter")).toHaveText("8 of 8 photos");
    await expect(card(page).getByTestId("pages-full")).toBeVisible();
    await expect(card(page).getByRole("button", { name: "Add more photos" })).toBeDisabled();
    await expect(docRoot(page)).toHaveAttribute("data-doc-photo-pages", "8");
    await expect(previewPages(page)).toHaveCount(9);

    // A ninth is refused: nothing is added.
    await card(page).getByTestId("pages-input").setInputFiles(await files(page, 1));
    await expect(tiles(page)).toHaveCount(8);

    const layout = card(page).getByRole("radiogroup", { name: "Photos per page" });
    await layout.getByRole("radio", { name: "2 per page" }).click();
    await expect(docRoot(page)).toHaveAttribute("data-doc-photo-pages", "4");
    await expect(previewPages(page)).toHaveCount(5);
    await expect(extraPhotoImgs(page)).toHaveCount(8);
    await expect(card(page).getByTestId("pages-layout-hint")).toContainText("These take 4 pages.");
    // Two photos sit side by side on one page, the same size.
    const pair = await page.locator('[data-testid="preview-pages"] [data-page="2"] img').evaluateAll((imgs) => imgs.map((i) => i.getBoundingClientRect()));
    expect(pair).toHaveLength(2);
    expect(Math.abs(pair[0].top - pair[1].top)).toBeLessThan(1);
    expect(Math.abs(pair[0].width - pair[1].width)).toBeLessThan(1);
    expect(pair[1].left).toBeGreaterThan(pair[0].right);

    await layout.getByRole("radio", { name: "4 per page" }).click();
    await expect(docRoot(page)).toHaveAttribute("data-doc-photo-pages", "2");
    await expect(previewPages(page)).toHaveCount(3);
    await expect(status(page)).toHaveText(SAVED);
    expect((await readStored(page, idOf(page))).photoPages!.perPage).toBe(4);
    await expect(page.getByTestId("preview-status")).toHaveText("1 page of details + 2 photo pages · A4");

    // Removing down to 5 photos at 4 a page: the last page holds one photo.
    for (let i = 0; i < 3; i++) await card(page).getByRole("button", { name: "Remove photo 1" }).click();
    await expect(docRoot(page)).toHaveAttribute("data-doc-photo-pages", "2");
    await expect(extraPhotoImgs(page)).toHaveCount(5);
  });

  test("relaxed spacing and the page count of the details are decided without the photo pages", async ({ page }) => {
    test.setTimeout(90_000);
    await newDraft(page);
    await page.getByLabel("Place of Birth", { exact: true }).fill("Hyderabad");
    await expect(page.locator('[data-testid="preview-pages"] [data-page="1"]')).toContainText("Hyderabad");
    await expect(docRoot(page)).toHaveAttribute("data-doc-pages", "1");
    const before = { relax: await docRoot(page).getAttribute("data-doc-relax"), step: await docRoot(page).getAttribute("data-doc-step") };
    const detailsHeight = () => page.locator('[data-testid="preview-pages"] [data-page="1"] [data-content] > [data-block]').last().evaluate((el: HTMLElement) => el.offsetTop + el.offsetHeight); // true-size layout px, whatever the preview's scale
    const bottomBefore = await detailsHeight();
    expect(Number(before.relax)).toBeGreaterThan(1);

    await addPhotos(page, 3);
    await addChart(page);
    await expect(previewPages(page)).toHaveCount(5);
    await expect(docRoot(page)).toHaveAttribute("data-doc-pages", "1");
    await expect(docRoot(page)).toHaveAttribute("data-doc-relax", before.relax!);
    await expect(docRoot(page)).toHaveAttribute("data-doc-step", before.step!);
    expect(Math.abs((await detailsHeight()) - bottomBefore)).toBeLessThan(0.5);
    // The photo pages carry no relaxed spacing of their own.
    await expect(page.locator('[data-testid="preview-pages"] [data-page="3"]')).not.toHaveAttribute("style", /--doc-relax/);
  });

  test("Download PDF has every page, each picture embedded once; Save as image gives one file per page", async ({ page }) => {
    test.setTimeout(120_000);
    await newDraft(page);
    const baseline = await (async () => {
      const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download PDF" }).click()]);
      return (await readFile((await download.path())!)).length;
    })();
    await addPhotos(page, 3);
    await addChart(page);
    await expect(previewPages(page)).toHaveCount(5);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download PDF" }).click()]);
    expect(download.suggestedFilename()).toBe("Sai Teja Mandapati Biodata.pdf");
    const bytes = await readFile((await download.path())!);
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(pdf.getPageCount()).toBe(5);
    const images = [...pdf.context.enumerateIndirectObjects()].filter(([, object]) => {
      if (!(object instanceof PDFRawStream)) return false;
      return object.dict.get(PDFName.of("Subtype")) === PDFName.of("Image");
    });
    // 3 photos + the chart, each once (the biodata itself draws no picture).
    expect(images).toHaveLength(4);
    expect(bytes.length).toBeGreaterThan(baseline);

    // The same photos again on a second download, and with 2 per page the page count follows.
    await card(page).getByRole("radio", { name: "2 per page" }).click();
    await expect(previewPages(page)).toHaveCount(4);
    const [again] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download PDF" }).click()]);
    const second = await PDFDocument.load(await readFile((await again.path())!), { updateMetadata: false });
    expect(second.getPageCount()).toBe(4);

    // Images: one JPEG per page, named by page.
    const downloads: Download[] = [];
    page.on("download", (d) => downloads.push(d));
    await page.getByRole("button", { name: "Save as image" }).click();
    await page.getByRole("menuitem", { name: /^Save as JPEG/ }).click();
    await expect.poll(() => downloads.length, { timeout: 60_000 }).toBe(4);
    expect(downloads.map((d) => d.suggestedFilename())).toEqual([1, 2, 3, 4].map((n) => `Sai Teja Mandapati Biodata - page ${n}.jpg`));
    for (const d of downloads) expect((await readFile((await d.path())!)).subarray(0, 3).toString("hex")).toBe("ffd8ff");
  });

  test("the print copy carries the photo pages", async ({ page }) => {
    await newDraft(page);
    await addPhotos(page, 2);
    await expect(previewPages(page)).toHaveCount(3);
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    const copy = page.locator(".print-pages [data-page]");
    await expect(copy).toHaveCount(3);
    await expect(page.locator(".print-pages [data-extra-page='photos'] img")).toHaveCount(2);
    expect(await page.locator(".print-pages [data-extra-page='photos'] img").first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  });

  test("a duplicate copies every picture; deleting a draft deletes its pictures; a backup keeps all of them", async ({ page }) => {
    test.setTimeout(120_000);
    await newDraft(page);
    const original = idOf(page);
    await addPhotos(page, 3);
    await addChart(page);
    await card(page).getByRole("radio", { name: "2 per page" }).click();
    await card(page).getByRole("switch", { name: "Include horoscope page" }).click();
    await expect(status(page)).toHaveText(SAVED);
    const source = await readStored(page, original);

    // Duplicate.
    await page.getByTestId("draft-title").click();
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    await expect(page).not.toHaveURL(new RegExp(original));
    const copyId = idOf(page);
    await expect(tiles(page)).toHaveCount(3);
    const copy = await readStored(page, copyId);
    expect(copy.photoPages).toMatchObject({ perPage: 2, photos: [{}, {}, {}] });
    expect(copy.horoscopeChart).toMatchObject({ include: false });
    const sourceIds = new Set([...source.photoPages!.photos.map((p) => p.id), source.horoscopeChart!.id]);
    const copyIds = [...copy.photoPages!.photos.map((p) => p.id), copy.horoscopeChart!.id];
    for (const id of copyIds) expect(sourceIds.has(id)).toBe(false);
    const stored = await storedPhotos(page);
    expect(stored.filter((p) => p.profileId === copyId).map((p) => p.id).sort()).toEqual([...copyIds].sort());
    expect(stored.filter((p) => p.profileId === original)).toHaveLength(4);
    await expect(tiles(page).first().locator("img")).toBeVisible();
    await expect(previewPages(page)).toHaveCount(3); // 1 + 2 photo pages (the chart is off)

    // Backup of everything, then delete all local data, then restore.
    await page.getByTestId("draft-title").click();
    await page.getByRole("menuitem", { name: "Download a backup of all my drafts…" }).click();
    const dialog = page.getByRole("dialog", { name: "Download a backup" });
    const [file] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Download backup" }).click()]);
    const text = (await readFile((await file.path())!)).toString("utf8");
    const json = JSON.parse(text) as { drafts: { profile: BiodataProfile; photos: { id: string }[] }[] };
    expect(json.drafts).toHaveLength(2);
    for (const draft of json.drafts) expect(draft.photos).toHaveLength(4);
    await page.keyboard.press("Escape");

    // Deleting the copy deletes its pictures only.
    await page.getByTestId("draft-title").click();
    await page.getByRole("menuitem", { name: "Delete…" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete draft" }).click();
    await expect(page).toHaveURL(new RegExp(original));
    expect((await storedPhotos(page)).map((p) => p.profileId)).toEqual([original, original, original, original]);

    // Delete all my local data, restore the backup: every picture is back.
    await page.getByTestId("draft-title").click();
    await page.getByRole("menuitem", { name: "Delete all my local data…" }).click();
    const deleteAll = page.getByRole("dialog", { name: "Delete all your local data?" });
    await deleteAll.getByLabel("Type DELETE to confirm").fill("DELETE");
    await deleteAll.getByRole("button", { name: "Delete everything" }).click();
    await expect(page).toHaveURL("/");
    await page.goto("/editor");
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("");
    await page.getByTestId("draft-title").click();
    await page.getByRole("menuitem", { name: "Restore from a backup…" }).click();
    const restore = page.getByRole("dialog", { name: "Restore from a backup" });
    await restore.getByTestId("backup-input").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(text) });
    await restore.getByTestId("backup-import").click();
    await expect(restore.getByTestId("backup-summary")).toHaveText("2 drafts added.");
    expect(await storedPhotos(page)).toHaveLength(8);
  });
});

const SHOTS = "test-results/screenshots";
const SHEETS = "/tmp/fwb-photopages";
const SIZES = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 810, height: 1080 },
  { name: "desktop", width: 1440, height: 900 },
] as const;
const THEMES = ["light", "dark"] as const;

/** Changes the stored draft (the design, the layout, the language) without going through the form. */
function patchStored(page: Page, id: string, change: { templateId?: string; colorId?: string; perPage?: 1 | 2 | 4; docLanguage?: string }) {
  return page.evaluate(
    ([draftId, patch]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("free-wedding-biodata");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const store = db.transaction("profiles", "readwrite");
          const objects = store.objectStore("profiles");
          const get = objects.get(draftId);
          get.onsuccess = () => {
            const profile = get.result;
            if (patch.templateId) profile.templateId = patch.templateId;
            if (patch.colorId) profile.colorId = patch.colorId;
            if (patch.docLanguage) profile.docLanguage = patch.docLanguage;
            if (patch.perPage && profile.photoPages) profile.photoPages.perPage = patch.perPage;
            profile.revision += 1;
            objects.put(profile);
          };
          store.oncomplete = () => {
            db.close();
            resolve();
          };
          store.onerror = () => reject(store.error);
        };
      }),
    [id, change] as const,
  );
}

/** A draft of the fictional sample with `count` photos and a chart added through the card. */
async function sampleWithPhotos(page: Page, id: string, count: number, { chart = true, grain = false, size }: { chart?: boolean; grain?: boolean; size?: [number, number] } = {}) {
  await openStoredDraft(page, sampleDraft(id));
  await card(page).getByTestId("pages-input").setInputFiles(await files(page, count, { grain, size }));
  await expect(tiles(page)).toHaveCount(count);
  if (chart) await addChart(page);
  await expect(status(page)).toHaveText(SAVED);
}

test.describe("A7 screenshots and measurements", () => {
  test.skip(({ isMobile }) => isMobile, "sizes are set here, so one project is enough");

  test("the More photos card: empty, with photos and a chart, switched off, and full, at every size, Day and Night", async ({ page }) => {
    test.setTimeout(240_000);
    await mkdir(SHOTS, { recursive: true });
    const shoot = async (state: string) => {
      for (const size of SIZES) {
        await page.setViewportSize({ width: size.width, height: size.height });
        for (const theme of THEMES) {
          await page.emulateMedia({ colorScheme: theme });
          await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
          await card(page).scrollIntoViewIfNeeded();
          await card(page).screenshot({ path: `${SHOTS}/pages-card-${state}-${size.name}-${theme === "light" ? "day" : "night"}.png`, animations: "disabled" });
        }
      }
    };
    await newDraft(page);
    await shoot("empty");
    await addPhotos(page, 3);
    await addChart(page);
    await shoot("filled");
    await card(page).getByRole("radio", { name: "2 per page" }).click();
    await card(page).getByRole("switch", { name: "Include photo pages" }).click();
    await shoot("off");
    await card(page).getByRole("switch", { name: "Include photo pages" }).click();
    await card(page).getByTestId("pages-input").setInputFiles(await files(page, 5));
    await expect(tiles(page)).toHaveCount(8, { timeout: 30_000 });
    await expect(status(page)).toHaveText(SAVED);
    await shoot("full");
    // The whole form with the card, once, at desktop width: where it sits among the other cards and the rail.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: "light" });
    await card(page).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/pages-editor-desktop-day.png`, animations: "disabled" });
  });

  test("the pages in the preview at 1, 2 and 4 to a page in Classic Gold, then other designs, and the chart page", async ({ page }) => {
    test.setTimeout(300_000);
    await mkdir(SHOTS, { recursive: true });
    await mkdir(SHEETS, { recursive: true });
    const id = "pages-looks";
    await sampleWithPhotos(page, id, 6);
    const looks: { name: string; templateId: string; colorId?: string; perPage: 1 | 2 | 4 }[] = [
      { name: "classic-gold-1", templateId: "classic-gold", perPage: 1 },
      { name: "classic-gold-2", templateId: "classic-gold", perPage: 2 },
      { name: "classic-gold-4", templateId: "classic-gold", perPage: 4 },
      { name: "executive-navy-2", templateId: "executive-navy", perPage: 2 },
      { name: "deepam-4", templateId: "deepam", colorId: "maroon", perPage: 4 },
      { name: "minimal-ivory-1", templateId: "minimal-ivory", perPage: 1 },
      { name: "royal-maroon-2", templateId: "royal-maroon", perPage: 2 },
    ];
    await page.setViewportSize({ width: 900, height: 1300 });
    for (const look of looks) {
      await patchStored(page, id, look);
      await page.goto(`/dev/draft?d=${id}`);
      await expect(page.locator("body[data-doc-ready]")).toHaveCount(1);
      const count = await page.locator("[data-page]").count();
      const total = look.perPage === 1 ? 6 : look.perPage === 2 ? 3 : 2;
      const details = Number(await page.locator("[data-doc-pages]").getAttribute("data-doc-pages"));
      expect(count).toBe(details + total + 1); // details, photo pages, chart
      for (let n = 2; n <= count; n++) await page.locator(`[data-page="${n}"]`).screenshot({ path: `${SHOTS}/pages-${look.name}-p${n}.png`, animations: "disabled" });
    }
    // Chart page in Telugu: the heading comes from the Telugu dictionary.
    await patchStored(page, id, { templateId: "classic-gold", docLanguage: "te" });
    await page.goto(`/dev/draft?d=${id}`);
    await expect(page.locator("body[data-doc-ready]")).toHaveCount(1);
    await expect(page.locator("[data-extra-page='chart']")).toContainText("జాతక వివరాలు");
    await page.locator("[data-extra-page='chart']").locator("xpath=ancestor::*[@data-page]").screenshot({ path: `${SHOTS}/pages-chart-te.png`, animations: "disabled" });
  });

  test("the preview with photo pages on a phone, a tablet and the desktop, Day and Night", async ({ page }) => {
    test.setTimeout(180_000);
    await mkdir(SHOTS, { recursive: true });
    await sampleWithPhotos(page, "pages-preview", 3);
    for (const size of SIZES) {
      await page.setViewportSize({ width: size.width, height: size.height });
      for (const theme of THEMES) {
        await page.emulateMedia({ colorScheme: theme });
        if (size.name === "desktop") {
          await page.getByTestId("preview-pane").evaluate((el) => el.scrollTo({ top: 1e5 }));
          await page.screenshot({ path: `${SHOTS}/pages-preview-${size.name}-${theme === "light" ? "day" : "night"}.png`, animations: "disabled" });
        } else {
          await page.getByTestId("preview-pill").click();
          const sheet = page.getByRole("dialog", { name: "Preview" });
          await expect(sheet).toBeVisible();
          await expect(page.getByTestId("pill-pages")).toHaveText("6 pages"); // 2 of details, 3 photos, the chart
          await sheet.locator('[data-page="4"]').scrollIntoViewIfNeeded();
          await page.screenshot({ path: `${SHOTS}/pages-preview-${size.name}-${theme === "light" ? "day" : "night"}.png`, animations: "disabled" });
          await page.keyboard.press("Escape");
          await expect(sheet).toBeHidden();
        }
      }
    }
  });

  for (const [shape, size] of [["landscape", [3000, 2250]], ["portrait", [2250, 3000]]] as const) test(`eight large ${shape} photos: time, memory and sizes`, async ({ page }) => {
    test.setTimeout(300_000);
    await mkdir(SHEETS, { recursive: true });
    const id = `pages-heavy-${shape}`;
    await openStoredDraft(page, sampleDraft(id));
    const heap = () => page.evaluate(() => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0);
    const before = await heap();
    // Paths, not buffers: eight 3000 px photos are more than setInputFiles takes in memory.
    await mkdir(`${SHEETS}/source`, { recursive: true });
    const made = await files(page, 8, { size: [size[0], size[1]], grain: true });
    const picked: string[] = [];
    for (const f of made) {
      const path = `${SHEETS}/source/${shape}-${f.name}`;
      await writeFile(path, f.buffer);
      picked.push(path);
    }
    const input = made.map((f) => f.buffer.length);
    const started = Date.now();
    await card(page).getByTestId("pages-input").setInputFiles(picked);
    await expect(tiles(page)).toHaveCount(8, { timeout: 120_000 });
    const addedMs = Date.now() - started;
    await expect(status(page)).toHaveText(SAVED, { timeout: 60_000 });
    await expect(extraPhotoImgs(page)).toHaveCount(8, { timeout: 60_000 });
    await expect.poll(() => extraPhotoImgs(page).evaluateAll((imgs) => imgs.every((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0)), { timeout: 60_000 }).toBe(true);
    const shownMs = Date.now() - started;
    const afterAdd = await heap();
    const pixels = await extraPhotoImgs(page).evaluateAll((imgs) => imgs.map((i) => [(i as HTMLImageElement).naturalWidth, (i as HTMLImageElement).naturalHeight]));
    const stored = await page.evaluate(
      () =>
        new Promise<number[]>((resolve) => {
          const open = indexedDB.open("free-wedding-biodata");
          open.onsuccess = () => {
            const all = open.result.transaction("photos").objectStore("photos").getAll();
            all.onsuccess = () => resolve((all.result as { blob: Blob }[]).map((r) => r.blob.size));
          };
        }),
    );

    const t0 = Date.now();
    const [pdf] = await Promise.all([page.waitForEvent("download", { timeout: 120_000 }), page.getByRole("button", { name: "Download PDF" }).click()]);
    const pdfBytes = await readFile((await pdf.path())!);
    const pdfMs = Date.now() - t0;
    const afterPdf = await heap();
    expect((await PDFDocument.load(pdfBytes, { updateMetadata: false })).getPageCount()).toBe(10); // the sample takes 2 pages, then 8 photo pages

    // Two-per-page and four-per-page PDFs are smaller (their cells need fewer pixels).
    const sizes: Record<string, number> = { "1": pdfBytes.length };
    for (const n of ["2 per page", "4 per page"]) {
      await card(page).getByRole("radio", { name: n }).click();
      await expect(status(page)).toHaveText(SAVED);
      const [download] = await Promise.all([page.waitForEvent("download", { timeout: 120_000 }), page.getByRole("button", { name: "Download PDF" }).click()]);
      sizes[n[0]] = (await readFile((await download.path())!)).length;
    }
    const measure = {
      sourceFilesKB: input.map((n) => Math.round(n / 1024)),
      storedKB: stored.map((n) => Math.round(n / 1024)),
      cellPixels: pixels,
      addMs: addedMs,
      allDrawnMs: shownMs,
      pdf1PerPageMs: pdfMs,
      pdfKB: Object.fromEntries(Object.entries(sizes).map(([k, v]) => [`${k}PerPage`, Math.round(v / 1024)])),
      heapMB: { before: Math.round(before / 1e6), afterAdd: Math.round(afterAdd / 1e6), afterPdf: Math.round(afterPdf / 1e6) },
    };
    console.log(`MEASURE ${shape} ${JSON.stringify(measure)}`);
    await writeFile(`${SHEETS}/measure-${shape}.json`, JSON.stringify(measure, null, 2));
    expect(pdfBytes.length).toBeLessThan(40 * 1024 * 1024);
  });
});

test.describe("PDF against Chrome", () => {
  test.skip(({ isMobile }) => isMobile, "one project is enough");
  test.use({ deviceScaleFactor: 2 });

  test("the PDF with photo pages has every page and each picture once; files for the PDFKit comparison", async ({ page }) => {
    test.setTimeout(300_000);
    await mkdir(`${SHEETS}/pdf`, { recursive: true });
    const id = "pages-pdf";
    await sampleWithPhotos(page, id, 5);
    await page.setViewportSize({ width: 900, height: 1300 });
    const variants = [
      { name: "classic-gold-2", templateId: "classic-gold", perPage: 2 as const },
      { name: "executive-navy-4", templateId: "executive-navy", perPage: 4 as const },
      { name: "deepam-1", templateId: "deepam", colorId: "maroon", perPage: 1 as const },
    ];
    for (const variant of variants) {
      await patchStored(page, id, variant);
      await page.goto(`/dev/draft?d=${id}`);
      await expect(page.locator("body[data-doc-ready]")).toHaveCount(1);
      const run = await page.evaluate(() => window.__draft!.pdf());
      expect(run.warnings).toEqual([]);
      await writeFile(`${SHEETS}/pdf/${variant.name}.pdf`, Buffer.from(run.pdf, "base64"));
      const doc = await PDFDocument.load(Buffer.from(run.pdf, "base64"), { updateMetadata: false });
      const count = await page.locator("[data-page]").count();
      expect(doc.getPageCount()).toBe(count);
      const pictures = [...doc.context.enumerateIndirectObjects()].filter(([, o]) => o instanceof PDFRawStream && o.dict.get(PDFName.of("Subtype")) === PDFName.of("Image"));
      expect(pictures).toHaveLength(6); // 5 photos + the chart, once each
      for (let n = 1; n <= count; n++) await page.locator(`[data-page="${n}"]`).screenshot({ path: `${SHEETS}/pdf/${variant.name}-chrome-p${n}.png`, scale: "device", animations: "disabled" });
      console.log(`pdf ${variant.name}: ${count} pages, ${(run.bytes / 1024).toFixed(0)} KB`);
    }
  });
});

test("the card works on a phone: add, reorder and remove with Undo; a chip reaches it", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await newDraft(page);
  await page.getByTestId("section-jump").getByRole("link", { name: "More photos" }).click();
  await expect(card(page).getByRole("heading", { name: "More photos" })).toBeInViewport();
  await addPhotos(page, 2);
  await card(page).getByRole("button", { name: "Move photo 2 earlier" }).click();
  await expect(status(page)).toHaveText(SAVED);
  await card(page).getByRole("button", { name: "Remove photo 1" }).click();
  await expect(tiles(page)).toHaveCount(1);
  await page.getByTestId("manage-toast").getByRole("button", { name: "Undo" }).click();
  await expect(tiles(page)).toHaveCount(2);
  // Targets are at least 44 px on touch.
  for (const button of await card(page).getByRole("button").all()) {
    if (!(await button.isVisible()) || (await button.isDisabled())) continue;
    const box = (await button.boundingBox())!;
    expect(Math.min(box.width, box.height), await button.innerText() || (await button.getAttribute("aria-label")) || "").toBeGreaterThanOrEqual(43.5);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

// The owner's refinement after Step 4.5: More photos comes last, after every section (its pages print at the end of
// the PDF): the last card of the form (after Add a section, before the notes on where the draft is kept), the last
// entry of the rail and the last chip, in the Simple and the Detailed form, and after a section of your own.
test("More photos is the last card, the last rail entry and the last chip, in Simple and Detailed", async ({ page, isMobile }) => {
  await newDraft(page);
  const nav = isMobile ? page.getByTestId("section-jump") : page.getByTestId("section-rail");
  const cards = () => page.getByTestId("editor-form").locator("section[data-section]").evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.section));
  const follows = async (first: Locator, second: Locator) => first.evaluate((a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING), await second.elementHandle());
  const check = async (lastSection: string) => {
    const order = await cards();
    expect(order.slice(0, 2)).toEqual(["top", "photo"]);
    expect(order.at(-2)).toBe(lastSection);
    expect(order.at(-1)).toBe("photoPages");
    expect(await follows(page.locator("#add-section"), card(page))).toBe(true);
    expect(await follows(card(page), page.getByTestId("kept-cards"))).toBe(true);
    const names = (await nav.getByRole("link").allTextContents()).map((n) => n.trim());
    expect(names[0]).toMatch(/^Top/);
    expect(names.at(-1)).toMatch(/^More photos/);
    expect(names.filter((n) => n.startsWith("More photos"))).toHaveLength(1);
  };

  await check("partnerPreferences");
  // At the end of the page the last entry is the one shown as current.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(nav.getByRole("link").last()).toHaveAttribute("aria-current", "location");
  await nav.getByRole("link", { name: /^More photos/ }).click();
  await expect(card(page).getByRole("heading", { name: "More photos" })).toBeInViewport();

  await switchToDetailed(page);
  const detailed = await cards();
  expect(detailed.at(-1)).toBe("photoPages");
  await check(detailed.at(-2)!);
  expect(detailed).toContain("horoscope");

  // A section of your own goes after the last section, still before More photos.
  await page.locator("#add-section").click();
  const dialog = page.getByRole("dialog", { name: "Add a section" });
  await dialog.getByLabel("Section title").fill("Hobbies and interests");
  await dialog.getByRole("button", { name: "Add section" }).click();
  const heading = page.getByRole("heading", { name: "Hobbies and interests" });
  await expect(heading).toBeVisible();
  const own = (await page.locator("section[data-section]", { has: heading }).getAttribute("data-section"))!;
  await check(own);
  expect((await nav.getByRole("link").allTextContents()).map((n) => n.trim()).at(-2)).toMatch(/^Hobbies/);
});
