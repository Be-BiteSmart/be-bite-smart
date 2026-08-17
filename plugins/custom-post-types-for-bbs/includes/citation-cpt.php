<?php
/**
 * Citation custom post type.
 *
 * This plugin (Custom Post Types for BBS) owns the CONTENT MODEL only —
 * the post type itself and its meta fields. The editing UI
 * (custom/citation-fields, locked into this post type's content template
 * below) and the front-end display (custom/guide-references, which lists
 * every published Citation) both live in the separate "Custom Blocks for
 * Be BiteSmart" plugin — see that plugin's src/citation-fields/ and
 * src/guide-references/.
 *
 * One post per numbered reference in the guide's source text (68 of them
 * at launch) — added 2026-08-16, per Janet: "we have 68 of them and in the
 * text they're referred to by their number." A real CPT (not a single
 * repeater field anywhere) specifically because the same citation is cited
 * from MORE than one chapter — giving each one its own post/ID means every
 * inline reference to it (see the "Cite" RichText format,
 * guide-chapter-panel/citation-format.js) can point at ONE stable, live
 * source of truth: editing a citation's Number or Text here updates every
 * chapter that cites it, instantly, with nothing to re-save on the chapter
 * side. Same "headless, no theme template for a standalone permalink"
 * reasoning as Episode/Resource — a citation is only ever displayed
 * embedded (either inline as a chapter's own citation-ref link, or listed
 * on the References page via custom/guide-references).
 *
 * SCOPED TO THE GUIDE, same as guide_chapter — Janet, revisiting the plan
 * before implementation: "the citations should exist in the guide CPT
 * since they are specific to the guide." Weighed a true repeater field
 * stored directly on the Guide post (no built-in WordPress repeater UI,
 * would mean a new custom add/remove/reorder component from scratch)
 * against keeping Citation as its own CPT but scoped to the Guide the
 * exact same way `guide_chapter` already is — she picked the latter, same
 * low-risk already-proven pattern, still gets a free native per-citation
 * edit screen instead of a custom repeater UI. In practice: nested under
 * the "Parent Guide" admin menu (`show_in_menu` below, same setting
 * guide-chapter-cpt.php already uses for "All Chapters") rather than a
 * top-level menu item, and `_bitesmart_citation_guide_id` auto-filled the
 * exact same way a chapter's own `_bitesmart_chapter_guide_id` is (see
 * bitesmart_citation_autofill_guide_id() below).
 *
 * See [[be-bitesmart-guide-cpt-plan]] in memory for the full feature.
 */

function bitesmart_register_citation_post_type() {
    register_post_type( 'citation', array(
        'labels'              => array(
            'name'          => __( 'Citations', 'custom-post-types-for-bbs' ),
            'singular_name' => __( 'Citation', 'custom-post-types-for-bbs' ),
            'add_new_item'  => __( 'Add New Citation', 'custom-post-types-for-bbs' ),
            'edit_item'     => __( 'Edit Citation', 'custom-post-types-for-bbs' ),
            'new_item'      => __( 'New Citation', 'custom-post-types-for-bbs' ),
            'view_item'     => __( 'View Citation', 'custom-post-types-for-bbs' ),
            'search_items'  => __( 'Search Citations', 'custom-post-types-for-bbs' ),
            'not_found'     => __( 'No citations found', 'custom-post-types-for-bbs' ),
            'all_items'     => __( 'All Citations', 'custom-post-types-for-bbs' ),
        ),
        // 'editor' + 'custom-fields' required for the same two reasons as
        // every other CPT here — see episode-cpt.php's 'supports' comment.
        // Canvas locked to exactly one custom/citation-fields block —
        // Number, Text, and optional Source URL all live there as custom
        // meta. Title stays native, but is purely an ADMIN-facing label
        // (helps find "Smith et al., 2020" in the Citations list screen) —
        // never shown to a site visitor; the public-facing text is the
        // Text field on custom/citation-fields.
        'supports'            => array( 'title', 'editor', 'custom-fields' ),
        'template'            => array(
            array( 'custom/citation-fields' ),
        ),
        'template_lock'       => 'all',
        'public'              => false,
        'publicly_queryable'  => false,
        'show_ui'             => true,
        'show_in_menu'        => 'edit.php?post_type=guide', // nests "All Citations" under Parent Guide in wp-admin, same as guide_chapter
        'show_in_admin_bar'   => true,
        'show_in_nav_menus'   => false,
        'exclude_from_search' => true,
        'has_archive'         => false,
        'rewrite'             => false,
        'show_in_rest'        => true, // required for the block editor + REST access
        'rest_base'           => 'citation',
        'capability_type'     => 'post',
        // No menu_icon/menu_position — both are no-ops once show_in_menu
        // above points at a PARENT slug instead of `true` (nested submenu
        // items don't use either); same omission guide-chapter-cpt.php
        // already makes for the same reason.
    ) );

    bitesmart_register_citation_meta();
}
add_action( 'init', 'bitesmart_register_citation_post_type' );

/**
 * Every citation always belongs to the one Guide — there's no editor
 * picker for this, same reasoning/mechanism as a chapter's own
 * `_bitesmart_chapter_guide_id`
 * (bitesmart_guide_chapter_autofill_guide_id(), guide-chapter-cpt.php):
 * auto-fills `_bitesmart_citation_guide_id` with
 * bitesmart_get_the_main_guide()'s ID whenever it's still empty.
 *
 * Hooks `rest_after_insert_citation`, NOT `save_post_citation` — same
 * REST-timing lesson as the chapter version: `save_post` fires from
 * `wp_update_post()`, which runs BEFORE the REST controller applies that
 * SAME request's own meta values, so a `save_post`-time fix here would get
 * silently overwritten a moment later. `rest_after_insert_*` fires once
 * REST's entire create/update is fully done, so it's the hook that
 * actually reflects final state.
 *
 * @param WP_Post         $post     Inserted or updated citation post.
 * @param WP_REST_Request $request  The REST request.
 * @param bool            $creating True on create, false on update.
 */
function bitesmart_citation_autofill_guide_id( $post, $request, $creating ) {
    if ( (int) get_post_meta( $post->ID, '_bitesmart_citation_guide_id', true ) ) {
        return; // already set — the only Guide it could ever be
    }

    $guide = bitesmart_get_the_main_guide();
    if ( $guide ) {
        update_post_meta( $post->ID, '_bitesmart_citation_guide_id', $guide->ID );
    }
}
add_action( 'rest_after_insert_citation', 'bitesmart_citation_autofill_guide_id', 10, 3 );

/**
 * The native Title field sits above the locked custom/citation-fields
 * block with nothing visually tying the two together — same placeholder
 * fix as every other locked-canvas CPT here (see e.g.
 * bitesmart_resource_title_placeholder() in resource-cpt.php).
 */
function bitesmart_citation_title_placeholder( $title, $post ) {
    if ( $post && 'citation' === $post->post_type ) {
        $title = __( 'Internal label only, e.g. "Smith et al., 2020" — not shown to visitors', 'custom-post-types-for-bbs' );
    }
    return $title;
}
add_filter( 'enter_title_here', 'bitesmart_citation_title_placeholder', 10, 2 );

/**
 * Number + Text + HTML Link + DOI + PDF Link columns on the "All
 * Citations" list screen — added 2026-08-16 right after the 68-citation
 * import, per Janet: "each one has no actual citation information" (the
 * data was actually fine — confirmed directly against the database — but
 * the DEFAULT list screen only ever shows Title, and every citation's
 * Title is just an internal "Citation N" label, so the real content was
 * invisible without opening each one individually). DOI/PDF Link columns
 * added the same day, same reasoning, once those became their own fields:
 * Janet wanted them glanceable on the list too, not just on each
 * citation's own edit screen. Standard WP admin-columns pattern
 * (manage_{$post_type}_posts_columns / manage_{$post_type}_posts_custom_column),
 * inserted right after the (checkbox) column and before Title/Date.
 */
function bitesmart_citation_admin_columns( $columns ) {
    $new_columns = array();
    foreach ( $columns as $key => $label ) {
        $new_columns[ $key ] = $label;
        if ( 'cb' === $key ) {
            $new_columns['citation_number'] = __( 'Number', 'custom-post-types-for-bbs' );
        }
    }
    $new_columns['citation_text'] = __( 'Citation Text', 'custom-post-types-for-bbs' );
    $new_columns['citation_url']  = __( 'HTML Link', 'custom-post-types-for-bbs' );
    $new_columns['citation_doi']  = __( 'DOI', 'custom-post-types-for-bbs' );
    $new_columns['citation_pdf']  = __( 'PDF Link', 'custom-post-types-for-bbs' );
    return $new_columns;
}
add_filter( 'manage_citation_posts_columns', 'bitesmart_citation_admin_columns' );

/**
 * Shared by the HTML Link/DOI/PDF Link columns below — each of those meta
 * values can be either a real url or plain status text ("Not available",
 * "Subscription / institutional access", etc. — see this file's meta
 * registration comment), so each column renders a clickable link ONLY when
 * the stored value actually validates as one, plain text otherwise. Same
 * decision bitesmart_render_citation_link_field() makes for the public
 * References page (guide-references.php) — this is the admin-list-table
 * equivalent.
 *
 * Link text is the FULL url, not just its host — originally shortened to
 * host-only (`wp_parse_url(..., PHP_URL_HOST)`) to keep list columns
 * narrow, but Janet caught that this actively loses the one piece of
 * information that actually identifies a DOI: every single DOI link's host
 * is "doi.org" (e.g. https://doi.org/10.1542/peds.2012-2552) — the
 * article-identifying part is entirely in the PATH, so host-only display
 * showed "doi.org" on every row, indistinguishable from one another. Kept
 * narrow instead via a CSS `text-overflow: ellipsis` truncation (inline
 * style — this plugin has no admin CSS enqueue to add a class to) with the
 * untruncated value in `title` so the full url is still one hover away.
 *
 * @param string $value
 */
function bitesmart_citation_admin_render_link_cell( $value ) {
    if ( ! $value ) {
        return;
    }

    if ( filter_var( $value, FILTER_VALIDATE_URL ) ) {
        printf(
            '<a href="%1$s" target="_blank" rel="noopener noreferrer" title="%2$s" style="display:inline-block;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom;">%3$s</a>',
            esc_url( $value ),
            esc_attr( $value ),
            esc_html( $value )
        );
        return;
    }

    echo esc_html( $value );
}

function bitesmart_citation_admin_column_content( $column, $post_id ) {
    if ( 'citation_number' === $column ) {
        echo esc_html( get_post_meta( $post_id, '_bitesmart_citation_number', true ) );
        return;
    }

    if ( 'citation_text' === $column ) {
        $text = get_post_meta( $post_id, '_bitesmart_citation_text', true );
        // wp_trim_words() on the STRIPPED text for the list-table preview
        // — the full wp_kses_post()'d HTML (italics, links) still only
        // ever renders on the References page/hover tooltip, this is just
        // a glanceable snippet so an editor can confirm at a glance that
        // real content actually exists, not the final public rendering.
        echo esc_html( wp_trim_words( wp_strip_all_tags( $text ), 20 ) );
        return;
    }

    if ( 'citation_url' === $column ) {
        bitesmart_citation_admin_render_link_cell( get_post_meta( $post_id, '_bitesmart_citation_html_url', true ) );
        return;
    }

    if ( 'citation_doi' === $column ) {
        bitesmart_citation_admin_render_link_cell( get_post_meta( $post_id, '_bitesmart_citation_doi', true ) );
        return;
    }

    if ( 'citation_pdf' === $column ) {
        bitesmart_citation_admin_render_link_cell( get_post_meta( $post_id, '_bitesmart_citation_pdf', true ) );
        return;
    }
}
add_action( 'manage_citation_posts_custom_column', 'bitesmart_citation_admin_column_content', 10, 2 );

/**
 * Makes the new Number column sortable — clicking its header sorts the
 * list numerically by _bitesmart_citation_number, same "meta_value_num"
 * technique as any other admin-column sort keyed off a numeric meta field.
 */
function bitesmart_citation_sortable_columns( $columns ) {
    $columns['citation_number'] = 'citation_number';
    return $columns;
}
add_filter( 'manage_edit-citation_sortable_columns', 'bitesmart_citation_sortable_columns' );

function bitesmart_citation_admin_sort_query( $query ) {
    if ( ! is_admin() || ! $query->is_main_query() || 'citation_number' !== $query->get( 'orderby' ) ) {
        return;
    }
    $query->set( 'meta_key', '_bitesmart_citation_number' );
    $query->set( 'orderby', 'meta_value_num' );
}
add_action( 'pre_get_posts', 'bitesmart_citation_admin_sort_query' );

/**
 * Only editors who can edit the specific citation can read/write its meta
 * via REST — same explicit auth_callback pattern as every other CPT here.
 */
function bitesmart_citation_meta_auth_callback( $allowed, $meta_key, $post_id ) {
    return current_user_can( 'edit_post', $post_id );
}

/**
 * All custom fields for the Citation CPT.
 */
function bitesmart_register_citation_meta() {
    // Which Guide this citation belongs to — same relationship-via-meta
    // pattern as a chapter's own _bitesmart_chapter_guide_id
    // (guide-chapter-cpt.php). NOT editor-set — auto-filled by
    // bitesmart_citation_autofill_guide_id() above, since there's only
    // ever one Guide to belong to (see guide-cpt.php).
    register_post_meta( 'citation', '_bitesmart_citation_guide_id', array(
        'type'          => 'integer',
        'single'        => true,
        'default'       => 0,
        'show_in_rest'  => true,
        'auth_callback' => 'bitesmart_citation_meta_auth_callback',
    ) );

    // Both the display label ("14.") on the References page AND the sort
    // key for that list, AND what a chapter's inline "Cite" reference
    // resolves its visible digit from at render time — same
    // "display-label-doubles-as-sort-key" string-field pattern as
    // _bitesmart_chapter_number (guide-chapter-cpt.php).
    register_post_meta( 'citation', '_bitesmart_citation_number', array(
        'type'              => 'string',
        'single'            => true,
        'default'           => '',
        'sanitize_callback' => 'sanitize_text_field',
        'show_in_rest'      => true,
        'auth_callback'     => 'bitesmart_citation_meta_auth_callback',
    ) );

    // The reference itself. wp_kses_post() (not sanitize_textarea_field())
    // deliberately — a real citation commonly needs an italicized journal/
    // book title or an inline link to the source, and a plain-text field
    // can't hold either. This is the lesson learned from the Usage Rights
    // detour earlier this session (built as a plain textarea field first,
    // had to be reworked once the real text turned out to need lists/
    // links) — built with room for basic formatting from the start here
    // instead of repeating that same mistake.
    register_post_meta( 'citation', '_bitesmart_citation_text', array(
        'type'              => 'string',
        'single'            => true,
        'default'           => '',
        'sanitize_callback' => 'wp_kses_post',
        'show_in_rest'      => true,
        'auth_callback'     => 'bitesmart_citation_meta_auth_callback',
    ) );

    // DOI / HTML link / PDF link — three separate optional source-link
    // fields, added 2026-08-16 after the first import turned out to have
    // silently dropped DOI and PDF entirely (collapsed everything into one
    // "Source URL" field using only the HTML link). Deliberately plain
    // `sanitize_text_field()`, NOT `esc_url_raw()`, on all three: in
    // Janet's actual source list a fair number of these are NOT urls at
    // all — plain status text like "Not available", "Not applicable",
    // "Subscription / institutional access", or "Varies by article" — and
    // `esc_url_raw()` would silently mangle/blank out exactly that text.
    // Whether a given value is actually a clickable link is decided at
    // RENDER time instead (see bitesmart_citation_link_or_text() in
    // guide-references.php), not at save time.
    register_post_meta( 'citation', '_bitesmart_citation_doi', array(
        'type'              => 'string',
        'single'            => true,
        'default'           => '',
        'sanitize_callback' => 'sanitize_text_field',
        'show_in_rest'      => true,
        'auth_callback'     => 'bitesmart_citation_meta_auth_callback',
    ) );

    // Renamed from the original _bitesmart_citation_url — this is
    // specifically the HTML-format link (as opposed to the PDF link
    // below), matching how Janet's own source list labels it.
    register_post_meta( 'citation', '_bitesmart_citation_html_url', array(
        'type'              => 'string',
        'single'            => true,
        'default'           => '',
        'sanitize_callback' => 'sanitize_text_field',
        'show_in_rest'      => true,
        'auth_callback'     => 'bitesmart_citation_meta_auth_callback',
    ) );

    register_post_meta( 'citation', '_bitesmart_citation_pdf', array(
        'type'              => 'string',
        'single'            => true,
        'default'           => '',
        'sanitize_callback' => 'sanitize_text_field',
        'show_in_rest'      => true,
        'auth_callback'     => 'bitesmart_citation_meta_auth_callback',
    ) );
}

/**
 * One-time bulk import of all 68 real citations Janet pasted mid-session
 * (see citation-seed-data.php for the actual data + its own notes on why
 * some entries repeat) — creates one `citation` post per entry, each
 * auto-linked to the one Guide the exact same way
 * bitesmart_citation_autofill_guide_id() does for a manually-created one.
 *
 * Deliberately NOT auto-run on `init` the way this codebase's smaller
 * taxonomy-term seeders are (bitesmart_seed_stage_terms(),
 * bitesmart_seed_guide_section_terms()) — creating a handful of taxonomy
 * terms silently in the background is cheap/harmless; creating 68 full
 * POSTS is a real, visible bulk-content action Janet should knowingly
 * trigger herself, not something that just happens on her next page load.
 * Triggered instead by bitesmart_citation_import_notice() below — a
 * one-click, nonce-protected admin-notice button on the Citations list
 * screen, shown only while there are zero citations yet.
 *
 * Idempotent via the same "option flag" guard as every other seeder in
 * this codebase — safe to trigger more than once by accident (e.g. a
 * double-click) without creating 136 posts.
 *
 * @return int Number of citations created.
 */
function bitesmart_seed_citations() {
    if ( get_option( 'bitesmart_citations_seeded' ) ) {
        return 0;
    }

    $count = bitesmart_do_seed_citations();

    update_option( 'bitesmart_citations_seeded', true );
    // A fresh, never-before-seeded install gets the current (complete)
    // data straight away, so it never needs the DOI/PDF migration notice
    // below either — see bitesmart_citation_v2_migration_notice().
    update_option( 'bitesmart_citations_v2_seeded', true );

    return $count;
}

/**
 * The actual insert loop, split out from bitesmart_seed_citations() above
 * so bitesmart_reset_and_reseed_citations() (the DOI/PDF migration below)
 * can reuse it without the "already seeded" guard getting in the way.
 *
 * @return int Number of citations created.
 */
function bitesmart_do_seed_citations() {
    $guide = bitesmart_get_the_main_guide();
    $count = 0;

    foreach ( bitesmart_citation_seed_data() as $entry ) {
        $post_id = wp_insert_post( array(
            'post_type'    => 'citation',
            /* translators: %d: citation number, imported for internal wp-admin labeling only */
            'post_title'   => sprintf( __( 'Citation %d', 'custom-post-types-for-bbs' ), $entry['number'] ),
            'post_status'  => 'publish',
            // THE ROOT CAUSE of "no attributes editable" (Janet, 2026-08-16):
            // wp_insert_post() bypasses the normal "Add New" editor flow
            // entirely, so without this, post_content is left a genuinely
            // empty string. A brand-new, never-saved post auto-populates
            // its required template block on open — but an EXISTING post
            // with zero blocks does NOT get that template retroactively
            // inserted just because template_lock is 'all'; the canvas
            // just opens empty, with nothing to click into and nothing to
            // insert (locked). Every citation created by hand via "Add
            // New Citation" was never affected — Gutenberg writes this
            // exact self-closing comment itself the moment the template's
            // one block is auto-inserted into a fresh post. Serializes to
            // the self-closing form because custom/citation-fields has no
            // block.json attributes and save() returns null (no innerHTML).
            'post_content' => '<!-- wp:custom/citation-fields /-->',
        ), true );

        if ( is_wp_error( $post_id ) ) {
            continue; // skip this one, keep importing the rest rather than aborting the whole batch
        }

        update_post_meta( $post_id, '_bitesmart_citation_number', (string) $entry['number'] );
        update_post_meta( $post_id, '_bitesmart_citation_text', wp_kses_post( $entry['text'] ) );
        update_post_meta( $post_id, '_bitesmart_citation_doi', sanitize_text_field( $entry['doi'] ) );
        update_post_meta( $post_id, '_bitesmart_citation_html_url', sanitize_text_field( $entry['html'] ) );
        update_post_meta( $post_id, '_bitesmart_citation_pdf', sanitize_text_field( $entry['pdf'] ) );
        if ( $guide ) {
            update_post_meta( $post_id, '_bitesmart_citation_guide_id', $guide->ID );
        }

        ++$count;
    }

    return $count;
}

/**
 * One-time DOI/PDF data-completeness fix, added 2026-08-16 right after
 * Janet reported the first import "cut out" information: "There were DIO,
 * HTML and PDF fields, some of which had urls some had information like
 * not available." The first import only ever captured the HTML link as a
 * single generic "Source URL" and silently dropped DOI and PDF — this
 * wasn't a partial-fields bug, it was a genuinely incomplete data model.
 *
 * Rather than trying to patch the 68 already-imported posts in place
 * (matching them back up to their seed-data entry by Number, one at a
 * time), this just TRASHES every existing citation post and reseeds from
 * scratch with the now-complete bitesmart_citation_seed_data() — safe to
 * do because these 68 posts only ever existed as auto-generated import
 * output; nothing hand-authored on them yet. wp_trash_post() (not a hard
 * delete) so this is still recoverable from the Trash if anything looks
 * wrong after the fact. Any chapter's "Cite" reference by post ID would
 * break across a reset like this (the old post IDs get trashed) — but as
 * of this fix, no chapter has actually used the Cite tool yet (still
 * pending per [[be-bitesmart-guide-cpt-plan]]'s "Still to do"), so there's
 * nothing yet to break.
 *
 * @return int Number of citations created by the reseed.
 */
function bitesmart_reset_and_reseed_citations() {
    $existing = get_posts( array(
        'post_type'      => 'citation',
        'post_status'    => 'any',
        'posts_per_page' => -1,
        'fields'         => 'ids',
    ) );
    foreach ( $existing as $post_id ) {
        wp_trash_post( $post_id );
    }

    $count = bitesmart_do_seed_citations();

    update_option( 'bitesmart_citations_seeded', true );
    update_option( 'bitesmart_citations_v2_seeded', true );

    return $count;
}

/**
 * One-click "Import the 68 citations" button on the Citations list screen
 * (edit.php?post_type=citation) — only shown while there are zero
 * citations yet, so it naturally disappears once the import's been done
 * (or if Janet ends up creating them by hand instead, without ever
 * clicking this). Same current_user_can()/wp_nonce_url() pattern as any
 * other one-off admin action link.
 */
function bitesmart_citation_import_notice() {
    $screen = get_current_screen();
    if ( ! $screen || 'edit-citation' !== $screen->id || ! current_user_can( 'edit_posts' ) ) {
        return;
    }

    if ( get_option( 'bitesmart_citations_seeded' ) ) {
        return;
    }

    $counts = wp_count_posts( 'citation' );
    if ( ! empty( $counts->publish ) ) {
        return; // citations already exist (created by hand, or a previous import) — nothing to offer here
    }

    $import_url = wp_nonce_url(
        add_query_arg( 'bitesmart_import_citations', '1' ),
        'bitesmart_import_citations'
    );
    ?>
    <div class="notice notice-info">
        <p>
            <?php esc_html_e( 'No citations yet.', 'custom-post-types-for-bbs' ); ?>
            <a href="<?php echo esc_url( $import_url ); ?>" class="button button-primary">
                <?php esc_html_e( 'Import the 68 citations', 'custom-post-types-for-bbs' ); ?>
            </a>
        </p>
    </div>
    <?php
}
add_action( 'admin_notices', 'bitesmart_citation_import_notice' );

/**
 * Handles the actual click on bitesmart_citation_import_notice()'s button
 * above. Hooked to `admin_init` (runs early enough to redirect before any
 * page output has started) rather than handled inline in the notice
 * function itself, so the import runs exactly once per click even though
 * the notice function itself re-runs on every admin page load.
 */
function bitesmart_handle_citation_import_request() {
    if ( ! isset( $_GET['bitesmart_import_citations'] ) || ! current_user_can( 'edit_posts' ) ) {
        return;
    }

    check_admin_referer( 'bitesmart_import_citations' );

    $imported = bitesmart_seed_citations();

    wp_safe_redirect( add_query_arg(
        array(
            'post_type'                => 'citation',
            'bitesmart_citations_done' => $imported,
        ),
        admin_url( 'edit.php' )
    ) );
    exit;
}
add_action( 'admin_init', 'bitesmart_handle_citation_import_request' );

/**
 * Simple "Imported N citations" confirmation, shown once right after the
 * redirect above.
 */
function bitesmart_citation_import_done_notice() {
    if ( ! isset( $_GET['bitesmart_citations_done'] ) ) {
        return;
    }

    $count = (int) $_GET['bitesmart_citations_done'];
    ?>
    <div class="notice notice-success is-dismissible">
        <p>
            <?php
            printf(
                /* translators: %d: number of citations imported */
                esc_html__( 'Imported %d citations.', 'custom-post-types-for-bbs' ),
                $count
            );
            ?>
        </p>
    </div>
    <?php
}
add_action( 'admin_notices', 'bitesmart_citation_import_done_notice' );

/**
 * One-time "your citations are missing DOI/PDF" migration notice — shown
 * only once, only to sites that already ran the ORIGINAL (lossy) import
 * (bitesmart_citations_seeded true) but haven't yet gotten the corrected
 * data (bitesmart_citations_v2_seeded not yet set). Disappears permanently
 * for everyone once clicked — same one-click, nonce-protected,
 * disappears-once-done shape as bitesmart_citation_import_notice() above.
 */
function bitesmart_citation_v2_migration_notice() {
    $screen = get_current_screen();
    if ( ! $screen || 'edit-citation' !== $screen->id || ! current_user_can( 'edit_posts' ) ) {
        return;
    }

    if ( ! get_option( 'bitesmart_citations_seeded' ) || get_option( 'bitesmart_citations_v2_seeded' ) ) {
        return;
    }

    $reset_url = wp_nonce_url(
        add_query_arg( 'bitesmart_reset_citations', '1' ),
        'bitesmart_reset_citations'
    );
    ?>
    <div class="notice notice-warning">
        <p>
            <?php esc_html_e( 'The original citation import only captured one link per citation and dropped the DOI and PDF fields. Click below to replace all 68 citations with the corrected, complete data (the old ones are moved to Trash, not permanently deleted).', 'custom-post-types-for-bbs' ); ?>
        </p>
        <p>
            <a href="<?php echo esc_url( $reset_url ); ?>" class="button button-primary" onclick="return confirm('<?php echo esc_js( __( 'This will trash all existing Citation posts and re-import all 68 with the corrected data. Continue?', 'custom-post-types-for-bbs' ) ); ?>');">
                <?php esc_html_e( 'Fix citations: add DOI + PDF links', 'custom-post-types-for-bbs' ); ?>
            </a>
        </p>
    </div>
    <?php
}
add_action( 'admin_notices', 'bitesmart_citation_v2_migration_notice' );

/**
 * Handles the click on bitesmart_citation_v2_migration_notice()'s button
 * above — same admin_init-redirect shape as
 * bitesmart_handle_citation_import_request().
 */
function bitesmart_handle_citation_reset_request() {
    if ( ! isset( $_GET['bitesmart_reset_citations'] ) || ! current_user_can( 'edit_posts' ) ) {
        return;
    }

    check_admin_referer( 'bitesmart_reset_citations' );

    $imported = bitesmart_reset_and_reseed_citations();

    wp_safe_redirect( add_query_arg(
        array(
            'post_type'                => 'citation',
            'bitesmart_citations_done' => $imported,
        ),
        admin_url( 'edit.php' )
    ) );
    exit;
}
add_action( 'admin_init', 'bitesmart_handle_citation_reset_request' );
