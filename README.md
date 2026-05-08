# Be Bite Smart WP Content

[![Playwright Analytics Tests](https://github.com/ghiblimagic/be-bite-smart/actions/workflows/playwright.yml/badge.svg)](https://github.com/ghiblimagic/be-bite-smart/actions/workflows/playwright.yml)

> **Scope:** This repo contains non-sensitive theme, plugin, analytic and test logic only.
> Sensitive server configuration files such as `wp-config.php` are not tracked
> here. To edit those, log into DreamHost and use the file manager directly.

### How to use the DreamHost File Manager to Change Sensitive Information

Step 1. Click SFTP Users & Files under Websites

![in the menu to the left find the website button, click it, then click the SFTP Users and files submenu item](readme-images/dreamhost-file-manager-step-1.png)

Step 2: Look for the username that has the domain name "bebitesmart.org" attached to i. Click File manager

![the items are placed in a single row, so once the domain bebitesmart.org is found you can click the file manager](readme-images/dreamhost-file-manager-step-2.png)

Step 3: Select the bebitesmart.org folder, then click the sensitive file you need to edit and select edit

![Show wp-config.php highlighted with a dropdown with edit as the first selectable element](readme-images/dreamhost-file-manager-step-3.png)

## Repository structure

This repo tracks the full `wp-content` directory. Two subdirectories have a
build step required when changing CSS:

- `themes/twentytwentyfive-child` run `npm run build` from inside this folder
- `plugins/custom-blocks-for-be-bite-smart` run `npm run build` from inside this folder

Each folder has its own `package.json` and `webpack.config.js`, so the build
must be run from inside the relevant folder, running it from the `wp-content`
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

## Quick Start: Setting Up Locally

### Step 1: Log into WordPress

Navigate to `bebitesmart.org/wp-admin` and log in.

### Step 2: Back up the site with Duplicator

In the WordPress dashboard, go to **Duplicator > Packages** and click
**Create New**. Once complete, click **Download Installer** and
**Download Archive** to save both files locally.

![](readme-images/back-up-site-duplicator.png)

**If the download button shows "problem loading web page":**
Log into DreamHost and open the file manager. Navigate to
`bebitesmart.org/wp-content/backups-dup-lite` and download the matching
`.zip` file. You can also download the installer.php.bak file from this folder, but it
will need to be renamed to `installer.php` before use.

You must use the matching installer for that backup, each installer.php is specific to the zip backup.

### Step 3: Set up a local WordPress site with LocalWP

1. Open [LocalWP](https://localwp.com/), click the + button to start a new site.

2. Drag the zip into the "select an existing ZIP or drag your file into the window to import a site' area.

3. Local will automatically detect the package and prompt you to set up a new site.

4. Follow the prompted steps to complete the import

### Step 4: Open the project in VS Code

In LocalWP, right-click your site and select **Open Site Folder** (or the
equivalent option to reveal it in your file manager). Open that folder in
VS Code. any edits made there will be reflected on your local site
immediately.

### Step 5: Install dependencies

Run `npm install` in each subdirectory that has a build step:

```bash
cd themes/twentytwentyfive-child && npm install
cd ../../plugins/custom-blocks-for-be-bite-smart && npm install
```

The `.git` folder is already present since Duplicator included it in the
backup, so there is no need to run `git init` or clone the repo again.

### Step 6: Push changes to GitHub and sync the server

#### Setting up SSH access

You will need two SSH keys. one for GitHub and one for DreamHost. Both need
to be set up once before you can push and deploy.

- **GitHub SSH key** follow [GitHub's guide to generating an SSH key and adding it to your account](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)

- **DreamHost SSH key** follow [DreamHost's guide to enabling SSH and adding your key](https://help.dreamhost.com/hc/en-us/articles/216499537)

#### Deploying to the server

Once your SSH key is set up, connect to the server with:

```bash
ssh -i path/to/your-key/.ssh/id_ed##### YourSFTPUsername@bebitesmart.org
```

Replace `path/to/your-key` with the location of your SSH key on your machine
and `id_ed#####` with your actual key filename.
Your SFTP username can be found in DreamHost under **Websites > SFTP Users & Files**.

Then pull the latest changes and clear the cache:

```bash
cd bebitesmart.org/wp-content && git pull origin main && rm -rf cache/supercache/*
```

This pulls the latest commit from `main` and clears WP Super Cache so
visitors immediately see the updated site.

---

## Making Changes to the Child Theme Or Plugin

After editing CSS or any logic that goes through the build process in either
location below, run `npm run build` before committing. Otherwise browsers will
serve stale cached stylesheets or logic.

**Child theme** `app/public/wp-content/themes/twentytwentyfive-child`

```bash
cd app/public/wp-content/themes/twentytwentyfive-child
npm run build
```

**Custom blocks plugin** `app/public/wp-content/plugins/custom-blocks-for-be-bite-smart`

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

- **Correct styles do NOT appear in incognito** You likely forgot to run
  `npm run build` before pushing. Confirm by checking the relevant
  `build/*.asset.php` file on GitHub or on the DreamHost server to see if the file updated.

- **Correct styles DO appear in incognito but not in your logged-in session**

  The build and server are fine. WordPress doesn't cache pages for logged-in
  users, so they should always receive a fresh page with the updated stylesheet URL.

  Occasionally a browser will still serve the old stylesheet from its own
  cache despite the URL changing. This is the browser misbehaving, not a
  build or server issue. A hard refresh (`Ctrl+Shift+R` / `Cmd+Shift+R`) forces the browser to bypass its cache and fetch the latest version.
