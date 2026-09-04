<?php
/**
 * Q&A Entry custom post type.
 *
 * This plugin (Custom Post Types for BBS) owns the CONTENT MODEL only —
 * the post type itself, its meta fields, and attaching it to the Stage and
 * Topic taxonomies. The editing UI (custom/qa-entry-fields, locked into
 * this post type's content template below) and the front-end display block
 * (custom/qa-entry) both live in the separate "Custom Blocks for Be
 * BiteSmart" plugin — see that plugin's src/qa-entry-fields/ and
 * src/qa-entry-display/. That plugin declares this one as a dependency (its
 * "Requires Plugins" header), so WordPress won't let it activate without
 * this plugin also active.
 *
 * Field spec is the original one from [[be-bitesmart-qa-resource-data-model]]
 * in memory: a question, a Short/Long Answer toggle, answer text (complete
 * for Short, a teaser for Long), a Link Destination that resolves to either
 * a real Resource post (see resource-cpt.php) or a plain URL, Stage/Topic
 * tags, and per-language search synonyms. "Headless" CPT for the same
 * reason as Episode and Resource: no theme in this install to render a
 * standalone permalink page, so it's only ever displayed embedded via
 * custom/qa-entry.
 *
 * Added since that original spec, per [[be-bitesmart-qa-chapter-link-plan]]
 * in memory: an optional link to a Guide Chapter this entry covers one
 * aspect of (_bitesmart_qa_link_chapter_id, entirely separate from Link
 * Destination above), plus which of that chapter's Synonyms this entry
 * opts out of inheriting (_bitesmart_qa_chapter_synonym_excludes_by_lang).
 */

function bitesmart_register_qa_entry_post_type() {
    register_post_type( 'qa_entry', array(
        'labels'              => array(
            'name'          => __( 'Q&A Entries', 'custom-post-types-for-bbs' ),
            'singular_name' => __( 'Q&A Entry', 'custom-post-types-for-bbs' ),
            'add_new_item'  => __( 'Add New Q&A Entry', 'custom-post-types-for-bbs' ),
            'edit_item'     => __( 'Edit Q&A Entry', 'custom-post-types-for-bbs' ),
            'new_item'      => __( 'New Q&A Entry', 'custom-post-types-for-bbs' ),
            'view_item'     => __( 'View Q&A Entry', 'custom-post-types-for-bbs' ),
            'search_items'  => __( 'Search Q&A Entries', 'custom-post-types-for-bbs' ),
            'not_found'     => __( 'No Q&A entries found', 'custom-post-types-for-bbs' ),
            'all_items'     => __( 'All Q&A Entries', 'custom-post-types-for-bbs' ),
        ),
        // 'editor' + 'custom-fields' are both required — see the long
        // comment in episode-cpt.php's 'supports' entry for exactly why
        // (block editor won't load at all without 'editor'; registered meta
        // silently vanishes from REST without 'custom-fields'). Same two
        // gotchas apply here verbatim.
        //
        // The Question itself is the native Title field (same idea as
        // Episode's title = episode title) — everything else (answer,
        // link destination, synonyms) is custom meta in the locked
        // custom/qa-entry-fields block below.
        'supports'            => array( 'title', 'editor', 'custom-fields' ),
        'template'            => array(
            array( 'custom/qa-entry-fields' ),
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
        'rest_base'           => 'qa_entry',
        'menu_icon'           => 'dashicons-editor-help',
        'menu_position'       => 22,
        'capability_type'     => 'post',
    ) );

    // Attaches Q&A Entry to the shared Stage and Topic taxonomies
    // (includes/stage-taxonomy.php and includes/topic-taxonomy.php, this
    // plugin). Requires both to already be registered — see the
    // load-order note in each of those files.
    register_taxonomy_for_object_type( 'stage', 'qa_entry' );
    register_taxonomy_for_object_type( 'topic', 'qa_entry' );

    // Attaches Q&A Entry to the shared Media Type taxonomy
    // (includes/media-type-taxonomy.php) — drives the Learning Hub's
    // "Filter by type" checkboxes (see bitesmart_default_qa_entry_media_type_term()
    // below for the default this CPT applies).
    register_taxonomy_for_object_type( 'media_type', 'qa_entry' );

    bitesmart_register_qa_entry_meta();
}
add_action( 'init', 'bitesmart_register_qa_entry_post_type' );

/**
 * A Q&A Entry defaults to a short inline answer (_bitesmart_qa_answer_type
 * itself defaults to 'short' — see bitesmart_register_qa_entry_meta() below),
 * so new Q&A Entry posts default to the "Short Answer" Media Type term too —
 * same reasoning and same known WP core autosave edge case as
 * bitesmart_default_episode_stage_term() in episode-cpt.php (see its comment
 * for why this is a save_post hook rather than the 'default_term' taxonomy
 * arg). Only fires when the post genuinely has zero Media Type terms at save
 * time, so it never overrides an editor's real choice — e.g. an entry with a
 * Long Answer that links out to an Article, or one that embeds a video.
 */
function bitesmart_default_qa_entry_media_type_term( $post_id, $post, $update ) {
    if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
        return;
    }

    if ( ! has_term( '', 'media_type', $post_id ) ) {
        wp_set_object_terms( $post_id, 'short-answer', 'media_type' );
    }
}
add_action( 'save_post_qa_entry', 'bitesmart_default_qa_entry_media_type_term', 10, 3 );

/**
 * The native Title field sits above the locked custom/qa-entry-fields block
 * with nothing visually tying the two together — same placeholder fix as
 * Episode's, see bitesmart_episode_title_placeholder() in episode-cpt.php.
 * Here the title placeholder doubles as an instruction that Title IS the
 * question, not just a label for it.
 */
function bitesmart_qa_entry_title_placeholder( $title, $post ) {
    if ( $post && 'qa_entry' === $post->post_type ) {
        $title = __( 'Type the question here (e.g. "Why does my dog growl at strangers?")', 'custom-post-types-for-bbs' );
    }
    return $title;
}
add_filter( 'enter_title_here', 'bitesmart_qa_entry_title_placeholder', 10, 2 );

/**
 * Only editors who can edit the specific Q&A entry can read/write its meta
 * via REST — matches core's own default post-meta authorization, made
 * explicit since register_post_meta() requires an auth_callback once
 * show_in_rest is set.
 */
function bitesmart_qa_entry_meta_auth_callback( $allowed, $meta_key, $post_id ) {
    return current_user_can( 'edit_post', $post_id );
}

/**
 * Sanitize the per-language Synonyms map — same shape and same reasoning as
 * bitesmart_sanitize_resource_keywords_by_lang() in resource-cpt.php (free-
 * form comma-separated phrases per language, e.g. "growl, growling,
 * snapped, aggressive").
 *
 * @param mixed $value Raw value.
 * @return array<string, string>
 */
function bitesmart_sanitize_qa_entry_synonyms_by_lang( $value ) {
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
 * Sanitize the per-language chapter-synonym excludes map — the tokens a Q&A
 * Entry has opted OUT of inheriting from its linked Guide Chapter's Synonyms
 * (_bitesmart_qa_link_chapter_id / _bitesmart_chapter_keywords_by_lang, see
 * guide-chapter-cpt.php). See [[be-bitesmart-qa-chapter-link-plan]] in
 * memory for the full design: this entry never stores a copy of the
 * chapter's synonym list, only which of the chapter's current tokens it's
 * turned off — everything else in the chapter's list still applies
 * automatically, by default. Matching against the chapter's list happens by
 * trimmed, case-insensitive text (bitesmart_qa_entry_chapter_keywords() in
 * learning-search.php, custom-blocks plugin) rather than a stable id,
 * deliberately — see that function's own comment for why a text-based match
 * is safe here (the chapter's own Synonyms field became add/remove-only,
 * not rename-in-place, specifically so this couldn't drift).
 *
 * @param mixed $value Raw value.
 * @return array<string, array<int, string>>
 */
function bitesmart_sanitize_qa_chapter_synonym_excludes_by_lang( $value ) {
    $clean = array();

    if ( is_array( $value ) ) {
        foreach ( $value as $code => $tokens ) {
            $code = sanitize_key( $code );
            if ( ! $code || ! is_array( $tokens ) ) {
                continue;
            }

            $tokens = array_map(
                function ( $token ) {
                    return sanitize_text_field( trim( (string) $token ) );
                },
                $tokens
            );
            $tokens = array_values( array_unique( array_filter( $tokens ) ) );

            if ( $tokens ) {
                $clean[ $code ] = $tokens;
            }
        }
    }

    return $clean;
}

/**
 * Answer Type is a fixed two-value toggle (Short Answer / Long Answer) —
 * anything else input falls back to 'short' rather than being stored as-is.
 *
 * @param mixed $value Raw value.
 * @return string 'short' or 'long'.
 */
function bitesmart_sanitize_qa_entry_answer_type( $value ) {
    return 'long' === $value ? 'long' : 'short';
}

/**
 * Link Destination's type flag — either a real Resource post
 * (_bitesmart_qa_link_resource_id) or a plain URL
 * (_bitesmart_qa_link_url), never both meaningfully at once. Anything else
 * input falls back to 'url'.
 *
 * @param mixed $value Raw value.
 * @return string 'resource' or 'url'.
 */
function bitesmart_sanitize_qa_entry_link_type( $value ) {
    return 'resource' === $value ? 'resource' : 'url';
}

/**
 * All custom fields for the Q&A Entry CPT. Native fields (title) need no
 * registration here — only data that doesn't map onto a native post field
 * lives in post meta.
 */
function bitesmart_register_qa_entry_meta() {
    register_post_meta( 'qa_entry', '_bitesmart_qa_answer_type', array(
        'type'              => 'string',
        'single'            => true,
        'default'           => 'short',
        'sanitize_callback' => 'bitesmart_sanitize_qa_entry_answer_type',
        'show_in_rest'      => array(
            'schema' => array(
                'type' => 'string',
                'enum' => array( 'short', 'long' ),
            ),
        ),
        'auth_callback'     => 'bitesmart_qa_entry_meta_auth_callback',
    ) );

    // For Short Answer, this is the complete inline answer. For Long
    // Answer, it's a teaser shown alongside the Link Destination's
    // "Read the full guide" link — same field, meaning depends on
    // _bitesmart_qa_answer_type (enforced in the editing UI, not here).
    register_post_meta( 'qa_entry', '_bitesmart_qa_answer_text', array(
        'type'              => 'string',
        'single'            => true,
        'default'           => '',
        'sanitize_callback' => 'sanitize_textarea_field', // preserves line breaks, strips tags
        'show_in_rest'      => true,
        'auth_callback'     => 'bitesmart_qa_entry_meta_auth_callback',
    ) );

    register_post_meta( 'qa_entry', '_bitesmart_qa_link_type', array(
        'type'              => 'string',
        'single'            => true,
        'default'           => 'url',
        'sanitize_callback' => 'bitesmart_sanitize_qa_entry_link_type',
        'show_in_rest'      => array(
            'schema' => array(
                'type' => 'string',
                'enum' => array( 'resource', 'url' ),
            ),
        ),
        'auth_callback'     => 'bitesmart_qa_entry_meta_auth_callback',
    ) );

    // Used when _bitesmart_qa_link_type is 'resource' — a real Resource
    // post ID (see resource-cpt.php). At search-index-build time (a later,
    // not-yet-built step per the original spec), that Resource's Keywords
    // get merged into this entry's search-matching data.
    register_post_meta( 'qa_entry', '_bitesmart_qa_link_resource_id', array(
        'type'          => 'integer',
        'single'        => true,
        'default'       => 0,
        'show_in_rest'  => true,
        'auth_callback' => 'bitesmart_qa_entry_meta_auth_callback',
    ) );

    // Used when _bitesmart_qa_link_type is 'url' — a plain stage-page
    // anchor URL (or any other destination not backed by a Resource post).
    register_post_meta( 'qa_entry', '_bitesmart_qa_link_url', array(
        'type'              => 'string',
        'single'            => true,
        'default'           => '',
        'sanitize_callback' => 'esc_url_raw',
        'show_in_rest'      => true,
        'auth_callback'     => 'bitesmart_qa_entry_meta_auth_callback',
    ) );

    // Optional link to a Guide Chapter this entry covers one aspect of (see
    // guide-chapter-cpt.php) — same relationship-via-meta pattern as
    // _bitesmart_qa_link_resource_id above, entirely independent of Link
    // Destination/_bitesmart_qa_link_type (a Q&A Entry can be linked to a
    // chapter AND separately link out to a Resource or URL). When set, this
    // entry inherits the chapter's Synonyms for search matching instead of
    // its own _bitesmart_qa_synonyms_by_lang — see
    // bitesmart_qa_entry_chapter_keywords() in learning-search.php
    // (custom-blocks plugin) and [[be-bitesmart-qa-chapter-link-plan]] in
    // memory for the full design.
    register_post_meta( 'qa_entry', '_bitesmart_qa_link_chapter_id', array(
        'type'          => 'integer',
        'single'        => true,
        'default'       => 0,
        'show_in_rest'  => true,
        'auth_callback' => 'bitesmart_qa_entry_meta_auth_callback',
    ) );

    // Which of the linked chapter's current Synonyms (see
    // _bitesmart_qa_link_chapter_id above) this entry has opted OUT of —
    // everything else in the chapter's list still applies by default.
    // Meaningless when _bitesmart_qa_link_chapter_id is 0; the editing UI
    // (qa-entry-fields/index.js) resets this to {} whenever the chapter link
    // changes or is cleared, since an exclude list only makes sense relative
    // to the specific chapter it was recorded against.
    register_post_meta( 'qa_entry', '_bitesmart_qa_chapter_synonym_excludes_by_lang', array(
        'type'              => 'object',
        'single'            => true,
        'default'           => array(),
        'sanitize_callback' => 'bitesmart_sanitize_qa_chapter_synonym_excludes_by_lang',
        'show_in_rest'      => array(
            'schema' => array(
                'type'                 => 'object',
                'additionalProperties' => array(
                    'type'  => 'array',
                    'items' => array( 'type' => 'string' ),
                ),
            ),
        ),
        'auth_callback'     => 'bitesmart_qa_entry_meta_auth_callback',
    ) );

    // Per-language search-matching phrases parents might search with (e.g.
    // "growl, growling, snapped, aggressive") — plain internal data, NOT
    // rendered as visible page text, so TranslatePress's normal translation
    // won't pick it up automatically (see the translation caveat in
    // [[be-bitesmart-qa-resource-data-model]]). Same shape as Resource's
    // Keywords field, per Janet's decision when this CPT was scoped.
    register_post_meta( 'qa_entry', '_bitesmart_qa_synonyms_by_lang', array(
        'type'              => 'object',
        'single'            => true,
        'default'           => array(),
        'sanitize_callback' => 'bitesmart_sanitize_qa_entry_synonyms_by_lang',
        'show_in_rest'      => array(
            'schema' => array(
                'type'                 => 'object',
                'additionalProperties' => array( 'type' => 'string' ),
            ),
        ),
        'auth_callback'     => 'bitesmart_qa_entry_meta_auth_callback',
    ) );
}
