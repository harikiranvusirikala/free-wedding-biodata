import { expect, test, type Page } from "@playwright/test";

// Step 1.1: Day / Night / Follow device (VISION §5), chosen in the header's theme menu, saved in this browser
// and on <html> before the first paint, so a reload never flashes the other theme.

const themeButton = (page: Page) => page.getByRole("banner").getByRole("button", { name: "Theme" });
const html = (page: Page) => page.locator("html");

/** Records <html>'s class the moment <body> starts: after the theme script in <head>, before anything is painted or React starts. */
async function recordClassAtFirstPaint(page: Page) {
  await page.addInitScript(() => {
    const record = () => {
      (window as unknown as { classAtBody: string }).classAtBody = document.documentElement.className;
    };
    new MutationObserver((_, observer) => {
      if (document.body) {
        record();
        observer.disconnect();
      }
    }).observe(document, { childList: true, subtree: true });
  });
}

test("choosing Night sets it at once, and a reload starts in Night with no flash", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await recordClassAtFirstPaint(page);
  await page.goto("/help");
  await expect(html(page)).not.toHaveClass(/dark/);

  await themeButton(page).click();
  await page.getByRole("menuitemradio", { name: "Night" }).click();
  await expect(html(page)).toHaveClass(/dark/);
  await expect(page.getByRole("menu")).toHaveCount(0);

  await page.reload({ waitUntil: "domcontentloaded" });
  expect(await page.evaluate(() => (window as unknown as { classAtBody: string }).classAtBody)).toContain("dark");
  await expect(html(page)).toHaveClass(/dark/);

  // The editor, outside the public pages, reads the same choice.
  await page.goto("/editor");
  expect(await page.evaluate(() => (window as unknown as { classAtBody: string }).classAtBody)).toContain("dark");
});

test("Follow device follows the device's setting, live", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/privacy");
  await expect(html(page)).toHaveClass(/dark/);

  await themeButton(page).click();
  await page.getByRole("menuitemradio", { name: "Day" }).click();
  await expect(html(page)).not.toHaveClass(/dark/);

  await themeButton(page).click();
  await expect(page.getByRole("menuitemradio", { name: "Day" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("menuitemradio", { name: "Follow device" }).click();
  await expect(html(page)).toHaveClass(/dark/);

  await page.emulateMedia({ colorScheme: "light" });
  await expect(html(page)).not.toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(html(page)).toHaveClass(/dark/);
});

test("the theme menu works with the keyboard alone", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard, so the desktop project");
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await themeButton(page).focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu", { name: "Theme" });
  await expect(menu).toBeVisible();
  // Opens on the current choice (Follow device), then the arrows go round.
  await expect(page.getByRole("menuitemradio", { name: "Follow device" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitemradio", { name: "Day" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitemradio", { name: "Night" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(html(page)).toHaveClass(/dark/);
  await expect(menu).toHaveCount(0);
  await expect(themeButton(page)).toBeFocused();

  // Escape closes without choosing and gives the focus back.
  await page.keyboard.press("ArrowDown");
  await expect(menu).toBeVisible();
  await expect(page.getByRole("menuitemradio", { name: "Night" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(themeButton(page)).toBeFocused();
  await expect(html(page)).toHaveClass(/dark/);
});

test("a click outside closes the theme menu", async ({ page }) => {
  await page.goto("/");
  await themeButton(page).click();
  await expect(page.getByRole("menu")).toBeVisible();
  // Well clear of the open menu: on a phone the menu reaches down over the headline's middle.
  await page.getByRole("heading", { name: "Stays on your device" }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
});

test("the footer's Buy me a coffee and GitHub links open in a new tab, safely", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  for (const name of [/Buy me a coffee/, /Source code/]) {
    const link = footer.getByRole("link", { name });
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
  await expect(footer.getByRole("link", { name: /Buy me a coffee/ })).toHaveAttribute("href", "https://buymeacoffee.com/harikiranvusirikala");
  await expect(footer).toContainText("doesn't match or connect people");
});
