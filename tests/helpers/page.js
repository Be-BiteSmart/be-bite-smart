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
 * Freeze AOS (Animate On Scroll) animations at their end state.
 *
 * AOS animates elements (commonly opacity, sometimes transform) from a
 * pre-trigger state to `.aos-animate`. If a scan (axe or otherwise) runs
 * mid-transition, it reads the real, momentarily-composited pixels —
 * e.g. partially-transparent colored text blended with the page background —
 * which can produce a *correct* but misleading contrast/color reading that
 * never matches the element's resting `color`/`opacity` values. This isn't
 * a timing race we want to win by waiting longer; we just don't want
 * animation state to be part of what gets scanned at all.
 *
 * Forcing transition/animation to `none` and snapping to the end state
 * removes this as a source of flakiness for every test that calls this
 * helper, not just the a11y suite.
 */
async function disableAosAnimations(page) {
  await page.addStyleTag({
    content: `
      [data-aos] {
        transition: none !important;
        animation: none !important;
        opacity: 1 !important;
        transform: none !important;
      }
    `,
  });
}

/**
 * Wait for page-specific content before an a11y scan (avoids false passes when
 * WP Super Cache serves HTML without late-rendered blocks).
 */
export async function waitForA11yPageReady(page, path, readySelectors) {
  await disableAosAnimations(page);

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