import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { DisplayList, DisplayPage, TextItem } from "./display-list";
import { num } from "./color";
import { imagePlacement } from "./image-placement";
import { writePdf, type RunMeasure, type WritePdfOptions } from "./write-pdf";

const root = process.cwd();
const fonts = async (family: string, weight: number) => {
  const file = path.join(root, "public/fonts", `${family.replace(/\s+/g, "")}-${weight >= 600 ? "Bold" : "Regular"}.ttf`);
  return existsSync(file) ? new Uint8Array(readFileSync(file)) : null;
};
const subsetWasm = readFileSync(path.join(root, "node_modules/harfbuzzjs/dist/harfbuzz-subset.wasm"));

const text = (t: Partial<TextItem> & Pick<TextItem, "text">): TextItem => ({
  kind: "text",
  x: 100,
  y: 200,
  width: 0,
  fontFamilies: ["Noto Sans"],
  fontWeight: 400,
  fontStyle: "normal",
  fontSize: 13.5,
  color: "rgb(31, 26, 20)",
  letterSpacing: 0,
  align: "left",
  justified: false,
  spaceAfter: false,
  ...t,
});

const page = (items: DisplayPage["items"], lang = "en"): DisplayList => ({ pages: [{ width: 794, height: 1123, background: "rgb(255, 253, 248)", lang, items }] });

async function write(list: DisplayList, options: WritePdfOptions = {}) {
  const runs: RunMeasure[] = [];
  const warnings: string[] = [];
  const bytes = await writePdf(list, fonts, { subsetWasm, onRun: (m) => runs.push(m), onWarning: (w) => warnings.push(w), ...options });
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const pdfPage = doc.getPage(0);
  const contents = doc.context.lookup(pdfPage.node.get(PDFName.of("Contents"))) as PDFRawStream;
  const ops = new TextDecoder("latin1").decode(decodePDFRawStream(contents).decode());
  const fontDict = pdfPage.node.Resources()!.lookupMaybe(PDFName.of("Font"), PDFDict);
  const baseFonts = fontDict ? fontDict.keys().map((k) => String(fontDict.lookup(k, PDFDict).get(PDFName.of("BaseFont")))) : [];
  return { bytes, doc, ops, runs, warnings, baseFonts };
}

const utf16 = (s: string) => Array.from({ length: s.length }, (_, i) => s.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase()).join("");

describe("writePdf", () => {
  it("writes an A4 page with a subset Type0 font, an ActualText span and the browser's width", async () => {
    const telugu = "శ్రీ వెంకట కృష్ణమూర్తి మండపాటి";
    const { bytes, doc, ops, runs, baseFonts } = await write(
      page(
        [
          { kind: "rect", x: 64, y: 212, width: 666, height: 30.5, fill: "rgb(252, 201, 106)", radius: 4 },
          text({ x: 258, y: 262.5, width: 161.640625, text: telugu, fontFamilies: ["Noto Sans Telugu", "Noto Sans"] }),
          { kind: "svg", x: 0, y: 0, width: 100, height: 100, markup: `<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="5" r="4" fill="#d9a43a"/></svg>` },
        ],
        "te",
      ),
    );
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.byteLength).toBeLessThan(30_000);
    expect(Math.abs(runs[0].ratio)).toBeLessThan(0.005);
    expect(doc.getPage(0).getSize()).toEqual({ width: 595.28, height: 841.89 });
    expect(baseFonts).toHaveLength(1);
    expect(baseFonts[0]).toMatch(/^\/[A-Z]{6}\+NotoSansTelugu-Regular$/);
    expect(String(doc.catalog.get(PDFName.of("Lang")))).toBe("(te)");
    expect(doc.getProducer()).toBe("Free Wedding Biodata");
    expect(ops).toContain(`/Span << /ActualText <FEFF${utf16(telugu)}> >> BDC`);
    expect(ops).toContain("1 0 0 -1 258 262.5 Tm");
    expect(ops).toMatch(/\] TJ/);
  });

  it("falls back per glyph to Noto Sans at the same weight for Latin text, digits and ₹ on an Indic page", async () => {
    const { ops, baseFonts, runs } = await write(
      page([text({ text: "Blood group : B+ ₹ 12,00,000 ಹೆಸರು", fontWeight: 700, fontFamilies: ["Noto Sans Kannada", "Noto Sans"] })], "kn"),
    );
    expect(baseFonts.map((f) => f.replace(/^\/[A-Z]{6}\+/, "")).sort()).toEqual(["NotoSans-Bold", "NotoSansKannada-Bold"]);
    expect(runs[0].fallback).toBe(true);
    expect(ops.match(/ Tf/g)!.length).toBeGreaterThan(2);
  });

  it("skips families it has no font for and still draws the text with the fallback", async () => {
    // The loader knows only the Noto families.
    const { baseFonts } = await write(page([text({ text: "Hello", fontFamilies: ["Fancy Script", "Noto Sans"] })]));
    expect(baseFonts[0]).toMatch(/NotoSans-Regular$/);
  });

  it("anchors centred and right-aligned runs on the browser's box, and spreads a justified line over its spaces", async () => {
    const wide = 400;
    const { ops, runs } = await write(
      page([
        text({ text: "Centre", width: wide, align: "center" }),
        text({ text: "Right", y: 230, width: wide, align: "right" }),
        text({ text: "a justified line of words", y: 260, width: wide, align: "justify", justified: true }),
        text({ text: "the last line", y: 290, width: 50, align: "justify", justified: false }),
      ]),
    );
    expect(ops).toContain(`1 0 0 -1 ${num(100 + (wide - runs[0].shapedWidth) / 2)} 200 Tm`);
    expect(ops).toContain(`1 0 0 -1 ${num(100 + wide - runs[1].shapedWidth)} 230 Tm`);
    expect(runs[2].justified).toBe(true);
    expect(runs[3].justified).toBeUndefined();
    // Four spaces, each widened by a quarter of the difference: TJ adjustments of the same size.
    const gap = ((wide - runs[2].shapedWidth) / 4) * (1000 / 13.5);
    const justified = ops.split("1 0 0 -1 100 260 Tm")[1].split("ET")[0];
    expect(justified.match(new RegExp(` ${num(-gap).replace(".", "\\.")} `, "g"))).toHaveLength(4);
  });

  it("gives a run its space back in the copied text, and slants italic text like the browser", async () => {
    const { ops } = await write(
      page([text({ text: "పేరు :", fontFamilies: ["Noto Sans Telugu", "Noto Sans"], spaceAfter: true }), text({ text: "Ravi", x: 300, fontStyle: "italic" })], "te"),
    );
    expect(ops).toContain(`/ActualText <FEFF${utf16("పేరు : ")}>`);
    expect(ops).toContain("1 0 0.25 -1 300 200 Tm");
  });

  it("embeds JPEG and PNG data URLs, clipped to the frame for object-fit: cover", async () => {
    const require = createRequire(import.meta.url);
    const sharp = require(require.resolve("sharp", { paths: [path.join(root, "node_modules/next")] })) as (typeof import("sharp"))["default"];
    const raw = { create: { width: 60, height: 90, channels: 3 as const, background: { r: 200, g: 180, b: 150 } } };
    const jpeg = `data:image/jpeg;base64,${(await sharp(raw).jpeg().toBuffer()).toString("base64")}`;
    const png = `data:image/png;base64,${(await sharp(raw).png().toBuffer()).toString("base64")}`;
    const image = { kind: "image" as const, y: 100, width: 60, height: 60, naturalWidth: 60, naturalHeight: 90 };
    const { doc, ops, warnings } = await write(
      page([
        { ...image, x: 10, src: jpeg, fit: "cover", radius: 8 },
        { ...image, x: 100, src: png, fit: "fill" },
        { ...image, x: 200, src: "blob:http://localhost/x", fit: "fill" },
      ]),
    );
    const xobjects = doc.getPage(0).node.Resources()!.lookup(PDFName.of("XObject"), PDFDict);
    expect(xobjects.keys()).toHaveLength(2);
    expect(warnings.join(" ")).toMatch(/not a JPEG\/PNG data URL/);
    // cover: 60 × 90 drawn at 60 wide, centred vertically (15 px above and below the frame), inside a clip.
    expect(ops).toMatch(/W n\n60 0 0 -90 10 175 cm\n\/Im1 Do/);
    expect(ops).toContain("60 0 0 -60 100 160 cm\n/Im2 Do");
  });
});

describe("imagePlacement", () => {
  const box = { x: 0, y: 0, width: 100, height: 100, naturalWidth: 200, naturalHeight: 100 };
  it("covers, contains or fills the box, centred", () => {
    expect(imagePlacement({ ...box, fit: "cover" })).toEqual({ x: -50, y: 0, width: 200, height: 100 });
    expect(imagePlacement({ ...box, fit: "contain" })).toEqual({ x: 0, y: 25, width: 100, height: 50 });
    expect(imagePlacement({ ...box, fit: "fill" })).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });
});
