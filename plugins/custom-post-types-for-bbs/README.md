# Custom Post Types for BBS

The content model for Be BiteSmart's custom content: post types, taxonomies,
and post meta only. No blocks, no front-end JS, no build step — plain PHP,
loaded via `includes/`.

See the site-level [README](../../../../README.md) for how this plugin fits
into the bigger picture, and
[Custom Blocks for Be BiteSmart](../custom-blocks-for-be-bite-smart/README.md)
for the presentation layer that reads this content.

## Why this is a separate plugin

The content model should be able to stand on its own. Activate this plugin by
itself — with no other custom plugin active — and every post type and taxonomy
still registers, and editors can create/edit content in wp-admin normally.
Nothing here depends on how (or whether) that content is displayed on the
front end.

## Dependency direction

This plugin declares no `Requires Plugins` header and depends on nothing else.
The *blocks* plugin is the one with a dependency — its header declares
`Requires Plugins: TranslatePress, custom-post-types-for-bbs`, so WordPress
won't even let it activate unless this plugin is already active.

In other words: **blocks → CPTs, never the reverse.** If this plugin is ever
deactivated, the blocks plugin can't activate either — this is the
load-bearing plugin of the two. If the *blocks* plugin is deactivated instead,
this plugin is unaffected: content stays fully editable in wp-admin, only the
front-end display goes away (see that plugin's README).

## What's registered here

Functional file-per-content-type under `includes/`, prefix `bitesmart_` on
every function and `_bitesmart_` on every meta key. Taxonomies load before the
post types that attach to them (see the ordering comment at the top of
[custom-post-types-for-bbs.php](custom-post-types-for-bbs.php)).

**Post types:**

| Post type | File | What it holds |
|---|---|---|
| `episode` | `includes/episode-cpt.php` | Video episodes |
| `resource` | `includes/resource-cpt.php` | Link-out resource cards |
| `qa_entry` | `includes/qa-entry-cpt.php` | Q&A Hub entries |
| `coloring_book` | `includes/coloring-book-cpt.php` | Downloadable coloring books |
| `guide` | `includes/guide-cpt.php` | The site's one Guide (headless parent) |
| `guide_chapter` | `includes/guide-chapter-cpt.php` | Guide chapters, each its own page |
| `citation` | `includes/citation-cpt.php` | Guide reference citations |
| `search_log` | `includes/search-log-cpt.php` | Zero-result search logging |

**Taxonomies:**

| Taxonomy | File | Type |
|---|---|---|
| `stage` | `includes/stage-taxonomy.php` | Hierarchical |
| `topic` | `includes/topic-taxonomy.php` | Free-tag |
| `series` | `includes/series-taxonomy.php` | Hierarchical |
| `guide_section` | `includes/guide-section-taxonomy.php` | Hierarchical |

Each post-type file is self-contained: registration, its own
`register_post_meta()` calls, sanitize/auth callbacks, and any admin-UI
tweaks (title placeholders, admin columns, default-term assignment) live
together in one file rather than split by concern across several.

## Known gap

`guide_chapter` registers real rewrite rules, but no activation hook calls
`flush_rewrite_rules()` — a manual Settings → Permalinks → Save is needed in
wp-admin after activation. This is a documented, accepted gap (see the
comments in `includes/guide-chapter-cpt.php`), not an oversight to fix here.
