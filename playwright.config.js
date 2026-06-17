// playwright.config.js
import { defineConfig } from "@playwright/test";

const htmlReporter = [
  "html",
  { open: "never", outputFolder: "playwright-report" },
];

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["github"], ["list"], htmlReporter]
    : [["list"], htmlReporter],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "https://www.bebitesmart.org",
    headless: true,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
});
