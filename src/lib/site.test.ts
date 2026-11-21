import { describe, expect, it } from "vitest";
import { META_DESCRIPTION, PRODUCTION_URL, TITLE, robotsFor, siteUrl } from "./site";

describe("site identity", () => {
  it("keeps the meta description within what search engines show", () => {
    expect(META_DESCRIPTION.length).toBeLessThanOrEqual(160);
  });

  it("keeps the title within what search results show", () => {
    expect(TITLE.length).toBeLessThanOrEqual(60);
  });
});

describe("siteUrl", () => {
  it("uses the production address in production, whatever the deployment host", () => {
    expect(siteUrl({ VERCEL_ENV: "production", VERCEL_URL: "x-123.vercel.app" })).toBe(PRODUCTION_URL);
  });

  it("uses the preview deployment's host on a preview", () => {
    expect(siteUrl({ VERCEL_ENV: "preview", VERCEL_URL: "free-wedding-biodata-git-x.vercel.app/" })).toBe(
      "https://free-wedding-biodata-git-x.vercel.app",
    );
  });

  it("falls back to localhost for a local build", () => {
    expect(siteUrl({})).toBe("http://localhost:3000");
  });
});

describe("robotsFor", () => {
  it("asks search engines to stay away outside production", () => {
    expect(robotsFor({ VERCEL_ENV: "preview" })).toEqual({ rules: { userAgent: "*", disallow: "/" } });
    expect(robotsFor({})).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });

  it("keeps the editor and dev pages out of search results in production", () => {
    expect(robotsFor({ VERCEL_ENV: "production" })).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: ["/editor", "/dev/"] },
    });
  });
});
