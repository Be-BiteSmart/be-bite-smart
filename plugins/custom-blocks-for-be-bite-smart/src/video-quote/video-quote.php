<?php

/**
 * Site UI language for Vimeo defaults (en|es). Uses TranslatePress when available.
 */
function video_quote_site_lang_code() {
    $lang = null;

    if ( function_exists( 'trp_get_current_language' ) ) {
        $lang = trp_get_current_language();
    } else {
        global $TRP_LANGUAGE;
        if ( ! empty( $TRP_LANGUAGE ) ) {
            $lang = $TRP_LANGUAGE;
        }
    }

    if ( ! $lang ) {
        $lang = apply_filters( 'trp_user_language', get_locale() );
    }

    $lang = strtolower( str_replace( '_', '-', (string) $lang ) );

    if ( str_starts_with( $lang, 'es' ) ) {
        return 'es';
    }

    return 'en';
}

function render_video_quote_block( $attributes ) {
    $title        = wp_kses_post( $attributes['title']       ?? '' );
    $vimeo_url    = esc_url(      $attributes['vimeoUrl']    ?? '' );
    $quote        = wp_kses_post( $attributes['quote']       ?? '' );
    $quote_source = wp_kses_post( $attributes['quoteSource'] ?? '' );
    $note         = wp_kses_post( $attributes['note']        ?? '' );
    $thumbnail_id = $attributes['thumbnailId'] ?? null;

    // ── Vimeo ID ──────────────────────────────────────────────────────────
    $vimeo_id = '';
    if ( $vimeo_url ) {
        preg_match( '/vimeo\.com\/(\d+)/', $vimeo_url, $matches );
        $vimeo_id = $matches[1] ?? '';
    }

    // ── Thumbnail ─────────────────────────────────────────────────────────
    $thumbnail = '';
    if ( $thumbnail_id ) {
        $thumbnail = wp_get_attachment_image(
            $thumbnail_id,
            'large',
            false,
            [
                'sizes' => '90vw',
                'loading' => 'lazy',
                'alt'     => wp_strip_all_tags( $title ),
            ]
        );
    }

    $site_lang = video_quote_site_lang_code();

    ob_start(); ?>
    <article
        class="wp-block-custom-video-quote video-quote-block"
        data-vimeo-id="<?php echo esc_attr( $vimeo_id ); ?>"
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
                                    <button class="play-button" aria-label="Play video" type="button"></button>
                                </div>
                            </div>
                            <div class="video-player"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="video-quote-text-side">

                <button class="video-quote-watch-button block-toggle-btn" type="button">
                    <span>Watch the Mini-Documentary</span>
                </button>

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