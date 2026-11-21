import { expect, test, type Locator, type Page } from "@playwright/test";
import { toDocument } from "../src/biodata/document";
import type { BiodataProfile } from "../src/biodata/types";
import { getDocDictionary } from "../src/i18n/doc";
import { SAVED, readStored, storedField } from "./editor-helpers";

// Step 2.2: managing fields and sections from the ⋯ menus and the Add buttons (VISION §6 "Dynamic field
// functionality"). Each change is checked on screen, in the draft on disk and, where it matters, in what the
// biodata prints (the document model the preview, print and PDF are laid out from, D1).

const status = (page: Page) => page.getByTestId("save-status");
const idOf = (page: Page) => new URL(page.url()).searchParams.get("d")!;
const section = (page: Page, key: string) => page.locator(`[data-section="${key}"]`);
const label = (page: Page, text: string) => page.getByLabel(text, { exact: true });
const fieldMenu = (page: Page, text: string) => page.getByRole("button", { name: `Options for “${text}”`, exact: true });
const sectionMenu = (page: Page, title: string) => page.getByRole("button", { name: `Options for the “${title}” section`, exact: true });
const item = (page: Page, name: string) => page.getByRole("menuitem", { name, exact: true });
const toast = (page: Page) => page.getByTestId("manage-toast");

async function openNewDraft(page: Page) {
  await page.goto("/editor?new=1");
  await expect(page).toHaveURL(/\/editor\?d=[0-9a-f-]{36}$/);
  await expect(label(page, "Name")).toBeVisible();
  return idOf(page);
}

/** The rows of a section card, by key (default fields) or by label (custom fields). */
async function rowsOf(card: Locator): Promise<string[]> {
  return card.locator("[data-testid^='row-'] label").allTextContents();
}

const sectionOrder = (page: Page) => page.locator("section[data-section]").evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.section));

/** What the biodata prints for a stored draft: its document model in English. */
function printed(profile: BiodataProfile) {
  return toDocument(profile, getDocDictionary("en"), new Date("2026-11-21T00:00:00Z"));
}

async function saved(page: Page) {
  await expect(status(page)).toHaveText(SAVED);
}

test.beforeEach(async ({ page }) => {
  // The privacy promise (VISION D15): the editor requests nothing from another origin.
  page.on("request", (request) => {
    expect(["localhost", "127.0.0.1"], `request to ${request.url()}`).toContain(new URL(request.url()).hostname);
  });
});

test("a custom field is added, typed into, kept after a reload and printed with its label as typed", async ({ page }) => {
  const id = await openNewDraft(page);
  await section(page, "personal").getByRole("button", { name: "Add a field" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a field to Personal Details" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Label", { exact: true })).toBeFocused();
  await expect(dialog.getByRole("button", { name: "Add field" })).toBeDisabled();
  await dialog.getByLabel("Label", { exact: true }).fill("Blood group (ABO)");
  await dialog.getByRole("radio", { name: /Text/ }).check();
  await dialog.getByRole("button", { name: "Add field" }).click();
  await expect(dialog).toBeHidden();

  // The new row is last in its card, and its input has the focus, ready to type into.
  const input = label(page, "Blood group (ABO)");
  await expect(input).toBeFocused();
  expect((await rowsOf(section(page, "personal"))).at(-1)).toBe("Blood group (ABO)");
  await input.pressSequentially("B+");
  await saved(page);

  await page.reload();
  await expect(label(page, "Blood group (ABO)")).toHaveValue("B+");
  const stored = await readStored(page, id);
  const personal = stored.sections.find((s) => s.key === "personal");
  expect(personal?.kind === "fields" && personal.fields.at(-1)).toMatchObject({ label: "Blood group (ABO)", type: "text", value: "B+", visible: true });
  const row = printed(stored).sections.find((s) => s.key === "personal")?.items.find((i) => i.kind === "row" && i.value === "B+");
  expect(row).toMatchObject({ label: "Blood group (ABO)" });

  // Change type: a paragraph keeps the value.
  await fieldMenu(page, "Blood group (ABO)").click();
  await item(page, "Change type").click();
  await page.getByRole("menuitemradio", { name: "Paragraph" }).click();
  await expect(page.getByRole("textbox", { name: "Blood group (ABO)" })).toHaveJSProperty("tagName", "TEXTAREA");
  await expect(page.getByRole("textbox", { name: "Blood group (ABO)" })).toHaveValue("B+");
  await saved(page);
  expect((await readStored(page, id)).sections.flatMap((s) => (s.kind === "fields" ? s.fields : [])).find((f) => f.label === "Blood group (ABO)")).toMatchObject({ type: "textarea", value: "B+" });
});

test("a default field is renamed, printed as typed, and can go back to its usual label", async ({ page }) => {
  const id = await openNewDraft(page);
  await label(page, "Native Place").fill("Guntur");
  await fieldMenu(page, "Native Place").click();
  await item(page, "Rename…").click();
  const dialog = page.getByRole("dialog", { name: "Rename “Native Place”" });
  await expect(dialog.getByLabel("Label", { exact: true })).toHaveValue("Native Place");
  await dialog.getByLabel("Label", { exact: true }).fill("Hometown");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(label(page, "Hometown")).toHaveValue("Guntur");
  await saved(page);
  const stored = await readStored(page, id);
  expect(storedField(stored, "nativePlace")).toMatchObject({ label: "Hometown", value: "Guntur" });
  expect(printed(stored).sections.flatMap((s) => s.items).find((i) => i.kind === "row" && i.key === "nativePlace")).toMatchObject({ label: "Hometown" });

  await fieldMenu(page, "Hometown").click();
  await item(page, "Rename…").click();
  await page.getByRole("button", { name: "Use the usual label, “Native Place”" }).click();
  await expect(label(page, "Native Place")).toHaveValue("Guntur");
  await saved(page);
  expect(storedField(await readStored(page, id), "nativePlace")).not.toHaveProperty("label");
});

test("a field moves to another section with its value, and stays there after a reload", async ({ page }) => {
  const id = await openNewDraft(page);
  // Partner preferences has an "Occupation" too: this is the one in Career.
  const career = section(page, "career");
  await career.getByLabel("Occupation", { exact: true }).fill("Software Engineer");
  await career.getByRole("button", { name: "Options for “Occupation”", exact: true }).click();
  await item(page, "Move to section").click();
  await item(page, "Personal Details").click();
  await expect(toast(page)).toContainText("“Occupation” moved to Personal Details.");
  const personal = section(page, "personal");
  await expect(personal.getByLabel("Occupation", { exact: true })).toHaveValue("Software Engineer");
  await expect(career.getByLabel("Occupation", { exact: true })).toHaveCount(0);
  await expect(personal.getByRole("button", { name: "Options for “Occupation”", exact: true })).toBeFocused();
  await saved(page);

  await page.reload();
  expect((await rowsOf(section(page, "personal"))).at(-1)).toBe("Occupation");
  const stored = await readStored(page, id);
  const storedPersonal = stored.sections.find((s) => s.key === "personal");
  expect(storedPersonal?.kind === "fields" && storedPersonal.fields.at(-1)).toMatchObject({ key: "occupation", value: "Software Engineer" });
});

test("a section moves up, and the rail or chips follow", async ({ page, isMobile }) => {
  const id = await openNewDraft(page);
  const before = await sectionOrder(page);
  expect(before.indexOf("religion")).toBe(before.indexOf("horoscope") - 1);
  await sectionMenu(page, "Horoscope Details").click();
  await item(page, "Move up").click();
  await expect.poll(() => sectionOrder(page)).toEqual(["aboutMe", "personal", "horoscope", "religion", ...before.slice(4)]);
  await expect(sectionMenu(page, "Horoscope Details")).toBeFocused();
  const nav = isMobile ? page.getByTestId("section-jump") : page.getByTestId("section-rail");
  const names = await nav.getByRole("link").allTextContents();
  const horoscope = names.findIndex((n) => n.startsWith("Horoscope"));
  expect(names[horoscope + 1]).toMatch(/^Religion/);
  await saved(page);
  await page.reload();
  expect((await sectionOrder(page)).slice(2, 4)).toEqual(["horoscope", "religion"]);
  expect((await readStored(page, id)).sections.map((s) => s.key).slice(2, 4)).toEqual(["horoscope", "religion"]);
});

test("removing asks first, and Undo puts the field back where it was with its value", async ({ page }) => {
  const id = await openNewDraft(page);
  const horoscope = section(page, "horoscope");
  await label(page, "Gotra").fill("Bharadwaja");
  const order = await rowsOf(horoscope);

  await fieldMenu(page, "Gotra").click();
  await page.getByRole("menuitem", { name: "Remove…" }).click();
  const dialog = page.getByRole("dialog", { name: "Remove “Gotra”?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(label(page, "Gotra")).toHaveValue("Bharadwaja");

  await fieldMenu(page, "Gotra").click();
  await page.getByRole("menuitem", { name: "Remove…" }).click();
  await dialog.getByRole("button", { name: "Remove" }).click();
  await expect(label(page, "Gotra")).toHaveCount(0);
  await expect(toast(page)).toContainText("“Gotra” removed.");
  await saved(page);
  expect(storedField(await readStored(page, id), "gotra")).toBeUndefined();

  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect(label(page, "Gotra")).toHaveValue("Bharadwaja");
  expect(await rowsOf(horoscope)).toEqual(order);
  await expect(toast(page)).toContainText("“Gotra” is back.");
  await saved(page);
  expect(storedField(await readStored(page, id), "gotra")).toMatchObject({ value: "Bharadwaja" });
});

test("a removal not undone is gone after a reload, for a field and for a section", async ({ page }) => {
  const id = await openNewDraft(page);
  await fieldMenu(page, "Caste").click();
  await page.getByRole("menuitem", { name: "Remove…" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
  await sectionMenu(page, "Family Background").click();
  await page.getByRole("menuitem", { name: "Remove section…" }).click();
  await expect(page.getByRole("dialog", { name: "Remove the “Family Background” section?" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
  await expect(section(page, "familyBackground")).toHaveCount(0);
  // The Undo offer goes after 6 seconds.
  await expect(toast(page)).toBeVisible();
  await expect(toast(page)).toBeHidden({ timeout: 9000 });
  await saved(page);

  await page.reload();
  await expect(label(page, "Caste")).toHaveCount(0);
  await expect(section(page, "familyBackground")).toHaveCount(0);
  await expect(toast(page)).toHaveCount(0);
  const stored = await readStored(page, id);
  expect(storedField(stored, "caste")).toBeUndefined();
  expect(stored.sections.some((s) => s.key === "familyBackground")).toBe(false);
});

test("References and a section of your own are added at the end", async ({ page, isMobile }) => {
  const id = await openNewDraft(page);
  await page.getByRole("button", { name: "Add a section" }).last().click();
  const dialog = page.getByRole("dialog", { name: "Add a section" });
  await dialog.getByRole("button", { name: /^References/ }).click();
  await expect(dialog).toBeHidden();
  await expect(section(page, "references")).toBeVisible();
  expect((await sectionOrder(page)).at(-1)).toBe("references");
  const nav = isMobile ? page.getByTestId("section-jump") : page.getByTestId("section-rail");
  await expect(nav.getByRole("link", { name: /References/ })).toBeVisible();

  // References is offered once; a removed default section would be offered back.
  await page.locator("#add-section").click();
  await expect(dialog.getByRole("button", { name: /^References/ })).toHaveCount(0);
  await dialog.getByLabel("Section title").fill("Hobbies and interests");
  await dialog.getByRole("button", { name: "Add section" }).click();
  const hobbies = page.locator("section", { has: page.getByRole("heading", { name: "Hobbies and interests" }) });
  await expect(hobbies).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hobbies and interests" })).toBeFocused();
  await expect(hobbies.getByTestId("section-empty")).toBeVisible();
  await hobbies.getByRole("button", { name: "Add a field" }).click();
  await page.getByRole("dialog").getByLabel("Label", { exact: true }).fill("Music");
  await page.getByRole("dialog").getByRole("button", { name: "Add field" }).click();
  await label(page, "Music").fill("Carnatic violin");
  await saved(page);

  const stored = await readStored(page, id);
  expect(stored.sections.at(-2)).toMatchObject({ kind: "family", key: "references", members: [] });
  expect(stored.sections.at(-1)).toMatchObject({ kind: "fields", title: "Hobbies and interests", fields: [{ label: "Music", value: "Carnatic violin" }] });
  expect(printed(stored).sections.at(-1)).toMatchObject({ title: "Hobbies and interests", items: [{ label: "Music", value: "Carnatic violin" }] });
});

test("restore default fields re-adds a removed default field and leaves everything else alone", async ({ page }) => {
  const id = await openNewDraft(page);
  const horoscope = section(page, "horoscope");
  await label(page, "Gotra").fill("Kashyapa");
  await page.getByRole("button", { name: "Show “Manglik” on the biodata" }).click();
  await horoscope.getByRole("button", { name: "Add a field" }).click();
  await page.getByRole("dialog").getByLabel("Label", { exact: true }).fill("Lagna");
  await page.getByRole("dialog").getByRole("button", { name: "Add field" }).click();
  await fieldMenu(page, "Place of Birth").click();
  await page.getByRole("menuitem", { name: "Remove…" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
  await expect(label(page, "Place of Birth")).toHaveCount(0);

  // Nothing missing in Personal Details: its Restore is there but off.
  await sectionMenu(page, "Personal Details").click();
  await expect(item(page, "Restore default fields")).toBeDisabled();
  await page.keyboard.press("Escape");

  await sectionMenu(page, "Horoscope Details").click();
  await item(page, "Restore default fields").click();
  await expect(toast(page)).toContainText("1 default field added back to Horoscope Details.");
  expect(await rowsOf(horoscope)).toEqual(["Time of Birth", "Place of Birth", "Rashi", "Nakshatra", "Pada", "Gotra", "Maternal Gotra", "Manglik", "Lagna"]);
  await expect(label(page, "Gotra")).toHaveValue("Kashyapa");
  await expect(page.getByTestId("row-manglik")).toHaveAttribute("data-hidden", "");
  await saved(page);
  const stored = await readStored(page, id);
  expect(storedField(stored, "birthPlace")).toMatchObject({ value: "", visible: true });
  expect(storedField(stored, "gotra")).toMatchObject({ value: "Kashyapa" });
  expect(storedField(stored, "manglik")).toMatchObject({ visible: false });
});

test("a field's menu works from the keyboard alone", async ({ page }) => {
  await openNewDraft(page);
  const personal = section(page, "personal");
  await label(page, "Native Place").focus();
  await page.keyboard.press("Tab"); // the eye
  await page.keyboard.press("Tab"); // the ⋯ button
  await expect(fieldMenu(page, "Native Place")).toBeFocused();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu", { name: "Options for “Native Place”" });
  await expect(menu).toBeVisible();
  await expect(item(page, "Rename…")).toBeFocused();

  // Down to Move up (Rename, Change type, Multiple lines, Move up) and press it.
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowDown");
  await expect(item(page, "Move up")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(menu).toBeHidden();
  await expect(fieldMenu(page, "Native Place")).toBeFocused();
  expect((await rowsOf(personal)).slice(-2)).toEqual(["Native Place", "Current City"]);

  // ArrowDown on the button opens it; ArrowRight opens a list in place, ArrowLeft comes back; Escape closes.
  await page.keyboard.press("ArrowDown");
  await expect(menu).toBeVisible();
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowUp"); // Hide from the biodata
  await page.keyboard.press("ArrowUp"); // Move to section
  await expect(item(page, "Move to section")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(item(page, "About Me")).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(item(page, "Move to section")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown"); // Religion and Community
  await page.keyboard.press("Enter");
  await expect(section(page, "religion").getByLabel("Native Place", { exact: true })).toBeVisible();
  await expect(fieldMenu(page, "Native Place")).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(fieldMenu(page, "Native Place")).toBeFocused();
});
