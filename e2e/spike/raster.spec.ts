import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

// PDF spike (BUILD_PLAN Step 0.2): candidate D (300 dpi JPEG pages in a PDF) and the page-image check (VISION
// D38: page 1 as JPEG and PNG at 1240 × 1754), timed on desktop and with the CPU slowed 4× (a mid-range phone).

const OUT = "test-results/spike"; // git-ignored; the curated evidence is in docs/spikes/

test.skip(({ isMobile }) => isMobile, "the spike runs once, on desktop Chrome");

test("raster PDF (candidate D) and page images", async ({ page }) => {
  test.setTimeout(180_000);
  await mkdir(OUT, { recursive: true });
  await page.goto("/dev/pdf-spike");
  await expect(page.locator("body")).toHaveAttribute("data-spike-ready", "1", { timeout: 30_000 });

  const run = () =>
    page.evaluate(async () => {
      const toBase64 = async (data: Blob | Uint8Array) => {
        const blob = data instanceof Blob ? data : new Blob([data as BlobPart]);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = "";
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(binary);
      };
      const spike = window.__spike!;
      const list = spike.displayList();
      const t0 = performance.now();
      const raster = await spike.raster();
      const t1 = performance.now();
      const pdf = await raster.rasterPdf(list);
      const t2 = performance.now();
      const images = await raster.pageImages(list.pages[0]);
      const t3 = performance.now();
      return {
        loadMs: t1 - t0,
        pdfMs: t2 - t1,
        imageMs: t3 - t2,
        pdf: await toBase64(pdf),
        jpeg: await toBase64(images.jpeg),
        png: await toBase64(images.png),
      };
    });

  const fast = await run();
  await writeFile(`${OUT}/D-all.pdf`, Buffer.from(fast.pdf, "base64"));
  await writeFile(`${OUT}/image-p1.jpg`, Buffer.from(fast.jpeg, "base64"));
  await writeFile(`${OUT}/image-p1.png`, Buffer.from(fast.png, "base64"));

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const slow = await run();
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

  const kb = (b64: string) => Math.round((b64.length * 3) / 4 / 1024);
  const report = {
    desktop: { pdfMs: Math.round(fast.pdfMs), imageMs: Math.round(fast.imageMs) },
    cpu4x: { pdfMs: Math.round(slow.pdfMs), imageMs: Math.round(slow.imageMs) },
    sizesKB: { pdf: kb(fast.pdf), jpeg: kb(fast.jpeg), png: kb(fast.png) },
  };
  await writeFile(`${OUT}/D-timings.json`, JSON.stringify(report, null, 2));
  console.log("D:", JSON.stringify(report));
});
