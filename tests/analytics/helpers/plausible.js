import { expect } from "@playwright/test";

export async function testEpisodeLanguage(page, testInfo, episode, lang) {
  const episodeNumber = await episode.locator(".episode-number").textContent();
  const toggle = episode.locator(
    `.toggle-label[data-lang='${lang === "english" ? "en" : "es"}']`,
  );

  // ****** Part 1: Check language toggle is active ****
  const toggleClass = await toggle.getAttribute("class");

  // attach toggle result to html report
  await testInfo.attach(`${episodeNumber} ${lang} toggle class`, {
    body: toggleClass,
    contentType: "text/plain",
  });
  await expect(toggle).toHaveClass(/active/);

  // Click Watch Now and spy

  // Spy fresh for this click
  await spyOnPlausible(page);
  await episode.locator(".watch-now-button").click();
  await page.waitForTimeout(500);

  // ****** Part 2: Check iframe loaded after click was done ********
  const iframeVisible = await episode
    .locator(".video-player iframe")
    .isVisible();

  // added iframe result to html report
  await testInfo.attach(`${episodeNumber} ${lang} iframe visible`, {
    body: String(iframeVisible),
    contentType: "text/plain",
  });
  await expect(episode.locator(".video-player iframe")).toBeVisible();

  // Check plausible event
  const calls = await getPlausibleCalls(page);
  await testInfo.attach(`${episodeNumber} ${lang} plausible event`, {
    body: JSON.stringify(calls, null, 2),
    contentType: "application/json",
  });

  expect(calls).toHaveLength(1);
  expect(calls[0].event).toBe("video_watched");
  expect(calls[0].options.props.content_type).toBe("video");
  expect(calls[0].options.props.content_language).toBe(lang);
  expect(calls[0].options.props.content_name).toMatch(
    new RegExp(`^video - .+ - ${lang}$`),
  );

  return { episode: `${episodeNumber}`.trim(), lang, ...calls[0] };
}
