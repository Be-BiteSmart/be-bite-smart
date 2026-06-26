# Automated website tests

This document explains what our automated tests check on [bebitesmart.org](https://www.bebitesmart.org). It is written so **anyone on the team** can understand the purpose of each test group. Technical details are at the bottom for developers.

---

## In plain English

Every time someone opens or updates a **pull request** to `main`, a robot opens the live website in a browser (without logging in) and asks simple questions:

- Do the important pages load?
- Is the header, navigation, main content, and footer still there?
- Do videos and download buttons still work?
- Are PDFs and videos actually reachable when someone clicks Download?
- Are we accidentally exposing passwords, config files, or backup folders?
- Does Google see the right page titles and descriptions?
- Does the site use secure HTTPS and the correct `www` address?
- Can people with disabilities use the pages (screen readers, keyboard, contrast, etc.)?
- When someone watches a video or downloads a file, does our analytics still record it?

These tests **do not change anything** on the site. They only visit pages and report problems.

---

## Test count

**121 automated checks** across 12 test files (as of the current suite). They are grouped below.

| Group | Tests | What it covers |
|-------|------:|----------------|
| **Smoke — pages & layout** | 11 | Each main page loads with header, nav, content, footer |
| **Smoke — content blocks** | 6 | Key custom blocks on Learn, Evidence, Contact, Donate, Team, Advisors |
| **Smoke — broken links** | 11 | Same-site links on each main page (up to 50 per page) |
| **Smoke — downloads** | 11 | PDF/video download URLs (pages with no downloads are **skipped**) |
| **Smoke — SEO** | 13 | Titles, descriptions, canonicals + `robots.txt` + sitemap |
| **Smoke — HTTPS & host** | 11 | HTTP/`www` redirects (production only; **skipped** on local/staging) |
| **Smoke — security** | 12 | Sensitive files and paths must not be public |
| **Smoke — WordPress API** | 4 | REST API health + key page slugs |
| **Smoke — PDF toggle** | 11 | PDF view buttons and download links validation (pages with no PDF toggles are **skipped**) |
| **Accessibility** | 11 | One scan per main page (WCAG moderate and above) |
| **Analytics** | 14 | Plausible events on plays, downloads, PDFs, language switch |
| **Videos** | 6 | Vimeo embeds on Home and Learn |
| **Total** | **121** | |

Some checks **skip** when they do not apply (e.g. a page with no download buttons). Skipped is not a failure.

---

## Quick overview

| What we check | Tests | Plain-language question | Pages |
|---------------|------:|-------------------------|-------|
| **Pages load & layout** | 11 | Does the page open, and are header, menu, main area, and footer present? | All 11 main pages |
| **Key content blocks** | 6 | Are expected sections still on the page (videos, forms, team bios, etc.)? | Learn, Evidence, Contact, Donate, Team, Advisors |
| **Broken links** | 11 | Do links on the page go somewhere that works? | All 11 main pages |
| **Downloads** | 11 | Do Download links return real PDF or video files? | Any main page that has them |
| **Videos** | 6 | Do Watch buttons load the Vimeo player? | Home, Learn |
| **SEO** | 13 | Title, description, and canonical URL set correctly? | All 11 main pages + sitemap |
| **HTTPS & host** | 11 | Does `http` and non-`www` redirect to `https://www.bebitesmart.org`? | Home + Learn (production only) |
| **Security** | 12 | Are sensitive server files hidden from the public? | Server paths (not page content) |
| **PDF toggle** | 11 | Do PDF view buttons work and download links have valid URLs? | All 11 main pages (skipped if no PDF toggles) |
| **Accessibility** | 11 | WCAG accessibility rules (moderate and above) | All 11 main pages |
| **Analytics** | 14 | Do Plausible events fire on clicks/plays/downloads? | Learn, Home, News, Evidence, Partnerships |
| **WordPress API** | 4 | Can WordPress still serve page data behind the scenes? | API + Learn, Evidence, Contact slugs |

---

## The 11 main pages

Most tests use the same list of important site pages:

| Page | Web address |
|------|-------------|
| Home | `/` |
| Learn | `/learn/` |
| Evidence | `/evidence/` |
| News & media | `/news-media/` |
| Partnerships | `/partnerships/` |
| Contact | `/contact/` |
| Donate | `/donate/` |
| Parents | `/parents/` |
| Legal | `/legal/` |
| Advisors | `/advisors/` |
| Team | `/team/` |

That list lives in one shared config file so developers update it in a single place when a page slug changes:

```14:26:app/public/wp-content/tests/helpers/paths.js
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
```

---

## What each test group does (non-technical)

### Pages load and layout (`paths`) — 11 tests

Visits each main page and confirms it returns a normal page (not “WordPress Error”). Checks that the basic page structure exists: header, navigation, main content, footer.

**Typical failure:** Page is down, cache is broken, or a theme/plugin conflict removed the header or footer.

---

### Key content blocks (`blocks`) — 6 tests

Checks that specific **custom content** is still visible on certain pages—for example:

| Page | What must be there |
|------|-------------------|
| Learn | Documentary video block, episode cards, download cards |
| Evidence | Research article cards |
| Contact | Contact form |
| Donate | PayPal donate button |
| Team | At least 3 team bio cards |
| Advisors | At least 3 advisor bio cards |

**Typical failure:** A block was removed in the WordPress editor, or content was unpublished.

---

### Broken links (`links`) — 11 tests

On **all 11 main pages**, follows same-site links (up to 50 per page) and flags any that return an error.

**Typical failure:** A link points to a deleted page or wrong URL.

---

### Download files (`downloads`) — 11 tests

Automatically finds Download buttons on any main page (PDF toggles, episode videos, coloring books). For each link found, confirms the file actually loads—not a 404 or empty response.

Pages with no downloads are skipped.

**Typical failure:** A PDF was moved in the Media Library but the button still points to the old URL.

---

### Videos (`videos`) — 6 tests

Clicks Watch / play buttons and confirms the Vimeo embed appears with the correct video.

**Typical failure:** Vimeo ID changed, block removed, or JavaScript error on the page.

---

### SEO (`seo`) — 13 tests

For each main page:

- Browser tab title is filled in
- Canonical URL tag points to the correct `https://www.bebitesmart.org/...` address
- Meta description is present and long enough for search snippets

Also checks `/robots.txt` and the XML sitemap load correctly.

**Typical failure:** Missing meta description in All in One SEO (currently **Advisors** page), or wrong canonical after a URL change.

---

### HTTPS and canonical host (`https-host`) — 11 tests

Confirms visitors who type `http://bebitesmart.org` or `https://bebitesmart.org` (without `www`) end up on **`https://www.bebitesmart.org`**.

Only runs against production—not local or staging copies.

**Typical failure:** DNS or hosting redirect misconfiguration.

---

### Security hygiene (`security`) — 12 tests

Looks for files and folders that **must not** be readable in a browser, for example:

- `.env`, `wp-config.php`, debug logs
- `readme.html`, `license.txt` (reveal WordPress version)
- Backup folders, `.git`, `composer.json`
- XML-RPC discovery

**Typical failure:** Default WordPress files still in the web root, or backups left in a public folder.

**Known production gaps (tests currently fail until fixed):**

| Item | Issue |
|------|--------|
| `readme.html` | Publicly readable — should be deleted or blocked |
| `license.txt` | Publicly readable — should be deleted or blocked |
| `xmlrpc.php?rsd` | XML-RPC discovery exposed — disable or block |

---

### Accessibility (`a11y`) — 11 tests

Uses the [axe](https://www.deque.com/axe/) tool to scan each main page for accessibility problems (WCAG 2.0/2.1 Level A and AA, plus best practices). Fails on **critical, serious, and moderate** issues; minor issues are listed in the report but do not fail the build.

YouTube/Vimeo iframes are excluded from the scan.

On **Advisors** and **Team**, the test waits for bio cards to appear in the page before scanning — so a cached or incomplete HTML response cannot produce a false pass.

**Why can two CI runs disagree on the same URL?** Tests read the **live production site**, not your PR branch. The URL is always `https://www.bebitesmart.org/advisors/`, but the HTML can differ between runs:

- **WP Super Cache** may serve an older page without newly added blocks (PR run: no bio cards → color-contrast passes; later run: bio cards with weak gray text → fails).
- **Content or CSS deploys** between runs (e.g. affiliation color `#7b828e` failing, then plugin CSS `#6b7280` passing after deploy).

That is **not** caused by `pull_request` vs `push` triggers. Block-presence checks and the bio-card wait before axe reduce false passes.

**Typical failure:** Missing alt text, color contrast, duplicate landmarks, heading order, etc.

Open the HTML report attachment **“{Page} — what was checked”** for a plain-English list of rules that passed or failed.

---

### Analytics (`analytics`) — 14 tests

Simulates user actions (watch video, download file, open PDF, switch language, click article links) and checks that **Plausible** analytics events fire with the expected names—for example `documentary-watched`, `episodes-watched-english`, `coloring-books-downloaded-spanish`.

**Typical failure:** Analytics script removed, cache serving old HTML, or button markup changed.

---

### WordPress API (`rest-api`) — 4 tests

Confirms WordPress’s background API responds and that key pages (`learn`, `evidence`, `contact`) can still be found by slug.

**Typical failure:** Permalink or REST API issue after a hosting change.

---

## When tests run

Tests run automatically on **pull requests targeting `main`** via GitHub Actions (`.github/workflows/playwright.yml`). They do not run on direct pushes to `main` (after merge, the PR run already validated the changes). By default they target the **live production site** (`https://www.bebitesmart.org`).

### Merging when production must be updated first

Sometimes a PR **fixes** a problem that CI is still reporting on the live site—for example, a CSS color change that only takes effect after DreamHost pulls `main` and WP Super Cache is cleared. The tests always hit **production**, not your branch, so the PR can stay red until deploy catches up.

**Repo admins** can use the GitHub **ruleset bypass** on `main` to merge anyway:

1. Open the pull request → **Merge** → choose **Bypass rules** (wording may be “Merge without waiting”).
2. After merge, SSH to DreamHost and deploy: `cd bebitesmart.org/wp-content && git pull origin main && rm -rf cache/supercache/*`
3. Re-run **Playwright Tests** on `main` (Actions tab) to confirm green.

Use the bypass only when the failure is a known production lag (fix is in the PR, live site not updated yet)—not to ignore real regressions. See [README — Deploying to the server](./README.md#deploying-to-the-server) for full deploy steps.

```20:22:app/public/wp-content/package.json
  "scripts": {
    "test": "playwright test",
    "test:ci": "playwright test --reporter=html,dot,github"
```

---

## How to read results

### On GitHub

1. Open the repository → **Actions** tab
2. Click the latest **Playwright Tests** workflow run
3. Green check = passed; red X = something failed
4. Download the **playwright-report** artifact for a visual HTML report

### In the HTML report

- Each test shows **pass**, **fail**, or **skipped**
- Expand a test to see **attachments** (JSON details, explanations like “Why this check matters” for security tests)
- Accessibility tests include a readable summary of what was scanned

### Skipped tests

Some tests skip on purpose—for example, a page with no download links, or HTTPS/host checks when not running against production. Skipped is **not** a failure.

---

## If something fails — common causes

| Symptom | Often means |
|---------|-------------|
| Page won’t load | Server error, plugin conflict, or cache needs purge |
| Block missing | Content removed in WordPress editor |
| Download fails | Wrong Media Library URL or CDN/worker down |
| SEO fails | Fill in title/description in All in One SEO |
| Security fails | Remove or block exposed files (see security section) |
| Accessibility fails | Fix markup in theme, plugin, or page content |
| Analytics fails | Deploy latest theme/plugin; purge WP Super Cache |

**We do not test:** WordPress admin login, search, or checkout flows.

---

## For technical readers

### Repository layout

```
app/public/wp-content/
├── TESTING.md              ← this file
├── playwright.config.js    ← base URL, timeouts, reporters
├── package.json            ← pnpm scripts
└── tests/
    ├── smoke/              ← fast production health checks
    │   ├── paths.spec.js
    │   ├── blocks.spec.js
    │   ├── links.spec.js
    │   ├── downloads.spec.js
    │   ├── seo.spec.js
    │   ├── https-host.spec.js
    │   ├── security.spec.js
    │   └── rest-api.spec.js
    ├── a11y/
    │   └── axe.spec.js
    ├── analytics/
    │   └── events.spec.js
    ├── videos/
    │   └── loading.spec.js
    └── helpers/            ← shared config and utilities
        ├── paths.js
        ├── page.js
        ├── links.js
        ├── downloads.js
        ├── seo.js
        ├── host.js
        └── security.js
```

### Run locally

From `app/public/wp-content`:

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium   # first time only
pnpm test                             # all 110 tests
pnpm exec playwright test --list      # print full list and count
```

Run one suite:

```bash
pnpm exec playwright test tests/smoke/security.spec.js
pnpm exec playwright test tests/a11y/axe.spec.js
pnpm exec playwright show-report      # open last HTML report
```

### Target a different site

Set `PLAYWRIGHT_BASE_URL` (default: `https://www.bebitesmart.org`):

```bash
PLAYWRIGHT_BASE_URL=http://bebitesmart.local pnpm test
```

HTTPS/host tests skip automatically when the base URL is not production.

### Tests that target production

Most tests can run against any environment (local, staging, or production) by setting `PLAYWRIGHT_BASE_URL`. However, some tests **intentionally target production** and skip on other environments:

| Test suite | Why it targets production | How it skips on non-production |
|-----------|--------------------------|--------------------------------|
| **Security hygiene** (`security.spec.js`) | Verifies real server-level security posture (sensitive paths, config files, bot-blocking rules) which may differ between environments. Production is the authoritative source for security validation. | No automatic skip - runs against whatever `PLAYWRIGHT_BASE_URL` is set to. Set to production to verify live security. |
| **HTTPS and canonical host** (`https-host.spec.js`) | Validates DNS and hosting infrastructure (HTTP→HTTPS redirects, non-www→www redirects) which are production-specific configuration. Staging/local may not have the same redirect rules. | Skips automatically via `shouldRunHostChecks()` when `baseURL` is not `https://www.bebitesmart.org` |

**Why security tests target production:**
- Security posture (bot-blocking, IP bans, .htaccess rules) may differ between environments
- Production is the only environment that reflects the real security configuration users face
- Network-level blocking (like the bot-blocking rule that caused "socket hang up" errors) is production-specific
- The test includes retry logic to handle transient network failures while still validating security

**Why HTTPS/host tests target production:**
- DNS and SSL configuration are production infrastructure settings
- Redirect rules (http://, non-www) are typically only configured on the production domain
- Staging environments often use different domains or lack proper redirect setup

**Future developers:** When adding new tests, consider whether they need to validate production-specific infrastructure. If so, document the reason here and implement a skip mechanism for non-production environments.

### Configuration

```18:23:app/public/wp-content/playwright.config.js
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "https://www.bebitesmart.org",
    headless: true,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
```

### Changing what is tested

| To change… | Edit… |
|------------|-------|
| Which pages are “critical” | `tests/helpers/paths.js` → `CRITICAL_PAGES` |
| Block presence rules | `tests/helpers/paths.js` → `BLOCK_PRESENCE_PAGES` |
| Download scan patterns | `tests/helpers/paths.js` → `DOWNLOAD_CHECKS` |
| Security paths | `tests/helpers/security.js` → `SENSITIVE_PATHS` |
| Link check scope / per-page cap | `tests/helpers/paths.js` → `LINK_CHECK_PAGES`, `LINK_CHECK_MAX_LINKS` |

### CI workflow

```36:39:app/public/wp-content/.github/workflows/playwright.yml
      - name: Run tests
        run: pnpm run test:ci
        env:
          CI: true
```

The HTML report is uploaded as a 30-day artifact for debugging failed runs.

---

## Related docs

- [README.md — Playwright section](./README.md#playwright-tests) — install commands and short tables
- [CHANGES.md](./CHANGES.md) — log of test additions and known issues
