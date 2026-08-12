import { test, expect } from "@playwright/test";
import { gotoExpectOk, EDUCATION_PATH, spyOnPlausible } from "../analytics/helpers/plausible.js";
import {
  assertVimeoPlayerLoads,
  episodeLangSegments,
  getEpisodeVideoIds,
} from "./helpers/videos.js";

test.describe("Documentary video (video-quote block)", () => {
  for (const path of ["/", EDUCATION_PATH]) {
    test(`${path} Watch button loads Vimeo embed`, async ({ page }, testInfo) => {
      await gotoExpectOk(page, path);

      const block = page.locator(".video-quote-block").first();
      await expect(
        block,
        `No video-quote block on ${path}`,
      ).toBeVisible();

      const vimeoId = await block.getAttribute("data-quote-vimeo-id");
      const siteLang = (await block.getAttribute("data-site-lang")) || "en";
      const trigger = block.locator(".video-quote-watch-button");

      // Intercept Plausible events to prevent sending to actual service
      await spyOnPlausible(page);

      await assertVimeoPlayerLoads(page, block, trigger, {
        vimeoId,
        lang: siteLang,
        forceCaptions: true,
      });

      await testInfo.attach(`${path} documentary iframe src`, {
        body: await block.locator(".video-player iframe").getAttribute("src"),
        contentType: "text/plain",
      });
    });

    test(`${path} thumbnail play button loads Vimeo embed`, async ({ page }) => {
      await gotoExpectOk(page, path);

      const block = page.locator(".video-quote-block").first();
      const vimeoId = await block.getAttribute("data-quote-vimeo-id");
      const siteLang = (await block.getAttribute("data-site-lang")) || "en";
      const trigger = block.locator(".play-button");

      // Intercept Plausible events to prevent sending to actual service
      await spyOnPlausible(page);

      await assertVimeoPlayerLoads(page, block, trigger, {
        vimeoId,
        lang: siteLang,
        forceCaptions: true,
      });
    });
  }

  test(`${EDUCATION_PATH} switching to Spanish before pressing play uses Spanish captions/audio`, async ({
    page,
  }, testInfo) => {
    await gotoExpectOk(page, EDUCATION_PATH);

    const block = page.locator(".video-quote-block").first();
    await expect(block, `No video-quote block on ${EDUCATION_PATH}`).toBeVisible();

    // Hindi isn't configured in TranslatePress on this site yet — Spanish is
    // the only non-English language we can reliably test against for now.
    const esSegment = block.locator(
      '.lang-segment[data-lang="es"], .toggle-label[data-lang="es"]',
    );
    if ((await esSegment.count()) === 0) {
      testInfo.skip();
      return;
    }

    const vimeoId = await block.getAttribute("data-quote-vimeo-id");

    // Click Spanish BEFORE playing — this is the exact scenario that used to
    // silently play English with no feedback when Spanish wasn't actually on
    // the video. Clicking here only updates picker state; assertVimeoPlayerLoads
    // below is what actually presses play.
    await esSegment.first().click();
    await expect(esSegment.first()).toHaveClass(/active/);

    await spyOnPlausible(page);

    await assertVimeoPlayerLoads(page, block, block.locator(".video-quote-watch-button"), {
      vimeoId,
      lang: "es",
      forceCaptions: true,
    });
  });

  test(`${EDUCATION_PATH} watch button text stays the same across language switches`, async ({
    page,
  }, testInfo) => {
    await gotoExpectOk(page, EDUCATION_PATH);

    const block = page.locator(".video-quote-block").first();
    await expect(block, `No video-quote block on ${EDUCATION_PATH}`).toBeVisible();

    const segments = episodeLangSegments(block);
    const segmentCount = await segments.count();
    if (segmentCount < 2) {
      testInfo.skip();
      return;
    }

    const watchButton = block.locator(".video-quote-watch-button");
    const originalText = (await watchButton.textContent())?.trim();
    expect(originalText, "watch button has no text").toBeTruthy();

    // The watch button text is now a static, site-language string — it must
    // never swap based on which language pill is selected (that per-language
    // watch-label behavior was deliberately removed).
    for (let i = 0; i < segmentCount; i++) {
      await segments.nth(i).click();
      await expect(segments.nth(i)).toHaveClass(/active/);
      await expect(watchButton).toHaveText(originalText);
    }
  });

  test(`${EDUCATION_PATH} switching language while playing keeps the same video loaded`, async ({
    page,
  }, testInfo) => {
    await gotoExpectOk(page, EDUCATION_PATH);

    const block = page.locator(".video-quote-block").first();
    await expect(block, `No video-quote block on ${EDUCATION_PATH}`).toBeVisible();

    const segments = episodeLangSegments(block);
    const segmentCount = await segments.count();
    if (segmentCount < 2) {
      testInfo.skip();
      return;
    }

    const vimeoId = await block.getAttribute("data-quote-vimeo-id");
    const siteLang = (await block.getAttribute("data-site-lang")) || "en";

    await spyOnPlausible(page);

    const iframe = await assertVimeoPlayerLoads(
      page,
      block,
      block.locator(".video-quote-watch-button"),
      { vimeoId, lang: siteLang, forceCaptions: true },
    );
    const srcBeforeSwitch = await iframe.getAttribute("src");

    const activeLang = await block
      .locator(".lang-segment.active, .toggle-label.active")
      .first()
      .getAttribute("data-lang");
    const otherSegment = block
      .locator(
        `.lang-segment[data-lang]:not([data-lang="${activeLang}"]), .toggle-label[data-lang]:not([data-lang="${activeLang}"])`,
      )
      .first();

    await otherSegment.click();
    await expect(otherSegment).toHaveClass(/active/);

    // video-quote switches subtitle/audio tracks live via the Vimeo Player
    // SDK — unlike episode-card, it never loads a different video. The
    // iframe's src attribute (and the iframe element itself) must stay
    // exactly as it was; the SDK calls don't touch it at all.
    await expect(iframe).toHaveAttribute("src", srcBeforeSwitch);
    await expect(block.locator(".video-player iframe")).toHaveCount(1);
  });
});

test.describe("Episode videos (education page)", () => {
  test("Watch Now loads the correct Vimeo embed for every language", async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    await gotoExpectOk(page, EDUCATION_PATH);

    const episodes = page.locator("#developed-episodes article");
    const episodeCount = await episodes.count();
    expect(
      episodeCount,
      "No episode cards in #developed-episodes",
    ).toBeGreaterThan(0);

    const episodePlans = [];

    for (let i = 0; i < episodeCount; i++) {
      const episode = episodes.nth(i);
      const episodeLabel =
        (await episode.locator(".episode-number").textContent())?.trim() ||
        `Episode ${i + 1}`;
      const videoIds = await getEpisodeVideoIds(episode);
      const segments = episodeLangSegments(episode);
      const langCount = await segments.count();
      expect(langCount, `${episodeLabel} has no language segments`).toBeGreaterThan(
        0,
      );

      const langs = [];
      for (let j = 0; j < langCount; j++) {
        langs.push(await segments.nth(j).getAttribute("data-lang"));
      }

      episodePlans.push({ index: i, episodeLabel, videoIds, langs });
    }

    const results = [];

    for (const plan of episodePlans) {
      for (const lang of plan.langs) {
        const vimeoId = plan.videoIds[lang];
        expect(
          vimeoId,
          `${plan.episodeLabel} is missing Vimeo ID for language ${lang}`,
        ).toBeTruthy();

        await gotoExpectOk(page, EDUCATION_PATH);
        const episode = page.locator("#developed-episodes article").nth(plan.index);
        const segment = episode.locator(
          `.lang-segment[data-lang='${lang}'], .toggle-label[data-lang='${lang}']`,
        );

        await segment.click();
        await expect(segment).toHaveClass(/active/);

        // Intercept Plausible events to prevent sending to actual service
        await spyOnPlausible(page);

        const iframe = await assertVimeoPlayerLoads(
          page,
          episode,
          episode.locator(".watch-now-button"),
          { vimeoId, lang },
        );

        results.push({
          episode: plan.episodeLabel,
          lang,
          vimeoId,
          src: await iframe.getAttribute("src"),
        });
      }
    }

    await testInfo.attach("episode video loads", {
      body: JSON.stringify(results, null, 2),
      contentType: "application/json",
    });

    expect(results.length).toBeGreaterThan(0);
  });

  test("thumbnail click loads Vimeo embed for first episode", async ({
    page,
  }) => {
    await gotoExpectOk(page, EDUCATION_PATH);

    const episode = page.locator("#developed-episodes article").first();
    const videoIds = await getEpisodeVideoIds(episode);
    const defaultLang =
      (await episode
        .locator(".lang-segment.active, .toggle-label.active")
        .first()
        .getAttribute("data-lang")) || "en";
    const vimeoId = videoIds[defaultLang] || videoIds.en || Object.values(videoIds)[0];

    // Intercept Plausible events to prevent sending to actual service
    await spyOnPlausible(page);

    await assertVimeoPlayerLoads(page, episode, episode.locator(".play-button"), {
      vimeoId,
      lang: defaultLang,
    });
  });
});
