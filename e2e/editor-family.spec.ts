import { expect, test, type Locator, type Page } from "@playwright/test";
import { toDocument } from "../src/biodata/document";
import type { BiodataProfile, FamilySection } from "../src/biodata/types";
import { getDocDictionary } from "../src/i18n/doc";
import { SAVED, readStored, storedField, switchToDetailed } from "./editor-helpers";

// Step 2.3: family members and References (VISION §6 "Repeated family members", D28, D44) and Open a sample.
// Each change is checked on screen, after a reload, in the draft on disk and in what the biodata prints (the
// document model the preview, print and PDF are laid out from, D1). Fictional names and 90000 numbers only.

const status = (page: Page) => page.getByTestId("save-status");
const idOf = (page: Page) => new URL(page.url()).searchParams.get("d")!;
const section = (page: Page, key: string) => page.locator(`[data-section="${key}"]`);
const label = (page: Page, text: string) => page.getByLabel(text, { exact: true });
const memberMenu = (page: Page, relation: string) => page.getByRole("button", { name: `Options for “${relation}”`, exact: true });
const item = (page: Page, name: string) => page.getByRole("menuitem", { name, exact: true });
const toast = (page: Page) => page.getByTestId("manage-toast");
const memberDialog = (page: Page) => page.getByRole("dialog").filter({ has: page.getByTestId("member-dialog") });

/** A new draft in the Detailed form, whose sections this spec works with (new drafts start Simple, D50). */
async function openNewDraft(page: Page) {
  await page.goto("/editor?new=1");
  await expect(page).toHaveURL(/\/editor\?d=[0-9a-f-]{36}$/);
  await expect(label(page, "Name")).toBeVisible();
  await switchToDetailed(page);
  return idOf(page);
}

async function saved(page: Page) {
  await expect(status(page)).toHaveText(SAVED);
}

/** The relation labels of a list's rows, in order. */
const relationsOf = (card: Locator) => card.locator("[data-testid^='member-'] label").allTextContents();

const list = (profile: BiodataProfile, key: string) => profile.sections.find((s) => s.key === key) as FamilySection;

/** What the biodata prints for a stored draft, in a document language. */
function printed(profile: BiodataProfile, lang: "en" | "te" = "en") {
  return toDocument({ ...profile, docLanguage: lang }, getDocDictionary(lang), new Date("2026-11-22T00:00:00Z"));
}

/** Adds a member from the list's Add button: a picked relation (by name) or a typed one, with details. */
async function addMember(page: Page, key: string, relation: { pick: string } | { type: string }, details: string) {
  const button = section(page, key).getByRole("button", { name: key === "references" ? "Add a reference" : "Add a family member" });
  await button.click();
  const dialog = memberDialog(page);
  await expect(dialog).toBeVisible();
  if ("pick" in relation) await dialog.getByRole("radio", { name: relation.pick, exact: true }).check();
  else await dialog.getByLabel("Or type a relation").fill(relation.type);
  await dialog.getByLabel("Details").fill(details);
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog).toBeHidden();
}

test("a sibling added with a picked relation is kept after a reload and prints in the document language", async ({ page }) => {
  const id = await openNewDraft(page);
  const family = section(page, "family");
  await addMember(page, "family", { pick: "Brother (Elder)" }, "Ravi Kumar Mandapati, Engineer, Pune");
  await expect(label(page, "Brother (Elder)")).toBeFocused();
  await expect(label(page, "Brother (Elder)")).toHaveValue("Ravi Kumar Mandapati, Engineer, Pune");
  expect(await relationsOf(family)).toEqual(["Father", "Mother", "Brother (Elder)"]);
  await expect(family.getByTestId("section-completion")).toHaveText("1 of 3 filled");
  await saved(page);

  await page.reload();
  await expect(label(page, "Brother (Elder)")).toHaveValue("Ravi Kumar Mandapati, Engineer, Pune");
  const stored = await readStored(page, id);
  expect(list(stored, "family").members.at(-1)).toMatchObject({ relationKey: "elderBrother", relation: "", details: "Ravi Kumar Mandapati, Engineer, Pune", visible: true });
  const te = getDocDictionary("te").relations.elderBrother;
  expect(printed(stored, "te").sections.find((s) => s.items.some((i) => i.kind === "row" && i.value.startsWith("Ravi")))?.items).toContainEqual(expect.objectContaining({ label: te }));
});

test("a typed relation prints as typed; typing a suggestion's name picks it; Change relation", async ({ page }) => {
  const id = await openNewDraft(page);
  await addMember(page, "family", { type: "Godfather" }, "Suresh Babu, Guntur");
  await addMember(page, "family", { type: "cousin" }, "Lakshmi Prasanna, Chennai");
  await expect(label(page, "Godfather")).toHaveValue("Suresh Babu, Guntur");
  await expect(label(page, "Cousin")).toHaveValue("Lakshmi Prasanna, Chennai");

  // Father becomes a typed relation from the row's ⋯ menu.
  await memberMenu(page, "Father").click();
  await item(page, "Change relation…").click();
  const dialog = memberDialog(page);
  await expect(dialog.getByRole("radio", { name: "Father", exact: true })).toBeChecked();
  await expect(dialog.getByLabel("Details")).toHaveCount(0);
  await dialog.getByLabel("Or type a relation").fill("Father (Late)");
  await expect(dialog.getByRole("radio", { name: "Father", exact: true })).not.toBeChecked();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(label(page, "Father (Late)")).toBeVisible();
  await saved(page);

  await page.reload();
  await expect(label(page, "Godfather")).toHaveValue("Suresh Babu, Guntur");
  const members = list(await readStored(page, id), "family").members;
  expect(members[0]).toMatchObject({ relation: "Father (Late)" });
  expect(members[0]).not.toHaveProperty("relationKey");
  expect(members.at(-2)).toMatchObject({ relation: "Godfather", details: "Suresh Babu, Guntur" });
  expect(members.at(-2)).not.toHaveProperty("relationKey");
  expect(members.at(-1)).toMatchObject({ relationKey: "cousin", relation: "" });
  const rows = printed(await readStored(page, id), "te").sections.flatMap((s) => s.items);
  expect(rows).toContainEqual(expect.objectContaining({ label: "Godfather", value: "Suresh Babu, Guntur" }));
});

test("members move up and down, and a removed one comes back with Undo", async ({ page }) => {
  const id = await openNewDraft(page);
  const family = section(page, "family");
  await addMember(page, "family", { pick: "Sister (Elder)" }, "Sravani Kolli, Bengaluru");
  await addMember(page, "family", { pick: "Brother (Younger)" }, "Kiran Mandapati, Student");

  await memberMenu(page, "Brother (Younger)").click();
  await expect(item(page, "Move down")).toBeDisabled();
  await item(page, "Move up").click();
  await expect.poll(() => relationsOf(family)).toEqual(["Father", "Mother", "Brother (Younger)", "Sister (Elder)"]);
  await expect(memberMenu(page, "Brother (Younger)")).toBeFocused();
  await memberMenu(page, "Father").click();
  await expect(item(page, "Move up")).toBeDisabled();
  await page.keyboard.press("Escape");

  // Hide from the menu keeps the details; Show brings the row back.
  await memberMenu(page, "Mother").click();
  await item(page, "Hide from the biodata").click();
  await expect(family.locator('[data-testid="member-mother"]')).toHaveAttribute("data-hidden", "");
  await memberMenu(page, "Mother").click();
  await item(page, "Show on the biodata").click();
  await expect(family.locator('[data-testid="member-mother"]')).not.toHaveAttribute("data-hidden", "");

  await memberMenu(page, "Brother (Younger)").click();
  await item(page, "Remove…").click();
  const confirm = page.getByRole("dialog", { name: "Remove “Brother (Younger)”?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Remove" }).click();
  await expect.poll(() => relationsOf(family)).toEqual(["Father", "Mother", "Sister (Elder)"]);
  await expect(toast(page)).toContainText("“Brother (Younger)” removed.");
  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => relationsOf(family)).toEqual(["Father", "Mother", "Brother (Younger)", "Sister (Elder)"]);
  await expect(label(page, "Brother (Younger)")).toHaveValue("Kiran Mandapati, Student");
  await saved(page);

  await page.reload();
  expect(await relationsOf(section(page, "family"))).toEqual(["Father", "Mother", "Brother (Younger)", "Sister (Elder)"]);
  expect(list(await readStored(page, id), "family").members.map((m) => m.relationKey)).toEqual(["father", "mother", "youngerBrother", "elderSister"]);
});

test("a reference can list two phone numbers, each printed on its own line", async ({ page }) => {
  const id = await openNewDraft(page);
  await page.locator("#add-section").click();
  await page.getByRole("dialog", { name: "Add a section" }).getByRole("button", { name: /^References/ }).click();
  const references = section(page, "references");
  await expect(references.getByTestId("section-empty")).toBeVisible();
  const details = "Pothuri Srinivas, Textile Business, Vijayawada\n+91 90000 00004\n+91 90000 00005";
  await addMember(page, "references", { pick: "Uncle (Maternal)" }, details);
  await expect(references.getByTestId("section-empty")).toHaveCount(0);
  await expect(label(page, "Uncle (Maternal)")).toHaveValue(details);
  // A second reference with the same relation, and a line break typed in the list itself.
  await addMember(page, "references", { pick: "Uncle (Maternal)" }, "Rao Garu, Guntur");
  const second = references.locator("[data-testid='member-maternalUncle']").nth(1).getByRole("textbox");
  await second.focus();
  await second.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(el.value.length, el.value.length));
  await second.press("Enter");
  await second.pressSequentially("+91 90000 00006");
  await saved(page);

  await page.reload();
  await expect(label(page, "Uncle (Maternal)").first()).toHaveValue(details);
  const stored = list(await readStored(page, id), "references");
  expect(stored.members.map((m) => m.details)).toEqual([details, "Rao Garu, Guntur\n+91 90000 00006"]);
  const rows = printed(await readStored(page, id)).sections.find((s) => s.title === "References")!.items;
  expect(rows[0]).toMatchObject({ label: "Uncle (Maternal)", value: details, multiline: true });

  // On the printed page each number sits on its own line.
  await page.goto(`/dev/draft?d=${id}`);
  await expect(page.locator("body[data-doc-ready]")).toHaveCount(1);
  const pageOne = page.locator("[data-page]").first();
  for (const phone of ["+91 90000 00004", "+91 90000 00005", "+91 90000 00006"]) await expect(pageOne.getByText(phone)).toBeVisible();
  // The value's text runs over three lines (name, then one number per line).
  const lines = await pageOne.getByText("+91 90000 00004").evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
  });
  expect(lines).toBe(3);
});

test("Open a sample makes a new draft from the fictional sample and leaves the open draft untouched", async ({ page }) => {
  const id = await openNewDraft(page);
  await label(page, "Name").fill("Asha Rani");
  await saved(page);
  const before = await readStored(page, id);

  await page.getByTestId("draft-title").click();
  await page.getByRole("menuitem", { name: /Open a sample/ }).click();
  await expect(page).not.toHaveURL(new RegExp(id));
  await expect(page).toHaveURL(/\/editor\?d=[0-9a-f-]{36}$/);
  await expect(label(page, "Name")).toHaveValue("Sai Teja Mandapati");
  await expect(page.getByTestId("draft-title")).toHaveText("Sample: Sai Teja Mandapati");
  await expect(section(page, "references")).toBeVisible();
  const sampleId = idOf(page);
  const sample = await readStored(page, sampleId);
  expect(sample.revision).toBe(0);
  expect(storedField(sample, "phone")?.value).toBe("+91 90000 00001");
  expect(sample.sections.every((s) => !s.id.startsWith("sample-"))).toBe(true);

  // The draft that was open is exactly as it was, and both are listed.
  expect(await readStored(page, id)).toEqual(before);
  await page.getByTestId("draft-title").click();
  await expect(page.getByTestId("drafts-list").getByRole("menuitemradio")).toHaveCount(2);
  await page.keyboard.press("Escape");

  // A second sample is another new draft, never the same one reopened.
  await page.getByTestId("draft-title").click();
  await page.getByRole("menuitem", { name: /Open a sample/ }).click();
  await expect(page).not.toHaveURL(new RegExp(sampleId));
  await expect(label(page, "Name")).toHaveValue("Sai Teja Mandapati");
});

test("the rail says how much of the biodata is filled, leaving hidden lines out", async ({ page, isMobile }) => {
  test.skip(isMobile, "the rail shows from 1024 px");
  await page.setViewportSize({ width: 1440, height: 900 });
  await openNewDraft(page);
  const overall = page.getByTestId("overall-completion");
  await expect(overall).toContainText("Your biodata is 0% filled");
  await label(page, "Name").fill("Asha Rani");
  const percent = async () => Number((await overall.textContent())?.match(/(\d+)%/)?.[1]);
  await expect.poll(percent).toBeGreaterThan(0);
  const one = await percent();
  // Hiding an empty line leaves fewer lines to fill, so the share goes up.
  await page.getByRole("button", { name: "Show “Nationality” on the biodata" }).click();
  await expect.poll(percent).toBeGreaterThan(one);
});
