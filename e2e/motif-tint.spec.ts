import { mkdir, readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { expect, test, type Download, type Page } from "@playwright/test";
import { PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef } from "pdf-lib";
import type { BiodataProfile } from "../src/biodata/types";
import { openStoredDraft, sampleDraft } from "./editor-helpers";

// Gold symbol pictures in the design's colours (owner's request, 2026-11-22; src/document/motifs/tone.ts): the
// single-colour pictures are recoloured in the browser with the design's ink, keeping their shading, and reach the
// page, the PDF and the page images as a PNG data URL; colour pictures keep their own colours. The A7 review
// images (page tops in eight designs, the top card in Peacock) go to test-results/motif-tint/.

const OUT = "test-results/motif-tint";
const symbol = (page: Page) => page.locator('[data-testid="preview-pages"] [data-doc-ready="1"] [data-page] [data-motif]');

function draft(id: string, templateId: string, colorId: string, motif: string) {
  return sampleDraft(id, (p: BiodataProfile) => {
    p.templateId = templateId;
    p.colorId = colorId;
    p.options.motif = motif;
    p.options.invocation = "॥ श्री गणेशाय नमः ॥";
    p.options.titleKey = "marriageBiodata";
  });
}

/** The average colour of an <img>'s opaque pixels, read back from a canvas. */
async function averageColour(page: Page, selector: string): Promise<[number, number, number]> {
  return page.locator(selector).first().evaluate(async (img: HTMLImageElement) => {
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const sum = [0, 0, 0];
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue;
      sum[0] += data[i];
      sum[1] += data[i + 1];
      sum[2] += data[i + 2];
      n += 1;
    }
    return sum.map((v) => Math.round(v / n)) as [number, number, number];
  });
}

/** The PNG pictures in a PDF (pdf-lib writes them as 8-bit RGB with an alpha SMask): their average opaque colour. */
async function pdfPictureColours(bytes: Buffer): Promise<{ width: number; height: number; colour: [number, number, number] }[]> {
  const doc = await PDFDocument.load(bytes);
  const out: { width: number; height: number; colour: [number, number, number] }[] = [];
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream)) continue;
    const dict = object.dict;
    if (dict.get(PDFName.of("Subtype")) !== PDFName.of("Image") || dict.get(PDFName.of("ColorSpace")) !== PDFName.of("DeviceRGB")) continue;
    if (dict.get(PDFName.of("Filter")) !== PDFName.of("FlateDecode")) continue; // a JPEG photo is DCTDecode
    const smask = dict.get(PDFName.of("SMask"));
    if (!(smask instanceof PDFRef)) continue;
    const width = (dict.get(PDFName.of("Width")) as PDFNumber).asNumber();
    const height = (dict.get(PDFName.of("Height")) as PDFNumber).asNumber();
    const rgb = inflateSync(object.contents);
    const alpha = inflateSync((doc.context.lookup(smask) as PDFRawStream).contents);
    const sum = [0, 0, 0];
    let n = 0;
    for (let i = 0; i < width * height; i++) {
      if (alpha[i] < 200) continue;
      for (let c = 0; c < 3; c++) sum[c] += rgb[i * 3 + c];
      n += 1;
    }
    if (n) out.push({ width, height, colour: sum.map((v) => Math.round(v / n)) as [number, number, number] });
  }
  return out;
}

const bytes = async (download: Download) => readFile((await download.path())!);
const tealish = ([r, g, b]: number[]) => g > r + 30 && b > r + 30;
const warm = ([r, , b]: number[]) => r > b + 40;

test.describe("the symbol in the design's colours", () => {
  test.skip(({ isMobile }) => isMobile, "the preview column and its Download button are the desktop layout; the engine path is the same");

  test("Peacock teal prints the gold Ganesha in teal, on the page, its top card tile and in the PDF", async ({ page }) => {
    test.setTimeout(90_000);
    await openStoredDraft(page, draft("tint-peacock", "peacock", "teal", "ganesha"));
    await expect(symbol(page)).toHaveAttribute("src", /^data:image\/png;base64,/);
    await expect(page.locator("[data-page] [data-motif-pending]")).toHaveCount(0);
    const onPage = await averageColour(page, '[data-testid="preview-pages"] [data-page] img[data-motif]');
    expect(tealish(onPage), `page symbol ${onPage}`).toBe(true);
    await expect(page.getByTestId("top-summary")).toHaveText("Ganesha · ॥ श्री गणेशाय नमः ॥ · Marriage Biodata · in the design's colours");
    // The top card's tile is tinted the same way.
    await expect(page.getByTestId("top-preview").locator("img")).toHaveAttribute("src", /^data:image\/png;base64,/);

    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), page.getByTestId("export-actions").getByRole("button", { name: "Download PDF" }).click()]);
    const pictures = await pdfPictureColours(await bytes(download));
    expect(pictures.length, "the symbol is in the PDF").toBeGreaterThan(0);
    expect(pictures.every((p) => tealish(p.colour)), JSON.stringify(pictures)).toBe(true);
  });

  test("a colour picture keeps its own colours, and the summary says so", async ({ page }) => {
    await openStoredDraft(page, draft("tint-venkateswara", "peacock", "teal", "venkateswara"));
    await expect(symbol(page)).toHaveAttribute("src", /\/_next\/static\/media\/venkateswara\.[^/]+\.png$/);
    await expect(page.getByTestId("top-summary")).toHaveText("Venkateswara · ॥ श्री गणेशाय नमः ॥ · Marriage Biodata · in its own colours");
    const colour = await averageColour(page, '[data-testid="preview-pages"] [data-page] img[data-motif]');
    expect(warm(colour), `Venkateswara ${colour}`).toBe(true);
  });

  test("a dark paper (Peacock, festive emerald) gets a light gold symbol", async ({ page }) => {
    await openStoredDraft(page, draft("tint-switch", "peacock", "emerald", "omGold"));
    await expect(symbol(page)).toHaveAttribute("src", /^data:image\/png;base64,/);
    const [r, g, b] = await averageColour(page, '[data-testid="preview-pages"] [data-page] img[data-motif]');
    // Festive emerald's ink is #ecc96a: light and warm, well clear of the dark green paper.
    expect(r, "warm").toBeGreaterThan(b + 40);
    expect(0.2126 * r + 0.7152 * g + 0.0722 * b, "light").toBeGreaterThan(170);
  });
});

test.describe("review", () => {
  test.skip(({ isMobile }) => isMobile, "page tops are a fixed A4 size; the top card is shot at both sizes here");
  test.use({ deviceScaleFactor: 2 });

  test("page tops in eight designs and the top card in Peacock, Day and Night, desktop and phone (A7)", async ({ page }) => {
    test.setTimeout(240_000);
    await mkdir(OUT, { recursive: true });
    const designs: [string, string][] = [
      ["classic-gold", "gold"],
      ["peacock", "teal"],
      ["peacock", "emerald"],
      ["royal-maroon", "maroon"],
      ["deepam", "maroon"],
      ["mint-vines", "green"],
      ["executive-navy", "navy"],
      ["minimal-ivory", "ink"],
    ];
    const pictures = ["ganesha", "ganeshaLine", "ganeshaMandala", "omGold", "khandaSheet", "crossLatinSheet", "dharmaSolid", "allahMedallionSheet"];
    await page.setViewportSize({ width: 1000, height: 1300 });
    for (const [i, [templateId, colorId]] of designs.entries()) {
      for (const motif of ["ganesha", pictures[i], "om"]) {
        const id = `tint-review-${templateId}-${colorId}-${motif}`;
        await openStoredDraft(page, draft(id, templateId, colorId, motif));
        await page.goto(`/dev/draft?d=${id}`);
        await expect(page.locator("body[data-doc-ready]")).toHaveCount(1);
        const pageBox = (await page.locator("[data-page]").first().boundingBox())!;
        await page.screenshot({ path: `${OUT}/top-${templateId}-${colorId}-${motif}.png`, clip: { x: pageBox.x, y: pageBox.y, width: pageBox.width, height: 330 } });
      }
    }
    await openStoredDraft(page, draft("tint-review-card", "peacock", "teal", "ganesha"));
    const top = page.locator('[data-section="top"]');
    for (const size of [
      { name: "phone", width: 390, height: 844 },
      { name: "desktop", width: 1440, height: 900 },
    ]) {
      await page.setViewportSize({ width: size.width, height: size.height });
      for (const theme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: theme });
        const tag = `${size.name}-${theme === "light" ? "day" : "night"}`;
        await expect(top.locator("[data-motif-pending]")).toHaveCount(0);
        await top.screenshot({ path: `${OUT}/top-card-peacock-${tag}.png`, animations: "disabled" });
        await top.getByRole("button", { name: "See them larger" }).click();
        await expect(page.getByTestId("motif-dialog")).toBeVisible();
        await expect(page.getByTestId("motif-dialog").locator("[data-motif-pending]")).toHaveCount(0);
        await page.getByRole("dialog").screenshot({ path: `${OUT}/dialog-peacock-${tag}.png`, animations: "disabled" });
        await page.getByRole("dialog").getByRole("button", { name: "Close" }).first().click();
      }
    }
  });
});
