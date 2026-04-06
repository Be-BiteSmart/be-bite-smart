import { test, expect } from "@playwright/test";

async function spyOnPlausible(page) {
  await page.evaluate(() => {
    window._plausibleCalls = [];

    window.plausible = function (event, options) {
      window._plausibleCalls.push({ event, options });
      //  event is captured but never sent to plausible
    };
  });
}

async function getPlausibleCalls(page) {
  return page.evaluate(() => window._plausibleCalls);
}

// ── Education page ─────────────────────────────────────────────

test("Watch Now fires video_watched with correct props", async ({ page }) => {
  await page.goto("/education");
  await spyOnPlausible(page);

  await page.locator(".watch-now-button").first().click();
  await page.waitForTimeout(500);

  const calls = await getPlausibleCalls(page);

  expect(calls).toHaveLength(1);
  expect(calls[0].event).toBe("video_watched");
  expect(calls[0].options.props.content_type).toBe("video");
  expect(calls[0].options.props.content_language).toMatch(/english|spanish/);
  expect(calls[0].options.props.content_name).toMatch(
    /^video - .+ - (english|spanish)$/,
  );
});

test("PDF toggle fires pdf_viewed on education page", async ({ page }) => {
  await page.goto("/education");
  await spyOnPlausible(page);

  await page
    .locator(
      ".ecd-toggle:not(.ecd-toggle--download):not(.ecd-toggle--coming-soon)",
    )
    .first()
    .click();
  await page.waitForTimeout(500);

  const calls = await getPlausibleCalls(page);

  expect(calls).toHaveLength(1);
  expect(calls[0].event).toBe("pdf_viewed");
  expect(calls[0].options.props.content_type).toBe("pdf");
  expect(calls[0].options.props.content_name).toMatch(/^pdf - /);
});

test("PDF toggle does not fire again when closing", async ({ page }) => {
  await page.goto("/education");

  const btn = page
    .locator(
      ".ecd-toggle:not(.ecd-toggle--download):not(.ecd-toggle--coming-soon)",
    )
    .first();
  await btn.click();
  await page.waitForTimeout(500);

  await spyOnPlausible(page);
  await btn.click(); // close it
  await page.waitForTimeout(500);

  const calls = await getPlausibleCalls(page);
  expect(calls).toHaveLength(0);
});

test("Documentary play fires video_watched without content_language", async ({
  page,
}) => {
  await page.goto("/education");
  await spyOnPlausible(page);

  await page
    .locator(".video-quote-watch-button, .video-quote-block .play-button")
    .first()
    .click();
  await page.waitForTimeout(500);

  const calls = await getPlausibleCalls(page);

  expect(calls).toHaveLength(1);
  expect(calls[0].event).toBe("video_watched");
  expect(calls[0].options.props.content_type).toBe("video");
  expect(calls[0].options.props.content_language).toBeUndefined();
});

// ── News / Legal pages ─────────────────────────────────────────

test("Article link click fires article_viewed", async ({ page }) => {
  await page.goto("/news-media");
  await spyOnPlausible(page);

  await page.locator(".custom-block-card a[target='_blank']").first().click();
  await page.waitForTimeout(500);

  const calls = await getPlausibleCalls(page);

  expect(calls).toHaveLength(1);
  expect(calls[0].event).toBe("article_viewed");
  expect(calls[0].options.props.content_type).toBe("article");
  expect(calls[0].options.props.content_name).toMatch(/^article - /);
});

test("Read More fires article_viewed on news page", async ({ page }) => {
  await page.goto("/news-media");
  await spyOnPlausible(page);

  await page.locator(".read-more-toggle").first().click();
  await page.waitForTimeout(500);

  const calls = await getPlausibleCalls(page);

  expect(calls).toHaveLength(1);
  expect(calls[0].event).toBe("article_viewed");
  expect(calls[0].options.props.content_type).toBe("article");
});

// ── Library page ───────────────────────────────────────────────

test("Article link click fires article_viewed on library page", async ({
  page,
}) => {
  await page.goto("/library");
  await spyOnPlausible(page);

  await page.locator(".custom-block-card a[target='_blank']").first().click();
  await page.waitForTimeout(500);

  const calls = await getPlausibleCalls(page);

  expect(calls).toHaveLength(1);
  expect(calls[0].event).toBe("article_viewed");
  expect(calls[0].options.props.content_type).toBe("article");
});

// ── Home page ──────────────────────────────────────────────────

test("Documentary play fires video_watched on home page", async ({ page }) => {
  await page.goto("/");
  await spyOnPlausible(page);

  await page
    .locator(".video-quote-watch-button, .video-quote-block .play-button")
    .first()
    .click();
  await page.waitForTimeout(500);

  const calls = await getPlausibleCalls(page);

  expect(calls).toHaveLength(1);
  expect(calls[0].event).toBe("video_watched");
  expect(calls[0].options.props.content_language).toBeUndefined();
});
