<?php
/**
 * Render callback + caching for "custom/coloring-books-list" — placed once
 * on /learning/downloads/, auto-lists every published Coloring Book post
 * (see coloring-book-display.php's render_coloring_book_block() for the
 * per-item card) so a new coloring book appears there the moment it's
 * published — no page-editing step, per Janet's 2026-08-13 requirement
 * (see [[be-bitesmart-downloads-planning]] in memory).
 *
 * Cached, not regenerated on every page view — same generation-counter +
 * transient pattern as bitesmart_build_stage_card_list() in
 * learning-search.php (see that function's own comment for the full
 * rationale). Deliberately reuses THAT SAME counter
 * (bitesmart_stage_cards_gen) rather than inventing a second one: Coloring
 * Book is already in that counter's bump list (see
 * bitesmart_stage_cards_maybe_bump() in learning-search.php), so a
 * publish/edit/trash there invalidates this cache for free, with one
 * shared invalidation clock to reason about instead of two. This file only
 * READS the option (get_option), so it has no load-order dependency on
 * learning-search.php.
 */

/**
 * Cache-key ingredient covering the render TEMPLATE itself — same reasoning
 * as bitesmart_stage_cards_template_version() in learning-search.php:
 * without this, editing bitesmart_render_coloring_book_card() would leave
 * stale rendered HTML sitting in cache indefinitely.
 *
 * @return string
 */
function bitesmart_downloads_page_template_version() {
    $files = array(
        __DIR__ . '/../coloring-book-display/coloring-book-display.php',
        __FILE__,
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
 * Sorts Coloring Books by Episode Number ascending (1, 2, 3, ... — compared
 * numerically, not alphabetically, so "10" doesn't sort before "2"),
 * matching the order the episodes themselves air in.
 *
 * Episode Number is optional (see its help text in
 * coloring-book-fields/index.js), so this can't just be a WP_Query
 * meta_key/orderby=meta_value_num — that does an implicit join on the meta
 * key and would silently drop any Coloring Book that doesn't have one from
 * the results entirely. Since this block's whole point is showing EVERY
 * published Coloring Book (see bitesmart_build_downloads_page_card_list()'s
 * own comment), un-numbered books sort after every numbered one instead —
 * alphabetically by title among themselves, the same order this list used
 * before Episode Number ordering existed.
 *
 * @param WP_Post $a
 * @param WP_Post $b
 * @return int
 */
function bitesmart_coloring_book_list_order_cmp( $a, $b ) {
    $a_number = get_post_meta( $a->ID, '_bitesmart_coloring_book_episode_number', true );
    $b_number = get_post_meta( $b->ID, '_bitesmart_coloring_book_episode_number', true );

    $a_numeric = is_numeric( $a_number );
    $b_numeric = is_numeric( $b_number );

    if ( $a_numeric && $b_numeric ) {
        return (float) $a_number <=> (float) $b_number;
    }

    if ( $a_numeric !== $b_numeric ) {
        return $a_numeric ? -1 : 1;
    }

    return strcasecmp( get_the_title( $a ), get_the_title( $b ) );
}

/**
 * Build (or fetch from cache) the full, ordered list of rendered coloring
 * book cards, in the current request's language. Every Coloring Book
 * published, ordered by Episode Number ascending (see
 * bitesmart_coloring_book_list_order_cmp()) — unlike
 * bitesmart_build_stage_card_list(), NOT filtered by Stage:
 * /learning/downloads/ is meant to be the one place every coloring book
 * lives, regardless of which Stage(s) it's also tagged with for search
 * purposes.
 *
 * @param string $lang Short language code (bitesmart_site_lang_code()) — part of the cache key only; the card markup itself has no language branching of its own (PDFs are just EN/ES URLs, not translated text), but TranslatePress still needs a fresh cache per language since the button labels ("View PDF (ENG)", etc.) are translatable strings.
 * @return array<int, string> Rendered card HTML, one per Coloring Book.
 */
function bitesmart_build_downloads_page_card_list( $lang ) {
    $gen       = (int) get_option( 'bitesmart_stage_cards_gen', 1 );
    $cache_key = 'bitesmart_downloads_page_' . md5( $lang . '|' . $gen . '|' . bitesmart_downloads_page_template_version() );

    $cached = get_transient( $cache_key );
    if ( is_array( $cached ) ) {
        return $cached;
    }

    $query = new WP_Query( array(
        'post_type'      => 'coloring_book',
        'post_status'    => 'publish',
        'posts_per_page' => -1,
        'no_found_rows'  => true,
    ) );

    $posts = $query->posts;
    usort( $posts, 'bitesmart_coloring_book_list_order_cmp' );

    $cards = array();
    foreach ( $posts as $post ) {
        $html = render_coloring_book_block( array( 'coloringBookId' => $post->ID ) );
        if ( $html ) {
            $cards[] = $html;
        }
    }

    // Cached for up to a day as a safety net even if a bump somehow got
    // missed — the generation counter is what actually keeps this fresh in
    // the normal case (a new generation means a brand new cache key).
    set_transient( $cache_key, $cards, DAY_IN_SECONDS );

    return $cards;
}

/**
 * Render callback for "custom/coloring-books-list".
 */
/**
 * Outer chrome (rounded-border card + "Downloadable Coloring Books" accent
 * banner) baked directly into this block's own render output, rather than
 * left for an editor to hand-recreate as a native Group block every time.
 * Matches, field for field, the hand-authored markup the old manually
 * placed set of educational-coloring-book-download blocks used to sit
 * inside (anchor id "download-coloring-books" included) — Janet wanted the
 * page to look exactly the same after switching to the auto-listing
 * block. Baking it in here (rather than documenting "wrap this block in a
 * Group styled like X") means there's nothing for an editor to get
 * slightly wrong — border color, radius, and banner copy stay in sync
 * automatically, and the block still needs no page-editing step per entry.
 */
function render_coloring_books_list_block( $attributes ) {
    $lang  = bitesmart_site_lang_code();
    $cards = bitesmart_build_downloads_page_card_list( $lang );

    ob_start();
    ?>
    <div id="download-coloring-books" class="wp-block-custom-coloring-books-list wp-block-group has-border-color" style="border-color:#e1e8f1;border-width:2px;border-top-left-radius:2rem;border-top-right-radius:2rem;border-bottom-left-radius:2rem;border-bottom-right-radius:2rem;padding-right:0;padding-left:0">
        <div class="wp-block-group has-accent-2-background-color has-background" style="border-top-left-radius:27px;border-top-right-radius:27px;margin-top:0;margin-bottom:0;padding-top:var(--wp--preset--spacing--40);padding-right:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--40);padding-left:var(--wp--preset--spacing--60)">
            <h3 class="wp-block-heading has-base-color has-text-color has-link-color"><strong><?php esc_html_e( 'Downloadable Coloring Books', 'custom-blocks' ); ?></strong></h3>
            <p class="has-base-color has-text-color has-link-color" style="padding-right:0;padding-left:0"><?php esc_html_e( 'For each episode — English & Spanish', 'custom-blocks' ); ?></p>
        </div>

        <?php if ( empty( $cards ) ) : ?>
            <?php if ( current_user_can( 'edit_posts' ) ) : ?>
                <p class="coloring-books-list-empty"><?php esc_html_e( 'No Coloring Books have been published yet.', 'custom-blocks' ); ?></p>
            <?php endif; ?>
        <?php else : ?>
            <?php foreach ( $cards as $card_html ) : ?>
                <?php echo $card_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already-escaped HTML from render_coloring_book_block() ?>
            <?php endforeach; ?>
        <?php endif; ?>
    </div>
    <?php
    return ob_get_clean();
}
