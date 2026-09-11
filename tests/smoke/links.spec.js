import { test, expect } from "@playwright/test";
import { LINK_CHECK_PAGES } from "../helpers/paths.js";
import { gotoExpectOk } from "../helpers/page.js";
import {
  checkLinkStatus,
  collectInternalLinks,
  isBrokenLinkStatus,
} from "../helpers/links.js";
import { isLocalHttpWorkaround } from "../helpers/host.js";

test.describe("Internal links", () => {
  for (const { path, label, maxLinks } of LINK_CHECK_PAGES) {
    test(`${label} (${path}) has no broken same-origin links`, async ({
      page,
      request,
      baseURL,
    }, testInfo) => {
      test.setTimeout(120_000);
     
     await gotoExpectOk(page, path);

      const origin = new URL(baseURL).origin;
      const links = await collectInternalLinks(page, { origin, maxLinks });

      await testInfo.attach(`${label} links checked`, {
        body: JSON.stringify({ count: links.length, links }, null, 2),
        contentType: "application/json",
      });

      // Skipped before fetching anything, not just when zero links are
      // found: WordPress force-redirects http:// to https:// site-wide, so
      // even a same-origin http:// link hits the self-signed cert the
      // moment checkLinkStatus() actually fetches it (a page whose nav is
      // entirely absolute https:// hrefs, e.g. Home's header logo, hits
      // the zero-links case instead — same root cause either way). Not a
      // real broken-link signal under the documented local http://
      // convention (testing.md); still fails as normal against staging/
      // production, which have real certs and no scheme mismatch.
      if (isLocalHttpWorkaround(baseURL)) {
        test.skip(
          true,
          `${label}: link checks skipped — WordPress force-redirects http:// to https:// site-wide, so fetching even a same-origin link hits a self-signed-cert wall while testing locally via http:// (not a real broken link)`,
        );
      }

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
