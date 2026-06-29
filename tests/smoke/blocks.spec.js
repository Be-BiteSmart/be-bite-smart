import { test, expect } from "@playwright/test";
import { BLOCK_PRESENCE_PAGES } from "../helpers/paths.js";
import { gotoExpectOk } from "../helpers/page.js";

test.describe("Critical block presence", () => {
  for (const { path, label, checks } of BLOCK_PRESENCE_PAGES) {
    test(`${label} (${path}) has expected content blocks`, async ({
      page,
    }, testInfo) => {
      const baseURL = testInfo.project.use?.baseURL ?? "https://www.bebitesmart.org";
      await gotoExpectOk(page, path, baseURL);

      const results = [];

      for (const { name, selector, minCount } of checks) {
        const locator = page.locator(selector);
        const count = await locator.count();

        results.push({ name, selector, minCount, count });

        expect(
          count,
          `${label}: expected at least ${minCount} ${name} via ${selector}, found ${count}`,
        ).toBeGreaterThanOrEqual(minCount);
      }

      await testInfo.attach(`${label} block presence`, {
        body: JSON.stringify(results, null, 2),
        contentType: "application/json",
      });
    });
  }
});
