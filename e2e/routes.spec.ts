import { expect, test } from "@playwright/test";

// Step 0.1: the static export serves every route, keeps ?d= across a reload, and makes no request off this site.

test.beforeEach(async ({ page }) => {
  // The privacy promise (VISION D15): nothing is requested from another origin.
  page.on("request", (request) => {
    const url = new URL(request.url());
    expect(["localhost", "127.0.0.1"], `request to ${url.origin}`).toContain(url.hostname);
  });
});

test("the home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Free Wedding Biodata Maker");
});

test("the privacy page loads", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your biodata stays with you");
});

test("the editor reads the draft id from the address and keeps it on reload", async ({ page }) => {
  await page.goto("/editor?d=abc");
  await expect(page.getByTestId("draft-id")).toContainText("abc");
  await page.reload();
  await expect(page.getByTestId("draft-id")).toContainText("abc");
});

test("an unknown address shows the not-found page", async ({ page }) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page doesn't exist");
});
