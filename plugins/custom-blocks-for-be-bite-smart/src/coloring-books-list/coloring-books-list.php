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
 * Build (or fetch from cache) the full, ordered list of rendered coloring
 * book cards, in the current request's language. Every Coloring Book
 * published, alphabetical by title — unlike bitesmart_build_stage_card_list(),
 * NOT filtered by Stage: /learning/downloads/ is meant to be the one place
 * every coloring book lives, regardless of which Stage(s) it's also tagged
 * with for search purposes.
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
        'orderby'        => 'title',
        'order'          => 'ASC',
        'no_found_rows'  => true,
    ) );

    $cards = array();
    foreach ( $query->posts as $post ) {
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
function render_coloring_books_list_block( $attributes ) {
    $lang  = bitesmart_site_lang_code();
    $cards = bitesmart_build_downloads_page_card_list( $lang );

    ob_start();
    ?>
    <div class="wp-block-custom-coloring-books-list coloring-books-list custom-block-card custom-block-border">
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
