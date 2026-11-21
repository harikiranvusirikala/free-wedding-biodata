import { expect, test, type Page } from "@playwright/test";
import { openStoredDraft, sampleDraft } from "./editor-helpers";

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

