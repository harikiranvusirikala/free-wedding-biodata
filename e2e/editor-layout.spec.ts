import { expect, test, type Locator, type Page } from "@playwright/test";
import { SAVED, readStored, storedField } from "./editor-helpers";

// Step 2.4: the Simple and Detailed forms (VISION D50). A new draft starts Simple (four sections, the fields most
// biodatas print); the switch at the top of the form changes the form without losing anything typed, Undo puts
// the draft back, a reload keeps the choice, and a filled Simple draft prints on one page. Values are fictional
// (VISION D29). Nothing is ever requested from another origin.

const status = (page: Page) => page.getByTestId("save-status");
const idOf = (page: Page) => new URL(page.url()).searchParams.get("d")!;
const section = (page: Page, key: string) => page.locator(`[data-section="${key}"]`);
const label = (page: Page, text: string) => page.getByLabel(text, { exact: true });
const form = (page: Page) => page.getByRole("radiogroup", { name: "Form" });
const choice = (page: Page, name: "Simple" | "Detailed") => form(page).getByRole("radio", { name, exact: true });
const toast = (page: Page) => page.getByTestId("manage-toast");
/** The rows of a section card: default fields by their label, family members by their relation. */
const rowsOf = (card: Locator) => card.locator("[data-testid^='row-'] label, [data-testid^='member-'] label").allTextContents();
/** The biodata's sections, without the top card and the photo card. */
const sectionOrder = (page: Page) =>
  page.locator("section[data-section]:not([data-section='top']):not([data-section='photo'])").evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.section));

const SIMPLE_PERSONAL = [
  "Name",
  "Date of Birth",
  "Time of Birth",
  "Place of Birth",
  "Nakshatra",
  "Rashi",
  "Caste",
  "Gotra",
  "Maternal Gotra",
  "Height",
  "Complexion",
  "Qualification",
  "Occupation",
  "Annual Income",
];
const DETAILED_SECTIONS = ["aboutMe", "personal", "religion", "horoscope", "education", "career", "family", "familyBackground", "contact", "partnerPreferences"];

async function openNewDraft(page: Page) {
  await page.goto("/editor?new=1");
  await expect(page).toHaveURL(/\/editor\?d=[0-9a-f-]{36}$/);
  await expect(label(page, "Name")).toBeVisible();
  return idOf(page);
}

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

test("a new draft starts with the Simple form: four sections and the fields most biodatas print", async ({ page }) => {
  const id = await openNewDraft(page);
  await expect(choice(page, "Simple")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("form-layout")).toContainText("The fields most biodatas have, usually one page.");
  expect(await sectionOrder(page)).toEqual(["personal", "family", "contact", "partnerPreferences"]);
  expect(await rowsOf(section(page, "personal"))).toEqual(SIMPLE_PERSONAL);
  expect(await rowsOf(section(page, "family"))).toEqual(["Father", "Mother"]);
  expect(await rowsOf(section(page, "contact"))).toEqual(["Phone", "Address"]);
  expect(await rowsOf(section(page, "partnerPreferences"))).toEqual(["Expectations"]);
  // Complexion is a plain typed field below Height (owner's choice); the tradition chips sit in Personal details, since Simple has no Religion card.
  await expect(page.locator('[data-section="personal"]').getByLabel("Complexion", { exact: true })).toBeVisible();
  await expect(section(page, "personal").getByTestId("tradition-chips")).toBeVisible();
  // The switch sits above the Top of your biodata card.
  const switchBox = (await page.getByTestId("form-layout").boundingBox())!;
  const topBox = (await section(page, "top").boundingBox())!;
  expect(switchBox.y + switchBox.height).toBeLessThanOrEqual(topBox.y);
  expect((await readStored(page, id)).options.formLayout).toBe("simple");
});

test("switching keeps what was typed both ways, a filled Detailed field stays in Simple, and Undo puts it back", async ({ page }) => {
  const id = await openNewDraft(page);
  await label(page, "Name").fill("Sai Teja Mandapati");
  await label(page, "Time of Birth").fill("6:45 am");
  await label(page, "Qualification").fill("B.Tech (Computer Science)");
  await label(page, "Phone").fill("+91 90000 00001");
  await label(page, "Phone").blur();
  await expect(status(page)).toHaveText(SAVED);

  await choice(page, "Detailed").click();
  await expect(choice(page, "Detailed")).toHaveAttribute("aria-checked", "true");
  await expect(toast(page)).toContainText("Switched to the Detailed form");
  await expect(page.getByTestId("form-layout")).toContainText("Every section: horoscope, education, career, family background and more.");
  expect(await sectionOrder(page)).toEqual(DETAILED_SECTIONS);
  // Moved to their Detailed homes with their values.
  await expect(section(page, "horoscope").getByLabel("Time of Birth", { exact: true })).toHaveValue("6:45 AM");
  await expect(section(page, "education").getByLabel("Qualification", { exact: true })).toHaveValue("B.Tech (Computer Science)");
  await expect(section(page, "personal").getByLabel("Name", { exact: true })).toHaveValue("Sai Teja Mandapati");
  await expect(section(page, "contact").getByLabel("Phone", { exact: true })).toHaveValue("+91 90000 00001");
  // A field only the Detailed form has, filled in.
  await section(page, "career").getByLabel("Employer", { exact: true }).fill("Example Technologies Pvt. Ltd.");
  await expect(status(page)).toHaveText(SAVED);

  await choice(page, "Simple").click();
  await expect(toast(page)).toContainText("Switched to the Simple form. Anything you filled in is kept.");
  expect(await sectionOrder(page)).toEqual(["personal", "career", "family", "contact", "partnerPreferences"]);
  expect(await rowsOf(section(page, "career"))).toEqual(["Employer"]);
  await expect(section(page, "career").getByLabel("Employer", { exact: true })).toHaveValue("Example Technologies Pvt. Ltd.");
  await expect(section(page, "personal").getByLabel("Time of Birth", { exact: true })).toHaveValue("6:45 AM");
  await expect(section(page, "personal").getByLabel("Qualification", { exact: true })).toHaveValue("B.Tech (Computer Science)");
  await expect(status(page)).toHaveText(SAVED);
  let stored = await readStored(page, id);
  expect(stored.options.formLayout).toBe("simple");
  expect(storedField(stored, "birthTime")).toMatchObject({ value: "06:45" });

  // Undo: back to the Detailed form, exactly as it was.
  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect(toast(page)).toContainText("Back to the Detailed form");
  await expect(choice(page, "Detailed")).toHaveAttribute("aria-checked", "true");
  expect(await sectionOrder(page)).toEqual(DETAILED_SECTIONS);
  await expect(section(page, "career").getByLabel("Employer", { exact: true })).toHaveValue("Example Technologies Pvt. Ltd.");
  await expect(section(page, "horoscope").getByLabel("Time of Birth", { exact: true })).toHaveValue("6:45 AM");
  await expect(status(page)).toHaveText(SAVED);
  stored = await readStored(page, id);
  expect(stored.options.formLayout).toBe("detailed");
  expect(stored.sections.map((s) => s.key)).toEqual(DETAILED_SECTIONS);
});

test("a reload keeps the chosen form, and the switch works from the keyboard", async ({ page }) => {
  const id = await openNewDraft(page);
  await choice(page, "Simple").focus();
  await page.keyboard.press("ArrowRight");
  await expect(choice(page, "Detailed")).toHaveAttribute("aria-checked", "true");
  await expect(choice(page, "Detailed")).toBeFocused();
  await expect(section(page, "horoscope")).toBeVisible();
  await expect(status(page)).toHaveText(SAVED);

  await page.reload();
  await expect(page).toHaveURL(`/editor?d=${id}`);
  await expect(choice(page, "Detailed")).toHaveAttribute("aria-checked", "true");
  expect(await sectionOrder(page)).toEqual(DETAILED_SECTIONS);
  // Tab reaches the chosen option; the arrow goes back to Simple.
  await choice(page, "Detailed").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(choice(page, "Simple")).toHaveAttribute("aria-checked", "true");
  expect(await sectionOrder(page)).toEqual(["personal", "family", "contact", "partnerPreferences"]);
});

/** A Simple draft filled the way most families fill it (fictional values only). */
async function fillSimpleDraft(page: Page) {
  const personal = section(page, "personal");
  await label(page, "Name").fill("Sai Teja Mandapati");
  await label(page, "Date of Birth").fill("14-08-1996");
  await label(page, "Time of Birth").fill("6:45 am");
  await label(page, "Place of Birth").fill("Guntur");
  await page.getByRole("combobox", { name: "Nakshatra" }).fill("Magha");
  await page.getByRole("combobox", { name: "Rashi" }).fill("Simha");
  await label(page, "Gotra").fill("Bharadwaja");
  await label(page, "Maternal Gotra").fill("Kashyapa");
  await personal.getByLabel("Height", { exact: true }).selectOption({ label: "5 ft 10 in · 178 cm" });
  await label(page, "Qualification").fill("B.Tech (Computer Science)");
  await label(page, "Occupation").fill("Software Engineer, Hyderabad");
  await label(page, "Annual Income").fill("₹ 18 lakh per year");
  await label(page, "Father").fill("Mandapati Venkata Rao, Retired Headmaster, Guntur");
  await label(page, "Mother").fill("Mandapati Lakshmi, Homemaker");
  await label(page, "Phone").fill("+91 90000 00001");
  await label(page, "Address").fill("Plot 12, Sample Colony, Guntur, Andhra Pradesh");
  await page.getByRole("textbox", { name: "Expectations" }).fill("Someone kind, family-minded and independent, who enjoys travel and simple living.");
  await label(page, "Phone").focus();
  await expect(status(page)).toHaveText(SAVED);
}

test("a filled Simple draft prints on one page", async ({ page, isMobile }) => {
  await openNewDraft(page);
  await fillSimpleDraft(page);
  if (isMobile) {
    await page.getByTestId("preview-pill").click();
    const sheet = page.getByRole("dialog", { name: "Preview" });
    await expect(sheet).toBeVisible();
    // Wait for the last thing typed to reach the preview (an empty draft is also one page).
    await expect(sheet.locator('[data-page="1"]')).toContainText("simple living");
    await expect(sheet.locator('[data-page="2"]')).toHaveCount(0);
    await expect(page.getByTestId("pill-pages")).toHaveText("1 page");
    return;
  }
  const pageOne = page.locator('[data-testid="preview-pages"] [data-page="1"]');
  await expect(pageOne).toContainText("simple living");
  await expect(pageOne).toContainText("Mandapati Lakshmi");
  await expect(page.locator('[data-testid="preview-pages"] [data-doc-ready="1"]')).toHaveAttribute("data-doc-pages", "1");
  await expect(page.getByTestId("preview-status")).toHaveText("Fits on 1 page · A4");
});
