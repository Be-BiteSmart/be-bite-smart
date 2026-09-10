/** Home page. */
export const HOME_PATH = "/";

/** WordPress page slug for the Learn / education content page. */
export const EDUCATION_PATH = "/learning/kids";

/** The Learning hub landing page (content-hub-plan's "/learning/"). */
export const LEARNING_HUB_PATH = "/learning/";

/** Downloadable Educational Resources page — download-card / PDF / episode-download content. */
export const DOWNLOADS_PATH = "/learning/downloads";

/** Books and Links page (book recommendation cards). */
export const BOOKS_PATH = "/learning/books";

/** After a Bite Resources — a Stage-style Q&A search/browse page outside the Stage taxonomy hierarchy. */
export const AFTER_BITE_PATH = "/learning/bite";

/** A Parents' Guide to Preventing Dog Bites in Young Children (guide_chapter CPT, headless). */
export const GUIDE_PATH = "/learning/guide";

/** The Guide's citations/sources subpage. */
export const GUIDE_REFERENCES_PATH = "/learning/guide/references";

/** Stage taxonomy index hub — currently empty (2026-09-09), not yet populated. */
export const STAGES_HUB_PATH = "/learning/stages";

/** Second, empty "Contact" page under /learning/ — distinct from the real /contact/. Flagged as likely a stray stub. */
export const LEARNING_CONTACT_PATH = "/learning/contact";

/**
 * Q&A entry search/browse pages: custom/learning-search + custom/learning-browse,
 * rendering article.wp-block-custom-qa-entry cards — After a Bite plus each
 * live Stage taxonomy page. Shared list so CRITICAL_PAGES and
 * BLOCK_PRESENCE_PAGES stay in sync; update here if a Stage page is added/removed.
 */
export const QA_SEARCH_PAGES = [
  { path: AFTER_BITE_PATH, label: "After a Bite" },
  { path: "/learning/stages/pregnancy", label: "Stage: Pregnancy" },
  { path: "/learning/stages/baby", label: "Stage: Baby" },
  { path: "/learning/stages/toddler", label: "Stage: Toddler" },
  { path: "/learning/stages/preschool", label: "Stage: Preschool" },
  { path: "/learning/stages/all-resources", label: "Stage: All Resources" },
];

/** Research articles page (formerly `/library`). */
export const EVIDENCE_PATH = "/evidence/";

/**
 * Pages where the documentary "video-quote" block currently lives —
 * moved off EDUCATION_PATH (2026-09-09) onto Home and the Learning hub.
 * Update here (not per-test) if it moves again.
 */
export const VIDEO_QUOTE_PAGES = [
  { path: HOME_PATH, label: "Home" },
  { path: LEARNING_HUB_PATH, label: "Learning hub" },
];

/**
 * Critical site routes — single source of truth for smoke and E2E tests.
 * Update here when WordPress page slugs change.
 */
export const CRITICAL_PAGES = [
  { path: HOME_PATH, label: "Home" },
  { path: LEARNING_HUB_PATH, label: "Learning hub" },
  { path: EDUCATION_PATH, label: "Learn" },
  { path: DOWNLOADS_PATH, label: "Downloads" },
  { path: BOOKS_PATH, label: "Books" },
  { path: GUIDE_PATH, label: "Guide" },
  { path: GUIDE_REFERENCES_PATH, label: "Guide references" },
  ...QA_SEARCH_PAGES,
  // Empty pages (2026-09-09) — still checked for basic structure/a11y even
  // with no body content yet; see STAGES_HUB_PATH/LEARNING_CONTACT_PATH docs.
  { path: STAGES_HUB_PATH, label: "Stages hub" },
  { path: LEARNING_CONTACT_PATH, label: "Learning contact" },
  { path: EVIDENCE_PATH, label: "Evidence" },
  { path: "/news-media/", label: "News & media" },
  { path: "/partnerships/", label: "Partnerships" },
  { path: "/contact/", label: "Contact" },
  { path: "/donate/", label: "Donate" },
  { path: "/legal/", label: "Legal" },
  { path: "/advisors/", label: "Advisors" },
  { path: "/team/", label: "Team" },
];

/** Pages scanned for axe violations (critical / serious / moderate; read-only production checks). */
export const A11Y_CHECK_PAGES = CRITICAL_PAGES;

/**
 * Before axe runs, wait for these selectors so cached or slow HTML does not
 * produce a false pass (e.g. Advisors scanned before bio cards are in the DOM).
 */
export const A11Y_PAGE_READY_SELECTORS = {
  "/advisors/": "article.wp-block-custom-bio-card",
  "/team/": "article.wp-block-custom-bio-card",
};

/** Pages checked for title, canonical URL, and meta description (read-only production). */
export const SEO_CHECK_PAGES = CRITICAL_PAGES;

/** Default cap on same-origin links checked per page (limits CI time). */
export const LINK_CHECK_MAX_LINKS = 50;

/** Pages scanned for broken same-origin links — all critical pages. */
export const LINK_CHECK_PAGES = CRITICAL_PAGES.map(({ path, label }) => ({
  path,
  label,
  maxLinks: LINK_CHECK_MAX_LINKS,
}));

/** Shared selectors for download-card / PDF-toggle blocks (production-backed). */
export const DOWNLOAD_CHECKS = {
  pdfToggle: {
    name: "PDF-toggle downloads",
    selector: ".pdf-toggle-block .download-card-pdf-download",
    expectedMimePrefixes: ["application/pdf"],
  },
  episodeVideos: {
    name: "episode video downloads",
    selector: "#download-videos .ecd-toggle--download",
    expectedMimePrefixes: ["video/mp4"],
  },
  coloringBooks: {
    name: "coloring book PDFs",
    selector: "#download-coloring-books .download-card-pdf-download",
    expectedMimePrefixes: ["application/pdf"],
  },
};

/** Download link patterns auto-scanned on every critical page (skip when none found). */
export const DOWNLOAD_SCAN_CHECKS = Object.values(DOWNLOAD_CHECKS);

/** Page-specific content blocks that should exist on key routes. */
export const BLOCK_PRESENCE_PAGES = [
  {
    path: EDUCATION_PATH,
    label: "Learn",
    checks: [
      {
        // Scoped to the episode card itself (episode-display.php's root
        // element), not the generic `article` tag — custom/read-more also
        // renders an `<article class="expandable-article-block">` wrapper
        // around the later episodes, which would otherwise double-count.
        name: "developed episode cards",
        selector: "#developed-episodes .wp-block-custom-episode",
        minCount: 1,
      },
    ],
  },
  // The documentary video-quote block lives on Home and the Learning hub
  // now, not on EDUCATION_PATH — see VIDEO_QUOTE_PAGES.
  ...VIDEO_QUOTE_PAGES.map(({ path, label }) => ({
    path,
    label,
    checks: [
      {
        name: "documentary video block",
        selector: ".video-quote-block",
        minCount: 1,
      },
    ],
  })),
  {
    // Download cards, episode video downloads, and coloring-book PDFs all
    // moved here from EDUCATION_PATH (2026-09-09) — see DOWNLOADS_PATH.
    path: DOWNLOADS_PATH,
    label: "Downloads",
    checks: [
      {
        name: "download cards",
        selector: ".download-card-block",
        minCount: 1,
      },
      {
        name: "episode video downloads section",
        selector: "#download-videos",
        minCount: 1,
      },
      {
        name: "coloring book downloads section",
        selector: "#download-coloring-books",
        minCount: 1,
      },
    ],
  },
  {
    path: BOOKS_PATH,
    label: "Books",
    checks: [
      {
        name: "book cards",
        selector: "article.wp-block-custom-book",
        minCount: 1,
      },
    ],
  },
  {
    path: GUIDE_PATH,
    label: "Guide",
    checks: [
      {
        name: "guide chapters",
        selector: ".guide-chapter-container",
        minCount: 1,
      },
    ],
  },
  {
    path: GUIDE_REFERENCES_PATH,
    label: "Guide references",
    checks: [
      {
        name: "reference citations",
        selector: ".guide-reference",
        minCount: 1,
      },
    ],
  },
  // After a Bite + each live Stage page — same custom/learning-search +
  // custom/learning-browse block pair, same card markup. See QA_SEARCH_PAGES.
  ...QA_SEARCH_PAGES.map(({ path, label }) => ({
    path,
    label,
    checks: [
      {
        name: "Q&A entry cards",
        selector: "article.wp-block-custom-qa-entry",
        minCount: 1,
      },
    ],
  })),
  {
    path: EVIDENCE_PATH,
    label: "Evidence",
    checks: [
      {
        name: "research article cards",
        selector: "article.wp-block-custom-research-article",
        minCount: 1,
      },
    ],
  },
  {
    path: "/contact/",
    label: "Contact",
    checks: [
      {
        name: "contact form",
        selector: "form.forminator-custom-form",
        minCount: 1,
      },
    ],
  },
  {
    path: "/donate/",
    label: "Donate",
    checks: [
      {
        name: "PayPal donate button",
        selector: 'a[href*="paypal.com/donate"]',
        minCount: 1,
      },
    ],
  },
  {
    path: "/team/",
    label: "Team",
    checks: [
      {
        name: "team bio cards",
        selector: "article.wp-block-custom-bio-card",
        minCount: 3,
      },
    ],
  },
  {
    path: "/advisors/",
    label: "Advisors",
    checks: [
      {
        name: "advisor bio cards",
        selector: "article.wp-block-custom-bio-card",
        minCount: 3,
      },
    ],
  },
];

/** Page slugs used in REST API smoke tests. */
export const REST_PAGE_SLUGS = ["kids", "evidence", "contact"];
