import { test, expect } from "@playwright/test";
import {
  spyOnPlausible,
  getPlausibleCalls,
  ensureLanguageSwitcherLink,
  ensureLanguageAnalyticsHandler,
  firstColoringViewPdfButton,
  firstPdfToggleViewButton,
  gotoExpectOk,
  langToEventSuffix,
  testEpisodeLanguage,
  testOutboundArticleClick,
  testMiniDocPlay,
  downloadCardBlocks,
  downloadCardSections,
  languageDownloadButtons,
  pdfSlugEvents,
} from "./helpers/plausible";

// ── Education page ─────────────────────────────────────────────

// ************ EPISODES WATCHED ********************

test("Watch Now fires episodes-watched for all episodes in both languages", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  // long timeout since it has to wait for iframes multiple times
  await gotoExpectOk(page, "/education");

  const episodes = page.locator("#developed-episodes article");
  const episodeCount = await episodes.count();
  const allCalls = [];

  let expectedCalls = 0;

  for (let i = 0; i < episodeCount; i++) {
    const episode = episodes.nth(i);
    const langSegments = episode.locator(
      ".lang-segment[data-lang], .toggle-label[data-lang]",
    );
    const langCount = await langSegments.count();
    expectedCalls += langCount;

    for (let j = 0; j < langCount; j++) {
      const segment = langSegments.nth(j);
      const code = await segment.getAttribute("data-lang");
      const analyticsLang =
        code === "es" ? "spanish" : code === "hi" ? "hindi" : "english";
      await segment.click();
      allCalls.push(
        await testEpisodeLanguage(page, testInfo, episode, analyticsLang),
      );
    }
  }

  await testInfo.attach("all plausible events", {
    body: JSON.stringify(allCalls, null, 2),
    contentType: "application/json",
  });

  expect(allCalls).toHaveLength(expectedCalls);
});

// ********************** EPISODE DOWNLOADS *********************

test("Download video fires category-downloaded for all episodes in both languages", async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  await gotoExpectOk(page, "/education");

  const { section, block, downloadEvent } = downloadCardBlocks.video;
  const sections = downloadCardSections(page, { section, block });
  const sectionCount = await sections.count();
  const allCalls = [];

  for (let i = 0; i < sectionCount; i++) {
    const row = sections.nth(i);
    const episodeLabel = await row
      .locator(".capitalized-and-colored")
      .textContent();

    for (const { selector, lang } of languageDownloadButtons) {
      await spyOnPlausible(page, { runCallback: true });

      const [download] = await Promise.all([
        page.waitForEvent("download"),
        row.locator(selector).click(),
      ]);
      await download.cancel();

      const calls = await getPlausibleCalls(page);
      await testInfo.attach(`${episodeLabel} ${lang} plausible event`, {
        body: JSON.stringify(calls, null, 2),
        contentType: "application/json",
      });

      expect(calls).toHaveLength(1);
      expect(calls[0].event).toBe(downloadEvent(lang));

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

test("Coloring Book PDF toggle fires coloring-books-viewed for all available episodes", async ({
  page,
}, testInfo) => {
  await gotoExpectOk(page, "/education");

  const { section, block } = downloadCardBlocks.coloring;
  const sections = downloadCardSections(page, { section, block });
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

      const dataLang = await btn.getAttribute("data-lang");
      const lang = langToEventSuffix(dataLang);

      await spyOnPlausible(page);
      await btn.click();
      await page.waitForTimeout(500);

      const calls = await getPlausibleCalls(page);
      await testInfo.attach(`${label} ${dataLang} plausible event`, {
        body: JSON.stringify(calls, null, 2),
        contentType: "application/json",
      });

      expect(calls).toHaveLength(1);
      expect(calls[0].event).toBe(`coloring-books-viewed-${lang}`);

      allCalls.push({ episode: label, lang: dataLang, ...calls[0] });

      await btn.click();
      await page.waitForTimeout(300);
    }
  }

  await testInfo.attach("all coloring book view events", {
    body: JSON.stringify(allCalls, null, 2),
    contentType: "application/json",
  });
});

test("Coloring Book Download fires coloring-books-downloaded for available PDFs", async ({
  page,
}, testInfo) => {
  await gotoExpectOk(page, "/education");

  const { section, block, downloadSelector, downloadEvent } =
    downloadCardBlocks.coloring;
  const sections = downloadCardSections(page, { section, block });
  const sectionCount = await sections.count();
  const allCalls = [];

  for (let i = 0; i < sectionCount; i++) {
    const row = sections.nth(i);
    const episodeLabel = await row
      .locator(".capitalized-and-colored")
      .textContent();

    for (const { dataLang, lang } of [
      { dataLang: "en", lang: "english" },
      { dataLang: "es", lang: "spanish" },
    ]) {
      const link = row.locator(`${downloadSelector}[data-lang='${dataLang}']`);
      if ((await link.count()) === 0) {
        continue;
      }

      await spyOnPlausible(page, { runCallback: true });

      const [download] = await Promise.all([
        page.waitForEvent("download"),
        link.click(),
      ]);
      await download.cancel();

      const calls = await getPlausibleCalls(page);
      await testInfo.attach(`${episodeLabel} ${lang} download plausible event`, {
        body: JSON.stringify(calls, null, 2),
        contentType: "application/json",
      });

      expect(calls).toHaveLength(1);
      expect(calls[0].event).toBe(downloadEvent(lang));

      allCalls.push({ episode: episodeLabel.trim(), lang, ...calls[0] });
    }
  }

  await testInfo.attach("all coloring book download events", {
    body: JSON.stringify(allCalls, null, 2),
    contentType: "application/json",
  });
});

// *************** PDF NOT FIRING AGAIN ON CLOSE **************

test("Education page PDF toggle does not fire again when closing", async ({
  page,
}, testInfo) => {
  await gotoExpectOk(page, "/education");

  const btn = await firstColoringViewPdfButton(page);
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

test("Documentary on Education page play fires documentary-watched", async ({
  page,
}, testInfo) => {
  await testMiniDocPlay(page, testInfo, "/education");
});

// ── News / Legal pages ─────────────────────────────────────────

// ***************** ARTICLE OUTBOUND LINK CLICK WORKS ************

test("News Page Outbound Article link click fires article-viewed", async ({
  page,
}, testInfo) => {
  await testOutboundArticleClick(page, testInfo, "/news-media");
});

// ****************  READ MORE WORKS **********************

test("News Page Read More fires article-viewed", async ({ page }, testInfo) => {
  await gotoExpectOk(page, "/news-media");
  await spyOnPlausible(page);

  const toggles = page.locator(
    ".expandable-article-block .read-more-toggle, .read-more-toggle",
  );
  const toggleCount = await toggles.count();
  await testInfo.attach("read-more toggles on /news-media", {
    body: String(toggleCount),
    contentType: "text/plain",
  });
  expect(
    toggleCount,
    "No Read More buttons on /news-media — add Article, Press Release, or Read More block",
  ).toBeGreaterThan(0);
  await toggles.first().scrollIntoViewIfNeeded();
  await toggles.first().click();
  await page.waitForTimeout(500);

  const calls = await getPlausibleCalls(page);
  await testInfo.attach("plausible events", {
    body: JSON.stringify(calls, null, 2),
    contentType: "application/json",
  });

  expect(calls).toHaveLength(1);
  expect(calls[0].event).toBe("article-viewed");
});

// ── Library page ───────────────────────────────────────────────

// ***************** ARTICLE OUTBOUND CLICK ****************

test("Library Page Article link click fires article-viewed", async ({
  page,
}, testInfo) => {
  await testOutboundArticleClick(page, testInfo, "/library");
});

// ── Home page ──────────────────────────────────────────────────

// ************ MINI DOC HOME PAGE **************************

test("Home Page Documentary play fires documentary-watched", async ({
  page,
}, testInfo) => {
  await testMiniDocPlay(page, testInfo, "/");
});

// ********************** PDF TOGGLE BLOCK *********************

test("Partnership PDF toggle block fires pdf-viewed for all available languages", async ({
  page,
}, testInfo) => {
  await gotoExpectOk(page, "/partnerships");

  const blocks = page.locator(".pdf-toggle-block");
  const blockCount = await blocks.count();
  expect(
    blockCount,
    "No pdf-toggle blocks on /partnerships",
  ).toBeGreaterThan(0);
  const allCalls = [];

  for (let i = 0; i < blockCount; i++) {
    const block = blocks.nth(i);
    const slug = await block.getAttribute("data-track");
    const { viewed: viewEvent } = pdfSlugEvents(slug);

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
      expect(calls[0].event).toBe(viewEvent(lang));

      allCalls.push({ block: i + 1, testId, lang, slug, ...calls[0] });

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

test("Partnership PDF toggle Download fires slug-downloaded for available languages", async ({
  page,
}, testInfo) => {
  await gotoExpectOk(page, "/partnerships");

  const blocks = page.locator(".pdf-toggle-block");
  const blockCount = await blocks.count();
  expect(blockCount, "No pdf-toggle blocks on /partnerships").toBeGreaterThan(0);
  const allCalls = [];

  for (let i = 0; i < blockCount; i++) {
    const block = blocks.nth(i);
    const slug = await block.getAttribute("data-track");
    const { downloaded: downloadEvent } = pdfSlugEvents(slug);

    for (const { dataLang, lang } of [
      { dataLang: "en", lang: "english" },
      { dataLang: "es", lang: "spanish" },
    ]) {
      const link = block.locator(
        `.download-card-pdf-download[data-lang='${dataLang}']`,
      );
      if ((await link.count()) === 0) {
        continue;
      }

      await spyOnPlausible(page, { runCallback: true });

      const [download] = await Promise.all([
        page.waitForEvent("download"),
        link.click(),
      ]);
      await download.cancel();

      const calls = await getPlausibleCalls(page);
      await testInfo.attach(`block ${i + 1} ${lang} download plausible event`, {
        body: JSON.stringify(calls, null, 2),
        contentType: "application/json",
      });

      expect(calls).toHaveLength(1);
      expect(calls[0].event).toBe(downloadEvent(lang));

      allCalls.push({ block: i + 1, lang, slug, ...calls[0] });
    }
  }

  await testInfo.attach("all pdf toggle download events", {
    body: JSON.stringify(allCalls, null, 2),
    contentType: "application/json",
  });
});

// ************ PDF TOGGLE BLOCK DOES NOT RE-FIRE ON CLOSE ************

test("Partnerships PDF toggle block does not fire when closing", async ({
  page,
}, testInfo) => {
  await gotoExpectOk(page, "/partnerships/");

  const btn = await firstPdfToggleViewButton(page);

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

// ********************** TRANSLATEPRESS LANGUAGE SWITCH *********************

test("TranslatePress language switch fires language-switched", async ({
  page,
}, testInfo) => {
  await gotoExpectOk(page, "/");

  const hadProductionSwitcher =
    (await page.locator(".trp-language-switcher a.trp-language-item").count()) > 0;
  const link = await ensureLanguageSwitcherLink(page);
  await testInfo.attach("language switcher source", {
    body: hadProductionSwitcher
      ? "production TranslatePress widget"
      : "injected fixture (widget absent; tests analytics.php delegation only)",
    contentType: "text/plain",
  });
  await expect(link).toBeVisible();

  const lang =
    (await link.locator(".trp-language-item-name").textContent())?.trim().toLowerCase() ||
    (await link.getAttribute("title"))?.trim().toLowerCase() ||
    "unknown";

  const href = await link.getAttribute("href");
  if (href) {
    await page.route(href, (route) => route.abort());
  }

  await spyOnPlausible(page);
  const handlerSource = await ensureLanguageAnalyticsHandler(page);
  await testInfo.attach("language analytics handler", {
    body: handlerSource,
    contentType: "text/plain",
  });
  // Do not run Plausible callback here — it navigates via location.href and clears the spy.
  await link.click();
  await page.waitForTimeout(300);
  const calls = await getPlausibleCalls(page);
  await testInfo.attach("language switch plausible event", {
    body: JSON.stringify(calls, null, 2),
    contentType: "application/json",
  });

  expect(calls).toHaveLength(1);
  expect(calls[0].event).toBe(`language-switched-${lang}`);
});
