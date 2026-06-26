import { test } from "@playwright/test";
import { A11Y_CHECK_PAGES, A11Y_PAGE_READY_SELECTORS } from "../helpers/paths.js";
import { gotoExpectOk, waitForA11yPageReady } from "../helpers/page.js";
import { expectNoBlockingA11yViolations } from "./helpers/axe.js";

test.describe("Accessibility (axe)", () => {
  for (const { path, label } of A11Y_CHECK_PAGES) {
    test(`${label} (${path}) — WCAG 2.x A/AA + best-practice, moderate+`, async ({
      page,
    }, testInfo) => {
      await gotoExpectOk(page, path);
      await page.waitForLoadState("load");
      await waitForA11yPageReady(page, path, A11Y_PAGE_READY_SELECTORS);

      const baseURL =
        testInfo.project.use?.baseURL ?? "https://staging.bebitesmart.org";
      const url = new URL(path, baseURL).href;
      const report = await expectNoBlockingA11yViolations(page, label, {
        label,
        path,
        url,
      });

      await testInfo.attach(`${label} — what was checked`, {
        body: report.text,
        contentType: "text/plain",
      });
      await testInfo.attach(`${label} — scan details (JSON)`, {
        body: JSON.stringify(report.json, null, 2),
        contentType: "application/json",
      });
    });
  }
});
