// Gives every picture symbol the same visual size (owner's choice 2026-11-22: the size of "Ganesha, classic", which
// fills 80% of its square box). Each file is cropped to its artwork and centred on a square canvas so the artwork's
// longer side is 80% of the canvas. Pixels are only cropped and padded, never resampled. Files already at 80% (the
// symbols cut from the sheet) are left alone. Run after scripts/motif-art.mts and scripts/motif-sheet.mts:
//   node --import tsx scripts/motif-fit.mts
import sharp from "sharp";
import { readdir } from "node:fs/promises";

const DIR = "src/document/motifs/art";
const FILL = 0.8;
const SHEET_CROPS = new Set([
  "allah-medallion.png", "allah-wreath.png", "cross-budded.png", "cross-latin.png", "dharma-light.png", "dharma-solid.png",
  "ganesha-namah.png", "ganesha-sheet.png", "ik-onkar-disc.png", "khanda.png", "om-gold.png",
]);

for (const file of (await readdir(DIR)).filter((f) => /\.(png|jpg)$/.test(f) && !SHEET_CROPS.has(f)).sort()) {
  const path = `${DIR}/${file}`;
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      const white = data[i] > 238 && data[i + 1] > 238 && data[i + 2] > 238;
      if (data[i + 3] > 40 && !white) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
    }
  }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const side = Math.round(Math.max(w, h) / FILL);
  const left = Math.floor((side - w) / 2), top = Math.floor((side - h) / 2);
  const jpeg = file.endsWith(".jpg");
  const background = jpeg ? { r: 255, g: 255, b: 255, alpha: 1 } : { r: 0, g: 0, b: 0, alpha: 0 };
  const cropped = sharp(path).extract({ left: x0, top: y0, width: w, height: h }).extend({ left, top, right: side - w - left, bottom: side - h - top, background });
  const out = jpeg ? await cropped.jpeg({ quality: 95 }).toBuffer() : await cropped.png().toBuffer();
  await sharp(out).toFile(path + ".tmp");
  const { rename } = await import("node:fs/promises");
  await rename(path + ".tmp", path);
  console.log(file, `${w}x${h} → ${side}x${side}`);
}
