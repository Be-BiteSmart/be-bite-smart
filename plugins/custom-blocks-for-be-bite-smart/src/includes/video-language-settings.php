<?php

/**
 * Settings > Video Languages
 *
 * Optional, per-language text override (the picker's short pill
 * abbreviation) layered on top of bitesmart_site_languages()'s
 * TranslatePress-derived language list (see site-lang.php). This page is
 * never a gate — every TranslatePress-published language is already
 * available for video content with sane defaults; visiting this page is
 * only needed to customize the pill abbreviation for a specific language.
 *
 * There's no watch-button-label override here on purpose: the watch button
 * always shows the site's current TranslatePress language rather than
 * swapping per selected picker segment, so its text is just a normal
 * static string translated by TranslatePress like any other on-page copy.
 */

function bitesmart_register_video_language_settings_page() {
    add_options_page(
        __( 'Video Languages', 'custom-blocks' ),
        __( 'Video Languages', 'custom-blocks' ),
        'manage_options',
        'bitesmart-video-languages',
        'bitesmart_render_video_languages_settings_page'
    );
}
add_action( 'admin_menu', 'bitesmart_register_video_language_settings_page' );

/**
 * Whitelist keys against TranslatePress's current published languages,
 * sanitize the field, and drop entries left blank (nothing to override).
 *
 * @param mixed $raw Raw POSTed value.
 * @return array<string, array{label: string}>
 */
function bitesmart_sanitize_video_languages( $raw ) {
    $raw = is_array( $raw ) ? $raw : array();

    $known_codes = array();
    if ( function_exists( 'trp_get_languages' ) ) {
        foreach ( trp_get_languages() as $full_code => $name ) {
            $known_codes[] = bitesmart_short_lang_code( $full_code );
        }
    }

    $clean = array();
    foreach ( $raw as $code => $fields ) {
        $code = sanitize_key( $code );
        if ( ! in_array( $code, $known_codes, true ) ) {
            continue;
        }

        $label = isset( $fields['label'] ) ? sanitize_text_field( $fields['label'] ) : '';

        if ( $label === '' ) {
            continue;
        }

        $clean[ $code ] = array(
            'label' => $label,
        );
    }

    return $clean;
}

function bitesmart_register_video_language_setting() {
    register_setting(
        'bitesmart_video_languages_group',
        'bitesmart_video_languages',
        array(
            'type'              => 'array',
            'sanitize_callback' => 'bitesmart_sanitize_video_languages',
            'default'           => array(),
        )
    );
}
add_action( 'admin_init', 'bitesmart_register_video_language_setting' );

function bitesmart_render_video_languages_settings_page() {
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }
    ?>
    <div class="wrap">
        <h1><?php esc_html_e( 'Video Languages', 'custom-blocks' ); ?></h1>

        <?php if ( ! function_exists( 'trp_get_languages' ) ) : ?>
            <div class="notice notice-warning">
                <p><?php esc_html_e( 'TranslatePress must be active to manage video languages. Every video language currently falls back to a built-in English/Spanish/Hindi set.', 'custom-blocks' ); ?></p>
            </div>
            <?php return; ?>
        <?php endif; ?>

        <p>
            <?php esc_html_e( 'Every language published in TranslatePress is automatically available as a video language — nothing to enable here. Use the field below only if you want to override the picker\'s short abbreviation for a specific language.', 'custom-blocks' ); ?>
        </p>

        <form method="post" action="options.php">
            <?php settings_fields( 'bitesmart_video_languages_group' ); ?>
            <?php $overrides = get_option( 'bitesmart_video_languages', array() ); ?>

            <table class="widefat" style="max-width: 600px;">
                <thead>
                    <tr>
                        <th><?php esc_html_e( 'Language', 'custom-blocks' ); ?></th>
                        <th><?php esc_html_e( 'Pill abbreviation', 'custom-blocks' ); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ( trp_get_languages() as $full_code => $name ) :
                        $short_code = bitesmart_short_lang_code( $full_code );
                        $override   = isset( $overrides[ $short_code ] ) ? $overrides[ $short_code ] : array();
                        ?>
                        <tr>
                            <td>
                                <strong><?php echo esc_html( $name ); ?></strong>
                                <code><?php echo esc_html( $short_code ); ?></code>
                            </td>
                            <td>
                                <input
                                    type="text"
                                    name="bitesmart_video_languages[<?php echo esc_attr( $short_code ); ?>][label]"
                                    value="<?php echo esc_attr( isset( $override['label'] ) ? $override['label'] : '' ); ?>"
                                    placeholder="<?php echo esc_attr( strtoupper( $short_code ) ); ?>"
                                    class="small-text"
                                    maxlength="6"
                                />
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>

            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}
