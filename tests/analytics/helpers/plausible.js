import { expect } from "@playwright/test";
export {
  EDUCATION_PATH,
  EVIDENCE_PATH,
  HOME_PATH,
  CRITICAL_PAGES,
  LINK_CHECK_PAGES,
  REST_PAGE_SLUGS,
} from "../../helpers/paths.js";
export { gotoExpectOk, assertCriticalDom } from "../../helpers/page.js";
import { gotoExpectOk } from "../../helpers/page.js";

/** Map episode language segment code to Plausible event suffix. */
export function langCodeToAnalytics(code) {
  if (code === "es") return "spanish";
  if (code === "hi") return "hindi";
  return "english";
}

/**
 * @param {{ runCallback?: boolean }} options
 *   runCallback: true for download tracking (trackDownloadClick must run proceed() after the beacon).
 *   Leave false for language switch — production trackThenNavigate's callback sets location.href,
 *   which navigates away and clears _plausibleCalls before we can assert (route.abort does not block that).
 */
export async function spyOnPlausible(page, { runCallback = false } = {}) {
  await page.evaluate((runCallback) => {
    window._plausibleCalls = [];
    window.plausible = function (event, options) {
      window._plausibleCalls.push({ event, options });
      if (runCallback && typeof options?.callback === "function") {
        options.callback();
      }
    };
  }, runCallback);
}

export async function getPlausibleCalls(page) {
  return page.evaluate(() => window._plausibleCalls ?? []);
}

/**
 * Production may disable the TranslatePress floater; inject minimal markup so we can
 * verify document-level delegation in analytics.php (footer script runs before the real widget).
 */
export async function ensureLanguageSwitcherLink(page) {
  if ((await page.locator(".trp-language-switcher a.trp-language-item").count()) > 0) {
    return page.locator(".trp-language-switcher a.trp-language-item").first();
  }

  await page.evaluate(() => {
    const nav = document.createElement("nav");
    nav.className = "trp-language-switcher trp-floating-switcher";
    nav.setAttribute("data-no-translation", "");
    const a = document.createElement("a");
    a.href = "https://www.bebitesmart.org/es/";
    a.className = "trp-language-item";
    a.title = "Spanish";
    const span = document.createElement("span");
    span.className = "trp-language-item-name";
    span.textContent = "Spanish";
    a.appendChild(span);
    nav.appendChild(a);
    document.body.appendChild(nav);
  });

  return page.locator(".trp-language-switcher a.trp-language-item").first();
}

/**
 * When WP Super Cache serves stale footer HTML, the language listener may be missing.
 * Inject the same delegation logic as analytics.php so the test still validates behavior.
 */
export async function ensureLanguageAnalyticsHandler(page) {
  const hasProductionHandler = await page.evaluate(() =>
    /closest\(['"]\.trp-language-switcher a\.trp-language-item['"]\)/.test(
      document.documentElement.innerHTML,
    ),
  );
  if (hasProductionHandler) {
    return "production analytics.php (document delegation present in HTML)";
  }

  await page.evaluate(() => {
    document.addEventListener("click", function (event) {
      const link = event.target.closest(
        ".trp-language-switcher a.trp-language-item",
      );
      if (!link) return;
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const lang =
        link
          .querySelector(".trp-language-item-name")
          ?.textContent?.trim()
          .toLowerCase() ||
        link.getAttribute("title")?.trim().toLowerCase() ||
        "unknown";
      const plausibleEventName = "language-switched-" + lang;
      event.preventDefault();
      let proceeded = false;
      function proceed() {
        if (proceeded) return;
        proceeded = true;
        window.location.href = link.href;
      }
      if (window.plausible) {
        window.plausible(plausibleEventName, { callback: proceed });
        setTimeout(proceed, 750);
      } else {
        proceed();
      }
    });
  });

  return "injected handler (deploy child theme + purge cache for production HTML)";
}

/** Click and wait until the spy records at least one plausible() call. */
export async function clickAndWaitForPlausible(page, locator) {
  const callsReady = page.waitForFunction(
    () =>
      Array.isArray(window._plausibleCalls) &&
      window._plausibleCalls.length > 0,
    { timeout: 5000 },
  );
  await Promise.all([locator.click(), callsReady]);
  return getPlausibleCalls(page);
}

/** Plausible event names for pdf-toggle / download-card when data-track slug is set (or default pdf). */
export function pdfSlugEvents(slug) {
  const base = slug || "pdf";
  return {
    viewed: (lang) => `${base}-viewed-${lang}`,
    downloaded: (lang) => `${base}-downloaded-${lang}`,
  };
}

/** Map download-card button data-lang or test lang string to event suffix. */
export function langToEventSuffix(lang) {
  if (lang === "en" || lang === "english") return "english";
  if (lang === "es" || lang === "spanish") return "spanish";
  if (lang === "hi" || lang === "hindi") return "hindi";
  return lang;
}

/** Short code for episode language picker (english → en). */
export function episodeLangCode(lang) {
  if (lang === "english") return "en";
  if (lang === "spanish") return "es";
  if (lang === "hindi") return "hi";
  return lang;
}

/** Selectors and expected Plausible events per download-card block type. */
export const downloadCardBlocks = {
  video: {
    section: "#download-videos",
    block: ".educational-video-download-block",
    downloadSelector: ".ecd-toggle--download",
    downloadEvent: (lang) => `episode-videos-downloaded-${lang}`,
  },
  coloring: {
    section: "#download-coloring-books",
    block: ".educational-coloring-book-download-block",
    downloadSelector: ".download-card-pdf-download",
    downloadEvent: (lang) => `coloring-books-downloaded-${lang}`,
    pdfToggleSelector:
      ".ecd-toggle:not(.ecd-toggle--download):not(.ecd-toggle--coming-soon)",
    pdfEvent: (lang) => `coloring-books-viewed-${lang}`,
  },
  educationalContent: {
    block: ".educational-content-download-block",
    downloadSelector: ".ecd-toggle--download",
    downloadEvent: (lang) => `educational-content-downloaded-${lang}`,
    pdfToggleSelector:
      ".ecd-toggle:not(.ecd-toggle--download):not(.ecd-toggle--coming-soon)",
    pdfEvent: (lang) => `pdf-viewed-${lang}`,
  },
};

/** First View PDF in #download-coloring-books (same scope as coloring-book view tests). */
export async function firstColoringViewPdfButton(page) {
  const { section, block, pdfToggleSelector } = downloadCardBlocks.coloring;
  const buttons = page.locator(`${section} ${block} ${pdfToggleSelector}`);
  const count = await buttons.count();
  expect(
    count,
    `No View PDF buttons in ${section} — rows may all be Coming soon or section removed`,
  ).toBeGreaterThan(0);
  const first = buttons.first();
  await first.scrollIntoViewIfNeeded();
  return first;
}

/** First View PDF on a pdf-toggle block (class pdf-toggle, not only data-testid). */
export async function firstPdfToggleViewButton(page) {
  const buttons = page.locator(".pdf-toggle-block button.pdf-toggle");
  const count = await buttons.count();
  expect(
    count,
    "No pdf-toggle View PDF buttons — add PDF Toggle block(s) with uploaded PDFs",
  ).toBeGreaterThan(0);
  const first = buttons.first();
  await first.scrollIntoViewIfNeeded();
  return first;
}

/**
 * All download-card rows inside a page section (e.g. #download-videos).
 */
export function downloadCardSections(page, { section, block }) {
  return page.locator(`${section} ${block}`);
}

/** EN/ES download button selectors for a download-card row. */
export const languageDownloadButtons = [
  { selector: ".ecd-toggle--download[data-lang='en']", lang: "english" },
  { selector: ".ecd-toggle--download[data-lang='es']", lang: "spanish" },
];

export async function testEpisodeLanguage(page, testInfo, episode, lang) {
  const episodeNumber = await episode.locator(".episode-number").textContent();
  const code = episodeLangCode(lang);
  const segment = episode.locator(
    `.lang-segment[data-lang='${code}'], .toggle-label[data-lang='${code}']`,
  );

  // ****** Part 1: Check language segment is active ****
  const segmentClass = await segment.getAttribute("class");

  await testInfo.attach(`${episodeNumber} ${lang} segment class`, {
    body: segmentClass,
    contentType: "text/plain",
  });
  await expect(segment).toHaveClass(/active/);

  // Click the play button and spy

  // Spy fresh for this click
  await spyOnPlausible(page);
  await episode.locator(".play-button").click();

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
  expect(calls[0].event).toBe(`episodes-watched-${lang}`);

  return { episode: `${episodeNumber}`.trim(), lang, ...calls[0] };
}

export async function testOutboundArticleClick(page, testInfo, url) {
  const baseURL = testInfo.project.use?.baseURL ?? "https://www.bebitesmart.org";
  await gotoExpectOk(page, url, baseURL);

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
    expect(calls[0].event).toBe("article-viewed");

    allCalls.push(calls[0]);
  }

  await testInfo.attach("all article click events", {
    body: JSON.stringify(allCalls, null, 2),
    contentType: "application/json",
  });

  return allCalls;
}

export async function testMiniDocPlay(page, testInfo, url) {
  const baseURL = testInfo.project.use?.baseURL ?? "https://www.bebitesmart.org";
  await gotoExpectOk(page, url, baseURL);

  const playButton = page.locator(".video-quote-block .play-button");
  const watchCount = await playButton.count();
  const blockCount = await page.locator(".video-quote-block").count();
  await testInfo.attach(`${url} documentary markup`, {
    body: `video-quote-block .play-button: ${watchCount}, video-quote-block: ${blockCount}`,
    contentType: "text/plain",
  });
  expect(
    watchCount,
    `No Documentary Video block on ${url} — add custom/video-quote in the editor`,
  ).toBeGreaterThan(0);

  await spyOnPlausible(page);
  await playButton.first().scrollIntoViewIfNeeded();
  await playButton.first().click();
  await page.waitForTimeout(500);

  const calls = await getPlausibleCalls(page);
  await testInfo.attach("plausible events", {
    body: JSON.stringify(calls, null, 2),
    contentType: "application/json",
  });

  expect(calls).toHaveLength(1);
  expect(calls[0].event).toBe("documentary-watched");

  return calls[0];
}
