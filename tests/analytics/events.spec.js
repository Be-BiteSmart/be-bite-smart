import { test, expect } from "@playwright/test";
import {
  spyOnPlausible,
  getPlausibleCalls,
  testEpisodeLanguage,
} from "../helpers/plausible.js";

// ── Education page ─────────────────────────────────────────────

test("Watch Now fires video_watched for all episodes in both languages", async ({
  page,
}, testInfo) => {
  await page.goto("/education");

  const episodes = page.locator("#childrens-video-series article");
  const episodeCount = await episodes.count();
  const allCalls = [];

  for (let i = 0; i < episodeCount; i++) {
    const episode = episodes.nth(i);

    // Switch to EN first (default), test it
    await episode.locator(".toggle-label[data-lang='en']").click();
    allCalls.push(
      await testEpisodeLanguage(page, testInfo, episode, "english"),
    );

    // Switch to ES, test it
    await episode.locator(".toggle-label[data-lang='es']").click();
    allCalls.push(
      await testEpisodeLanguage(page, testInfo, episode, "spanish"),
    );
  }

  await testInfo.attach("all plausible events", {
    body: JSON.stringify(allCalls, null, 2),
    contentType: "application/json",
  });

  expect(allCalls).toHaveLength(episodeCount * 2);
});

test("PDF toggle fires pdf_viewed on education page", async ({
  page,
}, testInfo) => {
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
  await testInfo.attach("plausible events", {
    body: JSON.stringify(calls, null, 2),
    contentType: "application/json",
  });

  expect(calls).toHaveLength(1);
  expect(calls[0].event).toBe("pdf_viewed");
  expect(calls[0].options.props.content_type).toBe("pdf");
  expect(calls[0].options.props.content_name).toMatch(/^pdf - /);
});

test("PDF toggle does not fire again when closing", async ({
  page,
}, testInfo) => {
  await page.goto("/education");

  const btn = page
    .locator(
      ".ecd-toggle:not(.ecd-toggle--download):not(.ecd-toggle--coming-soon)",
    )
    .first();
  await btn.click();
  await page.waitForTimeout(500);

  await spyOnPlausible(page);
  await btn.click();
  await page.waitForTimeout(500);

  const calls = await getPlausibleCalls(page);
  await testInfo.attach("plausible events", {
    body: JSON.stringify(calls, null, 2),
    contentType: "application/json",
  });

  expect(calls).toHaveLength(0);
});

test("Documentary play fires video_watched without content_language", async ({
  page,
}, testInfo) => {
  await page.goto("/education");
  await spyOnPlausible(page);

  await page
    .locator(".video-quote-watch-button, .video-quote-block .play-button")
    .first()
    .click();
  await page.waitForTimeout(500);

  const calls = await getPlausibleCalls(page);
  await testInfo.attach("plausible events", {
    body: JSON.stringify(calls, null, 2),
    contentType: "application/json",
  });

  expect(calls).toHaveLength(1);
  expect(calls[0].event).toBe("video_watched");
  expect(calls[0].options.props.content_type).toBe("video");
  expect(calls[0].options.props.content_language).toBeUndefined();
});

// ── News / Legal pages ─────────────────────────────────────────

test("Article link click fires article_viewed", async ({ page }, testInfo) => {
  await page.goto("/news-media");
  await spyOnPlausible(page);

  await page.locator(".custom-block-card a[target='_blank']").first().click();
  await page.waitForTimeout(500);

  const calls = await getPlausibleCalls(page);
  await testInfo.attach("plausible events", {
    body: JSON.stringify(calls, null, 2),
    contentType: "application/json",
  });

  expect(calls).toHaveLength(1);
  expect(calls[0].event).toBe("article_viewed");
  expect(calls[0].options.props.content_type).toBe("article");
  expect(calls[0].options.props.content_name).toMatch(/^article - /);
});

test("Read More fires article_viewed on news page", async ({
  page,
}, testInfo) => {
  await page.goto("/news-media");
  await spyOnPlausible(page);

  await page.locator(".read-more-toggle").first().click();
  await page.waitForTimeout(500);

  const calls = await getPlausibleCalls(page);
  await testInfo.attach("plausible events", {
    body: JSON.stringify(calls, null, 2),
    contentType: "application/json",
  });

  expect(calls).toHaveLength(1);
  expect(calls[0].event).toBe("article_viewed");
  expect(calls[0].options.props.content_type).toBe("article");
});

// ── Library page ───────────────────────────────────────────────

test("Article link click fires article_viewed on library page", async ({
  page,
}, testInfo) => {
  await page.goto("/library");
  await spyOnPlausible(page);

  await page.locator(".custom-block-card a[target='_blank']").first().click();
  await page.waitForTimeout(500);

  const calls = await getPlausibleCalls(page);
  await testInfo.attach("plausible events", {
    body: JSON.stringify(calls, null, 2),
    contentType: "application/json",
  });

  expect(calls).toHaveLength(1);
  expect(calls[0].event).toBe("article_viewed");
  expect(calls[0].options.props.content_type).toBe("article");
});

// ── Home page ──────────────────────────────────────────────────

test("Documentary play fires video_watched on home page", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await spyOnPlausible(page);

  await page
    .locator(".video-quote-watch-button, .video-quote-block .play-button")
    .first()
    .click();
  await page.waitForTimeout(500);

  const calls = await getPlausibleCalls(page);
  await testInfo.attach("plausible events", {
    body: JSON.stringify(calls, null, 2),
    contentType: "application/json",
  });

  expect(calls).toHaveLength(1);
  expect(calls[0].event).toBe("video_watched");
  expect(calls[0].options.props.content_language).toBeUndefined();
});
