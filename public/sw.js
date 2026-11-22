// Free Wedding Biodata service worker: hand-written, no library, no code from anywhere else (BUILD_PLAN A6,
// Step 5.2). After one visit to the editor with a network, the editor opens, saves and downloads without one.
//
// The build fills in the two lines below (scripts/sw-build.mts, run by `npm run build` after `next build`): the
// list of the site's own pages and static files (scripts, styles, pictures, the PDF engine's WebAssembly, the Noto
// fonts, the icons) and a VERSION that is a hash of all of them and of this file. So every deployment that changes
// anything installs a new worker with a new cache, and the cache two versions back is deleted: nothing stays stale
// for ever. Left unfilled (VERSION "dev"), the worker answers nothing, deletes every cache it kept and unregisters.
//
// How it answers:
// - Pages (/editor and the other pages in the list): the network first, so an online visit gets the latest
//   deployment; the copy kept with this version when offline, after a network error, or when the network takes
//   longer than NAVIGATION_WAIT. The kept copy is only ever the one installed with this version, whose files are all
//   in the same cache, so an offline page never points at a file that isn't kept. The address's ?d=<draft id> is not
//   part of the key: the cache holds the same page every visitor gets.
// - Static files: the cache first (their names change with their content, or they are fonts and icons kept with
//   this version), then the network. A new deployment's worker takes over at once, so an editor that was open
//   before it may still ask for its own (older) files: they stay in the previous version's cache until the next
//   deployment, so an open editor keeps working, even offline, mid-session.
// - Everything else is not touched, as if there were no worker: other sites (Google Tag Manager on the public
//   pages is never cached or passed through here), /dev/*, anything but GET, partial (Range) requests.
//
// Nothing about a person is ever kept here: drafts and photos live only in IndexedDB, and pictures are blob:
// addresses, which never reach a service worker.

"use strict";

const VERSION = "dev"; // filled in by scripts/sw-build.mts
const PRECACHE = []; // filled in by scripts/sw-build.mts

const PREFIX = "fwb-";
const CACHE = PREFIX + VERSION;
/** Which version caches are kept, newest last, so the one before the current version survives an update. */
const META = PREFIX + "meta";
const HISTORY_KEY = "/__fwb/versions";
const KEEP_VERSIONS = 2;
const NAVIGATION_WAIT = 3000; // ms; on a slow connection, the kept page is shown after this long

/** Folders of static files (everything else in PRECACHE without a file extension is a page). */
const STATIC_FOLDERS = ["/_next/static/", "/fonts/", "/icons/", "/brand/"];
/** Files whose name changes whenever their content does: one copy serves every version. */
const IMMUTABLE_FOLDER = "/_next/static/";

const isStaticPath = (path) => STATIC_FOLDERS.some((folder) => path.startsWith(folder)) || /\.[a-z0-9]+$/i.test(path);
const PAGES = PRECACHE.filter((path) => !isStaticPath(path));
const FILES = new Set(PRECACHE.filter(isStaticPath));

/** The key a page is kept under: "/editor.html", "/editor/" and "/editor" are one page; "/index.html" is "/". */
function pageKey(pathname) {
  const path = pathname.replace(/\/index\.html$/, "/").replace(/\.html$/, "");
  return path.length > 1 ? path.replace(/\/+$/, "") : "/";
}

/** How a request is answered: "page", "static", or null (not ours: the browser goes to the network as usual). */
function strategyFor(request, origin) {
  if (VERSION === "dev" || request.method !== "GET") return null;
  const url = new URL(request.url);
  if (url.origin !== origin) return null;
  if (url.pathname === "/dev" || url.pathname.startsWith("/dev/")) return null;
  if (request.headers.has("range")) return null;
  if (request.mode === "navigate") return PAGES.includes(pageKey(url.pathname)) ? "page" : null;
  if (FILES.has(url.pathname) || STATIC_FOLDERS.some((folder) => url.pathname.startsWith(folder))) return "static";
  return null;
}

/** The version caches to keep after `current` activates: the newest `keep`, newest last. */
function keptVersions(history, current, keep) {
  const earlier = (Array.isArray(history) ? history : []).filter((name) => typeof name === "string" && name.startsWith(PREFIX) && name !== META && name !== current);
  return [...earlier, current].slice(-keep);
}

/** Our caches that aren't kept (an older version, or one whose install never finished). */
function cachesToDelete(names, kept) {
  return names.filter((name) => name.startsWith(PREFIX) && name !== META && !kept.includes(name));
}

/** Only a complete, ordinary answer from this site is worth keeping. */
function keepable(response) {
  return response.status === 200 && response.type === "basic" && !response.redirected;
}

if (VERSION === "dev") {
  // An unfilled worker (a build without the list) replaces whatever was there, deletes what it kept and removes
  // itself, so it leaves nothing behind and never claims to work offline.
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((names) => Promise.all(names.filter((name) => name.startsWith(PREFIX)).map((name) => caches.delete(name))))
        .then(() => self.registration.unregister()),
    );
  });
} else {
  self.addEventListener("install", (event) => {
    // A worker that couldn't keep every file doesn't install (the previous one, if any, stays in charge), so the
    // editor never claims to work offline with half its files.
    event.waitUntil(precache().then(() => self.skipWaiting()));
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(activate());
  });

  self.addEventListener("fetch", (event) => {
    const strategy = strategyFor(event.request, self.location.origin);
    if (strategy === "page") event.respondWith(page(event.request));
    else if (strategy === "static") event.respondWith(staticFile(event.request));
  });
}

/** Keeps every listed file in this version's cache, fetching only what no kept version already has. */
async function precache() {
  const cache = await caches.open(CACHE);
  const older = (await caches.keys()).filter((name) => name.startsWith(PREFIX) && name !== META && name !== CACHE);
  await Promise.all(
    PRECACHE.map(async (path) => {
      if (await cache.match(path)) return; // an earlier, unfinished install of this same version
      const immutable = path.startsWith(IMMUTABLE_FOLDER);
      if (immutable) {
        for (const name of older) {
          const found = await (await caches.open(name)).match(path);
          if (found) return cache.put(path, found);
        }
      }
      // Pages, fonts and icons keep their names across versions: ask the server whether they changed.
      const response = await fetch(path, { cache: immutable ? "default" : "no-cache", credentials: "same-origin" });
      if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
      await cache.put(path, response.redirected ? await withoutRedirect(response) : response);
    }),
  );
}

/** A page reached through a redirect can't answer a navigation as it is; its content can. */
async function withoutRedirect(response) {
  return new Response(await response.blob(), { status: response.status, statusText: response.statusText, headers: response.headers });
}

async function activate() {
  const meta = await caches.open(META);
  const stored = await meta.match(HISTORY_KEY);
  const history = stored ? await stored.json().catch(() => []) : [];
  const kept = keptVersions(history, CACHE, KEEP_VERSIONS);
  await meta.put(HISTORY_KEY, new Response(JSON.stringify(kept), { headers: { "content-type": "application/json" } }));
  const names = await caches.keys();
  await Promise.all(cachesToDelete(names, kept).map((name) => caches.delete(name)));
  await self.clients.claim();
}

/** A static file from this version's cache, else a kept earlier version's (an editor opened before an update), else the network. */
async function staticFile(request) {
  const cache = await caches.open(CACHE);
  const found = (await cache.match(request, { ignoreSearch: true })) ?? (await fromEarlierVersion(request));
  if (found) return found;
  const response = await fetch(request);
  if (keepable(response)) await cache.put(request, response.clone()).catch(() => {});
  return response;
}

async function fromEarlierVersion(request) {
  // At most the one version before this (activate keeps two), or the next one while it installs: either holds
  // the same bytes under the same name, since these names change with their content.
  const names = (await caches.keys()).filter((name) => name.startsWith(PREFIX) && name !== META && name !== CACHE);
  for (const name of names) {
    const found = await (await caches.open(name)).match(request, { ignoreSearch: true });
    if (found) return found;
  }
  return undefined;
}

/** The latest page when the network answers in time; this version's kept copy when it doesn't, fails or errs. */
async function page(request) {
  const found = await (await caches.open(CACHE)).match(pageKey(new URL(request.url).pathname));
  const network = fetch(request).then((response) => (found && response.status >= 500 ? found : response));
  if (!found) return network;
  const slow = new Promise((resolve) => setTimeout(() => resolve(found), NAVIGATION_WAIT));
  return Promise.race([network.catch(() => found), slow]);
}
