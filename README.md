# Be Bite Smart

[![Playwright Analytics Tests](https://github.com/ghiblimagic/be-bite-smart/actions/workflows/playwright.yml/badge.svg)](https://github.com/ghiblimagic/be-bite-smart/actions/workflows/playwright.yml)

## Repository structure

This repo tracks the full `wp-content` directory. Two subdirectories have a
build step required when changing CSS:

- `themes/twentytwentyfive-child` — run `npm run build` from inside this folder
- `plugins/custom-blocks-for-be-bite-smart` — run `npm run build` from inside this folder

Each folder has its own `package.json` and `webpack.config.js`, so the build
must be run from inside the relevant folder — running it from the `wp-content`
root won't work.

Playwright tests and GitHub Actions live in `.github/workflows` and `tests/analytics`. These folders contain no CSS and do not require a build step
so changes can be committed and pushed directly.

## Key Locations:

### Custom Blocks Plugin for Be Bite Smart

CSS and logic for all custom blocks.

`plugins/custom-blocks-for-be-bite-smart`

### Child Theme

Site-wide CSS and logic via `functions.php`. We use a child theme so that
updates to the parent Twenty Twenty-Five theme don't wipe our customisations.

`themes/twentytwentyfive-child`

### Custom Plausible Events

Logic for Plausible to track custom events, such as clicking on a download button.

`themes/twentytwentyfive-child/inc/analytics.php`

### Playwright Tests

Tests that Plausible custom events are firing correctly and returning expected values.

`tests`

### Github Actions

Workflow configuration for automated CI runs. Currently runs the Playwright analytics tests automatically on each push.

`.github/workflows`

---

## Making CSS changes

This repo has 3 separate git locations, two of which use a build step.
After editing CSS in either location below, run `npm run build` before
committing — otherwise browsers will serve the stale cached stylesheet.

**Child theme** — `app/public/wp-content/themes/twentytwentyfive-child`

```bash
cd app/public/wp-content/themes/twentytwentyfive-child
npm run build
```

**Custom blocks plugin** — `app/public/wp-content/plugins/custom-blocks-for-be-bite-smart`

```bash
cd app/public/wp-content/plugins/custom-blocks-for-be-bite-smart
npm run build
```

Then do the normal `git add`, `git commit`, `git push` flow.

### How the cache busting works

Each `src/` entry (e.g. `src/style.js`) imports its CSS file. When `npm run build` runs, webpack generates a `build/*.asset.php` file containing a content hash.

`functions.php` reads this hash via `get_asset()` and passes it as the version
parameter to `wp_enqueue_style()`, appending it as a query string
(e.g. `style.css?ver=abc123`).

When the CSS changes and the build reruns, a new hash is generated and browsers fetch the updated file automatically.

**Why not `filemtime()`?** File modification timestamps aren't preserved on git clone or pull, so the version would change unpredictably across environments.

Content hashing is reliable regardless of how files were deployed.

### Troubleshooting

**Logged-in users still seeing old styles after a deploy**

**Problem:** Occasionally a browser session will stubbornly cache a stylesheet despite a new hash being deployed.

**Solution** Hard refresh
with `Ctrl+Shift+R` / `Cmd+Shift+R` to force a fresh fetch.

**Why this happens** This is a browser quirk, not a build or server issue.

**How to diagnose if its a browser quirk or a bug:** Open the page in an incognito window (logged out).

- **Correct styles do NOT appear in incognito** — you likely forgot to run
  `npm run build` before pushing. Confirm by checking the relevant
  `build/*.asset.php` file on GitHub or on the DreamHost server to see if the file updated.

- **Correct styles DO appear in incognito but not in your logged-in session**
  — the build and server are fine. WordPress doesn't cache pages for logged-in
  users, so they should always receive a fresh page with the updated stylesheet URL.

  Occasionally a browser will still serve the old stylesheet from its own
  cache despite the URL changing — this is the browser misbehaving, not a
  build or server issue. A hard refresh (`Ctrl+Shift+R` / `Cmd+Shift+R`) forces the browser to bypass its cache and fetch the latest version.
