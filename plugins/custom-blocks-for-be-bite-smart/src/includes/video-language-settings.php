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
 *
 * This page also holds an optional override for the episode-card
 * language-restart confirmation dialog's base wording (see
 * bitesmart_lang_restart_dialog_copy() in site-lang.php). Leaving those
 * fields blank keeps the built-in default text — translating the dialog
 * into Spanish/Hindi/etc. still happens through TranslatePress's normal
 * String Translation screen, same as every other static string on the
 * site; the fields here only change the underlying English (or whichever)
 * source wording that TranslatePress translates FROM.
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

/**
 * Sanitize the language-restart dialog wording override: trim each field,
 * drop it if blank (falls back to the built-in default — see
 * bitesmart_lang_restart_dialog_copy() in site-lang.php).
 *
 * @param mixed $raw Raw POSTed value.
 * @return array{title?: string, message?: string, confirm?: string, cancel?: string}
 */
function bitesmart_sanitize_lang_restart_dialog_text( $raw ) {
    $raw   = is_array( $raw ) ? $raw : array();
    $clean = array();

    foreach ( array( 'title', 'message', 'confirm', 'cancel' ) as $key ) {
        $value = isset( $raw[ $key ] ) ? sanitize_text_field( $raw[ $key ] ) : '';
        if ( $value !== '' ) {
            $clean[ $key ] = $value;
        }
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

    register_setting(
        'bitesmart_video_languages_group',
        'bitesmart_lang_restart_dialog_text',
        array(
            'type'              => 'array',
            'sanitize_callback' => 'bitesmart_sanitize_lang_restart_dialog_text',
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

            <h2><?php esc_html_e( 'Language switch dialog', 'custom-blocks' ); ?></h2>
            <p>
                <?php esc_html_e( 'Shown to visitors when they change language on an episode video that\'s already playing (switching reloads the video, so this confirms first). Leave a field blank to keep its default wording. Translating this into Spanish, Hindi, etc. still happens in TranslatePress\'s own String Translation screen — the fields below only change the underlying wording that gets translated FROM.', 'custom-blocks' ); ?>
            </p>
            <div class="notice notice-warning inline" style="margin: 0 0 16px;">
                <p>
                    <strong><?php esc_html_e( 'Before editing these fields:', 'custom-blocks' ); ?></strong>
                    <?php esc_html_e( 'changing any field below creates new source text. TranslatePress matches translations to the exact original wording, so any Spanish, Hindi, etc. translations already set up for the current text will stop being used — you\'ll need to re-add translations for the new wording in every language, in TranslatePress\'s String Translation screen, after saving here.', 'custom-blocks' ); ?>
                </p>
            </div>
            <?php
            $dialog_defaults  = bitesmart_lang_restart_dialog_defaults();
            $dialog_overrides = get_option( 'bitesmart_lang_restart_dialog_text', array() );
            ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row">
                        <label for="bitesmart-lang-restart-title"><?php esc_html_e( 'Dialog title', 'custom-blocks' ); ?></label>
                    </th>
                    <td>
                        <input
                            type="text"
                            id="bitesmart-lang-restart-title"
                            name="bitesmart_lang_restart_dialog_text[title]"
                            value="<?php echo esc_attr( isset( $dialog_overrides['title'] ) ? $dialog_overrides['title'] : '' ); ?>"
                            placeholder="<?php echo esc_attr( $dialog_defaults['title'] ); ?>"
                            class="regular-text"
                        />
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="bitesmart-lang-restart-message"><?php esc_html_e( 'Message', 'custom-blocks' ); ?></label>
                    </th>
                    <td>
                        <input
                            type="text"
                            id="bitesmart-lang-restart-message"
                            name="bitesmart_lang_restart_dialog_text[message]"
                            value="<?php echo esc_attr( isset( $dialog_overrides['message'] ) ? $dialog_overrides['message'] : '' ); ?>"
                            placeholder="<?php echo esc_attr( $dialog_defaults['message'] ); ?>"
                            class="large-text"
                        />
                        <p class="description"><?php esc_html_e( 'Use {language} where the target language name should appear.', 'custom-blocks' ); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="bitesmart-lang-restart-confirm"><?php esc_html_e( 'Confirm button', 'custom-blocks' ); ?></label>
                    </th>
                    <td>
                        <input
                            type="text"
                            id="bitesmart-lang-restart-confirm"
                            name="bitesmart_lang_restart_dialog_text[confirm]"
                            value="<?php echo esc_attr( isset( $dialog_overrides['confirm'] ) ? $dialog_overrides['confirm'] : '' ); ?>"
                            placeholder="<?php echo esc_attr( $dialog_defaults['confirm'] ); ?>"
                            class="regular-text"
                        />
                        <p class="description"><?php esc_html_e( 'Use {language} where the target language name should appear.', 'custom-blocks' ); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="bitesmart-lang-restart-cancel"><?php esc_html_e( 'Cancel button', 'custom-blocks' ); ?></label>
                    </th>
                    <td>
                        <input
                            type="text"
                            id="bitesmart-lang-restart-cancel"
                            name="bitesmart_lang_restart_dialog_text[cancel]"
                            value="<?php echo esc_attr( isset( $dialog_overrides['cancel'] ) ? $dialog_overrides['cancel'] : '' ); ?>"
                            placeholder="<?php echo esc_attr( $dialog_defaults['cancel'] ); ?>"
                            class="regular-text"
                        />
                    </td>
                </tr>
            </table>

            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}
