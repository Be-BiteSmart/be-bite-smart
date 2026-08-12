<?php

require_once dirname( __DIR__ ) . '/includes/site-lang.php';

function render_video_quote_block( $attributes ) {
    $title        = wp_kses_post( $attributes['title']       ?? '' );
    $vimeo_url    = esc_url(      $attributes['vimeoUrl']    ?? '' );
    $quote        = wp_kses_post( $attributes['quote']       ?? '' );
    $quote_source = wp_kses_post( $attributes['quoteSource'] ?? '' );
    $note         = wp_kses_post( $attributes['note']        ?? '' );
    $thumbnail_id = $attributes['thumbnailId'] ?? null;

    // ── Vimeo ID ──────────────────────────────────────────────────────────
    $vimeo_id = bitesmart_vimeo_id_from_url( $vimeo_url ) ?? '';

    // ── Thumbnail ─────────────────────────────────────────────────────────
    $thumbnail = '';
    if ( $thumbnail_id ) {
        $attachment_alt = get_post_meta( (int) $thumbnail_id, '_wp_attachment_image_alt', true );
        $alt            = ( is_string( $attachment_alt ) && $attachment_alt !== '' )
            ? $attachment_alt
            : '';

        $thumbnail = wp_get_attachment_image(
            $thumbnail_id,
            'large',
            false,
            [
                'sizes'   => '90vw',
                'loading' => 'lazy',
                'alt'     => $alt,
            ]
        );
    }

    $site_lang            = bitesmart_site_lang_code();
    $available_languages  = bitesmart_normalize_available_languages( $attributes['availableLanguages'] ?? array( 'en' ) );
    $active_lang          = in_array( $site_lang, $available_languages, true ) ? $site_lang : 'en';

    ob_start(); ?>
    <article
        class="wp-block-custom-video-quote video-quote-block"
        <?php // "data-quote-vimeo-id", not "data-vimeo-id" — the latter is a
        // reserved attribute Vimeo's player.js SDK auto-scans the whole DOM
        // for and auto-embeds an extra iframe into, independent of our own
        // new Vimeo.Player() calls. Caused a duplicate player to appear once
        // the SDK loaded (video-toggle.js's ensureVimeoSdk() path). ?>
        data-quote-vimeo-id="<?php echo esc_attr( $vimeo_id ); ?>"
        data-site-lang="<?php echo esc_attr( $site_lang ); ?>"
        data-supported-langs="<?php echo esc_attr( wp_json_encode( $available_languages ) ); ?>"
    >

        <?php if ( $title ) : ?>
            <h3 class="video-quote-title"><?php echo $title; ?></h3>
        <?php endif; ?>

        <div class="video-quote-content-wrapper">

            <div class="video-quote-video-side">
                <div class="video-quote-container">
                    <div class="video-quote-thumbnail-section">
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
                </div>
            </div>

            <div class="video-quote-text-side">

                <?php if ( count( $available_languages ) > 1 ) : ?>
                    <?php bitesmart_video_quote_needs_track_note_templates(); ?>
                    <div class="video-quote-controls">
                        <?php echo bitesmart_render_lang_picker_html( $available_languages, $active_lang ); ?>
                        <p class="video-quote-track-note" role="status" aria-live="polite"></p>
                        <button class="video-quote-watch-button block-toggle-btn" type="button">
                            <span>Watch the Mini-Documentary</span>
                        </button>
                    </div>
                <?php else : ?>
                    <button class="video-quote-watch-button block-toggle-btn" type="button">
                        <span>Watch the Mini-Documentary</span>
                    </button>
                <?php endif; ?>

                <?php if ( $quote ) : ?>
                    <blockquote class="video-quote-blockquote">
                        <p>
                            <span>"</span>
                            <span style="font-style:italic;"><?php echo $quote; ?></span>
                            <span>"</span>
                            <?php if ( $quote_source ) : ?>
                                <cite style="font-style:normal; margin-left:0.5em;">
                                    — <span><?php echo $quote_source; ?></span>
                                </cite>
                            <?php endif; ?>
                        </p>
                    </blockquote>
                <?php endif; ?>

                <?php if ( $note ) : ?>
                    <p class="video-quote-note">
                        <span><?php echo $note; ?></span>
                    </p>
                <?php endif; ?>

            </div>

        </div>

    </article>
    <?php
    return ob_get_clean();
}