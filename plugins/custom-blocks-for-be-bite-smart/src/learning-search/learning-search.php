<?php
/**
 * Render callback + shared supporting logic for the "custom/learning-search"
 * block AND its sibling "custom/learning-browse" block
 * (src/learning-browse/learning-browse.php).
 *
 * Placed once per Stage archive page (e.g. /learning/stages/preschool/),
 * with a Stage picked in the block's editor UI (index.js) — see
 * [[be-bitesmart-content-hub-plan]] in memory.
 *
 * UNTIL 2026-08-16 this file's render_learning_search_block() alone
 * produced BOTH (a) a client-side search box AND (b) a paginated "browse
 * everything" list below it. Split into two blocks that day, per Janet: the
 * pooled Guide search page's "All Chapters" browse list was a pointless
 * duplicate of custom/guide-single's own chapter list (at /learning/guide/
 * — see guide-single.php), and on
 * real Stage pages the browse list disappearing while a visitor searched
 * (and being fully rebuilt via innerHTML at JS init) coupled its lifecycle
 * to the search box's for no good reason — she wanted it genuinely
 * persistent and independently stylable instead. render_learning_search_block()
 * below now handles ONLY the search box; render_learning_browse_block()
 * (learning-browse.php) handles the type-filter checkboxes + persistent
 * browse list, as a second block placed alongside this one. BOTH still call
 * bitesmart_build_stage_card_list() below independently (cheap — same
 * transient cache, a hit if the sibling block already populated it for this
 * Stage+language) and BOTH still reuse the same render_qa_entry_block()/
 * render_resource_block()/etc. functions for card HTML — none of that
 * changed, only which block emits which section of markup.
 *
 * Built from the SAME underlying data: every Q&A Entry / Resource / Episode
 * post tagged with this block's Stage, each rendered through an EXISTING
 * render function — render_qa_entry_block() / render_resource_block() (see
 * qa-entry-display.php / resource-display.php) as-is, and, for Episode, the
 * compact render_episode_search_card() (episode-display.php) rather than
 * that file's full video-player render_episode_block() — not reimplemented
 * here. That reuse is deliberate: those functions already call
 * get_the_title() / get_post_meta() the same way any other embedded
 * custom/qa-entry or custom/resource block on the site does, so whatever
 * TranslatePress translation already happens for those blocks elsewhere on
 * the site happens here too, for free, with no separate translation step
 * to build.
 *
 * The search box reuses the exact same rendered card HTML: the full
 * per-Stage list (not just the current page) is embedded once as a
 * <script type="application/json"> blob in the page output (see
 * bitesmart_render_learning_search_data() below), and view.js runs Fuse.js
 * over it entirely in the browser — no REST endpoint, no fetch, no second
 * translation path. A search "result" is just one of these same
 * already-rendered, already-translated card HTML strings being shown.
 *
 * "Show: [x] Video [x] Short Answer [x] Article [x] Image" type-filter
 * checkboxes (see bitesmart_render_learning_search_type_filter() below)
 * render in BOTH this block's AND custom/learning-browse's own output as of
 * 2026-08-16 (own copy each, all checked by default) — Janet wanted the
 * filter usable from the search block alone, without needing the browse
 * block present. view.js and browse.js each keep every copy on the page in
 * sync and both re-apply their own filtering whenever ANY copy changes — one
 * consistent setting, not independently-behaving filters, same idea as the
 * "Show video/text" bar's own cross-block sync (format-toggle.js).
 *
 * As of 2026-08-28 this filter runs on the `media_type` taxonomy
 * (Video/Short Answer/Article/Image — see includes/media-type-taxonomy.php
 * in the CPT plugin) instead of post type (Q&A/Resource/Episode/etc.) — a
 * card matches a checked box if it carries ANY of the enabled Media Types,
 * since a single post can carry more than one (see
 * bitesmart_learning_search_media_type_labels() below).
 *
 * Known v1 limitation (confirmed acceptable with Janet): the plain-text
 * search-matching corpus for each card is built from the CURRENT request's
 * rendered HTML (so it's translated when TranslatePress is active) plus
 * that entry's per-language Synonyms/Keywords meta. If a language's
 * Synonyms/Keywords haven't been filled in yet, matching for that language
 * falls back to whatever's in the rendered title/answer text.
 */

/**
 * This block renders custom/qa-entry + custom/resource cards by calling
 * render_qa_entry_block()/render_resource_block() directly (see
 * bitesmart_build_stage_card_list() below) rather than through WordPress's
 * normal block-rendering pipeline — necessary, since these cards come from
 * a WP_Query, not from literal custom/qa-entry or custom/resource block
 * markup sitting in this page's content. The cost: WordPress's automatic
 * "scan this page's saved content for which blocks it uses, enqueue their
 * block.json-declared styles" never sees either block as being present, so
 * their own style.css (qa-entry-display/resource-display — the marker-
 * hiding, chevron layout/rotation, etc.) never loads, even though the HTML
 * renders correctly and the shared theme accent-card CSS still applies
 * (that one's enqueued globally regardless of what's on the page). Declare
 * the dependency by hand instead.
 *
 * Hooked to wp_enqueue_scripts (the same early timing WordPress's own
 * automatic per-block enqueue uses), NOT called from inside
 * render_learning_search_block() itself — that function runs during content
 * rendering, well after wp_head() has already printed, so enqueuing there
 * would be too late for the stylesheet to actually end up on the page.
 *
 * generate_block_asset_handle() (same helper already used in
 * site-lang.php's bitesmart_localize_video_language_editors()) gets the
 * exact handle WordPress auto-generated when custom/qa-entry's and
 * custom/resource's block.json were registered on init — no guessing at
 * the handle string.
 *
 * Episode cards (render_episode_search_card() in episode-display.php)
 * mostly reuse custom/qa-entry's own markup/classes rather than
 * custom/episode's, so qa-entry's style handle (enqueued below) covers most
 * of their look — EXCEPT the thumbnail/Q&A-description layout added
 * 2026-08-28 (.episode-search-card-thumbnail/-description), which lives in
 * custom/episode's own style.css instead (episode-display/style.css) — see
 * that file's own comment. That's why 'custom/episode' is now in the array
 * below too, alongside qa-entry/resource, even though this card's markup
 * still isn't custom/episode's own card markup.
 */
function bitesmart_learning_search_enqueue_card_styles() {
    if ( ! function_exists( 'generate_block_asset_handle' ) ) {
        return;
    }
    // custom/learning-browse (learning-browse.php) also renders these same
    // card types (via its own browse list), so it needs this enqueue just
    // as much as custom/learning-search does — see the file-level comment
    // above for the 2026-08-16 split.
    if ( ! has_block( 'custom/learning-search' ) && ! has_block( 'custom/learning-browse' ) ) {
        return;
    }

    foreach ( array( 'custom/qa-entry', 'custom/resource', 'custom/episode' ) as $block_name ) {
        $handle = generate_block_asset_handle( $block_name, 'style' );
        if ( wp_style_is( $handle, 'registered' ) ) {
            wp_enqueue_style( $handle );
        }
    }
}
add_action( 'wp_enqueue_scripts', 'bitesmart_learning_search_enqueue_card_styles' );

/**
 * Bump a generation counter used in transient cache keys — the simplest way
 * to invalidate every cached Stage+language card list at once without a
 * wildcard transient delete (WordPress has no such API; transients are just
 * prefixed options). Old-generation transients are simply never read again
 * and expire on their own via the max lifetime passed to set_transient().
 */
function bitesmart_stage_cards_bump_generation() {
    $gen = (int) get_option( 'bitesmart_stage_cards_gen', 1 );
    update_option( 'bitesmart_stage_cards_gen', $gen + 1, false );
}

/**
 * Invalidate the cache when a Q&A Entry, Resource, Episode, Coloring Book,
 * or Guide Chapter is saved (including status transitions —
 * draft/publish/trash all fire save_post) or when its Stage/Topic terms
 * change independently of a full save (e.g. quick-edit). Episode is
 * included because it's shown in this list too now — see
 * render_episode_search_card() in episode-display.php and its use in
 * bitesmart_build_stage_card_list() below. Coloring Book is included for
 * the same reason (see render_coloring_book_search_card() in
 * coloring-book-display.php) AND because
 * bitesmart_build_downloads_page_card_list() (coloring-books-list.php)
 * deliberately reuses this same generation counter for its own,
 * differently-scoped cache — see that function's header comment. Guide
 * Chapter is included for the same reason as Episode/Coloring Book (see
 * render_guide_chapter_search_card() in guide-chapter-display.php) — a
 * chapter's Stage terms changing matters here twice over: it can change
 * which REAL Stage's list it appears in, AND (since every chapter also
 * auto-carries the "Guide" pseudo-stage term — see
 * [[be-bitesmart-guide-cpt-plan]] in memory) editing a chapter always
 * affects the pooled Guide-pseudo-stage list too. Book is included for the
 * same reason as Episode/Coloring Book (see render_book_search_card() in
 * book-display.php).
 */
function bitesmart_stage_cards_maybe_bump( $post_id, $post = null ) {
    $post_type = $post ? $post->post_type : get_post_type( $post_id );
    if ( in_array( $post_type, array( 'qa_entry', 'resource', 'episode', 'coloring_book', 'guide_chapter', 'book' ), true ) ) {
        bitesmart_stage_cards_bump_generation();
    }
}
add_action( 'save_post_qa_entry', 'bitesmart_stage_cards_maybe_bump', 10, 2 );
add_action( 'save_post_resource', 'bitesmart_stage_cards_maybe_bump', 10, 2 );
add_action( 'save_post_episode', 'bitesmart_stage_cards_maybe_bump', 10, 2 );
add_action( 'save_post_coloring_book', 'bitesmart_stage_cards_maybe_bump', 10, 2 );
add_action( 'save_post_guide_chapter', 'bitesmart_stage_cards_maybe_bump', 10, 2 );
add_action( 'save_post_book', 'bitesmart_stage_cards_maybe_bump', 10, 2 );
add_action( 'delete_post', 'bitesmart_stage_cards_maybe_bump' );

function bitesmart_stage_cards_maybe_bump_terms( $object_id, $terms, $tt_ids, $taxonomy ) {
    // 'series' is included because it feeds an Episode card's "Watch
    // Episode" link (bitesmart_episode_anchor_id() in episode-display.php)
    // — changing it changes that rendered href, even though nothing about
    // it is visible page text. 'media_type' is included (2026-08-28) because
    // it now drives which "Filter by type" checkbox(es) a card matches — see
    // bitesmart_build_stage_card_list()'s 'mediaTypes' below.
    if ( in_array( $taxonomy, array( 'stage', 'topic', 'series', 'media_type' ), true ) ) {
        bitesmart_stage_cards_maybe_bump( $object_id );
    }
}
add_action( 'set_object_terms', 'bitesmart_stage_cards_maybe_bump_terms', 10, 4 );

/**
 * Per-language search-matching Synonyms/Keywords for one post, plain
 * string, '' if none filled in for that language. Reads whichever of the
 * per-language meta keys applies to the post's type — Q&A Entry's
 * (`_bitesmart_qa_synonyms_by_lang`), Episode's
 * (`_bitesmart_episode_keywords_by_lang`, added 2026-08-13) and Guide
 * Chapter's (`_bitesmart_chapter_keywords_by_lang`) all feed this exact
 * same mechanism, so a Synonyms/Keywords match works identically for all
 * three — this already covers Episode and Guide Chapter, not just Q&A
 * Entry, with no extra wiring. Episode's and Guide Chapter's fields were
 * labeled "Keywords" in the editing UI until 2026-08-28, when they were
 * relabeled "Synonyms" to match Q&A Entry's naming (meta keys unchanged).
 * Resource keeps the "Keywords" label (a deliberately different field, not
 * renamed). Book's (`_bitesmart_book_keywords_by_lang`) added the same way,
 * 2026-08-16.
 *
 * @param int    $post_id Post ID.
 * @param string $type    'qa_entry', 'resource', 'episode', 'coloring_book', 'guide_chapter', or 'book'.
 * @param string $lang    Short language code.
 * @return string
 */
function bitesmart_stage_card_keywords( $post_id, $type, $lang ) {
    $meta_keys = array(
        'qa_entry'      => '_bitesmart_qa_synonyms_by_lang',
        'resource'      => '_bitesmart_resource_keywords_by_lang',
        'episode'       => '_bitesmart_episode_keywords_by_lang',
        'coloring_book' => '_bitesmart_coloring_book_keywords_by_lang',
        'guide_chapter' => '_bitesmart_chapter_keywords_by_lang',
        'book'          => '_bitesmart_book_keywords_by_lang',
    );

    if ( ! isset( $meta_keys[ $type ] ) ) {
        return '';
    }

    $by_lang = get_post_meta( $post_id, $meta_keys[ $type ], true );
    if ( ! is_array( $by_lang ) ) {
        return '';
    }

    return isset( $by_lang[ $lang ] ) ? (string) $by_lang[ $lang ] : '';
}

/**
 * Cache-key ingredient covering the render TEMPLATES themselves, not just
 * content — bitesmart_stage_cards_gen (bumped by save_post/set_object_terms,
 * see above) only tracks Q&A/Resource CONTENT changes. Without this, editing
 * render_qa_entry_block()/render_resource_block() (e.g. the accent-card
 * styling, or the <details>/<summary> chevron) would leave the OLD rendered
 * HTML sitting in cache indefinitely, since nothing about a template edit
 * touches a post or its terms. Using each file's mtime means any future
 * template change auto-invalidates this cache too, with nothing to remember
 * to bump by hand.
 *
 * @return string
 */
function bitesmart_stage_cards_template_version() {
    $files = array(
        __DIR__ . '/../qa-entry-display/qa-entry-display.php',
        __DIR__ . '/../resource-display/resource-display.php',
        __DIR__ . '/../episode-display/episode-display.php', // holds render_episode_search_card() too, not just render_episode_block()
        __DIR__ . '/../coloring-book-display/coloring-book-display.php', // holds render_coloring_book_search_card() too, not just render_coloring_book_block()
        __DIR__ . '/../guide-chapter-display/guide-chapter-display.php', // holds render_guide_chapter_search_card()/render_guide_chapter_pooled_card() too, not just bitesmart_render_guide_chapter_row()
        __DIR__ . '/../book-display/book-display.php', // holds render_book_search_card() too, not just render_book_block()
        __FILE__, // this file's own bitesmart_build_stage_card_list() builds each card's SHAPE (id/type/mediaTypes/html/searchText), not just its 'html' — added 2026-08-28 when 'mediaTypes' was added, after a stale-cache Undefined-array-key warning on 'mediaTypes' surfaced: a cache built by the OLD version of this function (no 'mediaTypes' key) was still valid by generation-counter/other-templates' mtimes, so it kept being served as-is. Same reasoning as every other file in this array, just easy to miss since this file authors the array shape rather than any one card's HTML.
    );

    $stamps = array_map(
        function ( $file ) {
            return file_exists( $file ) ? filemtime( $file ) : 0;
        },
        $files
    );

    return implode( '-', $stamps );
}

/**
 * Build (or fetch from cache) the full, ordered list of rendered cards for
 * one Stage, in the current request's language. Every Q&A Entry + Resource
 * + Episode + Coloring Book + Guide Chapter + Book published and tagged with
 * $stage_slug, alphabetical by title. Book is included as a compact card
 * (see render_book_search_card() in book-display.php) with no Stage
 * default of its own — an editor tags it manually, since which Stage(s)
 * fit varies a lot per book. Episode is included as a compact
 * Question/title card (see render_episode_search_card() in
 * episode-display.php), not its full video-player embed — Episodes already
 * default to the Preschool stage term on save (see episode-cpt.php), so
 * this "just works" for the Preschool page's search/browse list without
 * any extra tagging. Coloring Book, unlike Episode, embeds its actual
 * Download buttons inline (see render_coloring_book_search_card() in
 * coloring-book-display.php) rather than linking out — no stage default,
 * since coloring books aren't necessarily Preschool-specific. Guide
 * Chapter is the one type whose rendering DIFFERS by which Stage this is:
 * on a REAL Stage (this function's `else` branch below), it renders a
 * compact teaser (see render_guide_chapter_search_card() in
 * guide-chapter-display.php), same "link out to the real thing" idea as
 * Episode/Coloring Book, added 2026-08-16 once a chapter's video/format
 * logic got heavy enough that Janet wanted it minimized on a mixed-content
 * Stage page; on the pooled Guide pseudo-stage (`'guide' === $stage_slug`
 * branch below), it renders the FULL accordion row instead (see
 * render_guide_chapter_pooled_card() in guide-chapter-display.php) — see
 * [[be-bitesmart-guide-cpt-plan]] in memory for the full "why" either way.
 *
 * $stage_slug === 'guide' (the pooled multi-Guide search page) is handled
 * as its own query branch below, NOT via the normal tax_query path — an
 * earlier version tried to make every chapter carry a "Guide" pseudo-stage
 * TERM so the normal tax_query path could return them "for free", but that
 * depended on wp_set_object_terms() actually being called for a chapter's
 * Stage at least once, which only happens if an editor touches that
 * post's Stage panel at all — a brand-new chapter whose Stage panel is
 * never opened never gets the term applied, so it silently never showed up
 * on the pooled page (real bug Janet hit and diagnosed herself). Querying
 * `post_type => 'guide_chapter'` directly with no tax_query at all is both
 * simpler and can't have that failure mode — EVERY published chapter shows
 * on the pooled page unconditionally, full stop, nothing to tag or forget
 * to tag. The "Guide" Stage TERM itself still exists
 * (bitesmart_seed_guide_stage_term(), stage-taxonomy.php) purely so it's
 * selectable in custom/learning-search's own Stage dropdown (index.js) —
 * it's just no longer read by this query.
 *
 * @param string $stage_slug Stage taxonomy term slug.
 * @param string $lang       Short language code (bitesmart_site_lang_code()).
 * @return array<int, array{id:int, type:string, mediaTypes:array<int,string>, html:string, searchText:string}>
 */
function bitesmart_build_stage_card_list( $stage_slug, $lang ) {
    $gen = (int) get_option( 'bitesmart_stage_cards_gen', 1 );
    $cache_key = 'bitesmart_stage_cards_' . md5( $stage_slug . '|' . $lang . '|' . $gen . '|' . bitesmart_stage_cards_template_version() );

    $cached = get_transient( $cache_key );
    if ( is_array( $cached ) ) {
        return $cached;
    }

    if ( 'guide' === $stage_slug ) {
        // Every published chapter, unconditionally — see the header
        // comment above for why this bypasses tax_query entirely rather
        // than filtering by a "Guide" pseudo-stage term.
        $query = new WP_Query( array(
            'post_type'      => 'guide_chapter',
            'post_status'    => 'publish',
            'posts_per_page' => -1,
            'orderby'        => 'title',
            'order'          => 'ASC',
            'no_found_rows'  => true,
        ) );
    } else {
        $query = new WP_Query( array(
            'post_type'      => array( 'qa_entry', 'resource', 'episode', 'coloring_book', 'guide_chapter', 'book' ),
            'post_status'    => 'publish',
            'posts_per_page' => -1,
            'orderby'        => 'title',
            'order'          => 'ASC',
            'no_found_rows'  => true,
            'tax_query'      => array(
                array(
                    'taxonomy' => 'stage',
                    'field'    => 'slug',
                    'terms'    => $stage_slug,
                ),
            ),
        ) );
    }

    $cards = array();

    foreach ( $query->posts as $post ) {
        if ( 'qa_entry' === $post->post_type ) {
            $html = render_qa_entry_block( array( 'entryId' => $post->ID ) );
        } elseif ( 'resource' === $post->post_type ) {
            $html = render_resource_block( array( 'resourceId' => $post->ID ) );
        } elseif ( 'coloring_book' === $post->post_type ) {
            $html = render_coloring_book_search_card( array( 'coloringBookId' => $post->ID ) );
        } elseif ( 'book' === $post->post_type ) {
            $html = render_book_search_card( array( 'bookId' => $post->ID ) );
        } elseif ( 'guide_chapter' === $post->post_type ) {
            // Full accordion row on the pooled Guide pseudo-stage (every
            // result there IS a chapter); a compact link-out teaser on a
            // real Stage, where a chapter is at most a small slice of
            // mixed content — see this function's own header comment and
            // each render function's docblock (guide-chapter-display.php).
            $html = ( 'guide' === $stage_slug )
                ? render_guide_chapter_pooled_card( array( 'chapterId' => $post->ID ) )
                : render_guide_chapter_search_card( array( 'chapterId' => $post->ID ) );
        } else {
            $html = render_episode_search_card( array( 'episodeId' => $post->ID ) );
        }

        if ( ! $html ) {
            continue; // shouldn't happen for a just-queried published post, but render_*_block() can still return '' defensively.
        }

        $keywords    = bitesmart_stage_card_keywords( $post->ID, $post->post_type, $lang );
        $search_text = trim( wp_strip_all_tags( $html ) . ' ' . $keywords );

        // Media Type slugs (Video/Short Answer/Article/Image — see
        // includes/media-type-taxonomy.php in the CPT plugin), 2026-08-28.
        // This is what the "Filter by type" checkboxes now match against
        // (bitesmart_render_learning_search_type_filter() below and
        // getEnabledTypes() in view.js/browse.js) — replaces the OLD filter,
        // which matched on $post->post_type directly. 'type' (post type) is
        // kept on the card too, since bitesmart_stage_card_keywords() above
        // still needs it and it costs nothing extra to carry.
        $media_types = wp_get_post_terms( $post->ID, 'media_type', array( 'fields' => 'slugs' ) );
        if ( is_wp_error( $media_types ) ) {
            $media_types = array();
        }

        $cards[] = array(
            'id'         => $post->ID,
            'type'       => $post->post_type,
            'mediaTypes' => $media_types,
            'html'       => $html,
            'searchText' => $search_text,
        );
    }

    // Cached for up to a day as a safety net even if a bump somehow got
    // missed — the generation counter is what actually keeps this fresh in
    // the normal case (a new generation means a brand new cache key).
    set_transient( $cache_key, $cards, DAY_IN_SECONDS );

    return $cards;
}

/**
 * The inline search-data blob view.js reads to build its Fuse.js index —
 * every card for this Stage (not just the current browse page), since
 * search has to be able to find anything on any page. Deliberately NOT a
 * REST endpoint / fetch() call: embedding it directly in the page's own
 * HTML means it's already in the language the page rendered in (see file
 * header) and costs no extra request.
 *
 * @param array  $cards      From bitesmart_build_stage_card_list().
 * @param string $instance_id Unique-per-block-instance DOM id.
 */
function bitesmart_render_learning_search_data( array $cards, $instance_id ) {
    $payload = array_map(
        function ( $card ) {
            return array(
                'id'         => $card['id'],
                'type'       => $card['type'],
                // '?? array()' guards a stale transient cache built by an
                // older version of bitesmart_build_stage_card_list() that
                // predates this key — see bitesmart_stage_cards_template_version()'s
                // 2026-08-28 comment. Without it, a stale card would embed
                // no 'mediaTypes' at all in this page's JSON blob, and
                // view.js/browse.js's card.mediaTypes.some(...) would throw
                // in the browser (TypeError: Cannot read properties of
                // undefined) instead of just treating that card as
                // type-less.
                'mediaTypes' => $card['mediaTypes'] ?? array(),
                'html'       => $card['html'],
                'searchText' => $card['searchText'],
            );
        },
        $cards
    );
    ?>
    <script type="application/json" id="<?php echo esc_attr( $instance_id ); ?>-data" class="learning-search-data">
        <?php
        // JSON_HEX_TAG escapes < and > (as < / >) so a card's
        // rendered HTML — which is what most of this payload consists of —
        // can never accidentally close this <script> tag early, even in
        // the unlikely event some content literally contains "</script>".
        echo wp_json_encode( $payload, JSON_HEX_TAG );
        ?>
    </script>
    <?php
}

/**
 * Media Type slug => checkbox label, in the fixed order the type-filter
 * checkboxes always render — see bitesmart_render_learning_search_type_filter()
 * below. Replaces the OLD per-post-type label map (Q&A/Resources/Episodes/
 * etc.) as of 2026-08-28 — the filter now runs on the `media_type` taxonomy
 * (includes/media-type-taxonomy.php, CPT plugin) instead of post type, so a
 * card can match more than one checkbox (e.g. a Q&A Entry that's both
 * "Short Answer" and, once it embeds one, "Video"). One place to add a label
 * if a new Media Type term is ever added to
 * bitesmart_seed_media_type_terms().
 *
 * @return array<string, string> Term slug => label.
 */
function bitesmart_learning_search_media_type_labels() {
    return array(
        'video'        => __( 'Video', 'custom-blocks' ),
        'short-answer' => __( 'Short Answer', 'custom-blocks' ),
        'article'      => __( 'Article', 'custom-blocks' ),
        'image'        => __( 'Image', 'custom-blocks' ),
    );
}

/**
 * "Show: [x] Video [x] Short Answer [x] Article [x] Image" checkboxes — all
 * checked by default, unchecking one hides any card that carries ONLY
 * unchecked types from BOTH the live Fuse.js search results AND the browse
 * list below (view.js/browse.js each read these via
 * .learning-search-type-checkbox/data-type). Deliberately JS-only, same as
 * the search box itself doing nothing without JS — no server-side GET-param
 * fallback, so as not to duplicate the filtering logic in two places for a
 * feature that's an enhancement on top of an already fully-JS-dependent
 * live search.
 *
 * Called from BOTH custom/learning-search's and custom/learning-browse's
 * render callbacks as of 2026-08-16 (each independently, own copy — same
 * "each block works correctly on its own" reasoning as
 * bitesmart_render_guide_format_controls()) — the legend text is
 * deliberately generic ("Filter by type", not "...the list below...")
 * since it no longer only ever sits above a list. view.js and browse.js
 * keep every copy's checked state in sync with each other and both re-apply
 * their own filtering whenever ANY copy changes, the same way
 * format-toggle.js already keeps multiple "Show video/text" bars in sync.
 *
 * Only rendered when this Stage actually has 2+ distinct Media Types present
 * across its cards — a single checkbox with nothing to compare against isn't
 * a useful filter, and no checkboxes at all when $cards is empty (nothing to
 * filter).
 *
 * @param array<int, array{id:int, type:string, mediaTypes:array<int,string>, html:string, searchText:string}> $cards
 * @return void
 */
function bitesmart_render_learning_search_type_filter( array $cards ) {
    // array_map() with a '?? array()' fallback rather than
    // wp_list_pluck( $cards, 'mediaTypes' ) — wp_list_pluck() reads
    // $item['mediaTypes'] directly with no isset() guard, which throws an
    // "Undefined array key" warning against a stale transient cache built by
    // an older version of bitesmart_build_stage_card_list() that predates
    // this key (see bitesmart_stage_cards_template_version()'s own
    // 2026-08-28 comment on why that shouldn't happen going forward, but
    // this is a free extra guard against the same class of bug next time a
    // card field is added). array() prepended as a guaranteed first argument
    // to array_merge() — array_merge(...$x) with an empty $cards (nothing
    // added for this Stage yet) would otherwise spread to zero arguments,
    // which throws ArgumentCountError in PHP 8.
    $present_types = array_unique( array_merge( array(), ...array_map(
        function ( $card ) {
            return $card['mediaTypes'] ?? array();
        },
        $cards
    ) ) );
    if ( count( $present_types ) < 2 ) {
        return;
    }

    ?>
    <?php /* The border/divider look lives on THIS wrapper, not the <fieldset> below — a <fieldset> with a <legend> child natively "cuts a notch" out of its own top border where the legend sits (that's how a fieldset caption is meant to render). With the legend forced to 100% width so it stacks on its own line, that notch would span the fieldset's entire top edge and hide the border completely. Keeping <fieldset>/<legend> for their real accessibility grouping semantics, just not for this visual treatment. */ ?>
    <div class="learning-search-type-filter-wrap">
        <fieldset class="learning-search-type-filter">
            <legend class="learning-search-type-filter-legend"><?php esc_html_e( 'Filter by type', 'custom-blocks' ); ?></legend>
            <?php foreach ( bitesmart_learning_search_media_type_labels() as $type => $label ) : ?>
                <?php if ( in_array( $type, $present_types, true ) ) : // don't offer an "Image" checkbox on a Stage with none, etc. ?>
                    <label class="learning-search-type-toggle">
                        <input type="checkbox" class="learning-search-type-checkbox" data-type="<?php echo esc_attr( $type ); ?>" checked>
                        <?php echo esc_html( $label ); ?>
                    </label>
                <?php endif; ?>
            <?php endforeach; ?>
        </fieldset>
    </div>
    <?php
}

/**
 * All 8 hidden, TranslatePress-translatable status/pagination strings, in
 * one place — same technique as bitesmart_render_video_lang_name_templates()
 * and friends in site-lang.php: dynamic JS-built strings aren't reliably
 * translatable by TranslatePress, but static rendered HTML (even
 * display:none) is, since TP translates whatever text renders on the page.
 * Split from a single always-emit-everything function into a catalog +
 * bitesmart_render_learning_search_strings() (below) on 2026-08-16, when
 * search-only vs. browse-only keys ended up needing to live in two
 * DIFFERENT blocks' output (custom/learning-search vs.
 * custom/learning-browse) — this catalog is the one place the actual
 * English/translator text lives, so neither block's copy can drift from
 * the other's.
 *
 * @return array<string, string> Key => already-translated (esc_html__()) text.
 */
function bitesmart_learning_search_string_catalog() {
    return array(
        'no-results'              => esc_html__( 'No matches found for "{query}".', 'custom-blocks' ),
        'results-count-one'       => esc_html__( '1 result', 'custom-blocks' ),
        'results-count-other'     => esc_html__( '{count} results', 'custom-blocks' ),
        'browse-empty-filtered'   => esc_html__( 'Nothing matches the selected filters.', 'custom-blocks' ),
        'browse-prev'             => esc_html__( 'Previous', 'custom-blocks' ),
        'browse-next'             => esc_html__( 'Next', 'custom-blocks' ),
        'browse-page-status'      => esc_html__( 'Page {current} of {total}', 'custom-blocks' ),
        'browse-pagination-label' => esc_html__( 'Questions & Resources pages', 'custom-blocks' ),
    );
}

/**
 * Emits only the requested subset of bitesmart_learning_search_string_catalog()
 * — custom/learning-search passes just its 3 search-relevant keys,
 * custom/learning-browse (learning-browse.php) passes its 5 browse-relevant
 * ones, so neither block ships hidden markup for strings it never reads.
 *
 * @param string             $instance_id
 * @param array<int, string> $keys Which catalog keys to emit, in order.
 */
function bitesmart_render_learning_search_strings( $instance_id, array $keys ) {
    $catalog = bitesmart_learning_search_string_catalog();
    ?>
    <div class="learning-search-strings" aria-hidden="true" style="display:none;">
        <?php foreach ( $keys as $key ) : ?>
            <?php if ( isset( $catalog[ $key ] ) ) : ?>
                <span class="learning-search-string" data-key="<?php echo esc_attr( $key ); ?>"><?php echo $catalog[ $key ]; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already esc_html__()'d in the catalog ?></span>
            <?php endif; ?>
        <?php endforeach; ?>
    </div>
    <?php
}

/**
 * Render callback for "custom/learning-search" — the search box + live
 * Fuse.js results, as of the 2026-08-16 split (see the file-level comment
 * above). Also renders its own copy of the type-filter checkboxes above the
 * search box (added same day, see the call site below) — the paginated
 * "browse everything" list itself still lives only in the sibling
 * custom/learning-browse block (learning-browse.php) — place both, same
 * Stage, on a real Stage page; place only this one on the pooled Guide
 * search page (Stage=Guide), where a persistent "All Chapters" list would
 * just duplicate custom/guide-single's own chapter list at /learning/guide/
 * (Stage=Guide never has 2+ distinct card types anyway, so its type filter
 * never renders regardless).
 */
function render_learning_search_block( $attributes ) {
    $stage_slug = isset( $attributes['stageSlug'] ) ? sanitize_title( $attributes['stageSlug'] ) : '';

    if ( ! $stage_slug ) {
        // No Stage chosen yet — only editors/admins see a hint on the live
        // page; ordinary visitors just see nothing, same as an unresolved
        // custom/resource or custom/qa-entry block.
        if ( current_user_can( 'edit_posts' ) ) {
            return '<p class="learning-search-unconfigured">' .
                esc_html__( 'Learning Hub Search: choose a Stage in the block settings.', 'custom-blocks' ) .
                '</p>';
        }
        return '';
    }

    $lang        = bitesmart_site_lang_code();
    $cards       = bitesmart_build_stage_card_list( $stage_slug, $lang );
    $instance_id = 'learning-search-' . $stage_slug;

    ob_start();
    ?>
    <section class="wp-block-custom-learning-search learning-search-block" id="<?php echo esc_attr( $instance_id ); ?>" data-stage="<?php echo esc_attr( $stage_slug ); ?>" data-lang="<?php echo esc_attr( $lang ); ?>" data-rest-url="<?php echo esc_url( rest_url( 'bitesmart/v1/zero-result-search' ) ); ?>" data-rest-nonce="<?php echo esc_attr( wp_create_nonce( 'wp_rest' ) ); ?>">

        <?php
        // Own copy of the type filter, above the search box — 2026-08-16,
        // per Janet: it used to live only in the sibling custom/learning-
        // browse block, but she wanted it repeated here too so a visitor
        // narrowing by type doesn't need the browse block present/visible
        // to filter the live search results. view.js/browse.js keep every
        // copy of these checkboxes on the page in sync with each other and
        // both react when ANY copy changes — see
        // bitesmart_render_learning_search_type_filter()'s own comment.
        bitesmart_render_learning_search_type_filter( $cards );

        // Only rendered on the pooled Guide pseudo-stage (stage_slug ===
        // 'guide'), where the card list is 100% chapters — never on a real
        // Stage page, where chapters are at most a small slice of mixed
        // content and a global "Show video/text" control would apply to
        // almost nothing on screen. Real Stage pages rely solely on each
        // chapter's own per-chapter badges (guide-chapter-display.php)
        // instead. See bitesmart_render_guide_format_controls().
        if ( 'guide' === $stage_slug ) {
            echo bitesmart_render_guide_format_controls(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- own trusted markup
        }
        ?>

        <div class="learning-search-box" role="search">
            <?php
            /*
             * No visible heading rendered here as of 2026-08-16 — Janet
             * adds her own Heading block above this block in the page
             * editor instead, for full styling control. That heading isn't
             * reliably reachable by id from this block's PHP (a manually
             * placed block, no guaranteed anchor), so the input's
             * accessible name comes from a plain, generic aria-label
             * instead of aria-labelledby — the visible page heading above
             * still gives sighted AND screen-reader users the real
             * "Search {Stage}" context via normal reading order, this is
             * just the form control's own fallback name.
             */
            ?>
            <p id="<?php echo esc_attr( $instance_id ); ?>-hint"><?php esc_html_e( 'Type to search (e.g. "growling")', 'custom-blocks' ); ?></p>
            <div class="learning-search-input-wrap">
                <input
                    type="search"
                    id="<?php echo esc_attr( $instance_id ); ?>-input"
                    class="learning-search-input"
                    autocomplete="off"
                    aria-label="<?php esc_attr_e( 'Search', 'custom-blocks' ); ?>"
                    aria-describedby="<?php echo esc_attr( $instance_id ); ?>-hint"
                />
                <button type="button" class="learning-search-clear" aria-label="<?php esc_attr_e( 'Clear search', 'custom-blocks' ); ?>" hidden>
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                        <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"></line>
                        <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"></line>
                    </svg>
                </button>
            </div>
            <p class="learning-search-status" aria-live="polite"></p>
            <?php /* Deliberately no aria-live here — results is rich, multi-card content (headings, links, an accordion each); making it a live region would have screen readers try to re-announce all of that on every keystroke's re-render. The concise status text above ("3 results") is the one thing that should be announced live. */ ?>
            <div class="learning-search-results"></div>
        </div>

        <?php bitesmart_render_learning_search_data( $cards, $instance_id ); ?>
        <?php bitesmart_render_learning_search_strings( $instance_id, array( 'no-results', 'results-count-one', 'results-count-other' ) ); ?>
    </section>
    <?php
    return ob_get_clean();
}
