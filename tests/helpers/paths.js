/** Home page. */
export const HOME_PATH = "/";

/** WordPress page slug for the Learn / education content page. */
export const EDUCATION_PATH = "/learning/kids";

/** Research articles page (formerly `/library`). */
export const EVIDENCE_PATH = "/evidence/";

/**
 * Critical site routes — single source of truth for smoke and E2E tests.
 * Update here when WordPress page slugs change.
 */
export const CRITICAL_PAGES = [
  { path: HOME_PATH, label: "Home" },
  { path: EDUCATION_PATH, label: "Learn" },
  { path: EVIDENCE_PATH, label: "Evidence" },
  { path: "/news-media/", label: "News & media" },
  { path: "/partnerships/", label: "Partnerships" },
  { path: "/contact/", label: "Contact" },
  { path: "/donate/", label: "Donate" },
  { path: "/parents/", label: "Parents" },
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
        name: "documentary video block",
        selector: ".video-quote-block",
        minCount: 1,
      },
      {
        name: "developed episode cards",
        selector: "#developed-episodes article",
        minCount: 1,
      },
      {
        name: "download cards",
        selector: ".download-card-block",
        minCount: 1,
      },
    ],
  },
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
export const REST_PAGE_SLUGS = ["learn", "evidence", "contact"];
