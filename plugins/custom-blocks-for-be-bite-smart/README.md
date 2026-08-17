# Custom Blocks for Be BiteSmart

The presentation layer for Be BiteSmart: Gutenberg blocks, front-end
rendering, and admin-editor UI (locked-canvas "fields" panels) for the
content types defined in the sibling content-model plugin. Has a real
`wp-scripts`/webpack build (`src/` → `build/`, managed with pnpm).

See the site-level [README](../../../../README.md) for how this plugin fits
into the bigger picture, and
[Custom Post Types for BBS](../custom-post-types-for-bbs/README.md) for the
content model this plugin reads from.

## Why this is a separate plugin

This plugin only ever *reads* content-model data — `get_post_meta()`,
taxonomy queries, `WP_Query` — to render blocks. It never registers a post
type or taxonomy of its own; "what content exists" (the CPT plugin) is kept
separate from "how it's shown" (this plugin).

## Dependency direction

This plugin's header declares `Requires Plugins: TranslatePress,
custom-post-types-for-bbs` — WordPress won't activate it unless the CPT
plugin is already active. The CPT plugin declares no reverse dependency; it
works with this plugin deactivated (see
[its README](../custom-post-types-for-bbs/README.md#dependency-direction)).

If **this** plugin is deactivated, content stays fully editable in wp-admin
(the CPT plugin doesn't need it), but the front-end pages that display that
content go blank or broken — this plugin owns all rendering.

## What's inside

Grouped by role, not an exhaustive block-by-block list — see
[custom-blocks-for-be-bite-smart.php](custom-blocks-for-be-bite-smart.php)
for the full registration list; each block there has a comment naming which
CPT (if any) it reads from.

- **CPT-backed display blocks** — episode, resource, Q&A entry, coloring
  book, guide/guide chapter — each stores only which post to show and renders
  live from it (`src/episode-display/`, `src/resource-display/`,
  `src/qa-entry-display/`, `src/coloring-book-display/`, `src/guide-single/`,
  `src/guide-chapter-display/`, etc.).
- **`*-fields` editor panels** — locked-canvas admin UI for each CPT
  (`src/episode-fields/`, `src/resource-fields/`, `src/qa-entry-fields/`,
  `src/coloring-book-fields/`, `src/guide-fields/`, `src/citation-fields/`,
  plus `src/guide-chapter-panel/`, which is a sidebar panel rather than a
  locked block).
- **Standalone content blocks** — hero, bio card, video quote, QR experience,
  research article, and others with no CPT dependency.
- **Learning Hub search/browse** — `src/learning-search/` and
  `src/learning-browse/`, plus that search block's zero-result-logging REST
  route (`src/learning-search/zero-result-log.php`), which validates/
  rate-limits the request and hands off to `bitesmart_search_log_record()`
  (defined in the CPT plugin's `search-log-cpt.php`, which owns the actual
  `search_log` storage).
- **Shared front-end JS/infrastructure** — `toggle-system.js`,
  `src/includes/video-language-settings.php` (a general
  Settings → Video Languages admin page, not tied to any one CPT).

## Text domain note

This plugin's translation strings use text domain `custom-blocks`, which
doesn't match the folder name (`custom-blocks-for-be-bite-smart`) or its
display name. Known, pre-existing mismatch — not addressed here.
