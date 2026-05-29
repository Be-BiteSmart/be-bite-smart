<?php

/**
 * Current site UI language as en|es (TranslatePress when available).
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

    $lang = strtolower( str_replace( '_', '-', (string) $lang ) );

    if ( str_starts_with( $lang, 'es' ) ) {
        return 'es';
    }

    return 'en';
}

/**
 * Static episode-card HTML is saved with EN active; inject data-site-lang at render time.
 */
function bitesmart_episode_card_add_site_lang( $block_content, $block ) {
    if ( ( $block['blockName'] ?? '' ) !== 'custom/episode-card' ) {
        return $block_content;
    }

    if ( ! is_string( $block_content ) || $block_content === '' ) {
        return $block_content;
    }

    $lang = bitesmart_site_lang_code();

    if ( preg_match( '/\bdata-site-lang=/', $block_content ) ) {
        return $block_content;
    }

    $updated = preg_replace(
        '/(<article\b[^>]*\bclass="[^"]*\bvideo-episode-block\b[^"]*")/i',
        '$1 data-site-lang="' . esc_attr( $lang ) . '"',
        $block_content,
        1
    );

    return is_string( $updated ) ? $updated : $block_content;
}

add_filter( 'render_block', 'bitesmart_episode_card_add_site_lang', 10, 2 );
