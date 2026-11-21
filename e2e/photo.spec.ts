import { expect, test, type Page } from "@playwright/test";

// Step 3.1: the photo card and cropper on /dev/photo (in-memory storage). Pictures are drawn on a canvas in the
// page by the test itself, never a real person's photo. Also the A7 screenshots of the empty, filled, low-resolution
// and cropper states: the phone project takes the phone ones (a touch screen), the desktop project tablet and desktop.

/** A PNG drawn in the page: a gradient with coloured corners, `width` × `height`. */
async function drawnPng(page: Page, width: number, height: number): Promise<Buffer> {
  const base64 = await page.evaluate(
    ([w, h]) => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const c = canvas.getContext("2d")!;
      const g = c.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#f6d7a7");
      g.addColorStop(1, "#7a4b3a");
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#3d6b5c";
      c.beginPath();
      c.arc(w / 2, h / 2.6, Math.min(w, h) / 6, 0, Math.PI * 2);
      c.fill();
      const s = Math.min(w, h) / 8;
      c.fillStyle = "#c0392b";
      c.fillRect(0, 0, s, s);
      c.fillStyle = "#2463c2";
      c.fillRect(w - s, 0, s, s);
      return canvas.toDataURL("image/png").split(",")[1];
    },
    [width, height],
  );
  return Buffer.from(base64, "base64");
}

async function upload(page: Page, width: number, height: number) {
  await page.getByTestId("photo-input").setInputFiles({ name: "drawn.png", mimeType: "image/png", buffer: await drawnPng(page, width, height) });
}

const cropOf = async (page: Page) => JSON.parse((await page.getByTestId("photo-thumb").getAttribute("data-crop")) ?? "null") as { x: number; y: number; zoom: number; rotation: number };

/** Waits until the cropper's picture has loaded and been placed. */
async function cropperReady(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Crop your photo" });
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0 && img.style.transform !== "")).toBe(true);
  return dialog;
}

test.describe("photo", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dev/photo");
    await expect(page.getByRole("heading", { name: "Add your photo" })).toBeVisible();
  });

  test("adds a photo, crops it, switches the frame and removes it", async ({ page }) => {
    await upload(page, 1800, 1200);
    const dialog = await cropperReady(page);

    // The zoom slider and a drag both move the crop.
    await dialog.getByRole("slider", { name: "Zoom" }).fill("2");
    const stage = page.getByTestId("crop-stage");
    const box = (await stage.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30, { steps: 5 });
    await page.mouse.up();
    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(dialog).toBeHidden();

    const crop = await cropOf(page);
    expect(crop.zoom).toBeCloseTo(2, 2);
    expect(crop.x).toBeLessThan(0.5); // dragged right: more of the left shows
    expect(crop.y).toBeLessThan(0.5);
    await expect(page.getByTestId("photo-low-res")).toHaveCount(0);
    await expect(page.getByTestId("doc-photo")).toHaveAttribute("src", /^data:image\/jpeg;base64,/);

    // Tall 2:3: the thumbnail gets taller and the crop stays inside the picture.
    const before = (await page.getByTestId("photo-thumb").boundingBox())!;
    await page.getByRole("radio", { name: "Tall 2:3" }).click();
    await expect(page.getByTestId("photo-thumb")).toHaveAttribute("data-frame", "2:3");
    const after = (await page.getByTestId("photo-thumb").boundingBox())!;
    expect(after.height / after.width).toBeCloseTo(1.5, 1);
    expect(after.height).toBeGreaterThan(before.height);

    // Remove asks first; Cancel keeps it.
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    const confirm = page.getByRole("dialog", { name: "Remove this photo?" });
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByTestId("photo-thumb")).toBeVisible();
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    await confirm.getByRole("button", { name: "Remove photo" }).click();
    await expect(page.getByRole("heading", { name: "Add your photo" })).toBeVisible();
    await expect(page.getByTestId("photo-state")).toContainText('"delete"');
  });

  test("rotates, zooms with the keyboard and resets", async ({ page }) => {
    await upload(page, 1200, 1600);
    const dialog = await cropperReady(page);
    await page.getByTestId("crop-stage").focus();
    await page.keyboard.press("+");
    await page.keyboard.press("+");
    await page.keyboard.press("ArrowLeft");
    await expect(dialog.getByRole("slider", { name: "Zoom" })).not.toHaveValue("1");
    await dialog.getByRole("button", { name: "Rotate" }).click();
    await dialog.getByRole("button", { name: "Done" }).click();
    let crop = await cropOf(page);
    expect(crop.rotation).toBe(90);
    expect(crop.zoom).toBeGreaterThan(1.2);

    await page.getByRole("button", { name: "Crop", exact: true }).click();
    await cropperReady(page);
    await dialog.getByRole("button", { name: "Reset" }).click();
    await dialog.getByRole("button", { name: "Done" }).click();
    crop = await cropOf(page);
    expect(crop).toEqual({ x: 0.5, y: 0.5, zoom: 1, rotation: 0 });
  });

  test("Cancel leaves the crop as it was", async ({ page }) => {
    await upload(page, 1200, 1600);
    const dialog = await cropperReady(page);
    await dialog.getByRole("button", { name: "Done" }).click();
    const crop = await cropOf(page);
    await page.getByTestId("photo-thumb").click();
    await cropperReady(page);
    await dialog.getByRole("slider", { name: "Zoom" }).fill("3");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    expect(await cropOf(page)).toEqual(crop);
  });

  test("warns about a photo too small to print sharply", async ({ page }) => {
    await upload(page, 240, 320);
    const dialog = await cropperReady(page);
    await expect(dialog.getByText(/may print blurry/)).toBeVisible();
    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(page.getByTestId("photo-low-res")).toContainText("This photo may print blurry");
    await expect(page.getByTestId("photo-low-res")).toContainText(/about \d+ dots per inch/);
  });

  test("explains a file that isn't a photo", async ({ page }) => {
    await page.getByTestId("photo-input").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not a picture") });
    const field = page.getByTestId("photo-field");
    await expect(field.getByRole("alert")).toContainText("Choose a JPEG, PNG or WebP picture");
    await page.getByTestId("photo-input").setInputFiles({ name: "broken.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not really a jpeg") });
    await expect(field.getByRole("alert")).toContainText("couldn't be opened");
    await expect(page.getByRole("heading", { name: "Add your photo" })).toBeVisible();
  });

  test("touch targets are at least 44 px and nothing scrolls sideways at 360 px", async ({ page, isMobile }) => {
    test.skip(!isMobile, "touch sizes apply on the phone");
    await page.setViewportSize({ width: 360, height: 780 });
    await upload(page, 1800, 1200);
    const dialog = await cropperReady(page);
    for (const control of await dialog.locator("button, input[type=range]").all()) {
      const box = (await control.boundingBox())!;
      expect(box.height, await control.evaluate((e) => e.outerHTML.slice(0, 80))).toBeGreaterThanOrEqual(44);
    }
    await dialog.getByRole("button", { name: "Done" }).click();
    for (const control of await page.getByTestId("photo-field").locator("button").all()) {
      if (!(await control.isVisible())) continue;
      const box = (await control.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });
});

const THEMES = ["light", "dark"] as const;

test("photo screens at every size, Day and Night", async ({ page, isMobile }) => {
  test.setTimeout(120_000);
  const sizes = isMobile ? [{ name: "phone", width: 390, height: 844 }] : [{ name: "tablet", width: 810, height: 1080 }, { name: "desktop", width: 1440, height: 900 }];
  const shot = (name: string, size: string, theme: (typeof THEMES)[number], fullPage = true) =>
    page.screenshot({ path: `test-results/screenshots/photo-${name}-${size}-${theme === "light" ? "day" : "night"}.png`, fullPage, animations: "disabled" });

  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    for (const theme of THEMES) {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto("/dev/photo");
      await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
      await expect(page.getByRole("heading", { name: "Add your photo" })).toBeVisible();
      await shot("empty", size.name, theme);

      await upload(page, 1800, 2400);
      const dialog = await cropperReady(page);
      await dialog.getByRole("slider", { name: "Zoom" }).fill("1.4");
      await shot("cropper", size.name, theme, false); // a modal dims only the first viewport
      await dialog.getByRole("button", { name: "Done" }).click();
      await expect(page.getByTestId("doc-photo")).toBeVisible();
      await shot("filled", size.name, theme);

      await upload(page, 240, 320);
      await (await cropperReady(page)).getByRole("button", { name: "Done" }).click();
      await page.getByRole("radio", { name: "Tall 2:3" }).click();
      await expect(page.getByTestId("photo-low-res")).toBeVisible();
      await shot("lowres", size.name, theme);
    }
  }
});
