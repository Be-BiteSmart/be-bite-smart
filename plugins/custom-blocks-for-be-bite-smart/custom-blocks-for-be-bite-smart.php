<?php
/**
 * Plugin Name: Custom Blocks for Be BiteSmart
 * Description: Adds custom blocks including Research Article and Bio Card
 * Version: 1.0
 * Author: Janet Spellman-Marsh
 * Requires Plugins: TranslatePress
 */
// -----------------------------
// Register Research Article block
// -----------------------------
function bitesmart_ra_register_block() {
    register_block_type( __DIR__ . '/blocks/research-article' );
}
add_action( 'init', 'bitesmart_ra_register_block' );
// -----------------------------
// Register Bio Card block
// -----------------------------
function bio_card_register_block() {
    register_block_type( __DIR__ . '/blocks/bio-card' );
}
add_action( 'init', 'bio_card_register_block' );
// -----------------------------
// Register Episode Card block
// -----------------------------
function episode_card_register_block() {
    register_block_type( __DIR__ . '/blocks/episode-card' );
}
add_action( 'init', 'episode_card_register_block' );
// -----------------------------
// Register Article block
// -----------------------------
function article_or_commentary_register_block() {
    register_block_type( __DIR__ . '/blocks/article-or-commentary' );
}
add_action( 'init', 'article_or_commentary_register_block' );
// -----------------------------
// Register Documentary Video Block
// -----------------------------
function documentary_video_register_block() {
    register_block_type( __DIR__ . '/blocks/video-quote' );
}
add_action( 'init', 'documentary_video_register_block' );
// -----------------------------
// Register PDF Toggle block
// -----------------------------
function pdf_toggle_register_block() {
    register_block_type( __DIR__ . '/blocks/pdf-toggle' );
}
add_action( 'init', 'pdf_toggle_register_block' );

// -----------------------------
// Register Unfunded Episode block
// -----------------------------

function unfunded_episode_register_block() {
    register_block_type( __DIR__ . '/blocks/unfunded-episode' );
}
add_action( 'init', 'unfunded_episode_register_block' );

// -----------------------------
// Register Education Content Download Block
// -----------------------------

function education_content_download_register_block() {
    register_block_type( __DIR__ . '/blocks/educational-content-download' );
}
add_action( 'init', 'education_content_download_register_block' );

// -----------------------------
// Register Sponsorship Contact Block
// -----------------------------

function sponsorship_contact_register_block() {
    register_block_type( __DIR__ . '/blocks/sponsorship-contact' );
}
add_action( 'init', 'sponsorship_contact_register_block' );

// -----------------------------
// Register news-and-coverage Block
// -----------------------------

function news_and_coverage_register_block() {
    register_block_type( __DIR__ . '/blocks/news-and-coverage' );
}
add_action( 'init', 'news_and_coverage_register_block' );


// -----------------------------
// Register Press Release Block
// -----------------------------

function press_release_register_block() {
    register_block_type( __DIR__ . '/blocks/press-release' );
}
add_action( 'init', 'press_release_register_block' );

// -----------------------------
// Register Hero Block
// -----------------------------

function hero_register_block() {
    register_block_type( __DIR__ . '/blocks/hero' );
}
add_action( 'init', 'hero_register_block' );


// -----------------------------
// Enqueue editor JS
// -----------------------------
add_action( 'enqueue_block_editor_assets', function () {
    // 1. PDF Toggle block — must load before article block, since article block uses it
    wp_enqueue_script(
        'pdf-toggle-block',
        plugins_url( 'blocks/pdf-toggle/index.js', __FILE__ ),
        array( 'wp-blocks', 'wp-block-editor', 'wp-components', 'wp-element', 'wp-i18n' ),
        '1.0',
        true
    );

    // 2. Article block — depends on pdf-toggle block being registered first. dependency chain with the pdf-toggle-block above means wp-components will be loaded, so text-control will work without wp-block, ect being added to the array here 
    wp_enqueue_script(
        'article-or-commentary-block',
        plugins_url( 'blocks/article-or-commentary/index.js', __FILE__ ),
        array( 'pdf-toggle-block' ),
        '1.0',
        true
    );

    // Editor styles
    wp_enqueue_style(
        'research-article-editor',
        plugins_url( 'blocks/research-article/style.css', __FILE__ ),
        array(),
        '1.0.1'
    );

    wp_enqueue_style(
    'hero-block-style',
    plugins_url( 'blocks/hero/style.css', __FILE__ ),
    array(),
    '1.0.1' 
);
    

// Many blocks are manually enqueued (instead of relying on register_block_type auto-enqueue) because all three use components from
// wp-components (TextControl, PanelBody, etc.). Without a build step there is no
// block.asset.php to declare dependencies, so wp-components is not guaranteed to load
// before the block script runs. 
// 
// Other blocks that don't use wp-components, or that
// coincidentally load after it due to dependency chains (article-or-commentary block), are fine with auto-enqueue.
wp_enqueue_script(
    'sponsorship-contact-block',
    plugins_url( 'blocks/sponsorship-contact/block.js', __FILE__ ),
    array( 'wp-blocks', 'wp-block-editor', 'wp-components', 'wp-element', 'wp-i18n' ),
    '1.0',
    true
);

wp_enqueue_script(
    'episode-card-block',
    plugins_url( 'blocks/episode-card/block.js', __FILE__ ),
    array( 'wp-blocks', 'wp-block-editor', 'wp-components', 'wp-element', 'wp-i18n' ),
    '1.0.2',
    true
);
wp_enqueue_script(
    'bio-card-block',
    plugins_url( 'blocks/bio-card/block.js', __FILE__ ),
    array( 'wp-blocks', 'wp-block-editor', 'wp-components', 'wp-element', 'wp-i18n' ),
    '1.0.2',
    true
);


wp_enqueue_script(
    'unfunded-episode',
    plugins_url( 'blocks/unfunded-episode/block.js', __FILE__ ),
    array( 'wp-blocks', 'wp-block-editor', 'wp-components', 'wp-element', 'wp-i18n' ),
    '1.0.1',
    true
);

wp_enqueue_script(
    'video-quote',
    plugins_url( 'blocks/video-quote/block.js', __FILE__ ),
    array( 'wp-blocks', 'wp-block-editor', 'wp-components', 'wp-element', 'wp-i18n' ),
    '1.0',
    true
);

wp_enqueue_script(
    'news-and-coverage',
    plugins_url( 'blocks/news-and-coverage/block.js', __FILE__ ),
    array( 'wp-blocks', 'wp-block-editor', 'wp-components', 'wp-element', 'wp-i18n' ),
    '1.0',
    true
);

wp_enqueue_script(
    'press-release',
    plugins_url( 'blocks/press-release/block.js', __FILE__ ),
    array( 'wp-blocks', 'wp-block-editor', 'wp-components', 'wp-element', 'wp-i18n' ),
    '1.0',
    true
);
} );
// -----------------------------
// Enqueue front-end JS
// -----------------------------
function custom_blocks_scripts() {
    wp_enqueue_script(
        'bio-toggle',
        plugins_url( 'bio-toggle.js', __FILE__ ),
        array(),
        '1.0',
        true
    );
    wp_enqueue_script(
        'video-toggle',
        plugins_url( 'video-toggle.js', __FILE__ ),
        array(),
        '1.0',
        true
    );
    // Shared PDF toggle logic — used by both the pdf-toggle block and article block
    wp_enqueue_script(
        'pdf-toggle',
        plugins_url( 'pdf-toggle.js', __FILE__ ),
        array(),
        '1.0',
        true
    );

    wp_enqueue_script(
    'educational-content-download-frontend',
    plugins_url('blocks/educational-content-download/educational-content-pdf-toggle.js', __FILE__),
    array(), // no dependencies
    '1.0.1',
    true
);

 
 wp_enqueue_script(
        'press-release-expand',
        plugins_url( 'blocks/press-release/press-release-expand.js', __FILE__ ),
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