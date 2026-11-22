import { defineConfig, devices } from "@playwright/test";

const PORT = 3100; // separate from `npm run dev` on 3000
const isCI = !!process.env.CI;
const channel = isCI ? undefined : "chrome"; // the installed Chrome locally; CI installs Playwright's Chromium

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    reducedMotion: "reduce",
    // The production build registers the offline worker (public/sw.js). Specs stub files with page.route, which a
    // worker would bypass, and each must load the build fresh: only e2e/offline.spec.ts allows it.
    serviceWorkers: "block",
  },
  projects: [
    { name: "phone", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium", channel } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel } },
  ],
  webServer: {
    // The static export, served the way Vercel serves it (BUILD_PLAN Step 0.1).
    command: `npm run build && npm run serve -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    env: { ENABLE_DEV_PAGES: "1" }, // /dev/* pages are a 404 without it
    timeout: 180_000,
  },
});
