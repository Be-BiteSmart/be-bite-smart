<?php

/**
 * Same open-quote glyph used for both marks — the closing mark is mirrored
 * with CSS (transform: scaleX(-1)) rather than a second path. Kept in one
 * place so the editor (index.js) and the front end render identically.
 */
function bitesmart_callout_card_quote_svg() {
    return '<svg width="34" height="26" viewBox="0 0 34 26" fill="none" aria-hidden="true"><path d="M0 26V14.6C0 6.2 5.6 0.6 14.6 0H16V6.4C11 7 8.4 9.6 8 14H16V26H0ZM18 26V14.6C18 6.2 23.6 0.6 32.6 0H34V6.4C29 7 26.4 9.6 26 14H34V26H18Z" fill="#F5C842"/></svg>';
}

function render_callout_card_block( $attributes ) {

    $lead_in = wp_kses_post( $attributes['leadIn'] ?? '' );
    $quote   = wp_kses_post( $attributes['quote']  ?? '' );
    $body    = wp_kses_post( $attributes['body']   ?? '' );

    $quote_source    = wp_kses_post( $attributes['quoteSource']    ?? '' );
    $quote_source_url = esc_url(     $attributes['quoteSourceUrl'] ?? '' );

    $source = '';
    if ( $quote_source ) {
        $source = $quote_source_url
            ? '<a href="' . $quote_source_url . '">' . $quote_source . '</a>'
            : $quote_source;
    }

    $btn1text = esc_html( $attributes['btn1Text'] ?? '' );
    $btn1url  = esc_url(  $attributes['btn1Url']  ?? '#' );
    $btn2text = esc_html( $attributes['btn2Text'] ?? '' );
    $btn2url  = esc_url(  $attributes['btn2Url']  ?? '#' );

    $btn1 = $btn1text ? '<a href="' . $btn1url . '" class="block-toggle-btn">' . $btn1text . '</a>' : '';
    $btn2 = $btn2text ? '<a href="' . $btn2url . '" class="block-toggle-btn is-style-outline">' . $btn2text . '</a>' : '';

    $quote_svg   = bitesmart_callout_card_quote_svg();
    $align_class = ! empty( $attributes['align'] ) ? ' align' . sanitize_html_class( $attributes['align'] ) : '';

    ob_start(); ?>
    <div class="wp-block-custom-callout-card cc-card<?php echo $align_class; ?>">
      <div class="cc-panel cc-panel--quote">
        <span class="cc-quote-mark cc-quote-mark--open"><?php echo $quote_svg; ?></span>
        <p class="cc-quote"><?php echo $quote; ?></p>
        <span class="cc-quote-mark cc-quote-mark--close"><?php echo $quote_svg; ?></span>
        <?php if ( $source ) : ?>
          <p class="cc-quote-source"><?php echo $source; ?></p>
        <?php endif; ?>
      </div>
      <div class="cc-panel cc-panel--body">
        <p class="cc-lead"><?php echo $lead_in; ?></p>
        <div class="cc-divider"></div>
        <p class="cc-support"><?php echo $body; ?></p>
        <?php if ( $btn1 || $btn2 ) : ?>
          <div class="cc-buttons">
            <?php echo $btn1; ?>
            <?php echo $btn2; ?>
          </div>
        <?php endif; ?>
      </div>
    </div>
    <?php
    return ob_get_clean();
}
