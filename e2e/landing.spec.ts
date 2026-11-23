import { expect, test, type Page } from "@playwright/test";
import { readStored } from "./editor-helpers";

// Step 6.1 (VISION D22, D26, D36): the landing page and the design gallery. What search engines read (title,
// canonical, the Search Console tag, structured data that matches the page), the real pictures load, the gallery opens
// a new draft in the chosen design, and the editor reached from the landing page asks nothing of another site. Tag
// Manager is production only, so this build (like every preview) loads nothing from Google.

/** Every request to another origin, from now on. */
function offsite(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!["localhost", "127.0.0.1"].includes(url.hostname) && !["data:", "blob:"].includes(url.protocol)) seen.push(url.href);
  });
  return seen;
}

/** The page's JSON-LD blocks, parsed. */
const structuredData = (page: Page) => page.locator('script[type="application/ld+json"]').evaluateAll((scripts) => scripts.map((s) => JSON.parse(s.textContent!)));

/** Every <img> on the page has loaded (scrolled into view first, for lazy ones). */
async function picturesLoad(page: Page) {
  const images = page.locator("main img");
  const count = await images.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await images.nth(i).scrollIntoViewIfNeeded();
    await expect.poll(() => images.nth(i).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), { message: `image ${i}` }).toBe(true);
  }
}

test("the landing page: title, canonical, Search Console tag, structured data matching the questions, real pictures", async ({ page }) => {
  const away = offsite(page);
  await page.goto("/");
  await expect(page).toHaveTitle("Free Wedding Biodata Maker – Marriage Biodata PDF & PNG");
  // The home page's canonical address is the site's root (Next.js writes it without the trailing slash).
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /^https?:\/\/[^/]+\/?$/);
  await expect(page.locator('meta[name="google-site-verification"]')).toHaveAttribute("content", "iS4OF4-2DT8drLIM-FZU8JA8b-ALGsTFZEbWyQEoj8Y");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", /^https?:\/\/[^/]+\/?$/);
  await expect(page.getByRole("link", { name: "Create my biodata" }).first()).toHaveAttribute("href", "/editor?new=1");

  const [data] = await structuredData(page);
  const types = (data["@graph"] as { "@type": string }[]).map((n) => n["@type"]);
  expect(types).toEqual(["Organization", "WebSite", "WebApplication", "FAQPage"]);
  const faq = (data["@graph"] as { "@type": string; mainEntity?: { name: string }[] }[]).find((n) => n["@type"] === "FAQPage")!;
  const shown = await page.locator("#faq summary").allInnerTexts();
  expect(faq.mainEntity!.map((q) => q.name)).toEqual(shown.map((s) => s.trim()));

  await picturesLoad(page);
  // Production only: no Tag Manager here.
  expect(await page.locator('script[src*="googletagmanager"], iframe[src*="googletagmanager"]').count()).toBe(0);
  expect(await page.content()).not.toContain("GTM-KJ4DFJHW");
  expect(away).toEqual([]);
});

test("the gallery shows every design and opens a new draft in the one chosen", async ({ page }) => {
  const away = offsite(page);
  await page.goto("/templates");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Twenty free biodata designs");
  await expect(page.getByTestId("design-gallery").locator("li")).toHaveCount(20);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/templates$/);
  const data = await structuredData(page);
  expect(data.map((d) => d["@type"])).toEqual(["BreadcrumbList", "ItemList"]);
  await picturesLoad(page);

  await page.getByRole("link", { name: "Use this design: Peacock" }).click();
  await expect(page).toHaveURL(/\/editor\?d=[0-9a-f-]{36}$/);
  await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
  const id = new URL(page.url()).searchParams.get("d")!;
  await expect.poll(async () => (await readStored(page, id))?.templateId).toBe("peacock");
  expect(away).toEqual([]);
});

test("the editor opened from the landing page's button asks nothing of another site (VISION D22)", async ({ page }) => {
  const away = offsite(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Create my biodata" }).first().click();
  await expect(page).toHaveURL(/\/editor\?d=/);
  await page.getByLabel("Name", { exact: true }).fill("Sai Teja Mandapati");
  await expect(page.getByTestId("save-status")).toHaveText(/Saved on this device · \d/);
  expect(away).toEqual([]);
});

test("robots.txt keeps this (non-production) build out of search engines; sitemap.xml lists nothing", async ({ request }) => {
  expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("<urlset");
  expect(sitemap).not.toContain("<url>");
  // Only the nine language pages exist at the top level.
  expect((await request.get("/xx")).status()).toBe(404);
});

test("a language page is in its language, lists every language version, and starts a biodata with its headings", async ({ page }) => {
  const away = offsite(page);
  await page.goto("/te");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("తెలుగులో పెళ్లి బయోడేటా");
  await expect(page.locator("main [lang=te]").first()).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/te$/);
  // hreflang: English (the home page), the nine languages and x-default.
  await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(11);
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "te_IN");
  await picturesLoad(page);
  await page.getByRole("link", { name: "తెలుగు బయోడేటా తయారు చేయండి" }).click();
  await expect(page).toHaveURL(/\/editor\?d=[0-9a-f-]{36}$/);
  await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
  const id = new URL(page.url()).searchParams.get("d")!;
  await expect.poll(async () => (await readStored(page, id))?.docLanguage).toBe("te");
  expect(away).toEqual([]);
});

test("the home page lists the language versions too, and its language chips lead to them", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(11);
  await page.locator("#languages").getByRole("link", { name: "हिन्दी" }).click();
  await expect(page).toHaveURL(/\/hi$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("हिंदी में शादी का बायोडाटा");
});

test("a tradition page lists that tradition's rows and shows its own sample; the guide links the formats", async ({ page }) => {
  const away = offsite(page);
  await page.goto("/biodata-format/muslim");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Muslim marriage biodata format");
  const includes = page.getByRole("region", { name: "What it usually includes" });
  await expect(includes).toContainText("Sect");
  await expect(includes).toContainText("Maslak");
  await expect(includes).not.toContainText("Nakshatra");
  await expect(page.locator('img[src="/designs/tradition-muslim.webp"]')).toBeVisible();
  await picturesLoad(page);
  expect((await structuredData(page)).map((d) => d["@type"])).toEqual(["BreadcrumbList"]);

  await page.goto("/guide");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("What to write in each part of your biodata");
  await page.getByRole("region", { name: "Formats for each tradition" }).getByRole("link", { name: "Sikh marriage biodata format" }).click();
  await expect(page).toHaveURL(/\/biodata-format\/sikh$/);
  expect(away).toEqual([]);
});
