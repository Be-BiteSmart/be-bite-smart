import { expect } from "@playwright/test";

/** Fail fast with a clear message instead of a long navigation timeout. */
export async function gotoExpectOk(page, path) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  const status = response?.status() ?? 0;
  expect(
    status,
    `${path} returned HTTP ${status} — fix production or set PLAYWRIGHT_BASE_URL`,
  ).toBeLessThan(400);
  const title = await page.title();
  expect(
    title,
    `${path} is a WordPress error page — check server logs / cache`,
  ).not.toMatch(/WordPress.*Error/i);
  return response;
}

/**
 * Wait for page-specific content before an a11y scan (avoids false passes when
 * WP Super Cache serves HTML without late-rendered blocks).
 */
export async function waitForA11yPageReady(page, path, readySelectors) {
  const selector = readySelectors[path];
  if (!selector) {
    return;
  }

  await page.locator(selector).first().waitFor({ state: "attached" });
}

/**
 * Assert core layout regions exist (theme/plugin conflicts often remove these).
 * Uses flexible selectors so minor markup changes do not break tests.
 */
export async function assertCriticalDom(page, pathLabel) {
  const regions = [
    {
      name: "header",
      locator: page.locator("header").first(),
    },
    {
      name: "navigation",
      locator: page.locator(
        "header nav, .wp-block-navigation, nav[aria-label], #site-navigation",
      ).first(),
      /** Responsive block themes hide nav until the menu opens — attached is enough. */
      attachedOnly: true,
    },
    {
      name: "main content",
      locator: page.locator(
        "main, [role='main'], #content, #primary, .site-main, .wp-site-blocks",
      ).first(),
    },
    {
      name: "footer",
      locator: page.locator("footer").first(),
    },
  ];

  for (const { name, locator, attachedOnly } of regions) {
    if (attachedOnly) {
      await expect(locator, `${pathLabel}: missing ${name}`).toBeAttached();
      continue;
    }
    await expect(
      locator,
      `${pathLabel}: missing ${name}`,
    ).toBeVisible();
  }
}
