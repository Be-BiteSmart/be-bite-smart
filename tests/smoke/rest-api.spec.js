import { test, expect } from "@playwright/test";
import { REST_PAGE_SLUGS } from "../helpers/paths.js";

test.describe("WordPress REST API smoke", () => {
  test("GET /wp-json/ responds", async ({ request }) => {
    const baseURL = test.info().project.use.baseURL;
    let url = "/wp-json/";

    // If accessing staging, inject Basic Auth credentials
    if (baseURL?.includes("staging.")) {
      const username = process.env.STAGING_AUTH_USER;
      const password = process.env.STAGING_AUTH_PASS;
      if (username && password) {
        const urlObj = new URL(url, baseURL);
        urlObj.username = username;
        urlObj.password = password;
        url = urlObj.toString();
      }
    }

    const response = await request.get(url);
    expect(response.ok(), `/wp-json/ returned HTTP ${response.status()}`).toBe(
      true,
    );

    const body = await response.json();
    expect(body.namespaces, "/wp-json/ should list REST namespaces").toContain(
      "wp/v2",
    );
  });

  for (const slug of REST_PAGE_SLUGS) {
    test(`GET /wp-json/wp/v2/pages?slug=${slug} returns the page`, async ({
      request,
    }) => {
      const baseURL = test.info().project.use.baseURL;
      let url = `/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}`;

      // If accessing staging, inject Basic Auth credentials
      if (baseURL?.includes("staging.")) {
        const username = process.env.STAGING_AUTH_USER;
        const password = process.env.STAGING_AUTH_PASS;
        if (username && password) {
          const urlObj = new URL(url, baseURL);
          urlObj.username = username;
          urlObj.password = password;
          url = urlObj.toString();
        }
      }

      const response = await request.get(url);
      expect(
        response.ok(),
        `pages?slug=${slug} returned HTTP ${response.status()}`,
      ).toBe(true);

      const pages = await response.json();
      expect(
        pages.length,
        `No page found for slug "${slug}" — check WordPress permalinks`,
      ).toBeGreaterThan(0);
      expect(pages[0].slug).toBe(slug);
    });
  }
});
