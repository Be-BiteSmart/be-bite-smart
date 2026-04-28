<?php

function qr_render_audio_row( $audio_id, $icon_html, $aria_label, $btn_id = '' ) {
    $id_attr   = $btn_id ? ' id="' . esc_attr( $btn_id ) . '"' : '';
    $data_attr = $btn_id ? '' : ' data-audio="' . esc_attr( $audio_id ) . '"';
    ob_start(); ?>
    <div class="qr-audio-row">
        <button<?php echo $id_attr; ?>
            class="qr-btn qr-audio-play-btn block-toggle-btn"
            <?php echo $data_attr; ?>
            type="button"
            aria-label="<?php echo esc_attr( $aria_label ); ?>">
            <?php echo $icon_html; ?>
        </button>
        <span class="qr-audio-time" data-audio="<?php echo esc_attr( $audio_id ); ?>" aria-live="off">0:00</span>
    </div>
    <?php return ob_get_clean();
}

function qr_render_transcript( $transcript_id, $content, $start_open = true ) {
    $hidden  = $start_open ? '' : ' hidden';
    $expanded = $start_open ? 'true' : 'false';
    $label   = $start_open ? 'Hide transcript' : 'Show transcript';
    ob_start(); ?>
    <div id="<?php echo esc_attr( $transcript_id ); ?>" class="qr-transcript"<?php echo $hidden; ?>>
        <?php echo wp_kses_post( $content ); ?>
    </div>
    <button
        class="qr-btn qr-transcript-toggle block-toggle-btn is-style-outline"
        type="button"
        aria-expanded="<?php echo $expanded; ?>"
        aria-controls="<?php echo esc_attr( $transcript_id ); ?>">
        <?php echo esc_html( $label ); ?>
    </button>
    <?php return ob_get_clean();
}

// Add $preload parameter, default to 'metadata' (safe default)
   // reading-mode audio sits idle until the user taps play, so metadata (just fetch duration/headers) is enough. 
   // Narrated-mode audio needs to start immediately when its step activates, so auto (buffer the file) prevents a delay before playback begins.
function qr_render_audio_element( $audio_id, $src, $preload = 'metadata' ) {
    return '<audio id="' . esc_attr( $audio_id ) . '" preload="' . esc_attr( $preload ) . '">'
         . '<source src="' . esc_url( $src ) . '" type="audio/mpeg">'
         . '</audio>';
}

// Thread metadata preload logic through the section wrapper
function qr_render_audio_section( $audio_id, $src, $icon_html, $aria_label, $transcript_id, $transcript, $transcript_open, $btn_id = '', $preload = 'metadata' ) {
    $out  = qr_render_audio_element( $audio_id, $src, $preload );
    $out .= qr_render_audio_row( $audio_id, $icon_html, $aria_label, $btn_id );
    if ( $transcript ) {
        $out .= qr_render_transcript( $transcript_id, $transcript, $transcript_open );
    }
    return $out;
}


function qr_render_come_home_btn( $url, $label, $extra_id = '' ) {
    $id_attr = $extra_id ? ' id="' . esc_attr( $extra_id ) . '"' : '';
    ob_start(); ?>
    <a href="<?php echo esc_url( $url ); ?>" class="qr-btn qr-come-home-btn block-toggle-btn"<?php echo $id_attr; ?>>
        <?php echo esc_html( $label ); ?>
    </a>
    <?php return ob_get_clean();
}


function qr_render_vimeo( $iframe_id, $vimeo_id, $title ) {
    ob_start(); ?>
    <div class="qr-video-wrapper">
        <iframe
            id="<?php echo esc_attr( $iframe_id ); ?>"
            src="https://player.vimeo.com/video/<?php echo esc_attr( $vimeo_id ); ?>?api=1&autopause=0&muted=0&texttrack=en"
            allow="autoplay; fullscreen; picture-in-picture"
            allowfullscreen
            title="<?php echo esc_attr( $title ); ?>">
        </iframe>
    </div>
    <?php return ob_get_clean();
}

//  in PHP, omitting the closing php tag is best practice for files that contain only PHP. This prevents accidental whitespace or newlines after the tag from being output, which can cause "headers already sent" errors. So your file is correct as-is.