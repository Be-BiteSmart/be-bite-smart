<?php
/**
 * Book custom post type — book recommendations (e.g. "Doggie Language: A Dog
 * Lover's Guide to Understanding Your Best Friend"), not BBS-specific
 * content but tagged and surfaced the same way everything else in the
 * Learning Hub is.
 *
 * This plugin (Custom Post Types for BBS) owns the CONTENT MODEL only — the
 * post type itself, its meta fields, and attaching it to the Stage and Topic
 * taxonomies (NOT Series — books aren't tied to the "Paws To Prevent" show
 * the way Episode/Coloring Book are). The editing UI
 * (custom/book-panel) and the front-end display block (custom/book) both
 * live in the separate "Custom Blocks for Be BiteSmart" plugin — see that
 * plugin's src/book-panel/ and src/book-display/. That plugin declares this
 * one as a dependency (its "Requires Plugins" header), so WordPress won't
 * let it activate without this plugin also active.
 *
 * A Book is deliberately built DIFFERENTLY from Episode/Resource/Q&A
 * Entry/Coloring Book, which all lock the block editor canvas to one custom
 * fields block, because every field THOSE have is either a plain value or a
 * short piece of text. A book's "why we recommend it" text is real
 * multi-paragraph, sometimes-bulleted prose — too rich for a plain meta
 * textarea. Guide Chapter already solved this exact problem (see
 * guide-chapter-cpt.php), so Book borrows that same mechanism: the canvas
 * stays UNLOCKED, post_content IS the recommendation body, authored with
 * WordPress's real block editor — but restricted (see
 * bitesmart_restrict_book_allowed_blocks() below) to just Paragraph/List,
 * since this is a short blurb, not a full article. Everything else (Featured
 * Image aside) lives in a sidebar panel (custom/book-panel, a
 * PluginDocumentSettingPanel — NOT a locked template block, same reasoning
 * as custom/guide-chapter-panel) rather than a canvas block, for the same
 * "canvas has to stay free for content authoring" reason.
 *
 * UNLIKE Guide Chapter, Book stays HEADLESS (public/publicly_queryable
 * false) — same as Episode/Resource/Coloring Book: no theme in this install
 * renders a standalone permalink page, so a book is only ever displayed
 * embedded via custom/book, wherever an editor manually places it on a
 * topic page, plus picked up automatically by Stage-tagged Learning Hub
 * search/browse (see bitesmart_build_stage_card_list() in
 * learning-search.php, Custom Blocks plugin).
 *
 * No default Stage-term auto-assignment on save (unlike Episode/Coloring
 * Book) — deliberate, per Janet: which Stage(s) a book fits varies a lot
 * per book (a photo-heavy body-language book might suit a parent AND a
 * preschooler, while a dense photographic reference is adult-only), so
 * every new Book starts untagged and an editor picks Stage term(s)
 * manually every time.
 */

function bitesmart_register_book_post_type() {
    register_post_type( 'book', array(
        'labels'              => array(
            'name'          => __( 'Books', 'custom-post-types-for-bbs' ),
            'singular_name' => __( 'Book', 'custom-post-types-for-bbs' ),
            'add_new_item'  => __( 'Add New Book', 'custom-post-types-for-bbs' ),
            'edit_item'     => __( 'Edit Book', 'custom-post-types-for-bbs' ),
            'new_item'      => __( 'New Book', 'custom-post-types-for-bbs' ),
            'view_item'     => __( 'View Book', 'custom-post-types-for-bbs' ),
            'search_items'  => __( 'Search Books', 'custom-post-types-for-bbs' ),
            'not_found'     => __( 'No books found', 'custom-post-types-for-bbs' ),
            'all_items'     => __( 'All Books', 'custom-post-types-for-bbs' ),
        ),
        // 'editor' + 'custom-fields' are both required — see the long
        // comment in episode-cpt.php's 'supports' entry for exactly why
        // (block editor won't load at all without 'editor'; registered meta
        // silently vanishes from REST without 'custom-fields'). Same two
        // gotchas apply here verbatim. Deliberately NO 'template'/
        // 'template_lock': unlike every other content type in this plugin
        // (Guide Chapter excepted), the canvas stays open — post_content is
        // the real recommendation body, restricted to Paragraph/List blocks
        // only via bitesmart_restrict_book_allowed_blocks() below.
        'supports'            => array( 'title', 'editor', 'thumbnail', 'custom-fields' ),
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
        'rest_base'           => 'book',
        'menu_icon'           => 'dashicons-book',
        'menu_position'       => 25,
        'capability_type'     => 'post',
    ) );

    // Attaches Book to the shared Stage/Topic taxonomies
    // (includes/stage-taxonomy.php, includes/topic-taxonomy.php, this
    // plugin) so books can be tagged and picked up by
    // bitesmart_build_stage_card_list() in learning-search.php, same as
    // Q&A Entry/Resource/Episode/Coloring Book. Deliberately NOT attached to
    // 'series' — books aren't episodes of "Paws To Prevent".
    register_taxonomy_for_object_type( 'stage', 'book' );
    register_taxonomy_for_object_type( 'topic', 'book' );

    bitesmart_register_book_meta();
}
add_action( 'init', 'bitesmart_register_book_post_type' );

/**
 * Restricts the Book edit screen's canvas to Paragraph and List blocks only
 * — no headings, images, embeds, etc. inline. The one genuinely new
 * mechanism this CPT needed: no other post type here combines an unlocked
 * canvas (Guide Chapter's trick, for real rich content) with a content
 * restriction (every OTHER post type's trick, but via template_lock on a
 * single fields block, which doesn't apply to an unlocked canvas). A book's
 * cover comes from the native Featured Image field, not inline content, so
 * there's no need for the Image block here.
 *
 * @param array|bool               $allowed_block_types
 * @param WP_Block_Editor_Context  $context
 * @return array|bool
 */
function bitesmart_restrict_book_allowed_blocks( $allowed_block_types, $context ) {
    if ( ! $context->post || 'book' !== $context->post->post_type ) {
        return $allowed_block_types;
    }

    return array( 'core/paragraph', 'core/list', 'core/list-item' );
}
add_filter( 'allowed_block_types_all', 'bitesmart_restrict_book_allowed_blocks', 10, 2 );

/**
 * The native Title field sits above whatever the editor's authored in the
 * canvas with nothing tying the two together — same placeholder fix as
 * every other CPT's, see bitesmart_episode_title_placeholder() in
 * episode-cpt.php.
 */
function bitesmart_book_title_placeholder( $title, $post ) {
    if ( $post && 'book' === $post->post_type ) {
        $title = __( 'Book title (e.g. "Doggie Language: A Dog Lover\'s Guide")', 'custom-post-types-for-bbs' );
    }
    return $title;
}
add_filter( 'enter_title_here', 'bitesmart_book_title_placeholder', 10, 2 );

/**
 * Only editors who can edit the specific book can read/write its meta via
 * REST — matches core's own default post-meta authorization, made explicit
 * since register_post_meta() requires an auth_callback once show_in_rest is
 * set.
 */
function bitesmart_book_meta_auth_callback( $allowed, $meta_key, $post_id ) {
    return current_user_can( 'edit_post', $post_id );
}

/**
 * Audience is a fixed two-value toggle (For Readers of Any Age / For Adult
 * Readers) — anything else input falls back to 'all_ages' rather than being
 * stored as-is. Same shape/reasoning as
 * bitesmart_sanitize_qa_entry_answer_type() in qa-entry-cpt.php.
 *
 * @param mixed $value Raw value.
 * @return string 'all_ages' or 'adult'.
 */
function bitesmart_sanitize_book_audience( $value ) {
    return 'adult' === $value ? 'adult' : 'all_ages';
}

/**
 * Sanitize the per-language search-matching Keywords map — same shape and
 * reasoning as bitesmart_sanitize_coloring_book_keywords_by_lang() in
 * coloring-book-cpt.php (free-form comma-separated phrases per language).
 *
 * @param mixed $value Raw value.
 * @return array<string, string>
 */
function bitesmart_sanitize_book_keywords_by_lang( $value ) {
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
 * All custom fields for the Book CPT. Native fields (title, thumbnail, the
 * recommendation body itself via post_content) need no registration here —
 * only data that doesn't map onto a native post field lives in post meta.
 */
function bitesmart_register_book_meta() {
    // Added 2026-08-16, per Janet: some book recommendations are kid-facing,
    // some are written for an adult reader (a parent), and Stage alone
    // doesn't communicate that (a book can span every Stage the way "dog
    // body language" knowledge is useful at any age). Janet's own framing
    // of the split — "For Readers of any age" vs. "For Adult Readers" —
    // rather than a literal "kids vs. adults" choice, since a kid-friendly
    // book is still perfectly fine for a parent to read too. Visual badge
    // only (see render_book_block()/render_book_search_card() in
    // book-display.php, Custom Blocks plugin) — deliberately NOT wired into
    // any Learning Hub search/browse filter; see
    // [[be-bitesmart-book-cpt-status]] in memory for the full reasoning.
    register_post_meta( 'book', '_bitesmart_book_audience', array(
        'type'              => 'string',
        'single'            => true,
        'default'           => 'all_ages',
        'sanitize_callback' => 'bitesmart_sanitize_book_audience',
        'show_in_rest'      => array(
            'schema' => array(
                'type' => 'string',
                'enum' => array( 'all_ages', 'adult' ),
            ),
        ),
        'auth_callback'     => 'bitesmart_book_meta_auth_callback',
    ) );

    // Freeform price/availability blurb, e.g. "$8.99 and widely available"
    // or "$20.00 at Dogwise.com and others" — matches how this info reads
    // in the hand-authored version this CPT replaces, kept as plain text
    // rather than a structured price+retailer pair since it's shown
    // verbatim, not computed on.
    register_post_meta( 'book', '_bitesmart_book_price_availability', array(
        'type'              => 'string',
        'single'            => true,
        'default'           => '',
        'sanitize_callback' => 'sanitize_text_field',
        'show_in_rest'      => true,
        'auth_callback'     => 'bitesmart_book_meta_auth_callback',
    ) );

    // Optional — a real buy/more-info link, same esc_url_raw convention as
    // Resource's _bitesmart_resource_url. Not every book will have one on
    // day one (the original hand-authored version only had informal
    // price/availability text), so the display block treats this as
    // optional throughout.
    register_post_meta( 'book', '_bitesmart_book_url', array(
        'type'              => 'string',
        'single'            => true,
        'default'           => '',
        'sanitize_callback' => 'esc_url_raw',
        'show_in_rest'      => true,
        'auth_callback'     => 'bitesmart_book_meta_auth_callback',
    ) );

    // Per-language search-matching phrases — plain internal data, NOT
    // rendered as visible page text, so TranslatePress's normal translation
    // won't pick it up automatically (same caveat as every other content
    // type's Keywords/Synonyms field — see
    // [[be-bitesmart-qa-resource-data-model]] in memory).
    register_post_meta( 'book', '_bitesmart_book_keywords_by_lang', array(
        'type'              => 'object',
        'single'            => true,
        'default'           => array(),
        'sanitize_callback' => 'bitesmart_sanitize_book_keywords_by_lang',
        'show_in_rest'      => array(
            'schema' => array(
                'type'                 => 'object',
                'additionalProperties' => array( 'type' => 'string' ),
            ),
        ),
        'auth_callback'     => 'bitesmart_book_meta_auth_callback',
    ) );
}
