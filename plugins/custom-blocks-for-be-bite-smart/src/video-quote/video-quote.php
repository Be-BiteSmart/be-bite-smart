<?php

require_once dirname( __DIR__ ) . '/includes/site-lang.php';

function render_video_quote_block( $attributes ) {
    $title        = wp_kses_post( $attributes['title']       ?? '' );
    $quote        = wp_kses_post( $attributes['quote']       ?? '' );
    $quote_source = wp_kses_post( $attributes['quoteSource'] ?? '' );
    $note         = wp_kses_post( $attributes['note']        ?? '' );
    $thumbnail_id = $attributes['thumbnailId'] ?? null;

    // ── Per-language Vimeo videos ────────────────────────────────────────
    // One separate uploaded video per language (e.g. a Spanish-dubbed cut),
    // not one video with multiple embedded audio/caption tracks — the
    // latter turned out to be unreliable on Vimeo's own end regardless of
    // whether it's requested live (selectAudioTrack()) or via URL params
    // (audiotrack=) at embed time; see be-bitesmart-video-toggle-audio-hang.md.
    $videos_by_lang = bitesmart_video_quote_vimeo_ids_from_attrs( $attributes );

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
    $available_languages  = bitesmart_order_language_codes( array_keys( $videos_by_lang ) );
    $active_lang          = in_array( $site_lang, $available_languages, true ) ? $site_lang : 'en';
    $has_picker           = count( $available_languages ) > 1;
    $play_button_label    = bitesmart_play_button_label( $active_lang, $has_picker );

    if ( $has_picker ) {
        bitesmart_needs_play_button_label_template();
        bitesmart_needs_lang_change_status_template();
        bitesmart_needs_lang_restart_templates();
    }

    ob_start(); ?>
    <article
        class="wp-block-custom-video-quote video-quote-block"
        <?php // "data-videos", not "data-vimeo-id"/"data-video-id" — the
        // latter is a reserved attribute Vimeo's player.js SDK auto-scans
        // the whole DOM for and auto-embeds an extra iframe into,
        // independent of our own iframe. Caused a duplicate player to
        // appear once the SDK loaded, back when this block used a single
        // multi-track video. Same attribute name/shape episode-card
        // already emits — resolveVideosForBlock() in shared/languages.js
        // reads both identically. ?>
        data-videos="<?php echo esc_attr( wp_json_encode( $videos_by_lang ) ); ?>"
        data-site-lang="<?php echo esc_attr( $site_lang ); ?>"
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
                                    <button class="play-button" type="button">
                                        <span class="play-button-icon" aria-hidden="true"></span>
                                        <span class="play-button-label"><?php echo esc_html( $play_button_label ); ?></span>
                                    </button>
                                </div>
                            </div>
                            <div class="video-player"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="video-quote-text-side">

                <?php if ( count( $available_languages ) > 1 ) : ?>
                    <div class="video-quote-controls">
                        <?php echo bitesmart_render_lang_picker_html( $available_languages, $active_lang ); ?>
                        <p class="lang-change-status" role="status" aria-live="polite"></p>
                    </div>
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