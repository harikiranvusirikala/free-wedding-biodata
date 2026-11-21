import type { NextConfig } from "next";

// A static site (BUILD_PLAN A1): `next build` writes plain files to out/, so nothing runs on a server and a
// biodata never leaves the browser. Headers (security, CSP) live in vercel.json, since a static export has none.
const nextConfig: NextConfig = {
  output: "export",
  poweredByHeader: false,
  images: { unoptimized: true },
  turbopack: {
    // harfbuzzjs (PDF text shaping) has a Node-only `await import("module")` that browsers never run; give the
    // bundler an empty stand-in so it can build the browser chunk.
    resolveAlias: { module: { browser: "./src/lib/empty-module.ts" } },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
