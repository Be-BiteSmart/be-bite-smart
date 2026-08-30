<?php
/**
 * Render callbacks + supporting logic for the CPT-backed Book display block
 * (custom/book) — the full card, manually placed via custom/book or
 * auto-listed via custom/books-list. The `book` CPT was excluded from the
 * Learning Hub search/browse list on 2026-08-28, and its compact search-card
 * variant, render_book_search_card(), was deleted outright on 2026-08-30
 * along with everything else that only ever existed for that search/browse
 * machinery (Search Keywords meta/UI, the Media Type taxonomy attachment) —
 * see [[be-bitesmart-book-cpt-status]] in memory and book-cpt.php's file
 * header for the full history.
 *
 * Like custom/resource and custom/coloring-book, this block pulls its
 * content live from the Book post at render time — see the Custom Post
 * Types for BBS plugin's includes/book-cpt.php for the post type / meta
 * this reads from. As of 2026-08-30 (redesigned twice that day — full
 * history in [[be-bitesmart-book-cpt-status]] in memory), Book's main body
 * is real nested blocks in post_content again: the locked custom/book-fields
 * canvas contains two further-locked sections, custom/book-summary-section
 * and custom/book-excerpt-section, each internally a free Paragraph/List
 * editing area. render_book_block() extracts each section via
 * bitesmart_book_content_sections() below (parse_blocks()/render_block(),
 * not apply_filters('the_content', ...) on the whole post — that would also
 * render the wrapping custom/book-fields chrome this function doesn't want).
 *
 * render_book_block() also shows a small Audience badge
 * (bitesmart_book_audience_badge(), added 2026-08-16) — see
 * _bitesmart_book_audience (book-cpt.php) and [[be-bitesmart-book-cpt-status]]
 * in memory. Visual-only; not wired into any search/browse filter.
 *
 * Its cover (bitesmart_book_cover_gallery(), added 2026-08-29) becomes a
 * small lazy-loading carousel when a book has "Inside the Book" preview
 * images set — see that function's own docblock, and its front-end
 * companion src/book-display/gallery.js.
 */

/**
 * Small HTML badge announcing who a book is written for — see
 * _bitesmart_book_audience (book-cpt.php) and [[be-bitesmart-book-cpt-status]]
 * in memory for the full reasoning. Always rendered (never conditionally
 * hidden) — every state is meaningful info for a parent scanning the card,
 * not just an "adult content" warning.
 *
 * Expanded 2026-08-29, per Janet, from a two-value (all_ages/adult) toggle to
 * four — see bitesmart_sanitize_book_audience() in book-cpt.php for the full
 * reasoning and fixed order. 'adult'/'is-adult' and 'all_ages'/'is-all-ages'
 * keep their original slug/class (only the 'all_ages' LABEL text changed);
 * 'younger_children'/'older_children' are new.
 *
 * @param int $book_id
 * @return string HTML.
 */
function bitesmart_book_audience_badge( $book_id ) {
    $audience = get_post_meta( $book_id, '_bitesmart_book_audience', true );

    $variants = array(
        'younger_children' => array( __( 'Younger Children', 'custom-blocks' ), 'is-younger-children' ),
        'older_children'   => array( __( 'Older Children', 'custom-blocks' ), 'is-older-children' ),
        'adult'            => array( __( 'Adults', 'custom-blocks' ), 'is-adult' ),
        'all_ages'         => array( __( 'All Ages (With Guidance)', 'custom-blocks' ), 'is-all-ages' ),
    );

    list( $label, $class ) = isset( $variants[ $audience ] ) ? $variants[ $audience ] : $variants['all_ages'];

    return sprintf(
        '<span class="book-audience-badge %s">%s</span>',
        esc_attr( $class ),
        esc_html( $label )
    );
}

/**
 * Cover markup for render_book_block() — plain cover image, unchanged, when
 * a book has no "Inside the Book" preview images (_bitesmart_book_preview_images,
 * book-cpt.php); a small carousel (cover + interior photos, left/right
 * arrows) when it does. Added 2026-08-29, per Janet: a "sneak peek" of a
 * book's interior pages, kind to a worldwide/bandwidth-constrained audience —
 * only the cover (slide 0) is a real server-rendered <img src>; every other
 * slide's URL/alt lives only in an inert inline JSON blob until gallery.js
 * actually swaps it in, so a visitor who never clicks Next downloads nothing
 * beyond the cover. Without JS, only that plain cover <img> renders — the
 * arrows/counter are built entirely by gallery.js, so this degrades to
 * exactly today's plain-cover markup, not a broken half-carousel.
 *
 * @param WP_Post $post Book post.
 * @return string HTML, or '' if the book has no Featured Image at all.
 */
function bitesmart_book_cover_gallery( $post ) {
    if ( ! has_post_thumbnail( $post ) ) {
        return '';
    }

    $thumbnail_id = get_post_thumbnail_id( $post );
    $cover_url    = wp_get_attachment_image_url( $thumbnail_id, 'medium' );
    $cover_alt    = get_post_meta( $thumbnail_id, '_wp_attachment_image_alt', true );
    if ( ! $cover_alt ) {
        $cover_alt = get_the_title( $post );
    }

    $preview_ids = get_post_meta( $post->ID, '_bitesmart_book_preview_images', true );
    if ( ! is_array( $preview_ids ) || empty( $preview_ids ) || ! $cover_url ) {
        // No preview images (or, defensively, no resolvable cover URL) —
        // exactly today's plain cover, unchanged.
        return '<div class="book-card-cover">' . get_the_post_thumbnail( $post, 'medium' ) . '</div>';
    }

    // Slide 0 is always the cover, so gallery.js can treat "go back to the
    // start" the same as any other slide index instead of special-casing it.
    $slides = array( array( 'url' => $cover_url, 'alt' => $cover_alt ) );

    foreach ( $preview_ids as $attachment_id ) {
        $url = wp_get_attachment_image_url( $attachment_id, 'medium' );
        if ( ! $url ) {
            continue; // attachment deleted since the book was last saved.
        }
        $alt = get_post_meta( $attachment_id, '_wp_attachment_image_alt', true );
        if ( ! $alt ) {
            /* translators: %s: book title */
            $alt = sprintf( __( 'Photo from inside %s', 'custom-blocks' ), get_the_title( $post ) );
        }
        $slides[] = array(
            'url' => $url,
            'alt' => $alt,
        );
    }

    if ( count( $slides ) < 2 ) {
        // Every preview image failed to resolve — degrade to the plain cover.
        return '<div class="book-card-cover">' . get_the_post_thumbnail( $post, 'medium' ) . '</div>';
    }

    ob_start();
    ?>
    <div class="book-card-cover book-gallery">
        <img
            class="book-gallery-image"
            src="<?php echo esc_url( $slides[0]['url'] ); ?>"
            alt="<?php echo esc_attr( $slides[0]['alt'] ); ?>"
        />
        <div class="book-gallery-controls"></div>
        <?php
        // gallery.js builds the arrow buttons entirely client-side (see
        // bitesmart_book_cover_gallery()'s own docblock for why — a visitor
        // without JS should just see the plain cover, not inert arrows), but
        // their aria-label text still needs to be real TranslatePress-
        // translatable page text, not a string hardcoded in the JS file —
        // same hidden-translatable-template idiom as
        // bitesmart_render_learning_search_strings() in learning-search.php.
        ?>
        <span class="book-gallery-string" data-key="prev" hidden><?php esc_html_e( 'Previous image', 'custom-blocks' ); ?></span>
        <span class="book-gallery-string" data-key="next" hidden><?php esc_html_e( 'Next image', 'custom-blocks' ); ?></span>
        <script type="application/json" class="book-gallery-data">
            <?php
            // JSON_HEX_TAG guards against a stray "</script>" in an
            // attachment's own alt text closing this tag early — same idiom
            // bitesmart_render_learning_search_data() uses in learning-search.php.
            echo wp_json_encode( $slides, JSON_HEX_TAG );
            ?>
        </script>
    </div>
    <?php
    return ob_get_clean();
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
 * Extracts "Why BBS Recommends This Book" / Book Excerpt's already-rendered
 * HTML from a Book's
 * post_content — see book-cpt.php's file header for the full 3-level
 * locked-block structure this reads (custom/book-fields containing exactly
 * custom/book-summary-section then custom/book-excerpt-section, each an
 * independent free Paragraph/List editing area).
 *
 * Deliberately walks parse_blocks()'s tree and calls render_block() on just
 * the two INNER section blocks — NOT apply_filters('the_content', $post->post_content)
 * on the whole post, which would also render custom/book-fields' own
 * wrapping `<div>` and its editor-only hint text is safely absent from
 * save() but the wrapper div itself isn't something render_book_block()
 * wants duplicated inside its own card markup. Each section's own
 * render_block() output is already fully self-contained (heading + content
 * wrapper — see either section's own save()), so this function returns
 * ready-to-echo HTML with nothing further to wrap.
 *
 * @param WP_Post $post Book post.
 * @return array{summary: string, excerpt: string} Rendered HTML, '' if that section is empty/missing.
 */
function bitesmart_book_content_sections( $post ) {
    $sections = array(
        'summary' => '',
        'excerpt' => '',
    );

    $blocks = parse_blocks( $post->post_content );
    foreach ( $blocks as $block ) {
        if ( 'custom/book-fields' !== $block['blockName'] ) {
            continue;
        }

        foreach ( $block['innerBlocks'] as $inner_block ) {
            $section_key = null;
            if ( 'custom/book-summary-section' === $inner_block['blockName'] ) {
                $section_key = 'summary';
            } elseif ( 'custom/book-excerpt-section' === $inner_block['blockName'] ) {
                $section_key = 'excerpt';
            } else {
                continue;
            }

            // render_block() on the SECTION itself always includes its own
            // heading + wrapper, even when its inner Paragraph/List area is
            // genuinely empty (a fresh book's default single blank
            // paragraph) — so check the INNER content alone first, before
            // deciding whether to show the section (heading included) at
            // all, rather than treating "has a heading" as "has content".
            $inner_html = '';
            foreach ( $inner_block['innerBlocks'] as $content_block ) {
                $inner_html .= render_block( $content_block );
            }

            if ( trim( wp_strip_all_tags( $inner_html ) ) === '' ) {
                continue; // nothing real here — skip the whole section.
            }

            $sections[ $section_key ] = render_block( $inner_block );
        }

        break; // template_lock: 'all' guarantees exactly one custom/book-fields block.
    }

    return $sections;
}

/**
 * Buy buttons for a book — one per retailer (e.g. Amazon, Target), each with
 * its own label. Prefers _bitesmart_book_buy_links (book-cpt.php); falls
 * back to the legacy single _bitesmart_book_url field, as one unlabeled
 * entry, for a book that hasn't had its editor panel reopened since the
 * buy-links list replaced it on 2026-08-30 — that panel auto-prefills the
 * new list from this same legacy field the moment it IS reopened, so this
 * fallback only matters for books nobody has resaved yet.
 *
 * @param int $post_id Book post ID.
 * @return array<int, array{label: string, url: string}>
 */
function bitesmart_book_buy_links( $post_id ) {
    $links = get_post_meta( $post_id, '_bitesmart_book_buy_links', true );
    if ( is_array( $links ) && ! empty( $links ) ) {
        return $links;
    }

    $legacy_url = get_post_meta( $post_id, '_bitesmart_book_url', true );
    if ( $legacy_url ) {
        return array( array( 'label' => '', 'url' => $legacy_url ) );
    }

    return array();
}

/**
 * Render callback for "custom/book" — one book, full card: cover, title,
 * price/availability, BBS's own Summary, the book's own Excerpt (if set),
 * and (if any are set) Buy Links. Used for manually placing a book on a
 * topic page (e.g. the existing hand-authored "Learn Canine Body Language"
 * page) and for the auto-listed custom/books-list cards.
 */
function render_book_block( $attributes ) {
    $book_id = isset( $attributes['bookId'] ) ? (int) $attributes['bookId'] : 0;
    $post    = $book_id ? get_post( $book_id ) : null;

    if ( ! $post || 'book' !== $post->post_type || 'publish' !== $post->post_status ) {
        // Front end: render nothing (e.g. book was later trashed). The
        // editor's own Placeholder/picker covers the empty state there.
        return '';
    }

    $sections            = bitesmart_book_content_sections( $post );
    $price_availability = get_post_meta( $post->ID, '_bitesmart_book_price_availability', true );
    $buy_links           = bitesmart_book_buy_links( $post->ID );
    $anchor_id           = bitesmart_book_anchor_id( $post );

    ob_start();
    ?>
    <article id="<?php echo esc_attr( $anchor_id ); ?>" class="wp-block-custom-book">
        <div class="book-card-container custom-block-card custom-block-border">
            <?php echo bitesmart_book_cover_gallery( $post ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already-escaped inside bitesmart_book_cover_gallery() ?>

            <div class="book-card-body">
                <h3 class="book-card-title"><?php echo esc_html( get_the_title( $post ) ); ?></h3>

                <?php echo bitesmart_book_audience_badge( $post->ID ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already escaped inside bitesmart_book_audience_badge() ?>

                <?php if ( $price_availability ) : ?>
                    <p class="book-card-price"><?php echo esc_html( $price_availability ); ?></p>
                <?php endif; ?>

                <?php if ( $sections['summary'] ) : ?>
                    <?php echo $sections['summary']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- render_block() output; already includes its own .book-card-content wrapper (custom/book-summary-section's own save()) ?>
                <?php endif; ?>

                <?php if ( $sections['excerpt'] ) : ?>
                    <?php echo $sections['excerpt']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- render_block() output; already includes its own blockquote wrapper (custom/book-excerpt-section's own save()) ?>
                <?php endif; ?>

                <?php if ( ! empty( $buy_links ) ) : ?>
                    <div class="book-card-buy-links">
                        <?php foreach ( $buy_links as $link ) : ?>
                            <a href="<?php echo esc_url( $link['url'] ); ?>" class="book-card-link block-toggle-btn is-style-outline">
                                <?php echo esc_html( $link['label'] ? $link['label'] : __( 'Buy / More Info', 'custom-blocks' ) ); ?>
                            </a>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
            </div>
        </div>
    </article>
    <?php
    return ob_get_clean();
}

