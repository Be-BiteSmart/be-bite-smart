<?php
/**
 * Episode custom post type.
 *
 * This plugin (Custom Post Types for BBS) owns the CONTENT MODEL only —
 * the post type itself, its meta fields, and attaching it to the Stage
 * taxonomy. The actual editing UI (custom/episode-fields, locked into this
 * post type's content template below) and the front-end display block
 * (custom/episode) both live in the separate "Custom Blocks for Be
 * BiteSmart" plugin, since they depend on shared JS/PHP language helpers
 * that plugin already has — see that plugin's src/episode-fields/ and
 * src/episode-display/. That plugin declares this one as a dependency (its
 * "Requires Plugins" header), so WordPress won't let it activate without
 * this plugin also active.
 *
 * "Headless" CPT: fully editable in wp-admin and available to the block
 * editor/REST (show_in_rest true), but public/publicly_queryable are false
 * on purpose — there's no theme in this install to render a standalone
 * /episode/slug/ page meaningfully, and episodes are only ever meant to be
 * displayed embedded via the custom/episode block, which reads the post
 * directly via get_post() rather than needing a front-end permalink.
 */

function bitesmart_register_episode_post_type() {
    register_post_type( 'episode', array(
        'labels'              => array(
            'name'          => __( 'Episodes', 'custom-post-types-for-bbs' ),
            'singular_name' => __( 'Episode', 'custom-post-types-for-bbs' ),
            'add_new_item'  => __( 'Add New Episode', 'custom-post-types-for-bbs' ),
            'edit_item'     => __( 'Edit Episode', 'custom-post-types-for-bbs' ),
            'new_item'      => __( 'New Episode', 'custom-post-types-for-bbs' ),
            'view_item'     => __( 'View Episode', 'custom-post-types-for-bbs' ),
            'search_items'  => __( 'Search Episodes', 'custom-post-types-for-bbs' ),
            'not_found'     => __( 'No episodes found', 'custom-post-types-for-bbs' ),
            'all_items'     => __( 'All Episodes', 'custom-post-types-for-bbs' ),
        ),
        // 'editor' support is required here for the block editor to load at
        // all for this post type (use_block_editor_for_post_type() checks
        // it directly) — but the canvas it unlocks isn't left blank: the
        // 'template' + 'template_lock' below fill it with custom/episode-fields,
        // a locked-in-place block (defined in the Custom Blocks for Be
        // BiteSmart plugin — see its src/episode-fields/) that IS the
        // fields form (Episode Number, description, video links, funding).
        // No sidebar hunting, no inserter, no unused blank space.
        //
        // Deliberately no 'excerpt' support: the description used to be the
        // native Excerpt field, but a collapsed sidebar panel doesn't read
        // as part of "Episode Details" no matter how it's labeled — twice
        // now, a filled-in field looked "missing" because nobody knew to
        // open that panel. TranslatePress translates whatever text actually
        // renders on the page (see render_episode_block() in the Custom
        // Blocks plugin), not just native WP fields — Funded By is already
        // proof of that, since it's always been custom meta and translates
        // fine once embedded on a page. So the description is custom meta
        // too now (_bitesmart_episode_description below), living in the
        // fields block with everything else. Featured Image stays native —
        // there's no translation angle for an image, and native gives us
        // WordPress's responsive image handling for free.
        //
        // 'custom-fields' support is REQUIRED for our register_post_meta()
        // fields to actually work via REST, even though nothing here uses
        // the classic "Custom Fields" metabox UI. WP_REST_Posts_Controller
        // only adds a "meta" property to a post type's REST schema at all
        // when 'custom-fields' is in supports (see the 'custom-fields' case
        // in get_item_schema(), class-wp-rest-posts-controller.php) — without
        // it, "meta" never appears in the schema, so update requests silently
        // skip the whole "meta" object (no error) and GET responses never
        // include it either. This isn't optional plumbing for a headless
        // CPT like this one; it's the actual switch that turns on REST meta
        // support. (It does NOT force the raw Custom Fields box to appear in
        // the block editor by default — that stays an opt-in panel under the
        // editor's own Options > Panels menu.)
        'supports'            => array( 'title', 'editor', 'thumbnail', 'revisions', 'custom-fields' ),
        // Locks the canvas to exactly one instance of custom/episode-fields:
        // editors can't add, remove, or reorder blocks on an Episode post.
        'template'            => array(
            array( 'custom/episode-fields' ),
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
        'rest_base'           => 'episode',
        'menu_icon'           => 'dashicons-video-alt2',
        'menu_position'       => 20,
        'capability_type'     => 'post',
    ) );

    // Attaches Episode to the shared Stage taxonomy (includes/stage-taxonomy.php,
    // this plugin) — that file defines Stage itself but deliberately
    // doesn't know about any post type, so each content type opts in here.
    // Requires Stage to already be registered; see the load-order note in
    // stage-taxonomy.php.
    register_taxonomy_for_object_type( 'stage', 'episode' );

    // Attaches Episode to the Series taxonomy (includes/series-taxonomy.php)
    // — currently just "Paws To Prevent", but a real taxonomy from day one
    // so a future second series has somewhere to go. Used to build a
    // stable per-episode anchor id (e.g. "paws-to-prevent-episode-1") in
    // the Custom Blocks plugin's episode-display.php — see
    // bitesmart_episode_anchor_id() there for why series+number instead of
    // title (title can change; series+number shouldn't).
    register_taxonomy_for_object_type( 'series', 'episode' );

    bitesmart_register_episode_meta();
}
add_action( 'init', 'bitesmart_register_episode_post_type' );

/**
 * All current episode content targets Preschool, so new Episode posts
 * default there — Stage itself stays a normal, fully selectable taxonomy
 * (see stage-taxonomy.php), this default is specific to Episode's own
 * content and doesn't apply to any other content type that later attaches
 * itself to Stage.
 *
 * WP core's own 'default_term' taxonomy arg would normally handle this, but
 * it isn't used here: Gutenberg's taxonomy panel can PATCH an explicit
 * empty stage:[] during autosave, which core's default_term logic treats
 * as "terms were provided" and won't backfill (a known WP core edge case).
 * This save_post hook only assigns Preschool if the post genuinely has zero
 * stage terms at save time, so it never overrides an editor's real choice.
 */
function bitesmart_default_episode_stage_term( $post_id, $post, $update ) {
    if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
        return;
    }

    if ( ! has_term( '', 'stage', $post_id ) ) {
        wp_set_object_terms( $post_id, 'preschool', 'stage' );
    }
}
add_action( 'save_post_episode', 'bitesmart_default_episode_stage_term', 10, 3 );

/**
 * All current episode content is for the one existing series ("Paws To
 * Prevent"), so new Episode posts default there — same reasoning and same
 * known WP core autosave edge case as bitesmart_default_episode_stage_term()
 * above (see its comment for why this is a save_post hook rather than the
 * 'default_term' taxonomy arg). Matters beyond convenience: Series is part
 * of each episode's stable anchor id (bitesmart_episode_anchor_id() in the
 * Custom Blocks plugin's episode-display.php), so an Episode saved with no
 * Series term would fall back to a less-readable generic anchor.
 */
function bitesmart_default_episode_series_term( $post_id, $post, $update ) {
    if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
        return;
    }

    if ( ! has_term( '', 'series', $post_id ) ) {
        wp_set_object_terms( $post_id, 'paws-to-prevent', 'series' );
    }
}
add_action( 'save_post_episode', 'bitesmart_default_episode_series_term', 10, 3 );

/**
 * The native Title field sits above the locked custom/episode-fields block
 * with nothing visually tying the two together, which reads as confusing —
 * "where does the episode's title go?" — since the fields block's own
 * "Episode Details" heading doesn't include a title field of its own
 * (Title stays a native WP field on purpose, so TranslatePress translates
 * it the normal way). This placeholder is the fix: it says explicitly what
 * that field is for, right where an editor is looking for it.
 */
function bitesmart_episode_title_placeholder( $title, $post ) {
    if ( $post && 'episode' === $post->post_type ) {
        $title = __( 'Episode title (e.g. "Respect the Bubble")', 'custom-post-types-for-bbs' );
    }
    return $title;
}
add_filter( 'enter_title_here', 'bitesmart_episode_title_placeholder', 10, 2 );

/**
 * Only editors who can edit the specific episode can read/write its meta
 * via REST — matches core's own default post-meta authorization, made
 * explicit since register_post_meta() requires an auth_callback once
 * show_in_rest is set.
 */
function bitesmart_episode_meta_auth_callback( $allowed, $meta_key, $post_id ) {
    return current_user_can( 'edit_post', $post_id );
}

/**
 * Sanitize the per-language Vimeo URL map: drop malformed keys, empty
 * URLs, and non-array input entirely.
 *
 * @param mixed $value Raw value.
 * @return array<string, string>
 */
function bitesmart_sanitize_episode_videos_by_lang( $value ) {
    $clean = array();

    if ( is_array( $value ) ) {
        foreach ( $value as $code => $url ) {
            $code = sanitize_key( $code );
            $url  = esc_url_raw( (string) $url );
            if ( $code && $url ) {
                $clean[ $code ] = $url;
            }
        }
    }

    return $clean;
}

/**
 * Sanitize the per-language search-matching Keywords map — same shape and
 * same reasoning as bitesmart_sanitize_resource_keywords_by_lang() in
 * resource-cpt.php (free-form comma-separated phrases per language). Added
 * 2026-08-13 so Episodes shown in the Learning Hub Search's Fuse.js search
 * (see [[be-bitesmart-search-status]] in memory) can match on more than
 * just their synthesized question text — same reasoning as Q&A Entry's
 * Synonyms / Resource's Keywords.
 *
 * @param mixed $value Raw value.
 * @return array<string, string>
 */
function bitesmart_sanitize_episode_keywords_by_lang( $value ) {
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
 * All custom fields for the Episode CPT. Native fields (title, featured
 * image) need no registration here — only data that doesn't map onto a
 * native post field lives in post meta. The description used to be the
 * native Excerpt field; it's meta now too, alongside everything else in
 * the fields block — see the 'supports' comment above for why.
 */
function bitesmart_register_episode_meta() {
    register_post_meta( 'episode', '_bitesmart_episode_number', array(
        'type'              => 'string',
        'single'            => true,
        'default'           => '',
        'sanitize_callback' => 'sanitize_text_field',
        'show_in_rest'      => true,
        'auth_callback'     => 'bitesmart_episode_meta_auth_callback',
    ) );

    register_post_meta( 'episode', '_bitesmart_episode_description', array(
        'type'              => 'string',
        'single'            => true,
        'default'           => '',
        'sanitize_callback' => 'sanitize_textarea_field', // preserves line breaks, strips tags
        'show_in_rest'      => true,
        'auth_callback'     => 'bitesmart_episode_meta_auth_callback',
    ) );

    register_post_meta( 'episode', '_bitesmart_episode_videos_by_lang', array(
        'type'              => 'object',
        'single'            => true,
        'default'           => array(),
        'sanitize_callback' => 'bitesmart_sanitize_episode_videos_by_lang',
        'show_in_rest'      => array(
            'schema' => array(
                'type'                 => 'object',
                'additionalProperties' => array( 'type' => 'string' ),
            ),
        ),
        'auth_callback'     => 'bitesmart_episode_meta_auth_callback',
    ) );

    // Per-language search-matching phrases, e.g. "growl, stress signals,
    // body language" — plain internal data, NOT rendered as visible page
    // text (unlike Description, which does render), so TranslatePress
    // won't auto-translate it automatically — same caveat as Q&A Entry's
    // Synonyms / Resource's Keywords (see
    // [[be-bitesmart-qa-resource-data-model]] in memory).
    register_post_meta( 'episode', '_bitesmart_episode_keywords_by_lang', array(
        'type'              => 'object',
        'single'            => true,
        'default'           => array(),
        'sanitize_callback' => 'bitesmart_sanitize_episode_keywords_by_lang',
        'show_in_rest'      => array(
            'schema' => array(
                'type'                 => 'object',
                'additionalProperties' => array( 'type' => 'string' ),
            ),
        ),
        'auth_callback'     => 'bitesmart_episode_meta_auth_callback',
    ) );

    register_post_meta( 'episode', '_bitesmart_episode_downloads_page_url', array(
        'type'              => 'string',
        'single'            => true,
        'default'           => '',
        'sanitize_callback' => 'esc_url_raw',
        'show_in_rest'      => true,
        'auth_callback'     => 'bitesmart_episode_meta_auth_callback',
    ) );

    register_post_meta( 'episode', '_bitesmart_episode_funded_by_name', array(
        'type'              => 'string',
        'single'            => true,
        'default'           => '',
        'sanitize_callback' => 'sanitize_text_field',
        'show_in_rest'      => true,
        'auth_callback'     => 'bitesmart_episode_meta_auth_callback',
    ) );

    register_post_meta( 'episode', '_bitesmart_episode_funded_by_logo_id', array(
        'type'          => 'integer',
        'single'        => true,
        'default'       => 0,
        'show_in_rest'  => true,
        'auth_callback' => 'bitesmart_episode_meta_auth_callback',
    ) );
}
