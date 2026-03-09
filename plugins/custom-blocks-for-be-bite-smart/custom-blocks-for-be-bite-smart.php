<?php
/**
 * Plugin Name: Custom Blocks for Be BiteSmart
 * Description: Adds custom blocks including Research Article and Bio Card
 * Version: 1.0
 * Author: Janet Spellman-Marsh
 * Requires Plugins: TranslatePress
 */

// -----------------------------
// Register all blocks
// register_block_type now reads block.json from build/, which handles
// editorScript, style, and viewScript automatically — no manual enqueues needed.
// -----------------------------

function bitesmart_ra_register_block() {
    register_block_type( __DIR__ . '/build/research-article' );
}
add_action( 'init', 'bitesmart_ra_register_block' );

function bio_card_register_block() {
    register_block_type( __DIR__ . '/build/bio-card' );
}
add_action( 'init', 'bio_card_register_block' );

function episode_card_register_block() {
    register_block_type( __DIR__ . '/build/episode-card' );
}
add_action( 'init', 'episode_card_register_block' );

function article_or_commentary_register_block() {
    register_block_type( __DIR__ . '/build/article-or-commentary' );
}
add_action( 'init', 'article_or_commentary_register_block' );

function documentary_video_register_block() {
    register_block_type( __DIR__ . '/build/video-quote' );
}
add_action( 'init', 'documentary_video_register_block' );

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

function hero_register_block() {
    register_block_type( __DIR__ . '/build/hero' );
}
add_action( 'init', 'hero_register_block' );

// -----------------------------
// Enqueue shared front-end JS
// These two files are shared across multiple blocks so they can't be
// owned by a single block's viewScript — they stay as manual enqueues.
// pdf-toggle.js  — used by pdf-toggle block and article-or-commentary block
// video-toggle.js — used by video-quote block and episode-card block
// -----------------------------
function custom_blocks_scripts() {
    wp_enqueue_script(
        'video-toggle',
        plugins_url( 'video-toggle.js', __FILE__ ),
        array(),
        '1.0',
        true
    );

    wp_enqueue_script(
        'pdf-toggle',
        plugins_url( 'pdf-toggle.js', __FILE__ ),
        array(),
        '1.0',
        true
    );
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
        $tags['iframe'] = array(
            'src'             => true,
            'data-src'        => true,
            'width'           => true,
            'height'          => true,
            'style'           => true,
            'title'           => true,
            'frameborder'     => true,
            'allowfullscreen' => true,
        );
    }
    return $tags;
}, 10, 2 );