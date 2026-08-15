<?php
/**
 * Front end for the Guide feature — both reuse
 * bitesmart_render_guide_single()/bitesmart_render_guide_chapter_single()
 * below, so there's exactly one place that assembles "a Guide's full
 * accordion page":
 *
 * 1. `custom/guide-single` — a CPT-backed display block (same shape as
 *    custom/episode/custom/qa-entry/custom/resource: stores only a
 *    guideId, save() => null, render_callback below). This is THE way to
 *    reach the Guide's content — Janet's call: the site effectively has ONE
 *    Guide (a genuinely different second guide would get its own separate
 *    post type, not a second post here — see guide-cpt.php), so it doesn't
 *    need its own permalink; a normal WP Page (slug exactly "guide") with
 *    this block placed on it gives a clean `/guide/` URL using WordPress's
 *    existing Page-permalink system, no custom rewrite rules needed. Guide
 *    itself is headless (`guide-cpt.php`) — this block is its ONLY front
 *    end.
 *
 * 2. Guide Chapter's OWN real permalink (`/guide/<chapter-slug>/` — see
 *    guide-chapter-cpt.php for why nesting under the same `/guide/` prefix
 *    is safe now that Guide itself claims no rewrite rule). The child theme
 *    (twentytwentyfive-child) has no templates/ directory of its own — it's
 *    a pure block theme relying entirely on parent Twenty Twenty-Five's
 *    block templates (see [[be-bitesmart-plugin-architecture]]), and a
 *    single chapter isn't worth a whole new `templates/single-guide_chapter.html`
 *    just to swap out the middle. Simpler: WordPress's core Post Content
 *    block already renders a singular post's content by internally calling
 *    `apply_filters('the_content', ...)` — same as a classic theme's
 *    `the_content()` call — so hooking that ONE filter, guarded to only
 *    replace the OUTERMOST/main-query call (`is_main_query() &&
 *    in_the_loop()`), swaps in this plugin's own markup without touching
 *    any theme files at all.
 *
 * Either way, bitesmart_render_guide_chapter_row()'s own text rendering
 * uses do_blocks() rather than apply_filters('the_content', ...)
 * internally — see that function's comment (guide-chapter-display.php) for
 * why calling the SAME filter #2 hooks would recurse.
 */

/**
 * A Guide's own page: description, the format-toggle controls, then every
 * one of its chapters as a native-accordion list (see
 * bitesmart_render_guide_chapter_row()'s `accordion_group` — every chapter
 * here shares one group, so opening one auto-closes the others, matching
 * Janet's "accordion is friendliest" call). Ordered by Chapter Number,
 * cast numeric so "2" sorts before "10" (a chapter left with no number at
 * all still appears, just wherever a numeric cast of '' happens to sort —
 * editors are encouraged, not required, to fill it in).
 *
 * @param int $guide_id
 * @return string HTML, or '' if $guide_id isn't a real Guide post.
 */
function bitesmart_render_guide_single( $guide_id ) {
    $post = get_post( $guide_id );
    if ( ! $post || 'guide' !== $post->post_type ) {
        return '';
    }

    $description = get_post_meta( $guide_id, '_bitesmart_guide_description', true );

    $chapters = new WP_Query( array(
        'post_type'      => 'guide_chapter',
        'post_status'    => 'publish',
        'posts_per_page' => -1,
        'no_found_rows'  => true,
        'meta_query'     => array(
            'relation'      => 'AND',
            'guide_clause'  => array(
                'key'   => '_bitesmart_chapter_guide_id',
                'value' => $guide_id,
            ),
            'number_clause' => array(
                'key'     => '_bitesmart_chapter_number',
                'type'    => 'NUMERIC',
                'compare' => 'EXISTS',
            ),
        ),
        'orderby'        => array( 'number_clause' => 'ASC' ),
    ) );

    $accordion_group = 'guide-' . $guide_id;

    ob_start();
    ?>
    <div class="guide-single">
        <?php if ( $description ) : ?>
            <p class="guide-single-description"><?php echo esc_html( $description ); ?></p>
        <?php endif; ?>

        <?php if ( $chapters->have_posts() ) : ?>
            <?php echo bitesmart_render_guide_format_controls(); // phpcs:ignore ?>
            <div class="guide-chapter-list">
                <?php foreach ( $chapters->posts as $chapter ) : ?>
                    <?php
                    echo bitesmart_render_guide_chapter_row( $chapter->ID, array( // phpcs:ignore
                        'accordion_group' => $accordion_group,
                        'show_guide_link' => false, // redundant — we're already ON this chapter's guide
                    ) );
                    ?>
                <?php endforeach; ?>
            </div>
        <?php else : ?>
            <p class="guide-single-empty"><?php esc_html_e( 'Chapters for this guide are coming soon.', 'custom-blocks' ); ?></p>
        <?php endif; ?>
    </div>
    <?php
    return ob_get_clean();
}

/**
 * A chapter's own page: format-toggle controls, then just that one chapter,
 * pre-expanded (open => true) — there's nothing else on the page competing
 * for attention, unlike a chapter row sitting collapsed in a longer list.
 *
 * @param int $chapter_id
 * @return string HTML, or '' if $chapter_id isn't a real published chapter.
 */
function bitesmart_render_guide_chapter_single( $chapter_id ) {
    $post = get_post( $chapter_id );
    if ( ! $post || 'guide_chapter' !== $post->post_type ) {
        return '';
    }

    ob_start();
    ?>
    <div class="guide-chapter-single">
        <?php echo bitesmart_render_guide_format_controls(); // phpcs:ignore ?>
        <?php
        echo bitesmart_render_guide_chapter_row( $chapter_id, array( // phpcs:ignore
            'show_guide_link' => true,
            'open'            => true,
        ) );
        ?>
    </div>
    <?php
    return ob_get_clean();
}

/**
 * Swaps in the above for the SINGULAR, MAIN-QUERY view of a Guide Chapter —
 * guarded so this never touches an excerpt, a REST API `content` field
 * render, a related-post loop, or any other secondary call to
 * 'the_content' that happens to run during the same request. Guide itself
 * is headless (no permalink — see guide-cpt.php), so there's no
 * is_singular('guide') branch here; its only front end is
 * render_guide_single_block() below. Falls back to the original $content
 * (effectively empty either way — a chapter's real content gets shown via
 * bitesmart_render_guide_chapter_row() instead) if the post somehow
 * doesn't resolve.
 *
 * @param string $content
 * @return string
 */
function bitesmart_guide_single_content_filter( $content ) {
    if ( ! is_main_query() || ! in_the_loop() || ! is_singular( 'guide_chapter' ) ) {
        return $content;
    }

    $replacement = bitesmart_render_guide_chapter_single( get_the_ID() );
    return $replacement ? $replacement : $content;
}
add_filter( 'the_content', 'bitesmart_guide_single_content_filter' );

/**
 * render_callback for custom/guide-single — see this file's header comment
 * (form #2) and block.json. Thin wrapper: all the real work is
 * bitesmart_render_guide_single() above, same function the Guide's own
 * permalink uses via bitesmart_guide_single_content_filter().
 *
 * @param array $attributes Block attributes ({ guideId }).
 * @return string
 */
function render_guide_single_block( $attributes ) {
    $guide_id = isset( $attributes['guideId'] ) ? (int) $attributes['guideId'] : 0;
    if ( ! $guide_id ) {
        return '';
    }

    $post = get_post( $guide_id );
    if ( ! $post || 'guide' !== $post->post_type || 'publish' !== $post->post_status ) {
        // Front end: render nothing (e.g. Guide was later trashed/unpublished).
        // The editor's own Placeholder/picker covers the empty state there.
        return '';
    }

    return bitesmart_render_guide_single( $guide_id );
}
