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
 * render_book_block() also shows a small Target Audience badge
 * (bitesmart_book_target_audience_badge()) — a freeform blurb (e.g. "Ages
 * 4-7"), see _bitesmart_book_target_audience (book-cpt.php). Replaced the
 * original Audience-ENUM badge on 2026-08-31 (Janet's ask — that badge just
 * repeated the same words as the group heading a card already sits under
 * on the Books List page); see [[be-bitesmart-book-cpt-status]] in memory
 * for the full history. Audience itself (_bitesmart_book_audience) still
 * exists and still drives Books List grouping (books-list.php), it's just
 * not echoed on the card anymore.
 *
 * Its cover (bitesmart_book_cover_gallery(), added 2026-08-29) becomes a
 * small lazy-loading carousel when a book has "Inside the Book" preview
 * images set — see that function's own docblock, and its front-end
 * companion src/book-display/gallery.js. Every cover — with or without
 * preview images — also gets an accessible "View Larger Image" lightbox
 * (added 2026-08-30, Janet's ask: covers render small on the page and a
 * parent should be able to see a bigger version) — see gallery.js's and
 * gallery-modal.js's own docblocks.
 */

/**
 * Small HTML badge showing the book's own freeform "Target Audience" blurb
 * (_bitesmart_book_target_audience, book-cpt.php) — e.g. "Ages 4-7", "New
 * puppy owners". Added 2026-08-31, per Janet, replacing the old Audience-
 * ENUM badge: that badge just repeated the same category words already
 * visible as the surrounding group heading on the grouped Books List page
 * (e.g. a card under a "For Adults" heading ALSO saying "Adults"). See
 * [[be-bitesmart-book-cpt-status]] in memory for the full history. Audience
 * itself (_bitesmart_book_audience) is untouched and still drives Books
 * List grouping (books-list.php) — it's just no longer echoed here.
 *
 * UNLIKE the old badge, this one is genuinely optional — the field has no
 * meaningful default the way the 4-value enum did, so a blank value means
 * "no badge," not "show the default state."
 *
 * @param int $book_id
 * @return string HTML, or '' if Target Audience is blank.
 */
function bitesmart_book_target_audience_badge( $book_id ) {
    $target_audience = get_post_meta( $book_id, '_bitesmart_book_target_audience', true );
    if ( ! $target_audience ) {
        return '';
    }

    return sprintf(
        '<span class="book-audience-badge">%s</span>',
        esc_html( $target_audience )
    );
}

/**
 * Cover markup for render_book_block() — always the same
 * .book-card-cover.book-gallery wrapper, whether or not a book has any
 * "Inside the Book" preview images (_bitesmart_book_preview_images,
 * book-cpt.php) set: slide 0 is always the cover, any preview images (if
 * set) follow it. Only the cover is ever a real server-rendered <img src>;
 * every other slide's url/large/alt lives only in an inert inline JSON blob
 * until gallery.js actually swaps it in — kind to a worldwide/bandwidth-
 * constrained audience, per Janet's original ask (2026-08-29): a visitor who
 * never clicks Next or opens the "View Larger Image" modal downloads
 * nothing beyond the cover.
 *
 * Unified with the old plain-cover-only case on 2026-08-30, when a "View
 * Larger Image" lightbox was added (see gallery.js/gallery-modal.js) —
 * every cover, with or without preview images, needed the same enlarge
 * affordance, so the old "no previews / a resolvable preview image failed"
 * fallback branches (a bare get_the_post_thumbnail() div) are gone, folded
 * into this one path — a book with zero previews just gets a 1-slide
 * $slides array, which gallery.js already handles correctly (no arrows/
 * counter, "View Larger Image" still works). Without JS, only the plain
 * cover <img> renders — arrows, the enlarge button, and the modal are all
 * built entirely by gallery.js, so this degrades to a plain cover image,
 * never an inert half-built control.
 *
 * @param WP_Post $post Book post.
 * @return string HTML, or '' if the book has no Featured Image (or,
 *                defensively, no resolvable cover URL) at all.
 */
function bitesmart_book_cover_gallery( $post ) {
    if ( ! has_post_thumbnail( $post ) ) {
        return '';
    }

    $thumbnail_id = get_post_thumbnail_id( $post );
    // wp_get_attachment_image_src(), not just _url() — the real intrinsic
    // width/height (not the CSS-displayed 160px, book-display/style.css)
    // is what lets the browser reserve the cover's correct final height
    // before the file itself has downloaded, added 2026-08-31 per Janet
    // (covers vary in aspect ratio book to book, so a fixed CSS height
    // isn't an option — this is the standard per-image fix). Matters most
    // for the Show More/Show Less lazy covers (bitesmart_books_list_make_cover_lazy(),
    // books-list.php) — width/height are on the tag from the start
    // regardless of src/data-src, so a card popped open by the toggle
    // reserves its right-sized space immediately, before its now-hydrated
    // src has actually loaded.
    $cover_src = wp_get_attachment_image_src( $thumbnail_id, 'medium' );
    if ( ! $cover_src ) {
        return ''; // defensively, no resolvable cover URL at all.
    }
    list( $cover_url, $cover_width, $cover_height ) = $cover_src;
    $cover_alt = get_post_meta( $thumbnail_id, '_wp_attachment_image_alt', true );
    if ( ! $cover_alt ) {
        $cover_alt = get_the_title( $post );
    }

    // Slide 0 is always the cover, so gallery.js can treat "go back to the
    // start" the same as any other slide index instead of special-casing it.
    $slides = array(
        array(
            'url'    => $cover_url,
            'width'  => $cover_width,
            'height' => $cover_height,
            'large'  => bitesmart_book_large_image_url( $thumbnail_id, $cover_url ),
            'alt'    => $cover_alt,
        ),
    );

    $preview_ids = get_post_meta( $post->ID, '_bitesmart_book_preview_images', true );
    if ( is_array( $preview_ids ) ) {
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
                'url'   => $url,
                'large' => bitesmart_book_large_image_url( $attachment_id, $url ),
                'alt'   => $alt,
            );
        }
    }

    ob_start();
    ?>
    <div class="book-card-cover book-gallery">
        <div class="book-gallery-frame">
            <img
                class="book-gallery-image"
                src="<?php echo esc_url( $slides[0]['url'] ); ?>"
                width="<?php echo esc_attr( $slides[0]['width'] ); ?>"
                height="<?php echo esc_attr( $slides[0]['height'] ); ?>"
                alt="<?php echo esc_attr( $slides[0]['alt'] ); ?>"
            />
            <div class="book-gallery-controls"></div>
        </div>
        <?php
        // .book-gallery-frame (added 2026-08-30, alongside the "View Larger
        // Image" button below) wraps just the <img> + arrows/counter, sized
        // to exactly the image — its own position:relative (style.css) is
        // what the arrows/counter position themselves against. Needed once
        // the enlarge button started rendering as a block sibling under the
        // image: without this wrapper, the counter's `bottom` offset was
        // measuring from the bottom of the whole card-cover (image + button
        // together), landing it on top of the button's own text instead of
        // the image's actual bottom edge.
        ?>
        <?php
        // gallery.js builds the arrows, the "View Larger Image" button, and
        // the photo modal entirely client-side (see this function's own
        // docblock for why a visitor without JS should see only the plain
        // cover, never an inert control), but their text still needs to be
        // real TranslatePress-translatable page text, not hardcoded in the
        // JS file — same hidden-translatable-template idiom as
        // bitesmart_render_learning_search_strings() in learning-search.php.
        ?>
        <span class="book-gallery-string" data-key="prev" hidden><?php esc_html_e( 'Previous image', 'custom-blocks' ); ?></span>
        <span class="book-gallery-string" data-key="next" hidden><?php esc_html_e( 'Next image', 'custom-blocks' ); ?></span>
        <span class="book-gallery-string" data-key="enlarge" hidden><?php esc_html_e( 'View Larger Image', 'custom-blocks' ); ?></span>
        <span class="book-gallery-string" data-key="close" hidden><?php esc_html_e( 'Close', 'custom-blocks' ); ?></span>
        <?php
        // {title} is substituted client-side with the book's own (already
        // real, un-translatable-as-a-template) title — same
        // {placeholder}-inside-a-translatable-template idiom
        // video-lang-restart-modal.js uses for {language}, via
        // shared/languages.js's applyLanguagePlaceholder().
        ?>
        <span class="book-gallery-string" data-key="modalLabel" hidden><?php esc_html_e( 'Photos from {title}', 'custom-blocks' ); ?></span>
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
 * Cascades to the biggest resolvable rendition of an attachment, for the
 * "View Larger Image" modal (gallery.js/gallery-modal.js) — the small
 * inline cover/carousel always stays on 'medium' (bandwidth-conscious, see
 * bitesmart_book_cover_gallery()'s own docblock), but blowing that same
 * medium-sized URL up to fill the modal would just look blurry, defeating
 * the point of "view a larger version." Tries 'large' first (WP's default
 * max 1024x1024), then the original 'full' upload, then finally the
 * already-known medium URL so the modal never ends up with an empty src.
 *
 * @param int    $attachment_id
 * @param string $fallback_url Already-resolved 'medium' URL for this same attachment.
 * @return string
 */
function bitesmart_book_large_image_url( $attachment_id, $fallback_url ) {
    return wp_get_attachment_image_url( $attachment_id, 'large' )
        ?: wp_get_attachment_image_url( $attachment_id, 'full' )
        ?: $fallback_url;
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
 * Extracts "Why BBS Recommends This Book" (Summary, already fully rendered)
 * and Book Excerpt (as an array of individually-rendered paragraph/list
 * blocks, NOT pre-fused into one string) from a Book's post_content — see
 * book-cpt.php's file header for the full 3-level locked-block structure
 * this reads (custom/book-fields containing exactly
 * custom/book-summary-section then custom/book-excerpt-section, each an
 * independent free Paragraph/List editing area).
 *
 * Deliberately walks parse_blocks()'s tree and calls render_block() — NOT
 * apply_filters('the_content', $post->post_content) on the whole post,
 * which would also render custom/book-fields' own wrapping `<div>`.
 * Summary is rendered via render_block() on the whole section (heading +
 * content together, exactly as custom/book-summary-section's own save()
 * produces it — render_book_block() echoes it as-is, nothing further to
 * wrap). Excerpt is returned as its individual content blocks' rendered
 * HTML instead, one entry per Paragraph/List — added 2026-08-30 so
 * render_book_block() can split a long excerpt into an always-visible
 * preview plus a "Read More"-collapsed remainder at real paragraph
 * boundaries (bitesmart_book_excerpt_preview_split()) without ever cutting
 * into the middle of a paragraph's own rendered HTML — the kind of fragile
 * string surgery that already caused real data loss once on this project
 * (a regex-based `<p>` extraction silently dropped a whole list — see
 * [[be-bitesmart-book-cpt-status]] in memory, 2026-08-30). Excerpt's own
 * heading + blockquote wrapper are therefore built by render_book_block()
 * itself now, not returned pre-fused here — see that function.
 *
 * @param WP_Post $post Book post.
 * @return array{summary: string, excerpt_blocks: string[]} Summary: rendered
 *         HTML, '' if empty/missing. excerpt_blocks: rendered HTML per
 *         content block in order, [] if empty/missing.
 */
function bitesmart_book_content_sections( $post ) {
    $sections = array(
        'summary'        => '',
        'excerpt_blocks' => array(),
    );

    $blocks = parse_blocks( $post->post_content );
    foreach ( $blocks as $block ) {
        if ( 'custom/book-fields' !== $block['blockName'] ) {
            continue;
        }

        foreach ( $block['innerBlocks'] as $inner_block ) {
            $is_summary = 'custom/book-summary-section' === $inner_block['blockName'];
            $is_excerpt = 'custom/book-excerpt-section' === $inner_block['blockName'];
            if ( ! $is_summary && ! $is_excerpt ) {
                continue;
            }

            // A section's own render_block() output always includes its
            // heading + wrapper, even when its inner Paragraph/List area is
            // genuinely empty (a fresh book's default single blank
            // paragraph) — so render the INNER content blocks first, check
            // THOSE for real text, before deciding whether to show the
            // section (heading included) at all, rather than treating "has
            // a heading" as "has content".
            $content_blocks_html = array();
            foreach ( $inner_block['innerBlocks'] as $content_block ) {
                $content_blocks_html[] = render_block( $content_block );
            }

            if ( trim( wp_strip_all_tags( implode( '', $content_blocks_html ) ) ) === '' ) {
                continue; // nothing real here — skip the whole section.
            }

            if ( $is_summary ) {
                // Summary isn't split/collapsed — render the whole section
                // (heading + content) exactly as its own save() produces it.
                $sections['summary'] = render_block( $inner_block );
            } else {
                $sections['excerpt_blocks'] = $content_blocks_html;
            }
        }

        break; // template_lock: 'all' guarantees exactly one custom/book-fields block.
    }

    return $sections;
}

/**
 * Splits a Book Excerpt's individually-rendered content blocks
 * (bitesmart_book_content_sections()'s 'excerpt_blocks') into an
 * always-visible preview and a "Read More"-collapsed remainder, at real
 * paragraph/list boundaries only — never mid-block. Added 2026-08-30,
 * Janet's ask: show some paragraphs, hide the rest behind Read More,
 * rather than the whole Excerpt going behind the button.
 *
 * Always keeps at least the FIRST block in the preview, however long it is
 * on its own — a real 787-char excerpt in this project's own data is one
 * single paragraph with no other block to hide it behind; showing it in
 * full is the only option that doesn't risk truncating that paragraph's
 * own rendered HTML mid-string (a real bug this project already hit once
 * doing exactly that to book content — see [[be-bitesmart-book-cpt-status]]
 * in memory). After that, blocks keep joining the preview as long as the
 * running total is still under $preview_target_chars; once it isn't,
 * every remaining block goes into $hidden instead. $hidden ends up empty
 * (no Read More needed at all) whenever the whole excerpt already fits
 * within one paragraph or under the target — exactly today's plain
 * rendering, unchanged.
 *
 * 400 characters was picked against this project's own real excerpt data:
 * a book with 4 blocks (711/480/248/315 chars) splits into a 711-char
 * preview (its own real first paragraph) plus 3 blocks/1043 chars behind
 * Read More; a book with one 787-char block or one 370-char block both
 * stay fully visible, matching what a short excerpt should do.
 *
 * @param string[] $blocks Rendered HTML per content block, in order.
 * @param int      $preview_target_chars
 * @return array{preview: string, hidden: string} Rendered HTML for each half; hidden is '' if nothing needs collapsing.
 */
function bitesmart_book_excerpt_preview_split( $blocks, $preview_target_chars = 400 ) {
    $preview = array();
    $hidden  = array();
    $running = 0;

    foreach ( $blocks as $block_html ) {
        if ( empty( $preview ) || $running < $preview_target_chars ) {
            $preview[] = $block_html;
            $running  += strlen( trim( wp_strip_all_tags( $block_html ) ) );
        } else {
            $hidden[] = $block_html;
        }
    }

    return array(
        'preview' => implode( '', $preview ),
        'hidden'  => implode( '', $hidden ),
    );
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
 * page count, BBS's own Summary, the book's own Excerpt (if set), and (if
 * any are set) Buy Links. Used for manually placing a book on a topic page
 * (e.g. the existing hand-authored "Learn Canine Body Language" page) and
 * for the auto-listed custom/books-list cards.
 */
function render_book_block( $attributes ) {
    $book_id = isset( $attributes['bookId'] ) ? (int) $attributes['bookId'] : 0;
    $post    = $book_id ? get_post( $book_id ) : null;

    if ( ! $post || 'book' !== $post->post_type || 'publish' !== $post->post_status ) {
        // Front end: render nothing (e.g. book was later trashed). The
        // editor's own Placeholder/picker covers the empty state there.
        return '';
    }

    $sections  = bitesmart_book_content_sections( $post );
    $pages     = (int) get_post_meta( $post->ID, '_bitesmart_book_pages', true );
    $buy_links = bitesmart_book_buy_links( $post->ID );
    $anchor_id = bitesmart_book_anchor_id( $post );

    ob_start();
    ?>
    <article id="<?php echo esc_attr( $anchor_id ); ?>" class="wp-block-custom-book">
        <div class="book-card-container custom-block-card custom-block-border">
            <?php echo bitesmart_book_cover_gallery( $post ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already-escaped inside bitesmart_book_cover_gallery() ?>

            <div class="book-card-body">
                <h3 class="book-card-title"><?php echo esc_html( get_the_title( $post ) ); ?></h3>

                <?php echo bitesmart_book_target_audience_badge( $post->ID ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already escaped inside bitesmart_book_target_audience_badge() ?>

                <?php if ( $pages > 0 ) : ?>
                    <p class="book-card-pages">
                        <?php
                        echo esc_html(
                            sprintf(
                                /* translators: %s: number of pages */
                                _n( 'Length: %s page', 'Length: %s pages', $pages, 'custom-blocks' ),
                                number_format_i18n( $pages )
                            )
                        );
                        ?>
                    </p>
                <?php endif; ?>

                <?php if ( $sections['summary'] ) : ?>
                    <?php echo $sections['summary']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- render_block() output; already includes its own .book-card-content wrapper (custom/book-summary-section's own save()) ?>
                <?php endif; ?>

                <?php if ( ! empty( $sections['excerpt_blocks'] ) ) : ?>
                    <?php
                    // Heading + blockquote are built here, not returned
                    // pre-fused by bitesmart_book_content_sections() — see
                    // that function's own docblock for why (needs the
                    // individual paragraph/list blocks to split on, not one
                    // opaque HTML string). Mirrors custom/book-excerpt-section's
                    // own save() shape (book-excerpt-section/index.js).
                    $excerpt_split = bitesmart_book_excerpt_preview_split( $sections['excerpt_blocks'] );
                    ?>
                    <h4 class="book-card-section-heading"><?php esc_html_e( 'Book Excerpt', 'custom-blocks' ); ?></h4>
                    <blockquote class="wp-block-quote book-card-excerpt">
                        <?php echo $excerpt_split['preview']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- render_block() output per content block ?>
                        <?php if ( $excerpt_split['hidden'] ) : ?>
                            <?php
                            // Collapsed by default — read-more.js (enqueued
                            // globally, custom_blocks_scripts()) finds this
                            // same as any other .expandable-article-block on
                            // the page and wires up the toggle; a <div>, not
                            // <article> like this pattern's other 3 usages,
                            // since this is a sub-region of the quote, not a
                            // document-outline article of its own —
                            // read-more.js matches by class, not tag, so
                            // this is a drop-in use of the exact same script.
                            ?>
                            <div class="expandable-article-block book-card-excerpt-expandable">
                                <div class="expandable-content">
                                    <?php echo $excerpt_split['hidden']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- render_block() output per content block ?>
                                </div>
                                <button
                                    type="button"
                                    class="read-more-toggle block-toggle-btn is-style-outline"
                                    data-expanded="false"
                                    data-label-collapsed="<?php echo esc_attr__( 'Read More', 'custom-blocks' ); ?>"
                                    data-label-expanded="<?php echo esc_attr__( 'Read Less', 'custom-blocks' ); ?>"
                                ><?php esc_html_e( 'Read More', 'custom-blocks' ); ?></button>
                            </div>
                        <?php endif; ?>
                    </blockquote>
                <?php endif; ?>

                <?php if ( ! empty( $buy_links ) ) : ?>
                    <h4 class="book-card-section-heading"><?php esc_html_e( 'Where to Buy', 'custom-blocks' ); ?></h4>
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

