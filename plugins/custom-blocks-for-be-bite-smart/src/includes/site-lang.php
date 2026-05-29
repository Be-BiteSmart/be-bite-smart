<?php

/**
 * Site languages for episode videos, download cards, etc.
 *
 * @return array<int, array{code: string, label: string, name: string, watch_label: string, analytics: string}>
 */
function bitesmart_site_languages() {
    $languages = array(
        array(
            'code'       => 'en',
            'label'      => 'EN',
            'name'       => 'English',
            'watch_label' => 'Watch Now',
            'analytics'  => 'english',
        ),
        array(
            'code'       => 'es',
            'label'      => 'ES',
            'name'       => 'Spanish',
            'watch_label' => 'Ver Ahora',
            'analytics'  => 'spanish',
        ),
        array(
            'code'       => 'hi',
            'label'      => 'HI',
            'name'       => 'Hindi',
            'watch_label' => 'अभी देखें',
            'analytics'  => 'hindi',
        ),
    );

    return apply_filters( 'bitesmart_site_languages', $languages );
}

/**
 * Normalize a TranslatePress / WP locale string to a short language code.
 */
function bitesmart_normalize_lang_code( $locale ) {
    $locale = strtolower( str_replace( '_', '-', (string) $locale ) );
    if ( $locale === '' ) {
        return 'en';
    }

    $primary = explode( '-', $locale )[0];

    foreach ( bitesmart_site_languages() as $lang ) {
        if ( $lang['code'] === $primary ) {
            return $lang['code'];
        }
    }

    return 'en';
}

/**
 * Plausible / analytics suffix for a language code.
 */
function bitesmart_lang_analytics_name( $code ) {
    $code = bitesmart_normalize_lang_code( $code );

    foreach ( bitesmart_site_languages() as $lang ) {
        if ( $lang['code'] === $code ) {
            return $lang['analytics'];
        }
    }

    return $code;
}

/**
 * Current site UI language code (TranslatePress when available).
 */
function bitesmart_site_lang_code() {
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

    return bitesmart_normalize_lang_code( $lang );
}

/**
 * @param string $url Full Vimeo URL.
 * @return string|null Numeric Vimeo ID.
 */
function bitesmart_vimeo_id_from_url( $url ) {
    if ( ! is_string( $url ) || $url === '' ) {
        return null;
    }

    if ( preg_match( '/vimeo\.com\/(\d+)/', $url, $matches ) ) {
        return $matches[1];
    }

    return null;
}

/**
 * Build lang code => Vimeo ID map from episode-card block attributes.
 *
 * @param array<string, mixed> $attrs Block attributes.
 * @return array<string, string>
 */
function bitesmart_episode_vimeo_ids_from_attrs( $attrs ) {
    $videos = array();

    if ( ! empty( $attrs['videosByLang'] ) && is_array( $attrs['videosByLang'] ) ) {
        foreach ( $attrs['videosByLang'] as $code => $url ) {
            $id = bitesmart_vimeo_id_from_url( $url );
            if ( $id ) {
                $videos[ (string) $code ] = $id;
            }
        }
    }

    if ( empty( $videos ) ) {
        $legacy = array(
            'en' => $attrs['vimeoUrlEn'] ?? '',
            'es' => $attrs['vimeoUrlEs'] ?? '',
        );
        foreach ( $legacy as $code => $url ) {
            $id = bitesmart_vimeo_id_from_url( $url );
            if ( $id ) {
                $videos[ $code ] = $id;
            }
        }
    }

    return $videos;
}

/**
 * Watch-button labels keyed by language code for episode cards.
 *
 * @return array<string, string>
 */
function bitesmart_episode_watch_labels() {
    $labels = array();
    foreach ( bitesmart_site_languages() as $lang ) {
        $labels[ $lang['code'] ] = $lang['watch_label'];
    }
    return $labels;
}

/**
 * Inject runtime data on episode-card output (site lang, video map, watch labels).
 */
function bitesmart_episode_card_render( $block_content, $block ) {
    if ( ( $block['blockName'] ?? '' ) !== 'custom/episode-card' ) {
        return $block_content;
    }

    if ( ! is_string( $block_content ) || $block_content === '' ) {
        return $block_content;
    }

    $attrs       = $block['attrs'] ?? array();
    $video_ids   = bitesmart_episode_vimeo_ids_from_attrs( $attrs );
    $site_lang   = bitesmart_site_lang_code();
    $watch_labels = bitesmart_episode_watch_labels();

    $replacements = array(
        'data-site-lang'    => esc_attr( $site_lang ),
        'data-videos'       => esc_attr( wp_json_encode( $video_ids ) ),
        'data-watch-labels' => esc_attr( wp_json_encode( $watch_labels ) ),
    );

    foreach ( $replacements as $attr => $value ) {
        if ( preg_match( '/\b' . preg_quote( $attr, '/' ) . '=/', $block_content ) ) {
            $block_content = preg_replace(
                '/\b' . preg_quote( $attr, '/' ) . '="[^"]*"/',
                $attr . '="' . $value . '"',
                $block_content,
                1
            );
            continue;
        }

        $updated = preg_replace(
            '/(<article\b[^>]*\bclass="[^"]*\bvideo-episode-block\b[^"]*")/i',
            '$1 ' . $attr . '="' . $value . '"',
            $block_content,
            1
        );

        if ( is_string( $updated ) ) {
            $block_content = $updated;
        }
    }

    // Legacy saved HTML: data-vimeo-en / data-vimeo-es without data-videos in attrs comment edge cases.
    if ( empty( $video_ids ) && preg_match( '/\bdata-vimeo-en="/', $block_content ) ) {
        $legacy_ids = array();
        if ( preg_match( '/\bdata-vimeo-en="(\d+)"/', $block_content, $m ) ) {
            $legacy_ids['en'] = $m[1];
        }
        if ( preg_match( '/\bdata-vimeo-es="(\d+)"/', $block_content, $m ) ) {
            $legacy_ids['es'] = $m[1];
        }
        if ( ! empty( $legacy_ids ) && ! preg_match( '/\bdata-videos=/', $block_content ) ) {
            $block_content = preg_replace(
                '/(<article\b[^>]*\bclass="[^"]*\bvideo-episode-block\b[^"]*")/i',
                '$1 data-videos="' . esc_attr( wp_json_encode( $legacy_ids ) ) . '"',
                $block_content,
                1
            );
        }
    }

    return $block_content;
}

add_filter( 'render_block', 'bitesmart_episode_card_render', 10, 2 );

/**
 * Editor: pass site language config into episode-card script.
 */
function bitesmart_localize_episode_card_editor() {
    if ( ! function_exists( 'generate_block_asset_handle' ) ) {
        return;
    }

    $handle = generate_block_asset_handle( 'custom/episode-card', 'editorScript' );

    if ( ! wp_script_is( $handle, 'registered' ) ) {
        return;
    }

    $languages = array();
    foreach ( bitesmart_site_languages() as $lang ) {
        $languages[] = array(
            'code'        => $lang['code'],
            'label'       => $lang['label'],
            'name'        => $lang['name'],
            'watchLabel'  => $lang['watch_label'],
            'analytics'   => $lang['analytics'],
        );
    }

    wp_localize_script(
        $handle,
        'bitesmartLanguages',
        array(
            'languages' => $languages,
        )
    );
}

add_action( 'enqueue_block_editor_assets', 'bitesmart_localize_episode_card_editor', 20 );
