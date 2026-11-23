import { describe, expect, it } from "vitest";
import { GTM_CONTAINER, META_DESCRIPTION, PRODUCTION_URL, TITLE, gtmId, robotsFor, siteUrl, sitemapFor } from "./site";

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
      sitemap: `${PRODUCTION_URL}/sitemap.xml`,
    });
  });
});

describe("gtmId (VISION D22)", () => {
  it("gives the owner's container in production only", () => {
    expect(gtmId({ VERCEL_ENV: "production" })).toBe(GTM_CONTAINER);
    expect(gtmId({ VERCEL_ENV: "preview" })).toBeUndefined();
    expect(gtmId({})).toBeUndefined();
  });
});

describe("sitemapFor", () => {
  it("lists the public pages at the production address in production", () => {
    const entries = sitemapFor({ VERCEL_ENV: "production" });
    expect(entries.map((e) => e.url.slice(PRODUCTION_URL.length))).toEqual([
      "/", "/te", "/hi", "/ta", "/kn", "/ml", "/mr", "/gu", "/bn", "/pa",
      "/templates", "/guide",
      "/biodata-format/hindu", "/biodata-format/muslim", "/biodata-format/christian", "/biodata-format/sikh", "/biodata-format/jain",
      "/help", "/privacy",
    ]);
    // The home page and each language page list all eleven hreflang alternates.
    expect(Object.keys(entries[0].alternates!.languages!)).toHaveLength(11);
    expect(entries[1].alternates!.languages!).toMatchObject({ te: `${PRODUCTION_URL}/te`, "x-default": `${PRODUCTION_URL}/` });
  });

  it("is empty elsewhere", () => {
    expect(sitemapFor({ VERCEL_ENV: "preview" })).toEqual([]);
  });
});
