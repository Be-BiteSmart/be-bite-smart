<?php

function render_qr_experience_block( $attributes ) {


    // SVG icons — defined once in PHP so they're consistent everywhere
    // inherit the current text's color, currentColor is a built in CSS keyword, means "the computed value of the color property on this element."
 $play_icon  = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M3 1.5L13 7L3 12.5V1.5Z" fill="currentColor"/></svg>';

$pause_icon = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="2" y="1" width="3.5" height="12" rx="1" fill="currentColor"/><rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="currentColor"/></svg>';

// Enqueue the front-end JS for this block.
//
// WHY THIS IS IN render.php:
// wp_enqueue_script() is safe to call inside a render callback — WordPress
// deduplicates enqueues by handle, so even if this block appears multiple
// times on a page, the script is only loaded once.
//
// WHY plugins_url() + dirname( dirname( __FILE__ ) ) INSTEAD OF plugin_dir_url( __FILE__ ):
// __FILE__ resolves to src/qr-experience/render.php, so plugin_dir_url( __FILE__ )
// would point to src/qr-experience/ — but frontend.js is a compiled file that
// lives in build/qr-experience/ after `npm run build`.
// dirname( dirname( __FILE__ ) ) walks up two levels to the plugin root,
// giving plugins_url() the correct base to build from.
// Using the wrong path caused a white screen in wp-admin because WordPress
// couldn't resolve the asset.

 wp_enqueue_script(
    'qr-experience-js',
    plugins_url( 'build/qr-experience/frontend.js', dirname( dirname( __FILE__ ) ) ),
    [],
    '1.0.0',
    true
);


    wp_localize_script( 'qr-experience-js', 'qrExperience', [
        'playIcon'   => $play_icon,
        'pauseIcon'  => $pause_icon,
        'totalSteps' => 4,
    ]);

    $intro_text          = $attributes['introText']          ?? '';
    $opening_audio       = $attributes['openingAudioUrl']    ?? '';
    $opening_transcript  = $attributes['openingTranscript']  ?? '';
    $vimeo_id            = $attributes['vimeoId']            ?? '';
    $closing_audio       = $attributes['closingAudioUrl']    ?? '';
    $closing_transcript  = $attributes['closingTranscript']  ?? '';
    $button_url          = $attributes['buttonUrl']          ?? '';
    $button_label        = $attributes['buttonLabel']        ?? 'Come Home';

    $total_steps = 4;


    ob_start();
    ?>

<!-- Skip link -->
<a class="qr-skip-link" href="#qr-button-target">Skip to <?php echo esc_html( $button_label ); ?> button</a>

<!-- Screen reader live region -->
<div id="qr-announcer" class="qr-sr-only" aria-live="polite" aria-atomic="true"></div>

<div class="qr-experience">

  <!-- ══ INTRO SCREEN ════════════════════════════════════════ -->
  <div id="qr-mode-intro" class="qr-mode active" role="region" aria-label="Choose your experience">

    <?php if ( $intro_text ) : ?>
      <div class="qr-intro-text"><?php echo wp_kses_post( $intro_text ); ?></div>
    <?php endif; ?>

    <div class="qr-mode-buttons">
      <button class="qr-btn qr-btn-primary block-toggle-btn" id="btn-start-narrated" type="button" aria-describedby="narrated-desc">
        Start narrated experience
      </button>
      <button class="qr-btn block-toggle-btn is-style-outline" id="btn-start-reading" type="button" aria-describedby="reading-desc">
        Read at your own pace
      </button>
    </div>

    <p id="narrated-desc" class="qr-sr-only">Audio and video play automatically in sequence. You can pause at any time.</p>
    <p id="reading-desc" class="qr-sr-only">All content shown at once. Audio and video play only when you choose.</p>

  </div><!-- /intro -->


  <!-- ══ READING MODE ════════════════════════════════════════ -->
  <div id="qr-mode-reading" class="qr-mode" role="region" aria-label="Reading mode">

    <div class="qr-escape-bar">
      <button class="qr-btn qr-escape-btn block-toggle-btn is-style-outline" id="btn-switch-to-narrated" type="button">
        Switch to narration
      </button>
    </div>

    <!-- Opening -->
    <div class="qr-reading-section">

      <?php if ( $opening_audio ) : ?>
        <!-- Reading mode: starts as PLAY (no autoplay) -->
        <!-- Note: uses data-audio, NOT an id — no conflict with narrated mode button -->
           <!-- omit the last arg, defaults to 'metadata' instead of preload -->
        <?php echo qr_render_audio_section( 'audio-reading-opening', $opening_audio, $play_icon . 'Play', 'Play opening audio', 'transcript-reading-opening', $opening_transcript, true ); ?>
      <?php endif; ?>

    </div><!-- /opening -->

    <!-- Video -->
    <?php if ( $vimeo_id ) : ?>
    <div class="qr-reading-section">
      <?php echo qr_render_vimeo( 'vimeo-reading', $vimeo_id, get_the_title() . ' — video' ); ?>
    </div>
    <?php endif; ?>

    <!-- Closing -->
    <div class="qr-reading-section">

      <?php if ( $closing_audio ) : ?>
        <!-- Reading mode: starts as PLAY (no autoplay) -->
        <!-- Note: uses data-audio, NOT an id — no conflict with narrated mode button -->
         <!-- omit the last arg, defaults to 'metadata' instead of preload -->
        <?php echo qr_render_audio_section( 'audio-reading-closing', $closing_audio, $play_icon . 'Play', 'Play closing audio', 'transcript-reading-closing', $closing_transcript, true ); ?>
      <?php endif; ?>

    </div><!-- /closing -->

    <!-- Button -->
    <?php if ( $button_url ) : ?>
    <div class="qr-reading-section" style="text-align:center;">
      <?php echo qr_render_come_home_btn( $button_url, $button_label, 'qr-button-target' ); ?>
    </div>
    <?php endif; ?>

  </div><!-- /reading mode -->


  <!-- ══ NARRATED MODE ═══════════════════════════════════════ -->
  <div id="qr-mode-narrated" class="qr-mode" role="region" aria-label="Narrated experience">

    <div class="qr-escape-bar">
      <div class="qr-replay-row" aria-live="polite">
        <button
          id="btn-replay"
          class="qr-btn qr-replay-btn block-toggle-btn is-style-outline"
          type="button"
          disabled
          aria-label="Replay previous section (not available yet)">
          ↑ Replay previous section
        </button>
      </div>
      <button class="qr-btn qr-escape-btn block-toggle-btn is-style-outline" id="btn-switch-to-reading" type="button">
        Switch to reading?
      </button>
    </div>

    <p id="qr-paused-msg" class="qr-paused-msg" aria-live="polite"></p>
    <p id="qr-step-indicator" class="qr-step-indicator" aria-live="polite"></p>


    <!-- ── STEP 1: Opening narration ──────────────────────── -->
    <div id="qr-step-1" class="qr-step" aria-current="step" tabindex="-1" role="region" aria-label="Step 1 of 4: Opening narration">

      <?php if ( $opening_audio ) : ?>
        <!-- Narrated mode: starts as PAUSE since audio autoplays -->
        <!-- Note: uses id, wired by JS via wirePauseBtn -->
        <?php echo qr_render_audio_section( 'audio-narrated-opening', $opening_audio, $pause_icon . 'Pause', 'Pause opening narration', 'transcript-narrated-opening', $opening_transcript, false, 'btn-pause-opening', 'auto' ); ?>
      <?php endif; ?>

      <p id="qr-up-next" class="qr-up-next" aria-hidden="true">Up next: a short video</p>

    </div><!-- /step 1 -->


    <!-- ── STEP 2: Video ───────────────────────────────────── -->
    <div id="qr-step-2" class="qr-step" aria-hidden="true" inert tabindex="-1" role="region" aria-label="Step 2 of 4: Video">

      <?php if ( $vimeo_id ) : ?>
        <?php echo qr_render_vimeo( 'vimeo-narrated', $vimeo_id, get_the_title() . ' — video' ); ?>
      <?php endif; ?>

    </div><!-- /step 2 -->


    <!-- ── STEP 3: Closing narration ──────────────────────── -->
    <div id="qr-step-3" class="qr-step" aria-hidden="true" inert tabindex="-1" role="region" aria-label="Step 3 of 4: Closing narration">

      <?php if ( $closing_audio ) : ?>
        <!-- Narrated mode: starts as PAUSE since audio autoplays -->
        <?php echo qr_render_audio_section( 'audio-narrated-closing', $closing_audio, $pause_icon . 'Pause', 'Pause closing narration', 'transcript-narrated-closing', $closing_transcript, false, 'btn-pause-closing', 'auto' ); ?>
      <?php endif; ?>

    </div><!-- /step 3 -->


    <!-- ── STEP 4: Come Home ───────────────────────────────── -->
    <div id="qr-step-4" class="qr-step" aria-hidden="true" inert tabindex="-1" role="region" aria-label="Step 4 of 4: Complete">

      <?php if ( $button_url ) : ?>
        <?php echo qr_render_come_home_btn( $button_url, $button_label, 'qr-button-target' ); ?>
      <?php endif; ?>

    </div><!-- /step 4 -->

  </div><!-- /narrated mode -->

</div><!-- /qr-experience -->

    <?php
    return ob_get_clean();
}