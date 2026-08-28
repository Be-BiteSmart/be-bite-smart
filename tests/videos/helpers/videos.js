import { expect } from "@playwright/test";

/**
 * Mirrors buildVimeoPlayerSrc() in video-toggle.js. forceCaptions matches
 * that function's option of the same name: video-quote blocks pass
 * forceCaptions: true (captions on from the first play, any language),
 * episode-card blocks leave it false (unchanged legacy behavior — captions
 * off by default in English).
 */
export function expectedVimeoPlayerSrc(vimeoId, lang, { forceCaptions = false } = {}) {
  const params = new URLSearchParams({ autoplay: "1" });
  const code = lang === "es" || lang === "hi" ? lang : "en";

  if (code === "es") {
    params.set("texttrack", "es");
    params.set("audiotrack", "es");
  } else if (code === "hi") {
    params.set("texttrack", "hi");
    params.set("audiotrack", "hi");
  } else if (forceCaptions) {
    params.set("texttrack", code);
  }

  return `https://player.vimeo.com/video/${vimeoId}?${params.toString()}`;
}

export function parseVideosDataset(raw) {
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Click a play trigger and assert the Vimeo iframe is inserted with the expected src.
 * Does not wait on player.vimeo.com network responses — those are flaky in CI
 * (cached embeds, parallel workers) while iframe src + visibility are reliable.
 */
export async function assertVimeoPlayerLoads(page, container, trigger, {
  vimeoId,
  lang = "en",
  forceCaptions = false,
}) {
  expect(vimeoId, "block is missing a Vimeo ID").toBeTruthy();

  const iframe = container.locator(".video-player iframe");

  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  await iframe.waitFor({ state: "visible" });
  await expect(iframe).toHaveAttribute(
    "src",
    expectedVimeoPlayerSrc(vimeoId, lang, { forceCaptions }),
  );
  await expect(container.locator(".video-thumbnail")).toHaveClass(/hidden/);

  return iframe;
}

export function episodeLangSegments(episode) {
  return episode.locator(
    ".lang-segment[data-lang], .toggle-label[data-lang]",
  );
}

export async function getEpisodeVideoIds(episode) {
  const raw =
    (await episode.getAttribute("data-videos")) ||
    (await episode.locator(".video-episode-block").first().getAttribute("data-videos"));
  return parseVideosDataset(raw);
}

/**
 * A language code's display name, read from the hidden, TranslatePress-
 * translatable .video-quote-lang-name templates — the exact same source
 * langName() in shared/languages.js reads at runtime. Deriving expected text
 * from the page's own templates (rather than hardcoding "English"/"Spanish")
 * keeps these assertions correct regardless of site language or wording.
 */
export async function langDisplayName(page, code) {
  const name = await page
    .locator(`.video-quote-lang-name[data-lang="${code}"]`)
    .textContent();
  return name?.trim() ?? code;
}

/**
 * Expected play-button label for a language, built the same way
 * setPlayButtonLabel() does client-side: the hidden .play-button-label-template
 * ("Play ({language})") with {language} substituted.
 */
export async function expectedPlayButtonLabel(page, code) {
  const name = await langDisplayName(page, code);
  const template =
    (await page.locator(".play-button-label-template").textContent()) ||
    "Play ({language})";
  return template.replace("{language}", name);
}

/**
 * Expected transient "language changed" status text for a language, built
 * the same way showLangChangeStatus() does client-side: the hidden
 * .lang-change-status-template ("Switched to {language}.") with {language}
 * substituted.
 */
export async function expectedLangChangeStatus(page, code) {
  const name = await langDisplayName(page, code);
  const template =
    (await page.locator(".lang-change-status-template").textContent()) ||
    "Switched to {language}.";
  return template.replace("{language}", name);
}
