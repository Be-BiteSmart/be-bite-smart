<?php
/**
 * Enqueues custom/guide-chapter-panel's editor script (src/guide-chapter-panel/index.js).
 *
 * UNLIKE every *-fields block in this plugin, this isn't a block at all —
 * no block.json, no register_block_type() — it's a PluginDocumentSettingPanel
 * (a sidebar panel), because guide_chapter's editor canvas is deliberately
 * left unlocked (see guide-chapter-cpt.php and [[be-bitesmart-guide-cpt-plan]]
 * in memory). That means it can't piggyback on
 * bitesmart_localize_video_language_editors()'s generate_block_asset_handle()
 * lookup either (site-lang.php) — that only resolves handles for
 * REGISTERED BLOCKS. This file's manual wp_enqueue_script() + wp_localize_script()
 * calls are this panel's equivalent of both that function and the
 * `$block_name => register_block_type()` registration every sibling
 * *-fields block gets for free from its block.json.
 */

function bitesmart_enqueue_guide_chapter_panel() {
    $screen = get_current_screen();
    if ( ! $screen || 'guide_chapter' !== $screen->post_type || ! $screen->is_block_editor() ) {
        return;
    }

    // __FILE__ resolves to src/guide-chapter-panel/guide-chapter-panel.php,
    // so dirname( dirname( __FILE__ ) ) walks up two levels to the plugin
    // root — same plugins_url()/asset.php idiom as
    // src/qr-experience/render.php (see that file's comment for the full
    // "why not plugin_dir_url( __FILE__ )" reasoning: webpack compiles this
    // script into build/, not src/).
    $plugin_root = dirname( dirname( __FILE__ ) );
    $asset_file  = plugin_dir_path( $plugin_root ) . 'build/guide-chapter-panel/index.asset.php';
    if ( ! file_exists( $asset_file ) ) {
        return;
    }
    $asset = include $asset_file;

    wp_enqueue_script(
        'guide-chapter-panel',
        plugins_url( 'build/guide-chapter-panel/index.js', $plugin_root ),
        $asset['dependencies'],
        $asset['version'],
        true
    );

    // Same per-language data shape bitesmart_localize_video_language_editors()
    // (site-lang.php) gives every other fields block's editor script, for
    // the same reason: so this panel's Video/Keywords fields reflect
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
        'guide-chapter-panel',
        'bitesmartLanguages',
        array( 'languages' => $languages )
    );
}
add_action( 'enqueue_block_editor_assets', 'bitesmart_enqueue_guide_chapter_panel' );
