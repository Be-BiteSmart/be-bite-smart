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

    ob_start();
    ?>
    <article class="wp-block-custom-qa-entry">
        <div class="qa-entry-card-container custom-block-card custom-block-border">
            <h3 class="qa-entry-question"><?php echo esc_html( get_the_title( $post ) ); ?></h3>

            <?php if ( $answer_text ) : ?>
                <p class="qa-entry-answer<?php echo $is_long ? ' qa-entry-teaser' : ''; ?>">
                    <?php echo esc_html( $answer_text ); ?>
                </p>
            <?php endif; ?>

            <?php if ( $is_long && $link_url ) : ?>
                <a href="<?php echo esc_url( $link_url ); ?>" class="qa-entry-guide-link block-toggle-btn is-style-outline">
                    <?php esc_html_e( 'Read the full guide', 'custom-blocks' ); ?>
                </a>
            <?php endif; ?>
        </div>
    </article>
    <?php
    return ob_get_clean();
}
