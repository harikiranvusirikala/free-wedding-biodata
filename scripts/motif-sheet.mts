import sharp from "sharp";
const SHEET = "docs/references/icons/symbols-sheet.png";
const OUT = "src/document/motifs/art";
// Tile boxes [x, y, w, h] in the sheet's own pixels (2244 x 1052), read from the sheet grid.
const S = 2244 / 2000;
const TILES: [string, number, number, number, number][] = [
  ["om-gold.png", 16, 387, 240, 238],
  ["ganesha-sheet.png", 303, 387, 239, 238],
  ["ik-onkar-disc.png", 590, 387, 239, 238],
  ["khanda.png", 877, 387, 239, 238],
  ["cross-latin.png", 1164, 387, 239, 238],
  ["cross-budded.png", 1451, 387, 239, 238],
  ["allah-wreath.png", 1738, 387, 240, 238],
  ["allah-medallion.png", 16, 673, 240, 238],
  ["ganesha-namah.png", 303, 673, 239, 238],
  ["dharma-light.png", 590, 673, 239, 238],
  ["dharma-solid.png", 877, 673, 239, 238],
  ["ganesha-trunk.png", 1174, 25, 219, 305],
  ["jain-hand.png", 1461, 25, 219, 305],
  ["jain-motto.png", 1748, 25, 220, 305],
];
for (const [out, x, y, w, h] of TILES) {
  const box = { left: Math.round(x * S), top: Math.round(y * S), width: Math.round(w * S), height: Math.round(h * S) };
  const raw = await sharp(SHEET).extract(box).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = raw;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 238 && data[i + 1] > 238 && data[i + 2] > 238) data[i + 3] = 0;
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).trim({ threshold: 5 }).png().toFile(`${OUT}/${out}`);
  console.log(out, box.width, box.height);
}
