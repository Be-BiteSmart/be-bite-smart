<?php
/**
 * Guide custom post type.
 *
 * This plugin (Custom Post Types for BBS) owns the CONTENT MODEL only —
 * the post type itself, its meta fields, and attaching it to the Stage and
 * Topic taxonomies. The editing UI (custom/guide-fields, locked into this
 * post type's content template below) and the front-end display block
 * (custom/guide) both live in the separate "Custom Blocks for Be BiteSmart"
 * plugin. That plugin declares this one as a dependency (its "Requires
 * Plugins" header), so WordPress won't let it activate without this plugin
 * also active.
 *
 * A Guide is the parent "shell" of a multi-chapter piece of content — see
 * [[be-bitesmart-guide-cpt-plan]] in memory for the full feature (a Guide's
 * actual chapters are a SEPARATE post type, guide_chapter — see
 * guide-chapter-cpt.php in this same directory — each an ordinary
 * hierarchical-free post linked back here via
 * _bitesmart_chapter_guide_id, not stored as meta on the Guide itself).
 * Splitting chapters into their own post type (rather than a repeater field
 * here) is deliberate: each chapter's text version needs real rich content
 * (inline images, etc.), which means it needs a real, unlocked block editor
 * canvas and native post_content — not something a custom meta field can
 * give you without reinventing WordPress's own block editor from scratch.
 *
 * HEADLESS, same as Episode/Q&A Entry/Resource — reversed from an earlier
 * "give Guide a real permalink" decision (see [[be-bitesmart-guide-cpt-plan]]
 * in memory for the full history). Landed here once Janet clarified the
 * real intent: this site effectively has ONE Guide (a second, genuinely
 * different guide would get its own separate post type entirely, not a
 * second post in this one) — so the Guide's front door doesn't need to be
 * ITS OWN permalink; it's a real WP Page with the `custom/guide-single`
 * display block placed on it (see src/guide-single/guide-single.php in the
 * blocks plugin), same "small piece assembled by hand onto a page" pattern
 * as Episode/Q&A/Resource after all. **Originally planned as a site-root
 * Page** (slug exactly "guide", giving `/guide/`) — Janet actually created
 * it at `/learning/guide/` instead (nested under the existing Learning
 * Hub). A chapter's own URL was moved 2026-08-16 to nest under that same
 * `/learning/guide/` prefix too, matching wherever the Guide's real Page
 * ended up living — see guide-chapter-cpt.php for the full reasoning
 * (there's still only one Guide, so a chapter's URL can stay a flat
 * `/learning/guide/<chapter-slug>/` with no guide-slug segment needed to
 * disambiguate which guide it belongs to). Block editor canvas stays
 * locked to custom/guide-fields regardless — post_content is unused
 * either way, since the front end (wherever it's reached from) renders the
 * chapter list, not this post's saved block markup.
 */

function bitesmart_register_guide_post_type() {
    register_post_type( 'guide', array(
        'labels'              => array(
            // 'menu_name' overrides just the wp-admin sidebar's top-level
            // label — everything else (screen titles, "All Guides", etc.)
            // still reads "Guide(s)" via 'name'/'singular_name' below.
            // "Parent Guide" instead of "Guides" in the sidebar specifically
            // because this CPT is only ever meant to hold the one guide
            // (see the file-level comment above) — the label is there to
            // remind an editor what this menu item's FOR (the thing
            // chapters belong to), not to imply a list of many.
            'menu_name'     => __( 'Parent Guide', 'custom-post-types-for-bbs' ),
            'name'          => __( 'Guides', 'custom-post-types-for-bbs' ),
            'singular_name' => __( 'Guide', 'custom-post-types-for-bbs' ),
            'add_new_item'  => __( 'Add New Guide', 'custom-post-types-for-bbs' ),
            'edit_item'     => __( 'Edit Guide', 'custom-post-types-for-bbs' ),
            'new_item'      => __( 'New Guide', 'custom-post-types-for-bbs' ),
            'view_item'     => __( 'View Guide', 'custom-post-types-for-bbs' ),
            'search_items'  => __( 'Search Guides', 'custom-post-types-for-bbs' ),
            'not_found'     => __( 'No guides found', 'custom-post-types-for-bbs' ),
            // "Edit Guide", not "All Guides" — a plural label would be
            // misleading for a CPT that's only ever meant to hold one post
            // (see the file-level comment). The page this points at
            // (edit.php?post_type=guide) gets a prominent "Edit the Guide"
            // button via bitesmart_guide_list_screen_notice() below, making
            // the label still accurate even though, underneath, it's
            // technically still the normal list screen.
            'all_items'     => __( 'Edit Guide', 'custom-post-types-for-bbs' ),
        ),
        // 'editor' + 'custom-fields' are both required — see the long
        // comment in episode-cpt.php's 'supports' entry for exactly why
        // (block editor won't load at all without 'editor'; registered meta
        // silently vanishes from REST without 'custom-fields'). Same two
        // gotchas apply here verbatim.
        //
        // Canvas is locked to exactly one custom/guide-fields block — the
        // Guide's own Description lives there as custom meta, same
        // reasoning as Episode's Description field. Title stays native.
        // Chapters are NOT edited here at all — they're separate
        // guide_chapter posts, added/ordered from their own admin list, not
        // authored inline on the Guide post.
        'supports'            => array( 'title', 'editor', 'thumbnail', 'custom-fields' ),
        'template'            => array(
            array( 'custom/guide-fields' ),
        ),
        'template_lock'       => 'all',
        // Headless (see the file-level comment above) — no permalink of its
        // own, reached only via the custom/guide-single block placed on a
        // hand-made Page. 'rewrite' => false is what actually matters here:
        // it keeps this CPT out of the `/guide/` URL namespace entirely, so
        // guide_chapter's own rewrite (guide-chapter-cpt.php) can use that
        // prefix with no collision.
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
        'rest_base'           => 'guide',
        'menu_icon'           => 'dashicons-book-alt',
        'menu_position'       => 23,
        'capability_type'     => 'post',
    ) );

    // Deliberately NOT attached to Stage/Topic (unlike every other content
    // type here) — chapters (guide-chapter-cpt.php) carry their OWN
    // independent Stage/Topic tags, which is the taxonomy that actually
    // drives a chapter showing up on a Stage page, per
    // [[be-bitesmart-guide-cpt-plan]]. An earlier version of this file also
    // attached both taxonomies to Guide itself — never read by any code,
    // and Janet flagged that having a Stage panel on BOTH the Guide and
    // each of its chapters (one live, one silently doing nothing) read as
    // confusing/redundant. Removed here rather than kept "just in case".

    bitesmart_register_guide_meta();
}
add_action( 'init', 'bitesmart_register_guide_post_type' );

/**
 * Same placeholder-title pattern as Episode/Q&A Entry — see
 * bitesmart_episode_title_placeholder() in episode-cpt.php for why this
 * exists at all (an unlabeled native Title field above a locked custom
 * fields block reads as disconnected from the rest of the form).
 */
function bitesmart_guide_title_placeholder( $title, $post ) {
    if ( $post && 'guide' === $post->post_type ) {
        $title = __( 'Guide title (e.g. "Bringing Baby Home to Your Dog")', 'custom-post-types-for-bbs' );
    }
    return $title;
}
add_filter( 'enter_title_here', 'bitesmart_guide_title_placeholder', 10, 2 );

/**
 * The one Guide post, of any status, or null if none exists yet. "Which one
 * is THE guide" is simply whichever was created first — deterministic and
 * needs no extra "is this the main one" flag, since (per the file-level
 * comment) there's only ever meant to be one at all.
 *
 * @return WP_Post|null
 */
function bitesmart_get_the_main_guide() {
    $guides = get_posts( array(
        'post_type'      => 'guide',
        'post_status'    => 'any',
        'posts_per_page' => 1,
        'orderby'        => 'ID',
        'order'          => 'ASC',
        'no_found_rows'  => true,
    ) );

    return $guides ? $guides[0] : null;
}

/**
 * Lang code => downloadable PDF URL map for the Guide as a WHOLE — see
 * _bitesmart_guide_pdf_by_lang below. Empty entries are already dropped by
 * bitesmart_sanitize_guide_pdfs_by_lang() at save time; this just reads the
 * meta back and guards against a non-array value (defensive; shouldn't
 * normally happen since the value is registered with an array default).
 *
 * Thin reader, same shape/role as the now-removed per-chapter
 * bitesmart_guide_chapter_pdf_urls() used to have (guide-chapter-display.php,
 * "Custom Blocks for Be BiteSmart" plugin) — kept here instead of that
 * plugin's own display file since this is a plain meta read on THIS post
 * type, not chapter-rendering logic; that plugin already calls other Guide
 * helpers from here (bitesmart_get_the_main_guide(), etc. — see e.g.
 * guide-single.php), so a cross-plugin call is an established pattern.
 *
 * @param int $guide_id
 * @return array<string, string>
 */
function bitesmart_guide_pdf_urls( $guide_id ) {
    $pdfs = get_post_meta( $guide_id, '_bitesmart_guide_pdf_by_lang', true );
    return is_array( $pdfs ) ? $pdfs : array();
}

/**
 * Admin-UX guard rails for "there's only ever one Guide" — without these,
 * a non-technical admin clicking the completely standard "Add New Guide"
 * wp-admin menu item would land on a real blank new-post form, implying
 * this CPT supports many guides the normal WordPress way. It doesn't (see
 * the file-level comment) — a second, genuinely different guide is meant
 * to get its own separate post type, not a second post here.
 *
 * - Visiting "Add New" (post-new.php?post_type=guide) — whether by
 *   clicking the submenu item (removed below once a guide already exists,
 *   but still reachable by a stale bookmark/browser-autocompleted URL) —
 *   redirects to editing the existing guide instead of creating a second
 *   one. This is the actual enforcement; hiding the submenu item is just
 *   the visible half of it.
 * - The "Add New Guide" submenu item itself is removed once a guide
 *   already exists, via WordPress's own remove_submenu_page() — the
 *   supported API for this, not direct $submenu array surgery.
 *
 * The list screen (edit.php?post_type=guide — "Edit Guide" in the menu, per
 * the relabel above) is DELIBERATELY left as a real, normal page rather
 * than also redirecting it straight to the edit screen — an earlier version
 * of this did that, and it broke navigation: the post editor's own "back"
 * link points at this exact URL, so auto-redirecting it bounced an admin
 * straight back into the same edit screen they'd just tried to leave — felt
 * like being stuck in a loop. bitesmart_guide_list_screen_notice() below
 * gives it a purpose-built one-button "landing page" feel instead (with a
 * one-row table underneath for anyone who scrolls, harmless either way),
 * while staying a real, distinct, back-button-safe page.
 *
 * Neither Add-New guard touches anything if no Guide exists yet, so the
 * very first one can still be created normally.
 */
function bitesmart_guide_redirect_add_new_to_edit() {
    global $pagenow;

    if ( 'post-new.php' !== $pagenow || 'guide' !== ( $_GET['post_type'] ?? '' ) ) {
        return;
    }

    $guide = bitesmart_get_the_main_guide();
    if ( $guide ) {
        wp_safe_redirect( admin_url( 'post.php?post=' . $guide->ID . '&action=edit' ) );
        exit;
    }
}
add_action( 'admin_init', 'bitesmart_guide_redirect_add_new_to_edit' );

function bitesmart_guide_hide_add_new_menu_item() {
    if ( bitesmart_get_the_main_guide() ) {
        remove_submenu_page( 'edit.php?post_type=guide', 'post-new.php?post_type=guide' );
    }
}
add_action( 'admin_menu', 'bitesmart_guide_hide_add_new_menu_item', 999 );

/**
 * Turns the Guide list screen into a purpose-built one-button "landing
 * page" instead of a bare WordPress table — see the big comment above
 * bitesmart_guide_redirect_add_new_to_edit() for why this screen is kept
 * as a real page (not redirected) and what problem that solved. The
 * standard list table still renders underneath for anyone who scrolls
 * (harmless — it's just the one row), this notice is purely additive.
 */
function bitesmart_guide_list_screen_notice() {
    global $pagenow;

    if ( 'edit.php' !== $pagenow || 'guide' !== ( $_GET['post_type'] ?? '' ) ) {
        return;
    }

    $guide = bitesmart_get_the_main_guide();
    if ( ! $guide ) {
        return; // nothing created yet — let WordPress's own "no guides found, + Add New" empty state show as normal.
    }
    ?>
    <div class="notice notice-info">
        <p><?php esc_html_e( 'This site has one Guide.', 'custom-post-types-for-bbs' ); ?></p>
        <p>
            <a class="button button-primary" href="<?php echo esc_url( admin_url( 'post.php?post=' . $guide->ID . '&action=edit' ) ); ?>">
                <?php esc_html_e( 'Edit the Guide', 'custom-post-types-for-bbs' ); ?>
            </a>
        </p>
    </div>
    <?php
}
add_action( 'admin_notices', 'bitesmart_guide_list_screen_notice' );

/**
 * Only editors who can edit the specific guide can read/write its meta via
 * REST — matches core's own default post-meta authorization, made explicit
 * since register_post_meta() requires an auth_callback once show_in_rest is
 * set.
 */
function bitesmart_guide_meta_auth_callback( $allowed, $meta_key, $post_id ) {
    return current_user_can( 'edit_post', $post_id );
}

/**
 * Sanitize the per-language downloadable-PDF URL map for the Guide as a
 * WHOLE — same shape/reasoning as the now-removed
 * bitesmart_sanitize_guide_chapter_pdfs_by_lang() (guide-chapter-cpt.php,
 * "we realistically can't split up the guide chapters into separate pdfs" —
 * see the meta registration below and [[be-bitesmart-guide-cpt-plan]] in
 * memory). A WP Media Library upload just hands back a plain URL, same as
 * any other TextControl-typed URL.
 *
 * @param mixed $value Raw value.
 * @return array<string, string>
 */
function bitesmart_sanitize_guide_pdfs_by_lang( $value ) {
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
 * All custom fields for the Guide CPT itself (not its chapters — see
 * guide-chapter-cpt.php for those). Native fields (title, featured image)
 * need no registration here.
 */
function bitesmart_register_guide_meta() {
    // Short description/teaser shown wherever a Guide is listed (e.g. a
    // Stage archive card) before a visitor opens it — same role as
    // Episode's Description field.
    register_post_meta( 'guide', '_bitesmart_guide_description', array(
        'type'              => 'string',
        'single'            => true,
        'default'           => '',
        'sanitize_callback' => 'sanitize_textarea_field', // preserves line breaks, strips tags
        'show_in_rest'      => true,
        'auth_callback'     => 'bitesmart_guide_meta_auth_callback',
    ) );

    // Per-language downloadable PDF for the guide AS A WHOLE — added
    // 2026-08-16, replacing the earlier per-chapter
    // _bitesmart_chapter_pdf_by_lang field (guide-chapter-cpt.php) once
    // Janet decided the source PDF realistically can't be split into
    // separate per-chapter files: "so the chapters will no longer have
    // individual download links instead its a download button to download
    // the entire guide." Every chapter's Download button now reads THIS
    // one field (via its parent Guide — see
    // bitesmart_render_guide_chapter_row() in guide-chapter-display.php),
    // so uploading/replacing a PDF here updates the button everywhere at
    // once. Same {code: url} map shape as the field it replaces.
    register_post_meta( 'guide', '_bitesmart_guide_pdf_by_lang', array(
        'type'              => 'object',
        'single'            => true,
        'default'           => array(),
        'sanitize_callback' => 'bitesmart_sanitize_guide_pdfs_by_lang',
        'show_in_rest'      => array(
            'schema' => array(
                'type'                 => 'object',
                'additionalProperties' => array( 'type' => 'string' ),
            ),
        ),
        'auth_callback'     => 'bitesmart_guide_meta_auth_callback',
    ) );

    // NOTE: a "Usage Rights, Permissions & Attribution" field briefly lived
    // here (2026-08-16) — removed the same day once Janet flagged the real
    // text needs richer formatting (lists, weblinks) than a plain
    // sanitize_textarea_field() field can hold. Replaced with a plain link
    // to the site's existing /legal/ Page instead (real Gutenberg content,
    // full formatting for free) — see
    // bitesmart_render_guide_chapter_row()'s own comment
    // (guide-chapter-display.php) and [[be-bitesmart-guide-cpt-plan]] in
    // memory. If a `_bitesmart_guide_usage_rights` meta row still exists
    // from before this reversion, it's just an orphaned, harmless value —
    // nothing reads it anymore.
}
