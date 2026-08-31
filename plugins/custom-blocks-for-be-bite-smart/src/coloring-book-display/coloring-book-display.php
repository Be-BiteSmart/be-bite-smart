<?php
/**
 * Render callbacks + supporting logic for the CPT-backed Coloring Book
 * display blocks: custom/coloring-book (one coloring book, full card with
 * View PDF + Download per language) and custom/coloring-books-list (every
 * published Coloring Book, auto-listed — see coloring-books-list.php).
 *
 * Like custom/episode and custom/resource, these blocks pull their content
 * live from the Coloring Book post at render time — see the Custom Post
 * Types for BBS plugin's includes/coloring-book-cpt.php for the post type /
 * meta this reads from.
 *
 * This file used to also hold render_coloring_book_search_card() — a
 * compact card shown in Learning Hub Search results (Download buttons
 * only, no inline PDF viewer, reusing custom/qa-entry's accent-card +
 * chevron <details>/<summary> markup). Deleted 2026-08-30 along with the
 * rest of Coloring Book's search-only plumbing, once Janet removed the CPT
 * from that search/browse listing (her plan is to fold coloring books
 * under one Q&A Entry instead) — see coloring-book-cpt.php's file header
 * and [[be-bitesmart-coloring-book-status]] in memory for the full history.
 */

/**
 * Stable per-coloring-book anchor id, e.g. "coloring-book-paws-to-prevent-ep-1"
 * — mirrors bitesmart_episode_anchor_id() in episode-display.php verbatim
 * (same Series-term + number pattern, same title-slug fallback). See that
 * function's own comment for the "re-save to pick up a since-added Series
 * term" caveat, which applies here too.
 *
 * @param WP_Post $post Coloring Book post.
 * @return string
 */
function bitesmart_coloring_book_anchor_id( $post ) {
    $number      = get_post_meta( $post->ID, '_bitesmart_coloring_book_episode_number', true );
    $terms       = get_the_terms( $post->ID, 'series' );
    $series_slug = ( ! is_wp_error( $terms ) && ! empty( $terms ) ) ? $terms[0]->slug : 'series';

    if ( $number ) {
        return 'coloring-book-' . $series_slug . '-ep-' . sanitize_title( $number );
    }

    $title_slug = sanitize_title( get_the_title( $post ) );
    return $title_slug ? 'coloring-book-' . $series_slug . '-' . $title_slug : 'coloring-book-' . $series_slug . '-' . $post->ID;
}

/**
 * One language's buttons: a matched View PDF (toggle) + Download pair when
 * a PDF is uploaded (front-end toggle behavior comes from the globally
 * enqueued toggle-system.js reading data-target/data-group/data-expanded —
 * see the shared download-card block's render-language-row.js, which this
 * mirrors in PHP), a Coming Soon pill when it isn't and $coming_soon_when_empty
 * is true, or nothing at all.
 *
 * @param string $lang                 'en' or 'es'.
 * @param string $pdf_url              Uploaded PDF URL, '' if none.
 * @param string $target_id            DOM id of this language's viewer <div>.
 * @param string $group_id             Shared toggle group id (closes the other language's viewer).
 * @param bool   $include_viewer_toggle Whether to render the View PDF toggle alongside the Download link. Always true from this file's remaining caller since the Download-only search-card mode (render_coloring_book_search_card(), deleted 2026-08-30) was removed — kept as a param rather than hardcoded in case a future caller needs the Download-only mode again.
 * @param bool   $coming_soon_when_empty Whether to render a Coming Soon pill when $pdf_url is empty.
 * @return string
 */
function bitesmart_coloring_book_language_row( $lang, $pdf_url, $target_id, $group_id, $include_viewer_toggle, $coming_soon_when_empty ) {
    $is_es      = 'es' === $lang;
    $tag        = $is_es ? 'ES' : 'ENG';
    $view_label = sprintf(
        /* translators: %s: language tag, e.g. "ENG" */
        __( 'View PDF (%s)', 'custom-blocks' ),
        $tag
    );
    $hide_label = sprintf(
        /* translators: %s: language tag, e.g. "ENG" */
        __( 'Hide PDF (%s)', 'custom-blocks' ),
        $tag
    );
    $download_label = sprintf(
        /* translators: %s: language tag, e.g. "ENG" */
        __( 'Download (%s)', 'custom-blocks' ),
        $tag
    );

    if ( ! $pdf_url ) {
        if ( ! $coming_soon_when_empty ) {
            return '';
        }
        $outline_class = $is_es ? ' is-style-outline ecd-toggle--outline' : '';
        ob_start();
        ?>
        <div class="download-card-language-row">
            <button class="ecd-toggle block-toggle-btn ecd-toggle--coming-soon<?php echo esc_attr( $outline_class ); ?>" disabled aria-disabled="true">
                <span class="btn-label">
                    <?php
                    /* translators: %s: language tag, e.g. "ENG" */
                    printf( esc_html__( 'Coming Soon (%s)', 'custom-blocks' ), esc_html( $tag ) );
                    ?>
                </span>
            </button>
        </div>
        <?php
        return ob_get_clean();
    }

    ob_start();
    ?>
    <div class="download-card-language-row">
        <?php if ( $include_viewer_toggle ) : ?>
            <button class="ecd-toggle block-toggle-btn" data-target="<?php echo esc_attr( $target_id ); ?>" data-group="<?php echo esc_attr( $group_id ); ?>" data-expanded="false" data-lang="<?php echo esc_attr( $lang ); ?>">
                <span class="btn-label btn-label--view"><?php echo esc_html( $view_label ); ?></span>
                <span class="btn-label btn-label--hide"><?php echo esc_html( $hide_label ); ?></span>
            </button>
        <?php endif; ?>
        <a href="<?php echo esc_url( $pdf_url ); ?>" download class="block-toggle-btn is-style-outline download-card-pdf-download" data-lang="<?php echo esc_attr( $lang ); ?>">
            <?php echo esc_html( $download_label ); ?>
        </a>
    </div>
    <?php
    return ob_get_clean();
}

/**
 * Full download card — title/episode chip, View PDF + Download per
 * language, inline (initially hidden) PDF viewers. Used only by
 * render_coloring_book_block(), i.e. the white .download-card-block look
 * for /learning/downloads/ itself.
 *
 * @param WP_Post $post
 * @return string
 */
function bitesmart_render_coloring_book_card( $post ) {
    $number   = get_post_meta( $post->ID, '_bitesmart_coloring_book_episode_number', true );
    $pdf_en   = get_post_meta( $post->ID, '_bitesmart_coloring_book_pdf_url_en', true );
    $pdf_es   = get_post_meta( $post->ID, '_bitesmart_coloring_book_pdf_url_es', true );
    $block_id = bitesmart_coloring_book_anchor_id( $post );
    $en_id    = 'ecd-en-' . $block_id;
    $es_id    = 'ecd-es-' . $block_id;
    $group_id = 'ecd-grp-' . $block_id;

    $en_row = bitesmart_coloring_book_language_row( 'en', $pdf_en, $en_id, $group_id, true, true );
    $es_row = bitesmart_coloring_book_language_row( 'es', $pdf_es, $es_id, $group_id, true, true );

    ob_start();
    ?>
    <section id="<?php echo esc_attr( $block_id ); ?>" class="download-card-block coloring-book-card">
        <?php if ( $number ) : ?>
            <div class="bright-chip"><?php echo esc_html( $number ); ?></div>
        <?php endif; ?>

        <div class="ecd-header">
            <span class="capitalized-and-colored">
                <?php
                echo esc_html(
                    $number
                        /* translators: %s: episode number */
                        ? sprintf( __( 'Episode %s · Coloring Book', 'custom-blocks' ), $number )
                        : __( 'Coloring Book', 'custom-blocks' )
                );
                ?>
            </span>
            <h3 class="ecd-title"><?php echo esc_html( get_the_title( $post ) ); ?></h3>
        </div>

        <div class="download-card-buttons">
            <?php
            echo $en_row; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already-escaped HTML from bitesmart_coloring_book_language_row()
            echo $es_row; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- already-escaped HTML from bitesmart_coloring_book_language_row()
            ?>
        </div>

        <?php if ( $pdf_en ) : ?>
            <div id="<?php echo esc_attr( $en_id ); ?>" class="ecd-viewer">
                <iframe data-src="<?php echo esc_url( $pdf_en ); ?>" width="100%" height="600px" title="<?php esc_attr_e( 'PDF Document (ENG)', 'custom-blocks' ); ?>"></iframe>
            </div>
        <?php endif; ?>

        <?php if ( $pdf_es ) : ?>
            <div id="<?php echo esc_attr( $es_id ); ?>" class="ecd-viewer">
                <iframe data-src="<?php echo esc_url( $pdf_es ); ?>" width="100%" height="600px" title="<?php esc_attr_e( 'PDF Document (ES)', 'custom-blocks' ); ?>"></iframe>
            </div>
        <?php endif; ?>
    </section>
    <?php
    return ob_get_clean();
}

/**
 * Render callback for "custom/coloring-book" — one coloring book, full
 * card (View PDF + Download per language, inline viewers). Used both for
 * an editor manually placing a single coloring book somewhere, and by
 * render_coloring_books_list_block() (coloring-books-list.php) for each
 * item in the auto-listed /learning/downloads/ page.
 */
function render_coloring_book_block( $attributes ) {
    $coloring_book_id = isset( $attributes['coloringBookId'] ) ? (int) $attributes['coloringBookId'] : 0;
    $post             = $coloring_book_id ? get_post( $coloring_book_id ) : null;

    if ( ! $post || 'coloring_book' !== $post->post_type || 'publish' !== $post->post_status ) {
        // Front end: render nothing (e.g. coloring book was later trashed).
        // The editor's own Placeholder/picker covers the empty state there.
        return '';
    }

    return bitesmart_render_coloring_book_card( $post );
}

