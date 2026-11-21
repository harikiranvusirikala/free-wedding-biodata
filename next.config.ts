import type { NextConfig } from "next";

// A static site (BUILD_PLAN A1): `next build` writes plain files to out/, so nothing runs on a server and a
// biodata never leaves the browser. Headers (security, CSP) live in vercel.json, since a static export has none.
const nextConfig: NextConfig = {
  output: "export",
  poweredByHeader: false,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
