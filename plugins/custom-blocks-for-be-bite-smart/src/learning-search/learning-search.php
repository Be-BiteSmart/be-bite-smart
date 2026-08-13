<?php
/**
 * Render callback + supporting logic for the "custom/learning-search" block.
 *
 * Placed once per Stage archive page (e.g. /learning/stages/preschool/),
 * with a Stage picked in the block's editor UI (index.js). Combines the two
 * things the content hub plan calls for on that page — see
 * [[be-bitesmart-content-hub-plan]] in memory:
 *
 *   (a) a client-side search box, and
 *   (b) below it, a paginated list (10/page) of ALL Q&A Entries + Resources
 *       tagged with that Stage, for parents who don't want to search.
 *
 * Both are built from the SAME underlying data: every Q&A Entry / Resource
 * post tagged with this block's Stage, each rendered through the EXISTING
 * render_qa_entry_block() / render_resource_block() functions (see
 * qa-entry-display.php / resource-display.php) — not reimplemented here.
 * That reuse is deliberate: those functions already call get_the_title() /
 * get_post_meta() the same way any other embedded custom/qa-entry or
 * custom/resource block on the site does, so whatever TranslatePress
 * translation already happens for those blocks elsewhere on the site
 * happens here too, for free, with no separate translation step to build.
 *
 * The (b) paginated list is genuinely server-rendered and cached (a
 * transient per Stage+language, invalidated only when Q&A/Resource content
 * actually changes — see bitesmart_stage_cards_bump_generation() below) —
 * NOT regenerated on every page view. Pagination itself is plain
 * `?bs_page=N` links, no JS required.
 *
 * The (a) search box reuses the exact same rendered card HTML: the full
 * per-Stage list (not just the current page) is embedded once as a
 * <script type="application/json"> blob in the page output (see
 * bitesmart_render_learning_search_data() below), and view.js runs Fuse.js
 * over it entirely in the browser — no REST endpoint, no fetch, no second
 * translation path. A search "result" is just one of these same
 * already-rendered, already-translated card HTML strings being shown.
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
 */
function bitesmart_learning_search_enqueue_card_styles() {
    if ( ! function_exists( 'generate_block_asset_handle' ) || ! has_block( 'custom/learning-search' ) ) {
        return;
    }

    foreach ( array( 'custom/qa-entry', 'custom/resource' ) as $block_name ) {
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
 * Invalidate the cache when a Q&A Entry or Resource is saved (including
 * status transitions — draft/publish/trash all fire save_post) or when its
 * Stage/Topic terms change independently of a full save (e.g. quick-edit).
 */
function bitesmart_stage_cards_maybe_bump( $post_id, $post = null ) {
    $post_type = $post ? $post->post_type : get_post_type( $post_id );
    if ( in_array( $post_type, array( 'qa_entry', 'resource' ), true ) ) {
        bitesmart_stage_cards_bump_generation();
    }
}
add_action( 'save_post_qa_entry', 'bitesmart_stage_cards_maybe_bump', 10, 2 );
add_action( 'save_post_resource', 'bitesmart_stage_cards_maybe_bump', 10, 2 );
add_action( 'delete_post', 'bitesmart_stage_cards_maybe_bump' );

function bitesmart_stage_cards_maybe_bump_terms( $object_id, $terms, $tt_ids, $taxonomy ) {
    if ( in_array( $taxonomy, array( 'stage', 'topic' ), true ) ) {
        bitesmart_stage_cards_maybe_bump( $object_id );
    }
}
add_action( 'set_object_terms', 'bitesmart_stage_cards_maybe_bump_terms', 10, 4 );

/**
 * Per-language search-matching keywords for one post, plain string,
 * '' if none filled in for that language. Reads whichever of the two
 * per-language meta keys applies to the post's type.
 *
 * @param int    $post_id Post ID.
 * @param string $type    'qa_entry' or 'resource'.
 * @param string $lang    Short language code.
 * @return string
 */
function bitesmart_stage_card_keywords( $post_id, $type, $lang ) {
    $meta_key = 'qa_entry' === $type
        ? '_bitesmart_qa_synonyms_by_lang'
        : '_bitesmart_resource_keywords_by_lang';

    $by_lang = get_post_meta( $post_id, $meta_key, true );
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
 * published and tagged with $stage_slug, alphabetical by title.
 *
 * @param string $stage_slug Stage taxonomy term slug.
 * @param string $lang       Short language code (bitesmart_site_lang_code()).
 * @return array<int, array{id:int, type:string, html:string, searchText:string}>
 */
function bitesmart_build_stage_card_list( $stage_slug, $lang ) {
    $gen = (int) get_option( 'bitesmart_stage_cards_gen', 1 );
    $cache_key = 'bitesmart_stage_cards_' . md5( $stage_slug . '|' . $lang . '|' . $gen . '|' . bitesmart_stage_cards_template_version() );

    $cached = get_transient( $cache_key );
    if ( is_array( $cached ) ) {
        return $cached;
    }

    $query = new WP_Query( array(
        'post_type'      => array( 'qa_entry', 'resource' ),
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

    $cards = array();

    foreach ( $query->posts as $post ) {
        if ( 'qa_entry' === $post->post_type ) {
            $html = render_qa_entry_block( array( 'entryId' => $post->ID ) );
        } else {
            $html = render_resource_block( array( 'resourceId' => $post->ID ) );
        }

        if ( ! $html ) {
            continue; // shouldn't happen for a just-queried published post, but render_*_block() can still return '' defensively.
        }

        $keywords    = bitesmart_stage_card_keywords( $post->ID, $post->post_type, $lang );
        $search_text = trim( wp_strip_all_tags( $html ) . ' ' . $keywords );

        $cards[] = array(
            'id'         => $post->ID,
            'type'       => $post->post_type,
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
 * Hidden, TranslatePress-translatable source of truth for the two status
 * messages view.js builds dynamically (result count / no-results) — same
 * technique as bitesmart_render_video_lang_name_templates() and friends in
 * site-lang.php: dynamic JS-built strings aren't reliably translatable by
 * TranslatePress, but static rendered HTML (even display:none) is, since TP
 * translates whatever text renders on the page.
 */
function bitesmart_render_learning_search_strings( $instance_id ) {
    ?>
    <div class="learning-search-strings" aria-hidden="true" style="display:none;">
        <span class="learning-search-string" data-key="no-results"><?php esc_html_e( 'No matches found for "{query}".', 'custom-blocks' ); ?></span>
        <span class="learning-search-string" data-key="results-count-one"><?php esc_html_e( '1 result', 'custom-blocks' ); ?></span>
        <span class="learning-search-string" data-key="results-count-other"><?php esc_html_e( '{count} results', 'custom-blocks' ); ?></span>
    </div>
    <?php
}

/**
 * Render callback for "custom/learning-search".
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

    $stage_term = get_term_by( 'slug', $stage_slug, 'stage' );
    $stage_name = $stage_term ? $stage_term->name : $stage_slug;
    $lang       = bitesmart_site_lang_code();
    $cards      = bitesmart_build_stage_card_list( $stage_slug, $lang );
    $instance_id = 'learning-search-' . $stage_slug;

    $per_page    = 10;
    $total       = count( $cards );
    $total_pages = max( 1, (int) ceil( $total / $per_page ) );
    $page        = isset( $_GET['bs_page'] ) ? absint( wp_unslash( $_GET['bs_page'] ) ) : 1; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only pagination, no state change
    $page        = max( 1, min( $page, $total_pages ) );
    $page_cards  = array_slice( $cards, ( $page - 1 ) * $per_page, $per_page );

    ob_start();
    ?>
    <section class="wp-block-custom-learning-search learning-search-block" id="<?php echo esc_attr( $instance_id ); ?>" data-stage="<?php echo esc_attr( $stage_slug ); ?>">

        <div class="learning-search-box">
            <label class="learning-search-label" for="<?php echo esc_attr( $instance_id ); ?>-input">
                <?php
                /* translators: %s: Stage name, e.g. "Preschool" */
                printf( esc_html__( 'Search %s Questions & Resources', 'custom-blocks' ), esc_html( $stage_name ) );
                ?>
            </label>
            <input
                type="search"
                id="<?php echo esc_attr( $instance_id ); ?>-input"
                class="learning-search-input"
                placeholder="<?php esc_attr_e( 'Type to search (e.g. "growling")', 'custom-blocks' ); ?>"
                autocomplete="off"
            />
            <p class="learning-search-status" aria-live="polite"></p>
            <div class="learning-search-results" aria-live="polite"></div>
        </div>

        <?php bitesmart_render_learning_search_data( $cards, $instance_id ); ?>
        <?php bitesmart_render_learning_search_strings( $instance_id ); ?>

        <div class="learning-search-browse">
            <h3 class="learning-search-browse-heading">
                <?php
                /* translators: %s: Stage name, e.g. "Preschool" */
                printf( esc_html__( 'All %s Questions & Resources', 'custom-blocks' ), esc_html( $stage_name ) );
                ?>
            </h3>

            <?php if ( empty( $page_cards ) ) : ?>
                <p class="learning-search-empty"><?php esc_html_e( 'Nothing has been added for this Stage yet.', 'custom-blocks' ); ?></p>
            <?php else : ?>
                <div class="learning-search-browse-list">
                    <?php foreach ( $page_cards as $card ) : ?>
                        <?php echo $card['html']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already-escaped HTML from render_qa_entry_block()/render_resource_block() ?>
                    <?php endforeach; ?>
                </div>

                <?php if ( $total_pages > 1 ) : ?>
                    <nav class="learning-search-pagination" aria-label="<?php esc_attr_e( 'Questions & Resources pages', 'custom-blocks' ); ?>">
                        <?php if ( $page > 1 ) : ?>
                            <a class="learning-search-page-link learning-search-prev" href="<?php echo esc_url( add_query_arg( 'bs_page', $page - 1 ) . '#' . $instance_id ); ?>">
                                <?php esc_html_e( 'Previous', 'custom-blocks' ); ?>
                            </a>
                        <?php endif; ?>

                        <span class="learning-search-page-status">
                            <?php
                            printf(
                                /* translators: 1: current page, 2: total pages */
                                esc_html__( 'Page %1$d of %2$d', 'custom-blocks' ),
                                (int) $page,
                                (int) $total_pages
                            );
                            ?>
                        </span>

                        <?php if ( $page < $total_pages ) : ?>
                            <a class="learning-search-page-link learning-search-next" href="<?php echo esc_url( add_query_arg( 'bs_page', $page + 1 ) . '#' . $instance_id ); ?>">
                                <?php esc_html_e( 'Next', 'custom-blocks' ); ?>
                            </a>
                        <?php endif; ?>
                    </nav>
                <?php endif; ?>
            <?php endif; ?>
        </div>
    </section>
    <?php
    return ob_get_clean();
}
