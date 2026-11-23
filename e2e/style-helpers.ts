import { expect, type Page } from "@playwright/test";
import type { BiodataProfile } from "../src/biodata/types";
import { SAVED, drawnPng, openStoredDraft } from "./editor-helpers";

// The Step 4.5 specs' draft lives in test/fixtures/simple.ts (also used by /dev/document and the site's pictures).
export { ownerStyleDraft } from "../test/fixtures/simple";

/** Stores the draft, opens it, and adds a drawn photo (3:4) through the photo card, as a person would. */
export async function openOwnerStyleDraft(page: Page, profile: BiodataProfile, { photo = true } = {}) {
  await openStoredDraft(page, profile);
  if (!photo) return;
  const card = page.locator('[data-section="photo"]');
  await card.getByTestId("photo-input").setInputFiles({ name: "drawn.png", mimeType: "image/png", buffer: await drawnPng(page, 1500, 2000) });
  const cropper = page.getByRole("dialog", { name: "Crop your photo" });
  await expect(cropper).toBeVisible();
  await expect.poll(() => cropper.locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0 && img.style.transform !== "")).toBe(true);
  await cropper.getByRole("button", { name: "Done" }).click();
  await expect(cropper).toBeHidden();
  await expect(page.getByTestId("save-status")).toHaveText(SAVED);
}

/**
 * How far apart two PNGs are, as the mean absolute difference per colour channel (0–255) after both are drawn at
 * 620 px wide, and their natural widths. Runs in the page; the images are base64.
 */
export function meanPixelDifference(page: Page, a: string, b: string): Promise<{ mean: number; widths: number[] }> {
  return page.evaluate(
    async ([x, y]) => {
      const load = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      const [one, two] = await Promise.all([load(`data:image/png;base64,${x}`), load(`data:image/png;base64,${y}`)]);
      const w = 620;
      const h = Math.round((w * one.naturalHeight) / one.naturalWidth);
      const pixels = (img: HTMLImageElement) => {
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const c = canvas.getContext("2d")!;
        c.drawImage(img, 0, 0, w, h);
        return c.getImageData(0, 0, w, h).data;
      };
      const p = pixels(one);
      const q = pixels(two);
      let sum = 0;
      for (let k = 0; k < p.length; k++) sum += Math.abs(p[k] - q[k]);
      return { mean: sum / p.length, widths: [one.naturalWidth, two.naturalWidth] };
    },
    [a, b] as const,
  );
}
