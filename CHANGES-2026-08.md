# Changes — August 2026

## 2026-08-28 — Media Type taxonomy; Learning Hub "Filter by type" now filters by Video/Short Answer/Article/Image

**What it does and why it was needed:** The Learning Hub's "Filter by type" checkboxes (`custom/learning-search` / `custom/learning-browse`) used to filter on each card's post type (Q&A/Resources/Episodes/Coloring Books/Guide Chapters/Books). Per Janet, that's being replaced with a filter on what KIND of media the content actually is — Video / Short Answer / Article / Image — since post type doesn't map cleanly onto that (e.g. a Q&A Entry can be a plain short answer or link out to a full article; a Guide Chapter can be text, video, or both). A post can now carry more than one Media Type.

**Changes:**
- New shared taxonomy `media_type` — [includes/media-type-taxonomy.php](plugins/custom-post-types-for-bbs/includes/media-type-taxonomy.php) (Custom Post Types for BBS plugin): hierarchical (checkbox UI, fixed vocabulary), 4 seeded terms (Video/Short Answer/Article/Image), same registration/seeding pattern as `stage-taxonomy.php`. Required in [custom-post-types-for-bbs.php](plugins/custom-post-types-for-bbs/custom-post-types-for-bbs.php) alongside the other shared taxonomies, with its own activation hook.
- Attached to all 6 content types shown in the Learning Hub — `episode-cpt.php`, `resource-cpt.php`, `qa-entry-cpt.php`, `coloring-book-cpt.php`, `book-cpt.php`, `guide-chapter-cpt.php` — via `register_taxonomy_for_object_type( 'media_type', ... )`, plus a `save_post_*` default-term hook per type (same guarded "only if the post has zero terms yet" pattern as the existing Stage/Series defaults) so no already-published post silently drops out of every filter: Episode→Video, Resource→Article, Q&A Entry→Short Answer, Coloring Book→Image, Book→Article, Guide Chapter→Article (Guide Chapter deliberately does NOT auto-detect an existing video — see that hook's own comment on the `rest_after_insert_guide_chapter` timing gotcha this would need).
- [src/learning-search/learning-search.php](plugins/custom-blocks-for-be-bite-smart/src/learning-search/learning-search.php) (Custom Blocks plugin): `bitesmart_build_stage_card_list()` now attaches each card's `mediaTypes` (slugs); `bitesmart_render_learning_search_data()` includes it in the JSON payload; `bitesmart_learning_search_type_labels()` → renamed `bitesmart_learning_search_media_type_labels()`, sourced from the 4 fixed Media Type terms instead of per-CPT labels; `bitesmart_render_learning_search_type_filter()` computes "present types" from the union of every card's `mediaTypes`; `bitesmart_stage_cards_maybe_bump_terms()` now also busts the cache on `media_type` term changes.
- [src/learning-search/view.js](plugins/custom-blocks-for-be-bite-smart/src/learning-search/view.js) and [src/learning-browse/browse.js](plugins/custom-blocks-for-be-bite-smart/src/learning-browse/browse.js): filter predicate changed from exact match on a single `card.type` to an overlap check (`card.mediaTypes.some(...)`) against the enabled checkboxes, since a card can now carry more than one Media Type.
- Ran `pnpm build` in `custom-blocks-for-be-bite-smart` to regenerate `build/` (confirmed `mediaTypes` present in the compiled `view.js`/`browse.js`).
- [custom-post-types-for-bbs/README.md](plugins/custom-post-types-for-bbs/README.md): added `media_type` to the taxonomy table.

**Key decisions and alternatives rejected:**
- Taxonomy over a post-meta checkbox array: matches this codebase's existing pattern for fixed-vocabulary classification (Stage/Series are both hierarchical taxonomies for the same reason), gets a free checkbox panel in the editor sidebar via `show_in_rest` (same place Stage/Topic/Series already live, not inside the locked `*-fields` blocks), and `tax_query`/`wp_get_post_terms()` support for free instead of hand-building REST meta + UI six times over.
- Filter replaces the old post-type checkboxes rather than running alongside them (per Janet) — `'type'` (post type) stays on each card internally for `bitesmart_stage_card_keywords()`'s existing per-post-type meta-key lookup, it's just no longer what the checkboxes filter on.
- Guide Chapter does not auto-derive "Video" from its existing video-URL meta at save time — that meta is written via REST AFTER `save_post` fires (same documented timing gotcha as `bitesmart_guide_chapter_autofill_guide_id()`), so a save_post-time read would see stale/empty data on the very save that added a video. Defaults to "Article" only; editors check "Video" by hand for chapters that have one.
- `array_merge( array(), ...wp_list_pluck($cards, 'mediaTypes') )` in `bitesmart_render_learning_search_type_filter()` deliberately prepends an empty array as a guaranteed first argument — `array_merge(...$x)` with an empty `$cards` (a Stage with nothing added yet) would otherwise spread to zero arguments, which throws `ArgumentCountError` in PHP 8.

**Deviations from the original plan:** none in the original design — but a real bug surfaced once live: `Warning: Undefined array key "mediaTypes"` from `wp-includes/class-wp-list-util.php`. Root cause: `bitesmart_stage_cards_template_version()` (the mtime-based cache-key ingredient meant to auto-invalidate `bitesmart_build_stage_card_list()`'s transient cache whenever a render TEMPLATE changes) listed every `*-display.php` file but not `learning-search.php` itself — the file where the card array's SHAPE is built. Adding the `mediaTypes` key to that shape was exactly this kind of edit (same class of change the function's own docblock already warns about for `render_qa_entry_block()`/etc.), so a stale transient built by the old code (no `mediaTypes` key) kept being served as valid, with nothing about a shape-only edit to touch a post/term and bump the OTHER cache-busting mechanism (the generation counter). **Fix:** added `__FILE__` to `bitesmart_stage_cards_template_version()`'s file list, so this file's own edits now self-invalidate the cache the same way every display template's do — the fix's own edit immediately changed this file's mtime, so the very next page load already rebuilds fresh. Also swapped `wp_list_pluck( $cards, 'mediaTypes' )` (which reads the key with no `isset()` guard — the actual line that warned) for an `array_map()` with a `'?? array()'` fallback, and added the same fallback to `bitesmart_render_learning_search_data()`'s payload mapping (a stale card missing `mediaTypes` in the embedded JSON would otherwise make `card.mediaTypes.some(...)` throw a TypeError in the browser) — belt-and-suspenders against the same class of bug the next time a card field is added.

After fixing the warning, Janet reported a second, related bug: the "Filter by type" checkboxes weren't rendering at all. Root cause was the rollout gap flagged as a real risk during planning but under-addressed in the actual implementation: the per-CPT `save_post_*` default-term hooks (Episode→Video, etc.) only ever fire when a post is saved AGAIN — they never retroactively touch content published before this taxonomy shipped. Every existing card had zero Media Type terms, so `bitesmart_render_learning_search_type_filter()`'s "2+ distinct types present across these cards" gate never passed. **Fix:** added `bitesmart_backfill_media_type_terms()` to [media-type-taxonomy.php](plugins/custom-post-types-for-bbs/includes/media-type-taxonomy.php) — a one-time (option-flag-guarded, same idempotent pattern as term seeding) pass over every already-existing post of each attached type, calling that post type's own `bitesmart_default_*_media_type_term()` function directly (not a second, separately-maintained default map) so each CPT's default stays defined in exactly one place. Hooked at `init` priority 20, after every CPT's own priority-10 registration. No separate cache-bust needed — `wp_set_object_terms()` inside each default function already fires WordPress's own `set_object_terms` action, which `bitesmart_stage_cards_maybe_bump_terms()` (learning-search.php) already listens for.

**Verification:** `pnpm build` completed successfully (165 assets, webpack compiled with no errors); confirmed via grep that `mediaTypes` landed in the compiled `build/learning-search/view.js` and `build/learning-browse/browse.js`. No local PHP CLI available in this environment to lint the PHP changes — reviewed by hand instead (brace/paren balance checked per file, each edited region re-read against the existing Stage/Series default-term pattern it mirrors). Both the stale-cache warning and the missing-filter bug were reported live by Janet and fixed same-session; the backfill fix is not yet re-confirmed live. Still to check: reloading a Stage page now runs the backfill once and the "Filter by type" checkboxes actually appear with Video/Short Answer/Article/Image labels; unchecking one correctly hides cards that carry ONLY unchecked types from both the live search and the browse list; a card with multiple Media Types (once one exists) stays visible as long as any of its types is checked; a brand-new post of each of the 6 types still gets its on-save default correctly.

**Commit range or PR link:** not yet committed — no git repository is initialized for this project (per environment info), so nothing to commit yet; flagging for Janet.

## 2026-08-28 — Real Question fields for Episode/Guide Chapter search cards; Keywords→Synonyms rename

**What it does and why it was needed:** Episode's and Guide Chapter's compact search-result cards in the Learning Hub Search (Fuse.js, `custom/learning-search`) used to show a heading that was algorithmically synthesized rather than editor-authored — Episode: `"{description}. Watch: {title}"`; Guide Chapter: `"Chapter {number}: {title}"`. Real Q&A Entries, by contrast, already use a genuine editor-written question (their post title). Janet wanted Episode and Guide Chapter to carry a real Question field instead, plus a Synonyms field matching Q&A Entry's naming.

**Changes:**
- [includes/episode-cpt.php](plugins/custom-post-types-for-bbs/includes/episode-cpt.php) and [includes/guide-chapter-cpt.php](plugins/custom-post-types-for-bbs/includes/guide-chapter-cpt.php): registered new `_bitesmart_episode_question` / `_bitesmart_chapter_question` meta — single plain strings (not per-language `_by_lang` maps, since they render as real visible page text and TranslatePress translates them the normal way, same as Description/Summary). Also relabeled the existing per-language `_bitesmart_episode_keywords_by_lang` / `_bitesmart_chapter_keywords_by_lang` fields "Synonyms" in doc comments and the editing UI, to match Q&A Entry's naming — meta keys and PHP identifiers deliberately left unchanged, label-only rename, no migration needed.
- [src/episode-fields/index.js](plugins/custom-blocks-for-be-bite-smart/src/episode-fields/index.js) and [src/guide-chapter-panel/index.js](plugins/custom-blocks-for-be-bite-smart/src/guide-chapter-panel/index.js): added a "Question" `TextControl` next to Description/Summary; relabeled "Search Keywords" → "Search Synonyms" and each per-language "Keywords" label → "Synonyms".
- [src/episode-display/episode-display.php](plugins/custom-blocks-for-be-bite-smart/src/episode-display/episode-display.php) `render_episode_search_card()` and [src/guide-chapter-display/guide-chapter-display.php](plugins/custom-blocks-for-be-bite-smart/src/guide-chapter-display/guide-chapter-display.php) `render_guide_chapter_search_card()`: removed the synthesis logic entirely (not just bypassed it); heading now reads the new Question meta, falling back to the plain post title (`get_the_title()`) when blank.
- [src/learning-search/learning-search.php](plugins/custom-blocks-for-be-bite-smart/src/learning-search/learning-search.php): doc-comment-only polish (stale "synthesized question" phrasing, Keywords→Synonyms terminology) — confirmed no functional change was needed here. `bitesmart_stage_card_keywords()` already reads Episode's/Guide Chapter's `*_keywords_by_lang` meta into every card's Fuse.js `searchText`, exactly like Q&A Entry's Synonyms, so that requirement was already met before this change; the new Question text is automatically searchable too once it's the card's H3 heading, via the existing `wp_strip_all_tags()` half of `searchText` — no extra wiring for either.
- Ran `pnpm run build` in `custom-blocks-for-be-bite-smart` to regenerate `build/`.
- Also updated the project's memory docs (`be-bitesmart-episode-status`, `be-bitesmart-guide-cpt-plan`, `be-bitesmart-search-status`) with matching dated entries.

**Key decisions and alternatives rejected:**
- No new "Resource"-style CPT: Janet explicitly considered and rejected that, since each Guide Chapter/Episode only ever needs one question — a shared CPT would have been unnecessary indirection for a 1:1 relationship each CPT can just hold directly.
- Question is a single string, not a `_by_lang` map: it's real visible content (same shape/reasoning as Description/Summary), so TranslatePress's normal page-scan translation already handles it — a `_by_lang` map would have been redundant plumbing copied from Synonyms/Keywords, which are invisible internal data for a different reason (they must NOT be picked up by TranslatePress).
- Scope limited to the compact Stage-page teaser cards only, per Janet: the pooled multi-Guide search page's full chapter accordion (`render_guide_chapter_pooled_card()` → `bitesmart_render_guide_chapter_row()`) stays untouched, still a rich chapter view (video/text/badges), not reframed as a Q&A card.
- Blank-Question fallback is the plain post title, not the old synthesized phrasing — the synthesis logic was deleted outright rather than kept as a fallback, since the whole point was replacing algorithmic guessing with real editor input; keeping it as a silent fallback would have let old-style headings linger indefinitely instead of surfacing which posts still need a real Question filled in.
- Keywords→Synonyms was a label-only rename (meta keys/function names unchanged) to minimize risk — renaming the underlying meta key would have required a data migration for zero functional benefit, since the only goal was matching Q&A Entry's existing terminology.

**Deviations from the original plan:** none — implementation matched the approved plan as designed.

**Verification:** `pnpm run build` completed successfully (165 assets, webpack compiled with no errors). Not yet manually verified live in wp-admin — still to check: an existing published Episode/Guide Chapter with no Question filled in shows its plain title on the Stage-page search card (not the old synthesized phrasing); filling in Question on one of each updates that card's heading; the pooled Guide search page's chapter accordion is unchanged; searching the new Question text and an existing Synonyms-only phrase both surface the right card via Fuse.js.

**Commit range or PR link:** not yet committed — Janet is committing this manually; see the suggested commit message provided alongside this change.

## 2026-08-28 — Episode search card: thumbnail + Q&A Description, above the Watch Episode button

**What it does and why it was needed:** Episode's compact search-result card (`render_episode_search_card()`) revealed body only ever had a bare "Watch Episode" link — no image, no supporting text. Janet asked for the card's revealed body to show, top to bottom: the episode's thumbnail, a short Q&A-specific description, then the existing button. She also asked for a new field, explicitly named so editors know it's for this card, rather than reusing the existing Description field (which is written for the full video-player card instead).

**Changes:**
- [includes/episode-cpt.php](plugins/custom-post-types-for-bbs/includes/episode-cpt.php): new `_bitesmart_episode_qa_description` meta — single plain string (same reasoning as `_bitesmart_episode_question` from earlier today: renders as real visible text, so TranslatePress translates it normally, no `_by_lang` map needed).
- [src/episode-fields/index.js](plugins/custom-blocks-for-be-bite-smart/src/episode-fields/index.js): new "Q&A Description" `TextareaControl`, placed right after the existing Question field, with help text explicitly distinguishing it from the Description field above.
- [src/episode-display/episode-display.php](plugins/custom-blocks-for-be-bite-smart/src/episode-display/episode-display.php) `render_episode_search_card()`: revealed body now renders the episode's Featured Image (`has_post_thumbnail()`/`get_the_post_thumbnail()`, `medium` size, lazy-loaded — same call shape `render_episode_block()` already uses), then the Q&A Description paragraph (if filled in), then the existing "Watch Episode" link — all three stacked top to bottom, both the thumbnail and description optional.
- [src/episode-display/style.css](plugins/custom-blocks-for-be-bite-smart/src/episode-display/style.css): new `.episode-search-card-thumbnail`/`.episode-search-card-description` rules (stacked spacing, rounded thumbnail corners matching the site's existing `0.375rem` media-rounding convention).
- [src/learning-search/learning-search.php](plugins/custom-blocks-for-be-bite-smart/src/learning-search/learning-search.php) `bitesmart_learning_search_enqueue_card_styles()`: added `'custom/episode'` to the manually-enqueued style-handle list, alongside `custom/qa-entry`/`custom/resource`. Necessary fix, not scope creep: this function exists specifically because `render_episode_search_card()` is called directly as a PHP function (not real block markup), so WordPress's automatic "which blocks are on this page" style-loading never fires for it — before today, that didn't matter because the search card reused 100% of qa-entry's own CSS with nothing episode-specific; today's new thumbnail/description classes live in `episode-display`'s own stylesheet, so without this addition they'd only load on pages that also happen to have a literal `custom/episode` block placed (which real Stage pages don't).
- Ran `pnpm run build`; confirmed the new CSS classes and field strings compiled into `build/episode-display/style-index.css` and `build/episode-fields/index.js`.

**Key decisions and alternatives rejected:**
- Dedicated `_bitesmart_episode_qa_description` field rather than reusing the existing Description field: the existing field is written for the full video-player card and doesn't necessarily read as a good answer to the Question directly above it on this card — Janet's own ask was for a clearly-named separate field, not overloading an existing one.
- Thumbnail before description before button (not any other order) — matches Janet's literal layout spec.

**Deviations from the original plan:** found and fixed a related gap while implementing — `bitesmart_learning_search_enqueue_card_styles()` didn't have `custom/episode` in its enqueue list; without adding it, the new CSS silently wouldn't load on real Stage pages (only ever tested/visible on a page that happens to also embed a literal `custom/episode` block, which Stage pages don't). Not asked for explicitly, but directly required for this feature to actually render correctly, so fixed as part of this change rather than filed separately. **Also worth flagging, not fixed**: `book-display`'s own search-card CSS (`.book-search-card-*`, in `book-display/style.css`) appears to have this identical latent gap — `custom/book` isn't in that same enqueue list — so it may only be working today by coincidence (a page happening to also have a real `custom/book` block on it) rather than by design. Left untouched since it's pre-existing and unrelated to this task; worth a follow-up check if Janet wants to confirm book search cards are actually styled correctly on a real Stage page.

**Verification:** `pnpm run build` completed successfully; confirmed via grep that `.episode-search-card-thumbnail`/`.episode-search-card-description` landed in the compiled stylesheet and `_bitesmart_episode_qa_description`/"Q&A Description" landed in the compiled field JS. Not yet manually verified live in wp-admin — still to check: an episode with a Featured Image and Q&A Description set shows both, in order, above the Watch Episode button on its Stage-page search card; an episode missing either one just omits that piece cleanly; the new CSS actually applies on a real Stage page (not just a page that happens to also have a `custom/episode` block).

**Commit range or PR link:** not yet committed — Janet is committing this manually; see the suggested commit message provided alongside this change.

## 2026-08-28 — Restored "browse everything" auto-hide while a Learning Hub search is active

**What it does and why it was needed:** Janet asked to revert an older decision — the paginated "All X Questions & Resources" browse list used to disappear while a visitor had an active search in the Fuse.js search box (redundant once real results are showing), and come back once the box was cleared. That behavior was lost, not deliberately removed, as a side effect of the 2026-08-16 split of `custom/learning-search` (search box + live results) and `custom/learning-browse` (the browse list itself) into two independent sibling blocks — see [[be-bitesmart-search-status]]. The old code hid `.learning-search-browse` via `block.querySelector(...)`, scoped to the search block's own DOM; once the browse list moved into a sibling block's markup, that selector could never find it again, silently dropping the hide/show behavior with no visible error.

**Changes:**
- [src/learning-search/view.js](plugins/custom-blocks-for-be-bite-smart/src/learning-search/view.js): new `setBrowseListsHidden(hidden)` helper, `document.querySelectorAll(".learning-search-browse")` page-wide (not scoped to `block`) — same "any copy, any block" pattern this file already uses for `getEnabledTypes()`/`syncTypeCheckboxes()` to reach a sibling `custom/learning-browse` block's own markup. Called with `false` in `render()`'s early-return branch (query below `MIN_QUERY_LENGTH`) and `true` after both the zero-match and has-matches branches. A no-op when no `custom/learning-browse` block is on the page (e.g. the pooled Guide search page never places one).
- Ran `pnpm run build`; confirmed `learning-search-browse` landed in the compiled `build/learning-search/view.js`.

**Key decisions:** hide only `.learning-search-browse` (the browse LIST itself), not the whole `custom/learning-browse` section — the type-filter checkboxes above it stay visible/usable while searching, matching the original pre-split behavior exactly (that div boundary was unchanged by the split, just moved to a different block's markup).

**Verification:** `pnpm run build` completed with no errors. Not yet manually verified live — still to check: typing 2+ characters into the search box on a real Stage page hides the sibling browse block's list (filter checkboxes above it stay visible); clearing the box or deleting back below 2 characters brings it back; a page with only `custom/learning-search` and no `custom/learning-browse` block behaves exactly as before (no-op).

**Commit range or PR link:** not yet committed — Janet commits manually per existing convention on this branch.

## 2026-08-28 — Drop custom/learning-browse's now-redundant "Filter by type" checkboxes

**What it does and why it was needed:** Janet's ask: now that the browse list auto-hides while a search is active (previous entry today), a visitor on a real Stage page could see the "Filter by type" checkbox row rendered twice — once above the live search results (`custom/learning-search`), once above the (now often-hidden) browse list (`custom/learning-browse`), since both blocks independently call the same shared `bitesmart_render_learning_search_type_filter()`. The search block's copy is enough; dropped the browse block's copy.

**Changes:**
- [src/learning-browse/learning-browse.php](plugins/custom-blocks-for-be-bite-smart/src/learning-browse/learning-browse.php): removed the `bitesmart_render_learning_search_type_filter( $cards );` call from `render_learning_browse_block()`. Guide format controls (the separate `bitesmart_render_guide_format_controls()` call, only for the pooled Guide pseudo-stage) are untouched — unrelated toggle.
- [src/learning-search/learning-search.php](plugins/custom-blocks-for-be-bite-smart/src/learning-search/learning-search.php): updated `bitesmart_render_learning_search_type_filter()`'s docblock — it's now called from `custom/learning-search`'s render callback only, not from both blocks.
- [src/learning-browse/browse.js](plugins/custom-blocks-for-be-bite-smart/src/learning-browse/browse.js) and [src/learning-search/view.js](plugins/custom-blocks-for-be-bite-smart/src/learning-search/view.js): comments only, updated to describe checkboxes rendering in one block now instead of "either/both" — no functional JS change needed in either file, since both already read/sync `.learning-search-type-checkbox` page-wide (`document.querySelectorAll`, not scoped to "this block's own"), so browse.js's filtering keeps working correctly off the search block's one remaining copy automatically.
- Ran `pnpm run build`; `php -l` on both edited PHP files came back clean.

**Key decisions:** kept the shared `bitesmart_render_learning_search_type_filter()` function and its "2+ distinct Media Types present" gating exactly as-is (still needed by `custom/learning-search`) — only removed the second call site, not the function itself. Left `browse.js`'s page-wide checkbox reading/syncing in place rather than simplifying it to "assume checkboxes live in the sibling search block" — degrades gracefully (no filter UI, but the browse list still renders/paginates) on the one page type from before this task that legitimately doesn't need it, and costs nothing to keep general.

**Verification:** `pnpm run build` completed with no errors; `php -l` clean on both changed PHP files. Not yet manually verified live — still to check: a real Stage page with both blocks shows exactly one "Filter by type" row (in the search block); unchecking a type there still correctly narrows the browse block's list once revealed (search cleared); a page with only `custom/learning-search` (no browse block) is unaffected.

**Note:** while running `pnpm run build` for this change, it also picked up and recompiled an unrelated, already-modified-on-disk `src/guide-chapter-display/style.css` (two `border-top`/`border-bottom` rules removed from `.guide-format-controls`) that predates this session and wasn't made by this task — flagged to Janet, left as-is.

**Commit range or PR link:** not yet committed — Janet commits manually per existing convention on this branch.

## 2026-08-28 — Shared ".custom-block-border-line-wrap" class for the two matching "hairline" wrappers

**What it does and why it was needed:** Janet noticed her own local edit removing the `border-top`/`border-bottom: 1px solid #d0e4eb` pair from `.guide-format-controls` (guide-chapter-display/style.css) hadn't visibly taken effect (root cause was a stale WP Super Cache page, covered in the prior conversation turn) — and separately had an uncommitted, independent edit removing that exact same two-line border rule from `.learning-search-type-filter-wrap` (learning-browse/style.css) too. Both wrappers were styled to intentionally look identical (the "Filter by type" row and the "Show: Video/Text" bar), each carrying its own hand-duplicated copy of the same border declaration — exactly the kind of duplication that just silently drifted (one edited, not noticed the other needed the same edit). Janet asked to pull the shared piece out into one shared style so the two can't drift out of sync again.

**Changes:**
- [themes/twentytwentyfive-child/css/shared-block-styles.css](themes/twentytwentyfive-child/css/shared-block-styles.css): new `.custom-block-border-line-wrap` class (`border-top`/`border-bottom: 1px solid #d0e4eb`) — the established place for cross-block shared presentational CSS on this site (see the existing `.custom-block-card`/`.custom-block-accent-card` classes above it in the same file). Takes effect immediately (this file is enqueued by raw path, versioned via `get_css_version()`'s live `md5_file()` hash — no plugin build step needed for this file specifically).
- [src/learning-search/learning-search.php](plugins/custom-blocks-for-be-bite-smart/src/learning-search/learning-search.php) `bitesmart_render_learning_search_type_filter()`: added `custom-block-border-line-wrap` alongside the existing `learning-search-type-filter-wrap` class on that wrapper `<div>`.
- [src/guide-chapter-display/guide-chapter-display.php](plugins/custom-blocks-for-be-bite-smart/src/guide-chapter-display/guide-chapter-display.php) `bitesmart_render_guide_format_controls()`: same, added alongside the existing `guide-format-controls` class.
- [src/learning-browse/style.css](plugins/custom-blocks-for-be-bite-smart/src/learning-browse/style.css) and [src/guide-chapter-display/style.css](plugins/custom-blocks-for-be-bite-smart/src/guide-chapter-display/style.css): comments updated to point at the new shared class instead of describing a hand-duplicated border (the border-removal itself was already Janet's own pending edit in both files, predating this change — this just gives it a real home and fixes the stale explanatory comments, including one in learning-browse/style.css that still described the type-filter row as "rendered FIRST" inside this block, no longer true since the 2026-08-28 filter-removal earlier today).
- Ran `pnpm run build` in `custom-blocks-for-be-bite-smart`; confirmed the compiled `build/learning-browse/style-index.css` and `build/guide-chapter-display/style-format-toggle.css` no longer embed the border rule themselves (moved out, not duplicated).

**Key decisions:** shared ONLY the border-top/border-bottom pair, not the surrounding padding/margin (each wrapper's spacing still differs slightly — `.learning-search-type-filter-wrap` uses `margin: 0 0 20px 0`, `.guide-format-controls` uses `margin-bottom: 16px` plus its own flex layout) — matches what Janet actually asked to keep in sync ("the border line styling"), not a broader merge of two elements that are still laid out differently.

**Verification:** `pnpm run build` completed with no errors; `php -l` clean on both edited PHP files; confirmed via grep that no `border-top`/`border-bottom: ... #d0e4eb` pair remains duplicated in either block's own compiled CSS, only in the new shared class. Not yet manually verified live (same WP Super Cache caveat as the prior entry — clear the cache before checking).

**Flagged, not fixed:** a few other unrelated spots in the codebase (`guide-references/style.css`, `shared/download-card/style.css`/`edit.js`/`preview-styles.js`) also use the `#d0e4eb` color as a single divider border, not the top+bottom pair this task consolidated — different visual pattern, left untouched as out of scope.

**Commit range or PR link:** not yet committed — Janet commits manually per existing convention on this branch.

## 2026-08-28 — Correction: shared class is padding, not border (prior entry misread the ask)

**What happened:** the prior entry today ("Shared `.custom-block-border-line-wrap` class") misread Janet's border-removal edits as accidental/unsaved-in-progress work and built a shared class to restore+share the border. Janet clarified: she removed the border **on purpose**; what she actually asked to share was the `padding: 16px 0` both wrappers still have in common (the genuinely identical leftover once the border's gone), not the border itself.

**Changes:**
- [themes/twentytwentyfive-child/css/shared-block-styles.css](themes/twentytwentyfive-child/css/shared-block-styles.css): `.custom-block-border-line-wrap` renamed to `.custom-block-filter-bar`, now `padding: 16px 0` only — no border property at all.
- [src/learning-search/learning-search.php](plugins/custom-blocks-for-be-bite-smart/src/learning-search/learning-search.php) / [src/guide-chapter-display/guide-chapter-display.php](plugins/custom-blocks-for-be-bite-smart/src/guide-chapter-display/guide-chapter-display.php): markup class updated to `custom-block-filter-bar`.
- [src/learning-browse/style.css](plugins/custom-blocks-for-be-bite-smart/src/learning-browse/style.css) / [src/guide-chapter-display/style.css](plugins/custom-blocks-for-be-bite-smart/src/guide-chapter-display/style.css): removed `padding: 16px 0` from each block's own rule (now only in the shared class) — `.learning-search-type-filter-wrap` keeps its own `margin: 0 0 20px 0`; `.guide-format-controls` keeps its own flex layout + `margin-bottom: 16px`. Comments corrected to stop describing a shared border.
- Ran `pnpm run build`; confirmed compiled `build/learning-browse/style-index.css` (`margin:0 0 20px` only) and `build/guide-chapter-display/style-format-toggle.css` (flex/gap/margin only) no longer carry the padding themselves.

**Verification:** `php -l` clean on both PHP files; `pnpm run build` clean; grepped both files' compiled CSS to confirm the padding moved out and no `#d0e4eb` border remains anywhere. Not yet manually verified live (same WP Super Cache caveat as earlier entries today).

**Commit range or PR link:** not yet committed — Janet commits manually per existing convention on this branch. (Given this corrects an entry from earlier today that also wasn't committed, no history to clean up.)

## 2026-08-28 — Fully unify the two filter/controls bars' spacing (margin included)

**What it does and why it was needed:** follow-up to the prior "shared padding" entry today — Janet asked for the two bars to have the same style outright, with the "Filter by type" wrapper's own styling (the one used on real Stage archive pages) winning where they'd differed. The only remaining difference was bottom margin: `.learning-search-type-filter-wrap` used 20px, `.guide-format-controls` used 16px.

**Changes:**
- [themes/twentytwentyfive-child/css/shared-block-styles.css](themes/twentytwentyfive-child/css/shared-block-styles.css): `.custom-block-filter-bar` now also carries `margin-bottom: 20px` (the "Filter by type" wrapper's value) alongside its existing `padding: 16px 0`.
- [src/guide-chapter-display/style.css](plugins/custom-blocks-for-be-bite-smart/src/guide-chapter-display/style.css): removed `.guide-format-controls`' own `margin-bottom: 16px` — that bar keeps only its own flex layout (`display`/`align-items`/`flex-wrap`/`gap`), since it's itself the flex row (unlike the other wrapper, whose child `<fieldset>` is the flex row instead).
- [src/learning-browse/style.css](plugins/custom-blocks-for-be-bite-smart/src/learning-browse/style.css): removed the now-empty `.learning-search-type-filter-wrap` ruleset entirely (padding moved out in the prior entry, margin moves out here — nothing block-specific left). The class stays in the markup for its semantic name, just carries no CSS of its own anymore.
- Ran `pnpm run build`; confirmed compiled `guide-format-controls{}` rule is flex-only now, and the empty `.learning-search-type-filter-wrap` rule was dropped from the compiled browse-block CSS entirely.

**Verification:** `pnpm run build` completed with no errors. Not yet manually verified live (same WP Super Cache caveat as earlier entries today — clear the cache before checking).

**Commit range or PR link:** not yet committed — Janet commits manually per existing convention on this branch.

## 2026-08-28 — Fold the flex row itself into the shared filter/controls bar class

**What it does and why it was needed:** last piece of today's filter/controls-bar consolidation — `.guide-format-controls` (guide-chapter-display/style.css) still hand-declared its own `display: flex; align-items: center; flex-wrap: wrap; gap: 16px`, duplicating what `.learning-search-type-filter` (the fieldset, learning-browse/style.css) already had. Janet pointed at that existing rule and asked to remove the duplicate from `.guide-format-controls` instead of keeping two copies.

**Changes:**
- [themes/twentytwentyfive-child/css/shared-block-styles.css](themes/twentytwentyfive-child/css/shared-block-styles.css): `.custom-block-filter-bar` now also carries `display: flex; align-items: center; flex-wrap: wrap; gap: 8px 10px` — copied from `.learning-search-type-filter`'s own values (the "Filter by type" row wins again, same as the padding/margin passes earlier today; `.guide-format-controls`' old `gap: 16px` is gone).
- [src/guide-chapter-display/style.css](plugins/custom-blocks-for-be-bite-smart/src/guide-chapter-display/style.css): `.guide-format-controls` had nothing left once flex moved out (padding/margin already gone from earlier passes) — removed the empty ruleset entirely; the class stays in markup for its name.
- [src/learning-browse/style.css](plugins/custom-blocks-for-be-bite-smart/src/learning-browse/style.css): `.learning-search-type-filter` (the fieldset) is UNCHANGED — it's the checkboxes' real flex row (its parent `.learning-search-type-filter-wrap` div has no other children, so making that wrap div flex too via the shared class is harmless nesting, not a duplicate of what the fieldset does for its own children). Comments updated to explain the nesting is intentional, not an oversight.
- Ran `pnpm run build`; confirmed `.guide-format-controls` compiles to no rule at all now, `.learning-search-type-filter` compiled unchanged, and the shared class picked up the flex/gap properties.

**Key decision worth flagging:** this also silently changes `.guide-format-controls`' button gap from 16px to 8px 10px (the Video/Text toggle buttons will sit closer together than before) — a real, visible spacing change, not just a code dedup. Flagging in case that reads too tight once seen live; easy to special-case back if so (either override `gap` on `.guide-format-controls` directly, or split gap back out of the shared class).

**Verification:** `pnpm run build` completed with no errors. Not yet manually verified live (same WP Super Cache caveat as every entry today — clear the cache before checking) — especially worth checking the Video/Text toggle spacing given the gap change above.

**Commit range or PR link:** not yet committed — Janet commits manually per existing convention on this branch.

## 2026-08-28 — "Show:" label matched to "Filter by type" label's look

**What it does and why it was needed:** the toggle-pill buttons themselves (`.guide-format-toggle` / `.learning-search-type-toggle`) already looked identical (same accent-3 yellow pill styling, previously matched in an earlier session per the existing comment in guide-chapter-display/style.css) — the one remaining visible mismatch between the "Show: Video/Text" bar and the "Filter by type" row was their LABEL: "Filter by type" is bold and sits on its own line above the pill row (`.learning-search-type-filter-legend`'s `width: 100%` forces the wrap inside the shared flex row); "Show:" was small, grey, and sat inline on the same line as its buttons (`.guide-format-controls-label`'s `font-size: 0.85em; color: ...contrast-2`). Janet asked for "Show:" to use the same styling and layout.

**Changes:**
- [themes/twentytwentyfive-child/css/shared-block-styles.css](themes/twentytwentyfive-child/css/shared-block-styles.css): new `.custom-block-filter-bar-legend` class — `font-weight: 600; padding: 0 0 10px 0; width: 100%` — the "Filter by type" legend's own values (winner, same pattern as every merge today); no color override, so "Show:"'s previous small/grey treatment is dropped, not carried over.
- [src/learning-search/learning-search.php](plugins/custom-blocks-for-be-bite-smart/src/learning-search/learning-search.php) / [src/guide-chapter-display/guide-chapter-display.php](plugins/custom-blocks-for-be-bite-smart/src/guide-chapter-display/guide-chapter-display.php): added `custom-block-filter-bar-legend` alongside each label's own existing class in markup.
- [src/learning-browse/style.css](plugins/custom-blocks-for-be-bite-smart/src/learning-browse/style.css) / [src/guide-chapter-display/style.css](plugins/custom-blocks-for-be-bite-smart/src/guide-chapter-display/style.css): removed each label's own now-fully-redundant rule (both ended up completely empty — one because everything moved out, the other because its old look was replaced rather than kept); class names stay in markup for their semantic meaning.
- Ran `pnpm run build`; confirmed neither label produces its own compiled CSS rule anymore, only the shared class does.

**Verification:** `php -l` clean on both PHP files; `pnpm run build` clean. Not yet manually verified live (same WP Super Cache caveat as every entry today — clear the cache before checking).

**Commit range or PR link:** not yet committed — Janet commits manually per existing convention on this branch.

## 2026-08-28 — Drop the main Guide page's own redundant "Show:" bar

**What it does and why it was needed:** Janet confirmed `custom/guide-single` (the main Guide accordion, guide-single.php) is placed on the SAME page as the pooled Guide-stage `custom/learning-search` block (`stage_slug === 'guide'`) — both independently called `bitesmart_render_guide_format_controls()`, so the "Show: Video/Text" bar rendered twice on that page. Same redundancy, same fix, as the earlier "Filter by type" duplication between `custom/learning-search` and `custom/learning-browse` today — one copy is enough.

**Changes:**
- [src/guide-single/guide-single.php](plugins/custom-blocks-for-be-bite-smart/src/guide-single/guide-single.php) `bitesmart_render_guide_single()`: removed its `bitesmart_render_guide_format_controls()` call. `bitesmart_render_guide_chapter_single()` (an individual chapter's own permalink page — no `custom/learning-search` sibling there) is UNTOUCHED, keeps rendering its own copy — it's the only control on that page, nothing redundant about it.
- [src/guide-chapter-display/guide-chapter-display.php](plugins/custom-blocks-for-be-bite-smart/src/guide-chapter-display/guide-chapter-display.php) `bitesmart_render_guide_format_controls()`: docblock rewritten to describe the current two render sites (a chapter's own single page, and the pooled Guide-stage `custom/learning-search` block) instead of the old three, and to record why/when guide-single.php's copy was dropped.
- No JS/CSS changed, no `pnpm run build` needed — PHP-only, takes effect on save. `php -l` clean on both files.

**Verification:** `php -l` clean. Not yet manually verified live (same WP Super Cache caveat as every entry today — clear the cache before checking) — specifically worth confirming the pooled Guide-stage page still shows exactly one "Show: Video/Text" bar (from custom/learning-search) and that it still correctly toggles guide-single's chapter rows below it (format-toggle.js already treats every `.guide-format-checkbox` on the page as one synchronized group, so this should need no JS changes — but hasn't been checked live), and that a lone chapter's own permalink page is unaffected.

**Commit range or PR link:** not yet committed — Janet commits manually per existing convention on this branch.

## 2026-08-30 — Show more / show less for Unfunded Episode cards

Editors were placing many `custom/unfunded-episode` cards in a row on a
page and wanted only the first one visible by default, with the rest
behind a "Show More" toggle they could also collapse again.

Rather than build a new wrapper block, reused the existing generic
`custom/read-more` block (`src/read-more/`), which already renders
arbitrary InnerBlocks content behind an expand/collapse button and has
its toggle script (`src/read-more.js`) enqueued site-wide. Its
`allowedBlocks` list didn't include `custom/unfunded-episode`, so it
couldn't be inserted inside a Read More block via the editor UI.

- Added `custom/unfunded-episode` to the `allowedBlocks` array in
  `src/read-more/index.js`'s `edit()`.
- Rebuilt (`pnpm run build`) so `build/read-more/index.js` — what
  `register_block_type()` actually loads — picks up the change.

No PHP or attribute changes needed; `custom/read-more` was already
registered and its script already enqueued unconditionally.

Editorial workflow going forward: keep the first Unfunded Episode card
as a standalone block, insert a Read More block right after it, and
move the remaining Unfunded Episode cards inside it (set its button
label to something like "Show More Episodes").

Known rough edge (pre-existing in `read-more.js`, not introduced here):
after the button is clicked once, its text permanently switches to the
hardcoded "Read Less" / "Read More" instead of reverting to the custom
button label on subsequent closes. **Fixed later the same day, see below.**

## 2026-08-30 — Read More block: custom labels now survive toggling

Fixes the rough edge noted just above. `read-more.js` hardcoded
`toggle.textContent = "Read More"` / `"Read Less"` on every click, so a
custom `buttonLabel` (e.g. "Show More Episodes") only ever showed until
the first click, then got permanently overwritten by the two generic
strings.

Kept "Read More"/"Read Less" as the script's own fallback default, but
gave each block instance a way to override both states:

- `src/read-more/index.js` — new `expandedButtonLabel` attribute (default
  `"Read Less"`), with its own RichText field in the editor ("Label when
  expanded:") next to the existing `buttonLabel` field. `save()` now also
  writes both labels onto the button as `data-label-collapsed` /
  `data-label-expanded`, in addition to keeping the existing visible
  `buttonLabel` text unchanged.
- `src/read-more.js` — reads `toggle.dataset.labelCollapsed` /
  `.labelExpanded` on click instead of hardcoding the strings, falling
  back to the same "Read More"/"Read Less" defaults when either is blank.
  Content saved before this change has no `data-label-*` attributes at
  all, so it falls through to those same defaults automatically — no
  re-saving needed, no visible change for existing Read More blocks that
  never touch the new field.

`pnpm run build` completed clean; not yet manually verified live in a
browser.

## 2026-08-30 — "All Stages" pseudo-stage for the Learning Hub search/browse

A coworker asked for an easy way to browse/search all Learning Hub content
without picking a Stage first. Discussed with Claude whether this belonged
on a homepage (main site front page vs. the `/learning/` hub landing page)
or a dedicated page — landed on a dedicated page reusing the existing
per-Stage search/browse machinery, since that's where the infrastructure
already lives and it doesn't compete with the homepage's own conversion
CTAs. This un-defers a decision from 2026-08-14 (see
[[be-bitesmart-content-hub-plan]]) that held off for the same reason noted
below.

Built exactly as originally scoped, mirroring the existing "Guide"
pseudo-stage pattern:

- `bitesmart_seed_all_stages_pseudo_term()`
  (`custom-post-types-for-bbs/includes/stage-taxonomy.php`) — new Stage
  taxonomy term "All Stages" (explicit slug `all`; `sanitize_title()` would
  otherwise default to `all-stages`). Never applied to any post — exists
  only to be selectable in `custom/learning-search`'s Stage dropdown.
- `bitesmart_build_stage_card_list()`
  (`custom-blocks-for-be-bite-smart/src/learning-search/learning-search.php`)
  — new `'all' === $stage_slug` branch: same post types (`qa_entry`,
  `resource`, `episode`, `coloring_book`, `guide_chapter`) as the normal
  per-Stage branch, but no `tax_query`, so it returns everything published
  regardless of Stage tagging. `guide_chapter` posts still render as the
  compact teaser card here, not the pooled accordion row (that only applies
  when `stage_slug === 'guide'` specifically).

No JS changes needed — both blocks' Stage dropdown already lists taxonomy
terms dynamically — and no cache-invalidation changes needed, since the
generation-counter bump already fires globally on any relevant post
save/taxonomy change. `php -l` clean on both files; no `pnpm run build`
needed (PHP-only).

**Not done in this change**: creating the actual live Page and placing the
block with "All Stages" selected — that's a manual wp-admin step, same as
the 4 real Stage pages, which per [[be-bitesmart-search-status]] aren't
placed live yet either.

**Flagged to Janet**: content is currently lopsided across stages
(Episodes default to Preschool on save), so the All Stages view will read
Preschool-heavy until more content exists for Pregnancy/Baby/Toddler —
same caveat the original 2026-08-14 deferral was based on.

## 2026-08-30 — Coloring Book removed from the Learning Hub search/browse listing

Janet's ask: stop coloring books showing up as individual cards in
`custom/learning-search`'s search/browse results — her plan is to group
them under one Q&A Entry instead. Same shape as Book's own removal from
this listing on 2026-08-28 (see that entry/[[be-bitesmart-book-cpt-status]]
in memory).

`bitesmart_build_stage_card_list()`
(`custom-blocks-for-be-bite-smart/src/learning-search/learning-search.php`)
no longer queries or renders `coloring_book` posts. Also removed from:
`bitesmart_stage_cards_maybe_bump()`'s tracked post types + its
`save_post_coloring_book` action hook; `bitesmart_stage_card_keywords()`'s
meta-key map; `bitesmart_stage_cards_template_version()`'s watched-files
list. Docblocks updated to match.

The `coloring_book` CPT itself, its taxonomies, `custom/coloring-book-fields`,
`custom/coloring-book`, and `custom/coloring-books-list` (Downloads page
listing) are untouched. `render_coloring_book_search_card()`
(coloring-book-display.php) is left in place, orphaned, in case the future
Q&A-entry work reuses it.

Verified against real local data via `wp-load.php`: neither of the 2 real
published coloring books appears in the `'all'` pseudo-stage list or in
either of their own real Stage lists (Preschool, Toddler); a simulated
coloring_book save no longer bumps the search cache's generation counter;
the `save_post_coloring_book` hook confirmed gone. `php -l` clean;
`pnpm run build` clean (PHP-only change, build wasn't strictly needed).

## 2026-08-30 — Coloring Book: remaining search-only plumbing removed (Stage, Media Type, Search Keywords, orphaned search card)

Immediate follow-up to the above, same session: Janet's ask to also strip
the Stage information and every other bit of machinery that only ever
existed for Coloring Book's now-gone Learning Hub search presence — the
orphaned leftovers from that removal. Same shape as Book's own equivalent
2026-08-30 cleanup pass.

Removed, all outright:
- **Stage taxonomy** detached from `coloring_book`
  (`custom-post-types-for-bbs/includes/coloring-book-cpt.php`), plus
  `bitesmart_default_coloring_book_stage_terms()` (the "defaults to both
  Toddler and Preschool" save hook). Any Stage terms already saved on
  existing coloring books are left untouched in the DB.
- **Media Type taxonomy** detached from `coloring_book` (same file), plus
  `bitesmart_default_coloring_book_media_type_term()` (the "Image"
  auto-default) and its entry in `media-type-taxonomy.php`'s one-time
  backfill map.
- **Search Keywords** — `_bitesmart_coloring_book_keywords_by_lang` meta +
  its sanitizer deleted from coloring-book-cpt.php; the "Search Keywords"
  per-language field removed from `custom/coloring-book-fields`
  (`coloring-book-fields/index.js`), along with its now-unused
  `keywords`/`setKeywords`/`languages` vars and `getSiteLanguages` import.
- **`render_coloring_book_search_card()`** (coloring-book-display.php) —
  flagged orphaned in the earlier removal, kept "just in case." Deleted for
  real this time, along with the two CSS rules
  (`shared/download-card/style.css`) that existed only for its Q&A-accordion
  shell. The shared `download-card-buttons--inline` class itself stays —
  still used by the generic `educational-*-download` blocks.

Topic and Series taxonomy attachment both stay on `coloring_book` — neither
is search-specific (Topic is general tagging, Series feeds this CPT's own
stable anchor id). Updated every stale comment elsewhere (learning-search.php,
custom-blocks-for-be-bite-smart.php) that still described the deleted
function or misattributed a still-needed global CSS enqueue to it (that
enqueue is actually for `render_coloring_book_block()`, via
`custom/coloring-books-list`, unrelated to search).

Verified via `wp-load.php`: `stage`/`media_type` both gone from
`get_object_taxonomies('coloring_book')` (`topic`/`series` still there), the
Keywords meta gone from `get_registered_meta_keys('post','coloring_book')`,
all four deleted functions confirmed gone via `function_exists()`, and both
real published coloring books still render correctly via
`render_coloring_book_block()`, plus the Downloads-page list block
(`render_coloring_books_list_block()`) still renders non-empty output.
`php -l` clean on every touched PHP file; `pnpm run build` clean — confirmed
via grep the removed Search Keywords strings are gone from the compiled
`build/coloring-book-fields/` output, JS/CSS both shrank slightly as
expected.

## 2026-08-30 — Book cover gets an accessible "View Larger Image" lightbox

Janet's ask: book covers render small on the page (max-width 160px); a
parent should have an easy, accessible way to see a bigger version.
Discussed the options first (button under the image vs. clicking the image
vs. both) — landed on both, weighted: a real, always-visible "View Larger
Image" `<button>` as the primary/reliable trigger (unambiguous for mouse,
touch, keyboard, and screen reader alike), plus the cover image itself is
also clickable as a free bonus shortcut for anyone who tries it
instinctively, not the only path in.

- **`bitesmart_book_cover_gallery()`** (book-display.php) unified: the old
  plain-cover-only path and the multi-slide-carousel path are now one path.
  Every book with a Featured Image gets the same `.book-card-cover.book-gallery`
  markup + inline JSON slide data, whether it has "Inside the Book" preview
  images or not — a book with none just gets a 1-slide array. This is what
  let the enlarge feature reach every cover, not just ones with previews,
  without tripling the branching logic. Each slide gained a `large` URL
  (new `bitesmart_book_large_image_url()`: 'large' → 'full' → the already-
  resolved 'medium' as a last resort) — the small inline cover/carousel
  still uses 'medium' only (bandwidth-conscious, unchanged), but the modal
  needed something bigger than that to actually look larger, not just
  blown-up and blurry.
- **New `src/book-display/gallery-modal.js`** — one accessible dialog
  shared by every `.book-gallery` on a page, built lazily on first open.
  Same singleton pattern as `video-lang-restart-modal.js` (focus-trapped
  panel, dismissible backdrop, body-scroll lock, focus restored to whatever
  triggered it on close) — reused that established shape rather than
  inventing a new one — adapted for browsing photos: a single visible
  "× Close" control (icon + real text label, never icon-only) instead of
  confirm/cancel buttons, Prev/Next photo navigation (reusing
  `.book-gallery-arrow`'s look, sized up to a 44px touch target) plus
  Left/Right arrow-key support, and a visible heading naming the book
  ("Photos from {title}", `{title}` substituted client-side — same
  `{placeholder}`-in-a-translatable-string idiom `video-lang-restart-modal.js`
  uses for `{language}`) doubling as the dialog's `aria-labelledby`.
- **`gallery.js`**: the "View Larger Image" button and the modal wiring are
  built entirely client-side (same reasoning as the existing Prev/Next
  arrows) — a visitor without JS sees only the plain cover image, never an
  inert control. The inline carousel's own `showSlide()` stays the single
  source of truth for "which slide is showing"; a new `updateGalleryModal()`
  call keeps the modal's image in sync if it's open, and the modal's own
  Prev/Next call back into that same `showSlide()` — no duplicate index
  state to keep in sync by hand.
- New translatable hidden strings (`enlarge`, `close`, `modalLabel`) added
  alongside the existing `prev`/`next` ones, same hidden-translatable-
  template idiom as `bitesmart_render_learning_search_strings()`.

Verified via a read-only `wp-load.php` script against all 6 real published
books (no DB writes) — confirmed correct `large` URLs (genuinely bigger
than `medium`, not silently falling back) for both books with preview
images (3 each) and, importantly, for all 4 books with none, confirming the
unification correctly extends the enlarge feature to plain covers too; all
5 hidden strings present; `render_book_block()` output unaffected
otherwise. `php -l` clean; `pnpm run build` clean, confirmed the new
strings/classes landed in `build/book-display/gallery.js` and
`style-index.css`. **Not yet manually verified live in-browser** — same
caveat as this CPT's other recent changes; the actual click/keyboard/focus-
trap behavior in a real browser still needs a look.

**Same-day fix, Janet's live-browser feedback**: the inline carousel's "1 / 4"
counter was overlapping the new "View Larger Image" button's text instead of
sitting at the bottom-right of the image. Root cause: the counter's
`bottom: 4px` was measuring from the bottom of the whole `.book-gallery`
wrapper, which now also contained the button flowing below the image — once
the button added height, `bottom: 4px` landed on the button, not the image.
Fix: new `.book-gallery-frame` div (book-display.php) wraps just the
`<img>` + arrows/counter; that's now the `position: relative` anchor
(style.css) instead of the outer wrapper, so the counter/arrows stay pinned
to the image's own corners regardless of what flows below. No JS changes
needed — gallery.js's selectors are all descendant queries, unaffected by
the extra nesting level. Re-verified via the same `wp-load.php` script
against all 6 real books; `php -l`/`pnpm run build` both clean.

## 2026-08-30 — Book Excerpt gets a "Read More"/"Read Less" toggle when long

Janet's ask: reuse the existing read-more.js logic so a long Book Excerpt
collapses behind a "Read More"/"Read Less" button instead of always
rendering in full.

- **New `bitesmart_book_excerpt_is_long()`** (book-display.php) — the only
  new logic needed. No existing code in this codebase auto-decides "is this
  content long enough to collapse" (custom/read-more, custom/article-or-commentary,
  and custom/press-release all apply the expandable-content treatment
  unconditionally, an editor's manual choice to use those blocks at all) —
  Book's Excerpt is dynamically rendered from CPT data with no such manual
  opt-in, so it needed a real threshold. Picked 500 characters of plain
  text by checking real data first: the 2 real long excerpts ran
  800-1800+ chars (worth collapsing), the 1 real short one sat at 370 (reads
  fine as-is) — see that day's `wp-load.php` check.
- **`render_book_block()`**: when long, the excerpt's already-rendered HTML
  (heading + blockquote together, from `bitesmart_book_content_sections()`,
  left completely untouched) is wrapped in
  `<div class="expandable-article-block book-card-excerpt-expandable">` +
  `.expandable-content` + a `.read-more-toggle.block-toggle-btn.is-style-outline`
  button — the exact same markup shape (`.expandable-article-block`/
  `.expandable-content`/`.read-more-toggle`) `custom/read-more`,
  `custom/article-or-commentary`, and `custom/press-release` already use,
  so the existing globally-enqueued `read-more.js` (`custom_blocks_scripts()`)
  picks it up with zero JS changes — it matches by class, not tag, so a
  `<div>` works exactly like their `<article>` does. A short excerpt
  (or one that's empty) renders exactly as before, no wrapper, no button.
- **New CSS** in book-display/style.css: the same `display:none` /
  `.expanded` toggle rules the other three blocks' own style.css copies
  already have (each owns its own copy — a pre-existing duplication in this
  codebase, not centralized, so this follows the same pattern rather than
  introducing a new shared-CSS mechanism). Deliberately NOT centered like
  those three (their cards read centered; Book's reads left-aligned
  throughout) — `.is-style-outline`'s own default layout already matches
  the Buy Links buttons above it, so no extra button styling was needed.
  Same `body:not(.block-editor-page)` guard, so the block editor's own
  ServerSideRender preview of `custom/book` always shows the excerpt in
  full, never collapsed.

Verified via `wp-load.php` against all 6 real books: the 2 long excerpts
(800/1781 chars) get the wrapper + toggle, the 1 short one (370 chars) and
the 3 empty ones don't — zero mismatches between `bitesmart_book_excerpt_is_long()`'s
verdict and what actually rendered. `php -l` clean; `pnpm run build` clean.
**Not yet manually verified live in-browser** — same standing caveat as
this CPT's other recent changes.

**Redesigned same day, Janet's feedback**: the version above put the ENTIRE
Excerpt behind Read More — what she actually wanted was some paragraphs
always visible, only the rest hidden. Length-threshold gating
(`bitesmart_book_excerpt_is_long()`) is gone; replaced by a real
paragraph-boundary split:

- **`bitesmart_book_content_sections()`'s return shape changed**: `excerpt`
  (one pre-fused HTML string) is now `excerpt_blocks` (array of
  individually-rendered paragraph/list blocks, in document order) — needed
  because splitting requires knowing where one paragraph ends and the next
  begins, which a single flattened HTML string can't answer safely.
  Deliberately never touches a block's own rendered HTML mid-string to get
  there — this project already has a real precedent for what goes wrong
  doing that (a regex-based `<p>` extraction silently dropped a whole list,
  same day, migrating this exact content — see [[be-bitesmart-book-cpt-status]]
  in memory). Summary is untouched (still one pre-fused string, no
  splitting asked for there).
- **New `bitesmart_book_excerpt_preview_split()`**: always keeps at least
  the first content block in the visible preview (however long — real data
  has a single 787-char paragraph with nothing else to hide behind, so it
  just renders in full, no button, rather than risk cutting into it), then
  keeps adding whole blocks to the preview while the running plain-text
  total stays under 400 chars; everything after that goes behind Read More.
  400 chars picked against the real 4-block excerpt (711/480/248/315 chars):
  splits into a 711-char preview (its own real opening paragraph) + 1048
  chars of list/paragraphs behind the button.
- **`render_book_block()`** now builds the heading + `<blockquote>` itself
  (mirroring custom/book-excerpt-section's own save() shape, rather than
  receiving it pre-built) so it can place the split correctly: heading
  always visible, ONE blockquote wrapping BOTH the preview paragraphs and
  the Read-More-collapsed remainder together (not two separate
  blockquotes) — keeps the existing quote-mark CSS decoration bracketing
  the whole thing correctly regardless of collapsed/expanded state, and
  avoids the exact nested-`<blockquote>` bug this project hit once before
  with an earlier Excerpt design (see memory doc).

Re-verified via `wp-load.php` against all 6 real books: the 4-block book
splits to a 711/1048 preview/hidden split with the wrapper+toggle present;
the two single-paragraph books (787 and 357 chars) both render fully
visible with no button; all three empty-excerpt books render nothing, as
before; every book's rendered HTML has exactly one `<blockquote>` (no
double-wrap regression) and the heading only appears when there's real
excerpt content. Zero mismatches between the split's `hidden` length and
whether a wrapper/button actually rendered. `php -l` clean; `pnpm run
build` clean.

## 2026-08-31 — Book gets a Pages field, Price/Availability removed

Janet's ask: add a "how many pages" field to the Book CPT, shown on the
card, and drop the existing freeform Price/Availability field ("$8.25 and
widely available") entirely — no replacement, just gone.

- **New `_bitesmart_book_pages` meta** (book-cpt.php) — plain positive
  integer, default `0`. New `bitesmart_sanitize_book_pages()` coerces
  anything not a positive whole number (blank, negative, non-numeric) to
  `0`, which `render_book_block()` treats as "not set" and skips the line
  entirely — same conditional-render posture every other optional Book
  field already uses here.
- **Removed `_bitesmart_book_price_availability` meta** (book-cpt.php)
  outright — deregistered, not left dormant, matching the precedent set by
  the Search Keywords removal (2026-08-30, see
  [[be-bitesmart-book-cpt-status]] in memory): there's no replacement field
  reading its old data, so unlike `_bitesmart_book_url` (kept registered as
  a genuine back-compat fallback for Buy Links) this one had nothing left
  to fall back to. Existing books' already-saved price text is untouched,
  orphaned data in the DB — confirmed via `wp-load.php` that real values
  ("$8.25 and widely available" on "How to Speak Dog", "$8.99..." on
  "Doggie Language", "$20.00 at Dogwise.com..." on "Canine Body Language")
  are still there but no longer registered/read/rendered anywhere.
- **Editor UI** (book-panel/index.js): the "Price / Availability"
  `TextControl` is now a "Pages" `TextControl` (`type="number"`, `min={0}`)
  in the exact same spot, right after the Audience radio group.
- **Front end** (book-display.php): `render_book_block()` swaps the old
  `$price_availability` conditional block for a `$pages > 0` one, using
  `_n()` for correct singular/plural ("1 page" / "32 pages") via
  `number_format_i18n()`. CSS class renamed `.book-card-price` →
  `.book-card-pages` (style.css), same styling (bold, same margin) reused
  as-is.
- Updated every doc comment that listed "Price/Availability" among Book's
  sidebar-panel fields to say "Pages" instead (book-cpt.php's file header,
  book-fields/index.js's hint text/comment, book-panel/book-panel.php,
  book-display's block.json description) — no functional effect, just
  keeping the file-header field inventories accurate per this project's
  own convention.

Verified via `wp-load.php` (read-only): `_bitesmart_book_pages` present in
`get_registered_meta_keys('post','book')`, `_bitesmart_book_price_availability`
gone from it; `bitesmart_sanitize_book_pages()` checked against `'32'`, `32`,
`'0'`, `''`, `'-5'`, `'abc'`, `'12.7'`, `null` — all coerce correctly; all 6
real published books render with no `.book-card-price` markup (confirming
the old field is fully gone from output) and no `.book-card-pages` markup
today (none has a pages value set yet); a temporary `get_post_metadata`
filter (no DB write) confirmed the new line renders correctly once a value
IS set, both singular (`1` → "1 page") and plural (`32` → "32 pages").
`php -l` clean on all three touched PHP files; `pnpm run build` clean,
confirmed `book_pages` present and `price_availability` fully absent from
the compiled `build/book-panel/index.js`.

**Not yet manually verified live in-browser** — same outstanding category
as this CPT's other recent changes; Janet should open a book in wp-admin,
set a Pages value, and confirm it appears correctly on the card.

**Same day, follow-up: "Where to Buy" heading added above Buy Links** —
Janet's ask. `render_book_block()` (book-display.php) now prints
`<h4 class="book-card-section-heading">Where to Buy</h4>` immediately before
`.book-card-buy-links`, only when there's at least one buy link. Reuses the
existing `.book-card-section-heading` class verbatim (the same one Book
Excerpt's own heading uses) — that rule was already scoped generically
(`.wp-block-custom-book .book-card-section-heading`, not excerpt-specific),
so this is an exact style match with zero new CSS. PHP-only change, no
build step. Verified via `wp-load.php` against all 6 real books: the
heading renders immediately above the buttons for the 4 books that have buy
links, and is correctly absent for the 2 that don't.

**Same day, second follow-up: Buy Links centered + Pages styling redesigned**
— two more of Janet's asks after seeing the card live:
- `.book-card-buy-links` (style.css) gained `justify-content: center` to
  match the now-centered "Where to Buy" heading above it (that heading's
  centering came for free from the shared `.book-card-section-heading`
  rule, added earlier the same day).
- The Pages line looked like "plain bold black text" next to the colored
  Audience badge — out of place. Presented 3 styling directions (muted meta
  text / a second pill badge matching Audience's shape / an uppercase label
  matching the section headings); Janet picked muted meta text, plus a
  wording change from "32 pages" to "Pages: 32". `render_book_block()`
  (book-display.php) now uses `__( 'Pages: %s', ... )` instead of `_n()`
  (no longer needs singular/plural forms with this wording). `.book-card-pages`
  (style.css) dropped its bold black-on-white look for `font-weight: 400`,
  `font-size: 0.9em`, and `color: var(--wp--preset--color--accent-4, #475966)`
  — reusing the same slate-gray accent the Younger Children badge already
  uses, no new color introduced.

Verified via `wp-load.php`: simulated Pages values render as "Pages: 1" and
"Pages: 128" (a temporary `get_post_metadata` filter, no DB write); the
buy-links wrapper markup is unchanged (centering is CSS-only, confirmed
present in the compiled `build/book-display/style-index.css`). `php -l`
clean; `pnpm run build` clean.

**Same day, third follow-up: "Length" wording + new Target Audience field
replaces the Audience-enum card badge** — two more of Janet's asks:

- **Pages line reworded**: "Pages: 32" → "**Length: 32 pages**"
  (`render_book_block()`, book-display.php) — back to `_n()` for correct
  singular/plural ("Length: 1 page" / "Length: 176 pages").
- **New `_bitesmart_book_target_audience` meta** (book-cpt.php) — plain
  freeform text (`sanitize_text_field`), default `''`, genuinely optional.
  Janet's own framing: the existing Audience badge on the card just
  repeated the same words as the group heading a book already sits under
  on the grouped Books List page (e.g. a card under "For Adults" ALSO
  saying "Adults") — redundant. **Audience itself
  (`_bitesmart_book_audience`, the 4-value enum) is untouched** and still
  drives Books List grouping (books-list.php) — this is a genuinely
  separate field, not a rename/replacement of it.
- **Editor UI**: new "Target Audience" `TextControl` in
  `book-panel/index.js`, placed directly below the existing Audience
  `RadioControl` (e.g. "Ages 4-7", "New puppy owners"), placeholder notes
  it's optional and hides the badge when blank.
- **`bitesmart_book_audience_badge()` → `bitesmart_book_target_audience_badge()`**
  (book-display.php, renamed since its whole meaning changed): now reads
  `_bitesmart_book_target_audience` and returns `''` (no markup at all)
  when blank — UNLIKE the old badge, which was always rendered regardless
  of value. `.book-audience-badge` (style.css) dropped its four
  per-audience-value color modifier classes (`.is-younger-children` /
  `.is-older-children` / `.is-adult` / `.is-all-ages`, now dead code since
  the badge shows arbitrary text, not one of 4 fixed values) in favor of
  one flat accent-2 blue, matching this card's other UI (View Larger
  Image button, Buy Links).
- Updated every stale doc comment that described the old badge/enum
  relationship (book-cpt.php, books-list.php).

Verified via `wp-load.php`: new meta registered, old badge function
confirmed gone (`function_exists()` false), new one present; a temporary
`get_post_metadata` filter (no DB write) confirmed blank/set/HTML-special-char
values all render (or correctly don't render) the badge properly, and
Length shows "1 page"/"176 pages" correctly. **Unplanned but very welcome
real-world validation**: Janet had already started using the field live in
wp-admin while this was being verified — one real book ("May I Pet Your
Dog?") already had "4 - 7 years old" saved as its Target Audience and `32`
as its Pages, both picked up correctly by `render_book_block()` with no
further action needed (the PHP meta registration takes effect immediately
on save with no build step; the JS build for the new panel field had
already completed by then). `php -l` clean on all three touched PHP files;
`pnpm run build` clean.

**Same day, fourth follow-up: Pages field rejects non-numeric text with an
explicit error + Book Excerpt's Read More button centered**

- **Pages validation** (book-panel/index.js): Janet's ask — force Pages to
  be a real number and explain if it isn't, rather than silently letting
  invalid text through. Switched from a native `type="number"` input to a
  plain, fully JS-controlled `TextControl` (`inputMode: "numeric"` for the
  mobile numeric keypad) — a native number input's handling of invalid
  typed text is inconsistent enough across browsers (it often just reports
  an empty string back) to reliably catch and explain the problem, so this
  needed real control over the raw string instead. New `pagesInput` local
  state holds exactly what's typed (synced from meta once, on first
  resolve, via the same ref-guarded-effect idiom the Buy Links legacy-URL
  prefill already uses); `handlePagesChange()` validates on every keystroke
  — blank clears to `0`, `^\d+$` saves the parsed number, anything else
  sets a `pagesError` flag and leaves the stored meta untouched (so an
  in-progress bad value never gets silently written) while a
  `Notice status="error"` explains why. The server-side sanitizer
  (`bitesmart_sanitize_book_pages()`, book-cpt.php, unchanged) stays as a
  defense-in-depth backstop for anything that bypasses this UI (e.g. a
  direct REST call) — confirmed still coerces the same invalid cases to
  `0` as before.
- **Read More button centered** (style.css): Janet's ask. New
  `.wp-block-custom-book .book-card-excerpt-expandable .read-more-toggle`
  rule using the exact `display:block; margin:auto; width:fit-content`
  idiom `article-or-commentary/style.css`'s own Read More button already
  uses. Removed the stale "deliberately NOT centered, Book reads
  left-aligned throughout" comment this rule used to carry — no longer
  true since Buy Links became centered earlier the same day.

Verified via `wp-load.php`: server-side sanitizer re-checked against 9
cases (unchanged behavior); the one real book with Pages already set
("May I Pet Your Dog?", 32) confirmed untouched. `php -l` clean; `pnpm run
build` clean, confirmed the new error copy and the centering rule both
landed in the compiled build. **Not yet manually verified live in-browser**
— the editor-side validation flow (typing letters, seeing the error, then
correcting it) needs a real look, same outstanding category as this CPT's
other recent changes.

**Same day, two real bugs fixed (Janet's live testing caught both)**

1. **Read More still wasn't centered after a hard refresh.** Root cause:
   the centering rule added earlier lost a CSS specificity fight against
   the theme's own global button rule
   (`twentytwentyfive-child/style.css`: `body:not(.block-editor-page)
   :is(.block-toggle-btn, ...) { display: inline-flex; ... }`). That rule's
   real specificity is higher than it looks — `:is()`'s specificity is
   computed from its MOST specific branch (`.wp-block-file
   .wp-element-button`, 2 classes) regardless of which branch actually
   matches, plus the `body` type selector, working out to (0 id, 3 class, 1
   type) — beating the earlier fix's plain (0, 3, 0). Nothing to do with
   caching (confirmed the hard refresh was real). **Fix**: matched
   `article-or-commentary/style.css`'s own already-working copy of this
   exact rule, adding the same `body:not(.block-editor-page)` prefix +
   type-selector shape, bringing this rule to (0, 4, 1) — an outright win,
   not a tie needing `!important`.
2. **A cover-only book's "View Larger Image" modal showed Prev/Next arrows
   for its one and only photo.** `gallery-modal.js`'s `renderModalSlide()`
   already correctly set `hidden` on the arrow buttons for a 1-slide book —
   the bug was CSS: the base `.book-gallery-arrow { display: flex; ... }`
   rule is a normal-priority AUTHOR rule, and author rules always beat the
   UA stylesheet's own `[hidden] { display: none }` rule regardless of
   specificity (a lower cascade ORIGIN, not a specificity loss this time).
   **Fix**: added `.book-gallery-arrow[hidden] { display: none; }`
   (style.css), the same explicit pattern this file already uses for
   `.book-gallery-modal[hidden]`. Confirmed via `wp-load.php` this is a
   real, live scenario, not hypothetical — "Doggy Do's & Don'ts" has a
   cover and zero "Inside the Book" preview images today.

`pnpm run build` clean; confirmed both fixed rules present in the compiled
`build/book-display/style-index.css`. **Not yet manually verified live in
wp-admin/front-end** by Janet since these fixes — both were diagnosed from
her live report + the theme's compiled CSS, not from a browser session on
this end.

## 2026-08-31 — Books List: Show More/Show Less per Audience group

**What it does and why it was needed:** with 4 Audience groups on `/learning/books/` and each one growing as books got added throughout the day, Janet asked to show only the first book per group by default, with a Show More/Show Less toggle to reveal the rest — and for a hyperlink into a specific group to land with everything already visible, not collapsed.

**Changes:**
- [plugins/custom-blocks-for-be-bite-smart/src/books-list/books-list.php](plugins/custom-blocks-for-be-bite-smart/src/books-list/books-list.php) `render_books_list_block()`: splits each group's (already-ordered) cards into the first card (always shown) and the rest, wrapping the rest in the same `.expandable-article-block`/`.expandable-content`/`.read-more-toggle` markup Book Excerpt's own Read More already uses (`read-more.js`, enqueued site-wide) — reused verbatim, no new JS mechanism. Custom `data-label-collapsed`/`-expanded` set the button's wording to "Show More"/"Show Less" rather than the shared default "Read More"/"Read Less". The block's pre-existing `id="books-list-{audience}"` wrapper (unchanged) doubles as the link target for a group.
- [plugins/custom-blocks-for-be-bite-smart/src/books-list/style.css](plugins/custom-blocks-for-be-bite-smart/src/books-list/style.css) (new file): the actual `display:none`/`.expanded{display:block}` + button-centering rules, scoped to `.wp-block-custom-books-list` — mirrors `book-display/style.css`'s own Book Excerpt rules exactly, including that rule's documented `body:not(.block-editor-page)` + real-class-chain specificity requirement (needed to beat the theme's global `.block-toggle-btn` rule). Wired into the build via `import "./style.css"` in index.js + `"style": "file:./style-index.css"` in block.json, matching book-display's own established convention for a per-block stylesheet.
- [plugins/custom-blocks-for-be-bite-smart/src/read-more.js](plugins/custom-blocks-for-be-bite-smart/src/read-more.js) (shared, used by 4 blocks total): added hash-based auto-expand — on page load, if the URL's `#fragment` matches or contains a collapsed `.expandable-article-block`, it's opened automatically. Deliberately generalized rather than books-list-specific: a link straight at a single book's own anchor (`bitesmart_book_anchor_id()`, book-display.php) now also auto-opens that book's own Excerpt Read More, for free.
- **Lazy covers, same day, follow-up:** `display:none` alone doesn't stop a real `<img src>` from downloading — every hidden card's cover was loading regardless of whether Show More was ever clicked. New `bitesmart_books_list_make_cover_lazy()` (books-list.php) renames a hidden card's cover `src` to `data-src` via a narrow, anchored regex (safe here specifically because it only ever runs against `render_book_block()`'s own generated markup, not arbitrary editor content — a different situation from the regex-on-real-content bug this project hit once before, see [[be-bitesmart-book-cpt-status]]). `read-more.js`'s `expand()` hydrates any `img[data-src]` back to `src` the instant a section actually opens (click or hash), before revealing it.
- **Layout-shift fix, same day:** `bitesmart_book_cover_gallery()` (book-display.php) switched from `wp_get_attachment_image_url()` to `wp_get_attachment_image_src()` and now puts the attachment's real intrinsic `width`/`height` on the cover `<img>` tag (covers vary in aspect ratio book to book, so a fixed CSS ratio wasn't an option). Combined with the existing `max-width:160px; height:auto` CSS, the browser now reserves each cover's correct height before the file has downloaded. Applies everywhere a cover renders — eager, lazy, and the standalone `custom/book` block alike, since all three share this one function.

**Real bug found and fixed, same day:** Janet reported the Adults group's Show More button doing nothing on click. Root cause: the Adults group happens to contain a book whose own Excerpt is long enough to trigger *its own* Read More toggle — the first time anywhere in this codebase that one `.expandable-article-block` ended up nested inside another's `.expandable-content`. `read-more.js`'s `article.querySelector(".read-more-toggle")` matches the *first* descendant in document order, which was the nested book's button (it sits earlier in the DOM than the group's own button) — so the group's click listener got attached to the wrong element, and the real visible "Show More" button had no listener at all. **Fix:** scoped both lookups to direct children only (`:scope > .read-more-toggle` / `:scope > .expandable-content`) in both `expand()` and `init()`. Verified against the real DOM structure via a `DOMDocument`/`DOMXPath` simulation (not just reasoning about it): confirmed the old bare-descendant search resolved to the nested book's "Read More" button, and the `:scope >`-scoped search correctly resolves to "Show More". Only the Adults group hits this today (confirmed via a script checking all 4 groups for nested Excerpt toggles), but nothing stops another group from growing into it later — the fix protects all 4 regardless.

**Verification:** `php -l` clean on all touched PHP files; `pnpm run build` clean, confirmed `:scope` and the new CSS present in the compiled output. Verified against real book data throughout (not synthetic fixtures) — correct card counts, correct eager/lazy split (exactly 1 real `src` per group, matching the visible card), correct width/height per cover across covers with genuinely different aspect ratios, and the `:scope` fix's DOM-resolution simulated directly against real rendered output for the Adults group specifically. **Not yet manually verified live in-browser** — the actual click/expand/collapse interaction, the hash-deep-link auto-open, and the fixed Adults toggle all still need a real look; same caveat as every other interactive feature this project has shipped without a browser on hand to check it in.

**Commit range or PR link:** not yet committed — Janet commits manually per existing convention on this branch.
