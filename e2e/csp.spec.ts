import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Download, type Page } from "@playwright/test";
import { SAVED, drawnPhoto, openStoredDraft, sampleDraft } from "./editor-helpers";

// The editor runs under a strict Content-Security-Policy in production (vercel.json: connect-src 'self', no
// third parties). The e2e server doesn't send it, so this spec adds the very same header to the /editor document
// and checks that what depends on pictures still works under it: photo pages (blob: pictures), the main photo, a
// PDF and page images with all of them, and that the browser reports no violation. A blob: URL can be drawn
// (img-src allows it) but not fetched (connect-src 'self' doesn't cover blob:), so this guards the export path. The
// second test does the same for a gold symbol recoloured in the design's colours (a PNG data: URL made on a canvas).

const vercel = JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf8")) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
const EDITOR_CSP = vercel.headers
  .filter((rule) => rule.source === "/editor(.*)")
  .flatMap((rule) => rule.headers)
  .find((header) => header.key === "Content-Security-Policy")!.value;

test.skip(({ isMobile }) => isMobile, "the toolbar's Download button is the desktop layout; the engine path is the same");

/** Serves /editor with the production CSP and records every violation the browser reports in window.__violations. */
async function withEditorCsp(page: Page) {
  expect(EDITOR_CSP).toContain("connect-src 'self'");
  await page.route(/\/editor(\?|$)/, async (route) => {
    if (route.request().resourceType() !== "document") return route.continue();
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), "content-security-policy": EDITOR_CSP } });
  });
  await page.addInitScript(() => {
    const w = window as unknown as { __violations: string[] };
    w.__violations = [];
    document.addEventListener("securitypolicyviolation", (event) => w.__violations.push(`${event.violatedDirective} ${event.blockedURI}`));
  });
}

test("photo pages, the main photo, the PDF and the images all work under the editor's real CSP", async ({ page }) => {
  test.setTimeout(120_000);
  await withEditorCsp(page);

  await openStoredDraft(page, sampleDraft("csp-draft"));
  // Prove the policy is enforced: a request to another site and a fetch of a blob: address are both refused.
  const probe = await page.evaluate(async () => {
    const blobUrl = URL.createObjectURL(new Blob(["x"]));
    const results: string[] = [];
    for (const url of ["https://example.invalid/", blobUrl]) results.push(await fetch(url).then(() => "allowed", () => "blocked"));
    return results;
  });
  expect(probe, "the CSP is active on the editor").toEqual(["blocked", "blocked"]);
  const seen = await page.evaluate(() => (window as unknown as { __violations: string[] }).__violations.length);
  expect(seen).toBeGreaterThanOrEqual(2);
  await page.evaluate(() => ((window as unknown as { __violations: string[] }).__violations.length = 0));

  const more = page.locator('[data-section="photoPages"]');
  await more.getByTestId("pages-input").setInputFiles([
    { name: "a.png", mimeType: "image/png", buffer: await drawnPhoto(page, 1500, 2000, 20, "Photo 1") },
    { name: "b.png", mimeType: "image/png", buffer: await drawnPhoto(page, 1500, 2000, 140, "Photo 2") },
  ]);
  await more.getByTestId("chart-input").setInputFiles({ name: "chart.png", mimeType: "image/png", buffer: await drawnPhoto(page, 1600, 1600, 220, "Chart") });
  await expect(more.getByTestId("chart-thumb").locator("img")).toBeVisible();
  await expect(page.getByTestId("save-status")).toHaveText(SAVED, { timeout: 20_000 });
  const pages = page.locator('[data-testid="preview-pages"] [data-doc-ready="1"]');
  await expect(pages).toHaveAttribute("data-doc-photo-pages", /[1-9]/);
  await expect(page.locator('[data-testid="preview-pages"] [data-extra-page="photos"] img').first()).toBeVisible();

  const bar = page.getByTestId("export-actions");
  const [pdf] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), bar.getByRole("button", { name: "Download PDF" }).click()]);
  expect(pdf.suggestedFilename()).toMatch(/Biodata\.pdf$/);
  expect(await bytes(pdf)).toBeGreaterThan(50_000);

  const images: Download[] = [];
  page.on("download", (d) => images.push(d));
  await bar.getByRole("button", { name: "Save as image" }).click();
  await page.getByRole("menuitem", { name: /^Save as JPEG/ }).click();
  await expect.poll(() => images.length, { timeout: 60_000 }).toBeGreaterThanOrEqual(4);

  expect(await page.evaluate(() => (window as unknown as { __violations: string[] }).__violations), "CSP violations").toEqual([]);
});

test("a gold symbol recoloured in the design's colours (a data: picture) exports under the editor's real CSP", async ({ page }) => {
  test.setTimeout(90_000);
  await withEditorCsp(page);
  await openStoredDraft(
    page,
    sampleDraft("csp-tint", (p) => {
      p.templateId = "peacock";
      p.colorId = "teal";
      p.options.motif = "ganesha";
    }),
  );
  // Tinted on a canvas from the picture's own (same-origin) file, shown as a PNG data URL (img-src allows data:).
  await expect(page.locator('[data-testid="preview-pages"] [data-doc-ready="1"] [data-page] img[data-motif="ganesha"]')).toHaveAttribute("src", /^data:image\/png;base64,/);
  const bar = page.getByTestId("export-actions");
  const [pdf] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), bar.getByRole("button", { name: "Download PDF" }).click()]);
  expect(await bytes(pdf)).toBeGreaterThan(20_000);
  const images: Download[] = [];
  page.on("download", (d) => images.push(d));
  await bar.getByRole("button", { name: "Save as image" }).click();
  await page.getByRole("menuitem", { name: /^Save as JPEG/ }).click();
  await expect.poll(() => images.length, { timeout: 60_000 }).toBeGreaterThanOrEqual(1);
  // Counted from the first page load, so the tinting itself is covered. zod probes once whether eval is allowed
  // (`allowsEval`, new Function in a try): that refused probe is expected and harmless.
  const violations = await page.evaluate(() => (window as unknown as { __violations: string[] }).__violations);
  expect(violations.filter((v) => v !== "script-src eval"), "CSP violations").toEqual([]);
});

async function bytes(download: Download): Promise<number> {
  const stream = await download.createReadStream();
  let total = 0;
  for await (const chunk of stream) total += (chunk as Buffer).length;
  return total;
}
