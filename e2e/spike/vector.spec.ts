import { mkdir, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

// PDF spike (BUILD_PLAN Step 0.2): candidate C made in the browser from the static build (fonts from /fonts,
// HarfBuzz WebAssembly emitted by Turbopack), timed on desktop and with the CPU slowed 4×.

const OUT = "test-results/spike"; // git-ignored; the curated evidence is in docs/spikes/

test.skip(({ isMobile }) => isMobile, "the spike runs once, on desktop Chrome");

test("vector PDF (candidate C) in the browser", async ({ page }) => {
  test.setTimeout(180_000);
  await mkdir(OUT, { recursive: true });
  await page.goto("/dev/pdf-spike");
  await expect(page.locator("body")).toHaveAttribute("data-spike-ready", "1", { timeout: 30_000 });

  const run = () =>
    page.evaluate(async () => {
      const spike = window.__spike!;
      const t0 = performance.now();
      const { browserPdf } = await spike.vector();
      const t1 = performance.now();
      const pdf = await browserPdf(spike.displayList());
      const t2 = performance.now();
      let binary = "";
      for (let i = 0; i < pdf.length; i += 0x8000) binary += String.fromCharCode(...pdf.subarray(i, i + 0x8000));
      return { loadMs: t1 - t0, pdfMs: t2 - t1, pdf: btoa(binary) };
    });

  const transferred: Record<string, number> = {};
  page.on("response", async (response) => {
    const url = new URL(response.url());
    if (/\.(wasm|ttf|js)$/.test(url.pathname)) transferred[url.pathname] = (await response.body().catch(() => Buffer.alloc(0))).length;
  });

  const first = await run();
  await writeFile(`${OUT}/C-browser.pdf`, Buffer.from(first.pdf, "base64"));
  const second = await run();

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const slow = await run();
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

  const report = {
    firstMs: { load: Math.round(first.loadMs), pdf: Math.round(first.pdfMs) },
    warmMs: Math.round(second.pdfMs),
    cpu4xWarmMs: Math.round(slow.pdfMs),
    pdfKB: Math.round((first.pdf.length * 3) / 4 / 1024),
    wasmKB: Object.fromEntries(Object.entries(transferred).filter(([p]) => p.endsWith(".wasm")).map(([p, n]) => [p.split("/").pop(), Math.round(n / 1024)])),
  };
  await writeFile(`${OUT}/C-browser-timings.json`, JSON.stringify(report, null, 2));
  console.log("C (browser):", JSON.stringify(report));
  expect(first.pdf.length).toBeGreaterThan(10_000);
});
