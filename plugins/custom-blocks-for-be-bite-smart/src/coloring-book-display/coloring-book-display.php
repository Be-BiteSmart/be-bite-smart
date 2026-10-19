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
 * Adapt the Coloring Book CPT data to the shared download-card renderer.
 *
 * @param WP_Post $post
 * @return string
 */
function bitesmart_render_coloring_book_card( $post ) {
    $number   = get_post_meta( $post->ID, '_bitesmart_coloring_book_episode_number', true );
    $pdf_en   = get_post_meta( $post->ID, '_bitesmart_coloring_book_pdf_url_en', true );
    $pdf_es   = get_post_meta( $post->ID, '_bitesmart_coloring_book_pdf_url_es', true );
    $block_id = bitesmart_coloring_book_anchor_id( $post );
    return bitesmart_render_download_card(
        array(
            'id'             => $block_id,
            'class_name'     => 'coloring-book-card',
            'toggle_prefix'  => 'ecd',
            'number'         => $number,
            'number_label'   => __( 'Episode', 'custom-blocks' ),
            'type'           => __( 'Coloring Book', 'custom-blocks' ),
            'title'          => get_the_title( $post ),
            'item_label'     => __( 'PDF', 'custom-blocks' ),
            'viewer_enabled' => true,
            'languages'      => array(
                'en' => array(
                    'pdf_url'    => $pdf_en,
                    'coming_soon' => true,
                ),
                'es' => array(
                    'pdf_url'    => $pdf_es,
                    'coming_soon' => true,
                ),
            ),
        )
    );
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
