import { expect } from "@playwright/test";

/** Mirrors buildVimeoPlayerSrc() in video-toggle.js */
export function expectedVimeoPlayerSrc(vimeoId, lang) {
  const params = new URLSearchParams({ autoplay: "1" });
  const code = lang === "es" || lang === "hi" ? lang : "en";

  if (code === "es") {
    params.set("texttrack", "es");
    params.set("audiotrack", "es");
  } else if (code === "hi") {
    params.set("texttrack", "hi");
    params.set("audiotrack", "hi");
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
}) {
  expect(vimeoId, "block is missing a Vimeo ID").toBeTruthy();

  const iframe = container.locator(".video-player iframe");

  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  await iframe.waitFor({ state: "visible" });
  await expect(iframe).toHaveAttribute(
    "src",
    expectedVimeoPlayerSrc(vimeoId, lang),
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
