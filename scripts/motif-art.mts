// Run order: motif-art, motif-sheet, then motif-fit (which gives every symbol the same visual size).
// Prepares the owner's symbol artwork for the app (src/document/motifs/art). Line drawings are trimmed, their white
// background made transparent and their strokes coloured gold at 512 px. Colour pictures (the illustrations and the
// deity pictures) are copied unchanged: their colours are part of the artwork. Run: node --import tsx scripts/motif-art.mts
import sharp from "sharp";
import { copyFile } from "node:fs/promises";

const SRC = "docs/references/icons";
const OUT = "src/document/motifs/art";
const GOLD = { r: 0xb7, g: 0x79, b: 0x1f };
const SIZE = 512;

// Line drawings: source file → output name. Kept at their native size (upscaling adds no detail).
// Optional per file: [source, output, floor, gain]. Ink = (255 - grey - floor) * gain, so a pale source gets more gain.
const LINES: [string, string, number?, number?][] = [
  ["ganesha-black-stencil.jpg", "ganesha-stencil.png"],
  ["ganesha-gold-line.jpg", "ganesha-line.png", 8, 2.2],
  ["ganesha-orange-line.png", "ganesha-outline.png", 8, 2.2],
  ["om-brown-mandala.png", "om-mandala.png"],
  ["ganesha-line-right.jpg", "ganesha-seated-right.png"],
  ["ganesha-line-left.jpg", "ganesha-seated-left.png"],
  ["ganesha-mandala-line.jpg", "ganesha-mandala.png"],
  ["ganesha-lotus-line.jpg", "ganesha-lotus.png"],
  ["ganesha-ornate-throne.jpg", "ganesha-throne.png"],
];

// Colour pictures: copied as they are.
const PICTURES: [string, string][] = [
  ["venkateswara.png", "venkateswara.png"],
  ["rama-with-bow.png", "rama-with-bow.png"],
  ["ganesha-seated-cartoon.jpeg", "ganesha-seated.jpg"],
  ["ganesha-colored-trident.png", "ganesha-trident.png"],
  ["ganesha-lotus-frame.png", "ganesha-lotus-frame.png"],
  ["ganesha-orange-frame.png", "ganesha-orange-frame.png"],
  ["om-orange-seal.png", "om-orange-seal.png"],
];

// Ink strength: a source with its own transparency keeps it; otherwise darkness, with a floor so the paper texture of
// a scanned JPEG (light grey, within ~30 levels of white) drops out rather than turning into noise.
const FLOOR = 40;

for (const [src, out, floorOverride, gain = 1] of LINES) {
  const floor = floorOverride ?? FLOOR;
  const input = sharp(`${SRC}/${src}`);
  const meta = await input.metadata();
  const { data, info } = await input.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const alpha = Buffer.alloc(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    if (meta.hasAlpha && data[i * 4 + 3] < 255) {
      alpha[i] = data[i * 4 + 3];
      continue;
    }
    const grey = (r * 0.299 + g * 0.587 + b * 0.114);
    alpha[i] = Math.max(0, Math.min(255, Math.round(((255 - grey - floor) * 255 * gain) / (255 - floor))));
  }
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = GOLD.r;
    rgba[i * 4 + 1] = GOLD.g;
    rgba[i * 4 + 2] = GOLD.b;
    rgba[i * 4 + 3] = alpha[i];
  }
  await sharp(rgba, { raw: { width, height, channels: 4 } }).trim({ threshold: 1 }).png().toFile(`${OUT}/${out}`);
  console.log("line", out, width, height);
}

for (const [src, out] of PICTURES) {
  await copyFile(`${SRC}/${src}`, `${OUT}/${out}`);
  console.log("picture", out);
}
