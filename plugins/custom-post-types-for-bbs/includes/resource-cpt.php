<?php
/**
 * Resource custom post type.
 *
 * This plugin (Custom Post Types for BBS) owns the CONTENT MODEL only —
 * the post type itself, its meta fields, and attaching it to the Stage and
 * Topic taxonomies. The editing UI (custom/resource-fields, locked into
 * this post type's content template below) and the front-end display block
 * (custom/resource) both live in the separate "Custom Blocks for Be
 * BiteSmart" plugin — see that plugin's src/resource-fields/ and
 * src/resource-display/. That plugin declares this one as a dependency (its
 * "Requires Plugins" header), so WordPress won't let it activate without
 * this plugin also active.
 *
 * A Resource isn't a full content page — per the original field spec (see
 * [[be-bitesmart-qa-resource-data-model]] in memory), it's a title/excerpt/
 * URL card: a curated pointer to somewhere else (an external page, or a
 * stage-page anchor), meant to be embedded as a link-out card via
 * custom/resource, and/or referenced from a Q&A Entry's Link Destination
 * (see qa-entry-cpt.php) so that entry's "Read the full guide" link can
 * point at a real Resource post instead of a hand-typed URL. Same
 * "headless" reasoning as Episode: no theme in this install to render a
 * standalone permalink page, so public/publicly_queryable are false and
 * it's only ever displayed embedded.
 */

function bitesmart_register_resource_post_type() {
    register_post_type( 'resource', array(
        'labels'              => array(
            'name'          => __( 'Resources', 'custom-post-types-for-bbs' ),
            'singular_name' => __( 'Resource', 'custom-post-types-for-bbs' ),
            'add_new_item'  => __( 'Add New Resource', 'custom-post-types-for-bbs' ),
            'edit_item'     => __( 'Edit Resource', 'custom-post-types-for-bbs' ),
            'new_item'      => __( 'New Resource', 'custom-post-types-for-bbs' ),
            'view_item'     => __( 'View Resource', 'custom-post-types-for-bbs' ),
            'search_items'  => __( 'Search Resources', 'custom-post-types-for-bbs' ),
            'not_found'     => __( 'No resources found', 'custom-post-types-for-bbs' ),
            'all_items'     => __( 'All Resources', 'custom-post-types-for-bbs' ),
        ),
        // 'editor' + 'custom-fields' are both required — see the long
        // comment in episode-cpt.php's 'supports' entry for exactly why
        // (block editor won't load at all without 'editor'; registered meta
        // silently vanishes from REST without 'custom-fields'). Same two
        // gotchas apply here verbatim.
        //
        // Canvas is locked to exactly one custom/resource-fields block —
        // Excerpt, URL, and Keywords all live there as custom meta, same
        // reasoning as Episode's Description field (a collapsed native
        // Excerpt panel reads as "missing", and TranslatePress translates
        // whatever text renders on the page regardless of which WP field it
        // came from — see the CPT build pattern notes). Title stays native.
        'supports'            => array( 'title', 'editor', 'custom-fields' ),
        'template'            => array(
            array( 'custom/resource-fields' ),
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
        'rest_base'           => 'resource',
        'menu_icon'           => 'dashicons-media-document',
        'menu_position'       => 21,
        'capability_type'     => 'post',
    ) );

    // Attaches Resource to the shared Stage and Topic taxonomies
    // (includes/stage-taxonomy.php and includes/topic-taxonomy.php, this
    // plugin). Requires both to already be registered — see the
    // load-order note in each of those files.
    register_taxonomy_for_object_type( 'stage', 'resource' );
    register_taxonomy_for_object_type( 'topic', 'resource' );

    // Attaches Resource to the shared Media Type taxonomy
    // (includes/media-type-taxonomy.php) — drives the Learning Hub's
    // "Filter by type" checkboxes (see bitesmart_default_resource_media_type_term()
    // below for the default this CPT applies).
    register_taxonomy_for_object_type( 'media_type', 'resource' );

    bitesmart_register_resource_meta();
}
add_action( 'init', 'bitesmart_register_resource_post_type' );

/**
 * A Resource is a link-out card to an external write-up, so new Resource
 * posts default to the "Article" Media Type term — same reasoning and same
 * known WP core autosave edge case as bitesmart_default_episode_stage_term()
 * in episode-cpt.php (see its comment for why this is a save_post hook
 * rather than the 'default_term' taxonomy arg). Only fires when the post
 * genuinely has zero Media Type terms at save time, so it never overrides an
 * editor's real choice.
 */
function bitesmart_default_resource_media_type_term( $post_id, $post, $update ) {
    if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
        return;
    }

    if ( ! has_term( '', 'media_type', $post_id ) ) {
        wp_set_object_terms( $post_id, 'article', 'media_type' );
    }
}
add_action( 'save_post_resource', 'bitesmart_default_resource_media_type_term', 10, 3 );

/**
 * The native Title field sits above the locked custom/resource-fields block
 * with nothing visually tying the two together — same placeholder fix as
 * Episode's, see bitesmart_episode_title_placeholder() in episode-cpt.php.
 */
function bitesmart_resource_title_placeholder( $title, $post ) {
    if ( $post && 'resource' === $post->post_type ) {
        $title = __( 'Resource title (e.g. "Understanding Growling: A Guide")', 'custom-post-types-for-bbs' );
    }
    return $title;
}
add_filter( 'enter_title_here', 'bitesmart_resource_title_placeholder', 10, 2 );

/**
 * Only editors who can edit the specific resource can read/write its meta
 * via REST — matches core's own default post-meta authorization, made
 * explicit since register_post_meta() requires an auth_callback once
 * show_in_rest is set.
 */
function bitesmart_resource_meta_auth_callback( $allowed, $meta_key, $post_id ) {
    return current_user_can( 'edit_post', $post_id );
}

/**
 * Sanitize the per-language Keywords map: drop malformed keys and non-array
 * input entirely. Keyword text itself is free-form (comma-separated phrases
 * an editor types), so it's kept via sanitize_text_field rather than
 * restricted to URLs the way bitesmart_sanitize_episode_videos_by_lang()
 * is for Vimeo links.
 *
 * @param mixed $value Raw value.
 * @return array<string, string>
 */
function bitesmart_sanitize_resource_keywords_by_lang( $value ) {
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
 * All custom fields for the Resource CPT. Native fields (title) need no
 * registration here — only data that doesn't map onto a native post field
 * lives in post meta.
 */
function bitesmart_register_resource_meta() {
    register_post_meta( 'resource', '_bitesmart_resource_excerpt', array(
        'type'              => 'string',
        'single'            => true,
        'default'           => '',
        'sanitize_callback' => 'sanitize_textarea_field', // preserves line breaks, strips tags
        'show_in_rest'      => true,
        'auth_callback'     => 'bitesmart_resource_meta_auth_callback',
    ) );

    register_post_meta( 'resource', '_bitesmart_resource_url', array(
        'type'              => 'string',
        'single'            => true,
        'default'           => '',
        'sanitize_callback' => 'esc_url_raw',
        'show_in_rest'      => true,
        'auth_callback'     => 'bitesmart_resource_meta_auth_callback',
    ) );

    // Per-language search-matching phrases, e.g. "growl, growling, snapped,
    // aggressive" — plain internal data, NOT rendered as visible page text,
    // so TranslatePress's normal translation won't pick it up automatically
    // (see the translation caveat in [[be-bitesmart-qa-resource-data-model]]).
    // Kept per-language (one field per site language, same shape as
    // Episode's _bitesmart_episode_videos_by_lang) so a bilingual content
    // person can fill in translated keywords directly, per Janet's
    // decision when this CPT was scoped.
    register_post_meta( 'resource', '_bitesmart_resource_keywords_by_lang', array(
        'type'              => 'object',
        'single'            => true,
        'default'           => array(),
        'sanitize_callback' => 'bitesmart_sanitize_resource_keywords_by_lang',
        'show_in_rest'      => array(
            'schema' => array(
                'type'                 => 'object',
                'additionalProperties' => array( 'type' => 'string' ),
            ),
        ),
        'auth_callback'     => 'bitesmart_resource_meta_auth_callback',
    ) );
}
