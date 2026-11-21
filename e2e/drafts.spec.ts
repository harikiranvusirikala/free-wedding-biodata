import { expect, test, type Page } from "@playwright/test";

// Step 1.3: drafts are saved in this browser's IndexedDB as you type (VISION §9, D9). Each test has its own browser
// context, so its own empty database.

const status = (page: Page) => page.getByTestId("save-status");
const fullName = (page: Page) => page.getByLabel("Full name");
const SAVED = /Saved on this device · \d/;

/** Opens /editor in an empty browser: a new draft is made and its id put in the address. */
async function openNewDraft(page: Page): Promise<string> {
  await page.goto("/editor");
  await expect(page).toHaveURL(/\/editor\?d=[0-9a-f-]{36}$/);
  await expect(fullName(page)).toBeVisible();
  await expect(status(page)).toHaveText("Saved on this device");
  return new URL(page.url()).searchParams.get("d")!;
}

/** Reads a stored profile straight from IndexedDB, as the browser has it on disk. */
function readStored(page: Page, id: string) {
  return page.evaluate(
    (draftId) =>
      new Promise<unknown>((resolve, reject) => {
        const open = indexedDB.open("free-wedding-biodata");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const get = db.transaction("profiles").objectStore("profiles").get(draftId);
          get.onerror = () => reject(get.error);
          get.onsuccess = () => {
            db.close();
            resolve(get.result);
          };
        };
      }),
    id,
  );
}

function storedValue(profile: unknown, key: string): string | undefined {
  const sections = (profile as { sections: { fields?: { key?: string; value: string }[] }[] }).sections;
  return sections.flatMap((s) => s.fields ?? []).find((f) => f.key === key)?.value;
}

test.beforeEach(async ({ page }) => {
  // The privacy promise (VISION D15): the editor requests nothing from another origin.
  page.on("request", (request) => {
    expect(["localhost", "127.0.0.1"], `request to ${request.url()}`).toContain(new URL(request.url()).hostname);
  });
});

test("what you type is saved, and a reload brings it back with the same address", async ({ page }) => {
  const id = await openNewDraft(page);
  await fullName(page).fill("Sai Teja Mandapati");
  await page.getByLabel("Current city").fill("Hyderabad");
  await expect(status(page)).toHaveText(SAVED);

  await page.reload();
  await expect(page).toHaveURL(`/editor?d=${id}`);
  await expect(fullName(page)).toHaveValue("Sai Teja Mandapati");
  await expect(page.getByLabel("Current city")).toHaveValue("Hyderabad");
});

test("Saved appears only after the write: Saving… first, and the value is on disk by then", async ({ page }) => {
  const id = await openNewDraft(page);
  // Every state the status line goes through, in order.
  await page.evaluate(() => {
    const line = document.querySelector("[data-testid=save-status]")!;
    const seen: string[] = [line.getAttribute("data-state")!];
    (window as unknown as { seen: string[] }).seen = seen;
    new MutationObserver(() => seen.push(line.getAttribute("data-state")!)).observe(line, { attributes: true, attributeFilter: ["data-state"] });
  });

  await fullName(page).fill("Asha Rani");
  await expect(status(page)).toHaveText("Saving…");
  await expect(status(page)).toHaveText(SAVED);

  const seen = await page.evaluate(() => (window as unknown as { seen: string[] }).seen);
  expect(seen).toEqual(["idle", "saving", "saved"]);
  expect(storedValue(await readStored(page, id), "fullName")).toBe("Asha Rani");
});

test("/editor without ?d= reopens the last draft", async ({ page }) => {
  const id = await openNewDraft(page);
  await fullName(page).fill("The last one");
  await expect(status(page)).toHaveText(SAVED);

  await page.goto("/editor");
  await expect(page).toHaveURL(`/editor?d=${id}`);
  await expect(fullName(page)).toHaveValue("The last one");
});

test("leaving through a link writes pending changes first", async ({ page }) => {
  const id = await openNewDraft(page);
  await fullName(page).fill("Typed just before leaving");
  // Straight away, inside the 400 ms pause before autosave would write.
  await page.getByRole("banner").getByRole("link", { name: "Help" }).click();
  await expect(page).toHaveURL(/\/help$/);
  expect(storedValue(await readStored(page, id), "fullName")).toBe("Typed just before leaving");
});

test("a second tab that edits after another tab saved stops saving and offers to reload", async ({ page, context }) => {
  const id = await openNewDraft(page);
  const other = await context.newPage();
  await other.goto(`/editor?d=${id}`);
  await expect(fullName(other)).toBeVisible();

  await fullName(page).fill("Saved in the first tab");
  await expect(status(page)).toHaveText(SAVED);

  await fullName(other).fill("Typed in the second tab");
  await expect(other.getByTestId("save-problem")).toContainText("This draft was changed in another tab");
  await expect(status(other)).toHaveText("Not saved");
  // It stops: the form can't be typed into any more, and nothing it had reached the database.
  await expect(fullName(other)).toHaveAttribute("readonly", "");
  expect(storedValue(await readStored(other, id), "fullName")).toBe("Saved in the first tab");

  await other.getByRole("button", { name: "Reload" }).click();
  await expect(fullName(other)).toHaveValue("Saved in the first tab");
  await expect(other.getByTestId("save-problem")).toHaveCount(0);
  await page.reload();
  await expect(fullName(page)).toHaveValue("Saved in the first tab");
});

test("an unknown draft id shows Draft not found, with a way to start a new draft", async ({ page }) => {
  await page.goto("/editor?d=no-such-draft");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Draft not found");
  await expect(page).toHaveURL("/editor?d=no-such-draft");

  await page.getByRole("button", { name: "Start a new draft" }).click();
  await expect(page).toHaveURL(/\/editor\?d=[0-9a-f-]{36}$/);
  await expect(fullName(page)).toHaveValue("");
});

test("a damaged draft is reported and kept, never replaced", async ({ page }) => {
  await openNewDraft(page);
  const broken = { id: "damaged-draft", schemaVersion: 1, revision: 3, sections: "not a list" };
  await page.evaluate(
    (record) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("free-wedding-biodata");
        open.onsuccess = () => {
          const tx = open.result.transaction("profiles", "readwrite");
          tx.objectStore("profiles").put(record);
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    broken,
  );

  await page.goto("/editor?d=damaged-draft");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This draft couldn't be opened");
  await expect(page.getByRole("button", { name: "Start a new draft" })).toBeVisible();
  expect(await readStored(page, "damaged-draft")).toEqual(broken);
});

test("a browser that blocks storage gets an explanation instead of an editor that can't save", async ({ page }) => {
  // As in a private window that refuses IndexedDB: the database can't be found at all.
  await page.addInitScript(() => Object.defineProperty(window, "indexedDB", { get: () => undefined }));
  await page.goto("/editor");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your browser isn't letting this site save");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});
