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

function read_more_register_block() {
    register_block_type( __DIR__ . '/build/read-more' );
}
add_action( 'init', 'read_more_register_block' );

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

// Hero block is a dynamic block — save() returns null in JS and PHP renders
// the HTML via render_callback. This bypasses WordPress's content sanitizer
// which was mangling <picture> and <source> tags on save.
function render_hero_block( $attributes ) {
    $sm  = esc_url( $attributes['bgImageSmUrl'] ?? '' );
    $md  = esc_url( $attributes['bgImageMdUrl'] ?? '' );
    $lg  = esc_url( $attributes['bgImageLgUrl'] ?? '' );
    $src = $lg ?: $md ?: $sm;

    $picture = '';
    if ( $src ) {
        $sources = '';
        if ( $sm ) $sources .= '<source media="(max-width: 640px)" srcset="' . $sm . '">';
        if ( $md ) $sources .= '<source media="(max-width: 1280px)" srcset="' . $md . '">';
        $picture = '<picture class="dbp-bg-picture" aria-hidden="true">'
            . $sources
            . '<img src="' . $src . '" alt="" loading="eager" fetchpriority="high">'
            . '</picture>';
    }

    $label     = wp_kses_post( $attributes['label']     ?? '' );
    $heading   = wp_kses_post( $attributes['heading']   ?? '' );
    $highlight = wp_kses_post( $attributes['highlight'] ?? '' );
    $body      = wp_kses_post( $attributes['body']      ?? '' );
    $stat1num  = esc_html( $attributes['stat1Num']   ?? '' );
    $stat1lab  = esc_html( $attributes['stat1Label'] ?? '' );
    $stat2num  = esc_html( $attributes['stat2Num']   ?? '' );
    $stat2lab  = esc_html( $attributes['stat2Label'] ?? '' );
    $btn1text  = esc_html( $attributes['btn1Text']   ?? '' );
    $btn1url   = esc_url(  $attributes['btn1Url']    ?? '#' );
    $btn2text  = esc_html( $attributes['btn2Text']   ?? '' );
    $btn2url   = esc_url(  $attributes['btn2Url']    ?? '#' );

    ob_start(); ?>
    <section class="wp-block-custom-hero alignfull dbp-section">
      <div class="dbp-inner">
        <div class="dbp-bg-wrapper">
          <?php echo $picture; ?>
          <div class="dbp-overlay"></div>
        </div>
        <div class="dbp-content">
          <div class="dbp-text">
            <div class="dbp-label">
              <span class="dbp-label__dash"></span>
              <span class="dbp-label__text"><?php echo $label; ?></span>
            </div>
            <div class="dbp-card">
              <h2 class="dbp-heading">
                <span><?php echo $heading; ?></span>
                <em class="dbp-heading__highlight"><?php echo $highlight; ?></em>
              </h2>
              <div class="dbp-card__divider"></div>
              <p class="dbp-body"><?php echo $body; ?></p>
            </div>
            <div class="dbp-stats">
              <div class="dbp-stat dbp-stat--blue">
                <span class="dbp-stat__num"><?php echo $stat1num; ?></span>
                <span class="dbp-stat__label"><?php echo $stat1lab; ?></span>
              </div>
              <div class="dbp-stat dbp-stat--orange">
                <span class="dbp-stat__num"><?php echo $stat2num; ?></span>
                <span class="dbp-stat__label"><?php echo $stat2lab; ?></span>
              </div>
            </div>
            <div class="dbp-buttons">
              <a href="<?php echo $btn1url; ?>" class="block-toggle-btn"><?php echo $btn1text; ?></a>
              <a href="<?php echo $btn2url; ?>" class="block-toggle-btn is-style-outline"><?php echo $btn2text; ?></a>
            </div>
          </div>
        </div>
      </div>
    </section>
    <?php
    return ob_get_clean();
}

function hero_register_block() {
    register_block_type( __DIR__ . '/build/hero', [
        'render_callback' => 'render_hero_block',
    ] );
}
add_action( 'init', 'hero_register_block' );

// -----------------------------
// Enqueue shared front-end JS
// These two files are shared across multiple blocks so they can't be
// owned by a single block's viewScript — they stay as manual enqueues.


// -----------------------------

function custom_blocks_scripts() {
    $video_toggle_asset = include plugin_dir_path( __FILE__ ) . 'build/video-toggle.asset.php';
    wp_enqueue_script(
        'video-toggle',
        plugins_url( 'build/video-toggle.js', __FILE__ ),
        array(),
        $video_toggle_asset['version'],
        true
    );

    $read_more_asset = include plugin_dir_path( __FILE__ ) . 'build/read-more.asset.php';
    wp_enqueue_script(
        'read-more',
        plugins_url( 'build/read-more.js', __FILE__ ),
        array(),
        $read_more_asset['version'],
        true
    );

    $toggle_system_asset = include plugin_dir_path( __FILE__ ) . 'build/toggle-system.asset.php';
    wp_enqueue_script(
        'toggle-system',
        plugins_url( 'build/toggle-system.js', __FILE__ ),
        array(),
        $toggle_system_asset['version'],
        true
    );

    // pdf-toggle stylesheet — enqueued globally because the block is used
    // as an InnerBlock inside article-or-commentary, so WordPress won't
    // detect it on the page and load it automatically.
    $pdf_toggle_asset = include plugin_dir_path( __FILE__ ) . 'build/pdf-toggle/index.asset.php';
    wp_enqueue_style(
        'pdf-toggle-style',
        plugins_url( 'build/pdf-toggle/style-index.css', __FILE__ ),
        array(),
        $pdf_toggle_asset['version']
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