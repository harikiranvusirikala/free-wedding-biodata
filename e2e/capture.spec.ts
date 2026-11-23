import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { NEW_DESIGNS } from "../test/fixtures/documents";
import { ownerStyleDraft } from "../test/fixtures/simple";
import { SAVED, openStoredDraft } from "./editor-helpers";

// The site's real pictures (BUILD_PLAN Step 6.1, VISION D26, D27): clean screens of the built app, saved to
// docs/screenshots/ (committed). `npm run images` then makes the landing page's and the gallery's WebPs, the link
// preview and GitHub's social preview from them. Run on purpose only, since it rewrites committed files:
//   CAPTURE=1 npx playwright test e2e/capture.spec.ts
// The Simple form's one-page biodata, shaped like the owner's (test/fixtures/simple.ts; owner's choice 2026-11-23),
// entirely fictional (VISION D29). The photo is the dev page's neutral silhouette, drawn here.

test.skip(!process.env.CAPTURE, "rewrites docs/screenshots/: run with CAPTURE=1");

const OUT = "docs/screenshots";

/** The neutral portrait the dev document page uses (a silhouette, never a real person). */
const SILHOUETTE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" width="1200" height="1600">
  <defs><linearGradient id="p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ece6dc"/><stop offset="1" stop-color="#d6cdbf"/></linearGradient></defs>
  <rect width="300" height="400" fill="url(#p)"/>
  <circle cx="150" cy="150" r="58" fill="#b9ad9b"/>
  <path d="M40 400c0-96 50-160 110-160s110 64 110 160z" fill="#a89a86"/>
</svg>`;

async function silhouettePng(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(async (svg) => {
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1600;
    canvas.getContext("2d")!.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png").split(",")[1];
  }, SILHOUETTE);
  return Buffer.from(base64, "base64");
}

/** The Simple-form biodata in Classic Gold with the Ganesha symbol and the silhouette as its photo, in the Day theme. */
async function openSample(page: Page, id: string) {
  await page.emulateMedia({ colorScheme: "light" });
  await openStoredDraft(
    page,
    ownerStyleDraft(id, (p) => {
      p.options.motif = "ganesha";
    }),
  );
  const card = page.locator('[data-section="photo"]');
  await card.getByTestId("photo-input").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: await silhouettePng(page) });
  const cropper = page.getByRole("dialog", { name: "Crop your photo" });
  await expect.poll(() => cropper.locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0 && img.style.transform !== "")).toBe(true);
  await cropper.getByRole("button", { name: "Done" }).click();
  await expect(cropper).toBeHidden();
  await expect(page.getByTestId("save-status")).toHaveText(SAVED);
}

test.describe("desktop", () => {
  test.skip(({ isMobile }) => isMobile, "desktop screens");
  test.use({ deviceScaleFactor: 2 });

  test("the editor with the live preview", async ({ page }) => {
    await mkdir(OUT, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await openSample(page, "capture-desktop");
    await expect(page.locator('[data-testid="preview-pages"] [data-doc-ready="1"] [data-page="1"]')).toContainText("Sai Teja Mandapati");
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${OUT}/editor-desktop.png`, animations: "disabled" });
  });

  test("the first page of every design, every language, a dark colour and the tradition samples", async ({ page }) => {
    test.setTimeout(180_000);
    await mkdir(OUT, { recursive: true });
    await page.setViewportSize({ width: 900, height: 1200 });
    await page.goto("/dev/document");
    await expect(page.locator("body")).toHaveAttribute("data-doc-ready", "1", { timeout: 60_000 });
    const shoot = (variant: string, name: string) => page.locator(`[data-variant="${variant}"] [data-page]`).first().screenshot({ path: `${OUT}/page-${name}.png`, scale: "device" });
    for (const id of ["classic-gold", "minimal-ivory", ...NEW_DESIGNS.map((d) => d.id)]) await shoot(`${id}-en-simple`, id);
    // The language pages (Classic Gold in each language) and the tradition pages (each family's own sample).
    for (const lang of ["te", "hi", "ta", "kn", "ml", "mr", "gu", "bn", "pa"]) await shoot(`classic-gold-${lang}-simple`, `classic-gold-${lang}`);
    await shoot("deepam-en-simple-night", "deepam-night");
    for (const name of ["muslim", "christian", "sikh", "jain"]) await shoot(`classic-gold-en-simple-${name}`, `tradition-${name}`);
  });
});

test.describe("phone", () => {
  test.skip(({ isMobile }) => !isMobile, "the phone screen");

  test("the preview sheet on a phone, scrolled down to the page", async ({ page }) => {
    await mkdir(OUT, { recursive: true });
    await openSample(page, "capture-phone");
    await page.getByTestId("preview-pill").click();
    const sheet = page.getByRole("dialog", { name: "Preview" });
    await expect(sheet.locator('[data-doc-ready="1"] [data-page="1"]')).toContainText("Sai Teja Mandapati");
    await page.waitForTimeout(400); // the sheet's slide-in
    // The controls scroll away above the page; keep the colour row in view as a hint of them.
    await sheet.getByTestId("sheet-body").evaluate((body) => {
      const pageTop = body.querySelector('[data-page="1"]')!.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop;
      body.scrollTo({ top: Math.max(0, pageTop - 24) });
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/editor-phone.png`, animations: "disabled" });
  });
});
