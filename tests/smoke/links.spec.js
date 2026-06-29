import { test, expect } from "@playwright/test";
import { LINK_CHECK_PAGES } from "../helpers/paths.js";
import { gotoExpectOk } from "../helpers/page.js";
import {
  checkLinkStatus,
  collectInternalLinks,
  isBrokenLinkStatus,
} from "../helpers/links.js";

test.describe("Internal links", () => {
  for (const { path, label, maxLinks } of LINK_CHECK_PAGES) {
    test(`${label} (${path}) has no broken same-origin links`, async ({
      page,
      request,
      baseURL,
    }, testInfo) => {
      test.setTimeout(120_000);
     
      await gotoExpectOk(page, path, baseURL);

      const origin = new URL(baseURL).origin;
      const links = await collectInternalLinks(page, { origin, maxLinks });

      await testInfo.attach(`${label} links checked`, {
        body: JSON.stringify({ count: links.length, links }, null, 2),
        contentType: "application/json",
      });

      expect(
        links.length,
        `${label} has no same-origin links to check`,
      ).toBeGreaterThan(0);

      const broken = [];

      for (const url of links) {
        const status = await checkLinkStatus(request, url);
        if (isBrokenLinkStatus(status)) {
          broken.push({ url, status });
        }
      }

      if (broken.length) {
        await testInfo.attach(`${label} broken links`, {
          body: JSON.stringify(broken, null, 2),
          contentType: "application/json",
        });
      }

      expect(
        broken,
        `${label}: ${broken.length} broken link(s) — see test attachments`,
      ).toEqual([]);
    });
  }
});
