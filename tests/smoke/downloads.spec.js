import { test, expect } from "@playwright/test";
import { CRITICAL_PAGES, DOWNLOAD_SCAN_CHECKS } from "../helpers/paths.js";
import { gotoExpectOk } from "../helpers/page.js";
import {
  assertDownloadResponse,
  collectDownloadLinks,
} from "../helpers/downloads.js";

test.describe("Download URLs return files", () => {
  for (const { path, label } of CRITICAL_PAGES) {
    test(`${label} (${path}) download links return real files`, async ({
      page,
      request,
      baseURL,
    }, testInfo) => {
      test.setTimeout(120_000);
   
      await gotoExpectOk(page, path, baseURL);

      const results = [];

      for (const { name, selector, expectedMimePrefixes } of DOWNLOAD_SCAN_CHECKS) {
        const links = await collectDownloadLinks(page, selector);
        if (links.length === 0) {
          continue;
        }

        for (const link of links) {
          expect(
            link.href,
            `${label}: ${name} has a missing href`,
          ).not.toEqual("");

          const response = await assertDownloadResponse(request, link.href, {
            baseURL,
            expectedMimePrefixes,
            label: `${label} ${name}`,
          });

          results.push({
            name,
            selector,
            text: link.text,
            dataLang: link.dataLang,
            download: link.download,
            ...response,
          });
        }
      }

      if (results.length === 0) {
        test.skip(true, `No downloadable links on ${path}`);
      }

      await testInfo.attach(`${label} download checks`, {
        body: JSON.stringify(results, null, 2),
        contentType: "application/json",
      });

      expect(results.length).toBeGreaterThan(0);
    });
  }
});
