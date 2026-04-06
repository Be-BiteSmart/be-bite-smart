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

export async function testOutboundArticleClick(page, testInfo, url) {
  await page.goto(url);

  // Acts like an event listener — stays active for the lifetime of the context,
  // intercepting every matching request after registration.
  await page.context().route("**/*", (route, request) => {
    try {
      if (request.frame() !== page.mainFrame()) {
        // New tab request — abort it.
        // request.frame() can throw if the frame hasn't been created yet,
        // the catch below handles that case.
        route.abort();
        return;
      }
    } catch {
      // request.frame() threw — the frame doesn't fully exist yet, meaning this is
      // a new tab navigation mid-creation. Abort it.
      route.abort();
      return;
    }
    route.continue();
  });

  const links = page.locator(
    ".custom-block-card a.block-toggle-btn[target='_blank']",
  );
  const linkCount = await links.count();
  const allCalls = [];

  for (let i = 0; i < linkCount; i++) {
    await spyOnPlausible(page);
    await links.nth(i).click();
    // target="_blank" opens in a new tab — spy stays intact on the current page,
    // and the route handler above aborts the new tab before it loads.
    await page.waitForTimeout(500);

    const calls = await getPlausibleCalls(page);
    await testInfo.attach(`link ${i + 1} of ${linkCount} plausible event`, {
      body: JSON.stringify(calls, null, 2),
      contentType: "application/json",
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].event).toBe("article_viewed");
    expect(calls[0].options.props.content_type).toBe("article");
    expect(calls[0].options.props.content_name).toMatch(/^article - /);

    allCalls.push(calls[0]);
  }

  await testInfo.attach("all article click events", {
    body: JSON.stringify(allCalls, null, 2),
    contentType: "application/json",
  });

  return allCalls;
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
