<?php
/**
 * Render callback for the "custom/episode" block.
 *
 * Unlike custom/episode-card (which saves its own copy of everything into
 * the page), this block stores only an episodeId attribute and pulls the
 * rest live from the Episode post at render time — that's what makes it
 * safe to place the same episode on multiple pages without duplicating any
 * content. See the Custom Post Types for BBS plugin's includes/episode-cpt.php
 * for the post type / meta this reads from — this plugin depends on that
 * one being active (see this plugin's "Requires Plugins" header).
 *
 * Markup intentionally mirrors custom/episode-card's saved output
 * (same class names, same data-videos/data-site-lang attributes) so the
 * existing front-end CSS and video-toggle.js interactivity keep working
 * unchanged — this block only needs a new wrapper class
 * (wp-block-custom-episode vs. wp-block-custom-episode-card), since neither
 * the stylesheet nor video-toggle.js selects on that class.
 */

function render_episode_block( $attributes ) {
    $episode_id = isset( $attributes['episodeId'] ) ? (int) $attributes['episodeId'] : 0;
    $post       = $episode_id ? get_post( $episode_id ) : null;

    if ( ! $post || 'episode' !== $post->post_type || 'publish' !== $post->post_status ) {
        // Front end: render nothing (e.g. episode was later trashed). The
        // editor's own Placeholder/picker covers the empty state there.
        return '';
    }

    $number      = get_post_meta( $episode_id, '_bitesmart_episode_number', true );
    $description = get_post_meta( $episode_id, '_bitesmart_episode_description', true );
    $videos      = get_post_meta( $episode_id, '_bitesmart_episode_videos_by_lang', true );
    $video_ids   = bitesmart_vimeo_ids_by_lang_map( is_array( $videos ) ? $videos : array() );
    $downloads   = get_post_meta( $episode_id, '_bitesmart_episode_downloads_page_url', true );
    $funded_name = get_post_meta( $episode_id, '_bitesmart_episode_funded_by_name', true );
    $logo_id     = (int) get_post_meta( $episode_id, '_bitesmart_episode_funded_by_logo_id', true );
    $site_lang   = bitesmart_site_lang_code();

    // get_the_post_thumbnail() already applies the attachment's stored alt
    // text by default — no need for bitesmart_attachment_alt_text() here.
    $thumbnail = get_the_post_thumbnail( $post, 'medium', array( 'loading' => 'lazy' ) );

    $lang_codes = array_keys( $video_ids );
    if ( count( $lang_codes ) > 1 ) {
        bitesmart_episode_needs_lang_restart_templates();
    }
    $lang_picker_html = bitesmart_render_lang_picker_html( $lang_codes, $site_lang );

    $logo_alt  = $logo_id ? bitesmart_attachment_alt_text( $logo_id ) : '';
    $logo_attr = array( 'class' => 'episode-funded-by-logo', 'alt' => esc_attr( $logo_alt ) );
    if ( $logo_id && $logo_alt === '' ) {
        $logo_attr['aria-hidden'] = 'true';
    }

    ob_start();
    ?>
    <article class="wp-block-custom-episode video-episode-block"
        data-videos="<?php echo esc_attr( wp_json_encode( $video_ids ) ); ?>"
        data-site-lang="<?php echo esc_attr( $site_lang ); ?>">

        <div class="episode-card-container custom-block-card custom-block-border">
            <div class="episode-card-main">

                <div class="episode-thumbnail-section">
                    <div class="video-thumbnail-wrapper">
                        <div class="video-thumbnail">
                            <?php echo $thumbnail; ?>
                            <div class="video-overlay">
                                <button class="play-button" aria-label="Play video" type="button"></button>
                            </div>
                        </div>
                        <div class="video-player"></div>
                    </div>
                </div>

                <div class="episode-content-section">
                    <?php if ( $number ) : ?>
                        <span class="episode-number"><?php echo esc_html( 'Episode ' . $number ); ?></span>
                    <?php endif; ?>

                    <h3 class="episode-title"><?php echo esc_html( get_the_title( $post ) ); ?></h3>

                    <?php if ( $description ) : ?>
                        <p class="episode-description"><?php echo esc_html( $description ); ?></p>
                    <?php endif; ?>

                    <div class="episode-controls">
                        <?php echo $lang_picker_html; ?>

                        <button class="watch-now-button block-toggle-btn" type="button">
                            <span><?php esc_html_e( 'Watch Now', 'custom-blocks' ); ?></span>
                        </button>
                    </div>
                </div>
            </div>

            <?php if ( $downloads ) : ?>
                <div class="download-note">
                    <p class="download-note-text">
                        <strong><?php esc_html_e( 'Videos and coloring books are available to download.', 'custom-blocks' ); ?></strong>
                    </p>
                    <a href="<?php echo esc_url( $downloads ); ?>" class="download-link-btn block-toggle-btn is-style-outline">
                        <?php esc_html_e( 'Go to Downloads', 'custom-blocks' ); ?>
                    </a>
                </div>
            <?php endif; ?>

            <?php if ( $funded_name ) : ?>
                <div class="episode-funded-by">
                    <span class="episode-funded-by-label"><?php esc_html_e( 'Funded by:', 'custom-blocks' ); ?></span>
                    <span class="episode-funded-by-credit">
                        <?php if ( $logo_id ) : ?>
                            <?php echo wp_get_attachment_image( $logo_id, 'thumbnail', false, $logo_attr ); ?>
                        <?php endif; ?>
                        <span class="episode-funded-by-name"><?php echo esc_html( $funded_name ); ?></span>
                    </span>
                </div>
            <?php endif; ?>
        </div>
    </article>
    <?php
    return ob_get_clean();
}
