import { readFileSync } from "node:fs";
import path from "node:path";
import { PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { DisplayList } from "../display-list";
import { writePdf, type RunMeasure } from "./write-pdf";

const root = process.cwd();
const fonts = async (family: string, weight: number) =>
  new Uint8Array(readFileSync(path.join(root, "public/fonts", `${family.replace(/\s+/g, "")}-${weight >= 600 ? "Bold" : "Regular"}.ttf`)));

const list: DisplayList = {
  pages: [
    {
      width: 794,
      height: 1123,
      background: "rgb(255, 253, 248)",
      lang: "te",
      items: [
        { kind: "rect", x: 64, y: 212, width: 666, height: 30.5, fill: "rgb(252, 201, 106)", radius: 4 },
        { kind: "text", x: 258, y: 262.5, width: 161.640625, text: "శ్రీ వెంకట కృష్ణమూర్తి మండపాటి", fontFamily: "Noto Sans Telugu", fontWeight: 400, fontSize: 13.5, color: "rgb(31, 26, 20)", letterSpacing: 0 },
        { kind: "svg", x: 0, y: 0, width: 100, height: 100, markup: `<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="5" r="4" fill="#d9a43a"/></svg>` },
      ],
    },
  ],
};

describe("writePdf", () => {
  it("writes an A4 page with a subset Type0 font, an ActualText span and Chrome's width", async () => {
    const runs: RunMeasure[] = [];
    const bytes = await writePdf(list, fonts, {
      subsetWasm: readFileSync(path.join(root, "node_modules/harfbuzzjs/dist/harfbuzz-subset.wasm")),
      onRun: (m) => runs.push(m),
    });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.byteLength).toBeLessThan(30_000);
    expect(Math.abs(runs[0].ratio)).toBeLessThan(0.005);

    const doc = await PDFDocument.load(bytes);
    const page = doc.getPage(0);
    expect(page.getSize()).toEqual({ width: 595.28, height: 841.89 });
    const fontDict = page.node.Resources()!.lookup(PDFName.of("Font"), PDFDict);
    const type0 = fontDict.lookup(PDFName.of("F1"), PDFDict);
    expect(type0.get(PDFName.of("Subtype"))).toBe(PDFName.of("Type0"));
    expect(type0.get(PDFName.of("Encoding"))).toBe(PDFName.of("Identity-H"));
    expect(String(type0.get(PDFName.of("BaseFont")))).toMatch(/^\/[A-Z]{6}\+NotoSansTelugu-Regular$/);

    const contents = doc.context.lookup(page.node.get(PDFName.of("Contents"))) as PDFRawStream;
    const ops = new TextDecoder("latin1").decode(decodePDFRawStream(contents).decode());
    const text = "శ్రీ వెంకట కృష్ణమూర్తి మండపాటి";
    const utf16 = Array.from({ length: text.length }, (_, i) => text.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase()).join("");
    expect(ops).toContain(`/Span << /ActualText <FEFF${utf16}> >> BDC`);
    expect(ops).toContain("1 0 0 -1 258 262.5 Tm");
    expect(ops).toMatch(/\] TJ/);
  });
});
