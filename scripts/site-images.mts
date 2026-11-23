// Makes the site's pictures: `npm run images`. Run it again after changing src/app/icon.svg or the preview's words.
// - From src/app/icon.svg (a copy of docs/brand/app-icon.svg, VISION D48): favicon.ico (16, 32 and 48 px),
//   apple-icon.png (180 px, square: iPhones round the corners themselves) and the installable app's icons in
//   public/icons (192, 512 and a maskable 512).
// - src/app/opengraph-image.png (1200 x 630, under 300 KB): the link preview WhatsApp, search results and social
//   sites show; docs/social-preview.png (1280 x 640): GitHub's social preview, the same drawing.
//   The previews show two biodata pages from docs/screenshots/ (real app screens, e2e/capture.spec.ts).
// - public/landing/*.webp and public/designs/<design>.webp: the landing page's and the gallery's pictures.
// Text is drawn with the fonts of the machine that runs this (Helvetica Neue on macOS).
// sharp is Next.js's own image library, installed with it.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { HEADLINE, PRODUCTION_URL, SITE_NAME } from "../src/lib/site";

const FONT = "Helvetica Neue, Helvetica, Arial, sans-serif";
const MAROON = "#8a1c2b";

const icon = await readFile("src/app/icon.svg", "utf8");
const dataUrl = (type: string, data: Buffer | string) => `data:${type};base64,${Buffer.from(data).toString("base64")}`;

/** The icon at `size` px: drawn four times larger, then scaled down, for smooth edges. */
const iconPng = (svg: string, size: number) => sharp(Buffer.from(svg), { density: (72 * size * 4) / 512 }).resize(size, size).png().toBuffer();

/** An .ico file holding PNG images (every browser since 2010 reads them). */
function ico(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size, entry);
    header.writeUInt8(size, entry + 1);
    header.writeUInt16LE(1, entry + 4); // colour planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.png)]);
}

await writeFile("src/app/favicon.ico", ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, png: await iconPng(icon, size) })))));

// The tile without its rounded corners: iPhones and iPads cut their own.
const square = icon.replace(/(<rect id="tile"[^>]*?) rx="[\d.]+"/, "$1");
if (square === icon) throw new Error('src/app/icon.svg: no <rect id="tile" … rx="…"> to square off');
await writeFile("src/app/apple-icon.png", await iconPng(square, 180));

// The installable app's icons. The maskable one keeps the page inside the centre 80% ("safe zone"), since
// Android may cut it to a circle.
await mkdir("public/icons", { recursive: true });
await writeFile("public/icons/icon-192.png", await iconPng(icon, 192));
await writeFile("public/icons/icon-512.png", await iconPng(icon, 512));
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#7d1a27"/>
  <image x="51" y="51" width="410" height="410" href="${dataUrl("image/svg+xml", square)}"/>
</svg>`;
await writeFile("public/icons/icon-maskable-512.png", await sharp(Buffer.from(maskable)).png().toBuffer());

/** What it is, in short lines (VISION §1). */
const LINES = ["Pick a design, add your photo and details,", "and download an A4 biodata as PDF or PNG.", "No login. Saved only on your device."];

/** A biodata page (a real render, docs/screenshots/biodata-*.png) tilted `angle` degrees, with a soft shadow. */
function sheet(x: number, y: number, w: number, href: string, angle: number): string {
  const h = Math.round(w * (1123 / 794));
  return `<g transform="rotate(${angle} ${x + w / 2} ${y + h / 2})">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#fffdf8" filter="url(#shadow)"/>
    <image x="${x}" y="${y}" width="${w}" height="${h}" href="${href}" preserveAspectRatio="xMidYMid slice"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="none" stroke="#e7d9bf" stroke-width="1"/>
  </g>`;
}

/**
 * The brand card: the icon and name, the headline with "Wedding Biodata" in the landing page's gradient, what it
 * does, the address, and two biodata pages on the right (English in front, Telugu behind, slightly tilted).
 * Everything that matters stays `margin` px in from every edge (GitHub's template asks for 80 px; chat apps
 * may crop the sides).
 */
function brandCard(width: number, height: number, margin: number, front: string, back: string): string {
  const text = (x: number, y: number, size: number, weight: number, fill: string, content: string) =>
    `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}">${content}</text>`;
  const [first, second, third, ...rest] = HEADLINE.split(" "); // Free / Wedding Biodata / Maker
  const top = margin;
  const pageW = Math.round((height - 2 * margin + 30) / (1123 / 794));
  const frontX = width - margin - pageW + 10;
  const backX = frontX - Math.round(pageW * 0.42);
  const pageY = margin - 10;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="phrase" x1="0" y1="0" x2="1" y2="0.2">
      <stop offset="0" stop-color="#8a1c2b"/><stop offset="0.45" stop-color="#be123c"/><stop offset="1" stop-color="#ea580c"/>
    </linearGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="#f2cd6b" stop-opacity="0.5"/><stop offset="1" stop-color="#f2cd6b" stop-opacity="0"/></radialGradient>
    <radialGradient id="rose"><stop offset="0" stop-color="#be123c" stop-opacity="0.12"/><stop offset="1" stop-color="#be123c" stop-opacity="0"/></radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#6e1420" flood-opacity="0.25"/></filter>
  </defs>
  <rect width="${width}" height="${height}" fill="#fafaf9"/>
  <circle cx="${(backX + frontX + pageW) / 2}" cy="${height / 2}" r="${height * 0.6}" fill="url(#glow)"/>
  <circle cx="${margin + 60}" cy="${height - 20}" r="260" fill="url(#rose)"/>

  <image x="${margin}" y="${top}" width="64" height="64" href="${dataUrl("image/svg+xml", icon)}"/>
  ${text(margin + 82, top + 43, 32, 700, "#1c1917", SITE_NAME)}
  ${text(margin, top + 168, 66, 800, "#1c1917", first)}
  <text x="${margin}" y="${top + 242}" font-family="${FONT}" font-size="66" font-weight="800" fill="url(#phrase)">${second} ${third}</text>
  ${text(margin, top + 316, 66, 800, "#1c1917", rest.join(" "))}
  ${LINES.map((line, i) => text(margin, top + 378 + i * 32, 24, 400, "#57534e", line)).join("")}
  ${text(margin, height - margin, 21, 600, MAROON, PRODUCTION_URL.replace("https://", ""))}

  ${sheet(backX, pageY + 18, pageW, back, -5)}
  ${sheet(frontX, pageY, pageW, front, 3)}
</svg>`;
}

/** As small a PNG as looks the same: chat apps skip big link previews (WhatsApp's limit is about 300 KB). */
const smallPng = (svg: string) => sharp(Buffer.from(svg)).png({ palette: true, quality: 90, effort: 10 }).toBuffer();
// Two biodata pages drawn by the app (docs/screenshots/, from e2e/capture.spec.ts): Classic Gold in English in
// front, in Telugu behind.
const page = async (name: string) => dataUrl("image/png", await sharp(`docs/screenshots/${name}.png`).resize({ width: 640 }).png().toBuffer());
const english = await page("page-classic-gold");
const telugu = await page("page-classic-gold-te");
await writeFile("src/app/opengraph-image.png", await smallPng(brandCard(1200, 630, 64, english, telugu)));
await writeFile("src/app/opengraph-image.alt.txt", `${SITE_NAME}: ${HEADLINE}. Create a marriage biodata and download it as PDF or PNG.`);
await mkdir("docs", { recursive: true });
await writeFile("docs/social-preview.png", await smallPng(brandCard(1280, 640, 80, english, telugu)));

// The landing page's and the gallery's pictures (Step 6.1), as WebP at fixed sizes (LANDING_IMAGES in
// src/components/landing/images.ts gives the page the same sizes): the editor on a computer and on a phone, and
// the first page of every design (plus Telugu and a dark colour).
const shots = (await readdir("docs/screenshots")).filter((f) => f.endsWith(".png"));
await mkdir("public/landing", { recursive: true });
await mkdir("public/designs", { recursive: true });
const webp = (from: string, width: number, to: string) => sharp(`docs/screenshots/${from}`).resize({ width }).webp({ quality: 82, effort: 6 }).toFile(to);
await webp("editor-desktop.png", 1800, "public/landing/editor-desktop.webp");
await webp("editor-phone.png", 600, "public/landing/editor-phone.webp");
const pages = shots.filter((f) => f.startsWith("page-"));
for (const f of pages) await webp(f, 720, `public/designs/${f.slice("page-".length, -".png".length)}.webp`);
console.log(`Wrote favicon.ico, apple-icon.png, public/icons/*, opengraph-image.png, docs/social-preview.png, public/landing/* and ${pages.length} design pictures`);
