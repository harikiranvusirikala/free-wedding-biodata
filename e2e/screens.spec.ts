import { expect, test, type Page } from "@playwright/test";
import { drawnPng, openStoredDraft, sampleDraft } from "./editor-helpers";

// The A7 quality gate (BUILD_PLAN A7): every screen at phone, tablet and desktop size, Day and Night, saved in
// test-results/screenshots/ to be looked at before committing; and nothing scrolls sideways at 360 px.

interface Screen {
  name: string;
  path: string;
  /** Runs before the page's own scripts on every load (e.g. a browser without IndexedDB). */
  init?: () => void;
  /** Runs once before the screenshots (e.g. typing into a new draft, which /editor then reopens). */
  setup?: (page: Page) => Promise<void>;
  /** Waits, after each load, for something that appears once the page has read storage (Continue editing). */
  ready?: (page: Page) => Promise<void>;
}

/** Fills the first fields of a new draft (fictional values) and waits until they are saved. */
async function fillDraft(page: Page, path = "/editor") {
  await page.goto(path);
  for (const [label, value] of [["Name", "Sai Teja Mandapati"], ["Date of Birth", "15-03-1998"], ["Nationality", "Indian"], ["Current City", "Hyderabad"], ["Native Place", "Guntur"]]) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  await expect(page.getByTestId("save-status")).toHaveText(/Saved on this device · \d/);
}

/** Opens the fictional sample (VISION D29) as the last draft, so /editor reopens it: every field type filled, one hidden. */
async function openSample(page: Page) {
  await openStoredDraft(page, sampleDraft("sample-screens"));
}

const SCREENS: Screen[] = [
  { name: "home", path: "/" },
  { name: "home-continue", path: "/", setup: fillDraft, ready: (page) => expect(page.getByTestId("continue-editing")).toBeVisible() },
  { name: "help", path: "/help" },
  { name: "privacy", path: "/privacy" },
  { name: "editor", path: "/editor", setup: openSample },
  { name: "editor-new", path: "/editor?new=1" },
  { name: "editor-not-found", path: "/editor?d=no-such-draft" },
  { name: "editor-unavailable", path: "/editor", init: () => Object.defineProperty(window, "indexedDB", { get: () => undefined }) },
  { name: "not-found", path: "/no-such-page" },
  { name: "error", path: "/dev/error" },
  { name: "ui-kit", path: "/dev/ui" },
];
const SIZES = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 810, height: 1080 },
  { name: "desktop", width: 1440, height: 900 },
];
const THEMES = ["light", "dark"] as const;

test.describe("screens", () => {
  test.skip(({ isMobile }) => isMobile, "sizes are set here, so one project is enough");

  for (const screen of SCREENS) {
    test(`${screen.name} at every size, Day and Night`, async ({ page }) => {
      if (screen.init) await page.addInitScript(screen.init);
      await screen.setup?.(page);
      for (const size of SIZES) {
        await page.setViewportSize({ width: size.width, height: size.height });
        for (const theme of THEMES) {
          await page.emulateMedia({ colorScheme: theme });
          await page.goto(screen.path);
          await expect(page.getByTestId("editor-loading")).toHaveCount(0); // the editor opens its draft after load
          await screen.ready?.(page);
          await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
          await page.screenshot({ path: `test-results/screenshots/${screen.name}-${size.name}-${theme === "light" ? "day" : "night"}.png`, fullPage: true, animations: "disabled" });
        }
      }
    });

    test(`${screen.name} doesn't scroll sideways at 360 px`, async ({ page }) => {
      if (screen.init) await page.addInitScript(screen.init);
      await screen.setup?.(page);
      await page.setViewportSize({ width: 360, height: 780 });
      await page.goto(screen.path);
      await expect(page.getByTestId("editor-loading")).toHaveCount(0);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBe(0);
    });
  }
});

// The editor when another tab saved the draft first (D9): the second tab shows why it stopped saving. The theme and
// size change without a reload, which would clear the message.
test("editor with a save problem at every size, Day and Night", async ({ page, context, isMobile }) => {
  test.skip(isMobile, "sizes are set here, so one project is enough");
  await page.goto("/editor");
  await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
  const other = await context.newPage();
  await other.goto(page.url());
  await page.getByLabel("Name", { exact: true }).fill("Sai Teja Mandapati");
  await expect(page.getByTestId("save-status")).toHaveText(/Saved on this device · \d/);
  await shootAll(page, "editor-saved"); // the status with its time ("Saved · 4:12 PM" on phones)
  await other.getByLabel("Name", { exact: true }).fill("Sai Teja");
  await expect(other.getByTestId("save-problem")).toBeVisible();
  await shootAll(other, "editor-conflict");
});

// The drafts menu open (two drafts, the open one ticked), the Delete draft dialog and Delete all my local data
// (Step 1.4), shot as they are: the theme and size change without a reload, which would close them.
test("drafts menu and its dialogs at every size, Day and Night", async ({ page, isMobile }) => {
  test.skip(isMobile, "sizes are set here, so one project is enough");
  await page.goto("/editor?new=1");
  await page.getByLabel("Name", { exact: true }).fill("Asha Rani");
  await expect(page.getByTestId("save-status")).toHaveText(/Saved on this device · \d/);
  await fillDraft(page, "/editor?new=1");
  await page.getByTestId("draft-title").click();
  await expect(page.getByRole("menu", { name: "Drafts" })).toBeVisible();
  await shootAll(page, "editor-drafts-menu");
  await page.getByRole("menuitem", { name: "Delete…" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await shootAll(page, "editor-delete-dialog");
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByTestId("draft-title").click();
  await page.getByRole("menuitem", { name: "Rename…" }).click();
  await page.getByLabel("Draft name").fill("For the Rao family");
  await shootAll(page, "editor-rename-dialog");
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByTestId("draft-title").click();
  await page.getByRole("menuitem", { name: "Delete all my local data…" }).click();
  await page.getByLabel("Type DELETE to confirm").fill("DEL");
  await shootAll(page, "editor-delete-all-dialog");
});

// The editor at 1024–1279 px, where the rail shows icons (BUILD_PLAN A7 Editor rule); and a select field's list
// open (Step 2.1), shot as it is.
test("editor rail as icons, and an open list, Day and Night", async ({ page, isMobile }) => {
  test.skip(isMobile, "sizes are set here, so one project is enough");
  await openSample(page);
  for (const theme of THEMES) {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.emulateMedia({ colorScheme: theme });
    await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
    await page.screenshot({ path: `test-results/screenshots/editor-laptop-${theme === "light" ? "day" : "night"}.png`, animations: "disabled" });
  }
  await page.getByRole("combobox", { name: "Nakshatra" }).click();
  await expect(page.getByRole("listbox", { name: "Nakshatra" })).toBeVisible();
  for (const size of SIZES.filter((s) => s.name !== "tablet")) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.getByRole("combobox", { name: "Nakshatra" }).scrollIntoViewIfNeeded();
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
      await page.screenshot({ path: `test-results/screenshots/editor-list-${size.name}-${theme === "light" ? "day" : "night"}.png`, animations: "disabled" });
    }
  }
});

// Managing fields and sections (Step 2.2), shot as they are at phone and desktop size, Day and Night: a field's ⋯
// menu and its Move to section list, a section's ⋯ menu, the Add a field and Add a section dialogs, and the toast
// with Undo after a removal.
test("field and section menus, add dialogs and the Undo toast, Day and Night", async ({ page, isMobile }) => {
  test.skip(isMobile, "sizes are set here, so one project is enough");
  test.setTimeout(120_000);
  await openSample(page);
  const shoot = async (name: string, size: string) => {
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
      await page.screenshot({ path: `test-results/screenshots/${name}-${size}-${theme === "light" ? "day" : "night"}.png`, animations: "disabled" });
    }
  };
  const center = (locator: ReturnType<Page["locator"]>) => locator.evaluate((el) => el.scrollIntoView({ block: "center" }));
  for (const size of SIZES.filter((s) => s.name !== "tablet")) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.emulateMedia({ colorScheme: "light" });

    const dob = page.getByRole("button", { name: "Options for “Date of Birth”" });
    await center(dob);
    await dob.click();
    await expect(page.getByRole("menu")).toBeVisible();
    await shoot("editor-field-menu", size.name);
    await page.getByRole("menuitem", { name: "Move to section" }).click();
    await shoot("editor-field-move", size.name);
    await page.keyboard.press("Escape");

    const horoscope = page.getByRole("button", { name: "Options for the “Horoscope Details” section" });
    await center(horoscope);
    await horoscope.click();
    await shoot("editor-section-menu", size.name);
    await page.keyboard.press("Escape");

    await page.locator('[data-section="horoscope"]').getByRole("button", { name: "Add a field" }).click();
    await page.getByRole("dialog").getByLabel("Label", { exact: true }).fill("Lagna");
    await shoot("editor-add-field", size.name);
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

    await page.locator("#add-section").click();
    await expect(page.getByRole("dialog", { name: "Add a section" })).toBeVisible();
    await shoot("editor-add-section", size.name);
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

    const gotra = page.getByRole("button", { name: "Options for “Gotra”" });
    await center(gotra);
    await gotra.click();
    await page.getByRole("menuitem", { name: "Remove…" }).click();
    await shoot("editor-remove-dialog", size.name);
    await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
    await expect(page.getByTestId("manage-toast")).toBeVisible();
    await shoot("editor-undo-toast", size.name);
    await page.getByTestId("manage-toast").getByRole("button", { name: "Undo" }).click();
    await expect(page.getByLabel("Gotra", { exact: true })).toBeVisible();
    await page.getByTestId("manage-toast").getByRole("button", { name: "Dismiss" }).click();
  }
});

// A new draft after some management: a hidden section, an empty section of the user's own, and Add a section offering
// a removed default section back with References (Step 2.2).
test("hidden and empty sections, and Add a section with ready-made picks, Day and Night", async ({ page, isMobile }) => {
  test.skip(isMobile, "sizes are set here, so one project is enough");
  await page.goto("/editor?new=1");
  await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Options for the “Family Background” section" }).click();
  await page.getByRole("menuitem", { name: "Remove section…" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
  await page.getByTestId("manage-toast").getByRole("button", { name: "Dismiss" }).click();
  await page.getByRole("button", { name: "Options for the “Partner Preferences” section" }).click();
  await page.getByRole("menuitem", { name: "Hide section" }).click();
  await page.locator("#add-section").click();
  await page.getByRole("dialog").getByLabel("Section title").fill("Hobbies and interests");
  await page.getByRole("dialog").getByRole("button", { name: "Add section" }).click();
  await expect(page.getByTestId("save-status")).toHaveText(/Saved on this device · \d/);
  for (const size of SIZES.filter((s) => s.name !== "tablet")) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.locator('[data-section="partnerPreferences"]').evaluate((el) => el.scrollIntoView({ block: "start" }));
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
      await page.screenshot({ path: `test-results/screenshots/editor-sections-end-${size.name}-${theme === "light" ? "day" : "night"}.png`, animations: "disabled" });
    }
    await page.locator("#add-section").click();
    await expect(page.getByRole("dialog", { name: "Add a section" })).toBeVisible();
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
      await page.screenshot({ path: `test-results/screenshots/editor-add-section-picks-${size.name}-${theme === "light" ? "day" : "night"}.png`, animations: "disabled" });
    }
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  }
});

// The editor's opening (Step 2.0), shot as it is at phone and desktop size, Day and Night: the top card on a new
// draft (all None) and with a symbol, a line and a title chosen; the symbol picker and the language dialog open;
// the tradition chips with the toast after one is tapped; and the printed top of page 1 in English and Telugu.
test("top of your biodata, its pickers, the language notice and tradition chips, Day and Night", async ({ page, isMobile }) => {
  test.skip(isMobile, "sizes are set here, so one project is enough");
  test.setTimeout(120_000);
  const shoot = async (name: string, size: string, fullPage = false) => {
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
      await page.screenshot({ path: `test-results/screenshots/${name}-${size}-${theme === "light" ? "day" : "night"}.png`, fullPage, animations: "disabled" });
    }
  };
  await page.goto("/editor?new=1");
  await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
  const card = page.locator('[data-section="top"]');
  for (const size of SIZES.filter((s) => s.name !== "tablet")) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.evaluate(() => window.scrollTo(0, 0));
    await shoot("editor-top-new", size.name);
  }
  await page.getByLabel("Name", { exact: true }).fill("Sai Teja Mandapati");
  await card.getByRole("radio", { name: "Ganesha", exact: true }).click();
  await card.getByLabel("Invocation line").selectOption("shriGaneshaya");
  await card.getByRole("radiogroup", { name: "Title" }).getByRole("radio", { name: "Marriage Biodata", exact: true }).click();
  await expect(page.getByTestId("save-status")).toHaveText(/Saved on this device · \d/);
  const id = new URL(page.url()).searchParams.get("d")!;
  for (const size of SIZES.filter((s) => s.name !== "tablet")) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.evaluate(() => window.scrollTo(0, 0));
    await shoot("editor-top-chosen", size.name);
    await card.getByRole("button", { name: "See them larger" }).click();
    await expect(page.getByTestId("motif-dialog")).toBeVisible();
    await shoot("editor-top-motifs", size.name);
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).first().click();
    await page.getByRole("button", { name: "Change the language of the printed headings" }).click();
    await expect(page.getByTestId("language-options")).toBeVisible();
    await shoot("editor-language-dialog", size.name);
    await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();
    await page.locator('[data-section="religion"]').evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.getByTestId("tradition-chips").getByRole("button", { name: "Muslim", exact: true }).click();
    await expect(page.getByTestId("manage-toast")).toBeVisible();
    await shoot("editor-tradition-chips", size.name);
    await page.getByTestId("manage-toast").getByRole("button", { name: "Undo" }).click();
    await page.getByTestId("manage-toast").getByRole("button", { name: "Dismiss" }).click();
  }
  // The printed top (one A4 page at true size; the document is always a light page).
  await page.setViewportSize({ width: 900, height: 1200 });
  await page.emulateMedia({ colorScheme: "light" });
  for (const lang of ["en", "te"]) {
    if (lang === "te") {
      await page.goto(`/editor?d=${id}`);
      await page.getByRole("button", { name: "Change the language of the printed headings" }).click();
      await page.getByRole("dialog").getByRole("radio", { name: /తెలుగు/ }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();
      await expect(page.getByTestId("save-status")).toHaveText(/Saved on this device · \d/);
    }
    await page.goto(`/dev/draft?d=${id}`);
    await expect(page.locator("body[data-doc-ready]")).toHaveCount(1);
    await page.locator("[data-page]").first().screenshot({ path: `test-results/screenshots/document-top-${lang}.png`, animations: "disabled" });
  }
});

// Family members, References and the photo in the editor (Steps 2.3, 3.1), shot as they are at phone and desktop
// size, Day and Night: the family list with its rows' ⋯ menus, a member's menu, the Add a family member dialog,
// References with two phone numbers, and the photo card empty and with a (drawn) photo.
test("family list, add-member dialog, references and the photo card, Day and Night", async ({ page, isMobile }) => {
  test.skip(isMobile, "sizes are set here, so one project is enough");
  test.setTimeout(120_000);
  await openSample(page);
  const shoot = async (name: string, size: string) => {
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
      await page.screenshot({ path: `test-results/screenshots/${name}-${size}-${theme === "light" ? "day" : "night"}.png`, animations: "disabled" });
    }
  };
  const top = (selector: string) => page.locator(selector).evaluate((el) => el.scrollIntoView({ block: "start" }));
  const reference = page.locator('[data-section="references"] [data-testid="member-maternalUncle"] textarea');
  await reference.fill("Pothuri Srinivas, Textile Business, Vijayawada\n+91 90000 00003\n+91 90000 00004");
  await expect(page.getByTestId("save-status")).toHaveText(/Saved on this device · \d/);

  for (const size of SIZES.filter((s) => s.name !== "tablet")) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.emulateMedia({ colorScheme: "light" });
    await top('[data-section="photo"]');
    await shoot("editor-photo-empty", size.name);
    await top('[data-section="family"]');
    await shoot("editor-family", size.name);
    await page.getByRole("button", { name: "Options for “Sister (Elder)”", exact: true }).click();
    await expect(page.getByRole("menu")).toBeVisible();
    await shoot("editor-member-menu", size.name);
    await page.keyboard.press("Escape");
    await page.locator('[data-section="family"]').getByRole("button", { name: "Add a family member" }).click();
    const dialog = page.getByRole("dialog", { name: "Add a family member" });
    await dialog.getByRole("radio", { name: "Brother (Younger)", exact: true }).check();
    await dialog.getByLabel("Details").fill("Kiran Mandapati, B.Tech student, Hyderabad");
    await shoot("editor-add-member", size.name);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await top('[data-section="references"]');
    await shoot("editor-references", size.name);
  }

  await page.locator('[data-section="photo"]').getByTestId("photo-input").setInputFiles({ name: "drawn.png", mimeType: "image/png", buffer: await drawnPng(page, 1500, 2000) });
  await page.getByRole("dialog", { name: "Crop your photo" }).getByRole("button", { name: "Done" }).click();
  await expect(page.getByTestId("save-status")).toHaveText(/Saved on this device · \d/);
  for (const size of SIZES.filter((s) => s.name !== "tablet")) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await top('[data-section="photo"]');
    await expect(page.locator('[data-section="photo"]').getByTestId("photo-thumb")).toHaveAttribute("data-crop", /zoom/);
    await shoot("editor-photo", size.name);
  }
  // The rail at 1180 px (icons, with the share filled as a number) and the printed page with the photo.
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await shoot("editor-photo-laptop", "1180");
  const id = new URL(page.url()).searchParams.get("d")!;
  await page.setViewportSize({ width: 900, height: 1200 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(`/dev/draft?d=${id}`);
  await expect(page.locator("body[data-doc-ready]")).toHaveCount(1);
  for (const [i, pageEl] of (await page.locator("[data-page]").all()).entries()) {
    await pageEl.screenshot({ path: `test-results/screenshots/document-sample-photo-${i + 1}.png`, animations: "disabled" });
  }
});

// The live preview and its outputs (Steps 3.3, 4.1 part 2), shot as they are, Day and Night: the desktop column with
// the two-page sample (page 1, page 2, the design and text-size panels, the toast after a download), the 1180 px
// laptop, the tablet with its pill and side sheet, the phone pill, sheet and image menu, and a one-page draft.
test("live preview and downloads at every size, Day and Night", async ({ page, isMobile }) => {
  test.skip(isMobile, "sizes are set here, so one project is enough");
  test.setTimeout(180_000);
  const fresh = page.locator('[data-testid="preview-pages"] [data-doc-ready="1"]');
  const shoot = async (name: string) => {
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
      await page.screenshot({ path: `test-results/screenshots/${name}-${theme === "light" ? "day" : "night"}.png`, animations: "disabled" });
    }
    await page.emulateMedia({ colorScheme: "light" });
  };
  await openSample(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(fresh).toHaveAttribute("data-doc-pages", "2");
  await shoot("editor-preview-desktop");
  await page.getByRole("button", { name: /^Design: / }).click();
  await expect(page.getByTestId("design-panel")).toBeVisible();
  await shoot("editor-preview-designs-desktop");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^Text size: / }).click();
  await expect(page.getByTestId("text-size-panel")).toBeVisible();
  await shoot("editor-preview-size-desktop");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Save as image" }).click();
  await shoot("editor-preview-image-menu-desktop");
  await page.keyboard.press("Escape");
  await page.getByTestId("page-nav").getByRole("button", { name: "Next page" }).click();
  await shoot("editor-preview-page2-desktop");
  await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download PDF" }).click()]);
  await expect(page.getByTestId("export-toast")).toContainText("Downloaded");
  await shoot("editor-preview-downloaded-desktop");

  await page.setViewportSize({ width: 1180, height: 820 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await shoot("editor-preview-1180");

  await page.setViewportSize({ width: 810, height: 1080 });
  await expect(page.getByTestId("preview-pill")).toBeVisible();
  await shoot("editor-preview-tablet-closed");
  await page.getByTestId("preview-pill").click();
  await expect(page.getByRole("dialog", { name: "Preview" })).toBeVisible();
  await shoot("editor-preview-tablet-open");
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByRole("dialog", { name: "Preview" })).toBeHidden();
  await shoot("editor-preview-phone-pill");
  await page.getByTestId("preview-pill").click();
  await expect(page.getByRole("dialog", { name: "Preview" })).toBeVisible();
  await shoot("editor-preview-phone-sheet");
  await page.getByRole("dialog", { name: "Preview" }).getByRole("button", { name: "Save as image" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await shoot("editor-preview-phone-image-menu");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  // A one-page draft.
  await page.goto("/editor?new=1");
  await page.getByLabel("Name", { exact: true }).fill("Sai Teja Mandapati");
  for (const [label, value] of [["Date of Birth", "15-03-1998"], ["Current City", "Hyderabad"], ["Native Place", "Guntur"], ["Nationality", "Indian"]]) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByTestId("save-status")).toHaveText(/Saved on this device · \d/);
  await expect(page.locator('[data-testid="preview-pages"] [data-page="1"]')).toContainText("Guntur");
  await expect(fresh).toHaveAttribute("data-doc-pages", "1");
  await page.evaluate(() => window.scrollTo(0, 0));
  await shoot("editor-preview-short-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("preview-pill").click();
  await expect(page.getByRole("dialog", { name: "Preview" })).toBeVisible();
  await shoot("editor-preview-short-phone-sheet");
});

/** Screenshots a page as it is (no reload) at every size, Day and Night; colour transitions are finished first. */
async function shootAll(page: Page, name: string) {
  for (const size of SIZES) {
    await page.setViewportSize({ width: size.width, height: size.height });
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
      await page.screenshot({ path: `test-results/screenshots/${name}-${size.name}-${theme === "light" ? "day" : "night"}.png`, fullPage: true, animations: "disabled" });
    }
  }
}

// Touch targets (BUILD_PLAN A7, VISION D16): on a phone every link, button and question is at least 44 px tall.
test.describe("touch targets", () => {
  test.skip(({ isMobile }) => !isMobile, "the phone project has a touch screen");

  for (const screen of SCREENS.filter((s) => !s.path.startsWith("/dev/"))) {
    test(`${screen.name}: every control is at least 44 px tall on a phone`, async ({ page }) => {
      if (screen.init) await page.addInitScript(screen.init);
      await page.goto(screen.path);
      await expect(page.getByTestId("editor-loading")).toHaveCount(0);
      const small = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("a, button, summary, input, select, textarea")]
          .filter((el) => el.offsetParent !== null && !el.classList.contains("sr-only"))
          .map((el) => ({ text: (el.textContent || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 40), height: Math.round(el.getBoundingClientRect().height) }))
          .filter((target) => target.height < 44),
      );
      expect(small).toEqual([]);
    });
  }
});

