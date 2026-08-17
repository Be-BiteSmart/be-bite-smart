<?php
/**
 * Render callbacks + supporting logic for the CPT-backed Book display block
 * (custom/book) and its compact Learning Hub search-result card
 * (render_book_search_card(), consumed by bitesmart_build_stage_card_list()
 * in learning-search.php).
 *
 * Like custom/resource and custom/coloring-book, this block pulls its
 * content live from the Book post at render time — see the Custom Post
 * Types for BBS plugin's includes/book-cpt.php for the post type / meta
 * this reads from. Unlike those, a Book's main body (post_content) is real
 * rich text (Paragraph/List blocks only — see
 * bitesmart_restrict_book_allowed_blocks() there), not a meta field, so it's
 * rendered via apply_filters( 'the_content', ... ) rather than get_post_meta().
 *
 * Both render functions below also show a small Audience badge
 * (bitesmart_book_audience_badge(), added 2026-08-16) — see
 * _bitesmart_book_audience (book-cpt.php) and [[be-bitesmart-book-cpt-status]]
 * in memory. Visual-only; not wired into any search/browse filter.
 */

/**
 * Small HTML badge announcing whether a book is written for any-age readers
 * or specifically for an adult reader — see _bitesmart_book_audience
 * (book-cpt.php) and [[be-bitesmart-book-cpt-status]] in memory for the full
 * reasoning. Shared by both render_book_block() and render_book_search_card()
 * below so the copy/markup can't drift between the two surfaces. Always
 * rendered (never conditionally hidden) — both states are meaningful info
 * for a parent scanning the card, not just an "adult content" warning.
 *
 * @param int $book_id
 * @return string HTML.
 */
function bitesmart_book_audience_badge( $book_id ) {
    $audience = get_post_meta( $book_id, '_bitesmart_book_audience', true );
    $is_adult = 'adult' === $audience;

    $label = $is_adult
        ? __( 'For Adult Readers', 'custom-blocks' )
        : __( 'For Readers of Any Age', 'custom-blocks' );

    return sprintf(
        '<span class="book-audience-badge %s">%s</span>',
        $is_adult ? 'is-adult' : 'is-all-ages',
        esc_html( $label )
    );
}

/**
 * Stable per-book anchor id, e.g. "book-doggie-language" — same role as
 * bitesmart_episode_anchor_id()/bitesmart_coloring_book_anchor_id()
 * (episode-display.php / coloring-book-display.php), but simpler: Book has
 * no series+number pair to build from, just a title-slug, falling back to
 * the post ID for the rare case of a still-untitled draft.
 *
 * @param WP_Post $post Book post.
 * @return string
 */
function bitesmart_book_anchor_id( $post ) {
    $title_slug = sanitize_title( get_the_title( $post ) );
    return $title_slug ? 'book-' . $title_slug : 'book-' . $post->ID;
}

/**
 * Render callback for "custom/book" — one book, full card: cover, title,
 * price/availability, the rendered recommendation body, and (if set) a
 * Buy/More Info link. Used for manually placing a book on a topic page
 * (e.g. the existing hand-authored "Learn Canine Body Language" page).
 */
function render_book_block( $attributes ) {
    $book_id = isset( $attributes['bookId'] ) ? (int) $attributes['bookId'] : 0;
    $post    = $book_id ? get_post( $book_id ) : null;

    if ( ! $post || 'book' !== $post->post_type || 'publish' !== $post->post_status ) {
        // Front end: render nothing (e.g. book was later trashed). The
        // editor's own Placeholder/picker covers the empty state there.
        return '';
    }

    $price_availability = get_post_meta( $post->ID, '_bitesmart_book_price_availability', true );
    $url                = get_post_meta( $post->ID, '_bitesmart_book_url', true );
    $anchor_id           = bitesmart_book_anchor_id( $post );

    ob_start();
    ?>
    <article id="<?php echo esc_attr( $anchor_id ); ?>" class="wp-block-custom-book">
        <div class="book-card-container custom-block-card custom-block-border">
            <?php if ( has_post_thumbnail( $post ) ) : ?>
                <div class="book-card-cover">
                    <?php echo get_the_post_thumbnail( $post, 'medium' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- core-generated, already-escaped markup ?>
                </div>
            <?php endif; ?>

            <div class="book-card-body">
                <h3 class="book-card-title"><?php echo esc_html( get_the_title( $post ) ); ?></h3>

                <?php echo bitesmart_book_audience_badge( $post->ID ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already escaped inside bitesmart_book_audience_badge() ?>

                <?php if ( $price_availability ) : ?>
                    <p class="book-card-price"><?php echo esc_html( $price_availability ); ?></p>
                <?php endif; ?>

                <div class="book-card-content">
                    <?php echo apply_filters( 'the_content', $post->post_content ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- the_content filter already sanitizes/escapes as WordPress core does for any other post's content ?>
                </div>

                <?php if ( $url ) : ?>
                    <a href="<?php echo esc_url( $url ); ?>" class="book-card-link block-toggle-btn is-style-outline">
                        <?php esc_html_e( 'Buy / More Info', 'custom-blocks' ); ?>
                    </a>
                <?php endif; ?>
            </div>
        </div>
    </article>
    <?php
    return ob_get_clean();
}

/**
 * Compact search-result card for "custom/learning-search" — see
 * bitesmart_build_stage_card_list() in learning-search.php. Reuses
 * custom/qa-entry's accent-card + chevron <details>/<summary> markup (same
 * trick Episode/Coloring Book/Guide Chapter search cards already use), so
 * it needs no separately enqueued stylesheet — the custom/qa-entry style
 * handle is already enqueued whenever custom/learning-search or
 * custom/learning-browse is present (bitesmart_learning_search_enqueue_card_styles()).
 *
 * Shows the FULL rendered recommendation body, not a trimmed excerpt —
 * tried an auto-trimmed version first (word-count cut, then a
 * sentence-boundary-aware cut), but both ended up hiding real content
 * (a book's recommendation is usually only 2-3 short paragraphs to begin
 * with, unlike Guide Chapter's search card, which shows a deliberately-
 * short authored Summary field + a "view full chapter" link because a
 * chapter's body can be much longer). Since the card is already collapsed
 * behind a click (the <details>/<summary> chevron), there's no risk of
 * this overwhelming the collapsed list the way it would if always visible
 * — same "reveal everything for real once clicked" idiom Coloring Book's
 * search card already uses for its Download buttons. apply_filters(
 * 'the_content', ... ), same as render_book_block()'s full card, so
 * paragraph/list formatting survives instead of being flattened into one
 * run-on line the way wp_strip_all_tags() would.
 *
 * Links out via the book's own Buy/More Info URL when set (same convention
 * as Resource's card, which links out to _bitesmart_resource_url) rather
 * than a same-page anchor lookup — unlike Episode, a Book has no single
 * fixed destination page the way every Episode links to /learning/kids/,
 * so there's no one place to jump to. If a book has no URL yet, the card
 * just shows no link, same as Resource's own blank-URL behavior.
 */
function render_book_search_card( $attributes ) {
    $book_id = isset( $attributes['bookId'] ) ? (int) $attributes['bookId'] : 0;
    $post    = $book_id ? get_post( $book_id ) : null;

    if ( ! $post || 'book' !== $post->post_type || 'publish' !== $post->post_status ) {
        return '';
    }

    $price_availability = get_post_meta( $post->ID, '_bitesmart_book_price_availability', true );
    $url                = get_post_meta( $post->ID, '_bitesmart_book_url', true );

    /* translators: %s: book title */
    $heading = sprintf( __( 'Book: %s', 'custom-blocks' ), get_the_title( $post ) );

    ob_start();
    ?>
    <article class="wp-block-custom-qa-entry">
        <details class="qa-entry-card-container custom-block-accent-card">
            <summary class="qa-entry-summary">
                <h3 class="qa-entry-question custom-block-accent-heading"><?php echo esc_html( $heading ); ?></h3>
                <svg class="qa-entry-chevron" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
                    <polyline points="5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
                </svg>
            </summary>

            <div class="qa-entry-body book-search-card-body">
                <?php if ( has_post_thumbnail( $post ) ) : ?>
                    <div class="book-search-card-cover">
                        <?php echo get_the_post_thumbnail( $post, 'thumbnail' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- core-generated, already-escaped markup ?>
                    </div>
                <?php endif; ?>

                <div class="book-search-card-text">
                    <?php echo bitesmart_book_audience_badge( $post->ID ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already escaped inside bitesmart_book_audience_badge() ?>

                    <?php if ( $price_availability ) : ?>
                        <p class="book-search-card-price"><?php echo esc_html( $price_availability ); ?></p>
                    <?php endif; ?>

                    <div class="book-search-card-excerpt">
                        <?php echo apply_filters( 'the_content', $post->post_content ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- the_content filter already sanitizes/escapes as WordPress core does for any other post's content ?>
                    </div>

                    <?php if ( $url ) : ?>
                        <a href="<?php echo esc_url( $url ); ?>" class="book-search-card-link block-toggle-btn is-style-outline">
                            <?php esc_html_e( 'Buy / More Info', 'custom-blocks' ); ?>
                        </a>
                    <?php endif; ?>
                </div>
            </div>
        </details>
    </article>
    <?php
    return ob_get_clean();
}
