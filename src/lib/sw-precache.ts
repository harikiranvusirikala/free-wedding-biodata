// What the service worker keeps for offline use (BUILD_PLAN A6, Step 5.2), worked out after `next build` by
// scripts/sw-build.mts. Pure, so it is unit-tested: given the files in out/, which addresses go in the precache,
// and the version that names the cache. The version is a hash of every kept file and of the worker itself, so a
// deployment that changes anything gets a new worker (browsers compare sw.js byte for byte) and a new cache, and a
// rebuild that changes nothing keeps the old one.

import { createHash } from "node:crypto";

/** Folders whose files are kept: scripts, styles, pictures and the PDF engine's WebAssembly; the fonts; the icons. */
const KEPT_FOLDERS = ["_next/static/", "fonts/", "icons/", "brand/"];
/** Single files kept at the top of the site (the manifest and the icons it and the pages point to). */
const KEPT_FILES = ["favicon.ico", "icon.svg", "apple-icon.png", "manifest.webmanifest"];
/** Never kept: dev-only pages, the not-found pages, and text the fonts folder carries (the licence). */
const SKIPPED_PAGES = ["404.html", "_not-found.html"];

/**
 * The address a file in out/ is kept under, or null when it isn't kept. Pages are kept by their clean address
 * (`editor.html` → `/editor`, `index.html` → `/`), the way the site links to them; everything else by its path.
 * Only the site's own static files are listed: nothing a person types, nothing from another site.
 */
export function precachePath(file: string): string | null {
  const path = file.replaceAll("\\", "/").replace(/^\.?\//, "");
  if (!path || path.split("/").some((part) => part === ".." || part === "")) return null;
  if (path === "dev" || path.startsWith("dev/")) return null;
  if (path.endsWith(".html")) {
    if (SKIPPED_PAGES.includes(path)) return null;
    const page = path.slice(0, -".html".length).replace(/(^|\/)index$/, "");
    return `/${page}`;
  }
  if (path.endsWith(".map")) return null;
  if (path.startsWith("fonts/")) return path.endsWith(".ttf") || path.endsWith(".woff2") ? `/${path}` : null;
  if (KEPT_FOLDERS.some((folder) => path.startsWith(folder))) return `/${path}`;
  return KEPT_FILES.includes(path) ? `/${path}` : null;
}

export interface PrecacheFile {
  /** The address it is kept under (precachePath). */
  path: string;
  /** Its content's hash (any stable digest). */
  hash: string;
}

/** Sorted, one entry per address. */
export function precacheList(files: PrecacheFile[]): PrecacheFile[] {
  const byPath = new Map(files.map((file) => [file.path, file]));
  return [...byPath.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** The cache version: changes when any kept file, the list itself or the worker's own code changes. */
export function precacheVersion(files: PrecacheFile[], worker: string): string {
  const hash = createHash("sha256");
  hash.update(worker);
  for (const file of precacheList(files)) hash.update(`\n${file.path}\0${file.hash}`);
  return hash.digest("hex").slice(0, 16);
}

/** The two lines in public/sw.js that the build fills in (left as they are, the worker does nothing). */
const VERSION_LINE = /^const VERSION = "dev";.*$/m;
const PRECACHE_LINE = /^const PRECACHE = \[\];.*$/m;

/** public/sw.js with its version and precache list written in. Throws if the template's two lines aren't there. */
export function fillWorker(template: string, version: string, paths: string[]): string {
  for (const [name, line] of [["VERSION", VERSION_LINE], ["PRECACHE", PRECACHE_LINE]] as const) {
    const found = template.match(new RegExp(line.source, "gm"))?.length ?? 0;
    if (found !== 1) throw new Error(`sw.js: expected one "const ${name}" line to fill in, found ${found}`);
  }
  if (!/^[0-9a-f]{8,64}$/.test(version)) throw new Error(`sw.js: bad version ${JSON.stringify(version)}`);
  return template
    .replace(VERSION_LINE, `const VERSION = ${JSON.stringify(version)};`)
    .replace(PRECACHE_LINE, `const PRECACHE = ${JSON.stringify(paths)};`);
}
