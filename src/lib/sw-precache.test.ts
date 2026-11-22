import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fillWorker, precacheList, precachePath, precacheVersion } from "./sw-precache";

const TEMPLATE = readFileSync("public/sw.js", "utf8");

describe("precachePath", () => {
  it.each([
    ["editor.html", "/editor"],
    ["index.html", "/"],
    ["help.html", "/help"],
    ["privacy.html", "/privacy"],
    ["templates/classic-gold.html", "/templates/classic-gold"],
    ["guide/index.html", "/guide"],
    ["_next/static/chunks/0abc.js", "/_next/static/chunks/0abc.js"],
    ["_next/static/chunks/05ky.css", "/_next/static/chunks/05ky.css"],
    ["_next/static/media/harfbuzz.2im_fd.wasm", "/_next/static/media/harfbuzz.2im_fd.wasm"],
    ["_next/static/media/ganesha.1c4c.png", "/_next/static/media/ganesha.1c4c.png"],
    ["fonts/NotoSansTelugu-Bold.ttf", "/fonts/NotoSansTelugu-Bold.ttf"],
    ["icons/icon-192.png", "/icons/icon-192.png"],
    ["brand/app-icon.svg", "/brand/app-icon.svg"],
    ["favicon.ico", "/favicon.ico"],
    ["manifest.webmanifest", "/manifest.webmanifest"],
  ])("keeps %s as %s", (file, path) => {
    expect(precachePath(file)).toBe(path);
  });

  it.each([
    "dev/pdf.html", // dev-only pages are never kept
    "dev/motifs/__next._full.txt",
    "404.html",
    "_not-found.html",
    "editor.txt", // the router's data files: every link into the editor is a full page load
    "__next._tree.txt",
    "robots.txt",
    "sitemap.xml",
    "opengraph-image.png", // link previews, read by other sites, not by the app
    "fonts/OFL.txt",
    "sw.js", // the worker itself is never in its own cache
    "_next/static/chunks/0abc.js.map",
    "../secret.html",
    "",
  ])("leaves out %s", (file) => {
    expect(precachePath(file)).toBeNull();
  });

  it("reads Windows paths too", () => {
    expect(precachePath("_next\\static\\chunks\\a.js")).toBe("/_next/static/chunks/a.js");
  });
});

describe("precacheList and precacheVersion", () => {
  const files = [
    { path: "/fonts/NotoSans-Regular.ttf", hash: "f1" },
    { path: "/editor", hash: "e1" },
    { path: "/_next/static/chunks/a.js", hash: "a1" },
  ];

  it("sorts the list and keeps one entry per address", () => {
    expect(precacheList([...files, { path: "/editor", hash: "e1" }]).map((f) => f.path)).toEqual(["/_next/static/chunks/a.js", "/editor", "/fonts/NotoSans-Regular.ttf"]);
  });

  it("gives the same version for the same files in any order", () => {
    expect(precacheVersion(files, "worker")).toBe(precacheVersion([...files].reverse(), "worker"));
    expect(precacheVersion(files, "worker")).toMatch(/^[0-9a-f]{16}$/);
  });

  it("changes the version when a file, the list or the worker changes", () => {
    const base = precacheVersion(files, "worker");
    expect(precacheVersion([{ ...files[0], hash: "f2" }, files[1], files[2]], "worker")).not.toBe(base); // a font changed
    expect(precacheVersion(files.slice(1), "worker")).not.toBe(base); // a file left the list
    expect(precacheVersion([...files, { path: "/help", hash: "h1" }], "worker")).not.toBe(base);
    expect(precacheVersion(files, "worker 2")).not.toBe(base); // the worker's own code changed
  });
});

describe("fillWorker", () => {
  it("writes the version and the list into public/sw.js, and nothing else changes", () => {
    const filled = fillWorker(TEMPLATE, "0123456789abcdef", ["/editor", "/_next/static/chunks/a.js"]);
    expect(filled).toContain('const VERSION = "0123456789abcdef";');
    expect(filled).toContain('const PRECACHE = ["/editor","/_next/static/chunks/a.js"];');
    expect(filled).not.toContain('const VERSION = "dev"');
    const otherLines = (text: string) => text.split("\n").filter((line) => !/^const (VERSION|PRECACHE) =/.test(line));
    expect(otherLines(filled)).toEqual(otherLines(TEMPLATE));
  });

  it("refuses a template without exactly one line of each, and a bad version", () => {
    expect(() => fillWorker("const PRECACHE = [];\n", "0123456789abcdef", [])).toThrow(/VERSION/);
    expect(() => fillWorker(`${TEMPLATE}\nconst PRECACHE = [];\n`, "0123456789abcdef", [])).toThrow(/PRECACHE.*found 2/);
    expect(() => fillWorker(TEMPLATE, 'x"; alert(1); "', [])).toThrow(/bad version/);
  });
});
