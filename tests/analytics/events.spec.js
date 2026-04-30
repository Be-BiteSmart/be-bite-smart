import { test, expect } from "@playwright/test";
import {
  spyOnPlausible,
  getPlausibleCalls,
  testEpisodeLanguage,
  testOutboundArticleClick,
  testMiniDocPlay,
} from "./helpers/plausible";

// ── Education page ─────────────────────────────────────────────

// ************ EPISODES WATCHED ********************

test("Watch Now fires video_watched for all episodes in both languages", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  // long timeout since it has to wait for iframes multiple times
  await page.goto("/education");

  const episodes = page.locator("#developed-episodes article");
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

// ********************** EPISODE DOWNLOADS *********************

test("Download video fires video_downloaded for all episodes in both languages", async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  await page.goto("/education");

  const sections = page.locator(
    "#download-videos .educational-content-download-block",
  );
  const sectionCount = await sections.count();
  const allCalls = [];

  for (let i = 0; i < sectionCount; i++) {
    const section = sections.nth(i);
    const title = await section.locator(".ecd-title").textContent();
    const episodeLabel = await section
      .locator(".capitalized-and-colored")
      .textContent();

    const downloads = [
      // the ecd-toggle--download elements do not have data-attributes to say what language they are
      // so instead the only way we can figure out if they're english or spanish is with the text
      { selector: ".ecd-toggle--download[data-lang='en']", lang: "english" },
      { selector: ".ecd-toggle--download[data-lang='es']", lang: "spanish" },
    ];

    for (const { selector, lang } of downloads) {
      await spyOnPlausible(page);

      // Intercept the download so the browser doesn't try to save a file
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        section.locator(selector).click(),
      ]);
      await download.cancel();

      const calls = await getPlausibleCalls(page);
      await testInfo.attach(`${episodeLabel} ${lang} plausible event`, {
        body: JSON.stringify(calls, null, 2),
        contentType: "application/json",
      });

      expect(calls).toHaveLength(1);
      expect(calls[0].event).toBe("video_downloaded");
      expect(calls[0].options.props.content_type).toBe("download");
      expect(calls[0].options.props.content_language).toBe(lang);
      expect(calls[0].options.props.content_name).toMatch(
        new RegExp(`^video - .+ - ${lang}$`),
      );

      allCalls.push({ episode: episodeLabel.trim(), lang, ...calls[0] });
    }
  }

  await testInfo.attach("all download events", {
    body: JSON.stringify(allCalls, null, 2),
    contentType: "application/json",
  });

  expect(allCalls).toHaveLength(sectionCount * 2);
});

// ********************** COLORING BOOK ********************
test("Coloring Book PDF toggle fires pdf_viewed for all available episodes", async ({
  page,
}, testInfo) => {
  await page.goto("/education");

  const sections = page.locator(
    "#download-coloring-books .educational-content-download-block",
  );
  const sectionCount = await sections.count();
  const allCalls = [];

  for (let i = 0; i < sectionCount; i++) {
    const section = sections.nth(i);
    const episodeLabel = await section
      .locator(".capitalized-and-colored")
      .textContent();
    const title = await section.locator(".ecd-title").textContent();
    const label = `${episodeLabel.trim()} - ${title.trim()}`;

    const allButtons = section.locator(".ecd-toggle");
    const buttonCount = await allButtons.count();

    for (let j = 0; j < buttonCount; j++) {
      const btn = allButtons.nth(j);
      const classList = (await btn.getAttribute("class")) ?? "";

      if (classList.includes("ecd-toggle--coming-soon")) {
        await testInfo.attach(`${label} button ${j + 1} status`, {
          body: "skipped — coming soon",
          contentType: "text/plain",
        });
        continue;
      }

      const lang = await btn.getAttribute("data-lang");

      await spyOnPlausible(page);
      await btn.click();
      await page.waitForTimeout(500);

      const calls = await getPlausibleCalls(page);
      await testInfo.attach(`${label} ${lang} plausible event`, {
        body: JSON.stringify(calls, null, 2),
        contentType: "application/json",
      });

      expect(calls).toHaveLength(1);
      expect(calls[0].event).toBe("pdf_viewed");
      expect(calls[0].options.props.content_type).toBe("pdf");
      expect(calls[0].options.props.content_language).toMatch(
        /english|spanish/,
      );
      expect(calls[0].options.props.content_name).toMatch(/^pdf - /);

      allCalls.push({ episode: label, lang, ...calls[0] });

      await btn.click();
      await page.waitForTimeout(300);
    }
  }

  await testInfo.attach("all coloring book pdf events", {
    body: JSON.stringify(allCalls, null, 2),
    contentType: "application/json",
  });
});

// *************** PDF NOT FIRING AGAIN ON CLOSE **************

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

// *********** DOCUMENTARY ON EDUCATION PAGE WORKS ************

test("Documentary on Education page play fires video_watched without content_language", async ({
  page,
}, testInfo) => {
  await testMiniDocPlay(page, testInfo, "/education");
});

// ── News / Legal pages ─────────────────────────────────────────

// ***************** ARTICLE OUTBOUND LINK CLICK WORKS ************

test("News Page Outbound Article link click fires article_viewed", async ({
  page,
}, testInfo) => {
  await testOutboundArticleClick(page, testInfo, "/news-media");
});

// ****************  READ MORE WORKS **********************

test("News Page Read More fires article_viewed", async ({ page }, testInfo) => {
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

// ***************** ARTICLE OUTBOUND CLICK ****************

test("Library Page Article link click fires article_viewed", async ({
  page,
}, testInfo) => {
  await testOutboundArticleClick(page, testInfo, "/library");
});

// ── Home page ──────────────────────────────────────────────────

// ************ MINI DOC HOME PAGE **************************

test("Home Page Documentary play fires video_watched", async ({
  page,
}, testInfo) => {
  await testMiniDocPlay(page, testInfo, "/");
});

// ********************** PDF TOGGLE BLOCK *********************

test("PDF toggle block fires pdf_viewed for all available languages", async ({
  page,
}, testInfo) => {
  await page.goto("/education");

  const blocks = page.locator(".pdf-toggle-block");
  const blockCount = await blocks.count();
  const allCalls = [];

  for (let i = 0; i < blockCount; i++) {
    const block = blocks.nth(i);

    // Grab EN and ES buttons by testid prefix within this block
    const buttons = [
      { testidPrefix: "pdf-btn-en-", lang: "english" },
      { testidPrefix: "pdf-btn-es-", lang: "spanish" },
    ];

    for (const { testidPrefix, lang } of buttons) {
      const btn = block.locator(`[data-testid^="${testidPrefix}"]`);

      // Skip if this language's PDF wasn't uploaded for this block
      if ((await btn.count()) === 0) {
        await testInfo.attach(`block ${i + 1} ${lang} status`, {
          body: "skipped — no PDF uploaded",
          contentType: "text/plain",
        });
        continue;
      }

      const testId = await btn.getAttribute("data-testid");

      await spyOnPlausible(page);
      await btn.click();
      await page.waitForTimeout(500);

      const calls = await getPlausibleCalls(page);
      await testInfo.attach(`${testId} plausible event`, {
        body: JSON.stringify(calls, null, 2),
        contentType: "application/json",
      });

      expect(calls).toHaveLength(1);
      expect(calls[0].event).toBe("pdf_viewed");
      expect(calls[0].options.props.content_type).toBe("pdf");
      expect(calls[0].options.props.content_language).toBe(lang);
      expect(calls[0].options.props.content_name).toMatch(/^pdf - /);

      allCalls.push({ block: i + 1, testId, lang, ...calls[0] });

      // Close before moving to next button
      await btn.click();
      await page.waitForTimeout(300);
    }
  }

  await testInfo.attach("all pdf toggle events", {
    body: JSON.stringify(allCalls, null, 2),
    contentType: "application/json",
  });
});

// ************ PDF TOGGLE BLOCK DOES NOT RE-FIRE ON CLOSE ************

test("PDF toggle block does not fire pdf_viewed when closing", async ({
  page,
}, testInfo) => {
  await page.goto("/education");

  // Grab the first available toggle button across any block
  const btn = page.locator("[data-testid^='pdf-btn-en-']").first();

  // Open it (we don't care about this event)
  await btn.click();
  await page.waitForTimeout(500);

  // Now spy AFTER it's open, then close
  await spyOnPlausible(page);
  await btn.click();
  await page.waitForTimeout(500);

  const calls = await getPlausibleCalls(page);
  await testInfo.attach("plausible events on close", {
    body: JSON.stringify(calls, null, 2),
    contentType: "application/json",
  });

  expect(calls).toHaveLength(0);
});
