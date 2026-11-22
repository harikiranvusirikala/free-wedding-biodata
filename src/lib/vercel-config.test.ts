import { describe, expect, it } from "vitest";
import config from "../../vercel.json";

// The privacy promise is enforced by the hosting headers (VISION D15, D22): the editor may talk only to this
// site; only the public pages may load Google Tag Manager.

type Rule = { source: string; headers: { key: string; value: string }[] };
const rules = config.headers as Rule[];

/** The CSP Vercel sends for `path` (the last matching rule wins), matching sources like Vercel's path patterns. */
function cspFor(path: string): string {
  const matching = rules.filter((rule) => new RegExp(`^${rule.source}$`).test(path));
  const values = matching.flatMap((rule) => rule.headers.filter((h) => h.key === "Content-Security-Policy"));
  expect(values, `exactly one CSP for ${path}`).toHaveLength(1);
  return values[0].value;
}

const directive = (csp: string, name: string) =>
  csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `));

describe("vercel.json security headers", () => {
  it.each(["/editor", "/editor.html", "/editor/"])("locks %s to this site only", (path) => {
    const csp = cspFor(path);
    expect(directive(csp, "connect-src")).toBe("connect-src 'self'");
    expect(csp).not.toContain("googletagmanager");
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
  });

  it.each(["/", "/privacy", "/templates", "/help"])("lets %s load Google Tag Manager", (path) => {
    const csp = cspFor(path);
    expect(directive(csp, "script-src")).toContain("https://www.googletagmanager.com");
    expect(directive(csp, "connect-src")).toContain("https://*.google-analytics.com");
  });

  it("sends the basic security headers on every path", () => {
    const all = rules.find((rule) => rule.source === "/(.*)");
    const keys = all?.headers.map((h) => h.key);
    expect(keys).toEqual(expect.arrayContaining(["X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "Cross-Origin-Opener-Policy"]));
  });

  // The offline worker (Step 5.2, BUILD_PLAN A6): browsers always ask for a fresh copy, and it can only ever talk
  // to this site (never Google Tag Manager, even though it is served next to the public pages).
  it("serves the service worker uncached and locked to this site", () => {
    const csp = cspFor("/sw.js");
    expect(directive(csp, "connect-src")).toBe("connect-src 'self'");
    expect(directive(csp, "script-src")).toBe("script-src 'self'");
    expect(csp).not.toContain("googletagmanager");
    const cacheControl = rules.filter((rule) => new RegExp(`^${rule.source}$`).test("/sw.js")).flatMap((rule) => rule.headers.filter((h) => h.key === "Cache-Control"));
    expect(cacheControl.map((h) => h.value)).toEqual(["no-cache"]);
  });

  it.each(["/sw", "/manifest.webmanifest", "/fonts/NotoSans-Regular.ttf"])("keeps the public pages' policy for %s", (path) => {
    expect(directive(cspFor(path), "script-src")).toContain("https://www.googletagmanager.com");
  });

  it("lets the editor register its worker and read its manifest", () => {
    const csp = cspFor("/editor");
    expect(directive(csp, "worker-src")).toContain("'self'");
    expect(directive(csp, "default-src")).toBe("default-src 'self'"); // manifest-src falls back to it
  });
});
