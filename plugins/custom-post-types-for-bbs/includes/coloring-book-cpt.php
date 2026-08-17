<?php
/**
 * Coloring Book custom post type.
 *
 * This plugin (Custom Post Types for BBS) owns the CONTENT MODEL only — the
 * post type itself, its meta fields, and attaching it to the Stage, Topic,
 * and Series taxonomies. The editing UI (custom/coloring-book-fields, locked
 * into this post type's content template below) and the front-end display
 * blocks (custom/coloring-book, custom/coloring-books-list) both live in the
 * separate "Custom Blocks for Be BiteSmart" plugin — see that plugin's
 * src/coloring-book-fields/ and src/coloring-book-display/. That plugin
 * declares this one as a dependency (its "Requires Plugins" header), so
 * WordPress won't let it activate without this plugin also active.
 *
 * Built as a real CPT — like Episode, Q&A Entry, and Resource — rather than
 * as raw block attributes on whatever page happens to embed a coloring book
 * (which is how custom/educational-coloring-book-download works). Two
 * reasons, both from a 2026-08-13 conversation with Janet:
 *
 *   1. Editor ergonomics: adding a new coloring book is "Add New Coloring
 *      Book" in wp-admin, filling in a structured form, same workflow as
 *      every other content type here — not opening /learning/downloads/ in
 *      the block editor and hand-duplicating a block instance.
 *   2. It plugs straight into the existing Learning Hub Search machinery
 *      (see learning-search.php's bitesmart_build_stage_card_list()) the
 *      same way Episode/Q&A Entry/Resource already do, once Stage/Topic
 *      terms are set — no separate Resource entry + stable-anchor-id
 *      workaround needed just to make a coloring book findable in search.
 *
 * Search cards show the coloring book's own EN/ES Download buttons inline
 * (see render_coloring_book_search_card() in coloring-book-display.php) —
 * unlike Episode, which links out to its own real embed instead of
 * duplicating a video player inline. That's a deliberate difference: a
 * coloring book's "real thing" is just two buttons, light enough to embed
 * directly, where Episode's real thing (video player, language picker,
 * thumbnail) genuinely isn't.
 *
 * "Headless" CPT, same reasoning as Episode/Resource: no theme in this
 * install to render a standalone permalink page, so public/publicly_queryable
 * are false and it's only ever displayed embedded.
 */

function bitesmart_register_coloring_book_post_type() {
    register_post_type( 'coloring_book', array(
        'labels'              => array(
            'name'          => __( 'Coloring Books', 'custom-post-types-for-bbs' ),
            'singular_name' => __( 'Coloring Book', 'custom-post-types-for-bbs' ),
            'add_new_item'  => __( 'Add New Coloring Book', 'custom-post-types-for-bbs' ),
            'edit_item'     => __( 'Edit Coloring Book', 'custom-post-types-for-bbs' ),
            'new_item'      => __( 'New Coloring Book', 'custom-post-types-for-bbs' ),
            'view_item'     => __( 'View Coloring Book', 'custom-post-types-for-bbs' ),
            'search_items'  => __( 'Search Coloring Books', 'custom-post-types-for-bbs' ),
            'not_found'     => __( 'No coloring books found', 'custom-post-types-for-bbs' ),
            'all_items'     => __( 'All Coloring Books', 'custom-post-types-for-bbs' ),
        ),
        // 'editor' + 'custom-fields' are both required — see the long
        // comment in episode-cpt.php's 'supports' entry for exactly why
        // (block editor won't load at all without 'editor'; registered meta
        // silently vanishes from REST without 'custom-fields'). Same two
        // gotchas apply here verbatim.
        'supports'            => array( 'title', 'editor', 'custom-fields' ),
        // Locks the canvas to exactly one instance of custom/coloring-book-fields —
        // editors can't add, remove, or reorder blocks on a Coloring Book post.
        'template'            => array(
            array( 'custom/coloring-book-fields' ),
        ),
        'template_lock'       => 'all',
        'public'              => false,
        'publicly_queryable'  => false,
        'show_ui'             => true,
        'show_in_menu'        => true,
        'show_in_admin_bar'   => true,
        'show_in_nav_menus'   => false,
        'exclude_from_search' => true,
        'has_archive'         => false,
        'rewrite'             => false,
        'show_in_rest'        => true, // required for the block editor + REST access
        'rest_base'           => 'coloring_book',
        'menu_icon'           => 'dashicons-art',
        'menu_position'       => 23,
        'capability_type'     => 'post',
    ) );

    // Attaches Coloring Book to the shared Stage/Topic taxonomies
    // (includes/stage-taxonomy.php, includes/topic-taxonomy.php, this
    // plugin) so coloring books can be tagged and picked up by
    // bitesmart_build_stage_card_list() in learning-search.php, same as
    // Q&A Entry/Resource/Episode.
    register_taxonomy_for_object_type( 'stage', 'coloring_book' );
    register_taxonomy_for_object_type( 'topic', 'coloring_book' );

    // Attaches Coloring Book to the Series taxonomy
    // (includes/series-taxonomy.php) — currently just "Paws To Prevent",
    // same as Episode. Used to build a stable per-coloring-book anchor id
    // (e.g. "coloring-book-paws-to-prevent-ep-1") in the Custom Blocks
    // plugin's coloring-book-display.php — see
    // bitesmart_coloring_book_anchor_id() there.
    register_taxonomy_for_object_type( 'series', 'coloring_book' );

    bitesmart_register_coloring_book_meta();
}
add_action( 'init', 'bitesmart_register_coloring_book_post_type' );

/**
 * All current content targets the one existing series ("Paws To Prevent"),
 * so new Coloring Book posts default there — same reasoning and same known
 * WP core autosave edge case as bitesmart_default_episode_series_term() in
 * episode-cpt.php (see its comment for why this is a save_post hook rather
 * than the 'default_term' taxonomy arg).
 */
function bitesmart_default_coloring_book_series_term( $post_id, $post, $update ) {
    if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
        return;
    }

    if ( ! has_term( '', 'series', $post_id ) ) {
        wp_set_object_terms( $post_id, 'paws-to-prevent', 'series' );
    }
}
add_action( 'save_post_coloring_book', 'bitesmart_default_coloring_book_series_term', 10, 3 );

/**
 * Coloring book content is relevant to both Toddler and Preschool (unlike
 * Episode, which is Preschool-only), so new Coloring Book posts default to
 * BOTH stage terms — same reasoning and same known WP core autosave edge
 * case as bitesmart_default_episode_stage_term() in episode-cpt.php (see
 * its comment for why this is a save_post hook rather than the
 * 'default_term' taxonomy arg). Only fires when the post genuinely has
 * zero stage terms at save time, so it never overrides an editor's real
 * choice — including an editor who deliberately narrows it to just one of
 * the two afterward.
 */
function bitesmart_default_coloring_book_stage_terms( $post_id, $post, $update ) {
    if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
        return;
    }

    if ( ! has_term( '', 'stage', $post_id ) ) {
        wp_set_object_terms( $post_id, array( 'toddler', 'preschool' ), 'stage' );
    }
}
add_action( 'save_post_coloring_book', 'bitesmart_default_coloring_book_stage_terms', 10, 3 );

/**
 * The native Title field sits above the locked custom/coloring-book-fields
 * block with nothing visually tying the two together — same placeholder fix
 * as Episode's, see bitesmart_episode_title_placeholder() in episode-cpt.php.
 */
function bitesmart_coloring_book_title_placeholder( $title, $post ) {
    if ( $post && 'coloring_book' === $post->post_type ) {
        $title = __( 'Coloring book title (e.g. "Meet Bailey the Beagle")', 'custom-post-types-for-bbs' );
    }
    return $title;
}
add_filter( 'enter_title_here', 'bitesmart_coloring_book_title_placeholder', 10, 2 );

/**
 * Only editors who can edit the specific coloring book can read/write its
 * meta via REST — matches core's own default post-meta authorization, made
 * explicit since register_post_meta() requires an auth_callback once
 * show_in_rest is set.
 */
function bitesmart_coloring_book_meta_auth_callback( $allowed, $meta_key, $post_id ) {
    return current_user_can( 'edit_post', $post_id );
}

/**
 * Sanitize the per-language search-matching Keywords map — same shape and
 * reasoning as bitesmart_sanitize_resource_keywords_by_lang() in
 * resource-cpt.php / bitesmart_sanitize_episode_keywords_by_lang() in
 * episode-cpt.php (free-form comma-separated phrases per language).
 *
 * @param mixed $value Raw value.
 * @return array<string, string>
 */
function bitesmart_sanitize_coloring_book_keywords_by_lang( $value ) {
    $clean = array();

    if ( is_array( $value ) ) {
        foreach ( $value as $code => $text ) {
            $code = sanitize_key( $code );
            $text = sanitize_text_field( (string) $text );
            if ( $code && $text !== '' ) {
                $clean[ $code ] = $text;
            }
        }
    }

    return $clean;
}

/**
 * All custom fields for the Coloring Book CPT. Native fields (title) need
 * no registration here — only data that doesn't map onto a native post
 * field lives in post meta. PDFs are English/Spanish only (not looped over
 * every site language) — matches the two languages
 * custom/educational-coloring-book-download originally supported.
 */
function bitesmart_register_coloring_book_meta() {
    register_post_meta( 'coloring_book', '_bitesmart_coloring_book_episode_number', array(
        'type'              => 'string',
        'single'            => true,
        'default'           => '',
        'sanitize_callback' => 'sanitize_text_field',
        'show_in_rest'      => true,
        'auth_callback'     => 'bitesmart_coloring_book_meta_auth_callback',
    ) );

    register_post_meta( 'coloring_book', '_bitesmart_coloring_book_pdf_url_en', array(
        'type'              => 'string',
        'single'            => true,
        'default'           => '',
        'sanitize_callback' => 'esc_url_raw',
        'show_in_rest'      => true,
        'auth_callback'     => 'bitesmart_coloring_book_meta_auth_callback',
    ) );

    register_post_meta( 'coloring_book', '_bitesmart_coloring_book_pdf_url_es', array(
        'type'              => 'string',
        'single'            => true,
        'default'           => '',
        'sanitize_callback' => 'esc_url_raw',
        'show_in_rest'      => true,
        'auth_callback'     => 'bitesmart_coloring_book_meta_auth_callback',
    ) );

    // Per-language search-matching phrases — plain internal data, NOT
    // rendered as visible page text, so TranslatePress's normal translation
    // won't pick it up automatically (same caveat as Episode's/Resource's
    // Keywords — see [[be-bitesmart-qa-resource-data-model]] in memory).
    register_post_meta( 'coloring_book', '_bitesmart_coloring_book_keywords_by_lang', array(
        'type'              => 'object',
        'single'            => true,
        'default'           => array(),
        'sanitize_callback' => 'bitesmart_sanitize_coloring_book_keywords_by_lang',
        'show_in_rest'      => array(
            'schema' => array(
                'type'                 => 'object',
                'additionalProperties' => array( 'type' => 'string' ),
            ),
        ),
        'auth_callback'     => 'bitesmart_coloring_book_meta_auth_callback',
    ) );
}
