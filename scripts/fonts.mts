// Copies the Noto Sans fonts the biodata uses into public/fonts/: `npm run fonts`. The same files draw the
// preview, print, the PDF and page images (BUILD_PLAN A1). Static TTFs (Regular and Bold) from the
// @expo-google-fonts packages, under the SIL Open Font License 1.1 (OFL.txt is copied beside them).
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";

/** Package suffix → file family name. Devanagari covers Hindi and Marathi. */
const FAMILIES: Record<string, string> = {
  "noto-sans": "NotoSans",
  "noto-sans-telugu": "NotoSansTelugu",
  "noto-sans-devanagari": "NotoSansDevanagari",
  "noto-sans-tamil": "NotoSansTamil",
  "noto-sans-kannada": "NotoSansKannada",
  "noto-sans-malayalam": "NotoSansMalayalam",
  "noto-sans-gujarati": "NotoSansGujarati",
  "noto-sans-bengali": "NotoSansBengali",
  "noto-sans-gurmukhi": "NotoSansGurmukhi",
};
const WEIGHTS = [
  { dir: "400Regular", suffix: "Regular" },
  { dir: "700Bold", suffix: "Bold" },
];

await mkdir("public/fonts", { recursive: true });
const rows: string[] = [];
let total = 0;
for (const [pkg, family] of Object.entries(FAMILIES)) {
  for (const { dir, suffix } of WEIGHTS) {
    const from = `node_modules/@expo-google-fonts/${pkg}/${dir}/${family}_${dir}.ttf`;
    const to = `public/fonts/${family}-${suffix}.ttf`;
    await copyFile(from, to);
    const { size } = await stat(to);
    total += size;
    rows.push(`${`${family}-${suffix}.ttf`.padEnd(32)} ${(size / 1024).toFixed(0).padStart(5)} KB`);
  }
}
// OFL.txt: every family's copyright line, then the licence text they share (each package's LICENSE_FONT;
// its LICENSE file is Expo's MIT licence for the package code, not the fonts').
const licenses = await Promise.all(Object.keys(FAMILIES).map((pkg) => readFile(`node_modules/@expo-google-fonts/${pkg}/LICENSE_FONT`, "utf8")));
const copyrights = licenses.map((text) => text.split("\n")[0].trim());
const body = licenses[0].slice(licenses[0].indexOf("\n") + 1);
await writeFile("public/fonts/OFL.txt", `${copyrights.join("\n")}\n${body}`);
console.log(rows.join("\n"));
console.log(`${"Total".padEnd(32)} ${(total / 1024).toFixed(0).padStart(5)} KB`);
