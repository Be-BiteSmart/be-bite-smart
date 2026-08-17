<?php
/**
 * Series taxonomy — e.g. "Paws To Prevent". Currently just the one series,
 * but built as a real taxonomy (not a plain text field) from day one so a
 * future second series has somewhere to go without a data migration.
 *
 * Curated like Stage (stage-taxonomy.php), NOT free-tag like Topic
 * (topic-taxonomy.php): a series is a deliberate site-level decision (a new
 * one launching is a real event, not something an editor should be able to
 * typo-invent while filling in an Episode). Same reasoning as Stage's own
 * header comment.
 *
 * This file deliberately does NOT attach Series to any post type — Episode
 * opts in via register_taxonomy_for_object_type() in its own
 * episode-cpt.php, same pattern as Stage/Topic.
 *
 * Load-order note: same as Stage/Topic — this file must be required BEFORE
 * episode-cpt.php, which calls register_taxonomy_for_object_type('series',
 * ...) — a no-op if the 'series' taxonomy doesn't exist yet. Both this file
 * and episode-cpt.php hook onto 'init' at the default priority, so
 * require-order (see the main plugin file) is what decides execution order.
 */

function bitesmart_register_series_taxonomy() {
    register_taxonomy( 'series', array(), array(
        'labels'            => array(
            'name'          => __( 'Series', 'custom-post-types-for-bbs' ),
            'singular_name' => __( 'Series', 'custom-post-types-for-bbs' ),
        ),
        // Hierarchical (checkbox UI) rather than free-tag — same reasoning
        // as Stage: a fixed, curated set of terms, not something editors
        // should be able to invent new values for on the fly.
        'hierarchical'      => true,
        'public'            => true,
        'show_in_rest'      => true,
        'rest_base'         => 'series',
        'show_admin_column' => true,
    ) );

    bitesmart_seed_series_terms();
}
add_action( 'init', 'bitesmart_register_series_taxonomy' );

/**
 * Idempotently create the (currently one) Series term. Same guarded-by-an-
 * option-flag approach as bitesmart_seed_stage_terms() in stage-taxonomy.php
 * — only runs its term_exists() check until confirmed seeded once.
 *
 * Called both here (on 'init', for this plugin's existing install, which
 * will never fire a fresh activation hook) and from
 * register_activation_hook() in the main plugin file (for any future fresh
 * install).
 */
function bitesmart_seed_series_terms() {
    if ( get_option( 'bitesmart_series_terms_seeded' ) ) {
        return;
    }

    foreach ( array( 'Paws To Prevent' ) as $name ) {
        if ( ! term_exists( $name, 'series' ) ) {
            wp_insert_term( $name, 'series' );
        }
    }

    update_option( 'bitesmart_series_terms_seeded', true );
}
