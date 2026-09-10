# Changes — September 2026

## 2026-09-03 — Fix "Parents Learning Center" → "Parents' Learning Center" (content, a corruption bug found along the way, and a staging cache gap)

**What it does and why it was needed:** Janet asked for every case-variant of "Parents Learning Center" / "Parent Learning Center" across the site to read "Parents' Learning Center" instead.

**Content changes (via `wp_update_post()`, bootstrapped through `wp-load.php` + PHP CLI — no direct DB/plugin/theme edits, see [[be-bitesmart-local-env]]):**
- Page 1980 (`/parents/`) — title.
- Page 2394 (`/learning/`) — title + 2 in-body occurrences (one visible paragraph, one block's editor-only `metadata.name`).
- Post 76 ("Menu" `wp_navigation`) — one submenu label.
- Template part 2379 ("Learning Hub Header") — 2 occurrences.
- Template part 2380 ("Learning Hub Footer") — 2 occurrences.
- Deliberately left every pre-existing revision of these 5 posts untouched (historical snapshots, not live content).
- Used a curly `'` (U+2019) in the replacement to match the site's existing apostrophe convention elsewhere in the same content (e.g. "A Parents' Guide to Preventing Dog Bites").

**Bug found and fixed — `wp_update_post()` silently strips backslash escapes:** the very first pass at post 76 corrupted 5 unrelated Gutenberg JSON escape sequences already in that post's content — `"Paw" it Forward` became `u0022Pawu0022 it Forward`, and 3 `&amp;` (in "News & Media" / "News & Coverage" / "Articles & Commentary") lost their backslash too. Root cause: `wp_update_post()`/`wp_insert_post()` always call `wp_unslash()` on their input (they're built to accept `$_POST`-shaped data, which WordPress pre-slashes) — passing already-raw content through it strips one level of backslashes from anything backslash-escaped in the content, not just the intended edit. Fixed by pulling the exact pre-corruption content back from WordPress's own auto-saved revision (the one captured the moment before the bad edit), reapplying the same regex to that clean baseline, and this time wrapping the update in `wp_slash()` before calling `wp_update_post()`. Verified byte-for-byte against the baseline afterward. Also purged WP Super Cache locally (`wp_cache_clear_cache()`) since the corrupted HTML had already been cached, and confirmed the live page afterward.

**Staging cache gap found and fixed:** pushing the (already-corrected) local DB to staging via `push-local-db-to-staging.sh` still showed the old corrupted text on staging. Traced through `import-local-db-to-staging.sh` → `sync-to-staging-post.sh`: neither the local→staging import path nor the prod→staging sync path ever purged WP Super Cache after swapping the DB underneath it — the post-sync cleanup only ever deactivated Wordfence. Staging's file-based page cache had no way to know the DB had changed, so it just kept serving whatever HTML it already had, regardless of which sync path put it there or what state the DB was actually in.
- [server-scripts/templates/sync-to-staging-post-template.sh](wp-content/server-scripts/templates/sync-to-staging-post-template.sh): added a WP Super Cache purge step (mirroring the existing Wordfence `is-installed` check/skip pattern) after the Wordfence deactivation. WP Super Cache ships no WP-CLI command of its own (core WP-CLI's `wp cache flush` only flushes the object cache, not this plugin's static HTML cache), so it calls the plugin's own `wp_cache_clear_cache()` PHP function directly via `wp eval` — the same function used to purge the equivalent local cache above.
- [server-scripts/README.md](wp-content/server-scripts/README.md): updated the `sync-to-staging-post.sh` file description to match.
- **Not yet live**: per the README, these scripts are deployed manually (SFTP/File Manager) to `/home/USER/` on DreamHost, not auto-synced from this repo. The template change here needs to be manually copied to the live `sync-to-staging-post.sh` on the server before it takes effect — until then, a manual "Delete Cache" in staging's WP Super Cache admin (or an SSH-side cache clear) is still needed after any push/sync.

**Key decisions:**
- Used the site's own auto-saved post revisions as the "known-good" restore point for the corruption fix, rather than trying to hand-patch the corrupted string — more reliable, since it's an exact byte-for-byte snapshot from immediately before the mistake.
- Fixed the underlying staging cache gap (not just a one-off manual clear) since it silently affects every future push/sync, not just this one.

**Verification:** Re-scanned all live (non-revision) posts for the original phrase — zero matches. Byte-diffed post 76's fixed content against its pre-corruption revision — exact match. Curled the local site's rendered `/parents/` and `/learning/` pages (nav, header, footer, JSON-LD/breadcrumbs) after a WP Super Cache purge — confirmed correct output, including `&#8220;Paw&#8221; it Forward` and the `&amp;` entries. `bash -n` clean on the edited shell script. Staging itself not re-verified yet (behind HTTP Basic Auth, no general SSH access from this environment) — pending the manual server-side script update above.

**Commit range or PR link:** not yet committed — Janet commits manually per existing convention on this branch (`plc-updates`).

## 2026-09-04 — Guide Chapter removed from mixed Stage/All search results

**What it does and why it was needed:** Janet's ask — stop `guide_chapter` posts appearing as a card in the Learning Hub search/browse results on real Stage pages (`/learning/stages/*`) and the "All Stages" pseudo-stage; her plan is to link chapters out from a Q&A Entry instead, same shape as the earlier Book (2026-08-28) and Coloring Book (2026-08-30) removals — see [[be-bitesmart-search-status]] in memory. Confirmed scope with Janet first: the pooled Guide hub page (`/learning/guide/`, `stage_slug === 'guide'`) is deliberately UNTOUCHED — that page's own full chapter accordion + Fuse search is the chapters' own dedicated browsing experience, not a mixed-content search result, so it keeps showing every chapter exactly as before.

**Changes (`custom-blocks-for-be-bite-smart` plugin, PHP-only, no rebuild needed):**
- [learning-search/learning-search.php](wp-content/plugins/custom-blocks-for-be-bite-smart/src/learning-search/learning-search.php): removed `'guide_chapter'` from the real-Stage and `'all'`-pseudo-stage `WP_Query` `post_type` arrays in `bitesmart_build_stage_card_list()`; simplified the foreach's `guide_chapter` branch to always call `render_guide_chapter_pooled_card()` (the ternary's real-Stage-teaser half is now unreachable, since a chapter can only appear via the `'guide'` pooled branch). Left `save_post_guide_chapter`/`set_object_terms` cache-invalidation hooks and `bitesmart_stage_card_keywords()`'s `guide_chapter` entry in place — both still needed for the pooled Guide page's own cache/search. Updated the affected docblocks to describe the new shape.
- [guide-chapter-display/guide-chapter-display.php](wp-content/plugins/custom-blocks-for-be-bite-smart/src/guide-chapter-display/guide-chapter-display.php): `render_guide_chapter_search_card()` (the old real-Stage compact teaser) is now ORPHANED — no callers anywhere. Left in place rather than deleted, flagged as such in its own docblock and the file header, same "keep in case reused" posture Book's/Coloring Book's own orphaned search-card functions had on their first removal day (both were deleted outright in a later follow-up once nothing reused them). Also fixed a stale comment referencing `render_coloring_book_search_card()` (deleted 2026-08-30) while editing the same block.

**Not done (separate follow-up, needs Janet's content decisions):** the actual Q&A Entry (or entries) that will link out to the guide chapters — what question/answer text, one entry per chapter vs. one for the whole Guide, etc. (Janet confirmed same day this stays a later step, not built now.)

**Verification:** `php -l` clean on both edited files. Bootstrapped `wp-load.php` via PHP CLI against real local data ([[be-bitesmart-local-env]]) and called `bitesmart_build_stage_card_list()` directly: all 15 published chapters still appear on the pooled `'guide'` list (unchanged); 0 chapter cards on `'all'` (12 total) and on every real Stage a chapter is tagged with — `baby` (5), `pregnancy` (5), `preschool` (12), `toddler` (9).

**Follow-up cleanup, same day, immediately after ("let's clean up"):** the two items flagged above were actually removed, not just flagged — same "delete once nothing reuses it" second pass Book's and Coloring Book's own leftover plumbing each got after their own first removal day.
- [guide-chapter-cpt.php](wp-content/plugins/custom-post-types-for-bbs/includes/guide-chapter-cpt.php): un-registered `guide_chapter` from the `stage` taxonomy entirely (`register_taxonomy_for_object_type( 'stage', 'guide_chapter' )` removed) — it had nothing left reading it once the real-Stage listing above was gone, and the Stage panel now no longer shows on a chapter's edit screen. Existing Stage term relationships on chapters aren't deleted, just orphaned/unreachable data — harmless, reversible by re-registering. `topic` and `media_type` were checked and deliberately left attached: Topic has zero front-end effect for ANY content type here (a pre-existing, site-wide deferral, not specific to this change), and Media Type is still genuinely live — the pooled Guide page's own "Filter by type" checkboxes read a chapter's Media Type terms (video vs. article), unaffected by any of today's changes. Also fixed the file's own header comment, which still claimed a chapter was discoverable via its real Stage's search feed.
- [guide-chapter-display/guide-chapter-display.php](wp-content/plugins/custom-blocks-for-be-bite-smart/src/guide-chapter-display/guide-chapter-display.php): deleted the now-orphaned `render_guide_chapter_search_card()` function outright, and updated the surrounding docblocks/comments (file header, the download-section comment, `render_guide_chapter_pooled_card()`'s own docblock) that referenced it.
- [learning-search/learning-search.php](wp-content/plugins/custom-blocks-for-be-bite-smart/src/learning-search/learning-search.php): updated the two remaining comments (`bitesmart_stage_cards_template_version()`, `bitesmart_build_stage_card_list()`'s docblock) that still described the teaser function as orphaned-but-present rather than deleted.
- **Deliberately kept, not deleted, unlike Coloring Book's equivalent field:** `_bitesmart_chapter_question` (guide-chapter-cpt.php) — its only reader was the now-deleted teaser function, so it's currently unread by any front-end code, but 1 of the 15 chapters already has real content in it ("Why do young children have the highest risk of severe dog bites?", checked live via `wp-load.php` before deciding) and it's exactly the kind of parent-facing question the still-pending Q&A-linking follow-up will want per chapter — deleting the field/its editor UI would have silently orphaned Janet's own already-authored content rather than just dead code, so left fully intact and re-documented instead of removed.
- [guide-chapter-panel/index.js](wp-content/plugins/custom-blocks-for-be-bite-smart/src/guide-chapter-panel/index.js): found while re-checking this same field — its wp-admin help text ("Shown as the heading on this chapter's compact search-result card on real Stage pages...") was live, editor-visible copy describing the now-deleted card, not just a code comment. Reworded to describe the field's current (unused-for-now, reserved for Q&A linking) status instead. `pnpm run build` run (this one IS part of the compiled bundle, unlike every PHP change above) — confirmed the new string landed in `build/guide-chapter-panel/index.js`.

**Verification (cleanup pass):** `php -l` clean on all three edited files. Re-ran the same `wp-load.php` verification as above — identical result shape (all 15 chapters still on the pooled `'guide'` list, 0 on `'all'`/any real Stage); card counts on `'all'`/real Stage pages had shifted some from an unrelated concurrent change (Q&A Entry content work, not this task) but the guide_chapter-specific counts were unaffected.

**Commit range or PR link:** not yet committed.

## 2026-09-04 — Q&A Entry can link to a Guide Chapter, inheriting its Synonyms

**What it does and why it was needed:** closes the "still-pending follow-up" from the removal above — Janet's question was whether a Q&A Entry covering one narrow aspect of a chapter can avoid duplicating that chapter's (broader) Synonyms by hand. Full design worked out with Janet, including two design pivots made after actually reading the code rather than assuming — see [[be-bitesmart-qa-chapter-link-status]] in memory for the complete "why" (a superset principle replacing an earlier additive-field idea, and choosing an add/remove-only token UI over a stable-id restructure once the shared 4-CPT field shape and live `bitesmart_stage_card_keywords()` path were actually checked). Not duplicated in full here.

**Changes:**
- [qa-entry-cpt.php](wp-content/plugins/custom-post-types-for-bbs/includes/qa-entry-cpt.php): two new `qa_entry` meta fields — `_bitesmart_qa_link_chapter_id` (optional, single chapter, mirrors `_bitesmart_qa_link_resource_id`'s pattern) and `_bitesmart_qa_chapter_synonym_excludes_by_lang` (per-language list of chapter-synonym tokens this entry has opted out of, with a new `bitesmart_sanitize_qa_chapter_synonym_excludes_by_lang()`).
- [guide-chapter-panel/index.js](wp-content/plugins/custom-blocks-for-be-bite-smart/src/guide-chapter-panel/index.js): the chapter's own Synonyms field is now a `FormTokenField` (add/remove chips) instead of plain text — makes in-place renaming impossible, which is what lets the Q&A side match excludes by text safely. Storage (`_bitesmart_chapter_keywords_by_lang`, still a comma-separated string), sanitize callback, and REST schema are all completely unchanged.
- [learning-search/learning-search.php](wp-content/plugins/custom-blocks-for-be-bite-smart/src/learning-search/learning-search.php): new `bitesmart_qa_entry_chapter_keywords()`, called first from `bitesmart_stage_card_keywords()` for the `qa_entry` branch only. Returns the linked chapter's Synonyms minus this entry's excludes, or `null` (not `''`) when there's no live chapter to inherit from — covers "never linked" and "linked chapter trashed/deleted/unpublished" identically, falling through to the entry's own (otherwise-dormant-while-linked) Synonyms field either way.
- [qa-entry-fields/index.js](wp-content/plugins/custom-blocks-for-be-bite-smart/src/qa-entry-fields/index.js): new "Chapter Link" `ComboboxControl`; the "Search Synonyms" section now shows a per-language checkbox list of the linked chapter's tokens (checked = included) instead of free text whenever a chapter is linked. Three edge cases handled: (1) linking over already-typed-in synonyms — a confirm modal offers to copy them onto the chapter first (a real `saveEntityRecord()` write to the OTHER post, gated on that chapter's current data having actually resolved before merging, so a still-loading fetch can't clobber its real list); (2) switching/removing a link that has excludes set — confirm modal, resets the excludes; (3) the linked chapter no longer resolving live — an inline `Notice`, with the existing picker doubling as both "pick a different chapter" and "clear the link" (no separate buttons needed).

**Deviations from the original plan, worth recording:**
- Dropped a stable-per-token-id design for the chapter's Synonyms in favor of the add/remove-only `FormTokenField` above, after re-reading `bitesmart_stage_card_keywords()`/the REST schema mid-implementation and finding the id approach would touch a live shared function used by 3 other CPTs, not just this one — see [[be-bitesmart-qa-chapter-link-status]] for the full before/after.
- Did NOT build the proactive "warn before trashing a chapter that has linked Q&A entries" admin-JS guard from the original edge-case-3 design — no existing precedent in this codebase for that kind of admin-screen interception, and the always-on PHP-side fallback already fully covers the actual failure mode. Left as a documented, not-yet-built nice-to-have.

**Verification:** `php -l` clean on both edited PHP files. `pnpm run build` clean (qa-entry-fields and guide-chapter-panel are both part of the compiled bundle — confirmed no webpack errors). Later the same day, manually verified live via Playwright against the real local site (see the incident entry directly below) — the Chapter Link picker, the inherited-synonyms checkbox list, both confirm modals (including the real cross-entity `saveEntityRecord()` merge write), and the dangling-link notice all worked correctly against real data with zero console errors.

**Commit range or PR link:** not yet committed.

## 2026-09-04 — Fixed: 60 Q&A Entries showed blank editor canvas (title + sidebar only, no Answer/Chapter Link/Synonyms fields) — pre-existing bulk-import bug, unrelated to the Chapter Link feature above

**What happened:** Janet reported that existing Q&A Entries had no way to set Answer Type or enter an Answer, and attributed it to the same-day Chapter Link work above. Investigated live (valid session cookies generated via `wp_generate_auth_cookie()` + `wp-load.php`, driving the real editor with Playwright against `@playwright/test`'s bundled `chromium` — no chromium-cli available in this environment, and the wp-content workspace already had `@playwright/test` installed for its e2e suite). Reproduced exactly on post 3202 ("What rules should grandparents and babysitters follow with my toddler and dog?"): blank canvas, zero console errors.

**Root cause, confirmed not to be my code**: queried all `qa_entry` posts directly — 60 of 62 had a completely empty `post_content`, all created within the same 2-second window (`2026-09-04 14:01:17`–`19`), clearly a bulk-import script (not found on disk — likely run from another session's own scratchpad, no origin script recoverable). The other 2 (including the one I'd been testing against, 2465) had real `<!-- wp:custom/qa-entry-fields /-->` block markup and rendered fine. `qa_entry`'s CPT registration locks its editor to a required template (`template_lock: 'all'`) — Gutenberg only auto-populates that template into `post_content` when a post is created THROUGH the editor itself (clicking "Add New"); a post inserted directly into the DB skips that step entirely, and WordPress does not retroactively backfill a required block into an already-published, empty post. Proved this conclusively, not just by inspection: temporarily reverted `qa-entry-fields/index.js` to its exact pre-Chapter-Link content, rebuilt, reloaded post 3202 — **identical blank canvas**, before restoring my actual version and rebuilding again. This is why "new" entries (created via Add New, which seeds the template correctly) looked fine to Janet while every bulk-imported one didn't — a coincidence of timing with the Chapter Link work, not caused by it.

**Fix (confirmed with Janet before running, since it's a live write to 60 published posts):** `wp_update_post()` (wrapped in `wp_slash()` per [[wordpress-project-conventions]]'s existing gotcha note) set `post_content = '<!-- wp:custom/qa-entry-fields /-->'` on all 60 affected posts — the exact markup already present on the 2 working ones. Titles, taxonomy terms, and all meta (including the still-empty `_bitesmart_qa_answer_text` on every one of the 60 — see below) were untouched.

**Separate, NOT fixed, flagged for Janet**: all 60 imported entries have real questions/titles but a completely empty Answer field (and default Short Answer/Custom URL/no Synonyms) — the import only ever set titles. Actually writing answers for these 60 questions is content work, not a code fix, and wasn't done here.

**Verification:** re-ran the same Playwright check against post 3202 post-fix — Answer Type, Answer, Link Destination, Chapter Link, and Search Synonyms all render correctly, zero console errors. Spot-checked the DB values directly (`get_post()->post_content`) on 3 of the 60. Purged WP Super Cache afterward (direct DB edit, per [[be-bitesmart-local-env]]'s existing convention). Temporary Playwright driver scripts written into the wp-content workspace during diagnosis were deleted afterward, not left behind.

**Commit range or PR link:** not yet committed (this is a data fix, not a code change — nothing to commit for this entry beyond the CHANGES/memory notes).

## 2026-09-04 — Unfunded Episode card: dropped funding badge, made status editable

All episodes are now funded, so the "Needs Funding" pill was no longer
accurate, and the "Pending Funding" thumbnail label was hardcoded and
couldn't be changed by editors.

- Removed the `uec-badge` "Needs Funding" pill entirely, from both
  `edit()` and `save()` in `src/unfunded-episode/index.js`, and deleted
  its CSS rule (`.uec-badge`) and the now-dead mobile-only rules that
  existed solely to hide/reposition it (`src/unfunded-episode/style.css`).
- Replaced the hardcoded "Pending Funding" thumbnail label with a new
  `status` attribute (`type: "string"`, default `"In Development"`),
  rendered in both `edit()` and `save()`.
- Added a `SelectControl` ("Status") to the editor fields panel so
  editors can toggle the label between "In Development" and "Awaiting
  Development". Chose a `SelectControl` over a boolean `ToggleControl`
  so the displayed text is self-documenting in the editor UI rather than
  needing an on/off-to-label mapping.
- Rebuilt (`pnpm build`) so `build/unfunded-episode/index.js` and
  `style-index.css` — what `register_block_type()` actually loads —
  pick up the change.

Left the block's registered name (`custom/unfunded-episode`), folder,
and title ("Unfunded Episode Card") unchanged — renaming was out of
scope and existing pages/content already reference this block name.

**Same day, follow-up**: Janet asked for the default status to be
"Awaiting Development" instead of "In Development" (options unchanged —
still exactly those two), and reported the "Needs Funding" pill was
still visible live. Changed the `status` attribute's default in
`src/unfunded-episode/index.js` and re-ordered the `SelectControl`
options to match (`Awaiting Development` first), then rebuilt.

Root-caused the still-visible pill: `custom/unfunded-episode` is a
static block (`register_block_type( __DIR__ . '/build/unfunded-episode' )`
in the main plugin file, no `render.php`/`render_callback`), so its
`save()` markup is baked into `post_content` at editor-save time —
changing `save()` in code doesn't retroactively touch content already
published. Confirmed via a one-off `wp-load.php` + direct `$wpdb`
query (see [[be-bitesmart-local-env]] for the php.exe/php.ini
invocation) searching `post_content` for `uec-badge`/`Needs Funding`:
one live page still has the old markup, ID 2408 "Resources for Kids to
Learn Safe Dog Interactions" (`/learning/kids/`); the only other hit
was a trashed `Learn` page (ID 2) plus assorted `revision` rows, which
don't render. Did not rewrite `post_content` directly (a DB write
needs Janet's go-ahead per project convention) — the fix is for Janet
to open that page in the block editor and re-save it (Gutenberg will
re-parse the block, drop the badge, and pick up the new "Awaiting
Development" default since the `status` attribute doesn't exist yet in
that page's saved markup).

## 2026-09-04 — Funded episodes: show only the first, "Show More Episodes" button for the rest

Janet asked that the episodes section on `/learning/kids/` (page ID 2408)
only show the first `custom/episode` block, with a "Show more episodes"
button to reveal the rest — same interaction as the existing "Awaiting
Funding" section on the same page, which already wraps episodes 4+ in a
`custom/read-more` block (episode 3 shown directly). Reused that exact
pattern rather than building a new mechanism, since `read-more.js`'s toggle
logic is already generic (matches on `.expandable-article-block` /
`.read-more-toggle` / `.expandable-content` class names, not block type)
and `custom/read-more`'s `save()` just renders whatever `InnerBlocks`
content it's given.

- Added `"custom/episode"` to `custom/read-more`'s `allowedBlocks` in
  `src/read-more/index.js` (previously only `custom/unfunded-episode`)
  so the block's own "+" inserter can add/rearrange Episode blocks inside
  it going forward — this only affects the editor's inserter UI, not
  rendering (rebuilt with `pnpm build`).
- Wrapped the second episode (`{"episodeId":2693}`) on page 2408 in a
  `custom/read-more {"buttonLabel":"Show More Episodes","expandedButtonLabel":"Show Less"}`
  block, leaving the first (`{"episodeId":2433}`) visible as-is — markup
  shape copied verbatim from the Awaiting Funding section's read-more
  block. Did this as a direct `post_content` edit (via `wp_update_post()`
  in a one-off script, see [[bebitesmart-local-env]] for the php.exe/
  php.ini/mysql.exe invocation) rather than asking Janet to rearrange it
  by hand in the block editor, since it's the same kind of content-only
  change already made for the unfunded episodes. Confirmed with Janet
  first given it's a live DB write.
- Verified with a throwaway Playwright script (the `app/public/wp-content`
  workspace already has `@playwright/test` installed for e2e tests):
  before the click only 1 `.video-episode-block` is visible and the button
  reads "Show More Episodes" (`data-expanded="false"`); after clicking,
  both are visible and the button reads "Show Less"
  (`data-expanded="true"`). Screenshots confirmed Episode 2 ("Let Sleeping
  Dogs Lie") renders correctly once revealed, funded-by credit included.

Next time a 3rd funded episode is added, it should go inside that same
`custom/read-more` block (after episode 2693, inside `.expandable-content`)
rather than as a new top-level block — this is a manual editorial step
each time, same as the Awaiting Funding section, not something the block
handles automatically.

## 2026-09-09 — Fixed: `heading-order` axe violation on 4 Stage pages (missing H2 before Q&A search results)

**What it does and why it was needed:** axe flagged `heading-order` on the Pregnancy, Baby, Toddler, and All Resources pages — each renders `<h1>` (post title) directly into the `custom/learning-search`/`custom/learning-browse` blocks, which deliberately render no heading of their own by design (editors are meant to place one manually — see the doc comment in `render_learning_search_block()`), straight into each Q&A card's `<h3 class="qa-entry-question">`, skipping H2 entirely. Root cause traced by comparing against two sibling pages that already do this correctly: Preschool (H2 "Find Resources" + H3 "Search Preschool Questions & Resources") and After a Bite (a single H3, valid there because an H2 already exists earlier on that page) — confirming this was an incomplete editorial rollout, not a code defect.

**Changes:** added a new H2 heading — "Search or Browse {Stage} Questions & Resources" (or "...All Questions & Resources" for the pooled view) — immediately before the search block on Pregnancy (ID 2421), Baby (2419), Toddler (2423), and All Resources (2911), matching the existing convention's markup exactly. Direct DB content edit via the `wp-load.php` + PHP CLI + `wp_update_post()` pattern (see [[be-bitesmart-local-env]]), not a code change — no file to commit.

**Verification:** re-fetched all 4 pages via REST to confirm H1 → H2 → H3 order with no skip; re-ran `tests/a11y/axe.spec.js -g "Stage: Pregnancy|Stage: Baby|Stage: Toddler|Stage: All Resources"` — all 4 pass, `heading-order` no longer fires. Screenshotted Pregnancy to confirm no visual regression (reads identically to Preschool's existing heading).

**Commit range or PR link:** not applicable (content-only DB edit).

## 2026-09-09 — Playwright tests updated for /parents + /learn removal; staging CI sync gap found

The `/parents` and `/learn` pages were deleted on local/staging, their
content consolidated onto `/learning/kids` (post_name `kids`, page ID
2408) — see [[be-bitesmart-content-hub-plan]]. Production hasn't received
this yet. Updated the Playwright suite (`app/public/wp-content/tests/`,
repo `be-bite-smart`) to match:

- `tests/helpers/paths.js`: removed the standalone `/parents/` entry from
  `CRITICAL_PAGES` (its content no longer exists at that URL), and changed
  `REST_PAGE_SLUGS` from `"learn"` to `"kids"` so the REST API smoke test
  (`tests/smoke/rest-api.spec.js`) queries the page that actually exists
  now. `EDUCATION_PATH` was already `/learning/kids` from an earlier pass.
- `tests/videos/language-feedback.spec.js`: fixed a comment still
  referencing `/learn/` as the episode page's location.

**CI gap found and worked around, not fully resolved**: the `deploy-staging`
job in `.github/workflows/playwright.yml` re-syncs staging's DB from
*production* on every PR run (`sync-staging-db.sh`), which was silently
reverting the `/learning/kids` migration (pushed to staging manually via
`local-only-scripts/push-local-db-to-staging.sh`) before tests ran —
explains why staging looked migrated when browsed manually but CI kept
404ing on `/learning/kids`. Temporarily disabled that sync step
(`if: false`, with a dated comment) so staging holds the manually-pushed
DB across PR runs. This is explicitly a stopgap, not a fix:
- Staging is shared across all open PRs, so every PR's CI now sees
  local/stale content for anything *other* than this migration too
  (e.g. a client's edit to Team or Evidence made directly on prod since
  the last sync) until the sync is re-enabled.
- Real fix (discussed, not built): treat structural content changes like
  this one as a versioned migration (WP-CLI script / mu-plugin hook) that
  runs as part of the deploy on both staging and prod, rather than a
  one-off manual DB push that the CI pipeline's one-way prod-sync fights
  against. Re-enable the sync step once `/learning/kids` ships to
  production; don't leave `if: false` in place long-term.

**Also surfaced by getting past the 404** (not addressed this session):
once `/learning/kids` actually loaded in CI, two real issues showed up
that were previously masked by the 404 short-circuit — a moderate axe
"content not contained by landmarks" finding on that page, and
`tests/videos/language-feedback.spec.js` finding no episode cards under
`#developed-episodes` on staging (present in the local DB dump per
[[be-bitesmart-episode-status]], so likely a staging-specific content/sync
gap rather than a real regression). Flagged to Janet, not yet
investigated.

Commits: `tests: removed parents page`, `tests: updated tests to point at
new learning page`, `fix: temporarily disable production to staging sync
in Playwright workflow...`, `tests: point REST API smoke test at
/learning/kids slug, not removed /learn` (branch `plc-updates`, repo
`be-bite-smart`).

## 2026-09-09 (cont'd) — Episode tests updated for the developed-episodes read-more layout

`/learning/kids`'s "developed episodes" section now renders the first
episode directly under `#developed-episodes`, with the rest wrapped in a
`custom/read-more` block (`.expandable-article-block`, `display:none`
until its toggle is clicked) — see the 2026-09-04 entry above for when
that layout landed. `tests/helpers/paths.js` and
`tests/videos/language-feedback.spec.js` still selected episode cards via
the generic `#developed-episodes article`, which also matches
`custom/read-more`'s own `<article class="expandable-article-block">`
wrapper — happened to keep working by DOM order (the wrapper article
sorts after the first real episode) but was fragile and conflated two
different kinds of element. Rescoped both to
`#developed-episodes .wp-block-custom-episode` (the real card's own root
class, per `episode-display.php`).

Added a new test asserting the layout itself rather than just working
around it: first episode visible on load, the rest hidden until "Show
More Episodes" is clicked (`data-expanded` flips, `.expandable-content`
gains `.expanded`). This is the first automated coverage of that reveal
behavior — the 2026-09-04 entry above only verified it via a throwaway
script.

Verified locally against `http://bebitesmart.local`: all episode tests
pass. Unrelated: the 3 `video-quote-block` ("Documentary video") tests
in the same file fail on local right now — confirmed via `curl` that the
block genuinely isn't on the local DB's `/learning/kids` page, not a
selector issue. Not investigated further, flagged to Janet.

Commit: `tests: match episode selectors to the new developed-episodes
layout` (branch `plc-updates`, repo `be-bite-smart`).

## 2026-09-09 (cont'd) — Documentary video-quote tests retargeted to Home + Learning hub; two real bugs surfaced

Janet reported the documentary `video-quote` block is now only on Home
and the Learning hub landing page (`/learning/`), no longer on
`/learning/kids`. Updated the Playwright suite (`be-bite-smart` repo)
across three files that all hardcoded `EDUCATION_PATH` for this block:

- Added `LEARNING_HUB_PATH` (`/learning/`) and `VIDEO_QUOTE_PAGES`
  (Home + Learning hub) to `tests/helpers/paths.js` as the single source
  of truth, re-exported through `tests/analytics/helpers/plausible.js`.
- `tests/videos/language-feedback.spec.js` and
  `tests/videos/loading.spec.js`: parametrized every video-quote test
  over `VIDEO_QUOTE_PAGES` instead of a single hardcoded path.
- `tests/helpers/paths.js`: moved the `BLOCK_PRESENCE_PAGES` "documentary
  video block" check off the Learn/`EDUCATION_PATH` entry onto Home +
  Learning hub.
- `tests/analytics/events.spec.js`: retargeted "Documentary on Education
  page play fires documentary-watched" to the Learning hub (renamed
  accordingly) — Home's equivalent test already existed separately.

**Also found while re-running the suite**: `loading.spec.js` and
`events.spec.js` each had their own copy of the `#developed-episodes
article` selector bug fixed earlier today in `language-feedback.spec.js`
(matched `custom/read-more`'s own wrapper `<article>` alongside real
episode cards) — missed both files in the first pass. Fixed the same way
(`.wp-block-custom-episode`).

**New, more consequential bug found by these fixes**: both of the
above files reload the page mid-test and then click into an episode by
index — including episodes past the first, which are collapsed behind
custom/read-more's Show More toggle. Every reload starts collapsed
again, so clicking a hidden episode's controls doesn't error, it just
hangs for the full 180s timeout. Added `expandAllDevelopedEpisodes()`
(`tests/videos/helpers/videos.js`) — clicks every collapsed toggle under
`#developed-episodes` — and call it after every such reload. Confirmed
this was a real hang, not a flake: before the fix, `loading.spec.js`'s
per-language embed test ran the full 3 minutes and failed; after, 4.8s.

**Two real, pre-existing bugs surfaced, not fixed here:**
1. `.download-card-block` is missing from `/learning/kids` on local
   (confirmed via `curl`, 0 matches) — a content gap, not a test issue.
2. **Analytics tracking is broken for the whole "Education page" branch**:
   `themes/twentytwentyfive-child/inc/analytics.php:285` gates episode
   downloads, episode plays, PDF-view tracking, and documentary tracking
   behind `is_page('learn')` — a page slug that no longer exists (the
   page is now `kids`). None of that tracking fires on `/learning/kids`
   at all right now. Separately, the `elseif` chain (lines 285-359) has
   no branch for the new Learning hub page (`/learning/`), so
   documentary tracking doesn't fire there either — only Home's branch
   (`is_front_page()`) still works. This was caught by
   `events.spec.js`'s "Watch Now fires episodes-watched" and "Documentary
   on Learning hub" tests (0 plausible calls recorded despite the video
   genuinely playing). Flagged to Janet as a real site-code fix, not
   made — out of scope for a test-only pass and touches production
   analytics config.

Commits: `tests: match episode selectors to the new developed-episodes
layout`, `tests: retarget documentary video-quote tests to Home +
Learning hub` (branch `plc-updates`, repo `be-bite-smart`).

## 2026-09-09 (cont'd) — Fixed: analytics tracking broken since /learn -> /learning/kids rename

Confirmed and fixed the analytics regression flagged in the previous
entry. `themes/twentytwentyfive-child/inc/analytics.php` gated the
entire "Education page" tracking branch (episode plays, episode
downloads, PDF views, documentary) behind `is_page('learn')` — that
page no longer exists (renamed to `kids`, now at `/learning/kids`), so
none of that tracking fired at all. Separately, the page-detection
`elseif` chain had no branch for the new Learning hub (`/learning/`,
slug `learning`), so the documentary block now also living there wasn't
wired up either.

Fix: `is_page('learn')` -> `is_page('kids')`, plus a new
`elseif ( is_page( 'learning' ) )` branch echoing `$track_documentary`
(same as the Home page branch).

Verified locally against `http://bebitesmart.local`. Initial re-test
still failed identically even after the PHP change — root-caused to WP
Super Cache serving a stale pre-fix cached copy of `/learning/kids` and
`/learning/`'s footer HTML (this codebase has hit this exact class of
bug before per existing comments in `plausible.js`/`CHANGES.md`).
Purged `wp-content/cache/supercache/bebitesmart.local/learning/` and
re-ran; `events.spec.js`'s "Watch Now fires episodes-watched" and
"Documentary on Learning hub" tests both pass now, full events/videos/
blocks suites otherwise clean (the 2 remaining failures are the
pre-existing, unrelated `.download-card-block` content gap already
flagged above).

Commit: `fix: analytics tracking broken since /learn -> /learning/kids
rename` (branch `plc-updates`, repo `be-bite-smart`).

## 2026-09-09 (cont'd) — Downloads content moved to /learning/downloads; a second, unrelated stale-class bug found in coloring-book tracking

Janet reported `.download-card-block` moved off `/learning/kids` too —
confirmed via live content: downloads, episode-video-download blocks,
and coloring-book PDFs are now entirely on a new page,
`/learning/downloads` (slug `downloads`, page ID 2410, title
"Downloadable Educational Resources"). Nothing download-related remains
on `/learning/kids`.

- Added `DOWNLOADS_PATH` to `tests/helpers/paths.js`; moved the
  `BLOCK_PRESENCE_PAGES` "download cards" check off Learn onto it.
- **Added `LEARNING_HUB_PATH` and `DOWNLOADS_PATH` to `CRITICAL_PAGES`**
  (per Janet's go-ahead) — previously neither page got any a11y/SEO/
  link-check/download-scan coverage at all, since `smoke/downloads.spec.js`
  and friends only ever iterate `CRITICAL_PAGES`.
- `events.spec.js`: retargeted the 4 download/PDF tests (episode video
  downloads, coloring-book viewed/downloaded, PDF-does-not-refire-on-close)
  to `DOWNLOADS_PATH`.
- `analytics.php`: split the download/PDF-tracking script off
  `is_page('kids')` onto a new `is_page('downloads')` branch (same
  pattern as the earlier documentary fix); episode-play tracking stays
  on `kids`. Also dropped the now-dead `$track_documentary` echo from
  the `kids` branch (confirmed the documentary block isn't there
  either).

**Second, separate bug found while fixing the above — not caused by
today's page move**: `downloadCardBlocks.coloring.block` in
`plausible.js` referenced `.educational-coloring-book-download-block`,
a class that doesn't exist in the real markup on *any* page. Actual
coloring-book rows render as `.download-card-block.coloring-book-card`
(a shared generic wrapper + modifier, from what looks like an earlier,
undocumented refactor of that block). This silently made both
"Coloring Book PDF toggle fires coloring-books-viewed..." and "Coloring
Book Download fires coloring-books-downloaded..." loop over zero
matched sections and trivially pass — they've provided no real coverage
for however long that refactor has been live. Caught only because
`firstColoringViewPdfButton` (used by a third test) asserts count > 0
instead of silently no-op looping.

Same stale class was baked into **four** places in `analytics.php`:
the querySelectorAll that attaches the PDF-view click listener at all,
plus three closest()-based category-detection helpers
(`pdfTrackingSlug`, `pdfViewCategory`, `pdfDownloadEventName`) — so even
after fixing just the listener, the coloring-books-viewed/-downloaded
events would have fired under the wrong generic pdf-viewed/pdf-downloaded
name. Fixed all four to `.coloring-book-card` (Janet's go-ahead).

Left `.educational-content-download-block` untouched in both files —
same naming pattern as the confirmed-stale coloring-book class, but
there's no live content anywhere to confirm or deny it, and no test
currently exercises it (`downloadCardBlocks.educationalContent` is
defined but unused). Flagged for whoever adds that content type next.

Verified locally against `http://bebitesmart.local`, purging WP Super
Cache's `/learning` entry before each analytics.php re-test (same
caching gotcha as the earlier documentary fix — see
[[be-bitesmart-staging-ci-sync-gotcha]] region of content-hub-plan.md).
Full re-run of `events.spec.js` + `videos/*.spec.js` + `blocks.spec.js`:
43/43 pass.

Commit: `fix: downloads content moved to /learning/downloads;
coloring-book tracking used a stale class` (branch `plc-updates`, repo
`be-bite-smart`).

## 2026-09-09 (cont'd) — Added remaining /learning/* pages to axe/CRITICAL_PAGES; found the whole "Content Hub" template is missing <main> and an H1

Janet asked to look at what else lives under `/learning/` now and add
missing axe coverage. Surveyed the full subtree via REST (`?parent=2394`
+ a full `/wp/v2/pages` listing) rather than guessing from memory, since
the URL structure has grown well past the original content-hub-plan.

Found 11 pages with zero test coverage — not in `CRITICAL_PAGES` at all,
so no axe/SEO/link-check/download-scan. Added all of them
(`tests/helpers/paths.js`):

- **9 real, content-rich pages**, each with a matching
  `BLOCK_PRESENCE_PAGES` check: `/learning/books` (book cards),
  `/learning/guide` (chapters), `/learning/guide/references`
  (citations), and `/learning/bite` + the 4 live Stage pages
  (pregnancy/baby/toddler/preschool) + `/learning/stages/all-resources`
  — the last 6 share one new `QA_SEARCH_PAGES` list (same
  `custom/learning-search`/`custom/learning-browse` Q&A card markup on
  all of them, kept in sync between `CRITICAL_PAGES` and
  `BLOCK_PRESENCE_PAGES`).
- **2 empty pages** (`content.rendered: ""` via REST, not a caching
  artifact): `/learning/stages` (the Stage-index hub — matches an
  already-known, already-documented content gap) and `/learning/contact`
  (a second, empty "Contact" page, distinct from the real `/contact/` —
  looks like a stray redesign stub; flagged to Janet, not investigated
  further). Added to `CRITICAL_PAGES` for structural/a11y coverage per
  Janet's call, with no content-presence check since there's nothing to
  assert yet.

**Major finding from actually running axe against these (not just
`blocks.spec.js`)**: all 12 `/learning/*` pages — including the 3
already in the suite before today (`/learning/kids`, `/learning/`,
`/learning/downloads`) — fail identically on `landmark-one-main`
("Document should have one main landmark") and `page-has-heading-one`
("Page must have a level-one heading"). Traced to the shared cause:
every one of these pages uses the same custom Site-Editor template,
"Content Hub" (`wp_template` post ID 2378 — stored in the database, not
a theme file), whose entire content is:

```
wp:template-part (header: learning-hub-header)
wp:post-content
wp:template-part (footer: learning-hub-footer)
```

No `wp:post-title` block anywhere (no H1 on any of these 12 pages), and
`wp:post-content` isn't wrapped in a `<main>`-tagged group the way the
theme's default page template does it. This is a real, previously
undetected a11y regression across every page built on this template —
undetected because every previous test run against these pages either
404'd (wrong environment, see earlier entries this month) or predates
being added to `CRITICAL_PAGES` at all, so axe never actually reached
real content on any of them until today.

**Not fixed** — per Janet's call and this project's existing convention
(a DB content write needs her go-ahead, especially one touching a
shared template used by 12 live pages): the axe failures are left in
place, correctly documenting the real state. Fixing needs a design
decision (where the H1 sits relative to each page's own on-page
headings, whether post_title duplicates anything) best made by eye in
the Site Editor, not blind via a DB update to post 2378.

Verified: `blocks.spec.js` 18/18 pass (new block-presence checks are all
correct); `axe.spec.js` correctly fails on all 12 `/learning/*` pages
with the same 2-rule signature, confirming this is systemic, not
per-page.

Commits: `tests: add remaining /learning/* pages to CRITICAL_PAGES +
block-presence checks` (branch `plc-updates`, repo `be-bite-smart`).

## 2026-09-09 (cont'd) — Correction + fix: Content Hub template's <main> landmark

**Correcting the previous entry**: re-verifying against actual rendered
HTML (not just the template's raw content) showed the earlier claim —
"all 12 pages fail identically on landmark-one-main + page-has-heading-one"
— was wrong on the H1 part. Most `/learning/*` pages already author
their own `<h1 class="wp-block-post-title">` directly in the page's own
content (confirmed via curl on kids/downloads/guide/bite/books/stages-
pregnancy). Only 4 pages were actually missing an H1: `/learning/`
(hub) and `/learning/guide/references/` (both have real content, just
never got a title block added), plus the 2 known-empty stub pages. The
`landmark-one-main`/`region` pair, however, genuinely was universal —
that part of the diagnosis held up. Also missed two whole rule
categories in the first pass: `heading-order` (7 pages) and Guide's two
serious findings (`color-contrast`, `nested-interactive`).

**Fixed** (Janet's go-ahead): wrapped `wp:post-content` in a
`<main>`-tagged group in the "Content Hub" template (`wp_template` post
2378), matching the exact markup convention this site already uses in
its own "page" (post 180) and "single" (post 2503) templates
(`wp:group {"tagName":"main","style":{"spacing":{"margin":{"top":"var:preset|spacing|60"}}},"layout":{"type":"constrained"}}`).
Deliberately did NOT add `wp:post-title` — since 11 of 15 pages already
author their own H1 in-content, a template-level title would duplicate
it on all of them. Applied via `wp_update_post()` through the
established `wp-load.php` + PHP CLI pattern (see
[[be-bitesmart-local-env]]), followed by `wp_cache_clear_cache()` and a
manual purge of `wp-content/cache/supercache/bebitesmart.local/` (WP
Super Cache doesn't reliably clear on its own for direct DB template
edits).

Verified: full `axe.spec.js` run before/after. `landmark-one-main` and
`region` are gone from all 15 `/learning/*` + `Home` tests — zero
regressions. One run immediately after the cache purge showed 6 pages
failing with suspiciously fast (~500-700ms) results and no captured
violation detail — a transient WP Super Cache regeneration race under
4 parallel workers right after the purge, not a real issue; a second
run a few seconds later was clean and stable. Remaining failures
exactly match what should still be there: `heading-order` on Downloads/
Guide/After a Bite/all 4 Stage+All-Resources pages, `page-has-heading-one`
still on the 2 empty stub pages (untouched, as scoped), and Guide's
`color-contrast` + `nested-interactive`. None of that was touched —
per-page editorial/content work, not part of this fix.

As a side effect, this also fixed the page's own `#wp--skip-link--target`
anchor: WordPress auto-assigns that ID to whichever element serves as
the skip-link's target, and it's now attached to the real `<main>`
element instead of pointing at nothing.

Backup — pre-fix `post_content` of template post 2378, for rollback if
ever needed (this wasn't actually saved anywhere else durable, despite
what an earlier draft of this entry claimed):

```
<!-- wp:template-part {"slug":"learning-hub-header","theme":"twentytwentyfive-child","area":"header"} /-->

<!-- wp:post-content /-->

<!-- wp:template-part {"slug":"learning-hub-footer","theme":"twentytwentyfive-child","area":"footer"} /-->
```

## 2026-09-09 (cont'd) — Fixed: Guide chapter badge contrast (color-contrast)

Janet asked where the `color-contrast` finding on `/learning/guide/`
actually was, guessing a greyed-out video — it wasn't; guessed wrong on
my part too by not pointing to the specific element in the previous
entry. It's the "Video"/"Text" format-availability badges on each
chapter row, in their active (filled) state: white text on
`var(--wp--preset--color--accent-1)` (`#d16b0c`), 3.6:1 contrast against
a 4.5:1 requirement for 12px text.

Notable: this same file already has a thoughtful, WCAG-cited fix for
the adjacent `.is-off` state (2026-08-28, replacing an opacity-based
dim that collapsed contrast) — `.is-active` just wasn't covered in that
pass.

Fix: `.guide-chapter-badge.is-active`'s background changed from the
shared `--wp--preset--color--accent-1` token to a hardcoded `#b35a09`
— same orange hue, ~15% darker, verified via the WCAG relative-
luminance formula at 4.8:1 (comfortable margin over the 4.5:1 minimum).
Left the shared `accent-1` token itself untouched — it's used well
beyond this one badge sitewide, so darkening it globally in
`theme.json` would have been a much bigger, unreviewed visual change.
Rebuilt (`pnpm run build`) so the compiled
`build/guide-chapter-display/style-format-toggle*.css` — what's
actually enqueued — picks up the change.

Verified: axe no longer flags `color-contrast` on Guide (2 remaining
violations there, `heading-order` + `nested-interactive`, are separate,
pre-existing, untouched). Full `axe.spec.js` + `blocks.spec.js` re-run:
no regressions elsewhere. Screenshot-checked the badge still reads as
the same brand orange, just slightly darker.

Commit: `fix: guide chapter badge active-state contrast (axe:
color-contrast, serious)` (branch `plc-updates`, repo `be-bite-smart`).

## 2026-09-09 (cont'd) — Fixed: Guide chapter badges nested-interactive (axe)

Investigated and fixed the last of Guide's a11y findings from earlier
today: `nested-interactive` (serious) on `.guide-chapter-summary` — a
native `<summary>` (natively interactive, click toggles the parent
`<details>`) containing two real, independently-clickable `<button>`s
(the Video/Text format-availability badges). `format-toggle.js` was
already fighting the browser's native click-inside-summary behavior
with `preventDefault()`/`stopPropagation()` specifically because of
this nesting — itself a sign the structure was awkward, and a genuine
WCAG 4.1.2 violation, not a false positive.

Used plan mode for this one given the design tradeoff involved: an
Explore agent confirmed the exact DOM structure, what each nested
control actually does (genuinely independent semantics from the
summary's own toggle), and that this codebase's own precedent
(`qa-entry-display.php`, `episode-display.php`) keeps `<summary>` lean
and puts actionable links in the revealed body instead — which doesn't
directly transfer here since the Guide badges must stay visible in the
*collapsed* row. Presented two real approaches (keep native
`<details>/<summary>` + reposition the badges as a sibling, vs. rebuild
as a custom JS-driven disclosure) with an ASCII preview of the visual
difference; Janet chose keeping native `<details>/<summary>`.

**Implementation surprise, worth remembering**: the first attempt moved
the badges to be a sibling of `<summary>` but still *inside* `<details>`
— `position:absolute` there computed the right top/right values (per
`getComputedStyle`) but rendered far outside the visible card, near the
*bottom* edge of the closed `<details>` box instead of the top. Root
cause: Chromium's newer internal wrapping of a `<details>`'s non-summary
content interferes with absolutely-positioned children placed directly
inside it. Confirmed this empirically (injected debug outlines +
screenshot) rather than accepting the theory on faith. Fix: moved the
badges out one more level, to be a sibling of `<details>` itself inside
the outer `<article class="guide-chapter-row">` — a plain element with
no special browser behavior. Gave `.guide-chapter-row` `position:relative`
as the new containing block (it has no padding of its own, so the same
offsets land in the same visual spot).

Also removed the now-dead `preventDefault()`/`stopPropagation()` in
`format-toggle.js` (a badge click can no longer reach `<summary>` at
all once it's not nested inside it) and fixed a real mobile regression
caught via screenshot before considering this done: pulling the badges
out of the title's flex row meant the title no longer reserved space
for them, so at ≤600px it wrapped underneath and overlapped the
now-absolutely-positioned badges. Added `padding-right` to
`.guide-chapter-title-row` specifically (not all of
`.guide-chapter-main`, so the summary-text description below isn't
squeezed too) at that breakpoint to reserve room.

Verified: screenshotted the row at desktop/tablet/mobile after each
iteration; scripted click-behavior check confirms a badge click toggles
its own state without opening the chapter, while clicking the title
still opens it natively; axe no longer flags `nested-interactive` on
Guide (1 remaining violation there, `heading-order`, is separate,
pre-existing); full `axe.spec.js` + `blocks.spec.js` re-run shows the
exact same 8 pre-existing failures as before this fix — no regressions.

Commit: `fix: guide chapter badges nested inside interactive <summary>
(axe: nested-interactive)` (branch `plc-updates`, repo `be-bite-smart`).
Plan file: `so-for-the-nested-soft-bird.md`.

## 2026-09-09 (cont'd) — UX: Guide chapter Video/Text badges only show once opened

Janet's feedback after seeing the nested-interactive fix live: with the
Video/Text badges visible on every collapsed chapter row, scanning the
list read as too mentally busy. Moved them into `.guide-chapter-body`
instead — a visitor now opens a chapter first, then decides what to
toggle, rather than choosing formats before seeing anything.

Happy accident: this also simplifies the nested-interactive fix from
earlier the same day. Badges inside `.guide-chapter-body` are a sibling
of `<summary>`, never a descendant — satisfies the same axe rule
without any of that fix's `position: absolute` / breakpoint overrides /
title-row padding reservation. Removed all of it; `.guide-chapter-badges`
is back to a plain `display: flex` rule, no special positioning needed.
This is also now a closer match to this codebase's own established
pattern (`qa-entry-display.php`, `episode-display.php`): actionable
controls live in the revealed body, not the always-visible summary —
the thing that didn't directly apply this morning (badges needed to be
visible collapsed) now does, since they don't anymore.

Verified: screenshotted collapsed + expanded at desktop and mobile
(no badges collapsed; clean placement between summary and video content
when open, no overlap either width — the mobile overlap fixed this
morning is moot now, nothing to reserve space for). Scripted check:
badge still toggles its own `aria-pressed` + the matching
`.guide-chapter-format` section's `hidden`, chapter stays open
throughout. Full `axe.spec.js` + `blocks.spec.js`: same 8 pre-existing
failures as this morning, no regressions.

Commit: `feat: guide chapter Video/Text badges only show once the
chapter is open` (branch `plc-updates`, repo `be-bite-smart`).

## 2026-09-09 (cont'd) — Guide chapter previews + Table of Contents text no longer shrunk

Janet: the Table of Contents and each chapter's preview text (title +
description shown before opening) read noticeably smaller than the
rest of the site. Two causes:

- Explicit shrink: `.guide-chapter-summary-text` (0.9em),
  `.guide-toc-chapter-title` (0.95em), `.guide-toc-section-heading`
  (0.85em) were all sized down relative to their inherited context.
- Invisible shrink: `.guide-chapter-title` had no font-size override at
  all, yet still read small — a plain `<span>` inside `<summary>` never
  inherits the theme's typography preset the way a `<p>` inside
  `.entry-content` does. Measured directly: 16px inherited in this
  component vs. 17.7px for an ordinary theme paragraph on `/evidence/`.
  Nothing in this file was visibly "shrinking" it, but it still read
  smaller than normal body text site-wide.

Fixed all four with `font-size: var(--wp--preset--font-size--medium)`
— the same token already used elsewhere in this codebase
(`.capitalized-and-colored`, `.bright-chip`) for exactly this: normal
reading-size text sitting in a context that wouldn't otherwise inherit
it. Left the small numeric chapter-index markers alone
(`.guide-chapter-index`, `.guide-toc-chapter-index`) — compact
list-numbering, not preview text, standard to stay smaller by design.

Verified: screenshotted the ToC and a collapsed chapter row — title and
description now read at consistent, normal size, section headings read
as clear labels without looking oversized. Full `axe.spec.js` +
`blocks.spec.js` re-run: same 8 pre-existing failures as before, no
regressions.

Commit: `style: guide chapter/ToC text no longer artificially shrunk
below normal reading size` (branch `plc-updates`, repo `be-bite-smart`).

## 2026-09-09 (cont'd) — ToC chapter title now tracks the real paragraph element

Janet asked whether the previous fix (`var(--wp--preset--font-size--medium)`)
could instead pull its size from the element itself, so a future editor
change to paragraph typography flows through automatically rather than
staying pinned to today's setting.

Checked WordPress's actual generated global-styles CSS rather than
guessing: it emits a bare tag selector, `:root :where(p){font-size:
var(--wp--preset--font-size--medium); line-height: 1.7}`. A real `<p>`
element matches that rule automatically forever, regardless of how the
value is later expressed (a different preset, or a raw custom size) —
a hardcoded variable reference can only track edits to what that one
preset itself is set to, not a switch to an entirely different setting.

- `.guide-toc-chapter-title` was a `<span>` — now a real `<p>`
  (`bitesmart_render_guide_toc_item()`). Valid here since it sits inside
  a plain `<a>` link in the ToC's list, not inside a `<summary>`.
  Font-size override removed entirely; added a margin reset instead
  (a `<p>`'s UA-default margin would otherwise misalign it in the
  link's flex row).
- `.guide-chapter-title` and `.guide-chapter-summary-text` **can't** get
  the same treatment: both live inside a `<summary>` that's the first
  child of its `<details>`, and HTML restricts that context to phrasing
  content only — `<p>` is flow content, invalid there regardless of
  styling. Documented this directly in their CSS comments; left them on
  the preset-variable reference (tracks edits to the Medium preset
  itself, just not a repoint to a different preset or a raw value).

Verified: confirmed via `getComputedStyle` the ToC title is a real `P`
tag computing to 17.7248px, exactly matching an ordinary theme
paragraph (not a copied value). Screenshotted the ToC — no layout
regression. Full `axe.spec.js` + `blocks.spec.js`: same 8 pre-existing
failures, no regressions.

Commit: `style: ToC chapter title tracks the real paragraph element,
not a copied value` (branch `plc-updates`, repo `be-bite-smart`).

## 2026-09-09 (cont'd) — Chapter-index number extended to medium preset too (Janet's edit)

Janet extended the font-size fix to `.guide-chapter-index` (the small
numeric chapter marker) as well, changing it from `0.85em` to
`var(--wp--preset--font-size--medium)` — I'd deliberately left this one
alone earlier, treating it as compact list-numbering rather than
preview text; Janet's call to include it too. Already rebuilt when
picked up; verified and committed.

**Unrelated red herring hit while verifying**: `axe.spec.js`'s Books
test failed once on a `region` violation caused by a stale WP Super
Cache page containing a raw PHP warning — `build/read-more.asset.php`
`include()` had transiently failed mid an earlier `pnpm run build`
today (the file is deleted and rewritten during a build), got cached
by WP Super Cache at that exact moment, and kept being served
afterward even though the file was fine again moments later. Confirmed
via cache-bypassing (`?nocache=` query string) requests that the
underlying code was never actually broken; a fresh cache purge
resolved it. Back to the same 8 pre-existing failures, 33 passed.

Commit: `style: extend guide-chapter-index to the medium preset too
(Janet)` (branch `plc-updates`, repo `be-bite-smart`).

## 2026-09-09 (cont'd) — Guide chapter title is a real h3, not a span

Janet asked whether an h3 would be more semantic for the chapter title,
given it lives inside `<summary>`. Worth a real check rather than going
from memory — my earlier characterization of `<summary>`'s content
model as "phrasing content only" was incomplete. Checked the actual
WHATWG spec: it's "Phrasing content, optionally intermixed with
heading content" — a heading (h1-h6) is a specific, explicit exception
permitted alongside other phrasing content (a decorative chevron SVG,
other spans), unlike `<p>`, which genuinely isn't allowed there.

Changed `.guide-chapter-title` from `<span>` to `<h3>`, matching this
codebase's own existing choice for the identical `<details>/<summary>`
pattern in `qa-entry-display.php`/`episode-display.php`. h3 fits the
document outline this page already has (h1 page title > h2
`.guide-section-heading` Section grouping > h3 here).

Kept font-size/font-weight/margin explicit (same values as before) so
the browser's own h3 defaults (bold, ~1.17em, block margin) don't
visibly change the card. One real visual side effect found: the theme
has a global `h3{color: var(--wp--preset--color--accent-5)}` rule, so
the title picked up that accent color instead of plain text color —
Janet's call that this reads fine, left as-is, no color override added.

Verified: screenshotted the row (confirmed the color was the only
visible change, and intentional); `getComputedStyle` confirms a real
`H3` computing to the same 17.7248px as before. Checked Guide's
existing `heading-order` violation specifically — still exactly the
one pre-existing issue (an unrelated "Important Notice" heading
elsewhere on the page), not worsened by chapters now appearing in the
heading outline. Full `axe.spec.js` + `blocks.spec.js`: same 8
pre-existing failures, 33 passed, no regressions.

Commit: `style: guide chapter title is a real h3, not a span` (branch
`plc-updates`, repo `be-bite-smart`).

## 2026-09-09 (cont'd) — Reverted: guide chapter title back to span (h3 was valid HTML, not accessible in practice)

Janet pushed back on the h3 change from moments earlier, having found
guidance that a heading nested inside `<summary>` can be dropped by
screen readers even though it validates. Checked this against a
primary reference (Scott O'Hara's `<details>`/`<summary>` writeup,
scottohara.me) rather than trusting the spec's permission alone: the
article explicitly recommends **against** it — `<summary>` maps to a
button role for assistive tech, and nested heading semantics aren't
consistently exposed once that mapping applies. Confirmed specifically
that VoiceOver drops a heading nested in a `role="button"` context
entirely, removing it from the page's heading-navigation outline.
Valid HTML per the WHATWG content model (confirmed correct last entry)
is not the same thing as a good screen-reader experience.

Reverted `.guide-chapter-title` from `<h3>` back to `<span>`, same
font-size/font-weight/margin as before. This also undoes the h3
change's incidental visual side effect (the theme's global
`h3{color: var(--wp--preset--color--accent-5)}` rule) — confirmed via
`getComputedStyle` it's back to plain text color
(`rgb(17,17,17)`, matching the pre-h3 measurement). Documented the
finding directly in both files' comments so this isn't re-tried without
knowing why, and flagged that `qa-entry-display.php`/
`episode-display.php` use the identical h3-in-summary pattern this
reverts away from — worth a real screen-reader audit across all three
someday, not just an HTML validator pass.

Verified: confirmed via `getComputedStyle` it's a real `SPAN` again.
One full-suite run in between showed a burst of unrelated failures
across completely different pages (Evidence, Contact, Donate, etc.) —
confirmed a flake (Evidence alone passed immediately in isolation), not
caused by this change; a second full run came back clean at the same 8
pre-existing failures, 33 passed.

Commit: `revert: guide chapter title back to span, not h3 (screen
reader behavior)` (branch `plc-updates`, repo `be-bite-smart`).

## 2026-09-09 (cont'd) — Decision: leave chapter titles as non-headings, rely on the ToC for jump-navigation

Follow-up to the h3-then-revert episode above: Janet asked whether
anything more could be done for accessibility, since it feels odd for
a whole page of chapters to have no headings a screen reader user can
jump between.

Researched rather than guessed at a fix. Findings:

- This is a genuinely unresolved, actively-disputed problem in the
  accessibility community, not something with a known clean answer.
  WordPress core has an [open Gutenberg issue](https://github.com/wordpress/gutenberg/issues/71942)
  proposing to let the Details block wrap `<summary>` text in a
  heading — the same pattern just reverted here — without addressing
  the screen-reader inconsistency already documented.
- [Hassell Inclusion's deep-dive on accessible `<details>`/`<summary>`
  accordions](https://hassellinclusion.com/blog/accessible-accordions-part-2-using-details-summary/)
  found a heading inside `<summary>` is announced correctly on
  VoiceOver/iOS but gets **no heading voicing at all** on
  TalkBack/Android — genuinely inconsistent per screen reader, not
  just "sometimes broken."
- One candidate fix surfaced (a blog comment, not a tested/endorsed
  pattern): a visually-hidden duplicate heading as a sibling *before*
  each `<details>` (not nested inside `<summary>`, so no button-role
  interference) — would let heading-navigation users jump chapter-to-
  chapter, at the cost of a linear screen-reader user hearing the
  title twice. No source found has vetted this against real screen
  readers.

**Decision (Janet's call)**: leave `.guide-chapter-title` as a plain
`<span>`, no further change. The existing Table of Contents already
gives screen reader users a reliable way to jump directly to any
chapter — a real list of `<a>` links, landing on and auto-expanding
the target chapter — which is a different AT mechanism ("list of
links," not "list of headings") but answers the same practical need.
Not worth adding unproven markup for a benefit (heading-navigation
specifically) that's inconsistently supported across screen readers
regardless.

If this gets revisited: the visually-hidden-duplicate-heading idea
above is the one option with any real backing, but treat it as
genuinely unproven and test with actual screen readers (VoiceOver,
NVDA, TalkBack) before trusting it, not just an automated axe check —
axe has no rule for this at all (it's a usability gap, not a WCAG
success-criterion failure).

## 2026-09-09 — Pregnancy stage page summary

Added a brief intro summary paragraph to the top of `/learning/stages/pregnancy/`
(page ID 2421, "Q & As for Expecting Parents to Prepare for Dog & Child
Interactions"), explaining to parents what to expect from the page before they
hit the search/browse content below. Janet's ask, modeled loosely on an
outside reference site's tone (a generic "Prenatal/Baby/Toddler/Preschool"
stage-summary pattern) but with copy rewritten for this site's actual subject
(preparing a dog for a baby's arrival), since the reference text was about
generic developmental milestones, not dog safety.

Of the four Stage pages, only Preschool (ID 2426) previously had any top
summary content — a richer treatment (colored border/background band, image,
paragraph, "Find Resources" heading). Pregnancy, Baby, and Toddler were all
bare (H1 + search block + browse block only). Janet chose the simpler option:
a single `wp:paragraph` block inserted right after the H1 and before the
`custom/learning-search` block, matching Pregnancy/Baby/Toddler's existing
minimal style rather than replicating Preschool's full hero treatment (no new
image needed). Baby and Toddler were left untouched — not part of this ask.

Applied via the `wp-load.php` + PHP CLI + `wp_update_post()` pattern (see
[[bebitesmart-local-env]]), not raw SQL, with Janet's go-ahead on the drafted
copy first. `wp_cache_clear_cache()` was sufficient locally (no
`wp-content/cache/supercache/` directory existed yet, so no stale HTML to
purge). Scratch script deleted after use.

**Also surfaced along the way, unrelated to this task**: the `/learning/stages/`
hub page (ID 2403, "Child Life Stages") has real in-progress content with a
placeholder paragraph ("text about pregnancy stage") under its own "Pregnancy"
heading — contradicts the 2026-09-09 content-hub-plan note calling this page
"empty." Not investigated or touched; flagged here for whoever next looks at
that page's status.

**New global preference learned this session**: Janet does not want em dashes
used in drafted copy or in Claude's own prose replies going forward — saved as
a memory (`no-em-dashes`) since it applies beyond this one task.

## 2026-09-09 (cont'd) — Ran the full local suite (not just axe/blocks); fixed a real local-testing gap

Janet asked whether anything else was failing — this whole session had
only been re-running `axe.spec.js`/`blocks.spec.js` narrowly. Ran all
13 spec files locally for the first time today: **135 passed, ~24
failed (down from ~36), 52 skipped.**

Found 3 suites failing on every page uniformly — a real, pre-existing
local-testing gap, not anything from today's content work:
`playwright.config.js` never set `ignoreHTTPSErrors`, so the `request`
API context (used for canonical/link/download checks in `seo.spec.js`/
`links.spec.js`/`downloads.spec.js` — distinct from the browser context
`page.goto()` uses, which is why `axe.spec.js`/`blocks.spec.js` never
hit this) refuses the local site's self-signed cert the moment it
touches an absolute `https://` URL. WordPress always emits absolute
URLs at its configured `home_url()` scheme regardless of the request's
actual scheme, so every page hit this identically.

**Fixed** (Janet's go-ahead): added `ignoreHTTPSErrors: true` to
`playwright.config.js`'s shared `use` block — a no-op against staging/
production, which have real certs.

- `downloads.spec.js`: fully fixed, 0 failures (was 3).
- `links.spec.js`: improved to 1 failure (was 2) — Learning hub's cert
  error fixed; Home's separate "no same-origin links found" issue
  remains (different root cause, see below).
- Tried switching the local convention to `https://bebitesmart.local`
  now that cert trust isn't the blocker — made `links.spec.js` worse
  (site content itself isn't fully scheme-consistent internally, so
  this wasn't a clean win). Left `http://` as `testing.md`'s documented
  local convention, unchanged.

**Not fixed, flagged as a separate, pre-existing issue**: `seo.spec.js`
fails on all 23 pages, but this is a different root cause entirely —
its own assertion logic builds the *expected* canonical from the
literal `baseURL` scheme (`http://` by local convention) and compares
it for exact equality against WordPress's real canonical tag (always
`https://`, its configured `home_url()`). `ignoreHTTPSErrors` doesn't
touch this — it's a scheme-comparison mismatch, not a cert-trust
issue. Home's `links.spec.js` failure ("no same-origin links found")
is the same root-cause family (its `http://`-based origin filter
excludes the header logo's absolute `https://` href). Left as-is —
fixing it means either rewriting the test's canonical-comparison logic
to be scheme-agnostic, or making the site itself fully scheme-consistent,
neither of which is a quick call; didn't make it without asking first.

Also hit and confirmed a genuine flake (not a regression): one
`video-quote` language-switch test failed once in a mixed run, passed
cleanly twice in isolated re-runs immediately after — same category of
transient local-dev flakiness (WP Super Cache regeneration races) hit
several times already today.

Commit: `fix: ignore self-signed cert errors so seo/links/downloads
suites can run locally` (branch `plc-updates`, repo `be-bite-smart`).

## 2026-09-09 — Baby and Toddler stage page summaries

Follow-up to the same day's Pregnancy stage summary (above): added the same
plain-paragraph top summary to the two remaining bare Stage pages, Baby (page
ID 2419, `/learning/stages/baby/`) and Toddler (ID 2423,
`/learning/stages/toddler/`) — Janet's ask, "do the same for the other
stages." Preschool already had its own (richer) summary and was left
untouched; only these two needed it. Same placement (one `wp:paragraph`
block right after the H1, before `custom/learning-search`), same copy voice
as Pregnancy's paragraph (context, what the section covers, call to action),
no em dashes per the new [[no-em-dashes]] preference, drafted for review and
published only after Janet's go-ahead.

Applied via the same `wp-load.php` + PHP CLI + `wp_update_post()` script
pattern as Pregnancy (both posts updated in one script this time). Unlike
Pregnancy's cache-clear, `wp-content/cache/supercache/bebitesmart.local/`
did exist this time (populated by browsing the Pregnancy page after the
earlier fix) — `wp_cache_clear_cache()` alone was again not trusted per the
known local gotcha, so the folder was deleted manually too. Scratch script
deleted after use.

All 4 real Stage pages (Pregnancy, Baby, Toddler, Preschool) now have some
form of top summary content.

## 2026-09-09 — After a Bite page: emergency callout built, intro summary drafted

Continuing the same day's Stage-page-summary work: looked at
`/learning/bite/` (page ID 2414, "After a Bite Resources") since Janet asked
about doing the same there. Unlike the 4 real Stage pages, this page already
existed with real structure (a "Parents of Dog Bite Victims" Facebook support
group section with quote/button, and an After a Bite search/browse block) but
its intro was two placeholder paragraphs: literal "introduction here" text,
and a second paragraph that was Janet's own editorial idea-note about adding
an emergency ER/urgent-care callout with a link to a University of Rochester
Medicine article and an unbuilt "[button]".

Drafted top-summary copy for the first placeholder (context: not alone, help
available; what the page offers: guidance + the support group; CTA to
explore resources below) using the same voice/pattern as the 4 Stage
summaries. Janet applied that copy herself directly in the editor rather
than having it scripted in.

Built the second piece (Janet: "build it now too"): turned the idea-note
into a real callout — reused the site's existing `custom-block-card
custom-block-border` component (white card, orange left border, already
used elsewhere for bio-card/episode-card/resource) rather than introducing
new CSS, with an "In an Emergency" H2, the ER/urgent-care guidance text, and
a real button linking out to the URMC article (`target="_blank" rel="noreferrer
noopener"`, matching the existing "Join The Group" button's convention).
Used H2 deliberately (not H3) even though the page's very next heading is
already an H3 ("Parents of Dog Bite Victims Facebook Group", a pre-existing
H1->H3 skip, part of the known "heading-order on 7 pages" a11y gap in
[[be-bitesmart-content-hub-plan]]) — new heading is correctly ordered, the
pre-existing skip elsewhere on the page was left alone as out of scope.

Applied via the same `wp-load.php` + PHP CLI + `wp_update_post()` script
pattern, replacing only the specific old placeholder paragraph (matched via
its distinctive text, not a hardcoded position) so a concurrent manual edit
elsewhere on the page (which did happen mid-session, see above) wouldn't get
clobbered. Scratch script deleted after use; supercache folder purged
manually again (same gotcha as the Baby/Toddler follow-up above).

**Worth Janet double-checking**: the manually-pasted intro paragraph landed
in the editor fully italicized with the closing period sitting outside the
`<em>` tag ("...through this*.*") — looks like a paste-formatting artifact,
not flagged as intentional, left untouched since it's her own edit.

## 2026-09-09 (cont'd) — Reverted cert-trust fix; skip what can't work locally instead

Janet's call: rather than making Playwright trust the local self-signed
cert (previous entry's fix), make the suite recognize and skip the
specific checks that structurally can't produce a meaningful result
under the documented `http://bebitesmart.local` convention, consistent
with the existing `shouldRunHostChecks()` pattern already used in
`https-host.spec.js`. Reverted `ignoreHTTPSErrors` via `git revert`.

Added `isLocalHttpWorkaround(baseURL)` to `helpers/host.js` — true only
for a literal `http://` baseURL (staging/production always use
`https://`, matching their own real scheme, so this never fires there).

- `helpers/seo.js`: reordered `assertPageSeo()` so title/description/
  canonical-presence checks always run regardless of environment; only
  the exact canonical-*scheme* comparison is skipped locally (WordPress
  always renders `https://` canonicals no matter the request scheme, so
  this specific comparison can never pass under the `http://` local
  convention even when the real content is correct).
- `smoke/links.spec.js`: first attempt only skipped the "zero links
  found" edge case (Home, whose nav is entirely absolute `https://`
  hrefs) — turned out incomplete. WordPress force-redirects `http://`
  to `https://` site-wide, so even a same-origin `http://` link (like
  Learning hub had) hits the self-signed cert the moment
  `checkLinkStatus()` actually fetches it, not just when collection
  finds zero matches. Widened the skip to fire before any fetch is
  attempted at all, whenever `isLocalHttpWorkaround` is true.
- `smoke/downloads.spec.js`: skip once a page is confirmed to have real
  download content, before the first fetch — WordPress media URLs
  (`wp_get_attachment_url()`) are always absolute `https://`, so any
  real download link hits the same wall.

**Real, previously-invisible finding surfaced by the `seo.js` reorder**:
3 pages — Guide references, Stage: All Resources, and Learning contact
— are genuinely missing a meta description. This was always broken but
never visible, since the canonical-scheme check (now skipped locally,
but previously asserted unconditionally and always failing first under
`http://`) short-circuited before the description check ever ran.
Flagged to Janet — this is editorial/All in One SEO content work, not
a code fix, and out of scope here.

Verified: full 13-file suite locally — **110 passed, 98 skipped, 11
failed** (down from ~36 failed when this all started this afternoon).
Every remaining failure is fully explained: the 8 pre-existing axe
findings tracked all day, plus the 3 genuine SEO gaps just found. Zero
environmental/scheme-mismatch noise left in the suite.

Commit: `test: skip checks that structurally can't work under local's
http:// convention, instead of trusting the local cert` (branch
`plc-updates`, repo `be-bite-smart`).

## 2026-09-09 — Stages hub: wired up "View All Q&As" button, cleaned up nested `<em>` artifacts

Janet asked whether `/learning/stages/` (page ID 2403, "Child Life Stages")
needed a dedicated "All Resources" section, given it already opens with a
"View All Q&As" button before its per-stage sections (Pregnancy/Baby/
Toddler/Preschool/After a Bite, each with its own summary + "Go to [Stage]
Q&As" button). Answer: no — a separate section would duplicate what that top
button already covers, and the per-stage sections exist specifically to help
a visitor pick one stage. The real gap was that the top button had **no
`href` at all** (dead link), not a missing section. Fixed by linking it to
the existing pooled "All Stages" view, `/learning/stages/all-resources/`
(page ID 2911, `stageSlug: "all"`, see [[be-bitesmart-content-hub-plan]]).

Also cleaned up a real bug found while reading the page: the per-stage
summary paragraphs (populated earlier this session with drafted copy) were
each wrapped in progressively more nested `<em>` tags — 1/2/3/4/5 deep
across Pregnancy/Baby/Toddler/Preschool/After a Bite respectively by the
time this ran, apparently from a repeating paste artifact in Janet's editor
workflow. Confirmed the only `<em>` usage anywhere on this page was this
artifact, so stripped all 30 `<em>`/`</em>` occurrences in one pass — all
five paragraphs now render as plain text.

**Deliberately left untouched, per Janet's explicit call**: both Toddler
links (top button row + the Toddler section's own "Go to Toddler Q&As"
button) — she's mid-edit on these herself. Note their current state isn't
actually fixed yet either: both now point to `https://bebitesmart.local/learning/stages/`
(the hub page itself) rather than `https://bebitesmart.local/learning/stages/toddler/`
— an improvement over the earlier stale `/articles/stage/toddler/` URL, but
still not the right target. Flagged, not touched — the fix script asserted
both hrefs came out byte-for-byte identical before saving, specifically so
this wouldn't get silently clobbered.

Applied via the same `wp-load.php` + PHP CLI + `wp_update_post()` pattern as
the rest of today's work; had to re-read the page's live content twice
before running since Janet was actively editing it in parallel (the button's
label had changed from "View All Q&A Content" to "View All Q&As", and the
Toddler links had changed, between the plan being drafted and executed).
Scratch scripts deleted after use; supercache folder purged manually again.

## 2026-09-09 — Learning Hub header: "Books and Links" nav item made a dropdown

Janet asked for the Parents' Learning Center header's "Books and Links" nav
item to become a dropdown with 4 sub-items linking to the 4 book sections on
`/learning/books/` (Younger Children, Older Children, All Ages (With
Guidance), Parents) — each section already had a `#anchor` id and the page
itself already has 4 jump buttons using those exact same anchors and labels.

Followed the existing dropdown pattern already in use for "Learn By Stage"
in the same menu: converted the plain `wp:navigation-link` for Books and
Links into a `wp:navigation-submenu` (kept its original page-type/id/url
binding as the parent link, unchanged), with 4 new child `wp:navigation-link`
custom-type blocks pointing at `/learning/books#younger-children`,
`#older-children`, `#all-ages`, `#parents` — labels copied verbatim from the
page's own buttons per Janet's choice. Edited the "Learning Hub Menu"
`wp_navigation` post (ID 2384, referenced by both the mobile and
desktop/tablet variants of the "Learning Hub Header" template part, ID 2379)
via the same `wp-load.php` + PHP CLI + `wp_update_post()` pattern as the
rest of this month's work; `wp_cache_clear_cache()` + manual supercache
purge after. Verified via rendered HTML on `/learning/books/`: the new
submenu carries the identical `has-child open-on-hover-click` /
`data-wp-interactive="core/navigation"` wiring as the working "Learn By
Stage" dropdown, with all 4 child links in the right order and pointing at
the right anchors, in both header breakpoints. Scratch scripts deleted
after use.

## 2026-09-09 — Learning Hub header: "For Kids" nav item made a dropdown too

Same request extended to the "For Kids" nav item, linking to the 3 sections
already on `/learning/kids/`: the children's video series
(`#childrens-video-series`), the interactive learning app (`#app`), and the
recommended children's books (`#books`). That page already had its own 3
jump-buttons using those exact anchors/labels ("Paws To Prevent" Video
Series / Interactive Learning App / Recommended Children Books) — reused
them verbatim, same as the Books and Links labels above.

Same edit to the same "Learning Hub Menu" `wp_navigation` post (2384):
converted the plain "For Kids" `wp:navigation-link` into a
`wp:navigation-submenu` (parent link unchanged) with 3 custom-type children.
Same `wp-load.php`/PHP-CLI pattern, cache purge after. Verified via rendered
HTML on `/learning/kids/`: submenu wiring matches the other two working
dropdowns, all 3 child links present with correct anchors in both header
breakpoints; the curly-quote label renders via WordPress's normal
`wptexturize` (`&#8220;`/`&#8221;`), same as everywhere else on the site.
Scratch scripts deleted after use.

## 2026-09-09 — Learning Hub header: "Downloads" nav item made a dropdown too

Third and final nav item converted to the same pattern, per Janet's request:
"Downloads" now links to the 4 sections on `/learning/downloads/` (Coloring
Books, Episodes, Guide, Articles). Unlike the Books/Kids pages, this page
had no pre-existing jump-buttons to borrow labels from, so used short
parallel labels (Janet's choice over verbatim section headings).

Anchor gap found and fixed first: 3 of the 4 sections already had an anchor
(`#download-coloring-books` — baked into `custom/coloring-books-list`'s own
render output, see `coloring-books-list.php`; `#download-videos` for
episodes; `#guide` for the Guide heading) but "Download Articles" had none
— that section is also currently just a bare heading + empty paragraph
(no article content yet). Added `{"anchor":"articles"}` to that heading
(same technique already used for the Guide heading right above it, Janet's
go-ahead) so the new dropdown link has somewhere to land; no visible content
changed.

Same edit to the same "Learning Hub Menu" `wp_navigation` post (2384):
converted the plain "Downloads" `wp:navigation-link` into a
`wp:navigation-submenu` with 4 custom-type children. Same `wp-load.php`/
PHP-CLI pattern for both posts (2410 then 2384), one cache purge after both.
Verified via rendered HTML on `/learning/downloads/`: all 4 target anchors
present (including the new `#articles`), all 4 dropdown sub-items rendered
in both header breakpoints. Scratch scripts deleted after use.

The Learning Hub Menu now has 4 dropdowns total (Learn By Stage, For Kids,
Downloads, Books and Links), all following the identical
`wp:navigation-submenu` pattern.

## 2026-09-09 — Learning Hub header: "Parent Guide" nav item made a dropdown (5th and final)

Last of the 5 Learning Hub dropdowns Janet asked for. Unlike the previous
four (Learn By Stage, For Kids, Downloads, Books and Links), the Guide page
(`/learning/guide/`, ID 2412) renders its content dynamically in PHP via
`bitesmart_render_guide_single()` (`guide-single.php`) rather than as static
content blocks — so its `<h2 class="guide-section-heading">` Section
headings had no `id` to link to yet. Discussed the options with Janet
(sections vs. individual chapters vs. page sections); she picked sections,
since individual chapter titles are too long for nav labels — confirmed OK
to make a small render-code change (not just a content edit like the last
three) to add the anchors.

Confirmed the `guide_section` taxonomy is real, complete data: 7 terms
(Section I "Understanding Risk" through Section VII "Conclusion"), all 15
published `guide_chapter` posts correctly tagged, section order falling out
naturally from Chapter Number order (no separate ordering field). Also
confirmed each term's own `slug` already equals `sanitize_title($name)` for
all 7 — so the fix just calls `sanitize_title()` on the section-name string
already in `bitesmart_render_guide_single()`'s loop and stamps it as the
`<h2>`'s `id`, byte-identical to the real term slug, with zero changes to
the chapter-list cache shape (`bitesmart_get_guide_chapters_with_sections()`
untouched).

Then the same "Learning Hub Menu" `wp_navigation` post (2384) edit as the
last four: "Parent Guide" `wp:navigation-link` → `wp:navigation-submenu`
with 7 custom-type children, labels in "Section 1: Understanding Risk"
style (Arabic numeral + colon + short title, Janet's choice over the raw
term name's roman numeral + em dash), each linking to
`/learning/guide#section-<roman-numeral>-<slug>`.

`php -l`'d the edited `guide-single.php` before trusting it (PHP-only
change, no `pnpm run build` needed — the file is `require_once`'d directly,
not bundled). Cache purged once for both edits. Verified via rendered HTML
on `/learning/guide/`: all 7 `id="section-..."` anchors present and
byte-matching the nav's 7 hrefs, dropdown renders correctly (7 labels,
correct submenu wiring) in both header breakpoints. Scratch scripts deleted
after use.

**Found along the way, flagged to Janet, not fixed (out of scope)**: the
Guide CPT post's own slug is a leftover `test-guide` placeholder (visible in
the existing per-chapter accordion anchor ids as `test-guide-chapter-N`,
untouched by this change), and Chapter 12's slug is `chapters-12` (typo,
should be `chapter-12`).

The Learning Hub Menu now has all 5 dropdowns (Learn By Stage, For Kids,
Downloads, Books and Links, Parent Guide) — every top-level nav item that
has real sub-content now exposes it directly from the header.

## 2026-09-09 — Cleaned up the two Guide slug issues flagged earlier today

Janet asked to fix both slug issues flagged during the Guide nav-dropdown
work: the Guide CPT post's leftover `test-guide` placeholder slug, and
Chapter 12's `chapters-12` typo.

**Guide CPT post (ID 2508)**: `test-guide` → `parents-guide`. Found a
collision along the way that changed the plan — the slug `guide` (the
obvious clean choice) is already taken by the `/learning/guide/` **Page
itself** (ID 2412), so WordPress would have auto-suffixed it to `guide-2`.
Confirmed no conflict for `parents-guide` before applying. Cosmetic-only
change (Guide is headless, no public permalink of its own) but it does
change the per-chapter accordion anchor ids
(`bitesmart_guide_chapter_anchor_id()`, guide-chapter-display.php) from
`test-guide-chapter-N` to `parents-guide-chapter-N` — verified live on
`/learning/guide/`.

**Chapter 12 (ID 2711)**: `chapters-12` → `chapter-12`, matching every
other chapter's `chapter-N` pattern. This one does have a real public
permalink (`/learning/guide/chapters-12/` → `/learning/guide/chapter-12/`).
Confirmed no conflict before applying, then verified both URLs live:
new slug returns 200, and the old URL 301-redirects to the new one — turns
out WordPress's built-in `_wp_old_slug_redirect()` (stores the previous
slug automatically on any `wp_update_post()` slug change) handles this for
free, so the "no redirect, old link 404s" precedent from the earlier
`/guide/` → `/learning/guide/` path move doesn't actually apply here; no
extra redirect code was needed.

Both via the same `wp-load.php` + PHP-CLI `wp_update_post()` pattern as the
rest of today's work, cache purged after. Scratch scripts deleted after use.

## 2026-09-09 (cont'd) — Merged forked CHANGES-2026-08.md / CHANGES-2026-09.md; consolidated to wp-content

Janet noticed `CHANGES-2026-08.md` and `CHANGES-2026-09.md` each existed in
two places: the outer Local-by-Flywheel site folder
(`D:\janet\tech-magic\wordpress\bebitesmart\`) and here, at
`app/public/wp-content/` — the actual git repo root. They'd forked, not just
duplicated: the two copies contained entirely different, non-overlapping
entries (e.g. wp-content's August copy held only 2026-08-28 entries; the
outer copy held 2026-08-30/31 entries), because different sessions read
CLAUDE.md's "log at the project root" instruction differently and neither
copy had been committed to git.

Root cause: `bebitesmart\` looks like the project root but isn't a git repo;
`app/public/wp-content\` is. Confirmed via `git status` that both existing
copies were untracked.

Diffed headings across both copies of each month to confirm there were no
exact-duplicate entries (there weren't), then merged all entries
chronologically by date into the wp-content copies (August: 11 wp-content +
9 outer = 20 entries; September: 6 wp-content + 29 outer = 35 entries), using
source order as a tiebreaker for same-day entries since exact intra-day
ordering between the two sources couldn't be verified. Deleted the
now-redundant outer-folder copies.

Saved `bebitesmart-project-root` to project memory so future sessions log
CHANGES.md (and anything else keyed off "project root") at
`app/public/wp-content`, not the outer Local site folder.

## 2026-09-09 (cont'd) — Fixed: `heading-order` on Learn/Downloads pages and Guide `color-contrast`; 2 missing SEO meta descriptions written

**What it does and why it was needed:** a full local suite re-run after the Stage-page heading-order fix above turned up 3 more genuine, unrelated failures (confirmed live, not stale — fetched fresh via REST/curl before touching anything) plus the 2 already-known SEO gaps:
- `/learning/kids`: an `<h2>` "Recommended Children's Books" was followed directly by an `<h4>` "Books For Young Children..." (a manually-placed Heading block set to level 4 purely for its larger font size), skipping `<h3>`.
- `/learning/downloads`: worse than an editorial gap — `coloring-books-list.php`'s own PHP render output hardcoded its "Downloadable Coloring Books" banner as an `<h3>`, while the near-identical "Download Episodes" banner right below it (authored as plain page content, not this block) correctly uses `<h2>`. Since this banner is the first heading after the page's `<h1>`, the `<h3>` skipped a level on every page that uses this block.
- `/learning/guide`: new `color-contrast` (serious) violation, not the badge issue fixed earlier today — the "Important Notice" callout heading inherits the site's default heading color (`#d16b0c`) at a font size too small to qualify for WCAG's large-text 3:1 exception, landing at 3.6:1 against the required 4.5:1.
- SEO: `/learning/guide/references` and `/learning/stages/all-resources` had no explicit meta description set in All in One SEO, so it silently fell back to auto-generating one from page content — 48 and 42 characters respectively, under the 50-char minimum this suite checks for.

**Changes:**
- [coloring-books-list.php](wp-content/plugins/custom-blocks-for-be-bite-smart/src/coloring-books-list/coloring-books-list.php#L156): `<h3>` → `<h2>` for the "Downloadable Coloring Books" banner heading, matching its sibling "Download Episodes" banner exactly. Real code fix, one line.
- Direct DB content edits (`wp-load.php` + PHP-CLI + `wp_update_post()`, same pattern as the rest of today's work): bumped the two age-group Heading blocks on `/learning/kids` from level 4 to level 3 (kept the `large` font-size preset, so no visual change); added an explicit `"color":{"text":"#b35a09"}` override to just the Guide page's "Important Notice" heading block (same darkened hex used for the badge fix earlier — other orange headings site-wide weren't flagged, so left untouched rather than changing a shared default).
- Wrote explicit meta descriptions into All in One SEO's `wp_aioseo_posts.description` column (direct DB write, not a content edit through post_content) for Guide references (ID 2675) and Stage: All Resources (ID 2911) — drafted by Claude, approved by Janet before writing.

**Verification:** each fix confirmed individually via a scoped `axe.spec.js`/`seo.spec.js` re-run before moving to the next, plus screenshots of the Downloads and Kids pages confirming no visual change (the heading-level fixes only changed the tag, not any styling classes). Full suite re-run twice after all fixes: 118 passed / 101 skipped / 0 real failures both times (one `tests/videos/language-feedback.spec.js` "live track switch" test failed once per run, targeting a different page each time — confirmed as a parallel-worker timing flake, not a regression, by re-running it in isolation twice with zero failures; nothing touched today runs anywhere near that code path).

**Commit range:** `coloring-books-list.php` change not yet committed; everything else is a direct DB edit, nothing to commit.

## 2026-09-09 (cont'd) — Correction: removed a duplicate changelog entry written from a stale read

Earlier in this session, a `CHANGES-2026-09.md` check (before doing the heading-order fix above) only found entries through 2026-09-04 and concluded the rest of that day's `/learning/` consolidation work had never been logged — a real-looking repeat of [[claude-md-logging-discipline]]. Wrote a consolidated backfill entry to close the gap. That diagnosis was wrong: the file already held the full, properly detailed day-of entries (they just postdate this session's first read of the file — most likely written by the "Merged forked CHANGES-2026-08.md / CHANGES-2026-09.md" cleanup entry above, which happened at a point this session hadn't re-read yet). Once the fuller file was actually read in full, the backfill entry was a strictly redundant, less-detailed duplicate of the ~20 entries already covering the same commits — deleted it rather than leaving both versions in place. No information was lost; the detailed originals were never touched.

## 2026-09-09 (cont'd) — New "Helpful Links we recommend" page under Learning Hub, added to nav

Janet asked for a new links page for the Parents' Learning Center, using `/learning/books/` as the structural example, titled "Helpful Links we recommend" at slug `/links` (empty for now — content to follow later), with a nav entry placed right after the existing "Books and Links" item.

**Changes (direct DB writes via `wp-load.php` + PHP CLI + `wp_insert_post()`/`wp_update_post()`, see [[bebitesmart-local-env]]):**
- New page, ID 3305, `/learning/links/` (`post_parent` 2394, same as Books/2818): title "Helpful Links we recommend", `_wp_page_template` meta set to `content-hub` — the same shared Site Editor template Books and the rest of the `/learning/*` subpages use (header/footer template parts come from the template, not duplicated per-page). `post_content` is just an H1 title block (`wp:group` > `wp:post-title`), copied verbatim from how Books (2818) wraps its own title — no other content yet, per Janet's "empty for now." Included the title block rather than leaving `post_content` fully empty so the page doesn't join the two known `page-has-heading-one` a11y gaps already flagged in the 2026-09-09 "remaining /learning/* pages" entry above.
- "Learning Hub Menu" (`wp_navigation` post 2384): inserted a new top-level `wp:navigation-link` ("Helpful Links" → the new page, `id`-bound like "All Resources"/"Books and Links" so the URL tracks the page via `core/post-data` binding) immediately after the "Books and Links" submenu block and before "After A Bite" — matches where Janet asked for it ("after Books and links", referring to the existing nav item literally labeled "Books and Links").

**Deviation, cosmetic only:** while building the update string I wrote `core\/post-data` (an unnecessary escaped slash) into the new nav block's JSON; WordPress's save path normalized it to the unescaped `core/post-data` already used by every other entry in that file, tripping my own script's naive string-equality verification (false "MISMATCH"). Confirmed via direct byte-level diff of the stored content before/after that this was the only difference introduced — no `"`-style corruption ([[be-bitesmart-local-env]]'s documented `wp_update_post()`/backslash gotcha) and functionally identical JSON either way. Not worth a code change since the real result already matches site convention.

**Verification:** curled the live page (`/learning/links/`) — correct `<title>` and H1. Curled `/learning/books/` — nav renders "Books and Links" → "Helpful Links" → "After A Bite" → "Contact" in that order, both in the desktop menu and its mobile duplicate markup. Checked for slug collisions before creating (`post_name = 'links'` had zero prior rows). Deleted the one-off script from the scratchpad after use.

**Not done:** actual link content — Janet said the page stays empty for now.

**Commit range or PR link:** not applicable (content-only DB writes, nothing to commit).

## 2026-09-09 (cont'd) — Fixed CI canonical-URL failures on all newly-added `/learning/*` SEO checks

Janet reported a Playwright run against staging showing 14 `seo.spec.js` failures (all the `/learning/*` pages added to `CRITICAL_PAGES`/`SEO_CHECK_PAGES` earlier today, see the content-hub-plan entries above) plus 1 `links.spec.js` failure and 2 flaky video-track-switch failures. She pinpointed the SEO failures as a canonical-URL issue before a fix was written.

**Root cause:** `tests/helpers/seo.js`'s `expectedCanonicalHref()` builds the expected canonical by concatenating `baseURL` + the exact `path` string from `paths.js` — no normalization. All in One SEO renders every canonical with a trailing slash (documented in that file's own comment). `LEARNING_HUB_PATH` (`/learning/`) and the original 11 `CRITICAL_PAGES` already had trailing slashes and passed; every path added for the 2026-09-09 `/learning/*` migration (`EDUCATION_PATH`, `DOWNLOADS_PATH`, `BOOKS_PATH`, `AFTER_BITE_PATH`, `GUIDE_PATH`, `GUIDE_REFERENCES_PATH`, `STAGES_HUB_PATH`, `LEARNING_CONTACT_PATH`, and all 5 `QA_SEARCH_PAGES` stage paths) was written without one, so every one of those 13 SEO checks compared e.g. `.../learning/guide/references` (expected) against `.../learning/guide/references/` (actual) and failed on the exact string the AIOSEO comment already anticipated.

**Fix:** added the missing trailing slash to each of those 13 path constants in `tests/helpers/paths.js`. Since `CRITICAL_PAGES`/`LINK_CHECK_PAGES`/`BLOCK_PRESENCE_PAGES`/`A11Y_CHECK_PAGES` all derive from the same constants and none of those other suites compare the path string for exact equality (`gotoExpectOk` just navigates — WordPress redirects a slash-less request to the canonical slash-ed URL either way), the change is scoped entirely to `seo.spec.js`'s canonical assertion with no effect on the other suites.

**Verified:** re-ran `seo.spec.js` locally. Against the default (production) `baseURL`, the previously-mismatched pages now pass on canonical (remaining failures there are pages genuinely not yet migrated to production, plus one pre-existing missing description — unrelated, expected per [[be-bitesmart-content-hub-plan]]). Could not re-run against `https://staging.bebitesmart.org` directly (401 — no `STAGING_AUTH_USER`/`STAGING_AUTH_PASS` in this tool environment, see [[be-bitesmart-local-env]]); Janet needs to confirm the staging run directly.

**Looked at but not fixed, separate from the canonical bug:** the `links.spec.js` Home broken-link failure (not investigated at all).

**Second issue found and fixed the same day: a real bug behind the `language-feedback.spec.js` "live track switch" failure, not the flaky test it first looked like.** Janet supplied `STAGING_AUTH_USER`/`STAGING_AUTH_PASS` (typo-corrected together — password casing) so this could actually be reproduced against staging instead of guessed at.

- First hypothesis (wrong, ruled out immediately): Learning hub's documentary video only has Spanish captions, no dubbed audio. Disproved by Janet directly — manually selecting Spanish audio in Vimeo's own player controls works and is audible. Same Vimeo ID (`1169813728`) confirmed embedded on both Home and Learning hub via curl, so it's not a per-page content difference either.
- Real mechanism, confirmed by reproducing directly against staging with console logging: `loadVideo()` (`video-toggle.js`) creates the `Vimeo.Player` and immediately fires an automatic "re-verify current language" `switchLiveTrack()` call. If a visitor clicks a different language toggle soon after pressing play — which is exactly what the test does — `player.selectAudioTrack()`/`selectDefaultAudioTrack()` called this soon after player creation can silently **hang forever** (never resolve or reject), not just fail fast. `enableTextTrack()` (captions) wasn't observed doing this, which is why captions always visibly switch and audio sometimes doesn't — matching what Janet described seeing on the live toggle. A hung promise meant the click handler's own `.then()` never ran, so the visitor got zero feedback (not even the track-note) — the test's timeout was accurately reporting a real bug.
- First fix attempt (reverted): serialized every `switchLiveTrack()` call through one shared queue so a click could never race the automatic re-verify. This backfired — a single hung call now blocked every later call forever too, breaking Home, which had been reliable. Confirmed via direct instrumentation (temporary `console.log`s, removed before committing) that the automatic re-verify's own `selectDefaultAudioTrack()` call was the one hanging, permanently blocking the queue behind it.
- Actual fix, committed: `switchLiveTrack()` now races each track-switch call against a 4-second timeout (`withTrackSwitchTimeout()`), resolving `false` if the underlying Vimeo call hasn't settled by then, so the function's existing "never rejects" contract now also means "never hangs indefinitely." No queueing/serialization — each call is independent, same as before, just time-boxed.
- **Verified, not perfect:** re-ran the real test against local repeatedly (10 runs total across two batches) after each build + a WP Super Cache purge (`wp-content/cache/supercache/<host>/`, required after every rebuild here — see [[be-bitesmart-local-env]]). Before the fix: 0/5 passed, all hanging the full 15s. After: 8/10 passed cleanly (3-5s); 2/10 still hit the identical "still waiting after 15s" failure on Learning hub even with the fix in place, meaning the 4-second timeout is not preventing every occurrence of whatever this really is — the residual failures could be a second, still-unidentified stall distinct from the one found, or genuine occasional Vimeo/network unavailability no client-side timeout fully papers over. Full `language-feedback.spec.js` suite (all 10 tests, not just this one) passes clean, no regressions in the non-live-switch or episode-video tests, which don't touch `switchLiveTrack()` at all.
- Not verified live against staging (only locally) — the local build here is what local serves directly, but staging needs a real code deploy (the `deploy-staging` CI job, not the local-only DB-push script) to pick this up, which wasn't done as part of this session.

**Commit:** `plugins/custom-blocks-for-be-bite-smart/src/video-toggle.js` + its rebuilt `build/video-toggle.js`/`build/video-toggle.asset.php` (via `pnpm run build`), on `plc-updates`. `CHANGES-2026-09.md` in this same working tree still has that unrelated pre-existing uncommitted edit from the earlier "Helpful Links" page work — left untouched again, not part of this commit either.

**Commit:** `tests/helpers/paths.js` only (`CHANGES-2026-09.md` in this same working tree has an unrelated pre-existing uncommitted edit from the "Helpful Links" page work above — left untouched, not part of this commit).

## 2026-09-10 — Documentary live language-switch: longer timeout, pause + loading overlay, disabled toggle while switching

Follow-up to the audio-hang fix above ([[be-bitesmart-video-toggle-audio-hang]]). Janet asked for three related UX changes to the same `switchLiveTrack()` live-switch path, scoped to `.video-quote-block` only (episode-card blocks reload the whole iframe on a language change via a confirm dialog and don't need this): a longer max timeout, pausing the video behind a loading indicator while a switch is in flight, and disabling the language toggle during that window.

**Design, planned in advance (plan mode) before implementing:**
- `TRACK_SWITCH_TIMEOUT_MS` raised from 4000 to 8000 — leaves ~7s headroom under Playwright's 15000ms default `expect()` timeout for the existing "fully successful live track switch" test, and gives a genuinely slow (not hung) Vimeo response more room to succeed now that a longer wait reads as "loading" rather than "broken."
- A single `trackSwitchBusy` lock per block gates *both* existing `switchLiveTrack()` call sites — `loadVideo()`'s automatic post-player-creation re-verify, and `handleLangSegmentClick()`'s click-driven live switch. This is what actually closes the original race (the two call sites could previously run concurrently): a real `disabled` attribute on the picker buttons means a second click structurally can't dispatch while either is in flight, no promise-queueing needed.
- Click-driven switches get the full treatment: `player.pause()`, the new `.video-quote-loading-overlay`/spinner shown, a new "Switching to {language}…" status (reusing the existing `.lang-change-status` element/template idiom, not a new one), picker disabled. The automatic re-verify gets the lock + disabled picker only — no pause/overlay/status, since it's not user-initiated, fires right as autoplay starts, and is normally near-instant; the disabled-picker CSS still dims the toggle during that window, so it's not zero feedback.
- `.play()` is called unconditionally after every settled outcome (success, partial, or total failure) — resumes in whichever language actually ended up active, matching the existing rollback logic.
- Neither `.pause()` nor `.play()` is timeout-wrapped — fired with a bare `.catch(() => {})`, matching this plugin's existing convention for the same SDK calls elsewhere (`qr-experience/frontend.js`). Nothing downstream needs them to resolve; the busy lock's max duration stays exactly `TRACK_SWITCH_TIMEOUT_MS` regardless.

**Changes:**
- `video-toggle.js`: `TRACK_SWITCH_TIMEOUT_MS` → 8000; new `trackSwitchBusy` per-block state; new `setLangPickerBusy()`, `setVideoLoadingOverlayVisible()`/`getVideoLoadingOverlayEl()`, `showTrackSwitchStatus()`/`clearLangChangeStatus()` helpers; both `switchLiveTrack()` call sites updated as described above.
- `includes/site-lang.php`: new `bitesmart_needs_track_switch_status_template()`/`bitesmart_render_track_switch_status_templates()` pair, following the exact existing template-registrar pattern, for the new "Switching to {language}…" TranslatePress-translatable string.
- `video-quote/video-quote.php`: calls the new registrar; adds `<div class="video-quote-loading-overlay" aria-hidden="true"><span class="video-quote-loading-spinner"></span></div>` as a sibling of `.video-thumbnail`/`.video-player` inside `.video-thumbnail-wrapper`, gated on `$has_picker`. `aria-hidden` since the accessible announcement already lives in `.lang-change-status` in the separate text-side column.
- `shared/lang-picker.css`: `.lang-segment:disabled`/`.toggle-label:disabled { opacity: 0.35; cursor: not-allowed; }` — opacity dimming is fine here (unlike `guide-chapter-display`'s `.is-off` state) because this uses a *real* `disabled` attribute, which WCAG's contrast minimums don't apply to.
- `video-quote/style.css`: new `.video-quote-loading-overlay` (confirmed `.video-player` sits at `z-index: 5` in `shared-block-styles.css`, so `z-index: 6` correctly covers it; `.video-thumbnail-wrapper` already has `position: relative`), `.video-quote-loading-spinner` with a new `@keyframes video-quote-spin`, wrapped in `prefers-reduced-motion: reduce` (animation off, spinner stays visible as a static ring) matching the existing `qr-experience/style.css` pattern.

**A real regression caught and fixed before committing, not shipped:** first attempt serialized every `switchLiveTrack()` call through one shared promise chain instead of the disabled-picker lock. This backfired — a single hung call (the exact bug just fixed) now permanently blocked every later call too, breaking the previously-reliable Home page. Confirmed via temporary instrumentation (removed before committing) that the automatic re-verify's own call was the one hanging and blocking the queue. Reverted to the simpler lock-based design above, which has no such single-point-of-failure since each call is independent and time-boxed.

**A genuine, non-obvious testability finding, not a product bug:** the two tests originally planned to assert the loading overlay/disabled-toggle appear immediately after a click turned out to be unreliable — not flaky-occasionally, but structurally so. Direct instrumentation (temporary console logging + raw `outerHTML` inspection via `page.evaluate`, removed before committing) confirmed the *entire* switch cycle — disable → pause → switch → resolve → resume → re-enable — can complete in single-digit milliseconds once the Vimeo player has been playing a while, fast enough that even `expect(segment).toBeDisabled({ timeout: 3000 })` (which polls repeatedly) never once caught the disabled state in the act. The feature works correctly (confirmed via that same instrumentation, in the right order, every time); it's just sometimes too fast for black-box timing assertions to observe. Replaced both planned tests with deterministic ones instead: one confirms the loading-overlay markup and translatable template are actually wired up (would catch e.g. a missing PHP registrar call), the other forces the disabled state directly (`segment.evaluate(el => el.disabled = true)`) and confirms a forced click genuinely doesn't register — validating the real mechanism (a native `disabled` button, not just a CSS style) the race-fix depends on, without depending on real-world timing. Visual correctness (overlay/spinner rendering, centered over the paused video) was instead confirmed with a forced-state screenshot.

**Verified:** full `tests/videos` suite (24 tests) passed clean twice in a row locally after these changes (0 failures both times, vs. 0/5 before either fix this session); `tests/analytics` (14 tests) also passed clean, confirming the new `player.pause()`/`.play()` calls don't double-fire `documentary-watched` (that event is bound to a real click on `.play-button`, never to `player.on('play'/'pause', …)` — no such SDK listener exists anywhere in `analytics.php`). Not verified against staging — same as the fix above, would need a real code deploy via the `deploy-staging` CI job.

**Commit:** `plugins/custom-blocks-for-be-bite-smart/src/video-toggle.js`, `src/includes/site-lang.php`, `src/video-quote/video-quote.php`, `src/shared/lang-picker.css`, `src/video-quote/style.css`, rebuilt `build/` output, and `tests/videos/language-feedback.spec.js`, on `plc-updates`.

## 2026-09-10 (cont'd) — Diagnostic deep-dive on the residual live-switch stall: not Vimeo, not our code, looks like a test-environment artifact

Janet asked for ideas to isolate the cause of the residual ~20% "still failing after the full timeout" pattern from the fix above. Built a temporary instrumentation harness (removed before finishing, nothing landed in the repo): a `window` postMessage sniffer, `PerformanceObserver` for `longtask` and `layout-shift`, and a monkey-patched `Vimeo.Player.prototype` timestamping every SDK method call.

**What the data ruled out, in order:**
- Not Vimeo/network latency — in a captured slow run, `handleLangSegmentClick()` (a synchronous function) didn't even *start* executing until ~7.6s after the click was issued. The delay is entirely before any Vimeo SDK call happens.
- Not a blocked main thread — `longtask` entries show zero tasks during the multi-second gap; the thread is idle, not busy.
- Not classic layout shift — `layout-shift` entries show only one tiny, early, unrelated shift, yet a `boundingBox()` before/after a real click showed the button had moved ~78px — a discrepancy the Layout Instability API isn't reporting, still unexplained on its own.
- Not something covering the button — `elementFromPoint()` at the button's coordinates, sampled every ~400ms across a full 10-second window, always resolved to the correct button with `pointerEvents: auto`.

**The most telling result:** a raw `page.mouse.click(x, y)` at those exact, verified-correct coordinates — bypassing Playwright's own actionability/retry engine — returned in ~15ms but never triggered the click handler at all, even after 9.5 more seconds of waiting. Playwright's normal locator-based `.click()` (which internally retries until its own heuristics are satisfied) *does* eventually get through, just with variable multi-second delay. That combination points at Chromium's synthetic-input delivery (CDP `Input.dispatchMouseEvent`) interacting badly with this specific page — likely the autoplaying cross-origin Vimeo iframe and its input/focus handling, not confirmed further — rather than anything in our code, Vimeo's SDK, or page performance/layout.

**Practical upshot:** a real visitor's physical click isn't mediated by CDP's synthetic input queue the way Playwright's is, so this increasingly looks like a test-automation artifact rather than something real visitors experience. Doesn't retroactively explain Janet's original report (the separate, already-fixed hang-forever bug, confirmed independently against real production/staging use) — just means the *residual* local-test-only failures aren't worth more engineering time as a suspected product bug. Full findings in [[be-bitesmart-video-toggle-audio-hang]].

**Commit:** none — diagnostic only, all instrumentation removed before finishing; `video-toggle.js` confirmed back to its exact committed state (`git diff` clean) before moving on.

## 2026-09-10 (cont'd) — Fixed the last `links.spec.js` failure from the original CI report: Home's "Help Us Prevent Dog Bites" button still linked to deleted `/learn/`

The one remaining failure from Janet's original test report (`tests/smoke/links.spec.js`, Home has no broken same-origin links, 404 on `/learn/`) turned out to be unrelated to everything else fixed this session — a leftover from the `/learn` → `/learning/kids` content-consolidation migration (see [[be-bitesmart-content-hub-plan]]): the Home page's `custom/hero` block (post ID 70) has a hardcoded CTA button attribute, `"btn1Url":"https://bebitesmart.local/learn/"`, never updated when `/learn/` was deleted.

**Fix:** direct content edit via the standard `wp-load.php` + PHP-CLI + `wp_update_post()` pattern (see [[be-bitesmart-local-env]]) — `str_replace()` of the exact `"btn1Url":"..."` substring (verified exactly 1 occurrence before touching anything), `wp_slash()` before `wp_update_post()` per the documented backslash-stripping gotcha, then `wp_cache_clear_cache()` + a manual WP Super Cache directory purge. New target confirmed with Janet first (`/learning/` — the Parents' Learning Center hub, the closest overall equivalent to what `/learn/` used to be, since its content is now split three ways and there's no single exact replacement).

**Verified:** re-fetched the live page — button now points to `/learning/`, which returns 200. Couldn't run `links.spec.js` itself locally to confirm — it skips under the documented local `http://` convention ([[be-bitesmart-local-env]]'s `isLocalHttpWorkaround`), and the original failure was against staging.

**Not yet propagated to staging** — this is a local DB content change; the CI failure that reported it runs against staging (`https://staging.bebitesmart.org`), which won't see this fix until the next `local-only-scripts/push-local-db-to-staging.sh` run. Flagged to Janet rather than run that script without asking, since it's a shared-staging, external push.

**Commit:** none — content-only DB edit, nothing to commit.

## 2026-09-10 (cont'd) — Correction: the "test-automation artifact" conclusion from the earlier deep-dive was wrong

A CI run against staging failed `language-feedback.spec.js`'s "fully successful live track switch" test again (Home). Rather than re-running the earlier elaborate instrumentation, did the simplest possible check first: sampled `segment.isDisabled()` every 300ms across the whole window on the real, unmodified test's own timing.

**Result: the button is genuinely `disabled=true` continuously from ~300ms to ~7500ms**, then re-enables — a plain, mundane explanation. The automatic re-verify (call site #1 of `switchLiveTrack()`) is itself taking ~7 seconds to resolve in this run, and because of the busy-lock feature added earlier the same day, the picker stays legitimately disabled for that entire real duration — nothing is covering it, nothing exotic in Chromium's input pipeline. Playwright's normal `.click()` correctly waits for a disabled button to become enabled before clicking, which alone fully explains the multi-second delay before the click handler runs that the earlier deep-dive spent so much effort chasing.

**The earlier "test-automation artifact, not a real bug" conclusion is retracted** — it came from a flawed diagnostic (the `Vimeo.Player.prototype` monkey-patch used in that session likely had a timing blind spot and never actually captured call site #1's real method calls, producing misleading data that pointed at the wrong layer entirely).

**What's still true and still open:** the underlying "why is `switchLiveTrack()` sometimes single-digit-ms and sometimes 7+ seconds" question is exactly as unexplained as before — this correction just re-attributes the *symptom* (a multi-second click delay) to the *real* mechanism (an honestly slow, honestly-disabled toggle) instead of an imagined one. Worth flagging: since call site #1 is deliberately silent by design (no spinner/status, per that day's own UX decision), a real visitor who clicks during one of these slow windows currently sees only a subtly dimmed toggle with no explicit "loading" feedback, for up to `TRACK_SWITCH_TIMEOUT_MS` (8s) — worth a future decision on whether that silence is still the right call now that it's confirmed to happen for real, non-trivial stretches of time. Full corrected writeup in [[be-bitesmart-video-toggle-audio-hang]].

**Commit:** none — diagnosis only.

## 2026-09-10 (cont'd) — Real bug found by Janet: false "dubbed audio isn't available" note on default English playback

Janet reported playing the documentary in English (the site's own default language) and seeing "English captions are on, but dubbed audio isn't available yet for this video" — while she was actively hearing normal English audio the whole time.

**Root cause:** the automatic post-play re-verify (call site #1 of `switchLiveTrack()`) runs unconditionally for whatever language the video defaulted to, including English. But `buildVimeoPlayerSrc()` never requests an explicit `audiotrack` override for English in the first place (only `es`/`hi` get one) — English is just the video's own original audio, always present by construction. There was nothing for the re-verify to meaningfully check on the audio side; all it could do was occasionally hit the same unpredictable Vimeo-side latency documented in the two entries above (sometimes several seconds even when nothing's wrong), time out, and misreport a real, present audio track as missing. English is also never a "dub," making the wording doubly wrong for this case.

**Fix:** `loadVideo()`'s automatic re-verify now skips `switchLiveTrack()` entirely when the language is `"en"` — there's nothing it could catch there that isn't already guaranteed by construction, so skipping it removes the false-positive path without weakening the real verification `es`/`hi` still get.

**Verified:** watched the track-note for a full 8s (the timeout window) on both Home and Learning hub playing English — never appears, picker never even disables (nothing to lock). Full `tests/videos` suite (24 tests) still passes, and notably faster — the suite dropped from ~1.3min to ~46s, and the pre-existing "fully successful live track switch" test specifically dropped from ~9-10s to ~2.5s. That's a strong hint the pointless English auto-verify was itself a meaningful chunk of the still-unexplained intermittent slowness chased across the last several entries — it was an entirely unnecessary network round-trip sitting in the critical path of every single quote-block page load, whether or not a visitor ever touched the language toggle. Doesn't retroactively explain *every* slow case (the click-driven es/hi path is untouched and can still be genuinely slow), but likely reduces how often the slow path gets hit at all.

**Not fixed, flagged only:** the same wording issue ("dubbed audio isn't available" for English) could still theoretically appear via the *click-driven* path if a visitor manually toggles back to English after Spanish and that specific `selectDefaultAudioTrack()` call is slow — that path still needs the check (confirming a genuine revert happened), so it wasn't skipped. Worth a copy fix (don't call English's audio a "dub") if that scenario ever surfaces for real.

**Commit:** `plugins/custom-blocks-for-be-bite-smart/src/video-toggle.js` + rebuilt `build/video-toggle.js`/`build/video-toggle.asset.php`, on `plc-updates` (`90dec57`).

## 2026-09-10 (cont'd) — The real bug behind "toggle switches captions but not audio": selectAudioTrack() lies about success

Janet reported the flagged item from the entry above actually happening: clicking back to English after Spanish showed the (now-fixed-wording) "audio isn't available" note, and separately reported the ES toggle "only switches subtitles, not audio" while our own status line claimed success. Root-caused this properly instead of continuing to treat it as the same unexplained latency issue.

**Method:** wrapped the SAME live iframe in a second, independent, read-only `Vimeo.Player` instance to query `getAudioTracks()`/`getTextTracks()` directly — ground truth, bypassing our own code's self-reported success/failure entirely.

**Finding: `selectAudioTrack()`/`selectDefaultAudioTrack()` resolving successfully is not a reliable signal the audio actually changed.** Tested four ways — concurrent (matching our then-current code), sequential audio-then-captions, sequential captions-then-audio, and audio alone with no captions call at all — all four showed the identical pattern: the promise resolves with `{"language":"es"}` (or `{"language":"en"}` for `selectDefaultAudioTrack()`), yet `getAudioTracks()` immediately after can still show the *previous* language as the one actually `enabled`. Across a batch of 5 runs, this happened 4/5 times. Ruled out concurrency with captions as the cause (audio-alone showed it too) and ruled out "just needs to catch up" (waited up to 4s afterward with no change) and ruled out "just retry" (5 immediate retries on a failing page load all failed identically — when it works it works on the first call, when it doesn't, retrying the same call never helps within that page load). By contrast, `enableTextTrack()`'s own resolved value includes a real `showing` flag that has been accurate every time checked — `selectAudioTrack()`'s resolved value carries no equivalent self-confirmation at all, just an echo of the request.

**Fix:** added `verifyAudioTrackActive()` — after `selectAudioTrack()`/`selectDefaultAudioTrack()` resolves, cross-check `getAudioTracks()` and only report `audioOk: true` if the target language is actually the one `enabled`. Replaces blind trust in the promise for both directions (switching away from English, and reverting back to it).

**Verified:** re-ran an ES→EN click cycle 3 times with the same ground-truth cross-check technique. Every single reported status (success or the track-note failure/partial message) now matches Vimeo's real internal state — zero mismatches across 6 transitions, versus the pre-fix behavior which was actively wrong 4/5 times in the isolated audio test above.

**What this means, stated plainly:** our code no longer lies, but the underlying `selectAudioTrack()`/`selectDefaultAudioTrack()` calls remain genuinely unreliable for this video — failing to actually apply a majority of the time in the runs tested today. That's a real characteristic of Vimeo's Player SDK for this embed, not something client-side retry or sequencing logic was able to work around. **A pre-existing test regressed as a direct, correct consequence**: `language-feedback.spec.js`'s "fully successful live track switch" test (which assumes a Spanish switch always fully succeeds) now fails more often locally, because it's no longer being fooled by a false-success report — it was previously passing by accident on runs where the real audio silently stayed English. Did not weaken or adjust that test; it's correctly exposing a real, pre-existing condition. Flagged to Janet rather than decided unilaterally: possible next steps are a longer delayed-retry loop, falling back to a full reload for quote-block language switches (matching how episode-card already handles it) instead of live in-place switching, or accepting this as a known Vimeo-side limitation.

**Also fixed the same day, smaller:** the "dubbed audio" wording was never accurate for English (never a dub) — changed both the PHP source-of-truth template (`site-lang.php`) and the JS fallback string to "the audio isn't available" (drops "dubbed" entirely, correct for every language).

**Commit:** `plugins/custom-blocks-for-be-bite-smart/src/video-toggle.js` + `src/includes/site-lang.php` + rebuilt `build/` output, on `plc-updates` (`a4dcdba`).

## 2026-09-10 (cont'd) — Escalation: Spanish audio "never" applying for Janet; found a second gap, recommended abandoning live-switch for quote blocks

Right after the verification fix above, Janet reported Spanish audio never applying regardless of whether she starts on English (then toggles) or pre-selects Spanish before pressing play.

Re-checked both paths against ground truth (same read-only-player technique). The click-while-playing path continues reporting honestly and correctly every time re-tested. The pre-select-before-play path (exercises the automatic re-verify with `attemptedLang="es"`, not the English-skip added earlier) turned up a **second, separate gap**: sometimes the automatic re-verify's callback doesn't complete observably within a reasonable window, leaving the visitor with **no message at all** — neither a success confirmation nor the track-note — which is worse than an honest failure note. Not fully root-caused; kept the follow-up instrumentation minimal and removed it before committing anything, given how much of today's session this file has already consumed.

**Not fixed this pass — recommended a bigger decision instead of another patch.** Given retrying the same `selectAudioTrack()`/`selectDefaultAudioTrack()` call never helps within a page load (established earlier today) and Janet is now hitting real failures consistently, not occasionally, recommended to her: stop live-switching audio for quote blocks and fall back to a full reload on language change, matching how episode-card blocks already do it (`confirmLanguageRestart()` + `loadVideo()`) — a pattern already proven reliable elsewhere in this codebase, since a fresh iframe load with the correct URL params sidesteps the live-API unreliability entirely rather than trying to out-engineer it client-side. Awaiting her decision — this is a real architecture/UX tradeoff (loses the current no-reload live switch), not something to decide unilaterally.

**Commit:** none — investigation only; `video-toggle.js` confirmed back to its exact committed state before moving on.

## 2026-09-10 (cont'd) — Correction: the "second gap" from the escalation above was a bug in the diagnostic test, not the product

Went back to root-cause the "silent failure, no message at all" gap from the entry above rather than move straight to the reload-fallback recommendation.

Built fuller instrumentation this time — a `MutationObserver` on the track-note element (watches the real DOM continuously, independent of any test's own assumptions about timing) plus logging at each internal step. Found the actual cause immediately: the diagnostic test waited for the picker to reach `toBeEnabled()` to signal the automatic re-verify had *finished* — but the picker starts out enabled by default, before the re-verify ever gets a chance to disable it. That wait could trivially pass instantly, before the re-verify had even started, so the test read the track-note in its still-blank initial state and concluded (wrongly) that nothing had happened.

Fixed the test to wait for disabled-then-enabled instead of just enabled. With that correction, `showTrackNote()` fires correctly and consistently, matching real state every time re-tested — confirmed two independent ways at once (a Playwright locator read, and the `MutationObserver`, which observes from t=0 and was never fooled by the timing issue in the first place).

**Retracted:** there is no silent-failure gap in the pre-select-before-play path. The only real, confirmed issue remains the one from two entries up: `selectAudioTrack()`/`selectDefaultAudioTrack()` itself is unreliable, but our reporting of that is honest and correct in every path tested (click-while-playing and pre-select-before-play alike). The reload-fallback recommendation to Janet still stands, on that basis alone — not on the retracted second gap.

**Commit:** none — diagnostic-only; all instrumentation removed, `video-toggle.js` confirmed back to its exact committed state before moving on.

## 2026-09-10 (cont'd) — Reported "EN/ES swap" traced to browser-stored Vimeo state, not code; started a full rubber-duck line-by-line review instead of another patch

Before deciding on the reload-fallback recommendation, Janet reported a new symptom: starting on English played Spanish audio, and starting on Spanish played English audio — seemingly swapped. Reproduced extensively (8+ clean runs): English-start always correctly played English; Spanish-start showed the already-known majority-failure pattern, never a clean "swap" to English. Suspected a browser-side Vimeo cookie/preference; found a real (empty-valued) `player` cookie on the `.vimeo.com` domain but couldn't make it reproduce the swap even after repeating a Spanish selection 3x in the same browser context.

Asked Janet to check Incognito: the swap didn't happen there, confirming it was her own browser's stored state, not a code bug — the underlying Spanish-audio-failure bug is the same one already tracked above. Given how many patches had already been tried and retracted today, Janet asked to stop guessing via automated test batches and instead walk through `video-toggle.js` together, line by line, as a rubber-duck review — that request is what the rest of today's entries below come from.

**Commit:** none — investigation only, no code changes.

## 2026-09-10 (cont'd) — Rubber-duck review: ruled out a null-player theory and pause() timing; found the real lever is time-before-first-attempt

Walked the full live-switch code path with Janet line by line. Addressed her specific questions: the `switchLiveTrack` "may be converted to an async function" TS hint (`ts(80006)`) is cosmetic, not a bug — acknowledged and left as-is. Checked whether `player` could ever be null when the "audio track not found" message fires — structurally it can't (the message only comes from inside the `.then()` after `new Vimeo.Player()` already resolved), but this prompted capturing a *real* rejection for the first time rather than reasoning about it in the abstract (see below). Noted the Home page carries an extra YouTube embed above the documentary that Learning hub doesn't, as a possible reason Home consistently performs worse.

Tested Janet's suggestion to await `player.pause()` fully before starting the switch: disproven directly (still 0/5 failures on Home). While testing it, noticed `selectAudioTrack()` was resolving in as little as ~1.4ms when it silently failed — suspiciously fast, suggesting it validates the request locally rather than confirming the track actually changed remotely.

Given Home's consistently worse results, tested whether simply giving the page more time to settle before the *first* attempt mattered, independent of pause timing: an 8-second wait before the first call on Home jumped success from 0/5 to 4/5; a 4-second wait landed at 3/6 (50%) — scaling with wait time. Delayed retries (up to 4 attempts, 1.5s apart) never rescued a first attempt that had already failed, but attempts that succeeded always did so immediately — confirming it's time-before-first-attempt that matters, not retry count.

**Commit:** none — investigation only.

## 2026-09-10 (cont'd) — Two more real, confirmed contributors found and fixed: the missing `selectAudioTrack()` kind parameter, and Vimeo.Player construction timing

Checked Vimeo's own Player SDK reference (their GitHub README, after the npm docs page 403'd) against what this code was actually calling. Found `selectAudioTrack(language, kind)` takes an optional second argument (`"main" | "translation" | "descriptions" | "commentary"`) this code never passed — and that `selectAudioTrack()` itself only shipped in Vimeo's SDK on **December 22, 2025**, i.e. it's a very new, still-maturing API. Every alternate-language track on this site's videos turned out to be tagged kind `"translation"`, not `"main"`; looking that up fresh via `getAudioTracks()` before calling `selectAudioTrack()` (new `selectAudioTrackForLanguage()` helper, looked up dynamically rather than hardcoded so it keeps working if a future video's track is tagged differently) took isolated-test success from roughly 20-50% to roughly 64-80%.

Re-tested the "time before first attempt" finding from the entry above more precisely, this time controlling for what exactly was being delayed. Result: delaying just the *method calls* on an already-constructed player barely helped (an early-constructed player, called only after an 8s wait, still succeeded just 1/5) — it's specifically the **`new Vimeo.Player()` constructor's own timing** that matters, not merely how long the caller waits afterward. A player constructed fresh only after an 8s warm-up succeeded 4/5 on the same iframe, same total elapsed time, only the construction *moment* differed. Moved the warm-up wait (`PLAYER_WARMUP_MS`, matching the existing `TRACK_SWITCH_TIMEOUT_MS` value) to before `new Vimeo.Player(iframe)` itself in `loadVideo()`, rather than wrapping it around the `switchLiveTrack()` call sites.

**A real first attempt at this got the delay in the wrong place** — wrapping the existing early-constructed player's calls in the warm-up wait — and looked great in isolation but measured only 1/12 in the real code path; redesigned to delay construction itself instead, as described above.

**A second false alarm followed even after that redesign**: the corrected version passed 12/12 in a full batch, but suspiciously fast (2.4-3.1s vs the expected several seconds) — flagged as suspicious before running it past Janet. Confirmed via real click timing + an 11-second wait + ground truth: those passes were for the wrong reason. With construction now deliberately delayed, a click landing before it finishes takes the pre-existing "player not ready yet" fallback path (shows an optimistic status immediately, defers the real check to the automatic re-verify) rather than actually exercising the fix — ground truth showed only 1/5 real success underneath, unchanged.

**Commit:** `aca0158` (bundled with the two entries below).

## 2026-09-10 (cont'd) — The other half of the fix: captions and audio calls were racing each other

Re-tested concurrency itself, this time controlling for construction timing (always a late, fully warmed-up player, matching the fix above) — something the very first investigation earlier today had tested only under immediate-construction conditions, where everything failed regardless of ordering and the effect was invisible. With construction timing controlled for: `enableTextTrack()` and `selectAudioTrackForLanguage()` fired together via `Promise.all` (the original, and current shipped, approach) succeeded only 1/5; the same two calls run sequentially — captions fully awaited first, then audio — succeeded 4/5, matching the "audio alone" result almost exactly.

**Correction:** this directly overturns an earlier same-day conclusion (in the "real bug ... selectAudioTrack() lies" entry above) that concurrency didn't matter. That earlier test was confounded by testing under immediate player construction, which failed almost regardless of call ordering.

Changed `switchLiveTrack()` in `video-toggle.js` to call the two sub-promises sequentially instead of via `Promise.all` — captions settle first, audio starts only after. Documented the tradeoff this creates: each sub-call still independently races `TRACK_SWITCH_TIMEOUT_MS` (8s), but since they're no longer racing each other, the true worst case is now additive (up to ~16s) rather than a single shared ~8s ceiling, in the pathological case where both time out. In every case actually observed this session, captions have never been the one to fail or time out, so this worst case is theoretical, not something measured — flagged rather than silently accepted.

While re-reading `switchLiveTrack()`'s two callers side by side to make this change, found a real, independent bug: `showTrackNote()` only ever touches `.video-quote-track-note` — it never clears `.lang-change-status`. The click-driven call site already calls `clearLangChangeStatus()` before every `showTrackNote()`; the automatic post-construction re-verify call site never did. That gap predates today, but the construction-timing delay above widens the window where it can actually be seen (the "player not ready" optimistic-status fallback now fires far more often and for far longer before the automatic re-verify's correction arrives), so a stale "Switched to Spanish." and the real failure track-note could show at once. Fixed to match the click-driven call site's existing pattern.

**Commit:** `aca0158` (bundled with the entries above and below).

## 2026-09-10 (cont'd) — Added verbose `[lang-switch]` console logging throughout, at Janet's request

Janet asked for heavy `console.log` coverage of everything touching the documentary live language-switch, including the promises returned by the Vimeo SDK calls and the specific `getAudioTracks()` comparison checks (e.g. `t.language === langCode`), so she can watch it live in her own browser's devtools rather than only through Playwright batches. Added a small `logLangSwitch(...)` helper (tags every line `[lang-switch]` for easy devtools filtering) and wired it through `waitForPlayerWarmup`, `withTrackSwitchTimeout` (now labeled `"captions"`/`"audio"` per call), `verifyAudioTrackActive` (logs the raw `getAudioTracks()` array and each track's `language`/`enabled` check individually), `selectAudioTrackForLanguage` (logs the looked-up `kind` and the raw select-call resolution/rejection), `switchLiveTrack`, and both call sites in `loadVideo()`/`handleLangSegmentClick()` (entry state, which branch is taken, and the final settled outcome).

Marked as temporary/deliberately verbose in a comment at its declaration — intended to be stripped once this investigation is done, not a permanent addition.

**Commit:** `aca0158` (bundled with the entries above).

## 2026-09-10 (cont'd) — End-to-end verification of the combined fix: real improvement, but the remaining cause is now pinned down exactly

Used the new `[lang-switch]` logging to verify the kind-parameter, construction-timing, and sequential-calls fixes together, end to end, rather than in isolation. Ran a temporary batch (Home: 6 runs, Learning hub: 4 runs) that plays the video, waits past the ~8s construction warm-up so the click lands on the real live-switch path (not the "player not ready" fallback), clicks Spanish, and reads the real settled outcome plus the full `[lang-switch]` trace for each run.

**Result: 3/10 (30%) fully successful combined** (3/6 Home, 0/4 Learning hub) — a real improvement over some of today's earlier baselines, but still far from reliable. Notably, Learning hub did *worse* than Home in this batch, the opposite of the "Home is worse" assumption from earlier today (small sample either side, but it's no longer a clean page-specific story now that the other contributing factors are fixed).

**The logging did exactly what it was added for**: every failure's mechanism is now unambiguous, with no remaining guesswork, and it's identical on both pages. `selectAudioTrackForLanguage()` correctly looks up `kind: "translation"` and calls `selectAudioTrack("es", "translation")`, which **resolves successfully** with `{language: "es", kind: "translation"}` — but the immediately-following `getAudioTracks()` check (`verifyAudioTrackActive`) still shows `{language: "en", enabled: true}` and `{language: "es", enabled: false}`. Not a timeout (the audio sub-call settles in 9-90ms every single time, success or failure alike). Every other factor fixed today is confirmed working correctly in these same logs (correct `kind` looked up, player fully warmed up, calls running sequentially, not concurrently). The one remaining cause is `selectAudioTrack()` itself resolving as if it worked without having actually applied the change, most of the time.

**Conclusion, not yet acted on:** this looks like close to the ceiling of what client-side code can fix here — every lever found today (timeout, kind parameter, construction timing, call ordering, honest verification instead of trusting the promise) is now in place and confirmed working as designed, and the failure still traces to one exact line in Vimeo's own (very new, shipped December 2025) SDK. This substantially strengthens the reload-fallback recommendation made earlier today (fall back to a full iframe reload on language change for quote blocks, matching episode-card's already-proven-reliable pattern) rather than continuing to chase further variations of live in-place switching. Left for Janet to decide, not acted on unilaterally.

**Commit:** `aca0158` — kind parameter, construction timing, sequential calls, `clearLangChangeStatus` fix, and `[lang-switch]` logging, all bundled together; temporary verification scripts (`tests/videos/tmp-verify-sequential*.spec.js`) deleted, not committed. Full `tests/videos` suite: 24/24, no regressions (note: the pre-existing "fully successful live track switch" test doesn't reliably exercise the real construction-delayed switch path any more — it clicks too soon after `assertVimeoPlayerLoads()` returns, which only waits for the iframe `src` attribute, not real player construction, so it's usually landing in the "player not ready yet" fallback branch instead. Pre-existing test-coverage gap surfaced by today's construction-timing change, not fixed — flagging, not touching, since it wasn't asked for).

## 2026-09-10 (cont'd) — Tested and ruled out: pausing the video before switching is not why the audio select fails

Janet asked directly why `getAudioTracks()` shows `enabled: false` for the requested language after `selectAudioTrack()` already resolved, and what would make it `true`. One real, previously-untested candidate: the click-driven switch calls `player.pause()` right before every attempt — plausible that an adaptive player can only actually swap an audio rendition while actively fetching segments, not while paused.

Tested directly: same sequential enableTextTrack-then-selectAudioTrack sequence, on an equally warmed-up player, via a second independent read-only `Vimeo.Player` on the same iframe, but never pausing anything. Result: **1/6 (17%)** — no better than (arguably slightly worse than, though the sample is small either way) the 3/10 (30%) baseline that does pause. Ruled out.

One real clue surfaced along the way, not yet explained: in the one run that succeeded, `getPaused()` read `true` afterward even though nothing in the test ever called `.pause()` — the player briefly paused itself internally. Consistent with (not proof of) a real internal stream reload being what actually applies a track change, happening inconsistently on Vimeo's side. Not pursued further given how much today's session has already spent chasing this exact SDK call; noting it here in case it's useful if this gets picked up again.

**Commit:** none — diagnostic only, temp script (`tests/videos/tmp-verify-no-pause.spec.js`) deleted after use.

## 2026-09-10 (cont'd) — Real bug found live by Janet: reverting to English mid-playback was being reported as a failure 100% of the time

Janet pasted her own `[lang-switch]` console output: clicked back to English while playing (after having switched away), captions switched fine, then `withTrackSwitchTimeout(audio)` timed out after the full 8s and the UI showed the "audio isn't available" track-note — but she was correctly hearing and reading English the whole time. A real, distinct bug from the `selectAudioTrack()`-lies-about-success one fixed earlier today: this time `selectDefaultAudioTrack()` never resolved *or rejected* at all — the original "hangs forever" failure mode from the very start of this investigation, previously only seen right after a fresh `new Vimeo.Player()` construction (which `PLAYER_WARMUP_MS` already works around), now confirmed happening on an already-established, already-playing player too.

**Root cause:** `switchLiveTrack()`'s audio sub-call chained the real verification (`getAudioTracks()`, which has never once been observed to hang) directly onto `selectAudioTrackForLanguage()`'s own promise settling first. When that promise hangs, verification never runs at all, so a switch that had already genuinely succeeded got reported as a failure purely because our own code never checked.

**Fix:** decoupled verification from that promise. `switchLiveTrack()`'s audio sub-call now checks real state via `getAudioTracks()` as soon as either the select call settles, or a new 2-second grace period elapses — whichever comes first — instead of waiting on a promise known to be unreliable. `AUDIO_SELECT_GRACE_MS = 2000` (generous relative to the low-double-digit-millisecond normal case, short relative to the 8s give-up ceiling).

**Verified, and the result was striking:** 4 EN-revert cycles (switch to Spanish, then click back to English, on Home) — in **all 4**, `selectDefaultAudioTrack()` never resolved or rejected at all (no "resolved"/"REJECTED" log line ever appeared, straight to "grace period elapsed" every time), and in all 4 the grace-period check correctly found English genuinely already active and reported full success. Before this fix, every one of these 4 would have taken the full 8s and reported a false failure — this specific scenario (revert to English mid-playback) looks like it was failing consistently, not just occasionally, making this arguably a bigger practical fix than the kind-parameter/sequential-calls work earlier today. Full `tests/videos` suite re-run for regressions after this change.

**Commit:** `94b3a80` — full `tests/videos` suite re-run after the fix: 24/24, no regressions.
