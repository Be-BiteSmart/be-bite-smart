// playwright.config.js
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/analytics",
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "https://bebitesmart.org",
    headless: true,
  },
});
