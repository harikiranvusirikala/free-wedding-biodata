import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fillWorker } from "./sw-precache";

// public/sw.js (Step 5.2, BUILD_PLAN A6) run against a fake CacheStorage and network: what it answers, what it keeps,
// and how a new deployment replaces an old one without breaking an editor that is already open.

const TEMPLATE = readFileSync("public/sw.js", "utf8");
const ORIGIN = "https://free-wedding-biodata.vercel.app";

/** A response as the browser gives a same-origin fetch ("basic"). */
function basic(body: string, status = 200): Response {
  const response = new Response(body, { status });
  Object.defineProperty(response, "type", { value: "basic" });
  return response;
}

const href = (input: string | { url: string }) => new URL(typeof input === "string" ? input : input.url, ORIGIN);

class FakeCache {
  entries = new Map<string, Response>();
  async match(input: string | { url: string }, options?: { ignoreSearch?: boolean }) {
    const want = href(input);
    for (const [key, response] of this.entries) {
      const have = new URL(key);
      if (options?.ignoreSearch ? have.origin + have.pathname === want.origin + want.pathname : have.href === want.href) return response.clone();
    }
    return undefined;
  }
  async put(input: string | { url: string }, response: Response) {
    this.entries.set(href(input).href, response.clone());
  }
  paths() {
    return [...this.entries.keys()].map((key) => new URL(key).pathname + new URL(key).search);
  }
}

class FakeCaches {
  stores = new Map<string, FakeCache>();
  async open(name: string) {
    if (!this.stores.has(name)) this.stores.set(name, new FakeCache());
    return this.stores.get(name)!;
  }
  async keys() {
    return [...this.stores.keys()];
  }
  async delete(name: string) {
    return this.stores.delete(name);
  }
}

/** The site's files on the "server": path → body. A missing path is a 404. */
type Site = Record<string, string>;

function network(site: Site, state: { offline: boolean; requests: { path: string; cache?: string }[] }) {
  return vi.fn(async (input: string | { url: string }, init?: { cache?: string }) => {
    const url = href(input);
    state.requests.push({ path: url.pathname + url.search, cache: init?.cache });
    if (state.offline) throw new TypeError("Failed to fetch");
    const body = site[url.pathname];
    return body === undefined ? basic("not found", 404) : basic(body);
  });
}

interface Worker {
  listeners: Record<string, (event: unknown) => void>;
  self: { skipWaiting: ReturnType<typeof vi.fn>; clients: { claim: ReturnType<typeof vi.fn> }; registration: { unregister: ReturnType<typeof vi.fn> } };
  pageKey: (path: string) => string;
  strategyFor: (request: FakeRequest, origin: string) => string | null;
  CACHE: string;
}

interface FakeRequest {
  url: string;
  method: string;
  mode: string;
  headers: Headers;
}

/** Runs sw.js as a browser would, with `version` and `precache` filled in (or the unfilled template). */
function startWorker(caches: FakeCaches, fetch: ReturnType<typeof network>, filled?: { version: string; precache: string[] }): Worker {
  const source = filled ? fillWorker(TEMPLATE, filled.version, filled.precache) : TEMPLATE;
  const listeners: Worker["listeners"] = {};
  const self = {
    location: new URL(ORIGIN),
    addEventListener: (type: string, listener: (event: unknown) => void) => (listeners[type] = listener),
    skipWaiting: vi.fn(async () => {}),
    clients: { claim: vi.fn(async () => {}) },
    registration: { unregister: vi.fn(async () => true) },
  };
  const run = new Function("self", "caches", "fetch", "setTimeout", `${source}\nreturn { pageKey, strategyFor, CACHE };`);
  const later = (callback: () => void, ms: number) => setTimeout(callback, ms); // looked up per call, so fake timers apply
  return { listeners, self, ...run(self, caches, fetch, later) };
}

async function lifecycle(worker: Worker, type: "install" | "activate") {
  let done: Promise<unknown> = Promise.resolve();
  worker.listeners[type]?.({ waitUntil: (promise: Promise<unknown>) => (done = promise) });
  await done;
}

function request(path: string, { mode = "no-cors", method = "GET", headers = {} as Record<string, string> } = {}): FakeRequest {
  return { url: new URL(path, ORIGIN).href, method, mode, headers: new Headers(headers) };
}

/** What the worker answers, or undefined when it leaves the request to the browser. */
async function answer(worker: Worker, req: FakeRequest): Promise<Response | undefined> {
  let response: Promise<Response> | undefined;
  worker.listeners.fetch({ request: req, respondWith: (promise: Promise<Response>) => (response = promise) });
  return response && (await response);
}

const V1 = { version: "1111111111111111", precache: ["/", "/editor", "/_next/static/chunks/a.js", "/_next/static/media/hb.wasm", "/fonts/NotoSans-Regular.ttf", "/manifest.webmanifest"] };
const SITE_V1: Site = {
  "/": "home v1",
  "/editor": "editor v1",
  "/_next/static/chunks/a.js": "a",
  "/_next/static/media/hb.wasm": "wasm",
  "/fonts/NotoSans-Regular.ttf": "font",
  "/manifest.webmanifest": "{}",
};

function setup(site: Site = SITE_V1) {
  const caches = new FakeCaches();
  const state = { offline: false, requests: [] as { path: string; cache?: string }[] };
  const fetch = network(site, state);
  return { caches, state, fetch };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("which requests the worker answers", () => {
  const { caches, fetch } = setup();
  const worker = startWorker(caches, fetch, V1);
  const strategy = (req: FakeRequest) => worker.strategyFor(req, ORIGIN);

  it("treats /editor, /editor.html and /editor/ as one page, ignoring the address's draft id", () => {
    expect(worker.pageKey("/editor")).toBe("/editor");
    expect(worker.pageKey("/editor.html")).toBe("/editor");
    expect(worker.pageKey("/editor/")).toBe("/editor");
    expect(worker.pageKey("/index.html")).toBe("/");
    expect(worker.pageKey("/")).toBe("/");
    expect(strategy(request("/editor?d=4f1c", { mode: "navigate" }))).toBe("page");
    expect(strategy(request("/editor.html", { mode: "navigate" }))).toBe("page");
    expect(strategy(request("/", { mode: "navigate" }))).toBe("page");
  });

  it("answers the site's static files from the cache", () => {
    expect(strategy(request("/_next/static/chunks/a.js"))).toBe("static");
    expect(strategy(request("/_next/static/chunks/from-a-newer-deployment.js"))).toBe("static");
    expect(strategy(request("/fonts/NotoSans-Regular.ttf"))).toBe("static");
    expect(strategy(request("/manifest.webmanifest"))).toBe("static");
  });

  it("leaves everything else to the browser: other sites, /dev, pages not kept, writes, partial requests, the worker itself", () => {
    expect(strategy(request("https://www.googletagmanager.com/gtm.js?id=GTM-TEST"))).toBeNull();
    expect(strategy(request("https://www.google-analytics.com/g/collect?v=2", { method: "POST" }))).toBeNull();
    expect(strategy(request("/dev/pdf", { mode: "navigate" }))).toBeNull();
    expect(strategy(request("/dev", { mode: "navigate" }))).toBeNull();
    expect(strategy(request("/privacy", { mode: "navigate" }))).toBeNull(); // not in this list
    expect(strategy(request("/editor", { method: "POST", mode: "navigate" }))).toBeNull();
    expect(strategy(request("/_next/static/media/hb.wasm", { headers: { range: "bytes=0-99" } }))).toBeNull();
    expect(strategy(request("/sw.js"))).toBeNull();
    expect(strategy(request("/robots.txt"))).toBeNull();
    expect(strategy(request("/editor.txt?_rsc=1"))).toBeNull();
  });

  it("doesn't touch a request to another site at all (Google Tag Manager is never cached or passed through)", async () => {
    expect(await answer(worker, request("https://www.googletagmanager.com/gtm.js?id=GTM-TEST"))).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("installing", () => {
  it("keeps every listed file, asks the server again for names that don't change with their content, then takes over", async () => {
    const { caches, state, fetch } = setup();
    const worker = startWorker(caches, fetch, V1);
    await lifecycle(worker, "install");
    expect(worker.CACHE).toBe("fwb-1111111111111111");
    expect((await caches.open(worker.CACHE)).paths().sort()).toEqual([...V1.precache].sort());
    const modes = Object.fromEntries(state.requests.map((r) => [r.path, r.cache]));
    expect(modes["/editor"]).toBe("no-cache");
    expect(modes["/fonts/NotoSans-Regular.ttf"]).toBe("no-cache");
    expect(modes["/_next/static/chunks/a.js"]).toBe("default");
    expect(worker.self.skipWaiting).toHaveBeenCalled();
  });

  it("doesn't install when a file can't be fetched, so it never claims a half-kept app", async () => {
    const { caches, fetch } = setup({ ...SITE_V1, "/_next/static/media/hb.wasm": undefined as unknown as string });
    const worker = startWorker(caches, fetch, V1);
    await expect(lifecycle(worker, "install")).rejects.toThrow(/hb\.wasm: HTTP 404/);
    expect(worker.self.skipWaiting).not.toHaveBeenCalled();
  });

  it("activates by claiming the open pages", async () => {
    const { caches, fetch } = setup();
    const worker = startWorker(caches, fetch, V1);
    await lifecycle(worker, "install");
    await lifecycle(worker, "activate");
    expect(worker.self.clients.claim).toHaveBeenCalled();
  });
});

describe("a new deployment", () => {
  const V2 = { version: "2222222222222222", precache: ["/", "/editor", "/_next/static/chunks/a.js", "/_next/static/chunks/b.js", "/_next/static/media/hb.wasm", "/fonts/NotoSans-Regular.ttf", "/manifest.webmanifest"] };
  const SITE_V2: Site = { ...SITE_V1, "/": "home v2", "/editor": "editor v2", "/_next/static/chunks/b.js": "b" };
  const V3 = { version: "3333333333333333", precache: ["/editor", "/_next/static/chunks/c.js"] };
  const SITE_V3: Site = { "/editor": "editor v3", "/_next/static/chunks/c.js": "c" };

  async function deploy(caches: FakeCaches, site: Site, filled: { version: string; precache: string[] }) {
    const state = { offline: false, requests: [] as { path: string; cache?: string }[] };
    const worker = startWorker(caches, network(site, state), filled);
    await lifecycle(worker, "install");
    await lifecycle(worker, "activate");
    return { worker, state };
  }

  it("fetches only what changed: unchanged hashed files are copied from the kept version", async () => {
    const caches = new FakeCaches();
    await deploy(caches, SITE_V1, V1);
    const { state } = await deploy(caches, SITE_V2, V2);
    const fetched = state.requests.map((r) => r.path);
    expect(fetched).toContain("/_next/static/chunks/b.js");
    expect(fetched).not.toContain("/_next/static/chunks/a.js");
    expect(fetched).not.toContain("/_next/static/media/hb.wasm");
    expect(fetched).toContain("/editor"); // pages, fonts and icons are always checked with the server
    expect(fetched).toContain("/fonts/NotoSans-Regular.ttf");
  });

  it("keeps the previous version's cache for editors still open on it, and deletes the one before", async () => {
    const caches = new FakeCaches();
    await deploy(caches, SITE_V1, V1);
    await deploy(caches, SITE_V2, V2);
    expect((await caches.keys()).sort()).toEqual(["fwb-1111111111111111", "fwb-2222222222222222", "fwb-meta"]);
    await deploy(caches, SITE_V3, V3);
    expect((await caches.keys()).sort()).toEqual(["fwb-2222222222222222", "fwb-3333333333333333", "fwb-meta"]);
  });

  it("serves an editor opened before the update its own files, even offline, after the new worker took over", async () => {
    const caches = new FakeCaches();
    await deploy(caches, SITE_V1, V1);
    await deploy(caches, SITE_V2, V2);
    const { worker, state } = await deploy(caches, SITE_V3, V3);
    state.offline = true;
    // Opened under v2, the editor now loads the PDF engine (b.js, the wasm): both come from v2's kept cache.
    expect(await (await answer(worker, request("/_next/static/chunks/b.js")))!.text()).toBe("b");
    expect(await (await answer(worker, request("/_next/static/media/hb.wasm")))!.text()).toBe("wasm");
    // A reload gets the new version's page.
    expect(await (await answer(worker, request("/editor?d=abc", { mode: "navigate" })))!.text()).toBe("editor v3");
  });

  it("deletes caches left by an install that never finished", async () => {
    const caches = new FakeCaches();
    await (await caches.open("fwb-9999999999999999")).put("/editor", basic("half"));
    await deploy(caches, SITE_V1, V1);
    expect(await caches.keys()).not.toContain("fwb-9999999999999999");
  });

  it("a build without the list (the unfilled template) answers nothing, deletes every kept cache and unregisters", async () => {
    const caches = new FakeCaches();
    await deploy(caches, SITE_V1, V1);
    const { fetch } = setup();
    const worker = startWorker(caches, fetch);
    expect(worker.listeners.fetch).toBeUndefined();
    await lifecycle(worker, "install");
    expect(worker.self.skipWaiting).toHaveBeenCalled();
    await lifecycle(worker, "activate");
    expect(await caches.keys()).toEqual([]);
    expect(worker.self.registration.unregister).toHaveBeenCalled();
    expect(worker.strategyFor(request("/editor", { mode: "navigate" }), ORIGIN)).toBeNull();
  });
});

describe("answering", () => {
  async function installed(site: Site = SITE_V1) {
    const env = setup(site);
    const worker = startWorker(env.caches, env.fetch, V1);
    await lifecycle(worker, "install");
    await lifecycle(worker, "activate");
    env.state.requests.length = 0;
    return { ...env, worker };
  }

  it("serves static files from the cache without the network", async () => {
    const { worker, state } = await installed();
    state.offline = true;
    expect(await (await answer(worker, request("/fonts/NotoSans-Regular.ttf")))!.text()).toBe("font");
    expect(await (await answer(worker, request("/_next/static/chunks/a.js?dpl=x")))!.text()).toBe("a");
    expect(state.requests).toEqual([]);
  });

  it("fetches a static file it doesn't have and keeps it", async () => {
    const { worker, caches, state } = await installed({ ...SITE_V1, "/_next/static/chunks/new.js": "new" });
    expect(await (await answer(worker, request("/_next/static/chunks/new.js")))!.text()).toBe("new");
    expect((await caches.open(worker.CACHE)).paths()).toContain("/_next/static/chunks/new.js");
    state.offline = true;
    expect(await (await answer(worker, request("/_next/static/chunks/new.js")))!.text()).toBe("new");
  });

  it("gives an online visit the latest page, without replacing the copy kept with this version", async () => {
    const { worker, caches } = await installed({ ...SITE_V1 });
    const site = { ...SITE_V1, "/editor": "editor from a newer deployment" };
    const state = { offline: false, requests: [] as { path: string }[] };
    const online = startWorker(caches, network(site, state), V1);
    expect(await (await answer(online, request("/editor?d=abc", { mode: "navigate" })))!.text()).toBe("editor from a newer deployment");
    expect(await (await (await caches.open(worker.CACHE)).match("/editor"))!.text()).toBe("editor v1");
  });

  it("gives the kept page offline, on a server error, and when the network is too slow", async () => {
    const { worker, state, caches } = await installed();
    state.offline = true;
    expect(await (await answer(worker, request("/editor?d=abc", { mode: "navigate" })))!.text()).toBe("editor v1");

    const failing = startWorker(caches, vi.fn(async () => basic("oops", 503)) as never, V1);
    expect(await (await answer(failing, request("/editor", { mode: "navigate" })))!.text()).toBe("editor v1");

    vi.useFakeTimers();
    const hanging = startWorker(caches, vi.fn(() => new Promise<Response>(() => {})) as never, V1);
    const pending = answer(hanging, request("/editor", { mode: "navigate" }));
    await vi.advanceTimersByTimeAsync(3000);
    expect(await (await pending)!.text()).toBe("editor v1");
  });

  it("never keeps anything about a person: the draft id in the address is not in the cache", async () => {
    const { worker, caches } = await installed();
    await answer(worker, request("/editor?d=7c0e2b1a-draft", { mode: "navigate" }));
    for (const name of await caches.keys()) {
      for (const path of (await caches.open(name)).paths()) expect(path).not.toContain("7c0e2b1a");
    }
  });
});
