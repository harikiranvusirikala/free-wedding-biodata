import { expect, test, type Page } from "@playwright/test";
import { getDocDictionary } from "../src/i18n/doc";
import { SAVED, readStored, storedField, switchToDetailed } from "./editor-helpers";

// Step 2.0: the editor's opening (VISION D21, D11, D32, D43). The top of the biodata starts at None everywhere and
// what the user picks is kept and printed; the document language changes the printed labels while the editor stays
// in English; a tradition chip adds its fields once, with Undo. The printed side is checked on /dev/draft, which
// lays a stored draft out with the document engine (the live preview arrives in Step 3.3).

const te = getDocDictionary("te");
const status = (page: Page) => page.getByTestId("save-status");
const idOf = (page: Page) => new URL(page.url()).searchParams.get("d")!;
const top = (page: Page) => page.locator('[data-section="top"]');
const toast = (page: Page) => page.getByTestId("manage-toast");

/** A new draft in the Detailed form, whose sections this spec works with (new drafts start Simple, D50). */
async function openNewDraft(page: Page) {
  await page.goto("/editor?new=1");
  await expect(page).toHaveURL(/\/editor\?d=[0-9a-f-]{36}$/);
  await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
  await switchToDetailed(page);
  return idOf(page);
}

/** The stored draft laid out as A4 pages (/dev/draft), ready to read. */
async function openDocument(page: Page, id: string) {
  await page.goto(`/dev/draft?d=${id}`);
  await expect(page.locator("body[data-doc-ready]")).toHaveCount(1);
  return page.locator("[data-page]").first();
}

test.beforeEach(async ({ page }) => {
  // The privacy promise (VISION D15): the editor requests nothing from another origin.
  page.on("request", (request) => {
    expect(["localhost", "127.0.0.1"], `request to ${request.url()}`).toContain(new URL(request.url()).hostname);
  });
});

test("a new draft has nothing at the top and no tradition fields (D21, D43)", async ({ page }) => {
  const id = await openNewDraft(page);
  const card = top(page);
  await expect(card.getByRole("heading", { name: "Top of your biodata" })).toBeVisible();
  await expect(card.getByRole("radio", { name: "No symbol", exact: true })).toHaveAttribute("aria-checked", "true");
  await expect(card.getByRole("radio", { name: "Ganesha", exact: true })).toHaveAttribute("aria-checked", "false");
  await expect(card.getByLabel("Invocation line")).toHaveValue("none");
  await expect(card.getByRole("radiogroup", { name: "Title" }).getByRole("radio", { name: "None", exact: true })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("language-notice")).toContainText("Headings print in English");
  // The top card is the form's first card and the rail's first entry.
  await expect(page.locator("section[data-section]").first()).toHaveAttribute("data-section", "top");
  await page.getByLabel("Name", { exact: true }).fill("Sai Teja Mandapati");
  await expect(status(page)).toHaveText(SAVED);
  const stored = await readStored(page, id);
  expect(stored.options).toMatchObject({ motif: null, invocation: "" });
  expect(stored.options.titleKey).toBeUndefined();
  expect(stored.options.title).toBeUndefined();
  for (const key of ["lagnam", "devak", "muslimSect", "church", "sikhPractice", "jainSect"]) expect(storedField(stored, key)).toBeUndefined();
  const pageOne = await openDocument(page, id);
  await expect(pageOne).toContainText("Sai Teja Mandapati");
  await expect(pageOne.locator('svg[viewBox="0 0 120 120"]')).toHaveCount(0);
});

test("a symbol, an invocation line and a title are kept after a reload and printed (D21, D45)", async ({ page }) => {
  const id = await openNewDraft(page);
  const card = top(page);
  await card.getByRole("radio", { name: "Ganesha", exact: true }).click();
  await card.getByLabel("Invocation line").selectOption("shriGaneshaya");
  await expect(card.getByLabel("The line, as it prints")).toHaveValue("॥ श्री गणेशाय नमः ॥");
  await card.getByRole("radiogroup", { name: "Title" }).getByRole("radio", { name: "Marriage Biodata", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Sai Teja Mandapati");
  await expect(status(page)).toHaveText(SAVED);
  await expect(page.getByTestId("top-summary")).toHaveText("Ganesha · ॥ श्री गणेशाय नमः ॥ · Marriage Biodata · in the design's colours");

  await page.reload();
  await expect(card.getByRole("radio", { name: "Ganesha", exact: true })).toHaveAttribute("aria-checked", "true");
  await expect(card.getByLabel("Invocation line")).toHaveValue("shriGaneshaya");
  await expect(card.getByRole("radiogroup", { name: "Title" }).getByRole("radio", { name: "Marriage Biodata", exact: true })).toHaveAttribute("aria-checked", "true");
  const stored = await readStored(page, id);
  expect(stored.options).toMatchObject({ motif: "ganesha", invocation: "॥ श्री गणेशाय नमः ॥", titleKey: "marriageBiodata" });

  // The line stays editable: typing makes it the user's own, printed as typed.
  await card.getByLabel("The line, as it prints").fill("॥ श्री गणेशाय नमः ॥ ॥ श्री ॥");
  await expect(card.getByLabel("Invocation line")).toHaveValue("own");
  await expect(status(page)).toHaveText(SAVED);

  const pageOne = await openDocument(page, id);
  await expect(pageOne.locator('svg[viewBox="0 0 120 120"]')).toHaveCount(1);
  await expect(pageOne).toContainText("॥ श्री गणेशाय नमः ॥ ॥ श्री ॥");
  await expect(pageOne).toContainText("Marriage Biodata");
  // The line prints in Devanagari's font on an English page, so the PDF can draw it too.
  const font = await pageOne.getByText("॥ श्री गणेशाय नमः ॥ ॥ श्री ॥").evaluate((el) => getComputedStyle(el).fontFamily);
  expect(font).toContain("Noto Sans Devanagari");
});

test("None puts each choice back, and a title of the user's own prints as typed", async ({ page }) => {
  const id = await openNewDraft(page);
  const card = top(page);
  await card.getByRole("radio", { name: "Om", exact: true }).click();
  await card.getByRole("radio", { name: "No symbol", exact: true }).click();
  await card.getByLabel("Invocation line").selectOption("own");
  await expect(card.getByLabel("The line, as it prints")).toBeFocused();
  await card.getByLabel("The line, as it prints").fill("With love from the Rao family");
  await card.getByRole("button", { name: "Remove the line" }).click();
  await expect(card.getByLabel("Invocation line")).toHaveValue("none");
  await card.getByRole("radiogroup", { name: "Title" }).getByRole("radio", { name: "Your own", exact: true }).click();
  await expect(card.getByLabel("Your title")).toBeFocused();
  await card.getByLabel("Your title").fill("Kalyana Patrika");
  await expect(status(page)).toHaveText(SAVED);
  const stored = await readStored(page, id);
  expect(stored.options).toMatchObject({ motif: null, invocation: "", title: "Kalyana Patrika" });
  expect(stored.options.titleKey).toBeUndefined();
});

test("the document language changes the printed labels; the editor stays in English (D11, D23)", async ({ page }) => {
  const id = await openNewDraft(page);
  await page.getByLabel("Name", { exact: true }).fill("Sai Teja Mandapati");
  await top(page).getByRole("radiogroup", { name: "Title" }).getByRole("radio", { name: "Biodata", exact: true }).click();
  await page.getByRole("button", { name: "Change the language of the printed headings" }).click();
  const dialog = page.getByRole("dialog", { name: "Language of the printed biodata" });
  await expect(dialog.getByRole("radio")).toHaveCount(10);
  await expect(dialog.getByRole("radio", { name: /English/ })).toHaveAttribute("aria-checked", "true");
  await dialog.getByRole("radio", { name: /తెలుగు/ }).click();
  await expect(dialog.getByRole("radio", { name: /తెలుగు/ })).toHaveAttribute("aria-checked", "true");
  await expect(dialog.getByRole("radio", { name: /తెలుగు/ })).toContainText("Not yet checked by a native speaker");
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("language-notice")).toContainText("తెలుగు (Telugu)");
  await expect(page.getByTestId("title-prints-as")).toHaveText(`Prints as ${te.titles.biodata}`);
  // The editor keeps its English labels.
  await expect(page.getByLabel("Date of Birth", { exact: true })).toBeVisible();
  await expect(page.locator('[data-section="personal"] h2')).toHaveText("Personal Details");
  await expect(status(page)).toHaveText(SAVED);
  expect((await readStored(page, id)).docLanguage).toBe("te");

  const pageOne = await openDocument(page, id);
  await expect(pageOne).toHaveAttribute("lang", "te");
  await expect(pageOne).toContainText(te.sections.personal);
  await expect(pageOne).toContainText(te.fields.fullName);
  await expect(pageOne).toContainText(te.titles.biodata);
  await expect(pageOne).toContainText("Sai Teja Mandapati"); // values print as typed
  await expect(pageOne).not.toContainText("Personal Details");
});

test("a tradition chip adds its fields once, a second tap unselects it, and Undo works both ways (D32, D43)", async ({ page }) => {
  const id = await openNewDraft(page);
  const chips = page.getByTestId("tradition-chips");
  await expect(page.locator('[data-section="religion"]').getByTestId("tradition-chips")).toBeVisible();
  await expect(chips.getByRole("button")).toHaveCount(8);

  await chips.getByRole("button", { name: "Hindu – Marathi", exact: true }).click();
  await expect(toast(page)).toContainText("Added Devak, Kula Devata, Gan and Nadi");
  await expect(page.locator('[data-section="religion"]').getByLabel("Devak", { exact: true })).toBeVisible();
  await expect(page.locator('[data-section="horoscope"]').getByRole("combobox", { name: "Nadi", exact: true })).toBeVisible();
  const marathi = chips.getByRole("button", { name: "Hindu – Marathi", exact: true });
  await expect(marathi).toHaveAttribute("aria-pressed", "true");

  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect(toast(page)).toContainText("Removed the details just added");
  await expect(page.getByLabel("Devak", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Nadi", exact: true })).toHaveCount(0);
  await expect(marathi).toHaveAttribute("aria-pressed", "false");

  // A second tap unselects the chip and takes its empty fields out; Undo brings them back.
  await marathi.click();
  await expect(page.getByLabel("Devak", { exact: true })).toHaveCount(1);
  await marathi.click();
  await expect(toast(page)).toContainText("Removed Devak, Kula Devata, Gan and Nadi.");
  await expect(page.getByLabel("Devak", { exact: true })).toHaveCount(0);
  await expect(marathi).toHaveAttribute("aria-pressed", "false");
  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect(toast(page)).toContainText("Hindu – Marathi is back");
  await expect(page.getByLabel("Devak", { exact: true })).toHaveCount(1);
  await expect(marathi).toHaveAttribute("aria-pressed", "true");

  // A chip that shares fields adds only what's missing, and unselecting it keeps what the other chip uses.
  const tamil = chips.getByRole("button", { name: "Hindu – Tamil", exact: true });
  await tamil.click();
  await expect(toast(page)).toContainText("Added Lagnam and Dosham");
  await expect(page.getByLabel("Kula Devata", { exact: true })).toHaveCount(1);
  // Hindu – other has the same fields as Tamil but wasn't tapped: it stays unticked.
  await expect(chips.getByRole("button", { name: "Hindu – other", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.locator('[data-section="horoscope"]').getByLabel("Dosham", { exact: true }).fill("None");
  await tamil.click();
  await expect(toast(page)).toContainText("Removed Lagnam. Kept Dosham, which you've filled in.");
  await expect(page.getByRole("combobox", { name: "Lagnam", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Dosham", { exact: true })).toHaveValue("None");
  await expect(page.getByLabel("Kula Devata", { exact: true })).toHaveCount(1);
  await tamil.click();
  await expect(toast(page)).toContainText("Added Lagnam");

  await expect(status(page)).toHaveText(SAVED);
  const stored = await readStored(page, id);
  for (const key of ["devak", "kulaDevata", "gan", "nadi", "lagnam", "dosham"]) expect(storedField(stored, key), key).toBeDefined();
  const keys = stored.sections.flatMap((s) => (s.kind === "fields" ? s.fields.map((f) => f.key) : []));
  expect(keys.filter((k) => k === "kulaDevata")).toHaveLength(1);
});
