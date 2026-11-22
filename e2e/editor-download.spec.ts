import { readFile } from "node:fs/promises";
import { expect, test, type Download, type Page } from "@playwright/test";
import { SAVED, openStoredDraft, sampleDraft } from "./editor-helpers";

// Step 4.1 part 2: Download PDF, Share PDF and Save as image in the editor (no Print button since 2026-11-22). The files come from the preview's
// laid-out pages (D1), named by src/biodata/filename.ts; the engine (src/pdf, with HarfBuzz's WebAssembly) loads on
// the first use, not with the editor; the page images match the Download engine run on the same draft's true-size
// pages (/dev/draft); nothing is requested from another origin.

let foreign: string[] = [];
let wasm: string[] = [];
test.beforeEach(async ({ page, baseURL }) => {
  foreign = [];
  wasm = [];
  const origin = new URL(baseURL!).origin;
  page.on("request", (request) => {
    const url = request.url();
    if (url.endsWith(".wasm")) wasm.push(url);
    if (!url.startsWith(origin) && !url.startsWith("data:") && !url.startsWith("blob:")) foreign.push(url);
  });
});
test.afterEach(() => {
  expect(foreign, "requests to another origin").toEqual([]);
});

const bytes = async (download: Download) => readFile((await download.path())!);

/** Width and height of a JPEG, from its start-of-frame marker. */
function jpegSize(data: Buffer): { width: number; height: number } {
  let i = 2;
  while (i < data.length) {
    if (data[i] !== 0xff) throw new Error("not a JPEG marker");
    const marker = data[i + 1];
    const length = data.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: data.readUInt16BE(i + 5), width: data.readUInt16BE(i + 7) };
    }
    i += 2 + length;
  }
  throw new Error("no frame in JPEG");
}

/** A one-page draft: a new one with a few fields typed in. */
async function shortDraft(page: Page) {
  await page.goto("/editor?new=1");
  await page.getByLabel("Name", { exact: true }).fill("Sai Teja Mandapati");
  await page.getByLabel("Place of Birth", { exact: true }).fill("Hyderabad");
  await expect(page.locator('[data-testid="preview-pages"] [data-doc-ready="1"]')).toHaveAttribute("data-doc-pages", "1");
}

/** Where the actions are: the preview column on desktop, the sheet (opened) on phones. */
async function actions(page: Page, isMobile: boolean) {
  if (isMobile) {
    await page.getByTestId("preview-pill").click();
    await expect(page.getByRole("dialog", { name: "Preview" })).toBeVisible();
  }
  return page.getByTestId("export-actions").filter({ visible: true });
}

test("Download PDF saves <Full name> Biodata.pdf made from the latest edits, loading the engine only then", async ({ page, isMobile }) => {
  await shortDraft(page);
  expect(wasm, "the engine is not loaded with the editor").toEqual([]);
  // A change typed just before the click is in the file (the download waits for the preview to catch up).
  await page.getByLabel("Name", { exact: true }).fill("Ravi Kumar Mandapati");
  const bar = await actions(page, isMobile);
  const [download] = await Promise.all([page.waitForEvent("download"), bar.getByRole("button", { name: "Download PDF" }).click()]);
  expect(download.suggestedFilename()).toBe("Ravi Kumar Mandapati Biodata.pdf");
  const pdf = await bytes(download);
  expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  expect(pdf.length).toBeGreaterThan(10_000);
  expect(wasm.length, "HarfBuzz loads on the first download").toBeGreaterThan(0);
  await expect(page.getByTestId("export-toast")).toContainText("Downloaded Ravi Kumar Mandapati Biodata.pdf");
  await expect(bar.getByRole("button", { name: "Download PDF" })).toBeEnabled();
});

test("Save as image saves one 2480 px JPEG per page, or a PNG", async ({ page, isMobile }) => {
  test.setTimeout(60_000);
  await openStoredDraft(page, sampleDraft(`images-${isMobile ? "phone" : "desktop"}`));
  await expect(page.locator('[data-testid="preview-pages"] [data-doc-ready="1"]')).toHaveAttribute("data-doc-pages", "2");
  const bar = await actions(page, isMobile);

  const downloads: Download[] = [];
  page.on("download", (d) => downloads.push(d));
  await bar.getByRole("button", { name: "Save as image" }).click();
  await page.getByRole("menuitem", { name: /^Save as JPEG/ }).click();
  await expect.poll(() => downloads.length, { timeout: 30_000 }).toBe(2);
  expect(downloads.map((d) => d.suggestedFilename())).toEqual(["Sai Teja Mandapati Biodata - page 1.jpg", "Sai Teja Mandapati Biodata - page 2.jpg"]);
  for (const d of downloads) expect(jpegSize(await bytes(d))).toEqual({ width: 2480, height: 3508 });
  await expect(page.getByTestId("export-toast")).toContainText("Downloaded 2 pictures, one per page");

  if (isMobile) return;
  downloads.length = 0;
  await bar.getByRole("button", { name: "Save as image" }).click();
  await page.getByRole("menuitem", { name: /^Save as PNG/ }).click();
  await expect.poll(() => downloads.length, { timeout: 30_000 }).toBe(2);
  const png = await bytes(downloads[0]);
  expect(downloads[0].suggestedFilename()).toBe("Sai Teja Mandapati Biodata - page 1.png");
  expect(png.subarray(1, 4).toString("latin1")).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(2480);
});

test("there is no Print button; the browser's own Print still prints only a true-size copy of the pages", async ({ page, isMobile }) => {
  await openStoredDraft(page, sampleDraft(`print-${isMobile ? "phone" : "desktop"}`));
  await expect(page.locator('[data-testid="preview-pages"] [data-doc-ready="1"]')).toHaveAttribute("data-doc-pages", "2");
  const bar = await actions(page, isMobile);
  await expect(bar.getByRole("button", { name: "Download PDF" })).toBeVisible();
  await expect(bar.getByRole("button", { name: "Print", exact: true })).toHaveCount(0);
  // Ctrl+P / the browser menu: the copy is made before printing and is all that shows.
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  const copy = page.locator(".print-pages [data-page]");
  await expect(copy).toHaveCount(2);
  expect((await copy.first().boundingBox())!.width).toBeCloseTo(794, 0);
  await page.emulateMedia({ media: "print" });
  const shown = await page.evaluate(() => [...document.body.children].filter((el) => getComputedStyle(el).display !== "none").map((el) => el.className));
  expect(shown).toEqual(["doc-copy print-pages"]);
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await expect(page.locator(".print-pages")).toHaveCount(0);
});

test("Share PDF hands the file to the share sheet where the browser takes files, and is hidden elsewhere", async ({ page, isMobile }) => {
  // A browser without file sharing (sessionStorage "share" unset), or one that takes files (set to "files"; the share
  // sheet is stubbed and records what it was given).
  await page.addInitScript(() => {
    const w = window as unknown as { __shared: { name: string; type: string; size: number; head: string }[][] };
    w.__shared = [];
    if (sessionStorage.getItem("share") !== "files") {
      Object.defineProperty(navigator, "canShare", { value: undefined });
      Object.defineProperty(navigator, "share", { value: undefined });
      return;
    }
    Object.defineProperty(navigator, "canShare", { value: (data: ShareData) => !!data.files?.length });
    Object.defineProperty(navigator, "share", {
      value: async (data: ShareData) => {
        const files = await Promise.all(
          (data.files ?? []).map(async (f) => ({ name: f.name, type: f.type, size: f.size, head: new TextDecoder().decode((await f.arrayBuffer()).slice(0, 5)) })),
        );
        w.__shared.push(files);
      },
    });
  });
  await shortDraft(page);
  const bar = await actions(page, isMobile);
  await expect(bar.getByRole("button", { name: "Download PDF" })).toBeVisible();
  await expect(bar.getByRole("button", { name: "Share PDF" })).toHaveCount(0);
  await bar.getByRole("button", { name: "Save as image" }).click();
  await expect(page.getByRole("menuitem", { name: /^Save as JPEG/ })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /^Share as image/ })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await expect(page.getByTestId("save-status")).toHaveText(SAVED);
  await page.evaluate(() => sessionStorage.setItem("share", "files"));
  await page.reload();
  const bar2 = await actions(page, isMobile);
  await bar2.getByRole("button", { name: "Share PDF" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __shared: unknown[] }).__shared))
    .toEqual([[{ name: "Sai Teja Mandapati Biodata.pdf", type: "application/pdf", size: expect.any(Number), head: "%PDF-" }]]);
  // Share as image, from the image menu: one JPEG per page.
  await bar2.getByRole("button", { name: "Save as image" }).click();
  await page.getByRole("menuitem", { name: /^Share as image/ }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __shared: { name: string }[][] }).__shared.length)).toBe(2);
  const images = await page.evaluate(() => (window as unknown as { __shared: { name: string; type: string }[][] }).__shared[1]);
  expect(images.map((f) => [f.name, f.type])).toEqual([["Sai Teja Mandapati Biodata.jpg", "image/jpeg"]]);
});

test("the editor's page images match the Download engine run on the same draft's true-size pages", async ({ page, isMobile }) => {
  test.skip(isMobile, "one comparison is enough");
  test.setTimeout(60_000);
  const draft = sampleDraft("compare-images");
  await openStoredDraft(page, draft);
  await expect(page.locator('[data-testid="preview-pages"] [data-doc-ready="1"]')).toHaveAttribute("data-doc-pages", "2");
  // The preview is scaled down to fit its pane; the export must not be.
  expect(Number(await page.getByTestId("preview-pages").getAttribute("data-scale"))).toBeLessThan(0.9);
  const downloads: Download[] = [];
  page.on("download", (d) => downloads.push(d));
  await page.getByRole("button", { name: "Save as image" }).click();
  await page.getByRole("menuitem", { name: /^Save as PNG/ }).click();
  await expect.poll(() => downloads.length, { timeout: 30_000 }).toBe(2);
  const editorImages = await Promise.all(downloads.map(async (d) => (await bytes(d)).toString("base64")));

  await page.goto(`/dev/draft?d=${draft.id}`);
  await expect(page.locator("body[data-doc-ready]")).toHaveCount(1);
  const reference = await page.evaluate(() => window.__draft!.images("png"));
  expect(reference.images).toHaveLength(2);

  for (const [i, image] of editorImages.entries()) {
    const diff = await page.evaluate(
      async ([a, b]) => {
        const load = (src: string) =>
          new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
          });
        const [one, two] = await Promise.all([load(`data:image/png;base64,${a}`), load(`data:image/png;base64,${b}`)]);
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
        let max = 0;
        for (let k = 0; k < p.length; k++) {
          const d = Math.abs(p[k] - q[k]);
          sum += d;
          max = Math.max(max, d);
        }
        return { mean: sum / p.length, max, sizes: [one.naturalWidth, two.naturalWidth] };
      },
      [image, reference.images[i]] as const,
    );
    expect(diff.sizes).toEqual([2480, 2480]);
    expect(diff.mean, `page ${i + 1}: mean difference`).toBeLessThan(0.5);
  }
});
