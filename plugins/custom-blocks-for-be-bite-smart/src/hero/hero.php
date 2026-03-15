<?php

function render_hero_block( $attributes ) {
    

    $sm  = esc_url( $attributes['bgImageSmUrl'] ?? '' );
    $md  = esc_url( $attributes['bgImageMdUrl'] ?? '' );
    $lg  = esc_url( $attributes['bgImageLgUrl'] ?? '' );
    $src = $lg ?: $md ?: $sm;

    $picture = '';
    if ( $src ) {
        $sources = '';
        if ( $sm ) $sources .= '<source media="(max-width: 640px)" srcset="' . $sm . '">';
        if ( $md ) $sources .= '<source media="(max-width: 1280px)" srcset="' . $md . '">';
        $picture = '<picture class="dbp-bg-picture" aria-hidden="true">'
            . $sources
            . '<img src="' . $src . '" alt="" loading="eager" fetchpriority="high">'
            . '</picture>';
    }

    $label     = wp_kses_post( $attributes['label']     ?? '' );
    $heading   = wp_kses_post( $attributes['heading']   ?? '' );
    $highlight = wp_kses_post( $attributes['highlight'] ?? '' );
    $body      = wp_kses_post( $attributes['body']      ?? '' );
    $stat1num  = esc_html( $attributes['stat1Num']   ?? '' );
    $stat1lab  = esc_html( $attributes['stat1Label'] ?? '' );
    $stat2num  = esc_html( $attributes['stat2Num']   ?? '' );
    $stat2lab  = esc_html( $attributes['stat2Label'] ?? '' );
    $btn1text  = esc_html( $attributes['btn1Text']   ?? '' );
    $btn1url   = esc_url(  $attributes['btn1Url']    ?? '#' );
    $btn2text  = esc_html( $attributes['btn2Text']   ?? '' );
    $btn2url   = esc_url(  $attributes['btn2Url']    ?? '#' );

    ob_start(); ?>
    <section class="wp-block-custom-hero alignfull dbp-section">
      <div class="dbp-inner">
        <div class="dbp-bg-wrapper">
          <?php echo $picture; ?>
          <div class="dbp-overlay"></div>
        </div>
        <div class="dbp-content">
          <div class="dbp-text">
            <div class="dbp-label">
              <span class="dbp-label__dash"></span>
              <span class="dbp-label__text"><?php echo $label; ?></span>
            </div>
            <div class="dbp-card">
              <h2 class="dbp-heading">
                <span><?php echo $heading; ?></span>
                <em class="dbp-heading__highlight"><?php echo $highlight; ?></em>
              </h2>
              <div class="dbp-card__divider"></div>
              <p class="dbp-body"><?php echo $body; ?></p>
            </div>
            <div class="dbp-stats">
              <div class="dbp-stat dbp-stat--blue">
                <span class="dbp-stat__num"><?php echo $stat1num; ?></span>
                <span class="dbp-stat__label"><?php echo $stat1lab; ?></span>
              </div>
              <div class="dbp-stat dbp-stat--orange">
                <span class="dbp-stat__num"><?php echo $stat2num; ?></span>
                <span class="dbp-stat__label"><?php echo $stat2lab; ?></span>
              </div>
            </div>
            <div class="dbp-buttons">
              <a href="<?php echo $btn1url; ?>" class="block-toggle-btn"><?php echo $btn1text; ?></a>
              <a href="<?php echo $btn2url; ?>" class="block-toggle-btn is-style-outline"><?php echo $btn2text; ?></a>
            </div>
          </div>
        </div>
      </div>
    </section>
    <?php
    return ob_get_clean();

}