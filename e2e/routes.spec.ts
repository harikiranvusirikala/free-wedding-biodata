import { expect, test } from "@playwright/test";

// Step 0.1: the static export serves every route, keeps ?d= across a reload, and makes no request off this site.
// Step 1.1: the help page, the headers, and the error screen. Step 1.3: the editor opens real drafts.

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

test("the help page loads, with its questions", async ({ page }) => {
  await page.goto("/help");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("How to make your biodata");
  await expect(page).toHaveTitle(/^Help · Free Wedding Biodata$/);
  const first = page.locator("details").first();
  await expect(first).toHaveAttribute("open", "");
  const second = page.locator("details").nth(1);
  await second.locator("summary").click();
  await expect(second).toHaveAttribute("open", "");
});

test("the public header links only to pages that exist, and into the editor with a full page load", async ({ page, isMobile }) => {
  test.skip(isMobile, "phones show the logo and theme only, as in the mockup");
  await page.goto("/help");
  const header = page.getByRole("banner");
  const nav = header.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link")).toHaveText(["Help", "Privacy"]);
  await expect(nav.getByRole("link", { name: "Help" })).toHaveAttribute("aria-current", "page");
  await header.getByRole("link", { name: "Create my biodata" }).click();
  // A new draft is made and named in the address (e2e/drafts.spec.ts covers saving).
  await expect(page).toHaveURL(/\/editor\?d=[0-9a-f-]{36}$/);
  await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
});

test("the editor reads the draft id from the address and keeps it on reload", async ({ page }) => {
  await page.goto("/editor?d=abc");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Draft not found");
  await page.reload();
  await expect(page).toHaveURL("/editor?d=abc");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Draft not found");
  await expect(page.getByRole("banner").getByRole("link", { name: "Help" })).toHaveAttribute("href", "/help");
});

test("an unknown address shows the not-found page", async ({ page }) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page doesn't exist");
});

test("a page that breaks shows the error screen with Try again and Home", async ({ page }) => {
  page.on("pageerror", () => {}); // the deliberate error
  await page.goto("/dev/error");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Something went wrong");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await page.getByRole("link", { name: "Go to the home page" }).click();
  await expect(page).toHaveURL(/\/$/);
});
