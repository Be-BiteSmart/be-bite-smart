import { test } from "@playwright/test";
import { A11Y_CHECK_PAGES } from "../helpers/paths.js";
import { gotoExpectOk } from "../helpers/page.js";
import { expectNoBlockingA11yViolations } from "./helpers/axe.js";

test.describe("Accessibility (axe)", () => {
  for (const { path, label } of A11Y_CHECK_PAGES) {
    test(`${label} (${path}) — WCAG 2.x A/AA + best-practice, moderate+`, async ({
      page,
      baseURL,
    }, testInfo) => {
      await gotoExpectOk(page, path);
      await page.waitForLoadState("load");

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
