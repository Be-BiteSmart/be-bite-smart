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

/**
 * A stable, human-readable HTML id for one episode's rendered position on
 * whichever page embeds it via custom/episode — e.g.
 * "paws-to-prevent-episode-1". Built from the episode's Series term slug +
 * Episode Number, NOT its title: per Janet, a future second series would
 * reuse episode numbers starting back at 1 (series+number tells them
 * apart), and — unlike series/number, which are meant to be settled once —
 * a title has a small but real chance of getting edited later (typo fix,
 * rewording), which would silently change a title-based id and break any
 * external link/bookmark pointing at it. Series comes from the Series
 * taxonomy (custom-post-types-for-bbs/includes/series-taxonomy.php);
 * Episode posts default to it on save the same way they default to the
 * Preschool Stage — see bitesmart_default_episode_series_term() in
 * episode-cpt.php.
 *
 * Used both on the real embed's wrapper (render_episode_block() below) and
 * by render_episode_search_card()'s "Watch Episode" link (see
 * learning-search.php's search/browse card for Episodes), so that link can
 * jump straight to this exact episode instead of just the top of whichever
 * page happens to embed it.
 *
 * NOTE: Episodes saved before the Series taxonomy existed won't have a
 * Series term until next saved in wp-admin (the default-term save hook
 * only runs on save, not retroactively) — until then this falls back to a
 * "series-episode-N" id rather than "paws-to-prevent-episode-N".
 * Re-saving each existing Episode once (even with no other changes) fixes
 * this.
 *
 * @param WP_Post $post Episode post.
 * @return string
 */
function bitesmart_episode_anchor_id( $post ) {
    $number = get_post_meta( $post->ID, '_bitesmart_episode_number', true );
    $terms  = get_the_terms( $post->ID, 'series' );
    $series_slug = ( ! is_wp_error( $terms ) && ! empty( $terms ) ) ? $terms[0]->slug : 'series';

    if ( $number ) {
        return $series_slug . '-episode-' . sanitize_title( $number );
    }

    // No Episode Number filled in either — fall back to the episode's own
    // title slug so the id is still unique and readable, even though (only
    // in this fallback case) it isn't stable against a future title edit.
    $title_slug = sanitize_title( get_the_title( $post ) );
    return $title_slug ? $series_slug . '-' . $title_slug : $series_slug . '-' . $post->ID;
}

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
        id="<?php echo esc_attr( bitesmart_episode_anchor_id( $post ) ); ?>"
        data-videos="<?php echo esc_attr( wp_json_encode( $video_ids ) ); ?>"
        data-site-lang="<?php echo esc_attr( $site_lang ); ?>">

        <div class="episode-card-container custom-block-card custom-block-border">
            <div class="episode-card-main">

                <div class="episode-thumbnail-section">
                    <div class="video-thumbnail-wrapper">
                        <div class="video-thumbnail">
                            <?php echo $thumbnail; ?>
                            <div class="video-overlay">
                                <button class="play-button" type="button">
                                    <span class="play-button-icon" aria-hidden="true"></span>
                                    <span class="play-button-label"><?php esc_html_e( 'Watch', 'custom-blocks' ); ?></span>
                                </button>
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

                    <?php if ( $lang_picker_html ) : ?>
                        <div class="episode-controls">
                            <?php echo $lang_picker_html; ?>
                        </div>
                    <?php endif; ?>
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

/**
 * Renders one Episode as a compact card for the Learning Hub Search block
 * (see learning-search.php's bitesmart_build_stage_card_list(), which calls
 * this alongside render_qa_entry_block()/render_resource_block() for the
 * other two content types shown there) — NOT the full video-player card
 * render_episode_block() above builds. That one's too heavy for a dense
 * results/browse list (thumbnail, video player, language picker, funding
 * credit); this one synthesizes a Q&A-style "question" from the episode's
 * title + description instead — description leads (the parent-relevant
 * hook), episode title follows as a subtitle: "{description} — Watch:
 * {name}". Deliberately not "Watch {name}, lesson: {description}" (the
 * original phrasing) — leading with the title read as an instruction, out
 * of step with every other card in this list, which are all literal
 * questions a parent might be asking; leading with the description instead
 * puts the reason to care first, and reads closer to that same voice.
 * Reuses custom/qa-entry's own markup/classes (.wp-block-custom-qa-entry,
 * .qa-entry-card-container, etc.) rather than inventing new ones — that
 * means it picks up qa-entry-display's CSS (accent-card look, chevron
 * accordion, centered link, focus styles, all already enqueued whenever
 * this search block is present — see
 * bitesmart_learning_search_enqueue_card_styles() in learning-search.php)
 * with nothing new to build or enqueue.
 *
 * The revealed body only has a "Watch Episode" link, no separate answer
 * text — the synthesized question already carries the description, unlike
 * a real Q&A Entry's Short/Long Answer split. Links to
 * /learning/kids/#episode-{number}-{title-slug} — the exact episode's own
 * anchor id (bitesmart_episode_anchor_id() above), set on the real
 * custom/episode embed wherever it's actually placed (currently always
 * /learning/kids/ per the content hub plan, see
 * [[be-bitesmart-content-hub-plan]] in memory — this link doesn't
 * hardcode that page by accident, it's just the one true home for episode
 * embeds right now).
 */
function render_episode_search_card( $attributes ) {
    $episode_id = isset( $attributes['episodeId'] ) ? (int) $attributes['episodeId'] : 0;
    $post       = $episode_id ? get_post( $episode_id ) : null;

    if ( ! $post || 'episode' !== $post->post_type || 'publish' !== $post->post_status ) {
        return '';
    }

    $description = get_post_meta( $episode_id, '_bitesmart_episode_description', true );
    $title       = get_the_title( $post );

    // A period joins the two parts as two short sentences, rather than a
    // dash — simplest, most universal separator, and translates cleanly
    // across languages with no special punctuation character to carry
    // over. Ensures the description ends with terminal punctuation (adds a
    // period only if it doesn't already end with one — a "?" or "!" an
    // editor wrote on purpose is left alone).
    $description_lead = rtrim( $description );
    if ( $description_lead && ! in_array( substr( $description_lead, -1 ), array( '.', '!', '?' ), true ) ) {
        $description_lead .= '.';
    }

    $question = $description
        /* translators: 1: episode description (already ends with . / ! / ?), 2: episode title */
        ? sprintf( __( '%1$s Watch: %2$s', 'custom-blocks' ), $description_lead, $title )
        /* translators: %s: episode title */
        : sprintf( __( 'Watch %s', 'custom-blocks' ), $title );

    $watch_url = home_url( '/learning/kids/' ) . '#' . bitesmart_episode_anchor_id( $post );

    ob_start();
    ?>
    <article class="wp-block-custom-qa-entry">
        <details class="qa-entry-card-container custom-block-accent-card">
            <summary class="qa-entry-summary">
                <h3 class="qa-entry-question custom-block-accent-heading"><?php echo esc_html( $question ); ?></h3>
                <svg class="qa-entry-chevron" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
                    <polyline points="5 7.5 10 12.5 15 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline>
                </svg>
            </summary>

            <div class="qa-entry-body">
                <a href="<?php echo esc_url( $watch_url ); ?>" class="qa-entry-guide-link block-toggle-btn is-style-outline">
                    <?php esc_html_e( 'Watch Episode', 'custom-blocks' ); ?>
                </a>
            </div>
        </details>
    </article>
    <?php
    return ob_get_clean();
}
