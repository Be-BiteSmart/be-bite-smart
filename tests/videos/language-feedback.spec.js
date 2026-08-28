import { test, expect } from "@playwright/test";
import { gotoExpectOk, EDUCATION_PATH, spyOnPlausible } from "../analytics/helpers/plausible.js";
import {
  assertVimeoPlayerLoads,
  episodeLangSegments,
  getEpisodeVideoIds,
  expectedPlayButtonLabel,
  expectedLangChangeStatus,
} from "./helpers/videos.js";

/**
 * The play-button label and the small status line next to the language
 * picker are the only visible feedback a visitor gets when switching a
 * video's language — episode number/title/description are deliberately the
 * same regardless of language. See CHANGES.md, "Make video language toggle
 * visibly change something", for why and what was considered.
 *
 * The label always names the currently-selected language in the site's own
 * displayed language (e.g. "Play (Spanish)" on an English-language site) —
 * never translated into the target language's own script. That distinction
 * matters: an earlier, different per-language button-text feature was
 * removed for doing the latter (see CHANGES.md, "Watch button text
 * simplified"); these tests exist partly to make sure this feature doesn't
 * regress into that same mistake.
 */

/** First segment with a different data-lang than the one currently active. */
function otherLangSegment(container, activeLang) {
  return container
    .locator(
      `.lang-segment[data-lang]:not([data-lang="${activeLang}"]), .toggle-label[data-lang]:not([data-lang="${activeLang}"])`,
    )
    .first();
}

function activeLangOf(container) {
  return container
    .locator(".lang-segment.active, .toggle-label.active")
    .first()
    .getAttribute("data-lang");
}

test.describe("Documentary video (video-quote block)", () => {
  test(`${EDUCATION_PATH} play button names the site's default language on load`, async ({
    page,
  }, testInfo) => {
    await gotoExpectOk(page, EDUCATION_PATH);

    const block = page.locator(".video-quote-block").first();
    await expect(block, `No video-quote block on ${EDUCATION_PATH}`).toBeVisible();

    if ((await episodeLangSegments(block).count()) < 2) {
      testInfo.skip();
      return;
    }

    const siteLang = (await block.getAttribute("data-site-lang")) || "en";
    const label = block.locator(".play-button .play-button-label");
    await expect(label).toHaveText(await expectedPlayButtonLabel(page, siteLang));
  });

  test(`${EDUCATION_PATH} picking a different language before playing updates the play button and shows a status`, async ({
    page,
  }, testInfo) => {
    await gotoExpectOk(page, EDUCATION_PATH);

    const block = page.locator(".video-quote-block").first();
    await expect(block, `No video-quote block on ${EDUCATION_PATH}`).toBeVisible();

    if ((await episodeLangSegments(block).count()) < 2) {
      testInfo.skip();
      return;
    }

    const activeLang = await activeLangOf(block);
    const segment = otherLangSegment(block, activeLang);
    const otherLang = await segment.getAttribute("data-lang");

    const label = block.locator(".play-button .play-button-label");
    const status = block.locator(".lang-change-status");

    // No status before any interaction — only a genuine change shows it.
    await expect(status).not.toHaveClass(/is-visible/);

    await segment.click();
    await expect(segment).toHaveClass(/active/);

    await expect(label).toHaveText(await expectedPlayButtonLabel(page, otherLang));
    await expect(status).toHaveClass(/is-visible/);
    await expect(status).toHaveText(await expectedLangChangeStatus(page, otherLang));

    // Fades back out on its own (~2.5s) without needing another click — the
    // label is not transient and must still read the newly-picked language.
    await expect(status).not.toHaveClass(/is-visible/, { timeout: 4000 });
    await expect(label).toHaveText(await expectedPlayButtonLabel(page, otherLang));
  });

  test(`${EDUCATION_PATH} a fully successful live track switch while playing also shows the status, never alongside the track-note`, async ({
    page,
  }, testInfo) => {
    await gotoExpectOk(page, EDUCATION_PATH);

    const block = page.locator(".video-quote-block").first();
    await expect(block, `No video-quote block on ${EDUCATION_PATH}`).toBeVisible();

    if ((await episodeLangSegments(block).count()) < 2) {
      testInfo.skip();
      return;
    }

    const vimeoId = await block.getAttribute("data-quote-vimeo-id");
    const siteLang = (await block.getAttribute("data-site-lang")) || "en";

    await spyOnPlausible(page);
    await assertVimeoPlayerLoads(page, block, block.locator(".play-button"), {
      vimeoId,
      lang: siteLang,
      forceCaptions: true,
    });

    const activeLang = await activeLangOf(block);
    const segment = otherLangSegment(block, activeLang);
    const otherLang = await segment.getAttribute("data-lang");

    const status = block.locator(".lang-change-status");
    const trackNote = block.locator(".video-quote-track-note");

    await segment.click();

    // Only ever one of the two is visible at a time — a fully successful
    // switch shows the status, never the track-note (that's reserved for a
    // failed/partial switch — see showTrackNote()'s call sites).
    await expect(status).toHaveClass(/is-visible/);
    await expect(status).toHaveText(await expectedLangChangeStatus(page, otherLang));
    await expect(trackNote).not.toHaveClass(/is-visible/);
  });
});

test.describe("Episode videos (education page)", () => {
  /**
   * The episode cards on /learn/ may still be the legacy custom/episode-card
   * block's saved HTML from before this feature (or even the earlier "merge
   * Watch Now buttons" refactor) existed — that static markup won't gain
   * .play-button-label until the post is re-saved in the editor. Skip
   * cleanly rather than fail on stale content; the CPT-backed custom/episode
   * block (episode-display.php) always renders fresh, so these activate
   * automatically once content is migrated/re-saved.
   */
  async function firstUpToDateEpisode(page, testInfo) {
    await gotoExpectOk(page, EDUCATION_PATH);

    const episode = page.locator("#developed-episodes article").first();
    await expect(episode, "No episode cards in #developed-episodes").toBeVisible();

    if ((await episode.locator(".play-button-label").count()) === 0) {
      testInfo.skip();
      return null;
    }
    if ((await episodeLangSegments(episode).count()) < 2) {
      testInfo.skip();
      return null;
    }
    return episode;
  }

  test("play button names the currently-selected language and updates before pressing play", async ({
    page,
  }, testInfo) => {
    const episode = await firstUpToDateEpisode(page, testInfo);
    if (!episode) return;

    const activeLang = await activeLangOf(episode);
    const label = episode.locator(".play-button .play-button-label");
    await expect(label).toHaveText(await expectedPlayButtonLabel(page, activeLang));

    const segment = otherLangSegment(episode, activeLang);
    const otherLang = await segment.getAttribute("data-lang");
    const status = episode.locator(".lang-change-status");

    await segment.click();
    await expect(segment).toHaveClass(/active/);
    await expect(label).toHaveText(await expectedPlayButtonLabel(page, otherLang));
    await expect(status).toHaveClass(/is-visible/);
    await expect(status).toHaveText(await expectedLangChangeStatus(page, otherLang));
  });

  test("cancelling the restart-confirm dialog rolls the play button back with no status flash", async ({
    page,
  }, testInfo) => {
    const episode = await firstUpToDateEpisode(page, testInfo);
    if (!episode) return;

    const videoIds = await getEpisodeVideoIds(episode);
    const activeLang = await activeLangOf(episode);

    await spyOnPlausible(page);
    await assertVimeoPlayerLoads(page, episode, episode.locator(".play-button"), {
      vimeoId: videoIds[activeLang],
      lang: activeLang,
    });

    const segment = otherLangSegment(episode, activeLang);
    const label = episode.locator(".play-button .play-button-label");
    const status = episode.locator(".lang-change-status");
    const originalLabelText = await label.textContent();

    await segment.click();
    await page.locator(".video-lang-restart-modal__btn--cancel").click();

    // Rolled back: the picker, label, and status all act as if the click
    // never happened — no false "success" confirmation for a cancelled switch.
    await expect(
      episode.locator(
        `.lang-segment[data-lang="${activeLang}"], .toggle-label[data-lang="${activeLang}"]`,
      ),
    ).toHaveClass(/active/);
    await expect(label).toHaveText(originalLabelText);
    await expect(status).not.toHaveClass(/is-visible/);
  });

  test("confirming the restart dialog updates the play button and shows the status", async ({
    page,
  }, testInfo) => {
    const episode = await firstUpToDateEpisode(page, testInfo);
    if (!episode) return;

    const videoIds = await getEpisodeVideoIds(episode);
    const activeLang = await activeLangOf(episode);

    await spyOnPlausible(page);
    await assertVimeoPlayerLoads(page, episode, episode.locator(".play-button"), {
      vimeoId: videoIds[activeLang],
      lang: activeLang,
    });

    const segment = otherLangSegment(episode, activeLang);
    const otherLang = await segment.getAttribute("data-lang");
    const label = episode.locator(".play-button .play-button-label");
    const status = episode.locator(".lang-change-status");

    await segment.click();
    await page.locator(".video-lang-restart-modal__btn--confirm").click();

    await expect(label).toHaveText(await expectedPlayButtonLabel(page, otherLang));
    await expect(status).toHaveClass(/is-visible/);
    await expect(status).toHaveText(await expectedLangChangeStatus(page, otherLang));
  });
});
