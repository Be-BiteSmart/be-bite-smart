import { test, expect } from "@playwright/test";
import { REST_PAGE_SLUGS } from "../helpers/paths.js";

test.describe("WordPress REST API smoke", () => {
  test("GET /wp-json/ responds", async ({ request }) => {
    const response = await request.get("/wp-json/");
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
      const response = await request.get(
        `/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}`,
      );
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
