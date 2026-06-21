/** Home page. */
export const HOME_PATH = "/";

/** WordPress page slug for the Learn / education content page. */
export const EDUCATION_PATH = "/learn/";

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

/** Page slugs used in REST API smoke tests. */
export const REST_PAGE_SLUGS = ["learn", "evidence", "contact"];
