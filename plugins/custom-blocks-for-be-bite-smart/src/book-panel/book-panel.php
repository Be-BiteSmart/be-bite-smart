<?php
/**
 * Enqueues custom/book-panel's editor script (src/book-panel/index.js).
 *
 * UNLIKE every *-fields block in this plugin, this isn't a block at all —
 * no block.json, no register_block_type() — it's a PluginDocumentSettingPanel
 * (a sidebar panel), because book's editor canvas is deliberately left
 * unlocked (see book-cpt.php in the Custom Post Types for BBS plugin): a
 * book's "why we recommend it" text is real rich content, restricted to
 * Paragraph/List blocks, authored directly in the canvas. Everything else
 * (Price/Availability, Buy/More Info URL, Keywords) lives in this panel
 * instead. Same "manual enqueue instead of block.json" mechanism as
 * custom/guide-chapter-panel — see that file's own comment for the full
 * "why".
 */

function bitesmart_enqueue_book_panel() {
    $screen = get_current_screen();
    if ( ! $screen || 'book' !== $screen->post_type || ! $screen->is_block_editor() ) {
        return;
    }

    // __FILE__ resolves to src/book-panel/book-panel.php, so
    // dirname( dirname( __FILE__ ) ) walks up two levels to the plugin
    // root — same plugins_url()/asset.php idiom as
    // src/guide-chapter-panel/guide-chapter-panel.php (webpack compiles
    // this script into build/, not src/).
    $plugin_root = dirname( dirname( __FILE__ ) );
    $asset_file  = plugin_dir_path( $plugin_root ) . 'build/book-panel/index.asset.php';
    if ( ! file_exists( $asset_file ) ) {
        return;
    }
    $asset = include $asset_file;

    wp_enqueue_script(
        'book-panel',
        plugins_url( 'build/book-panel/index.js', $plugin_root ),
        $asset['dependencies'],
        $asset['version'],
        true
    );

    // Same per-language data shape bitesmart_localize_video_language_editors()
    // (site-lang.php) gives every other fields block's editor script, for
    // the same reason: so this panel's Keywords fields reflect
    // bitesmart_site_languages() (TranslatePress-derived) instead of
    // shared/languages.js's hardcoded DEFAULT_SITE_LANGUAGES fallback.
    $languages = array();
    foreach ( bitesmart_site_languages() as $lang ) {
        $languages[] = array(
            'code'      => $lang['code'],
            'label'     => $lang['label'],
            'name'      => $lang['name'],
            'analytics' => $lang['analytics'],
        );
    }

    wp_localize_script(
        'book-panel',
        'bitesmartLanguages',
        array( 'languages' => $languages )
    );
}
add_action( 'enqueue_block_editor_assets', 'bitesmart_enqueue_book_panel' );
