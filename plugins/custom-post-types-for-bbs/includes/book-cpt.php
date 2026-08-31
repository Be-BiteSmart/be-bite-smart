<?php
/**
 * Book custom post type — book recommendations (e.g. "Doggie Language: A Dog
 * Lover's Guide to Understanding Your Best Friend"), not BBS-specific
 * content but tagged and surfaced the same way everything else in the
 * Learning Hub is.
 *
 * This plugin (Custom Post Types for BBS) owns the CONTENT MODEL only — the
 * post type itself, its meta fields, and attaching it to the Topic taxonomy
 * (NOT Series — books aren't tied to the "Paws To Prevent" show the way
 * Episode/Coloring Book are; NOT Stage or Media Type either, as of
 * 2026-08-30 — both were search/browse-filter machinery with nothing left
 * to feed once Book left the Learning Hub search listing, see further down
 * in this file). The editing UI
 * (custom/book-panel) and the front-end display block (custom/book) both
 * live in the separate "Custom Blocks for Be BiteSmart" plugin — see that
 * plugin's src/book-panel/ and src/book-display/. That plugin declares this
 * one as a dependency (its "Requires Plugins" header), so WordPress won't
 * let it activate without this plugin also active.
 *
 * Book's content-editing shape changed several times on 2026-08-30 before
 * settling here — full blow-by-blow in [[be-bitesmart-book-cpt-status]] in
 * memory. Short version: originally an UNLOCKED canvas (post_content was
 * the recommendation body directly, restricted via an allowed_block_types_all
 * filter). Janet then asked for Q&A-Entry-style dedicated fields, which
 * became a locked custom/book-fields block (Custom Blocks plugin) with two
 * RichText fields storing HTML in post meta — but real content needs a
 * bulleted list sitting in the MIDDLE of a paragraph (e.g. "How to Speak
 * Dog": intro sentence, 4-item list, closing sentence), which no meta-field
 * shape can represent, and RichText's `multiline` mode (the obvious fix)
 * failed silently, twice, when tried.
 *
 * Landed here: the canvas is STILL locked to one top-level block
 * (custom/book-fields), same `template`/`template_lock: 'all'` mechanism as
 * Q&A/Resource, but that block's own content is now two further-locked,
 * always-ordered, clearly-labeled sections (custom/book-summary-section
 * always first, custom/book-excerpt-section always second — neither can be
 * removed or reordered) — and WITHIN each section, a genuinely free nested
 * Paragraph/List editing area (real InnerBlocks, `templateLock: false`,
 * `allowedBlocks: ['core/paragraph','core/list']`). This is the same
 * per-level `templateLock` nesting Core's own Columns/Column block uses.
 * post_content is USED again as of this design (unlike the brief meta-field
 * interlude) — InnerBlocks content can only ever serialize into its parent
 * block's own output, there's no way to redirect it into a meta field, and
 * real nested block editing is exactly the mechanism WordPress already
 * provides for "freely interleave these block types" — reusing decades-old
 * block parsing/rendering rather than any RichText trick. render_book_block()
 * (book-display.php) extracts the two sections via `parse_blocks()` +
 * `render_block()`.
 *
 * Everything ELSE (Audience, Pages, Buy Links, Inside-the-Book preview
 * images) stays in the existing sidebar panel
 * (custom/book-panel, a PluginDocumentSettingPanel) — this restructuring
 * was scoped to just the two write-up sections, not a full migration of
 * every Book field into the locked canvas the way Q&A Entry has everything.
 *
 * Existing books' content was migrated (twice, matching the two shape
 * changes above) — see the 2026-08-30 entries in
 * [[be-bitesmart-book-cpt-status]] in memory for the full history.
 *
 * UNLIKE Guide Chapter, Book stays HEADLESS (public/publicly_queryable
 * false) — same as Episode/Resource/Coloring Book: no theme in this install
 * renders a standalone permalink page, so a book is only ever displayed
 * embedded via custom/book, wherever an editor manually places it — either
 * a hand-authored topic page, or one of the Audience-grouped custom/books-list
 * instances on the Books page (see [[be-bitesmart-book-cpt-status]] in
 * memory).
 *
 * NOT attached to the Stage taxonomy (removed 2026-08-30, per Janet — was
 * attached until then so books could be picked up by the Stage-scoped
 * Learning Hub search/browse, bitesmart_build_stage_card_list() in
 * learning-search.php; Book was removed from that listing entirely on
 * 2026-08-28, so tagging a book's Stage had nothing left to feed and the
 * selector was just clutter in the editor). Any Stage terms already saved
 * on existing books before this change are harmless leftover data — not
 * cleaned up, since that's a separate DB write Janet didn't ask for.
 *
 * Same removal, same day, extended to everything ELSE that only ever
 * existed for that same search/browse machinery, per Janet: the Media Type
 * taxonomy attachment (drove the Learning Hub's "Filter by type"
 * checkboxes) and its `bitesmart_default_book_media_type_term()` default,
 * and the per-language Search Keywords meta field/UI
 * (`_bitesmart_book_keywords_by_lang`, fed `bitesmart_stage_card_keywords()`
 * in learning-search.php's Fuse.js search index). All removed outright, not
 * just left dormant — unlike the Stage taxonomy attachment above, there was
 * no reason to keep this one "just in case" the way Stage's leftover terms
 * were left alone.
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
        // gotchas apply here verbatim — 'editor' is required even though
        // post_content itself goes unused now (same as Q&A Entry/Resource).
        // 'template'/'template_lock' lock the canvas to exactly one block,
        // custom/book-fields (Custom Blocks plugin) — added 2026-08-30, same
        // mechanism as qa-entry-cpt.php/resource-cpt.php.
        'supports'            => array( 'title', 'editor', 'thumbnail', 'custom-fields' ),
        'template'            => array(
            array( 'custom/book-fields' ),
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
        'rest_base'           => 'book',
        'menu_icon'           => 'dashicons-book',
        'menu_position'       => 25,
        'capability_type'     => 'post',
    ) );

    // Attaches Book to the shared Topic taxonomy (includes/topic-taxonomy.php,
    // this plugin) — free-tag topic labeling, still useful for an editor's
    // own organization even though nothing currently queries by it (Book
    // isn't in any Stage/Topic-scoped listing — see the file header for the
    // Stage removal). Deliberately NOT attached to 'series' — books aren't
    // episodes of "Paws To Prevent". NOT attached to 'stage' or 'media_type'
    // as of 2026-08-30 — see file header.
    register_taxonomy_for_object_type( 'topic', 'book' );

    bitesmart_register_book_meta();
}
add_action( 'init', 'bitesmart_register_book_post_type' );

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
 * Audience was originally a fixed two-value toggle (For Readers of Any Age /
 * For Adult Readers) — anything else input falls back to 'all_ages' rather
 * than being stored as-is. Same shape/reasoning as
 * bitesmart_sanitize_qa_entry_answer_type() in qa-entry-cpt.php.
 *
 * Expanded 2026-08-29, per Janet, to four values — her Books page groups
 * recommendations into more buckets than a binary toggle could express:
 * books clearly for younger children, books for older kids, and adult books
 * picture-rich enough to double as a teaching tool with guidance. Both
 * original slugs/behavior are kept unchanged (no data migration needed —
 * every existing book is already 'all_ages' or 'adult'); only 'all_ages'
 * gained a new display LABEL ("All Ages (With Guidance)", see
 * bitesmart_books_list_audience_groups() in books-list.php), not a new
 * slug. Fixed order used everywhere (this field's enum, the book-panel
 * RadioControl, and the books-list.php grouping): Younger Children, Older
 * Children, Adults, All Ages (With Guidance) — Janet's own stated order.
 *
 * @param mixed $value Raw value.
 * @return string One of 'younger_children', 'older_children', 'adult', 'all_ages'.
 */
function bitesmart_sanitize_book_audience( $value ) {
    $allowed = array( 'younger_children', 'older_children', 'adult', 'all_ages' );
    return in_array( $value, $allowed, true ) ? $value : 'all_ages';
}

/**
 * Sanitize the "Inside the Book" preview-image picker (added 2026-08-29,
 * per Janet — optional interior-page photos shown as a small carousel
 * alongside the cover, see bitesmart_book_cover_gallery() in
 * book-display.php). Filters to positive integers that are actual image
 * attachments, dropping anything else (a stray non-image ID, a deleted
 * attachment, non-numeric junk) rather than storing it — same defensive
 * posture as this file's other sanitizers. Order is preserved (the order the
 * editor selected them in the media library), not re-sorted.
 *
 * @param mixed $value Raw value.
 * @return array<int, int> Attachment IDs.
 */
function bitesmart_sanitize_book_preview_images( $value ) {
    if ( ! is_array( $value ) ) {
        return array();
    }

    $ids = array_map( 'absint', $value );
    $ids = array_filter( $ids, function ( $id ) {
        return $id > 0 && wp_attachment_is_image( $id );
    } );

    return array_values( $ids );
}

/**
 * Sanitize the Buy Links repeater (_bitesmart_book_buy_links, added
 * 2026-08-30, per Janet — multiple retailer buttons per book, e.g. Amazon
 * and Target). Drops any entry with no url at all (an incomplete/empty row
 * left over from the editor's "Add Buy Link" button) since there's nothing
 * to link to; a blank label is kept as-is; render_book_block()
 * (book-display.php) is what supplies the "Buy / More Info" fallback
 * wording for a blank label, not this sanitizer — sanitization here is only
 * about what gets stored. Order is preserved (the order entered in the
 * editor), same as the preview-images list above.
 *
 * @param mixed $value Raw value.
 * @return array<int, array{label: string, url: string}>
 */
function bitesmart_sanitize_book_buy_links( $value ) {
    if ( ! is_array( $value ) ) {
        return array();
    }

    $links = array();
    foreach ( $value as $entry ) {
        if ( ! is_array( $entry ) ) {
            continue;
        }

        $url = isset( $entry['url'] ) ? esc_url_raw( $entry['url'] ) : '';
        if ( '' === $url ) {
            continue; // nothing to link to — drop the row.
        }

        $links[] = array(
            'label' => isset( $entry['label'] ) ? sanitize_text_field( $entry['label'] ) : '',
            'url'   => $url,
        );
    }

    return array_values( $links );
}

/**
 * Sanitize the page-count field (_bitesmart_book_pages) — a plain positive
 * integer, e.g. 32. Anything not a positive whole number (blank, negative,
 * non-numeric junk) coerces to 0, which render_book_block() (book-display.php)
 * treats as "not set" and skips rendering entirely, same posture as every
 * other optional Book field here.
 *
 * @param mixed $value Raw value.
 * @return int
 */
function bitesmart_sanitize_book_pages( $value ) {
    $pages = absint( $value );
    return $pages > 0 ? $pages : 0;
}

/**
 * All custom fields for the Book CPT. Native fields (title, thumbnail) need
 * no registration here. "Why BBS Recommends This Book" and Book Excerpt —
 * the book's actual write-up — are NOT meta fields; they're real nested
 * Paragraph/List blocks inside post_content, locked into two named sections
 * via custom/book-fields
 * (Custom Blocks plugin) — see the file header for why. Only the OTHER
 * fields below (Audience, Target Audience, page count, preview images, URL)
 * are post meta.
 */
function bitesmart_register_book_meta() {
    // Added 2026-08-16, per Janet: some book recommendations are kid-facing,
    // some are written for an adult reader (a parent), and Stage alone
    // doesn't communicate that (a book can span every Stage the way "dog
    // body language" knowledge is useful at any age). Janet's own framing
    // of the split — "For Readers of any age" vs. "For Adult Readers" —
    // rather than a literal "kids vs. adults" choice, since a kid-friendly
    // book is still perfectly fine for a parent to read too. Drives Books
    // List grouping (books-list.php) — NOT rendered as a card badge as of
    // 2026-08-31 (see _bitesmart_book_target_audience below for what
    // replaced it on the card, and [[be-bitesmart-book-cpt-status]] in
    // memory for why: a card's badge just repeating the same words as its
    // surrounding group heading on the Books List page was redundant).
    // Expanded 2026-08-29 to four values — see bitesmart_sanitize_book_audience()
    // above for the full reasoning and fixed order.
    register_post_meta( 'book', '_bitesmart_book_audience', array(
        'type'              => 'string',
        'single'            => true,
        'default'           => 'all_ages',
        'sanitize_callback' => 'bitesmart_sanitize_book_audience',
        'show_in_rest'      => array(
            'schema' => array(
                'type' => 'string',
                'enum' => array( 'younger_children', 'older_children', 'adult', 'all_ages' ),
            ),
        ),
        'auth_callback'     => 'bitesmart_book_meta_auth_callback',
    ) );

    // Added 2026-08-31, per Janet: a short freeform blurb (e.g. "Ages 4-7",
    // "New puppy owners") shown as the card's own badge — see
    // bitesmart_book_target_audience_badge() in book-display.php. Separate
    // from Audience above on purpose: Audience is a fixed 4-value category
    // that controls WHICH group of the Books List page a book appears
    // under; Target Audience is purely descriptive text for the card badge,
    // has no bearing on grouping/querying, and — unlike Audience — is
    // genuinely optional. Blank by default; the badge simply doesn't render
    // when it's blank, since freeform text has no meaningful placeholder
    // state the way the old 4-value badge did.
    register_post_meta( 'book', '_bitesmart_book_target_audience', array(
        'type'              => 'string',
        'single'            => true,
        'default'           => '',
        'sanitize_callback' => 'sanitize_text_field',
        'show_in_rest'      => true,
        'auth_callback'     => 'bitesmart_book_meta_auth_callback',
    ) );

    // Added 2026-08-29, per Janet: optional interior-page photos so a
    // visitor can get a "sneak peek" inside the book, not just the cover —
    // see bitesmart_book_cover_gallery() in book-display.php (Custom Blocks
    // plugin). Empty array by default; when empty, the front end renders
    // exactly the plain cover it always has. Order is preserved (the order
    // selected in the media library) — no drag-to-reorder UI.
    register_post_meta( 'book', '_bitesmart_book_preview_images', array(
        'type'              => 'array',
        'single'            => true,
        'default'           => array(),
        'sanitize_callback' => 'bitesmart_sanitize_book_preview_images',
        'show_in_rest'      => array(
            'schema' => array(
                'type'  => 'array',
                'items' => array( 'type' => 'integer' ),
            ),
        ),
        'auth_callback'     => 'bitesmart_book_meta_auth_callback',
    ) );

    // Added 2026-08-31, per Janet, replacing the old freeform
    // Price/Availability blurb (see bitesmart_sanitize_book_pages() above) —
    // how many pages the book has, shown on the card so a parent can gauge
    // length at a glance. 0 means "not set"; render_book_block()
    // (book-display.php) skips the line entirely in that case, same
    // conditional-render posture as the field it replaces.
    register_post_meta( 'book', '_bitesmart_book_pages', array(
        'type'              => 'integer',
        'single'            => true,
        'default'           => 0,
        'sanitize_callback' => 'bitesmart_sanitize_book_pages',
        'show_in_rest'      => true,
        'auth_callback'     => 'bitesmart_book_meta_auth_callback',
    ) );

    // Kept registered, but no longer written to by the editor UI as of
    // 2026-08-30 — superseded by _bitesmart_book_buy_links below, which
    // supports multiple retailers (Amazon, Target, ...) instead of one link.
    // Left in place, untouched, purely so books saved before this change
    // keep their data; render_book_block() falls back to reading this
    // field only for a book whose buy-links list is still empty (see
    // bitesmart_book_buy_links() in book-display.php) — the editor panel
    // also auto-prefills it into the new list the first time that book's
    // panel is opened. Not deprecated for removal — there's no cleanup step
    // planned, just no longer the primary field.
    register_post_meta( 'book', '_bitesmart_book_url', array(
        'type'              => 'string',
        'single'            => true,
        'default'           => '',
        'sanitize_callback' => 'esc_url_raw',
        'show_in_rest'      => true,
        'auth_callback'     => 'bitesmart_book_meta_auth_callback',
    ) );

    // Added 2026-08-30, per Janet: a book can be available from more than
    // one retailer (e.g. Amazon and Target), each wanting its own visible
    // button label, not one generic "Buy / More Info" link — see
    // bitesmart_sanitize_book_buy_links() below and book-panel/index.js for
    // the repeater UI. Each entry is a {label, url} pair; label may be left
    // blank (the display block falls back to "Buy / More Info" for that
    // button — see render_book_block() in book-display.php), but an entry
    // with no url at all is dropped by the sanitizer rather than stored.
    // Replaces _bitesmart_book_url as the primary buy field — see that
    // field's own comment above for the back-compat story.
    register_post_meta( 'book', '_bitesmart_book_buy_links', array(
        'type'              => 'array',
        'single'            => true,
        'default'           => array(),
        'sanitize_callback' => 'bitesmart_sanitize_book_buy_links',
        'show_in_rest'      => array(
            'schema' => array(
                'type'  => 'array',
                'items' => array(
                    'type'       => 'object',
                    'properties' => array(
                        'label' => array( 'type' => 'string' ),
                        'url'   => array( 'type' => 'string' ),
                    ),
                ),
            ),
        ),
        'auth_callback'     => 'bitesmart_book_meta_auth_callback',
    ) );
}
