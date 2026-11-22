// After `next build` (npm run build runs it): writes the offline list and version into out/sw.js (BUILD_PLAN A6,
// Step 5.2). public/sw.js is the template; Next copies it to out/ as it is, and this fills in its two lines from
// the files actually exported, so the hashed _next/static names are always the real ones. Fails the build if the
// worker or a listed file is missing, rather than shipping a worker that can't work offline.
import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fillWorker, precacheList, precachePath, precacheVersion, type PrecacheFile } from "../src/lib/sw-precache";

const OUT = resolve("out");

async function filesIn(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => (entry.isDirectory() ? filesIn(join(dir, entry.name)) : [join(dir, entry.name)])));
  return nested.flat();
}

await stat(join(OUT, "sw.js")); // the export ran (and copied public/); throws if not
const template = await readFile(resolve("public/sw.js"), "utf8"); // the same bytes, so running this twice is fine
const kept: PrecacheFile[] = [];
for (const file of await filesIn(OUT)) {
  const path = precachePath(relative(OUT, file));
  if (path) kept.push({ path, hash: createHash("sha256").update(await readFile(file)).digest("hex") });
}
const list = precacheList(kept);
for (const needed of ["/editor", "/manifest.webmanifest", "/fonts/NotoSans-Regular.ttf"]) {
  if (!list.some((file) => file.path === needed)) throw new Error(`sw-build: ${needed} is missing from out/`);
}
if (!list.some((file) => file.path.endsWith(".wasm"))) throw new Error("sw-build: the PDF engine's WebAssembly is missing from out/");

const version = precacheVersion(list, template);
await writeFile(join(OUT, "sw.js"), fillWorker(template, version, list.map((file) => file.path)));
console.log(`sw-build: out/sw.js version ${version}, ${list.length} files kept for offline use`);
