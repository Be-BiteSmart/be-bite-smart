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

      const vimeoId = await block.getAttribute("data-vimeo-id");
      const siteLang = (await block.getAttribute("data-site-lang")) || "en";
      const trigger = block.locator(".video-quote-watch-button");

      // Intercept Plausible events to prevent sending to actual service
      await spyOnPlausible(page);

      await assertVimeoPlayerLoads(page, block, trigger, {
        vimeoId,
        lang: siteLang,
      });

      await testInfo.attach(`${path} documentary iframe src`, {
        body: await block.locator(".video-player iframe").getAttribute("src"),
        contentType: "text/plain",
      });
    });

    test(`${path} thumbnail play button loads Vimeo embed`, async ({ page }) => {
      await gotoExpectOk(page, path);

      const block = page.locator(".video-quote-block").first();
      const vimeoId = await block.getAttribute("data-vimeo-id");
      const siteLang = (await block.getAttribute("data-site-lang")) || "en";
      const trigger = block.locator(".play-button");

      // Intercept Plausible events to prevent sending to actual service
      await spyOnPlausible(page);

      await assertVimeoPlayerLoads(page, block, trigger, {
        vimeoId,
        lang: siteLang,
      });
    });
  }
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
