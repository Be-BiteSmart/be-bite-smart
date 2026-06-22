import { test, expect } from "@playwright/test";
import { DOWNLOAD_FILE_PAGES } from "../helpers/paths.js";
import { gotoExpectOk } from "../helpers/page.js";
import {
  assertDownloadResponse,
  collectDownloadLinks,
} from "../helpers/downloads.js";

test.describe("Download URLs return files", () => {
  for (const { path, label, checks } of DOWNLOAD_FILE_PAGES) {
    test(`${label} (${path}) download links return real files`, async ({
      page,
      request,
      baseURL,
    }, testInfo) => {
      test.setTimeout(120_000);
      await gotoExpectOk(page, path);

      const results = [];

      for (const { name, selector, expectedMimePrefixes, minCount } of checks) {
        const links = await collectDownloadLinks(page, selector);

        expect(
          links.length,
          `${label}: expected at least ${minCount} ${name} via ${selector}, found ${links.length}`,
        ).toBeGreaterThanOrEqual(minCount);

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

      await testInfo.attach(`${label} download checks`, {
        body: JSON.stringify(results, null, 2),
        contentType: "application/json",
      });

      expect(results.length).toBeGreaterThan(0);
    });
  }
});
