<?php
/**
 * Render callback for the "custom/resource" block.
 *
 * Like custom/episode, this block stores only a resourceId attribute and
 * pulls the rest live from the Resource post at render time — see the
 * Custom Post Types for BBS plugin's includes/resource-cpt.php for the post
 * type / meta this reads from. A Resource is just a title/excerpt/URL card
 * (see the header comment in resource-cpt.php), so the markup here is much
 * simpler than custom/episode's — no video player, no language picker.
 */

function render_resource_block( $attributes ) {
    $resource_id = isset( $attributes['resourceId'] ) ? (int) $attributes['resourceId'] : 0;
    $post        = $resource_id ? get_post( $resource_id ) : null;

    if ( ! $post || 'resource' !== $post->post_type || 'publish' !== $post->post_status ) {
        // Front end: render nothing (e.g. resource was later trashed). The
        // editor's own Placeholder/picker covers the empty state there.
        return '';
    }

    $excerpt = get_post_meta( $resource_id, '_bitesmart_resource_excerpt', true );
    $url     = get_post_meta( $resource_id, '_bitesmart_resource_url', true );

    ob_start();
    ?>
    <article class="wp-block-custom-resource">
        <div class="resource-card-container custom-block-card custom-block-border">
            <h3 class="resource-card-title"><?php echo esc_html( get_the_title( $post ) ); ?></h3>

            <?php if ( $excerpt ) : ?>
                <p class="resource-card-excerpt"><?php echo esc_html( $excerpt ); ?></p>
            <?php endif; ?>

            <?php if ( $url ) : ?>
                <a href="<?php echo esc_url( $url ); ?>" class="resource-card-link block-toggle-btn is-style-outline">
                    <?php esc_html_e( 'Learn More', 'custom-blocks' ); ?>
                </a>
            <?php endif; ?>
        </div>
    </article>
    <?php
    return ob_get_clean();
}
