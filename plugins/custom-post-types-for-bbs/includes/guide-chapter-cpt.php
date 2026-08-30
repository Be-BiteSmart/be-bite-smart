<?php
/**
 * Guide Chapter custom post type.
 *
 * This plugin (Custom Post Types for BBS) owns the CONTENT MODEL only — see
 * guide-cpt.php for the parent Guide post type and the full reasoning for
 * why chapters are a separate post type rather than a repeater field on
 * Guide. The editing UI and front-end display both live in the "Custom
 * Blocks for Be BiteSmart" plugin.
 *
 * A Guide Chapter is deliberately NOT built like Episode/Q&A Entry/Resource:
 * those all lock the block editor canvas to one custom fields block because
 * every field they have is either a plain value or a short piece of text.
 * A chapter's text version needs to support real rich content (inline
 * images especially — see [[be-bitesmart-guide-cpt-plan]] in memory) that a
 * meta field can't cleanly hold, so this CPT leaves 'editor' UNLOCKED:
 * post_content IS the chapter's text body, authored with WordPress's real
 * block editor (image blocks, media library, etc.) with zero custom code.
 * Everything else about the chapter (which Guide it belongs to, its number,
 * its collapsed-state summary, its video) is custom meta, edited from a
 * sidebar panel (custom/guide-chapter-panel, a PluginDocumentSettingPanel —
 * NOT a locked template block, since the canvas has to stay free for
 * content authoring) rather than a canvas block.
 *
 * UNLIKE Guide (see guide-cpt.php — headless again as of this revision), a
 * chapter DOES have its own real permalink — decided so a chapter can be
 * shared/linked on its own (a parent asking "which chapter covers
 * growling?" gets a clean single-chapter link), even though the primary way
 * parents are expected to browse is the full accordion (either the main
 * Guide page, or the pooled multi-Guide search page — see
 * [[be-bitesmart-guide-cpt-plan]] in memory). URL is
 * `/learning/guide/<chapter-slug>/` — genuinely NESTED one level under
 * wherever `custom/guide-single` itself actually lives (`/learning/guide/`
 * — see guide-single.php), which normally isn't free across two different
 * post types (WordPress only auto-nests permalinks via post_parent chains
 * within ONE hierarchical post type's own rewrite rules). **Revised
 * 2026-08-16**: originally nested under a site-root `/guide/` (safe back
 * then because Guide was headless and nothing else competed for that
 * prefix); moved to match where Janet actually placed the Guide's real
 * Page instead, per her own request to keep chapter URLs consistent with
 * it. Nesting under a REAL (non-headless) Page's own URL is still safe:
 * WordPress always generates CPT rewrite rules (from `register_post_type()`)
 * BEFORE the generic Page catch-all rule that tries to resolve an
 * unmatched path as a nested Page hierarchy — so a specific
 * `learning/guide/([^/]+)/?$` rule wins the match first, and there's no
 * actual child Page literally living at that same path (chapters are a
 * separate CPT, not WP Pages) for the fallback to ever compete with. (If a
 * genuinely second, different guide is ever added, per Janet's own call it
 * gets its own separate post type — not a second post here — so this
 * doesn't need to generalize to "which guide" in the URL.) The
 * single-chapter page shows a "part of: {Guide}" link back to the main
 * Guide page (hardcoded to `/learning/guide/` — see
 * bitesmart_render_guide_chapter_row() in guide-chapter-display.php — same
 * "one known destination" idiom as Episode's `/learning/kids/` link), so
 * the relationship is still one click away without it being baked into the
 * URL. Both this page AND the accordion view render a chapter through the
 * SAME "render one full chapter" function — no separate markup to maintain.
 *
 * **Rewrite-rule change requires a manual Settings → Permalinks → Save in
 * wp-admin** to take effect (same as every previous rewrite change to this
 * CPT). Also worth knowing: any `/guide/<chapter-slug>/` link already
 * shared/bookmarked from before this change will 404 after the flush — no
 * redirect from the old prefix was added (deliberately out of scope unless
 * Janet asks; the feature's young enough that this was judged not worth
 * the extra code yet).
 *
 * A chapter is also independently discoverable via search: it shows up in
 * its real Stage's `custom/learning-search` feed (via the normal Stage
 * tax_query below) AND, unconditionally, in the pooled multi-Guide search
 * page that reuses that same block — see
 * bitesmart_build_stage_card_list()'s `'guide' === $stage_slug` branch in
 * learning-search.php. That pooled page does NOT depend on this chapter
 * carrying any particular taxonomy term (an earlier version tried a
 * "Guide" pseudo-stage term every chapter was meant to auto-carry, but
 * that depended on wp_set_object_terms() being called for the post's Stage
 * at all, which never happens if an editor never opens the Stage panel — a
 * real bug Janet hit: a brand-new chapter's Stage was never being
 * "turned on" in the first place, not un-set after the fact. Querying
 * `post_type => 'guide_chapter'` directly instead, with no tagging
 * dependency, can't have that failure mode).
 */

function bitesmart_register_guide_chapter_post_type() {
    register_post_type( 'guide_chapter', array(
        'labels'              => array(
            'name'          => __( 'Guide Chapters', 'custom-post-types-for-bbs' ),
            'singular_name' => __( 'Guide Chapter', 'custom-post-types-for-bbs' ),
            'add_new_item'  => __( 'Add New Chapter', 'custom-post-types-for-bbs' ),
            'edit_item'     => __( 'Edit Chapter', 'custom-post-types-for-bbs' ),
            'new_item'      => __( 'New Chapter', 'custom-post-types-for-bbs' ),
            'view_item'     => __( 'View Chapter', 'custom-post-types-for-bbs' ),
            'search_items'  => __( 'Search Chapters', 'custom-post-types-for-bbs' ),
            'not_found'     => __( 'No chapters found', 'custom-post-types-for-bbs' ),
            'all_items'     => __( 'All Chapters', 'custom-post-types-for-bbs' ),
        ),
        // 'editor' + 'custom-fields' required for the same two reasons as
        // every other CPT here — see episode-cpt.php's 'supports' comment.
        // Deliberately NO 'template'/'template_lock': unlike every other
        // content type in this plugin, the canvas stays open. post_content
        // is the real chapter body (rich text + images), authored with the
        // normal block editor — see the file-level comment above for why.
        'supports'            => array( 'title', 'editor', 'thumbnail', 'custom-fields' ),
        // Real permalink, nested under /learning/guide/ — see the file-level
        // comment above for why that's safe (and for the 2026-08-16 move
        // from a site-root /guide/ prefix). has_archive stays false: there
        // is no generic "all chapters" WordPress archive view; browsing
        // happens through the accordion (the main Guide page or the pooled
        // Stage=Guide search page), not a chapter post-type archive.
        'public'              => true,
        'publicly_queryable'  => true,
        'show_ui'             => true,
        'show_in_menu'        => 'edit.php?post_type=guide', // nests under Guides in wp-admin
        'show_in_admin_bar'   => true,
        'show_in_nav_menus'   => true,
        'exclude_from_search' => false,
        'has_archive'         => false,
        'rewrite'             => array( 'slug' => 'learning/guide', 'with_front' => false ),
        'show_in_rest'        => true, // required for the block editor + REST access
        'rest_base'           => 'guide_chapter',
        'capability_type'     => 'post',
    ) );

    // Each CHAPTER carries its own Stage/Topic tags, independently of its
    // parent Guide (decided over the simpler "inherit the Guide's Stage"
    // alternative — see [[be-bitesmart-guide-cpt-plan]] in memory) — same
    // taxonomies, same attach pattern as Episode/Q&A Entry/Resource. This is
    // what lets a chapter show up on its own Stage page (alongside Q&A
    // Entry/Resource/Episode cards) even when other chapters in the same
    // Guide target a different Stage. Requires stage-taxonomy.php/
    // topic-taxonomy.php to already be registered; see the load-order note
    // in each of those files (already satisfied by the main plugin file's
    // require order).
    register_taxonomy_for_object_type( 'stage', 'guide_chapter' );
    register_taxonomy_for_object_type( 'topic', 'guide_chapter' );

    // Guide Section (added 2026-08-16, guide-section-taxonomy.php) — which
    // of the source PDF's own Sections this chapter belongs to. Read only
    // by bitesmart_render_guide_single() (guide-single.php) to group
    // chapters and insert a heading between each Section on the Guide's
    // own "View All Chapters" list; a chapter's OWN page never shows it.
    register_taxonomy_for_object_type( 'guide_section', 'guide_chapter' );

    // Attaches Guide Chapter to the shared Media Type taxonomy
    // (includes/media-type-taxonomy.php) — drives the Learning Hub's
    // "Filter by type" checkboxes (see
    // bitesmart_default_guide_chapter_media_type_term() below for the
    // default this CPT applies).
    register_taxonomy_for_object_type( 'media_type', 'guide_chapter' );

    bitesmart_register_guide_chapter_meta();
}
add_action( 'init', 'bitesmart_register_guide_chapter_post_type' );

/**
 * Every chapter's text body is real written content (post_content — see the
 * file-level comment above), so new Guide Chapter posts default to the
 * "Article" Media Type term — same reasoning and same known WP core autosave
 * edge case as bitesmart_default_episode_stage_term() in episode-cpt.php
 * (see its comment for why this is a save_post hook rather than the
 * 'default_term' taxonomy arg). Only fires when the post genuinely has zero
 * Media Type terms at save time, so it never overrides an editor's real
 * choice.
 *
 * Deliberately does NOT also auto-add "Video" for chapters that have one
 * (bitesmart_guide_chapter_video_ids() in the Custom Blocks plugin's
 * guide-chapter-display.php) — that meta is written via REST AFTER
 * save_post fires (same timing gotcha documented on
 * bitesmart_guide_chapter_autofill_guide_id() above), so a save_post-time
 * read here would see stale (often empty) video data on the very save that
 * added it. Not worth the added rest_after_insert_guide_chapter complexity
 * for what's only ever a starting default — editors check the "Video" box
 * by hand for chapters that have one.
 */
function bitesmart_default_guide_chapter_media_type_term( $post_id, $post, $update ) {
    if ( wp_is_post_revision( $post_id ) || wp_is_post_autosave( $post_id ) ) {
        return;
    }

    if ( ! has_term( '', 'media_type', $post_id ) ) {
        wp_set_object_terms( $post_id, 'article', 'media_type' );
    }
}
add_action( 'save_post_guide_chapter', 'bitesmart_default_guide_chapter_media_type_term', 10, 3 );

/**
 * Explicit rewrite-rule carve-out for the References page
 * (`/learning/guide/references/`), added 2026-08-16 after Janet hit a real
 * collision: that path is a single segment directly under
 * `/learning/guide/` — EXACTLY the shape this CPT's own rewrite rule above
 * matches as a chapter slug (`learning/guide/([^/]+)/?$`). WordPress
 * resolves that rule FIRST, tries to find a `guide_chapter` named
 * "references", finds none, and 404s — never falling through to the real
 * Page that genuinely exists at that path (confirmed via `url_to_postid()`
 * returning `0` there despite `get_permalink()` correctly reporting that
 * exact url). Any Page nested directly under `/learning/guide/` hits this
 * same collision, no matter its slug.
 *
 * First fix attempt moved the References page to a different URL
 * (`/learning/references/`) to sidestep the collision entirely — reverted
 * per Janet: "doesn't that read a bit messy when you see the url? since
 * its supposed to be a part of the guide?" This is the alternative that
 * keeps her original url: one explicit, LITERAL-STRING rewrite rule for
 * this exact path, registered at `'top'` priority so WordPress checks it
 * BEFORE the wildcard chapter rule above (`add_rewrite_rule()`'s `$after`
 * param controls ordering against the rewrite rules WordPress ultimately
 * compiles, independent of which `init` callback happens to register
 * first) — routing straight to `index.php?pagename=guide/references`,
 * WordPress's own normal Page-hierarchy query var, exactly what would have
 * resolved this url anyway if the wildcard rule hadn't intercepted it
 * first. `pagename` needs the page's FULL hierarchical path from the site
 * root (`learning/guide/references` — confirmed directly:
 * `get_page_by_path('guide/references')` returns nothing,
 * `get_page_by_path('learning/guide/references')` finds it — the "Guide"
 * page is itself nested one level under a "Learning" hub page), NOT just
 * its immediate parent segment. Requires the References page to stay
 * nested exactly where Janet originally created it (Parent: Guide, slug:
 * `references`) — if she ever moves or renames it, or the Guide page
 * itself moves, this literal string needs updating to match.
 *
 * Deliberately narrow, not a general fix: any OTHER Page ever nested
 * directly under `/learning/guide/` would hit the identical collision and
 * need its own carve-out added here the same way.
 *
 * Needs a Settings → Permalinks → Save in wp-admin to take effect, same as
 * any rewrite-rule change to this CPT.
 */
function bitesmart_guide_references_rewrite_carveout() {
    add_rewrite_rule( '^learning/guide/references/?$', 'index.php?pagename=learning/guide/references', 'top' );
}
add_action( 'init', 'bitesmart_guide_references_rewrite_carveout' );

/**
 * Every chapter always belongs to the one Guide — there's no editor picker
 * for this (removed per Janet: with only ever one Guide — see guide-cpt.php
 * — a picker was never a real choice, just a place to leave it blank or get
 * it wrong). Auto-fills _bitesmart_chapter_guide_id with
 * bitesmart_get_the_main_guide()'s ID whenever it's still empty.
 *
 * Hooks `rest_after_insert_guide_chapter`, NOT `save_post_guide_chapter` —
 * same REST-timing lesson as bitesmart_guide_chapter_stage_term_reguard()
 * above: `save_post` fires from `wp_update_post()`, which runs BEFORE the
 * REST controller applies that SAME request's own meta values (registered
 * post meta is written via `update_additional_fields_for_object()`, which
 * runs AFTER `wp_update_post()`) — so a `save_post`-time fix here would get
 * silently overwritten a moment later when REST writes back whatever
 * (empty/zero) value the client's own request carried. `rest_after_insert_*`
 * fires once REST's ENTIRE create/update — post fields, meta, AND terms —
 * is fully done, so it's the hook that actually reflects final state. No
 * classic-wp-admin-save fallback needed: this meta field has no UI outside
 * the block editor (no metabox), so REST via the block editor is the only
 * path that ever needs to set it.
 *
 * @param WP_Post         $post     Inserted or updated chapter post.
 * @param WP_REST_Request $request  The REST request.
 * @param bool            $creating True on create, false on update.
 */
function bitesmart_guide_chapter_autofill_guide_id( $post, $request, $creating ) {
    if ( (int) get_post_meta( $post->ID, '_bitesmart_chapter_guide_id', true ) ) {
        return; // already set — the only Guide it could ever be
    }

    $guide = bitesmart_get_the_main_guide();
    if ( $guide ) {
        update_post_meta( $post->ID, '_bitesmart_chapter_guide_id', $guide->ID );
    }
}
add_action( 'rest_after_insert_guide_chapter', 'bitesmart_guide_chapter_autofill_guide_id', 10, 3 );

/**
 * Same placeholder-title pattern as the other content types — the chapter
 * title is what renders in the collapsed chapter row.
 */
function bitesmart_guide_chapter_title_placeholder( $title, $post ) {
    if ( $post && 'guide_chapter' === $post->post_type ) {
        $title = __( 'Chapter title (e.g. "Loading your first roll")', 'custom-post-types-for-bbs' );
    }
    return $title;
}
add_filter( 'enter_title_here', 'bitesmart_guide_chapter_title_placeholder', 10, 2 );

/**
 * Only editors who can edit the specific chapter can read/write its meta
 * via REST — same explicit auth_callback pattern as every other CPT here.
 */
function bitesmart_guide_chapter_meta_auth_callback( $allowed, $meta_key, $post_id ) {
    return current_user_can( 'edit_post', $post_id );
}

/**
 * Sanitize the per-language Vimeo URL map — identical shape/reasoning to
 * bitesmart_sanitize_episode_videos_by_lang() in episode-cpt.php.
 *
 * @param mixed $value Raw value.
 * @return array<string, string>
 */
function bitesmart_sanitize_guide_chapter_videos_by_lang( $value ) {
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
 * Sanitize the per-language search-matching Synonyms map — identical
 * shape/reasoning to bitesmart_sanitize_episode_keywords_by_lang() in
 * episode-cpt.php. Feeds bitesmart_stage_card_keywords() (learning-search.php),
 * same as Q&A Entry's Synonyms / Resource's Keywords / Episode's Synonyms.
 * Labeled "Synonyms" in the editing UI (guide-chapter-panel/index.js) as of
 * 2026-08-28, to match Q&A Entry's naming — the meta key itself
 * (_bitesmart_chapter_keywords_by_lang) and this function's name were
 * deliberately left unchanged, this was a user-facing label-only rename.
 *
 * @param mixed $value Raw value.
 * @return array<string, string>
 */
function bitesmart_sanitize_guide_chapter_keywords_by_lang( $value ) {
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
 * All custom fields for the Guide Chapter CPT. Native fields (title,
 * featured image) need no registration here; the chapter's rich TEXT body
 * is also native — it's post_content, not meta (see the file-level
 * comment above) — so there is no "chapter text" meta field at all.
 */
function bitesmart_register_guide_chapter_meta() {
    // Which Guide this chapter belongs to — a real guide post ID, same
    // relationship-via-meta pattern as Q&A Entry's
    // _bitesmart_qa_link_resource_id (see qa-entry-cpt.php). Chapters are
    // NOT stored as children of the Guide via post_parent: WordPress's
    // native hierarchical/parent-picker UI only offers parents of the SAME
    // post type, which doesn't fit a guide_chapter -> guide relationship.
    // NOT editor-set at all anymore, either — auto-filled by
    // bitesmart_guide_chapter_autofill_guide_id() below, since there's only
    // ever one Guide to belong to (see guide-cpt.php); custom/guide-chapter-panel
    // (blocks plugin) used to have a picker for this, removed per Janet.
    register_post_meta( 'guide_chapter', '_bitesmart_chapter_guide_id', array(
        'type'          => 'integer',
        'single'        => true,
        'default'       => 0,
        'show_in_rest'  => true,
        'auth_callback' => 'bitesmart_guide_chapter_meta_auth_callback',
    ) );

    // Chapter number, both its display label ("Chapter 3") and its sort
    // order within the parent Guide — same string-field pattern as
    // Episode's _bitesmart_episode_number (episode-cpt.php), for the same
    // reason: a plain editable label reads better to an editor than a
    // hidden "order" integer, and doubles as the sort key.
    register_post_meta( 'guide_chapter', '_bitesmart_chapter_number', array(
        'type'              => 'string',
        'single'            => true,
        'default'           => '',
        'sanitize_callback' => 'sanitize_text_field',
        'show_in_rest'      => true,
        'auth_callback'     => 'bitesmart_guide_chapter_meta_auth_callback',
    ) );

    // Always-visible collapsed-row summary (shown even before a visitor
    // expands the chapter) — same role as Episode's Description field.
    register_post_meta( 'guide_chapter', '_bitesmart_chapter_summary', array(
        'type'              => 'string',
        'single'            => true,
        'default'           => '',
        'sanitize_callback' => 'sanitize_textarea_field', // preserves line breaks, strips tags
        'show_in_rest'      => true,
        'auth_callback'     => 'bitesmart_guide_chapter_meta_auth_callback',
    ) );

    // Real editor-authored question shown as the H3 heading on this
    // chapter's compact Stage-page search-result card
    // (render_guide_chapter_search_card(), guide-chapter-display.php) —
    // added 2026-08-28, same field/reasoning as Episode's
    // _bitesmart_episode_question (episode-cpt.php): replaces an earlier
    // "Chapter {number}: {title}" sprintf() heading. Single plain string
    // (not per-language), since it renders as real visible text and
    // TranslatePress picks it up normally. Deliberately does NOT affect the
    // pooled multi-Guide search page's full chapter accordion
    // (render_guide_chapter_pooled_card() -> bitesmart_render_guide_chapter_row(),
    // guide-chapter-display.php), which still shows "Chapter {number}:
    // {title}" exactly as before — this field is read only by the compact
    // Stage-page teaser. Left blank, the render function falls back to the
    // plain post title (get_the_title()).
    register_post_meta( 'guide_chapter', '_bitesmart_chapter_question', array(
        'type'              => 'string',
        'single'            => true,
        'default'           => '',
        'sanitize_callback' => 'sanitize_text_field',
        'show_in_rest'      => true,
        'auth_callback'     => 'bitesmart_guide_chapter_meta_auth_callback',
    ) );

    // Per-language Vimeo URLs for this chapter's video version — identical
    // shape to Episode's _bitesmart_episode_videos_by_lang. An empty map
    // means this chapter has no video version (drives the "video" badge
    // and the "no video for this chapter yet" state from the prototype).
    register_post_meta( 'guide_chapter', '_bitesmart_chapter_videos_by_lang', array(
        'type'              => 'object',
        'single'            => true,
        'default'           => array(),
        'sanitize_callback' => 'bitesmart_sanitize_guide_chapter_videos_by_lang',
        'show_in_rest'      => array(
            'schema' => array(
                'type'                 => 'object',
                'additionalProperties' => array( 'type' => 'string' ),
            ),
        ),
        'auth_callback'     => 'bitesmart_guide_chapter_meta_auth_callback',
    ) );

    // Optional display-only label for the video badge/placeholder (e.g.
    // "6 min") — matches the prototype's "dur" field. Free text rather than
    // a computed value since nothing here talks to the Vimeo API.
    register_post_meta( 'guide_chapter', '_bitesmart_chapter_video_duration', array(
        'type'              => 'string',
        'single'            => true,
        'default'           => '',
        'sanitize_callback' => 'sanitize_text_field',
        'show_in_rest'      => true,
        'auth_callback'     => 'bitesmart_guide_chapter_meta_auth_callback',
    ) );

    // Whether this chapter has a text version at all — the prototype's
    // "text" badge/missing-state can't just check "is post_content empty?"
    // because an editor may leave a chapter's canvas with only a heading
    // typed in, or the reverse (real content, but not meant to count as the
    // "text version" yet). Explicit and editor-controlled, same spirit as
    // Q&A Entry's Answer Type toggle.
    register_post_meta( 'guide_chapter', '_bitesmart_chapter_has_text', array(
        'type'          => 'boolean',
        'single'        => true,
        'default'       => false,
        'show_in_rest'  => true,
        'auth_callback' => 'bitesmart_guide_chapter_meta_auth_callback',
    ) );

    // NOTE: a per-chapter downloadable PDF field
    // (_bitesmart_chapter_pdf_by_lang) briefly lived here (2026-08-16) —
    // removed the SAME day once Janet decided the source PDF realistically
    // can't be split into separate per-chapter files: "so the chapters
    // will no longer have individual download links instead its a
    // download button to download the entire guide." Replaced with one
    // GUIDE-level field, _bitesmart_guide_pdf_by_lang (guide-cpt.php) —
    // every chapter's Download button now reads that single field via its
    // parent Guide (see bitesmart_render_guide_chapter_row() in
    // guide-chapter-display.php). If a `_bitesmart_chapter_pdf_by_lang`
    // meta row still exists on any chapter from before this change, it's
    // just an orphaned, harmless value — nothing reads it anymore.

    // Per-language search-matching phrases — plain internal data, NOT
    // rendered as visible page text, so TranslatePress won't auto-translate
    // it (same caveat as every other content type's Keywords/Synonyms
    // field). Same shape as Episode's _bitesmart_episode_keywords_by_lang.
    // Labeled "Synonyms" in the editing UI as of 2026-08-28 to match Q&A
    // Entry's naming; meta key kept as-is.
    register_post_meta( 'guide_chapter', '_bitesmart_chapter_keywords_by_lang', array(
        'type'              => 'object',
        'single'            => true,
        'default'           => array(),
        'sanitize_callback' => 'bitesmart_sanitize_guide_chapter_keywords_by_lang',
        'show_in_rest'      => array(
            'schema' => array(
                'type'                 => 'object',
                'additionalProperties' => array( 'type' => 'string' ),
            ),
        ),
        'auth_callback'     => 'bitesmart_guide_chapter_meta_auth_callback',
    ) );
}
