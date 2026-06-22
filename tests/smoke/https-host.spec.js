import { test, expect } from "@playwright/test";
import { HOME_PATH, EDUCATION_PATH } from "../helpers/paths.js";
import {
  CANONICAL_ORIGIN,
  HOST_ENTRY_POINTS,
  shouldRunHostChecks,
  assertResolvesToCanonical,
  assertHttpsFirstRedirect,
  canonicalUrl,
} from "../helpers/host.js";

const HOST_CHECK_PATHS = [
  { path: HOME_PATH, label: "Home" },
  { path: EDUCATION_PATH, label: "Learn" },
];

const HTTP_ENTRY_POINTS = HOST_ENTRY_POINTS.filter(({ url }) =>
  url.startsWith("http://"),
);

test.describe("HTTPS and canonical host", () => {
  test.beforeEach(({}, testInfo) => {
    const baseURL =
      testInfo.project.use?.baseURL ?? CANONICAL_ORIGIN;

    if (!shouldRunHostChecks(baseURL)) {
      test.skip(
        true,
        `Host checks only run when baseURL is ${CANONICAL_ORIGIN} (got ${baseURL})`,
      );
    }
  });

  for (const entry of HOST_ENTRY_POINTS) {
    for (const { path, label } of HOST_CHECK_PATHS) {
      test(`${entry.label} ${label} (${path}) resolves to canonical HTTPS www`, async ({
        request,
      }, testInfo) => {
        const result = await assertResolvesToCanonical(
          request,
          entry.url,
          path,
        );

        await testInfo.attach(`${entry.label} ${path} redirect`, {
          body: JSON.stringify(result, null, 2),
          contentType: "application/json",
        });
      });
    }
  }

  for (const entry of HTTP_ENTRY_POINTS) {
    for (const { path, label } of HOST_CHECK_PATHS) {
      test(`${entry.label} ${label} (${path}) first redirect upgrades to HTTPS`, async ({
        request,
      }, testInfo) => {
        const result = await assertHttpsFirstRedirect(
          request,
          entry.url,
          path,
        );

        await testInfo.attach(`${entry.label} ${path} first hop`, {
          body: JSON.stringify(result, null, 2),
          contentType: "application/json",
        });
      });
    }
  }

  test("canonical origin home is served over HTTPS", async ({ request }) => {
    const response = await request.get(canonicalUrl(HOME_PATH), {
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(200);
    expect(response.url()).toMatch(/^https:\/\/www\.bebitesmart\.org\//);
  });
});
