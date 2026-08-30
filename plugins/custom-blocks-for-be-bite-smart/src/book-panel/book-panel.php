<?php
/**
 * Enqueues custom/book-panel's editor script (src/book-panel/index.js).
 *
 * UNLIKE the custom/book-fields block (Book's OWN locked-canvas fields
 * block, as of 2026-08-30 — see book-cpt.php in the Custom Post Types for
 * BBS plugin), this isn't a block at all — no block.json, no
 * register_block_type() — it's a PluginDocumentSettingPanel (a sidebar
 * panel). Audience, Price/Availability, Buy/More Info URL, and
 * Inside-the-Book preview images live here; "Why BBS Recommends This Book"
 * and Book Excerpt (the book's actual write-up) live in the locked canvas
 * block instead —
 * see that block's own src/book-fields/index.js header for why both exist
 * side by side rather than everything living in one place the way Q&A
 * Entry's single fields block does.
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

    // No wp_localize_script() here (unlike guide-chapter-panel and friends)
    // — this panel had per-language Search Keywords fields until 2026-08-30
    // (removed along with everything else that only ever existed for the
    // Learning Hub search Book left on 2026-08-28 — see book-cpt.php's file
    // header), which is what the language list was for. Nothing left in
    // this panel needs it.
}
add_action( 'enqueue_block_editor_assets', 'bitesmart_enqueue_book_panel' );
