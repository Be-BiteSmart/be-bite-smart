// playwright.config.js
import { defineConfig } from "@playwright/test";

const htmlReporter = [
  "html",
  { open: "never", outputFolder: "playwright-report" },
];





export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["github"], ["list"], htmlReporter]
    : [["list"], htmlReporter],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? process.env.BASE_URL ?? "https://www.bebitesmart.org",
    headless: true,
    // Local by Flywheel serves https://bebitesmart.local over a self-signed
    // cert. The browser context (page.goto(), used by axe.spec.js/
    // blocks.spec.js) never seemed to hit this, but the separate `request`
    // API context (seo.spec.js, links.spec.js, downloads.spec.js — anywhere
    // checking an absolute URL) does the moment it touches one, since
    // WordPress always emits absolute URLs at its configured home_url()
    // scheme (https) regardless of which scheme the current request came in
    // on. A no-op against staging/production, which have real certs.
    ignoreHTTPSErrors: true,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    // Use Basic Auth for staging
    httpCredentials: (process.env.PLAYWRIGHT_BASE_URL ?? process.env.BASE_URL ?? "").includes("staging.")
      ? {
          username: process.env.STAGING_AUTH_USER ?? "",
          password: process.env.STAGING_AUTH_PASS ?? "",
        }
      : undefined,
  },
});
