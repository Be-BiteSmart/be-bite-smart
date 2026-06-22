import { test } from "@playwright/test";
import { SEO_CHECK_PAGES } from "../helpers/paths.js";
import { gotoExpectOk } from "../helpers/page.js";
import {
  assertPageSeo,
  assertRobotsTxt,
  assertSitemap,
} from "../helpers/seo.js";

test.describe("SEO essentials", () => {
  for (const { path, label } of SEO_CHECK_PAGES) {
    test(`${label} (${path}) has title, canonical, and meta description`, async ({
      page,
    }, testInfo) => {
      const baseURL =
        testInfo.project.use?.baseURL ?? "https://www.bebitesmart.org";

      await gotoExpectOk(page, path);

      const seo = await assertPageSeo(page, { path, label, baseURL });

      await testInfo.attach(`${label} SEO`, {
        body: JSON.stringify(seo, null, 2),
        contentType: "application/json",
      });
    });
  }

  test("robots.txt is reachable", async ({ request }, testInfo) => {
    const robots = await assertRobotsTxt(request);

    await testInfo.attach("robots.txt", {
      body: robots.body,
      contentType: "text/plain",
    });

    if (robots.sitemapUrls.length === 0) {
      await testInfo.attach("robots.txt note", {
        body:
          "No Sitemap: directive found. Sitemap is still checked separately; add Sitemap: to robots.txt in All in One SEO if desired.",
        contentType: "text/plain",
      });
    }
  });

  test("XML sitemap is reachable", async ({ request }, testInfo) => {
    const sitemap = await assertSitemap(request);

    await testInfo.attach("sitemap", {
      body: sitemap.body.slice(0, 4000),
      contentType: "application/xml",
    });
  });
});
