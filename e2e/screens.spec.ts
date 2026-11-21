import { expect, test } from "@playwright/test";

// The A7 quality gate (BUILD_PLAN A7): every screen at phone, tablet and desktop size, Day and Night, saved in
// test-results/screenshots/ to be looked at before committing; and nothing scrolls sideways at 360 px.

const SCREENS = [
  { name: "home", path: "/" },
  { name: "help", path: "/help" },
  { name: "privacy", path: "/privacy" },
  { name: "editor", path: "/editor?d=abc" },
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

// Touch targets (BUILD_PLAN A7, VISION D16): on a phone every link, button and question is at least 44 px tall.
test.describe("touch targets", () => {
  test.skip(({ isMobile }) => !isMobile, "the phone project has a touch screen");

  for (const screen of SCREENS.filter((s) => !s.path.startsWith("/dev/"))) {
    test(`${screen.name}: every control is at least 44 px tall on a phone`, async ({ page }) => {
      await page.goto(screen.path);
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

