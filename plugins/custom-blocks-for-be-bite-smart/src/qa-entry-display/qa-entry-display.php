<?php
/**
 * Render callback for the "custom/qa-entry" block.
 *
 * Like custom/episode and custom/resource, this block stores only an
 * entryId attribute and pulls the rest live from the Q&A Entry post at
 * render time — see the Custom Post Types for BBS plugin's
 * includes/qa-entry-cpt.php for the post type / meta this reads from.
 *
 * "Read the full guide" only appears for a Long Answer entry, and only
 * when its Link Destination actually resolves to something — either a
 * published Resource post's URL, or a hand-typed URL. A Short Answer entry
 * never shows the link, even if a Link Destination was filled in (that
 * field's other job — merging in a linked Resource's Keywords at search-
 * index-build time — is a later, not-yet-built step; see
 * [[be-bitesmart-qa-resource-data-model]] in memory).
 *
 * Both Answer Types use the shared ".custom-block-accent-card" look (light
 * blue background, blue left border, right corners rounded — see the
 * theme's css/shared-block-styles.css) instead of the standard white
 * ".custom-block-card"/".custom-block-border" treatment every other
 * display block uses — a deliberate visual match to the site's existing
 * "Meet The Characters"-style callout boxes. Long Answer's teaser text and
 * "Read the full guide" link render inside that same blue card.
 *
 * The card is a native <details>/<summary> disclosure — question always
 * visible, answer (+ button, for Long Answer) revealed on click — rather
 * than a custom JS toggle. Deliberate: this block's cards get injected into
 * the DOM after page load by the search block's Fuse.js results (see
 * [[be-bitesmart-search-status]] in memory), and a click-handler-based
 * toggle (like bio-card's bio-toggle.js) would need re-binding for any card
 * added that way; native <details> needs no JS at all, so it works
 * identically however the card entered the page. The chevron rotates via
 * the same transform/transition technique already used for the navbar
 * submenu toggle (see themes/twentytwentyfive-child/css/navbar.css),
 * keyed off <details>'s native [open] state instead of aria-expanded.
 */

/**
 * Resolve a Q&A Entry's Link Destination to a URL, or '' if it doesn't
 * resolve to anything (e.g. link type is 'resource' but that Resource was
 * trashed).
 *
 * @param string $link_type   'resource' or 'url'.
 * @param int    $resource_id Resource post ID, used when $link_type is 'resource'.
 * @param string $raw_url     Hand-typed URL, used when $link_type is 'url'.
 * @return string
 */
function bitesmart_resolve_qa_entry_link( $link_type, $resource_id, $raw_url ) {
    if ( 'resource' === $link_type ) {
        $resource_post = $resource_id ? get_post( $resource_id ) : null;
        if ( ! $resource_post || 'resource' !== $resource_post->post_type || 'publish' !== $resource_post->post_status ) {
            return '';
        }
        return (string) get_post_meta( $resource_id, '_bitesmart_resource_url', true );
    }

    return (string) $raw_url;
}

function render_qa_entry_block( $attributes ) {
    $entry_id = isset( $attributes['entryId'] ) ? (int) $attributes['entryId'] : 0;
    $post     = $entry_id ? get_post( $entry_id ) : null;

    if ( ! $post || 'qa_entry' !== $post->post_type || 'publish' !== $post->post_status ) {
        // Front end: render nothing (e.g. entry was later trashed). The
        // editor's own Placeholder/picker covers the empty state there.
        return '';
    }

    $answer_type = get_post_meta( $entry_id, '_bitesmart_qa_answer_type', true );
    $answer_text = get_post_meta( $entry_id, '_bitesmart_qa_answer_text', true );
    $link_type   = get_post_meta( $entry_id, '_bitesmart_qa_link_type', true );
    $resource_id = (int) get_post_meta( $entry_id, '_bitesmart_qa_link_resource_id', true );
    $raw_url     = get_post_meta( $entry_id, '_bitesmart_qa_link_url', true );
    $is_long     = 'long' === $answer_type;
    $link_url    = $is_long ? bitesmart_resolve_qa_entry_link( $link_type, $resource_id, $raw_url ) : '';

    // Both Answer Types share the same accent-card look now — Long Answer's
    // teaser text and "Read the full guide" link render inside it too,
    // rather than the standard white .custom-block-card treatment every
    // other display block uses.
    $container_class = 'qa-entry-card-container custom-block-accent-card';
    $heading_class    = 'qa-entry-question custom-block-accent-heading';
    $answer_class     = 'qa-entry-answer custom-block-accent-text' . ( $is_long ? ' qa-entry-teaser' : '' );

    ob_start();
    ?>
    <article class="wp-block-custom-qa-entry">
        <details class="<?php echo esc_attr( $container_class ); ?>">
            <summary class="qa-entry-summary">
                <h3 class="<?php echo esc_attr( $heading_class ); ?>"><?php echo esc_html( get_the_title( $post ) ); ?></h3>
                <svg class="qa-entry-chevron" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
                    <polyline points="5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
                </svg>
            </summary>

            <div class="qa-entry-body">
                <?php if ( $answer_text ) : ?>
                    <p class="<?php echo esc_attr( $answer_class ); ?>">
                        <?php echo esc_html( $answer_text ); ?>
                    </p>
                <?php endif; ?>

                <?php if ( $is_long && $link_url ) : ?>
                    <a href="<?php echo esc_url( $link_url ); ?>" class="qa-entry-guide-link block-toggle-btn is-style-outline">
                        <?php esc_html_e( 'Read the full guide', 'custom-blocks' ); ?>
                    </a>
                <?php endif; ?>
            </div>
        </details>
    </article>
    <?php
    return ob_get_clean();
}
