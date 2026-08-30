<?php
/**
 * Media Type taxonomy — Video / Short Answer / Article / Image.
 *
 * Drives the Learning Hub's "Filter by type" checkboxes (custom/learning-search
 * and custom/learning-browse, Custom Blocks plugin — see
 * bitesmart_render_learning_search_type_filter() in that plugin's
 * learning-search.php) as of 2026-08-28, replacing the OLD filter that
 * checked a card's post type (Q&A/Resource/Episode/etc.) directly. A post's
 * Media Type is independent of its post type and not 1:1 with it — a single
 * post can carry more than one term (e.g. a Q&A Entry that embeds a video AND
 * has a text answer), which is exactly why this is a real taxonomy rather
 * than reusing post_type as the filter key.
 *
 * Same "one place the term list is defined" pattern as
 * bitesmart_seed_stage_terms() in stage-taxonomy.php — adding a media type in
 * the future means editing the array in bitesmart_seed_media_type_terms()
 * below, nothing else.
 *
 * This file deliberately does NOT attach Media Type to any post type — same
 * shared-taxonomy pattern as Stage/Topic/Series. Each content type's own
 * registration file attaches itself via register_taxonomy_for_object_type()
 * right after it registers its own post type (see episode-cpt.php for the
 * pattern to copy) AND sets a per-post-type default term on save (see e.g.
 * bitesmart_default_episode_media_type_term() in episode-cpt.php). To find
 * every content type currently using Media Type, search for
 * register_taxonomy_for_object_type( 'media_type'.
 *
 * That save_post default alone is NOT enough to keep an already-published
 * post from dropping out of every media-type filter the moment this
 * taxonomy ships, though — it only ever fires when a post is actually saved
 * again, never retroactively for content published BEFORE this taxonomy
 * existed. bitesmart_backfill_media_type_terms() below is what actually
 * covers that: a one-time pass over every already-existing post of each
 * attached type. Real bug Janet hit at first deploy (2026-08-28): the
 * "Filter by type" checkboxes never rendered at all on a live Stage page,
 * because bitesmart_render_learning_search_type_filter()'s "2+ distinct
 * types present" check never passed — every existing card had zero Media
 * Type terms, since none of them had been re-saved since this taxonomy
 * shipped.
 *
 * Load-order note: this file must be required BEFORE any content type's
 * registration file that calls register_taxonomy_for_object_type('media_type',
 * ...) — that call is a no-op if the 'media_type' taxonomy doesn't exist yet.
 * Both this file's and each CPT's registration hook onto 'init' at the
 * default priority, so require-order (see the main plugin file) is what
 * decides execution order.
 */

function bitesmart_register_media_type_taxonomy() {
    register_taxonomy( 'media_type', array(), array(
        'labels'            => array(
            'name'          => __( 'Media Types', 'custom-post-types-for-bbs' ),
            'singular_name' => __( 'Media Type', 'custom-post-types-for-bbs' ),
        ),
        // Hierarchical (checkbox UI) rather than free-tag, same reasoning as
        // Stage: a fixed, curated set of terms, not something editors should
        // be able to invent new values for on the fly. Terms are flat (no
        // actual parent/child) — this is purely to get Gutenberg's checkbox
        // taxonomy panel instead of the free-tag comma-input one.
        'hierarchical'      => true,
        'public'            => true,
        'show_in_rest'      => true,
        'rest_base'         => 'media_type',
        'show_admin_column' => true,
    ) );

    bitesmart_seed_media_type_terms();
}
add_action( 'init', 'bitesmart_register_media_type_taxonomy' );

/**
 * Idempotently create the Media Type terms. Guarded by an option flag so
 * this doesn't re-run its term_exists() checks on every single request —
 * only until the terms are confirmed seeded once. Same pattern as
 * bitesmart_seed_stage_terms() in stage-taxonomy.php.
 *
 * Called both here (on 'init', for this plugin's existing production
 * install, which will never fire a fresh activation hook) and from
 * register_activation_hook() in the main plugin file (for any future fresh
 * install).
 */
function bitesmart_seed_media_type_terms() {
    if ( get_option( 'bitesmart_media_type_terms_seeded' ) ) {
        return;
    }

    foreach ( array( 'Video', 'Short Answer', 'Article', 'Image' ) as $name ) {
        if ( ! term_exists( $name, 'media_type' ) ) {
            wp_insert_term( $name, 'media_type' );
        }
    }

    update_option( 'bitesmart_media_type_terms_seeded', true );
}

/**
 * One-time backfill: assign each CPT's default Media Type term to every
 * ALREADY-EXISTING post of that type that has none yet (see the file-level
 * comment above for why the save_post_* default hooks alone can't cover
 * this). Guarded by an option flag, same idempotent-seed pattern as
 * bitesmart_seed_media_type_terms() — runs its get_posts() queries only
 * until confirmed done once, not on every request.
 *
 * Deliberately calls each CPT's OWN default function directly
 * (bitesmart_default_episode_media_type_term() etc., each already guarded
 * by its own has_term() check) rather than keeping a second, separately
 * maintained post_type => default-slug map here — one place per CPT still
 * defines its own default, this just also applies it retroactively. Every
 * status, not just 'publish' — backfilling a draft's default term is
 * harmless and means it's already set by the time an editor publishes it.
 *
 * Hooked at priority 20 (not the default 10) so it runs strictly after
 * every CPT's own post-type/taxonomy registration (all at priority 10) —
 * has_term()/wp_set_object_terms() need 'media_type' already registered,
 * and get_posts()'s post_type argument needs each CPT already registered
 * too.
 */
function bitesmart_backfill_media_type_terms() {
    if ( get_option( 'bitesmart_media_type_backfilled' ) ) {
        return;
    }

    $defaulters = array(
        'episode'       => 'bitesmart_default_episode_media_type_term',
        'resource'      => 'bitesmart_default_resource_media_type_term',
        'qa_entry'      => 'bitesmart_default_qa_entry_media_type_term',
        'coloring_book' => 'bitesmart_default_coloring_book_media_type_term',
        'guide_chapter' => 'bitesmart_default_guide_chapter_media_type_term',
    );

    foreach ( $defaulters as $post_type => $callback ) {
        if ( ! function_exists( $callback ) ) {
            continue; // defensive — shouldn't happen, every CPT file above defines its own unconditionally
        }

        $post_ids = get_posts( array(
            'post_type'      => $post_type,
            'post_status'    => 'any',
            'posts_per_page' => -1,
            'fields'         => 'ids',
            'no_found_rows'  => true,
        ) );

        foreach ( $post_ids as $post_id ) {
            // Same ( $post_id, $post, $update ) signature every save_post_*
            // callback gets — $update hardcoded true here since these are,
            // by definition, all pre-existing posts, not brand-new ones.
            call_user_func( $callback, $post_id, get_post( $post_id ), true );
        }
    }

    update_option( 'bitesmart_media_type_backfilled', true );
}
add_action( 'init', 'bitesmart_backfill_media_type_terms', 20 );
