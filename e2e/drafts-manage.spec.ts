import { expect, test, type Page } from "@playwright/test";

// Step 1.4: the drafts menu (open, new, rename, duplicate, delete), the landing page's Continue editing, storage
// status and Delete all my local data (VISION §5, §9). Each test has its own browser context, so its own empty
// database.

const status = (page: Page) => page.getByTestId("save-status");
const fullName = (page: Page) => page.getByLabel("Name", { exact: true });
const title = (page: Page) => page.getByTestId("draft-title");
const menu = (page: Page) => page.getByRole("menu", { name: "Drafts" });
const SAVED = /Saved on this device · \d/;
const DRAFT_URL = /\/editor\?d=[0-9a-f-]{36}$/;

const idOf = (page: Page) => new URL(page.url()).searchParams.get("d")!;

/** Opens a new draft the way Create my biodata does, types a Full name and waits until it's saved. */
async function newDraft(page: Page, name?: string): Promise<string> {
  await page.goto("/editor?new=1");
  await expect(page).toHaveURL(DRAFT_URL);
  await expect(fullName(page)).toBeVisible();
  if (name) {
    await fullName(page).fill(name);
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
  await menu(page).getByRole("menuitem", { name: item }).click();
}

/** The names in the drafts list, top to bottom. */
function listed(page: Page) {
  return page.getByTestId("drafts-list").getByRole("menuitemradio");
}

/** Names of this site's IndexedDB databases (empty once everything is deleted). */
function databases(page: Page) {
  return page.evaluate(async () => (await indexedDB.databases()).map((db) => db.name));
}

/** Waits until the landing page has looked for a draft (after hydration). */
async function landingSettled(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(300);
}

test.beforeEach(async ({ page }) => {
  // The privacy promise (VISION D15): nothing is requested from another origin.
  page.on("request", (request) => {
    expect(["localhost", "127.0.0.1"], `request to ${request.url()}`).toContain(new URL(request.url()).hostname);
  });
});

test("a draft is named from the Full name, and two drafts switch through the menu", async ({ page }) => {
  await newDraft(page);
  await expect(title(page)).toHaveText("Untitled biodata");
  await fullName(page).fill("Sai Teja Mandapati");
  await expect(title(page)).toHaveText("Sai Teja's biodata");
  await expect(status(page)).toHaveText(SAVED);
  const first = idOf(page);

  await choose(page, "New draft");
  await expect(page).toHaveURL(DRAFT_URL);
  const second = idOf(page);
  expect(second).not.toBe(first);
  await expect(fullName(page)).toHaveValue("");
  await expect(title(page)).toHaveText("Untitled biodata");
  await fullName(page).fill("Asha Rani");
  await expect(status(page)).toHaveText(SAVED);

  await openMenu(page);
  await expect(listed(page)).toHaveText([/Asha's biodata\s*Edited just now/, /Sai Teja's biodata\s*Edited just now/]);
  await expect(listed(page).first()).toHaveAttribute("aria-checked", "true");
  await listed(page).filter({ hasText: "Sai Teja's biodata" }).click();
  await expect(page).toHaveURL(`/editor?d=${first}`);
  await expect(fullName(page)).toHaveValue("Sai Teja Mandapati");

  // Switching writes what was just typed first, inside autosave's pause.
  await fullName(page).fill("Sai Teja M");
  await openMenu(page);
  await listed(page).filter({ hasText: "Asha's biodata" }).click();
  await expect(page).toHaveURL(`/editor?d=${second}`);
  await page.goto(`/editor?d=${first}`);
  await expect(fullName(page)).toHaveValue("Sai Teja M");
});

test("rename shows the name in the menu only, and an empty name goes back to the automatic one", async ({ page }) => {
  await newDraft(page, "Sai Teja Mandapati");
  await choose(page, "Rename…");
  const dialog = page.getByRole("dialog", { name: "Rename this draft" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Draft name")).toBeFocused();
  await dialog.getByLabel("Draft name").fill("  For the Rao family  ");
  await dialog.getByRole("button", { name: "Save name" }).click();
  await expect(dialog).toBeHidden();
  await expect(title(page)).toHaveText("For the Rao family");
  await expect(status(page)).toHaveText(SAVED);

  await page.reload();
  await expect(title(page)).toHaveText("For the Rao family");
  await openMenu(page);
  await expect(listed(page)).toHaveText([/For the Rao family/]);
  await page.keyboard.press("Escape");
  // It's a label for the person, never part of the biodata: nothing in the page's content shows it.
  await expect(page.locator("main")).not.toContainText("Rao family");

  await choose(page, "Rename…");
  await expect(dialog.getByLabel("Draft name")).toHaveValue("For the Rao family");
  await dialog.getByLabel("Draft name").fill("");
  await dialog.getByRole("button", { name: "Save name" }).click();
  await expect(title(page)).toHaveText("Sai Teja's biodata");
});

test("duplicate makes a copy with the same values under a new address", async ({ page }) => {
  const original = await newDraft(page, "Sai Teja Mandapati");
  await page.getByLabel("Current City", { exact: true }).fill("Hyderabad");
  await expect(status(page)).toHaveText(SAVED);

  await choose(page, "Duplicate");
  await expect(page).not.toHaveURL(`/editor?d=${original}`);
  await expect(page).toHaveURL(DRAFT_URL);
  await expect(title(page)).toHaveText("Sai Teja's biodata (copy)");
  await expect(fullName(page)).toHaveValue("Sai Teja Mandapati");
  await expect(page.getByLabel("Current City", { exact: true })).toHaveValue("Hyderabad");

  // The copy is its own draft: changing it leaves the original as it was.
  await page.getByLabel("Current City", { exact: true }).fill("Guntur");
  await expect(status(page)).toHaveText(SAVED);
  await openMenu(page);
  await expect(listed(page)).toHaveCount(2);
  await listed(page).filter({ hasText: /^Sai Teja's biodata\s*Edited/ }).click();
  await expect(page).toHaveURL(`/editor?d=${original}`);
  await expect(page.getByLabel("Current City", { exact: true })).toHaveValue("Hyderabad");
});

test("delete asks first, then opens the newest remaining draft, and a new one after the last", async ({ page }) => {
  const first = await newDraft(page, "Sai Teja Mandapati");
  await newDraft(page, "Asha Rani");

  await choose(page, "Delete…");
  const dialog = page.getByRole("dialog", { name: "Delete “Asha's biodata”?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("It can't be undone");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await openMenu(page);
  await expect(listed(page)).toHaveCount(2);
  await page.keyboard.press("Escape");

  await choose(page, "Delete…");
  await dialog.getByRole("button", { name: "Delete draft" }).click();
  await expect(page).toHaveURL(`/editor?d=${first}`);
  await expect(fullName(page)).toHaveValue("Sai Teja Mandapati");
  await openMenu(page);
  await expect(listed(page)).toHaveText([/Sai Teja's biodata/]);
  await page.keyboard.press("Escape");

  await choose(page, "Delete…");
  await page.getByRole("dialog", { name: "Delete “Sai Teja's biodata”?" }).getByRole("button", { name: "Delete draft" }).click();
  await expect(page).toHaveURL(DRAFT_URL);
  await expect(page).not.toHaveURL(`/editor?d=${first}`);
  await expect(title(page)).toHaveText("Untitled biodata");
  await expect(fullName(page)).toHaveValue("");
});

test("a draft that can't be opened is listed as such, with Delete only", async ({ page }) => {
  await newDraft(page, "Sai Teja Mandapati");
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("free-wedding-biodata");
        open.onsuccess = () => {
          const tx = open.result.transaction("profiles", "readwrite");
          tx.objectStore("profiles").put({ id: "damaged-draft", schemaVersion: 1, revision: 1, draftName: "Old draft", sections: "x" });
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await openMenu(page);
  const broken = page.getByTestId("broken-draft");
  await expect(broken).toHaveText(/Old draft\s*Can't be opened\s*Delete/);
  await broken.click();
  const dialog = page.getByRole("dialog", { name: "Delete “Old draft”?" });
  await expect(dialog).toContainText("can't be opened");
  await dialog.getByRole("button", { name: "Delete draft" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Draft deleted." })).toBeVisible();
  await openMenu(page);
  await expect(page.getByTestId("broken-draft")).toHaveCount(0);
  await expect(listed(page)).toHaveCount(1);
});

test("the landing page offers Continue editing only when a draft exists, and Create always makes a new one", async ({ page }) => {
  await page.goto("/");
  await landingSettled(page);
  await expect(page.getByTestId("continue-editing")).toHaveCount(0);
  // Looking for drafts on a first visit leaves nothing behind.
  expect(await databases(page)).not.toContain("free-wedding-biodata");

  await page.getByRole("main").getByRole("link", { name: "Create my biodata" }).click();
  await expect(page).toHaveURL(DRAFT_URL);
  const first = idOf(page);
  await fullName(page).fill("Sai Teja Mandapati");
  await expect(status(page)).toHaveText(SAVED);

  await page.goto("/");
  const resume = page.getByRole("link", { name: "Continue editing Sai Teja's biodata" });
  await expect(resume).toBeVisible();
  await expect(resume).toHaveAttribute("href", `/editor?d=${first}`);
  await resume.click();
  await expect(page).toHaveURL(`/editor?d=${first}`);
  await expect(fullName(page)).toHaveValue("Sai Teja Mandapati");

  await page.goto("/");
  await page.getByRole("main").getByRole("link", { name: "Create my biodata" }).click();
  await expect(page).toHaveURL(DRAFT_URL);
  const second = idOf(page);
  expect(second).not.toBe(first);
  await expect(fullName(page)).toHaveValue("");
  // An untouched new draft is reused rather than piling up empty ones.
  await page.goto("/editor?new=1");
  await expect(page).toHaveURL(`/editor?d=${second}`);
});

test("Delete all my local data needs DELETE typed, then wipes every draft and setting", async ({ page }) => {
  await newDraft(page, "Sai Teja Mandapati");
  await newDraft(page, "Asha Rani");
  await page.evaluate(() => localStorage.setItem("theme", "dark"));

  await choose(page, "Delete all my local data…");
  const dialog = page.getByRole("dialog", { name: "Delete all your local data?" });
  await expect(dialog).toBeVisible();
  const confirm = dialog.getByRole("button", { name: "Delete everything" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Type DELETE to confirm").fill("delet");
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Type DELETE to confirm").fill("delete");
  await confirm.click();

  await expect(page).toHaveURL("/");
  await landingSettled(page);
  await expect(page.getByTestId("continue-editing")).toHaveCount(0);
  expect(await databases(page)).not.toContain("free-wedding-biodata");
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBeNull();
});

test("Delete all my local data works from the privacy page too", async ({ page }) => {
  await newDraft(page, "Sai Teja Mandapati");
  await page.goto("/privacy");
  await page.getByRole("button", { name: "Delete all…" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete all your local data?" });
  await dialog.getByLabel("Type DELETE to confirm").fill("DELETE");
  await dialog.getByRole("button", { name: "Delete everything" }).click();
  await expect(page).toHaveURL("/");
  await landingSettled(page);
  await expect(page.getByTestId("continue-editing")).toHaveCount(0);
  await page.goto("/editor");
  await expect(fullName(page)).toHaveValue("");
});

test("the drafts menu works from the keyboard", async ({ page }) => {
  await newDraft(page, "Sai Teja Mandapati");
  const button = page.getByRole("banner").getByRole("button", { name: "Sai Teja's biodata" });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(menu(page)).toBeVisible();
  // The open draft (ticked) takes the focus; the arrows, Home and End move through the items.
  await expect(listed(page).first()).toBeFocused();
  await page.keyboard.press("End");
  await expect(menu(page).getByRole("menuitem", { name: "Delete all my local data…" })).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect(menu(page).getByRole("menuitem", { name: "Rename…" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu(page)).toBeHidden();
  await expect(button).toBeFocused();

  await page.keyboard.press("ArrowDown");
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(menu(page).getByRole("menuitem", { name: "New draft" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Rename this draft" });
  await expect(dialog.getByLabel("Draft name")).toBeFocused();
  await page.keyboard.type("Keyboard name");
  await page.keyboard.press("Enter");
  await expect(title(page)).toHaveText("Keyboard name");
});

test("storage status says how much is used and reports the browser's answer to Keep my drafts safe", async ({ page }) => {
  await newDraft(page, "Sai Teja Mandapati");
  const card = page.getByTestId("storage-card");
  await expect(card.getByTestId("storage-usage")).toHaveText(/^Using [\d.]+ (kB|MB) on this device$/);
  await expect(card.getByTestId("storage-persisted")).toHaveText(/^(Protected|Not protected)/);
  await expect(card).toContainText("Clearing browsing data");
  const ask = card.getByRole("button", { name: "Keep my drafts safe" });
  if (await ask.isVisible()) {
    await ask.click();
    await expect(card.getByRole("status")).toHaveText(/^(Done\. This browser will keep|This browser said no for now|This browser couldn't answer)/);
  } else {
    await expect(card.getByTestId("storage-persisted")).toHaveText(/^Protected/);
  }
});
