<?php
/**
 * Plugin Name: Custom Blocks for Be BiteSmart
 * Description: Adds custom blocks including Research Article and Bio Card
 * Version: 1.0
 * Author: Janet Spellman-Marsh
 * Requires Plugins: TranslatePress
 */

// Shared helpers (TranslatePress site language, etc.)
require_once __DIR__ . '/src/includes/site-lang.php';
require_once __DIR__ . '/src/includes/lang-restart-dialog.php';

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
            $asset['version'] . '.1'
        );
        wp_enqueue_script( 'video-toggle', plugins_url( 'build/video-toggle.js', __FILE__ ), array(), $asset['version'] . '.1', true );
        wp_localize_script(
            'video-toggle',
            'bitesmartLangRestartDialog',
            bitesmart_get_lang_restart_dialog()
        );
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

    // Shared by learnal-*-download blocks. Webpack only emits one style chunk per
    // shared import path, so video/coloring block.json style files are not generated.
    // Shared download-card CSS (webpack emits one chunk from the first block entry).
    $download_card_css = plugin_dir_path( __FILE__ ) . 'build/learnal-content-download/style-index.css';
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