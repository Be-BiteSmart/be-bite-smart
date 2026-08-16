<?php
/**
 * Render callback for "custom/guide-description" — displays ONLY a Guide's
 * Description text (the same `_bitesmart_guide_description` meta
 * custom/guide-fields captures on the Guide's own edit screen), nothing
 * else. Split out of custom/guide-single 2026-08-16, per Janet: "lets get
 * rid of the summary from under view all chapters since it should be at
 * the top of the guide page instead. Is there a way I can grab the
 * summary and put it where I want it on the page?" — see
 * bitesmart_render_guide_single()'s own docblock (guide-single.php) for
 * the other half of this change (it no longer renders the description
 * itself).
 *
 * Same "CPT-backed display block, pulls everything live at render time"
 * shape as custom/guide-single/custom/episode/etc. — nothing is
 * duplicated into the block itself, so editing the Description once in
 * the Guide's own edit screen updates every placement of this block
 * automatically, no matter where on the page (or how many different
 * pages) an editor has placed it.
 *
 * NO guideId attribute/picker (removed 2026-08-16) — per Janet: "we only
 * ever have the one guide, so this dropdown is unnecessary." Resolves the
 * site's one Guide itself via bitesmart_get_the_main_guide() (guide-cpt.php,
 * "Custom Post Types for BBS" plugin) instead — same "there's only ever
 * one, don't make anyone pick" pattern already used for a chapter's own
 * parent-Guide relationship (bitesmart_guide_chapter_autofill_guide_id(),
 * guide-chapter-cpt.php).
 */

/**
 * @return string HTML, or '' if no Guide exists yet, it isn't published,
 *     or it has no Description filled in.
 */
function render_guide_description_block() {
    $guide = bitesmart_get_the_main_guide();
    if ( ! $guide || 'publish' !== $guide->post_status ) {
        // Front end: render nothing (e.g. no Guide created yet, or it's
        // still a draft). Same "render nothing, no separate empty state"
        // handling every other CPT-backed display block in this plugin
        // uses when its post doesn't resolve.
        return '';
    }

    $description = get_post_meta( $guide->ID, '_bitesmart_guide_description', true );
    if ( ! $description ) {
        return '';
    }

    // esc_html() alone doesn't turn the field's preserved newlines
    // (sanitize_textarea_field() in guide-cpt.php explicitly keeps them —
    // "preserves line breaks, strips tags") into anything visible: HTML
    // collapses raw whitespace, so multiple typed paragraphs rendered as
    // one run-together blob — the bug Janet reported ("didn't keep my
    // spacing... showing as one block instead of multiple paragraphs").
    // wpautop() is WordPress's own fix for exactly this — double newlines
    // become separate <p>s, single newlines become <br>s — same
    // conversion classic-editor post content and comments already get via
    // 'the_content'/'comment_text'. Escape FIRST, then wpautop() the
    // already-safe text — the other order would escape wpautop()'s own
    // inserted tags right along with everything else. Wrapped in a <div>
    // (not a single <p>) since wpautop() can now emit more than one <p>;
    // the class carries the same spacing/font-size guide-description-block
    // already had.
    return '<div class="guide-description-block">' . wpautop( esc_html( $description ) ) . '</div>';
}
