<?php

/**
 * Site-wide copy for the episode language-restart confirm dialog.
 */

function bitesmart_lang_restart_dialog_defaults() {
    return array(
        'en' => array(
            'title'   => 'Change language?',
            'message' => 'The video will restart in {language}.',
            'confirm' => 'Switch to {language}',
            'cancel'  => 'Cancel',
            'targets' => array(
                'en' => 'English',
                'es' => 'Spanish',
                'hi' => 'Hindi',
            ),
        ),
        'es' => array(
            'title'   => '¿Cambiar idioma?',
            'message' => 'El video se reiniciará en {language}.',
            'confirm' => 'Cambiar a {language}',
            'cancel'  => 'Cancelar',
            'targets' => array(
                'en' => 'inglés',
                'es' => 'español',
                'hi' => 'hindi',
            ),
        ),
        'hi' => array(
            'title'   => 'भाषा बदलें?',
            'message' => 'वीडियो {language} में फिर से शुरू होगा।',
            'confirm' => '{language} में बदलें',
            'cancel'  => 'रद्द करें',
            'targets' => array(
                'en' => 'अंग्रेज़ी',
                'es' => 'स्पेनिश',
                'hi' => 'हिंदी',
            ),
        ),
    );
}

/**
 * @return array<string, array<string, mixed>>
 */
function bitesmart_get_lang_restart_dialog() {
    $defaults = bitesmart_lang_restart_dialog_defaults();
    $saved    = get_option( 'bitesmart_lang_restart_dialog', array() );

    if ( ! is_array( $saved ) ) {
        return $defaults;
    }

    $merged = array();

    foreach ( $defaults as $code => $default_row ) {
        $row = isset( $saved[ $code ] ) && is_array( $saved[ $code ] )
            ? $saved[ $code ]
            : array();

        $targets_default = $default_row['targets'] ?? array();
        $targets_saved   = isset( $row['targets'] ) && is_array( $row['targets'] )
            ? $row['targets']
            : array();

        $merged[ $code ] = array(
            'title'   => isset( $row['title'] ) ? (string) $row['title'] : $default_row['title'],
            'message' => isset( $row['message'] ) ? (string) $row['message'] : $default_row['message'],
            'confirm' => isset( $row['confirm'] ) ? (string) $row['confirm'] : $default_row['confirm'],
            'cancel'  => isset( $row['cancel'] ) ? (string) $row['cancel'] : $default_row['cancel'],
            'targets' => array_merge( $targets_default, $targets_saved ),
        );
    }

    return apply_filters( 'bitesmart_lang_restart_dialog', $merged );
}

/**
 * @param mixed $input Raw request body.
 * @return array<string, array<string, mixed>>
 */
function bitesmart_sanitize_lang_restart_dialog( $input ) {
    $defaults = bitesmart_lang_restart_dialog_defaults();
    $output   = array();

    if ( ! is_array( $input ) ) {
        return $defaults;
    }

    foreach ( $defaults as $code => $default_row ) {
        $row = isset( $input[ $code ] ) && is_array( $input[ $code ] ) ? $input[ $code ] : array();

        $targets_out = array();
        $targets_in  = isset( $row['targets'] ) && is_array( $row['targets'] ) ? $row['targets'] : array();

        foreach ( $default_row['targets'] as $target_code => $target_default ) {
            $targets_out[ $target_code ] = isset( $targets_in[ $target_code ] )
                ? sanitize_text_field( (string) $targets_in[ $target_code ] )
                : $target_default;
        }

        $output[ $code ] = array(
            'title'   => isset( $row['title'] )
                ? sanitize_text_field( (string) $row['title'] )
                : $default_row['title'],
            'message' => isset( $row['message'] )
                ? sanitize_text_field( (string) $row['message'] )
                : $default_row['message'],
            'confirm' => isset( $row['confirm'] )
                ? sanitize_text_field( (string) $row['confirm'] )
                : $default_row['confirm'],
            'cancel'  => isset( $row['cancel'] )
                ? sanitize_text_field( (string) $row['cancel'] )
                : $default_row['cancel'],
            'targets' => $targets_out,
        );
    }

    return $output;
}

function bitesmart_rest_get_lang_restart_dialog() {
    return rest_ensure_response( bitesmart_get_lang_restart_dialog() );
}

function bitesmart_rest_update_lang_restart_dialog( WP_REST_Request $request ) {
    $sanitized = bitesmart_sanitize_lang_restart_dialog( $request->get_json_params() );
    update_option( 'bitesmart_lang_restart_dialog', $sanitized, false );

    return rest_ensure_response( $sanitized );
}

function bitesmart_register_lang_restart_dialog_routes() {
    register_rest_route(
        'bitesmart/v1',
        '/lang-restart-dialog',
        array(
            array(
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => 'bitesmart_rest_get_lang_restart_dialog',
                'permission_callback' => function () {
                    return current_user_can( 'edit_posts' );
                },
            ),
            array(
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => 'bitesmart_rest_update_lang_restart_dialog',
                'permission_callback' => function () {
                    return current_user_can( 'edit_posts' );
                },
            ),
        )
    );
}

add_action( 'rest_api_init', 'bitesmart_register_lang_restart_dialog_routes' );

function bitesmart_localize_lang_restart_dialog_editor() {
    if ( ! function_exists( 'generate_block_asset_handle' ) ) {
        return;
    }

    $handle = generate_block_asset_handle( 'custom/episode-card', 'editorScript' );

    if ( ! wp_script_is( $handle, 'registered' ) ) {
        return;
    }

    wp_localize_script(
        $handle,
        'bitesmartLangRestartDialog',
        array(
            'saved'    => bitesmart_get_lang_restart_dialog(),
            'defaults' => bitesmart_lang_restart_dialog_defaults(),
        )
    );
}

add_action( 'enqueue_block_editor_assets', 'bitesmart_localize_lang_restart_dialog_editor', 21 );
