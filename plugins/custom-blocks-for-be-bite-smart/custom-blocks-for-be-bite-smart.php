<?php
/**
 * Plugin Name: Custom Blocks for Be BiteSmart
 * Description: Adds custom blocks including Research Article and Bio Card
 * Version: 1.0
 * Author: Janet Spellman-Marsh
 * Requires Plugins: TranslatePress, custom-post-types-for-bbs
 */

// The Episode post type, its meta fields, and the Stage taxonomy are all
// registered in the separate "Custom Post Types for BBS" plugin (see its
// includes/episode-cpt.php and includes/stage-taxonomy.php) — that plugin
// owns the content model, this one owns the blocks that read/write it
// (custom/episode-fields, custom/episode, further down). The "Requires
// Plugins" header above makes that a real dependency: WordPress won't let
// this plugin activate without that one already active.

// Shared helpers (TranslatePress site language, etc.)
require_once __DIR__ . '/src/includes/site-lang.php';
require_once __DIR__ . '/src/includes/video-language-settings.php';

// -----------------------------
// Register all blocks
// register_block_type now reads block.json from build/, which handles
// editorScript, style, and viewScript automatically — no manual enqueues needed.
// -----------------------------


// -----------------------------
// Dynamic save blocks (rendered with php not statically rendered)
// ----------------------------

// -------------- Bio Card Block  ------------------------ //

// Reasons for dynamic rendering over a static save():
// 1. Allows wp_get_attachment_image() to generate correct srcset/sizes attributes
//    for the photo, which the static approach couldn't do.

// 2. Future edits to the template update all bio cards site-wide instantly,
//    with no block recovery needed in the editor.

// 3. The main tradeoff (PHP runs on every page load) is mitigated by the
//    caching plugin — pages are served as static HTML after the first render.

// Special note for future updates: If you update the PHP template but forget to update edit() to match, editors will see one thing in the block editor and something different on the live site. 

require_once __DIR__ . '/src/bio-card/bio-card.php';
// require_once is at the top level — it runs when the plugin loads, so render_bio_card_block is defined before init fires and register_block_type tries to reference it.


function bio_card_register_block() {
    register_block_type( __DIR__ . '/build/bio-card', [
        'render_callback' => 'render_bio_card_block',
    ] );
}
add_action( 'init', 'bio_card_register_block' );

// -------------- Read More Block ------------------------ //
 
function read_more_register_block() {
    register_block_type( __DIR__ . '/build/read-more' );
}
add_action( 'init', 'read_more_register_block' );
 


// -------------- Hero Block  ------------------------ //

// Hero block is a dynamic block — save() returns null in JS and PHP renders
// the HTML via render_callback. This bypasses WordPress's content sanitizer
// which was mangling <picture> and <source> tags on save.
require_once __DIR__ . '/src/hero/hero.php';

function hero_register_block() {
    register_block_type( __DIR__ . '/build/hero', [
        'render_callback' => 'render_hero_block',
    ] );
}
add_action( 'init', 'hero_register_block' );

// ---------------- QR code Block -------------

require_once __DIR__ . '/src/qr-experience/render.php';
require_once plugin_dir_path( __FILE__ ) . 'src/qr-experience/partials.php';


function qr_page_register_block() {          

    register_block_type( __DIR__ . '/build/qr-experience', [
        'render_callback' => 'render_qr_experience_block',
    ] );
}
add_action( 'init', 'qr_page_register_block' );

// ----------- video quote -------------------//

// why it was turned into a dynamic block:

// The thumbnail displays up to 800px wide, meaning a 2x retina version would be 1600px — a significant download without srcset serving the right size per device.

// It appears on the landing page and education page, so the bandwidth savings are felt on the highest-traffic pages of the site.
require_once __DIR__ . '/src/video-quote/video-quote.php';

function documentary_video_register_block() {
    register_block_type( __DIR__ . '/build/video-quote', [
        'render_callback' => 'render_video_quote_block',
    ] );
}
add_action( 'init', 'documentary_video_register_block' );

// -------------- Episode Block (CPT-backed) ------------------------ //

// custom/episode is the CPT-backed replacement for custom/episode-card:
// it stores only which Episode post to show and renders live from that
// post, so the same episode can appear on multiple pages without
// duplicating content. Registered as a NEW block name alongside the old
// one (not replacing it) — custom/episode-card stays exactly as it is
// below, untouched, so existing pages using it keep working during the
// transition. See src/episode-display/episode-display.php.
require_once __DIR__ . '/src/episode-display/episode-display.php';

function episode_register_block() {
    register_block_type( __DIR__ . '/build/episode-display', [
        'render_callback' => 'render_episode_block',
    ] );
}
add_action( 'init', 'episode_register_block' );

// -------------- Resource Block (CPT-backed) ------------------------ //

// custom/resource stores only which Resource post to show and renders
// live from that post — same pattern as custom/episode. See
// src/resource-display/resource-display.php, and the Resource post type
// in the Custom Post Types for BBS plugin's includes/resource-cpt.php.
require_once __DIR__ . '/src/resource-display/resource-display.php';

function resource_register_block() {
    register_block_type( __DIR__ . '/build/resource-display', [
        'render_callback' => 'render_resource_block',
    ] );
}
add_action( 'init', 'resource_register_block' );

// -------------- Q&A Entry Block (CPT-backed) ------------------------ //

// custom/qa-entry stores only which Q&A Entry post to show and renders
// live from that post — same pattern as custom/episode and custom/resource.
// See src/qa-entry-display/qa-entry-display.php, and the Q&A Entry post
// type in the Custom Post Types for BBS plugin's includes/qa-entry-cpt.php.
require_once __DIR__ . '/src/qa-entry-display/qa-entry-display.php';

function qa_entry_register_block() {
    register_block_type( __DIR__ . '/build/qa-entry-display', [
        'render_callback' => 'render_qa_entry_block',
    ] );
}
add_action( 'init', 'qa_entry_register_block' );

// -------------- Coloring Book Block (CPT-backed) ------------------------ //

// custom/coloring-book stores only which Coloring Book post to show and
// renders live from that post — same pattern as custom/episode and
// custom/resource. See src/coloring-book-display/coloring-book-display.php,
// and the Coloring Book post type in the Custom Post Types for BBS
// plugin's includes/coloring-book-cpt.php. Most pages should use
// custom/coloring-books-list (registered further down) instead of placing
// these one at a time.
require_once __DIR__ . '/src/coloring-book-display/coloring-book-display.php';

function coloring_book_register_block() {
    register_block_type( __DIR__ . '/build/coloring-book-display', [
        'render_callback' => 'render_coloring_book_block',
    ] );
}
add_action( 'init', 'coloring_book_register_block' );

// -------------- Coloring Books List Block ------------------------ //

// custom/coloring-books-list auto-lists every published Coloring Book —
// see src/coloring-books-list/coloring-books-list.php. Requires
// coloring-book-display.php (just above) to already be loaded, since its
// render callback calls render_coloring_book_block() for each item.
require_once __DIR__ . '/src/coloring-books-list/coloring-books-list.php';

function coloring_books_list_register_block() {
    register_block_type( __DIR__ . '/build/coloring-books-list', [
        'render_callback' => 'render_coloring_books_list_block',
    ] );
}
add_action( 'init', 'coloring_books_list_register_block' );

// -------------- Learning Hub Search Block ------------------------ //

// custom/learning-search is placed once per Stage archive page (e.g.
// /learning/stages/preschool/) — see [[be-bitesmart-content-hub-plan]] in
// memory. Handles ONLY the search box + live Fuse.js results as of the
// 2026-08-16 split — the paginated "browse all" list moved to the sibling
// custom/learning-browse block just below (place both, same Stage, on a
// real Stage page). It reuses render_qa_entry_block() / render_resource_block()
// / render_coloring_book_search_card() (registered just above) to build the
// data its front-end Fuse.js search reads, so require order matters here:
// this file must load after qa-entry-display.php, resource-display.php,
// and coloring-book-display.php, which it does.
require_once __DIR__ . '/src/learning-search/learning-search.php';

// Logs zero-result searches from that same block — its own file since it
// has a different lifecycle (rest_api_init, not a block render_callback)
// and no ordering dependency on learning-search.php itself, just grouped
// here for locality. See its own header comment for the full picture.
require_once __DIR__ . '/src/learning-search/zero-result-log.php';

function learning_search_register_block() {
    register_block_type( __DIR__ . '/build/learning-search', array(
        'render_callback' => 'render_learning_search_block',
    ) );
}
add_action( 'init', 'learning_search_register_block' );

// -------------- Learning Hub Browse Block ------------------------ //

// custom/learning-browse holds the type-filter checkboxes + paginated
// "All X" browse list split OUT of custom/learning-search on 2026-08-16 —
// see src/learning-browse/learning-browse.php's header comment for the
// full "why" (short version: a persistent, independently-styled block
// instead of a section that disappeared while the sibling search block's
// live search was active). Reuses learning-search.php's shared helpers
// (bitesmart_build_stage_card_list(), bitesmart_render_learning_search_type_filter(),
// bitesmart_render_learning_search_data(), bitesmart_render_learning_search_strings(),
// bitesmart_learning_search_headings()) — those are only ever CALLED at
// render time (this block's own init-registered callback), not at
// file-require time, so exact require order relative to learning-search.php
// doesn't functionally matter, but it's required right after it here for
// readability (same "runtime vs. require-time" fact already true of
// guide-chapter-display.php's bitesmart_render_guide_format_controls(),
// required much later in this file yet still safely callable from
// learning-search.php above).
require_once __DIR__ . '/src/learning-browse/learning-browse.php';

function learning_browse_register_block() {
    register_block_type( __DIR__ . '/build/learning-browse', array(
        'render_callback' => 'render_learning_browse_block',
    ) );
}
add_action( 'init', 'learning_browse_register_block' );

// -----------------------------
// static save blocks:
// ----------------------------

function bitesmart_ra_register_block() {
    register_block_type( __DIR__ . '/build/research-article' );
}
add_action( 'init', 'bitesmart_ra_register_block' );

function episode_card_register_block() {
    register_block_type( __DIR__ . '/build/episode-card' );
}
add_action( 'init', 'episode_card_register_block' );

function article_or_commentary_register_block() {
    register_block_type( __DIR__ . '/build/article-or-commentary' );
}
add_action( 'init', 'article_or_commentary_register_block' );



function pdf_toggle_register_block() {
    register_block_type( __DIR__ . '/build/pdf-toggle' );
}
add_action( 'init', 'pdf_toggle_register_block' );

function unfunded_episode_register_block() {
    register_block_type( __DIR__ . '/build/unfunded-episode' );
}
add_action( 'init', 'unfunded_episode_register_block' );

function education_content_download_register_block() {
    register_block_type( __DIR__ . '/build/educational-content-download' );
}
add_action( 'init', 'education_content_download_register_block' );

function educational_video_download_register_block() {
    register_block_type( __DIR__ . '/build/educational-video-download' );
}
add_action( 'init', 'educational_video_download_register_block' );

function educational_coloring_book_download_register_block() {
    register_block_type( __DIR__ . '/build/educational-coloring-book-download' );
}
add_action( 'init', 'educational_coloring_book_download_register_block' );

function sponsorship_contact_register_block() {
    register_block_type( __DIR__ . '/build/sponsorship-contact' );
}
add_action( 'init', 'sponsorship_contact_register_block' );

function news_and_coverage_register_block() {
    register_block_type( __DIR__ . '/build/news-and-coverage' );
}
add_action( 'init', 'news_and_coverage_register_block' );

function press_release_register_block() {
    register_block_type( __DIR__ . '/build/press-release' );
}
add_action( 'init', 'press_release_register_block' );



// -----------------------------
// Enqueue shared front-end JS
// These two files are shared across multiple blocks so they can't be
// owned by a single block's viewScript — they stay as manual enqueues.

// -----------------------------

function custom_blocks_scripts() {

    $on_learn  = is_page( 'learn' );
        $on_parents  = is_page( 'parents' );
    $on_news       = is_page( 'news-media' );
    $on_legal       = is_page( 'legal' );
    $on_partnerships     = is_page( 'partnerships' );
    $on_front      = is_front_page();


       if ( $on_learn || $on_front || $on_parents ) {
        $asset = include plugin_dir_path( __FILE__ ) . 'build/video-toggle.asset.php';
        wp_enqueue_style(
            'video-toggle',
            plugins_url( 'build/video-toggle.css', __FILE__ ),
            array(),
            $asset['version']
        );
        wp_enqueue_script( 'video-toggle', plugins_url( 'build/video-toggle.js', __FILE__ ), array(), $asset['version'], true );
    }
 
 

        $asset = include plugin_dir_path( __FILE__ ) . 'build/read-more.asset.php';
        wp_enqueue_script( 'read-more', plugins_url( 'build/read-more.js', __FILE__ ), array(), $asset['version'], true );

        // the front page's read more logic is handled by logic in functions.php
        // bio read more has its own logic in its bio-toggle.js within the block
        // they're different enough to keep seperate
    

  // toggle-system.js and pdf-toggle stylesheet are enqueued globally because:
// 1. pdf-toggle appears as an InnerBlock inside article-or-commentary, so
//    WordPress's has_block() would miss it in the nested case.
// 2. The toggle system is now used on enough pages that per-page conditions
//    add complexity without meaningful performance benefit.


    $asset = include plugin_dir_path( __FILE__ ) . 'build/toggle-system.asset.php';
    wp_enqueue_script( 'toggle-system', plugins_url( 'build/toggle-system.js', __FILE__ ), array(), $asset['version'], true );

    $asset = include plugin_dir_path( __FILE__ ) . 'build/pdf-toggle/index.asset.php';
    wp_enqueue_style( 'pdf-toggle-style', plugins_url( 'build/pdf-toggle/style-index.css', __FILE__ ), array(), $asset['version'] );

    // Shared by educational-*-download blocks (and now coloring-book-display/
    // coloring-books-list — see below). Webpack only emits one style chunk per
    // shared import path, so video/coloring block.json style files are not generated.
    // Shared download-card CSS (webpack emits one chunk from the first block entry).
    //
    // NOTE: this file_exists() guard used to check a typo'd path
    // ("build/learnal-content-download/...") that never existed, so this
    // enqueue silently never ran — harmless before now, since each of the
    // three educational-*-download blocks gets this same CSS anyway via its
    // own block.json's automatic per-block enqueue whenever that block is
    // literally present on a page. It matters now because
    // render_coloring_book_search_card() (coloring-book-display.php) is
    // injected into custom/learning-search's output via PHP, the same way
    // render_qa_entry_block()/render_resource_block() are — WordPress's
    // automatic has_block() detection can't see it, so it needs an explicit
    // enqueue. Fixed to point at the real path instead of adding yet
    // another special case.
    $download_card_css = plugin_dir_path( __FILE__ ) . 'build/educational-content-download/style-index.css';
    if ( file_exists( $download_card_css ) ) {
        $download_card_asset = include plugin_dir_path( __FILE__ ) . 'build/educational-content-download/index.asset.php';
        wp_enqueue_style(
            'download-card-style',
            plugins_url( 'build/educational-content-download/style-index.css', __FILE__ ),
            array(),
            $download_card_asset['version']
        );
    }
}


add_action( 'wp_enqueue_scripts', 'custom_blocks_scripts' );

// -----------------------------
// Episode admin fields (locked into the Episode CPT's canvas — see the
// 'template'/'template_lock' args in the Custom Post Types for BBS
// plugin's includes/episode-cpt.php)
// -----------------------------

function episode_fields_register_block() {
    register_block_type( __DIR__ . '/build/episode-fields' );
}
add_action( 'init', 'episode_fields_register_block' );

// custom/episode-fields isn't a display block (save() is null, and Episode
// posts are never publicly queryable), so it needs no render_callback —
// but its editor script still needs the same TranslatePress-derived
// language list episode-card/video-quote get via
// bitesmart_localize_video_language_editors() (site-lang.php). That
// function keys off generate_block_asset_handle(), so it already covers
// this block too as long as it's in its $block_names list — see site-lang.php.

// -----------------------------
// Resource admin fields (locked into the Resource CPT's canvas — see the
// 'template'/'template_lock' args in the Custom Post Types for BBS
// plugin's includes/resource-cpt.php)
// -----------------------------

function resource_fields_register_block() {
    register_block_type( __DIR__ . '/build/resource-fields' );
}
add_action( 'init', 'resource_fields_register_block' );

// custom/resource-fields isn't a display block (save() is null, and
// Resource posts are never publicly queryable), so it needs no
// render_callback — but its editor script still needs the same
// TranslatePress-derived language list, for its per-language Keywords
// fields. Added to bitesmart_localize_video_language_editors()'s
// $block_names list — see site-lang.php.

// -----------------------------
// Q&A Entry admin fields (locked into the Q&A Entry CPT's canvas — see the
// 'template'/'template_lock' args in the Custom Post Types for BBS
// plugin's includes/qa-entry-cpt.php)
// -----------------------------

function qa_entry_fields_register_block() {
    register_block_type( __DIR__ . '/build/qa-entry-fields' );
}
add_action( 'init', 'qa_entry_fields_register_block' );

// custom/qa-entry-fields isn't a display block (save() is null, and Q&A
// Entry posts are never publicly queryable), so it needs no
// render_callback — but its editor script still needs the same
// TranslatePress-derived language list, for its per-language Synonyms
// fields. Added to bitesmart_localize_video_language_editors()'s
// $block_names list — see site-lang.php.

// -----------------------------
// Coloring Book admin fields (locked into the Coloring Book CPT's canvas —
// see the 'template'/'template_lock' args in the Custom Post Types for BBS
// plugin's includes/coloring-book-cpt.php)
// -----------------------------

function coloring_book_fields_register_block() {
    register_block_type( __DIR__ . '/build/coloring-book-fields' );
}
add_action( 'init', 'coloring_book_fields_register_block' );

// custom/coloring-book-fields isn't a display block (save() is null, and
// Coloring Book posts are never publicly queryable), so it needs no
// render_callback — but its editor script still needs the same
// TranslatePress-derived language list, for its per-language Keywords
// fields. Added to bitesmart_localize_video_language_editors()'s
// $block_names list — see site-lang.php.

// -----------------------------
// Guide admin fields (locked into the Guide CPT's canvas — see the
// 'template'/'template_lock' args in the Custom Post Types for BBS
// plugin's includes/guide-cpt.php)
// -----------------------------

function guide_fields_register_block() {
    register_block_type( __DIR__ . '/build/guide-fields' );
}
add_action( 'init', 'guide_fields_register_block' );

// custom/guide-fields isn't a display block (save() is null) — UNLIKE the
// other *-fields blocks above, Guide posts ARE publicly queryable now (see
// [[be-bitesmart-guide-cpt-plan]] in memory), but the front end renders a
// real single-guide template reading this post's chapters directly, not
// this block's saved output, so no render_callback is needed here either.
// No per-language fields on this one (Description only — Video/Keywords
// live on each chapter's own custom/guide-chapter-panel instead), so unlike
// resource-fields/episode-fields/qa-entry-fields/coloring-book-fields it
// does NOT need adding to bitesmart_localize_video_language_editors()'s
// $block_names list in site-lang.php.

// -----------------------------
// Guide Chapter sidebar panel (NOT a locked template block — guide_chapter's
// canvas stays open for its real rich-text body. See
// src/guide-chapter-panel/guide-chapter-panel.php for the full explanation
// of why this needs its own manual enqueue/localize instead of the usual
// register_block_type()-from-block.json + bitesmart_localize_video_language_editors()
// combo every other fields UI in this plugin gets.)
// -----------------------------
require_once __DIR__ . '/src/guide-chapter-panel/guide-chapter-panel.php';

// -----------------------------
// Guide Chapter shared front-end rendering (bitesmart_render_guide_chapter_row(),
// bitesmart_render_guide_format_controls()) + its format-toggle.js/style.css
// enqueue. See src/guide-chapter-display/guide-chapter-display.php's header
// comment — used by a Guide's own page, a chapter's own page, and the
// pooled multi-Guide search page (none of which are built yet). Not a
// registered block (no block.json) — nothing here is ever inserted via the
// block editor.
// -----------------------------
require_once __DIR__ . '/src/guide-chapter-display/guide-chapter-display.php';

// -----------------------------
// Guide + Guide Chapter single-post front end (the_content filter, no new
// theme template files — see src/guide-single/guide-single.php's header
// comment for why). Requires guide-chapter-display.php above to already be
// loaded, since it calls bitesmart_render_guide_chapter_row()/
// bitesmart_render_guide_format_controls().
// -----------------------------
require_once __DIR__ . '/src/guide-single/guide-single.php';

function guide_single_register_block() {
    register_block_type( __DIR__ . '/build/guide-single', array(
        'render_callback' => 'render_guide_single_block',
    ) );
}
add_action( 'init', 'guide_single_register_block' );

// -----------------------------
// Disable Application Passwords
// -----------------------------
add_action( 'init', function() {
    add_filter( 'wp_is_application_passwords_available', '__return_false' );
});

add_filter( 'wp_kses_allowed_html', function( $tags, $context ) {
    if ( $context === 'post' ) {
        $tags['picture'] = [
            'class'       => true,
            'aria-hidden' => true,
        ];
        $tags['source'] = [
            'media'  => true,
            'srcset' => true,
            'type'   => true,
        ];
        $tags['iframe'] = [
            'src'             => true,
            'data-src'        => true,
            'width'           => true,
            'height'          => true,
            'style'           => true,
            'title'           => true,
            'frameborder'     => true,
            'allowfullscreen' => true,
        ];
    }
    return $tags;
}, 10, 2 );