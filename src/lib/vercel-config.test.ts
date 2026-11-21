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
});
