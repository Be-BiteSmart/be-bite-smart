import { expect } from "@playwright/test";

export async function spyOnPlausible(page) {
  await page.evaluate(() => {
    window._plausibleCalls = [];
    window.plausible = function (event, options) {
      window._plausibleCalls.push({ event, options });
      //event captured but never sent to plausible
    };
  });
}

export async function getPlausibleCalls(page) {
  return page.evaluate(() => window._plausibleCalls);
}

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

  // ****** Part 2: Check iframe loaded after click was done  ********

  // Wait for iframe to appear rather than a fixed waitForTimeout delay
  await episode.locator(".video-player iframe").waitFor({ state: "visible" });

  // added iframe result to html report
  await testInfo.attach(`${episodeNumber} ${lang} iframe visible`, {
    // true is hardcoded since if it got past the waitFor, then the iframe is guaranteed  to of happened
    body: "true",
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

export async function testOutboundArticleClick(
  page,
  testInfo,
  url,
  attachmentLabel,
) {
  await page.goto(url);
  await spyOnPlausible(page);

  // Acts like an event listener — stays active for the lifetime of the context,
  // intercepting every matching request after registration.
  await page.context().route("**/*", (route, request) => {
    if (request.isNavigationRequest() && request.frame() !== page.mainFrame()) {
      // isNavigationRequest() must come first — calling request.frame() on a
      // new-tab navigation crashes because the frame doesn't fully exist yet (returns null, ect).
      // Together these two checks abort only new-tab navigations, leaving
      // normal same-tab navigation untouched.

      route.abort();
    } else {
      route.continue();
    }
  });

  await page.locator(".custom-block-card a[target='_blank']").first().click();
  // target="_blank" opens in a new tab — spy stays intact on the current page,
  // and the route handler above aborts the new tab before it loads.
  await page.waitForTimeout(500);

  const calls = await getPlausibleCalls(page);
  await testInfo.attach(attachmentLabel, {
    body: JSON.stringify(calls, null, 2),
    contentType: "application/json",
  });

  expect(calls).toHaveLength(1);
  expect(calls[0].event).toBe("article_viewed");
  expect(calls[0].options.props.content_type).toBe("article");
  expect(calls[0].options.props.content_name).toMatch(/^article - /);

  return calls[0];
}

export async function testMiniDocPlay(page, testInfo, url) {
  await page.goto(url);
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

  return calls[0];
}
