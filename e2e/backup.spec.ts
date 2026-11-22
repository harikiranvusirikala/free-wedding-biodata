import { readFile } from "node:fs/promises";
import { expect, test, type Download, type Page } from "@playwright/test";
import type { BiodataProfile } from "../src/biodata/types";
import { SAVED, drawnPng, storedField } from "./editor-helpers";

// Step 5.1: backup and restore. A backup is one JSON file made on the device (drafts + photos as base64) and read back
// on the device; these specs download it, delete the browser's data, restore it, and try files that should be
// refused. Nothing is requested from another origin (VISION D15). Fictional data only.

const DRAFT_URL = /\/editor\?d=[0-9a-f-]{36}$/;
const status = (page: Page) => page.getByTestId("save-status");
const fullName = (page: Page) => page.getByLabel("Name", { exact: true });
const title = (page: Page) => page.getByTestId("draft-title");
const menu = (page: Page) => page.getByRole("menu", { name: "Drafts" });
const exportDialog = (page: Page) => page.getByRole("dialog", { name: "Download a backup" });
const restoreDialog = (page: Page) => page.getByRole("dialog", { name: "Restore from a backup" });
const idOf = (page: Page) => new URL(page.url()).searchParams.get("d")!;

test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith("blob:") && !url.startsWith("data:")) throw new Error(`request to another origin: ${url}`);
  });
});

/** Opens a new draft, names it and (optionally) adds a drawn photo; waits until it is saved. */
async function newDraft(page: Page, name: string, { photo = false }: { photo?: boolean } = {}): Promise<string> {
  await page.goto("/editor?new=1");
  await expect(page).toHaveURL(DRAFT_URL);
  await fullName(page).fill(name);
  await expect(status(page)).toHaveText(SAVED);
  if (photo) {
    const card = page.locator('[data-section="photo"]');
    await card.getByTestId("photo-input").setInputFiles({ name: "drawn.png", mimeType: "image/png", buffer: await drawnPng(page, 1200, 1600) });
    const cropper = page.getByRole("dialog", { name: "Crop your photo" });
    await expect.poll(() => cropper.locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0 && img.style.transform !== "")).toBe(true);
    await cropper.getByRole("button", { name: "Done" }).click();
    await expect(cropper).toBeHidden();
    await expect(status(page)).toHaveText(SAVED);
  }
  return idOf(page);
}

async function openMenu(page: Page) {
  await title(page).click();
  await expect(menu(page)).toBeVisible();
}

async function choose(page: Page, item: string | RegExp) {
  await openMenu(page);
  await menu(page).getByRole("menuitem", { name: item, exact: typeof item === "string" }).click();
}

type BackupJson = {
  manifest: { app: string; formatVersion: number; exportedAt: string; draftCount: number };
  drafts: { profile: BiodataProfile; photos: { id: string; mimeType: string; width: number; height: number; data: string }[] }[];
};

/** Menu → Download a backup → Download backup. Returns the file's name and text. */
async function downloadBackup(page: Page, { openOnly = false }: { openOnly?: boolean } = {}): Promise<{ name: string; text: string; json: BackupJson }> {
  await choose(page, "Download a backup of all my drafts…");
  const dialog = exportDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("backup-size")).toHaveText(/^The file will be about [\d.]+ (kB|MB)\.$/);
  if (openOnly) await dialog.getByRole("radio", { name: "Only the draft I have open" }).check();
  const [download] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Download backup" }).click()]);
  await expect(dialog.getByTestId("backup-export-done")).toContainText(download.suggestedFilename());
  const text = (await readFile((await download.path())!)).toString("utf8");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  return { name: download.suggestedFilename(), text, json: JSON.parse(text) as BackupJson };
}

/** Reads a download made by a "Download a backup first" or quota button. */
async function readDownload(download: Download) {
  const text = (await readFile((await download.path())!)).toString("utf8");
  return { name: download.suggestedFilename(), text, json: JSON.parse(text) as BackupJson };
}

async function openRestore(page: Page) {
  await choose(page, "Restore from a backup…");
  await expect(restoreDialog(page)).toBeVisible();
  return restoreDialog(page);
}

const fileOf = (content: string | object, name = "Biodata-backup-2026-11-22.json") => ({
  name,
  mimeType: "application/json",
  buffer: Buffer.from(typeof content === "string" ? content : JSON.stringify(content)),
});

/** The drafts and photos in this browser's IndexedDB. */
function storage(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ profiles: { id: string; draftName: string; revision: number; name: string; photoIds: string[] }[]; photos: { id: string; profileId: string; type: string; size: number }[] }>((resolve, reject) => {
        const open = indexedDB.open("free-wedding-biodata");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(["profiles", "photos"]);
          const profiles = tx.objectStore("profiles").getAll();
          const photos = tx.objectStore("photos").getAll();
          tx.oncomplete = () => {
            db.close();
            resolve({
              profiles: (profiles.result as BiodataProfile[]).map((p) => ({
                id: p.id,
                draftName: p.draftName,
                revision: p.revision,
                name: p.sections.flatMap((s) => (s.kind === "fields" ? s.fields : [])).find((f) => f.key === "fullName")?.value ?? "",
                photoIds: [p.photo?.id, p.secondPhoto?.id].filter((id): id is string => !!id),
              })),
              photos: (photos.result as { id: string; profileId: string; blob: Blob }[]).map((p) => ({ id: p.id, profileId: p.profileId, type: p.blob.type, size: p.blob.size })),
            });
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
}

const rows = (dialog: ReturnType<typeof restoreDialog>) => dialog.getByTestId("backup-drafts").getByRole("listitem");

test("a backup of two drafts downloads, survives Delete all my local data, and restores with its photo", async ({ page }) => {
  const first = await newDraft(page, "Sai Teja Mandapati", { photo: true });
  const second = await newDraft(page, "Asha Rani");
  expect(second).not.toBe(first);

  // The file: named for the day, a manifest, both drafts, the photo as base64 JPEG (photos are stored as JPEG, D12).
  const { name, text, json } = await downloadBackup(page);
  expect(name).toMatch(/^Biodata-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const today = new Date();
  expect(name).toBe(`Biodata-backup-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}.json`);
  expect(json.manifest).toMatchObject({ app: "free-wedding-biodata", formatVersion: 1, draftCount: 2 });
  expect(Date.parse(json.manifest.exportedAt)).toBeGreaterThan(Date.now() - 60_000);
  expect(json.drafts.map((d) => d.profile.id).sort()).toEqual([first, second].sort());
  const withPhoto = json.drafts.find((d) => d.profile.id === first)!;
  expect(withPhoto.photos).toHaveLength(1);
  expect(withPhoto.photos[0]).toMatchObject({ id: withPhoto.profile.photo!.id, mimeType: "image/jpeg", width: 1200, height: 1600 });
  expect(withPhoto.photos[0].data.startsWith("/9j/")).toBe(true);
  expect(json.drafts.find((d) => d.profile.id === second)!.photos).toEqual([]);
  // No HTML, no script: the file is JSON of plain strings.
  expect(text.startsWith('{"manifest":')).toBe(true);

  // Delete everything this browser keeps.
  await choose(page, "Delete all my local data…");
  const deleteAll = page.getByRole("dialog", { name: "Delete all your local data?" });
  await deleteAll.getByLabel("Type DELETE to confirm").fill("DELETE");
  await deleteAll.getByRole("button", { name: "Delete everything" }).click();
  await expect(page).toHaveURL("/");

  // A new browser state: the editor opens a blank draft; restore the file into it.
  await page.goto("/editor");
  await expect(fullName(page)).toHaveValue("");
  const dialog = await openRestore(page);
  await expect(dialog.getByRole("button", { name: "Choose a backup file" })).toBeFocused();
  await dialog.getByTestId("backup-input").setInputFiles(fileOf(text, name));

  const preview = dialog.getByTestId("backup-preview");
  await expect(preview).toContainText("This backup has 2 drafts");
  await expect(preview).toContainText("Nothing is imported until you press Import");
  await expect(rows(dialog)).toHaveCount(2);
  await expect(rows(dialog).filter({ hasText: "Sai Teja Mandapati's biodata" })).toContainText(/Edited .* · Has a photo/);
  await expect(rows(dialog).filter({ hasText: "Asha Rani's biodata" })).toContainText(/Edited .* · No photo/);
  for (const row of await rows(dialog).all()) await expect(row.getByRole("checkbox")).toBeChecked();
  await expect(dialog.getByRole("radio", { name: "Add as new drafts (keeps what you have)" })).toBeChecked();
  expect((await storage(page)).profiles).toHaveLength(1); // nothing written yet

  await dialog.getByTestId("backup-import").click();
  await expect(dialog.getByTestId("backup-summary")).toHaveText("2 drafts added.");
  await expect(dialog.getByRole("heading", { name: "Import finished" })).toBeFocused();

  // Fresh ids, the photo re-keyed.
  const stored = await storage(page);
  expect(stored.profiles).toHaveLength(3);
  const restored = stored.profiles.find((p) => p.name === "Sai Teja Mandapati")!;
  expect(restored.id).not.toBe(first);
  expect(restored.revision).toBe(0);
  expect(stored.profiles.find((p) => p.name === "Asha Rani")!.id).not.toBe(second);
  expect(stored.photos).toHaveLength(1);
  expect(stored.photos[0]).toMatchObject({ profileId: restored.id, type: "image/jpeg" });
  expect(restored.photoIds).toEqual([stored.photos[0].id]);
  expect(stored.photos[0].id).not.toBe(withPhoto.photos[0].id);

  // Open it from the summary: the draft and its photo are back.
  await dialog.getByRole("link", { name: "Open Sai Teja Mandapati's biodata" }).click();
  await expect(page).toHaveURL(`/editor?d=${restored.id}`);
  await expect(fullName(page)).toHaveValue("Sai Teja Mandapati");
  const card = page.locator('[data-section="photo"]');
  await expect(card.getByTestId("photo-thumb")).toBeVisible();
  await expect(card.getByTestId("photo-summary")).toHaveText("Portrait 3:4 · printed beside your details on page 1");
  await expect.poll(() => card.getByTestId("photo-thumb").locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
});

test("add keeps what you have, and replace overwrites the same draft only after being told so", async ({ page }) => {
  const first = await newDraft(page, "Sai Teja Mandapati", { photo: true });
  await newDraft(page, "Asha Rani");
  const { text, name } = await downloadBackup(page);

  // Change the first draft after the backup.
  await page.goto(`/editor?d=${first}`);
  await fullName(page).fill("Sai Teja Changed");
  await expect(status(page)).toHaveText(SAVED);

  // Add: both come in as new drafts, named "(restored)" because the same drafts are here already.
  let dialog = await openRestore(page);
  await dialog.getByTestId("backup-input").setInputFiles(fileOf(text, name));
  await expect(rows(dialog)).toHaveCount(2);
  await expect(rows(dialog).first()).toContainText("You have this draft already: added as a separate copy");
  await dialog.getByTestId("backup-import").click();
  await expect(dialog.getByTestId("backup-summary")).toHaveText("2 drafts added.");
  await page.keyboard.press("Escape");
  let stored = await storage(page);
  expect(stored.profiles).toHaveLength(4);
  expect(stored.profiles.find((p) => p.id === first)!.name).toBe("Sai Teja Changed");
  await openMenu(page);
  await expect(page.getByTestId("drafts-list").getByRole("menuitemradio")).toHaveCount(4);
  await expect(page.getByTestId("drafts-list").getByRole("menuitemradio").filter({ hasText: "(restored)" })).toHaveCount(2);
  await page.keyboard.press("Escape");

  // Replace, choosing only the first draft: the wording says what is overwritten, and a backup is offered first.
  dialog = await openRestore(page);
  await dialog.getByTestId("backup-input").setInputFiles(fileOf(text, name));
  await dialog.getByRole("radio", { name: "Replace drafts I already have" }).check();
  await expect(dialog).toContainText("the old version can't be brought back");
  const backupFirst = dialog.getByRole("button", { name: "Download a backup first" });
  await expect(backupFirst).toBeVisible();
  const firstRow = rows(dialog).filter({ hasText: "Sai Teja Mandapati's biodata" });
  await expect(firstRow).toContainText(/Replaces your copy, which is newer · Edited just now/);
  await rows(dialog).filter({ hasText: "Asha Rani's biodata" }).getByRole("checkbox").uncheck();
  await expect(dialog.getByTestId("backup-import")).toHaveText("Import 1 draft");

  // "Download a backup first" saves what is here now (4 drafts, including the changed one).
  const [safety] = await Promise.all([page.waitForEvent("download"), backupFirst.click()]);
  const before = await readDownload(safety);
  expect(before.json.manifest.draftCount).toBe(4);
  expect(JSON.stringify(before.json)).toContain("Sai Teja Changed");
  await expect(dialog.getByTestId("backup-first-status")).toContainText("Backup downloaded");

  const beforeReplace = (await storage(page)).profiles.find((p) => p.id === first)!;
  await dialog.getByTestId("backup-import").click();
  await expect(dialog.getByTestId("backup-summary")).toHaveText("1 draft replaced.");
  // The open draft was the one replaced: the dialog says so and reloads it.
  await expect(dialog).toContainText("The draft you have open here was replaced");
  await dialog.getByRole("button", { name: "Reload this draft" }).click();
  await expect(fullName(page)).toHaveValue("Sai Teja Mandapati");
  stored = await storage(page);
  expect(stored.profiles).toHaveLength(4); // replaced in place, nothing added
  expect(stored.profiles.find((p) => p.id === first)).toMatchObject({ name: "Sai Teja Mandapati", revision: beforeReplace.revision + 1 });
  expect(stored.photos.filter((p) => p.profileId === first)).toHaveLength(1);
  expect(stored.photos).toHaveLength(2); // the replaced draft's old picture is gone; its restored copy keeps its own
});

test("a file that isn't a usable backup says why and writes nothing", async ({ page }) => {
  await newDraft(page, "Sai Teja Mandapati", { photo: true });
  const { json } = await downloadBackup(page);
  const before = await storage(page);
  const dialog = await openRestore(page);
  const error = dialog.getByTestId("backup-error");
  const input = dialog.getByTestId("backup-input");

  const cases: [string, ReturnType<typeof fileOf>, RegExp][] = [
    ["a text file", fileOf("hello, this is not json", "notes.json"), /This isn't a backup file/],
    ["an empty file", fileOf("", "empty.json"), /This isn't a backup file/],
    ["another JSON file", fileOf({ hello: "world" }, "other.json"), /isn't one of this site's backups/],
    ["a newer backup", fileOf({ ...json, manifest: { ...json.manifest, formatVersion: 2 } }), /made by a newer version of this site.*Reload the page/],
    ["a backup with no drafts", fileOf({ ...json, drafts: [] }), /no drafts in it/],
    ["a backup whose drafts are all damaged", fileOf({ ...json, drafts: [{ profile: { id: "x", schemaVersion: 1 } }, { profile: 5 }] }), /damaged, or has been edited/],
  ];
  for (const [label, file, message] of cases) {
    await input.setInputFiles(file);
    await expect(error, label).toBeVisible();
    await expect(error, label).toHaveText(message);
    await expect(error, label).toContainText("Nothing was imported or changed.");
    await expect(error, label).toHaveAttribute("role", "alert");
  }
  expect(await storage(page)).toEqual(before);

  // A photo is not a backup either.
  await input.setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: await drawnPng(page, 100, 100) });
  await expect(error).toContainText("This isn't a backup file");
  expect(await storage(page)).toEqual(before);
});

test("a backup with one bad draft and one bad photo imports the rest and says what it left out", async ({ page }) => {
  const id = await newDraft(page, "Sai Teja Mandapati", { photo: true });
  const { json } = await downloadBackup(page);
  const good = json.drafts[0];
  const brokenPhoto = structuredClone(good);
  brokenPhoto.profile.id = "00000000-0000-4000-8000-000000000001";
  brokenPhoto.profile.draftName = "Photo is not a photo";
  brokenPhoto.profile.photo!.id = "p-bad";
  brokenPhoto.photos = [{ id: "p-bad", mimeType: "image/png", width: 10, height: 10, data: Buffer.from("<script>alert('x')</script>").toString("base64") }];
  const brokenDraft = { profile: { ...structuredClone(good.profile), id: "00000000-0000-4000-8000-000000000002", draftName: "Damaged one", sections: "oops" }, photos: [] };
  const htmlName = structuredClone(good);
  htmlName.profile.id = "00000000-0000-4000-8000-000000000003";
  htmlName.profile.draftName = "<b onmouseover=alert(1)>Bold</b> & <img src=x>";
  htmlName.photos = [];
  delete htmlName.profile.photo;
  const file = { ...json, drafts: [good, brokenDraft, brokenPhoto, htmlName] };

  const dialog = await openRestore(page);
  await dialog.getByTestId("backup-input").setInputFiles(fileOf(file));
  await expect(rows(dialog)).toHaveCount(3);
  // The HTML is shown as the text it is.
  await expect(rows(dialog).filter({ hasText: "<b onmouseover=alert(1)>Bold</b> & <img src=x>" })).toHaveCount(1);
  expect(await dialog.locator("b, img").count()).toBe(0);
  await expect(dialog.getByTestId("backup-skipped")).toContainText("Damaged one: it's damaged or not a valid draft");
  await expect(rows(dialog).filter({ hasText: "Photo is not a photo" })).toContainText("The photo isn't restored: it isn't a JPEG, PNG or WebP picture.");

  await dialog.getByTestId("backup-import").click();
  await expect(dialog.getByTestId("backup-summary")).toHaveText("3 drafts added, 1 draft skipped.");
  await expect(dialog.getByTestId("backup-skipped")).toBeVisible();
  const stored = await storage(page);
  // The photo draft's own copy is here too, so the restored one of it is named to tell them apart.
  expect(stored.profiles.map((p) => p.draftName).sort()).toEqual(["", "<b onmouseover=alert(1)>Bold</b> & <img src=x>", "Photo is not a photo", "Sai Teja Mandapati's biodata (restored)"].sort());
  // Only the good photo was written; the draft with the fake one has none.
  expect(stored.photos).toHaveLength(2);
  expect(stored.photos.every((p) => p.type === "image/jpeg")).toBe(true);
  expect(stored.profiles.find((p) => p.draftName === "Photo is not a photo")!.photoIds).toEqual([]);
  expect(stored.profiles.find((p) => p.id === id)).toBeTruthy();
});

test("Download a backup first is offered before deleting a draft and before deleting everything", async ({ page }) => {
  await newDraft(page, "Sai Teja Mandapati", { photo: true });
  const second = await newDraft(page, "Asha Rani");

  await choose(page, "Delete…");
  let dialog = page.getByRole("dialog", { name: "Delete “Asha Rani's biodata”?" });
  await expect(dialog.getByText("Saves this draft and its photos in a file you keep.")).toBeVisible();
  let [download] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Download a backup first" }).click()]);
  let file = await readDownload(download);
  expect(file.json.manifest.draftCount).toBe(1);
  expect(file.json.drafts[0].profile.id).toBe(second);
  await expect(dialog.getByTestId("backup-first-status")).toContainText(/^Backup downloaded: Biodata-backup-\d{4}-\d{2}-\d{2}\.json, [\d.]+ kB\. It's your own copy, so keep it somewhere safe\.$/);
  // Still there: the backup is an offer, not a step that deletes.
  await expect(dialog.getByRole("button", { name: "Delete draft" })).toBeEnabled();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

  await choose(page, "Delete all my local data…");
  dialog = page.getByRole("dialog", { name: "Delete all your local data?" });
  await expect(dialog.getByRole("button", { name: "Delete everything" })).toBeDisabled();
  [download] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Download a backup first" }).click()]);
  file = await readDownload(download);
  expect(file.json.manifest.draftCount).toBe(2);
  expect(file.json.drafts.flatMap((d) => d.photos)).toHaveLength(1);
  await expect(dialog.getByTestId("backup-first-status")).toContainText("Backup downloaded");
  await dialog.getByRole("button", { name: "Cancel" }).click();
});

test("the privacy page has the same Delete all with a backup button, and links into the editor's backup dialogs", async ({ page }) => {
  await newDraft(page, "Sai Teja Mandapati");
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Backup files", level: 2 }).first()).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/guarantee/i);
  await page.getByRole("button", { name: "Delete all…" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete all your local data?" });
  const [download] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Download a backup first" }).click()]);
  expect((await readDownload(download)).json.manifest.draftCount).toBe(1);
  await dialog.getByRole("button", { name: "Cancel" }).click();

  await page.getByTestId("privacy-backup").click();
  await expect(page).toHaveURL(/\/editor\?d=[0-9a-f-]{36}$/); // the request is taken out of the address
  await expect(exportDialog(page)).toBeVisible();
  await expect(exportDialog(page).getByTestId("backup-size")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/privacy");
  await page.getByTestId("privacy-restore").click();
  await expect(restoreDialog(page)).toBeVisible();
  expect(page.url()).not.toContain("backup=");
  await page.reload();
  await expect(restoreDialog(page)).toBeHidden();
});

test("the storage card offers both, and with no drafts on the privacy page there is nothing to back up", async ({ page }) => {
  await newDraft(page, "Sai Teja Mandapati");
  const card = page.getByTestId("storage-card");
  await expect(card).toContainText("A backup file is a copy you keep yourself");
  await card.getByRole("button", { name: "Download a backup" }).click();
  await expect(exportDialog(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(card.getByRole("button", { name: "Download a backup" })).toBeFocused();
  await card.getByRole("button", { name: "Restore from a backup…" }).click();
  await expect(restoreDialog(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(card.getByRole("button", { name: "Restore from a backup…" })).toBeFocused();
});

test("with no database at all, Delete all on the privacy page says there is nothing to back up and creates nothing", async ({ page }) => {
  await page.goto("/privacy");
  await page.getByRole("button", { name: "Delete all…" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete all your local data?" });
  await dialog.getByRole("button", { name: "Download a backup first" }).click();
  await expect(dialog.getByTestId("backup-first-status")).toHaveText("There are no drafts to back up yet.");
  expect(await page.evaluate(async () => (await indexedDB.databases()).map((db) => db.name))).not.toContain("free-wedding-biodata");
});

test("the export dialog can back up just the open draft, and returns focus to the menu", async ({ page }) => {
  const first = await newDraft(page, "Sai Teja Mandapati");
  await newDraft(page, "Asha Rani");
  await openMenu(page);
  await menu(page).getByRole("menuitem", { name: "Download a backup of all my drafts…" }).press("Enter");
  const dialog = exportDialog(page);
  await expect(dialog.getByRole("radio", { name: "All my drafts (2)" })).toBeFocused();
  await expect(dialog.getByRole("radio", { name: "All my drafts (2)" })).toBeChecked();
  await page.keyboard.press("ArrowDown");
  await expect(dialog.getByRole("radio", { name: "Only the draft I have open" })).toBeChecked();
  await expect(dialog).toContainText("Just “Asha Rani's biodata”, with its photos.");
  const [download] = await Promise.all([page.waitForEvent("download"), page.keyboard.press("Enter")]);
  const file = await readDownload(download);
  expect(file.json.manifest.draftCount).toBe(1);
  expect(file.json.drafts[0].profile.id).not.toBe(first);
  await expect(dialog.getByTestId("backup-export-done")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("banner").getByRole("button", { name: "Asha Rani's biodata" })).toBeFocused();
});

test("a restore can be cancelled, and a file can be dropped on the dialog", async ({ page }) => {
  await newDraft(page, "Sai Teja Mandapati");
  const { text, name } = await downloadBackup(page);
  const dialog = await openRestore(page);
  await expect(dialog.getByTestId("backup-drop")).toContainText("or drop it here");
  const data = await page.evaluateHandle(([content, fileName]) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([content], fileName, { type: "application/json" }));
    return transfer;
  }, [text, name]);
  await dialog.getByTestId("backup-drop").dispatchEvent("drop", { dataTransfer: data });
  await expect(rows(dialog)).toHaveCount(1);
  await dialog.getByRole("button", { name: "Choose a different file" }).click();
  await expect(dialog.getByRole("button", { name: "Choose a backup file" })).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  expect((await storage(page)).profiles).toHaveLength(1);
});

test("when the device is out of space the message offers a backup that holds the unsaved typing", async ({ page }) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore["put"]>) {
      if ((window as unknown as { __full?: boolean }).__full && this.name === "profiles") throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      return put.apply(this, args);
    };
  });
  const id = await newDraft(page, "Sai Teja Mandapati");
  await page.evaluate(() => ((window as unknown as { __full?: boolean }).__full = true));
  await fullName(page).fill("Sai Teja Typed While Full");
  const problem = page.getByTestId("save-problem");
  await expect(problem).toContainText("Your device is out of space for this site");
  await expect(problem).toContainText("download a backup now, which includes them");

  const [download] = await Promise.all([page.waitForEvent("download"), problem.getByRole("button", { name: "Download a backup" }).click()]);
  const file = await readDownload(download);
  expect(file.json.drafts[0].profile.id).toBe(id);
  expect(storedField(file.json.drafts[0].profile, "fullName")?.value).toBe("Sai Teja Typed While Full");
  await expect(problem.getByTestId("backup-first-status")).toContainText("It includes the changes that aren't saved yet");
  // What the database holds is still the earlier text: the backup is the only copy of the newest typing.
  expect((await storage(page)).profiles[0].name).toBe("Sai Teja Mandapati");

  await page.evaluate(() => ((window as unknown as { __full?: boolean }).__full = false));
  await problem.getByRole("button", { name: "Try again" }).click();
  await expect(status(page)).toHaveText(SAVED);
  await expect(problem).toHaveCount(0);
});

// The A7 quality gate for this step (BUILD_PLAN A7): each backup screen at phone, tablet and desktop size, Day and
// Night, saved in test-results/screenshots/ to be looked at before committing.
test("backup screens at every size, Day and Night", async ({ page, isMobile }) => {
  test.skip(isMobile, "sizes are set here, so one project is enough");
  test.setTimeout(240_000);
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore["put"]>) {
      if ((window as unknown as { __full?: boolean }).__full && this.name === "profiles") throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      return put.apply(this, args);
    };
  });
  const sizes = [
    { name: "phone", width: 390, height: 844 },
    { name: "tablet", width: 810, height: 1080 },
    { name: "desktop", width: 1440, height: 900 },
  ];
  const shoot = async (name: string, target?: () => ReturnType<Page["locator"]>, before?: () => Promise<void>) => {
    for (const size of sizes) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await before?.();
      for (const theme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: theme });
        await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
        const path = `test-results/screenshots/${name}-${size.name}-${theme === "light" ? "day" : "night"}.png`;
        if (target) await target().screenshot({ path, animations: "disabled" });
        else await page.screenshot({ path, animations: "disabled" });
      }
    }
  };

  await newDraft(page, "Sai Teja Mandapati", { photo: true });
  await newDraft(page, "Asha Rani");
  await newDraft(page, "Ravi Kumar Mandapati");
  const { json } = await downloadBackup(page);
  const sai = json.drafts.find((d) => d.profile.id !== undefined && d.photos.length)!;
  const damaged = { profile: { ...structuredClone(sai.profile), id: "00000000-0000-4000-8000-000000000009", draftName: "Old draft", sections: "oops" }, photos: [] };
  const badPhoto = structuredClone(json.drafts.find((d) => !d.photos.length)!);
  badPhoto.profile.id = "00000000-0000-4000-8000-000000000008";
  badPhoto.profile.draftName = "Biodata with a missing photo";
  badPhoto.profile.photo = { id: "gone", frame: "3:4", crop: { x: 0.5, y: 0.5, zoom: 1, rotation: 0 } };
  const rich = { ...json, drafts: [...json.drafts, badPhoto, damaged] };

  await page.setViewportSize({ width: 1440, height: 900 });
  await openMenu(page);
  await shoot("backup-menu");
  await page.keyboard.press("Escape");

  await choose(page, "Download a backup of all my drafts…");
  await expect(exportDialog(page).getByTestId("backup-size")).toBeVisible();
  await shoot("backup-export");
  await page.keyboard.press("Escape");

  const dialog = await openRestore(page);
  await shoot("backup-restore-pick");
  await dialog.getByTestId("backup-input").setInputFiles(fileOf("this is not a backup", "notes.json"));
  await expect(dialog.getByTestId("backup-error")).toBeVisible();
  await shoot("backup-restore-error");
  await dialog.getByTestId("backup-input").setInputFiles(fileOf(rich));
  await expect(dialog.getByTestId("backup-preview")).toBeVisible();
  await shoot("backup-restore-preview", undefined, async () => {
    await dialog.evaluate((el) => el.scrollTo(0, 0));
  });
  const toEnd = () => dialog.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  const toTop = () => dialog.evaluate((el) => el.scrollTo(0, 0));
  await shoot("backup-restore-preview-end", undefined, toEnd);
  await dialog.getByRole("radio", { name: "Replace drafts I already have" }).check();
  await shoot("backup-restore-replace", undefined, toTop);
  await shoot("backup-restore-replace-end", undefined, toEnd);
  await toTop();
  await dialog.getByTestId("backup-import").click();
  await expect(dialog.getByTestId("backup-result")).toBeVisible();
  await shoot("backup-restore-result");
  await dialog.getByRole("button", { name: "Close", exact: true }).last().click();
  await expect(dialog).toBeHidden();

  await choose(page, "Delete…");
  const del = page.getByRole("dialog", { name: /^Delete “/ });
  await del.getByRole("button", { name: "Download a backup first" }).click();
  await expect(del.getByTestId("backup-first-status")).toContainText("Backup downloaded");
  await shoot("backup-delete-draft");
  await del.getByRole("button", { name: "Cancel" }).click();

  await choose(page, "Delete all my local data…");
  const all = page.getByRole("dialog", { name: "Delete all your local data?" });
  await shoot("backup-delete-all");
  await all.getByRole("button", { name: "Cancel" }).click();

  await page.getByTestId("storage-card").scrollIntoViewIfNeeded();
  await shoot("backup-storage-card", () => page.getByTestId("storage-card"));

  await page.evaluate(() => ((window as unknown as { __full?: boolean }).__full = true));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await fullName(page).fill("Ravi Kumar Mandapati Rao");
  await expect(page.getByTestId("save-problem")).toBeVisible();
  await page.getByTestId("save-problem").getByRole("button", { name: "Download a backup" }).click();
  await expect(page.getByTestId("save-problem").getByTestId("backup-first-status")).toContainText("Backup downloaded");
  await shoot("backup-quota", () => page.getByTestId("save-problem"));
});
