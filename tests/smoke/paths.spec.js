import { test } from "@playwright/test";
import { CRITICAL_PAGES } from "../helpers/paths.js";
import { assertCriticalDom, gotoExpectOk } from "../helpers/page.js";

test.describe("Critical pages smoke", () => {
  for (const { path, label } of CRITICAL_PAGES) {
    test(`${label} (${path}) returns 200 and has core layout`, async ({ page }, testInfo) => {
      const baseURL = testInfo.project.use?.baseURL ?? "https://www.bebitesmart.org";
      await gotoExpectOk(page, path, baseURL);
      await assertCriticalDom(page, label);
    });
  }
});
