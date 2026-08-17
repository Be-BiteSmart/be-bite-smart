<?php
/**
 * Stage taxonomy — Pregnancy / Baby / Toddler / Preschool.
 *
 * This is the ONE place the Stage term list is defined. Adding a stage in
 * the future means editing the array in bitesmart_seed_stage_terms() below
 * — nothing else.
 *
 * This file deliberately does NOT attach Stage to any post type. It's a
 * shared taxonomy meant to be reused by every content type that needs it
 * (currently just Episode; Q&A entries and Resources will likely want it
 * too later, and would naturally live in this same plugin alongside
 * episode-cpt.php) — each content type's own registration file is
 * responsible for attaching itself via register_taxonomy_for_object_type(),
 * right after it registers its own post type. See episode-cpt.php for the
 * pattern to copy. (To find every content type currently using Stage,
 * search for register_taxonomy_for_object_type( 'stage' — everything using
 * it should live in this plugin, since this plugin owns the content model
 * for the whole site.)
 *
 * Load-order note: this file must be required BEFORE any content type's
 * registration file that calls register_taxonomy_for_object_type('stage',
 * ...) — that call is a no-op if the 'stage' taxonomy doesn't exist yet.
 * Both this file's and each CPT's registration hook onto 'init' at the
 * default priority, so require-order (see the main plugin file) is what
 * decides execution order.
 */

function bitesmart_register_stage_taxonomy() {
    register_taxonomy( 'stage', array(), array(
        'labels'            => array(
            'name'          => __( 'Stages', 'custom-post-types-for-bbs' ),
            'singular_name' => __( 'Stage', 'custom-post-types-for-bbs' ),
        ),
        // Hierarchical (checkbox UI) rather than free-tag: Stage is a fixed,
        // curated set of terms, not something editors should be able to
        // invent new values for on the fly.
        'hierarchical'      => true,
        'public'            => true,
        'show_in_rest'      => true,
        'rest_base'         => 'stage',
        'show_admin_column' => true,
    ) );

    bitesmart_seed_stage_terms();
}
add_action( 'init', 'bitesmart_register_stage_taxonomy' );

/**
 * Idempotently create the Stage terms. Guarded by an option flag so this
 * doesn't re-run its term_exists() checks on every single request — only
 * until the terms are confirmed seeded once.
 *
 * Called both here (on 'init', for the plugin's existing production
 * install, which will never fire a fresh activation hook) and from
 * register_activation_hook() in the main plugin file (for any future fresh
 * install).
 */
function bitesmart_seed_stage_terms() {
    if ( get_option( 'bitesmart_stage_terms_seeded' ) ) {
        bitesmart_seed_guide_stage_term(); // added later than the other four; see its own comment
        return;
    }

    foreach ( array( 'Pregnancy', 'Baby', 'Toddler', 'Preschool' ) as $name ) {
        if ( ! term_exists( $name, 'stage' ) ) {
            wp_insert_term( $name, 'stage' );
        }
    }

    bitesmart_seed_guide_stage_term();

    update_option( 'bitesmart_stage_terms_seeded', true );
}

/**
 * "Guide" is a Stage term like the other four, but it isn't a real
 * parenting stage and no post is ever actually tagged with it — it exists
 * purely so it's selectable in `custom/learning-search`'s own Stage
 * dropdown (index.js, which lists every term in this taxonomy). Picking it
 * there sets that block instance's `stageSlug` attribute to `'guide'`,
 * which `bitesmart_build_stage_card_list()` (learning-search.php)
 * recognizes as a dedicated query branch — every published Guide Chapter,
 * unconditionally, no tax_query involved at all. An earlier version tried
 * having every chapter actually carry this term (auto-re-applied whenever
 * its Stage terms changed), so the NORMAL tax_query path could return them
 * "for free" — dropped after Janet found a real gap: that mechanism only
 * ever fires in reaction to a chapter's Stage terms actually being
 * touched, so a brand-new chapter whose Stage panel was never opened never
 * got the term applied at all (not un-set after the fact — never set in
 * the first place). Querying `post_type => 'guide_chapter'` directly can't
 * have that failure mode. See [[be-bitesmart-guide-cpt-plan]] in memory
 * for the full history.
 *
 * Seeded separately from the other four (rather than just adding it to
 * their array above) because it was added well after this install was
 * already seeded — the `bitesmart_stage_terms_seeded` option flag would
 * otherwise skip it forever on the already-live site.
 */
function bitesmart_seed_guide_stage_term() {
    if ( ! term_exists( 'Guide', 'stage' ) ) {
        wp_insert_term( 'Guide', 'stage' );
    }
}
