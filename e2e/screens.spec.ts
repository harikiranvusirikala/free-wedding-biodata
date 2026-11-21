import { expect, test } from "@playwright/test";

// The A7 quality gate (BUILD_PLAN A7): every screen at phone, tablet and desktop size, Day and Night, saved in
// test-results/screenshots/ to be looked at before committing; and nothing scrolls sideways at 360 px.

const SCREENS = [
  { name: "home", path: "/" },
  { name: "privacy", path: "/privacy" },
  { name: "editor", path: "/editor?d=abc" },
  { name: "not-found", path: "/no-such-page" },
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
      for (const size of SIZES) {
        await page.setViewportSize({ width: size.width, height: size.height });
        for (const theme of THEMES) {
          await page.emulateMedia({ colorScheme: theme });
          await page.goto(screen.path);
          await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
          await page.screenshot({ path: `test-results/screenshots/${screen.name}-${size.name}-${theme === "light" ? "day" : "night"}.png`, fullPage: true });
        }
      }
    });

    test(`${screen.name} doesn't scroll sideways at 360 px`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 780 });
      await page.goto(screen.path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBe(0);
    });
  }
});
