<?php
/**
 * Guide Section taxonomy — groups a Guide's chapters for display on the
 * Guide's own "View All Chapters" list only.
 *
 * Added 2026-08-16, per Janet: the source document (the full PDF guide) is
 * itself organized into Sections, each containing a handful of Chapters —
 * e.g. "Section I — Understanding Risk" containing Chapters 1–2, "Section
 * II — How Dog Bites Actually Happen" containing Chapters 3–5, and so on
 * through "Section VII — Conclusion" (Chapter 15). An individual chapter's
 * own page never needs to mention which Section it's in ("we don't need to
 * mention the sections for the individual chapters"), but the Guide's own
 * page needs a heading between each group of chapters when listing all of
 * them ("for the guide pages 'view all chapters' block we would need to
 * incorporate these as headings between the chapters") — see
 * bitesmart_render_guide_single() (guide-single.php) for that grouping
 * logic, and [[be-bitesmart-guide-cpt-plan]] in memory for the full
 * feature.
 *
 * Modeled as a real taxonomy (Janet's own pick over a plain per-chapter
 * text field) — same "hierarchical (checkbox UI), fixed curated set of
 * terms, not free-tagging" pattern as the existing Stage taxonomy
 * (stage-taxonomy.php): a Section can be renamed once, in the term itself,
 * and every chapter tagged with it updates automatically — no risk of two
 * chapters silently drifting apart from a retyped section name with a
 * typo. Term NAME is the full ready-to-display heading text (e.g. "Section
 * I — Understanding Risk"), not just a bare title — so
 * bitesmart_render_guide_single() can echo it directly with zero
 * "prepend Section N" computation, and it exactly matches the source
 * document's own wording with no risk of a numbering-format mismatch
 * (Roman numeral vs. plain number, etc.).
 *
 * This taxonomy deliberately does NOT attach itself to any post type here
 * — same pattern as stage-taxonomy.php/topic-taxonomy.php. guide-chapter-cpt.php
 * is responsible for attaching it via register_taxonomy_for_object_type(),
 * right alongside its existing Stage/Topic attachment.
 *
 * Load-order note: this file must be required BEFORE guide-chapter-cpt.php
 * — see the main plugin file's require order (same load-order requirement
 * stage-taxonomy.php/topic-taxonomy.php already have).
 */

function bitesmart_register_guide_section_taxonomy() {
    register_taxonomy( 'guide_section', array(), array(
        'labels'            => array(
            'name'          => __( 'Guide Sections', 'custom-post-types-for-bbs' ),
            'singular_name' => __( 'Guide Section', 'custom-post-types-for-bbs' ),
        ),
        // Hierarchical (checkbox UI), same reasoning as Stage: a fixed,
        // curated set of terms (the guide's own fixed section structure),
        // not something editors should be able to invent new values for
        // on the fly.
        'hierarchical'      => true,
        'public'            => true,
        'show_in_rest'      => true,
        'rest_base'         => 'guide_section',
        'show_admin_column' => true,
    ) );

    bitesmart_seed_guide_section_terms();
}
add_action( 'init', 'bitesmart_register_guide_section_taxonomy' );

/**
 * Idempotently create the 7 known Guide Section terms, matching the source
 * PDF's own Table of Contents exactly — same "seed once, guarded by an
 * option flag" pattern as bitesmart_seed_stage_terms() (stage-taxonomy.php).
 * If the guide's own structure ever changes (a Section renamed, added, or
 * removed), edit the array below AND rename/add/remove the term in
 * wp-admin directly — this function only ever adds terms that don't exist
 * yet, it never renames or removes one that does (same as Stage's own
 * seeding), so a later edit here alone won't retroactively rename an
 * already-seeded term.
 */
function bitesmart_seed_guide_section_terms() {
    if ( get_option( 'bitesmart_guide_section_terms_seeded' ) ) {
        return;
    }

    $sections = array(
        'Section I — Understanding Risk',
        'Section II — How Dog Bites Actually Happen',
        'Section III — Core Prevention Systems',
        'Section IV — Teaching Within Developmental Reality',
        'Section V — Adult Responsibility',
        'Section VI — Consequences',
        'Section VII — Conclusion',
    );

    foreach ( $sections as $name ) {
        if ( ! term_exists( $name, 'guide_section' ) ) {
            wp_insert_term( $name, 'guide_section' );
        }
    }

    update_option( 'bitesmart_guide_section_terms_seeded', true );
}
