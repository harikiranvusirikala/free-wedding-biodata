import { expect, test, type Page } from "@playwright/test";
import { SAVED, openStoredDraft, readStored, sampleDraft } from "./editor-helpers";

// Step 3.3: the live preview. Desktop: the right column shows the real pages (the same DocumentView as the PDF),
// follows typing and the design, colour, text size, label and language choices, counts and pages through the pages
// and zooms. Tablet: a pill opens a side sheet. Phone: a pill opens a bottom sheet (✕, Esc, backdrop, swipe).
// Nothing is ever requested from another origin.

const preview = (page: Page) => page.getByTestId("live-preview");
/** The preview's document once it shows the latest layout. */
const freshDoc = (page: Page) => page.locator('[data-testid="preview-pages"] [data-doc-ready="1"]');
const pageOne = (page: Page) => page.locator('[data-testid="preview-pages"] [data-page="1"]');

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

test.describe("desktop", () => {
  test.skip(({ isMobile }) => isMobile, "the preview column is a desktop layout");

  test("shows the sample's pages, counts them and pages through them", async ({ page }) => {
    await openStoredDraft(page, sampleDraft("preview-sample"));
    await expect(preview(page)).toBeVisible();
    await expect(freshDoc(page)).toHaveAttribute("data-doc-pages", "2");
    await expect(page.getByTestId("preview-status")).toHaveText("2 pages · A4");
    await expect(pageOne(page)).toContainText("Sai Teja Mandapati");
    // Fitted to the pane: the whole first page is visible.
    const box = (await pageOne(page).boundingBox())!;
    const pane = (await page.getByTestId("preview-pane").boundingBox())!;
    expect(box.height).toBeLessThanOrEqual(pane.height);
    expect(box.width / box.height).toBeCloseTo(794 / 1123, 2);

    const nav = page.getByTestId("page-nav");
    await expect(nav).toContainText("Page 1 of 2");
    await nav.getByRole("button", { name: "Next page" }).click();
    await expect(nav).toContainText("Page 2 of 2");
    await expect(nav.getByRole("button", { name: "Next page" })).toBeDisabled();
    const second = (await page.locator('[data-testid="preview-pages"] [data-page="2"]').boundingBox())!;
    expect(second.y).toBeGreaterThanOrEqual(pane.y - 1);
    expect(second.y).toBeLessThan(pane.y + 40);
    await nav.getByRole("button", { name: "Previous page" }).click();
    await expect(nav).toContainText("Page 1 of 2");

    // The cards about where the draft is kept moved to the end of the form.
    await expect(page.getByTestId("kept-cards")).toContainText("Saved on this device only");
    await expect(page.getByTestId("storage-card")).toBeAttached();
  });

  test("follows typing, keeping the old pages on screen meanwhile", async ({ page }) => {
    await page.goto("/editor?new=1");
    const name = page.getByLabel("Name", { exact: true });
    await name.fill("Sai Teja Mandapati");
    await expect(pageOne(page)).toContainText("Sai Teja Mandapati");
    await expect(page.getByTestId("preview-status")).toHaveText("Fits on 1 page · A4");
    await name.pressSequentially(" Garu", { delay: 30 });
    // Never a blank pane while it lays the page out again.
    await expect(pageOne(page)).toBeVisible();
    await expect(pageOne(page)).toContainText("Sai Teja Mandapati Garu");
    await page.getByLabel("Place of Birth", { exact: true }).fill("Hyderabad");
    await expect(pageOne(page)).toContainText("Hyderabad");
    await expect(page.getByTestId("save-status")).toHaveText(SAVED);
  });

  test("changes the design and colour, text size, labels and printing language", async ({ page }) => {
    await page.goto("/editor?new=1");
    await page.getByLabel("Name", { exact: true }).fill("Sai Teja Mandapati");
    await page.getByLabel("Date of Birth", { exact: true }).fill("15-03-1998");
    await expect(pageOne(page)).toContainText("Sai Teja Mandapati");
    const id = new URL(page.url()).searchParams.get("d")!;
    const paper = () => pageOne(page).evaluate((el) => getComputedStyle(el).backgroundColor);

    // Design: Paisley, in its first colour (Copper), then its Teal.
    await page.getByRole("button", { name: /^Design: Classic Gold/ }).click();
    const panel = page.getByTestId("design-panel");
    await expect(panel.getByRole("radio")).toHaveCount(10 + 3);
    await expect(panel.getByRole("radio", { name: "Classic Gold" })).toHaveAttribute("aria-checked", "true");
    await panel.getByRole("radio", { name: "Paisley" }).click();
    await expect.poll(paper).toBe("rgb(253, 247, 239)");
    await panel.getByRole("radio", { name: "Teal colour" }).click();
    await expect.poll(paper).toBe("rgb(248, 251, 246)");
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(page.getByRole("button", { name: "Design: Paisley, Teal. Change the design or colour" })).toBeFocused();
    await expect.poll(async () => (await readStored(page, id)).templateId).toBe("paisley");
    expect((await readStored(page, id)).colorId).toBe("teal");

    // Text size: XL, then Auto again (which names the size it chose).
    await page.getByRole("button", { name: /^Text size: Auto/ }).click();
    const sizes = page.getByTestId("text-size-panel");
    await sizes.getByRole("radiogroup", { name: "Text size" }).getByRole("radio", { name: "XL", exact: true }).click();
    await expect(freshDoc(page)).toHaveAttribute("data-doc-step", "xl");
    await expect(page.getByTestId("text-size-value")).toHaveText("Size XL");
    await expect(sizes.getByTestId("fit-hint")).toHaveText("Fits on one page");
    await sizes.getByRole("radio", { name: "Auto", exact: true }).click();
    await expect(page.getByTestId("text-size-value")).toHaveText(/^Auto · (XS|S|M|L|XL)$/);
    await expect(sizes.getByTestId("fit-hint")).toHaveText(/^Fits on one page at size (XS|S|M|L|XL)$/);

    // Labels in capitals.
    const label = pageOne(page).getByText(/^Date of Birth( :)?$/);
    expect(await label.evaluate((el) => getComputedStyle(el).textTransform)).not.toBe("uppercase");
    await sizes.getByRole("radio", { name: "ALL CAPS" }).click();
    await expect.poll(() => label.evaluate((el) => getComputedStyle(el).textTransform)).toBe("uppercase");
    await page.keyboard.press("Escape");
    await expect.poll(async () => (await readStored(page, id)).options).toMatchObject({ textSize: "auto", labelCase: "upper" });

    // The printing language, from the toolbar: the same dialog as the language notice.
    await preview(page).getByRole("button", { name: "Printing language: English. Change it" }).click();
    await page.getByRole("dialog").getByRole("radio", { name: /తెలుగు/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();
    await expect(pageOne(page)).toContainText("వ్యక్తిగత వివరాలు");
    await expect(page.getByTestId("language-notice")).toContainText("తెలుగు (Telugu)");
    // Capitals are for English headings only.
    await page.getByRole("button", { name: /^Text size:/ }).click();
    await expect(sizes.getByRole("radio", { name: "ALL CAPS" })).toBeDisabled();
    await expect(sizes).toContainText("Indian scripts have no capital letters");
  });

  test("zooms between the fitted page and true size", async ({ page }) => {
    await openStoredDraft(page, sampleDraft("preview-zoom"));
    await expect(freshDoc(page)).toBeAttached();
    const zoom = page.getByTestId("zoom-value");
    await expect(zoom).toHaveText(/^Fit · \d+%$/);
    await zoom.click();
    await expect(zoom).toHaveText("100%");
    await expect(page.getByTestId("preview-pages")).toHaveAttribute("data-scale", "1.000");
    expect(Math.round((await pageOne(page).boundingBox())!.width)).toBe(794);
    await page.getByRole("button", { name: "Zoom out" }).click();
    await expect(zoom).toHaveText("90%");
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.getByRole("button", { name: "Zoom in" }).click();
    await expect(zoom).toHaveText("110%");
    await zoom.click();
    await expect(zoom).toHaveText(/^Fit · \d+%$/);
  });

  test("stays in view while the form scrolls", async ({ page }) => {
    await openStoredDraft(page, sampleDraft("preview-sticky"));
    await expect(freshDoc(page)).toBeAttached();
    await page.locator('[data-section="contact"]').evaluate((el) => el.scrollIntoView({ block: "start" }));
    const box = (await preview(page).boundingBox())!;
    expect(box.y).toBeCloseTo(56, 0);
    await expect(pageOne(page)).toBeInViewport();
  });

  test("below 1024 px a pill opens the preview in a side sheet", async ({ page }) => {
    await page.setViewportSize({ width: 810, height: 1080 });
    await openStoredDraft(page, sampleDraft("preview-tablet"));
    await expect(preview(page)).toHaveCount(0);
    const pill = page.getByTestId("preview-pill");
    await expect(pill).toHaveText(/Preview & download\s*2 pages/);
    await pill.click();
    const sheet = page.getByRole("dialog", { name: "Preview" });
    await expect(sheet).toBeVisible();
    await expect.poll(async () => (await sheet.boundingBox())!.x).toBeGreaterThan(100); // from the right, not full width
    await expect(sheet.getByTestId("design-choices").getByRole("radio")).toHaveCount(10);
    await expect(sheet.locator('[data-page="1"]')).toBeInViewport();
    await sheet.getByRole("button", { name: "Close the preview" }).click();
    await expect(page.getByTestId("preview-sheet")).not.toHaveAttribute("data-open");
    await expect(pill).toBeFocused();
  });
});

test.describe("phone", () => {
  test.skip(({ isMobile }) => !isMobile, "the pill and sheet are the phone layout");

  test("the pill opens the sheet, which changes the design and closes every way", async ({ page }) => {
    await openStoredDraft(page, sampleDraft("preview-phone"));
    const pill = page.getByTestId("preview-pill");
    await expect(pill).toBeVisible();
    await expect(page.getByTestId("pill-pages")).toHaveText("2 pages");
    const sheet = page.getByRole("dialog", { name: "Preview" });
    await expect(sheet).toBeHidden();

    await pill.click();
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("heading", { name: "Preview" })).toBeFocused();
    // The page behind is inert while it is open.
    expect(await page.getByTestId("editor-form").evaluate((el) => (el as HTMLElement).inert)).toBe(true);
    await expect(sheet.locator('[data-page="1"]')).toContainText("Sai Teja Mandapati");
    // Fitted to the width.
    const pageBox = (await sheet.locator('[data-page="1"]').boundingBox())!;
    expect(pageBox.width).toBeGreaterThan(330);
    expect(pageBox.width).toBeLessThanOrEqual(390);
    await expect(sheet.getByTestId("fit-hint")).toHaveText("Takes 2 pages, even at the smallest size");
    await expect(sheet.getByRole("button", { name: "Download PDF" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Print", exact: true })).toHaveCount(0);
    await expect(sheet.getByRole("button", { name: "Save as image" })).toBeVisible();

    await sheet.getByTestId("design-choices").getByRole("radio", { name: "Kalyanam" }).click();
    await expect(sheet.getByTestId("design-choices").getByRole("radio", { name: "Kalyanam" })).toHaveAttribute("aria-checked", "true");
    await sheet.getByTestId("colour-picker").getByRole("radio").nth(1).click();
    const id = new URL(page.url()).searchParams.get("d")!;
    await expect.poll(async () => (await readStored(page, id)).templateId).toBe("kalyanam");
    await sheet.getByRole("radiogroup", { name: "Text size" }).getByRole("radio", { name: "S", exact: true }).click();
    await expect(page.locator('[data-testid="preview-pages"] [data-doc-ready="1"]')).toHaveAttribute("data-doc-step", "s");

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(pill).toBeFocused();
    expect(await page.getByTestId("editor-form").evaluate((el) => (el as HTMLElement).inert)).toBe(false);

    await pill.click();
    await expect(sheet).toBeVisible();
    await page.mouse.click(195, 30); // the backdrop above the sheet
    await expect(sheet).toBeHidden();

    // A swipe down on the handle closes it.
    await pill.click();
    await expect(sheet).toBeVisible();
    const handle = (await sheet.getByRole("heading", { name: "Preview" }).boundingBox())!;
    await page.mouse.move(handle.x + 10, handle.y + 5);
    await page.mouse.down();
    await page.mouse.move(handle.x + 10, handle.y + 100, { steps: 4 });
    await page.mouse.move(handle.x + 10, handle.y + 220, { steps: 4 });
    await page.mouse.up();
    await expect(sheet).toBeHidden();
  });

  test("the form ends clear of the pill", async ({ page }) => {
    await openStoredDraft(page, sampleDraft("preview-phone-end"));
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const pill = (await page.getByTestId("preview-pill").boundingBox())!;
    const storage = (await page.getByTestId("storage-card").boundingBox())!;
    expect(storage.y + storage.height).toBeLessThanOrEqual(pill.y);
  });
});
