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
 * Normalize a video-quote block's availableLanguages attribute: keep only
 * known site-language codes, force 'en' present (it's always available),
 * and order the result to match bitesmart_site_languages().
 *
 * @param mixed $raw Raw availableLanguages attribute value.
 * @return array<int, string>
 */
function bitesmart_normalize_available_languages( $raw ) {
    $raw   = is_array( $raw ) ? $raw : array();
    $known = array_map(
        function ( $lang ) {
            return $lang['code'];
        },
        bitesmart_site_languages()
    );

    $codes = array_values( array_intersect( $known, $raw ) );
    if ( ! in_array( 'en', $codes, true ) ) {
        array_unshift( $codes, 'en' );
    }

    // Reorder to match bitesmart_site_languages() order.
    return array_values( array_intersect( $known, $codes ) );
}

/**
 * Registers a wp_footer hook to print the video-quote track-note templates,
 * exactly once, only on pages that actually render a multi-language
 * video-quote block. Static guard prevents double-registration when
 * multiple video-quote blocks are on the same page.
 */
function bitesmart_video_quote_needs_track_note_templates() {
    static $needed = false;
    if ( $needed ) {
        return;
    }
    $needed = true;
    add_action( 'wp_footer', 'bitesmart_render_video_quote_track_note_templates' );
}

/**
 * Visually hidden, TranslatePress-translatable source of truth for the
 * video-quote live-track-switch note (see switchLiveTrack()/showTrackNote()
 * in video-toggle.js). Real gettext calls (esc_html_e) so TranslatePress's
 * String Translation interface picks them up the same way it already
 * handles the rest of this block's static copy — dynamic JS-built strings
 * aren't reliably translatable by TranslatePress, but static HTML is.
 *
 * display:none is inline (not a stylesheet class) so this is hidden from
 * assistive tech and sighted users from the very first byte of HTML, with
 * no dependency on a separate CSS file loading first.
 */
function bitesmart_render_video_quote_track_note_templates() {
    ?>
    <div class="video-quote-track-note-templates" aria-hidden="true" style="display:none;">
        <?php foreach ( bitesmart_site_languages() as $lang ) : ?>
            <span class="video-quote-lang-name" data-lang="<?php echo esc_attr( $lang['code'] ); ?>"><?php echo esc_html( $lang['name'] ); ?></span>
        <?php endforeach; ?>

        <span class="video-quote-track-note-template" data-kind="total"><?php esc_html_e( '{language} isn\'t available for this video yet — staying on the current language.', 'custom-blocks' ); ?></span>
        <span class="video-quote-track-note-template" data-kind="audio-missing"><?php esc_html_e( '{language} captions are on, but dubbed audio isn\'t available yet for this video.', 'custom-blocks' ); ?></span>
        <span class="video-quote-track-note-template" data-kind="captions-missing"><?php esc_html_e( '{language} audio is on, but captions aren\'t available yet for this video.', 'custom-blocks' ); ?></span>
    </div>
    <?php
}

/**
 * Build the .episode-lang-picker / .lang-segments / .lang-segment[data-lang]
 * markup for a set of language codes. This is the PHP-side equivalent of
 * renderLanguagePicker() in episode-helpers.js — used by video-quote, which
 * is a dynamic (PHP-rendered) block with no JS save path of its own. Emits
 * the exact same classes/structure so video-toggle.js's generic
 * getLangPicker()/getLangSegments() helpers work unmodified.
 *
 * @param array<int, string> $codes       Language codes to show, in display order.
 * @param string             $active_code Which code starts active.
 * @return string HTML, or '' if fewer than 2 languages (matches episode-card behavior).
 */
function bitesmart_render_lang_picker_html( array $codes, $active_code = 'en' ) {
    if ( count( $codes ) <= 1 ) {
        return '';
    }

    $languages    = bitesmart_site_languages();
    $found_index  = array_search( $active_code, $codes, true );
    $active_index = false === $found_index ? 0 : $found_index;

    ob_start();
    ?>
    <div class="episode-lang-picker" data-translate="no"
         style="--lang-count: <?php echo (int) count( $codes ); ?>; --lang-index: <?php echo (int) $active_index; ?>;">
        <div class="lang-segment-slider"></div>
        <div class="lang-segments">
            <?php foreach ( $codes as $code ) :
                $meta  = null;
                foreach ( $languages as $lang ) {
                    if ( $lang['code'] === $code ) {
                        $meta = $lang;
                        break;
                    }
                }
                $label = $meta['label'] ?? strtoupper( $code );
                ?>
                <button type="button"
                        class="lang-segment<?php echo $code === $active_code ? ' active' : ''; ?>"
                        data-lang="<?php echo esc_attr( $code ); ?>">
                    <?php echo esc_html( $label ); ?>
                </button>
            <?php endforeach; ?>
        </div>
    </div>
    <?php
    return ob_get_clean();
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
 * Alt text from a media library attachment ID (empty when unset).
 */
function bitesmart_attachment_alt_text( $attachment_id ) {
    $id = (int) $attachment_id;
    if ( ! $id ) {
        return '';
    }

    $alt = get_post_meta( $id, '_wp_attachment_image_alt', true );

    return ( is_string( $alt ) && $alt !== '' ) ? $alt : '';
}

/**
 * Replace the alt attribute on the first <img> whose class contains $class_name.
 */
function bitesmart_replace_img_alt_by_class( $html, $class_name, $alt ) {
    $pattern = '/(<img\b[^>]*\bclass="[^"]*\b'
        . preg_quote( $class_name, '/' )
        . '\b[^"]*"[^>]*\balt=)(["\'])([^"\']*)\2/i';

    $updated = preg_replace( $pattern, '$1"' . esc_attr( $alt ) . '"', $html, 1 );

    return is_string( $updated ) ? $updated : $html;
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

    $thumbnail_id = $attrs['thumbnailId'] ?? 0;
    if ( $thumbnail_id && str_contains( $block_content, 'video-thumbnail' ) ) {
        $alt     = esc_attr( bitesmart_attachment_alt_text( $thumbnail_id ) );
        $updated = preg_replace(
            '/(<div class="video-thumbnail">\s*)(<img\b[^>]*\balt=)(["\'])([^"\']*)\3/i',
            '$1$2"' . $alt . '"',
            $block_content,
            1
        );
        if ( is_string( $updated ) ) {
            $block_content = $updated;
        }
    }

    $funded_logo_id = $attrs['fundedByLogoId'] ?? 0;
    if ( $funded_logo_id && str_contains( $block_content, 'episode-funded-by-logo' ) ) {
        $logo_alt      = bitesmart_attachment_alt_text( $funded_logo_id );
        $block_content = bitesmart_replace_img_alt_by_class(
            $block_content,
            'episode-funded-by-logo',
            $logo_alt
        );
        if ( $logo_alt !== '' ) {
            $block_content = preg_replace(
                '/(<img\b[^>]*\bclass="[^"]*\bepisode-funded-by-logo\b[^"]*"[^>]*)\s*aria-hidden="true"/i',
                '$1',
                $block_content,
                1
            );
        }
    }

    return $block_content;
}

add_filter( 'render_block', 'bitesmart_episode_card_render', 10, 2 );

/**
 * Outlet logos on news / press blocks — alt from Media Library only.
 */
function bitesmart_outlet_logo_alt_render( $block_content, $block ) {
    $block_name = $block['blockName'] ?? '';
    if ( ! in_array( $block_name, array( 'custom/news-and-coverage', 'custom/press-release' ), true ) ) {
        return $block_content;
    }

    if ( ! is_string( $block_content ) || $block_content === '' ) {
        return $block_content;
    }

    $logo_id = (int) ( $block['attrs']['logoId'] ?? 0 );
    if ( ! $logo_id || ! str_contains( $block_content, 'outlet-badge-logo' ) ) {
        return $block_content;
    }

    return bitesmart_replace_img_alt_by_class(
        $block_content,
        'outlet-badge-logo',
        bitesmart_attachment_alt_text( $logo_id )
    );
}

add_filter( 'render_block', 'bitesmart_outlet_logo_alt_render', 10, 2 );

/**
 * First heading text inside block HTML (for landmark labels).
 */
function bitesmart_first_heading_text_from_html( $html ) {
    if ( ! is_string( $html ) || $html === '' ) {
        return '';
    }

    if ( preg_match( '/<h[1-6]\b[^>]*>(.*?)<\/h[1-6]>/is', $html, $matches ) ) {
        $text = wp_strip_all_tags( $matches[1] );
        return trim( preg_replace( '/\s+/', ' ', $text ) );
    }

    return '';
}

/**
 * Group blocks rendered as <aside> need unique aria-labels (landmark-unique).
 */
function bitesmart_complementary_landmark_labels( $block_content, $block ) {
    if ( ( $block['blockName'] ?? '' ) !== 'core/group' ) {
        return $block_content;
    }

    if ( ( $block['attrs']['tagName'] ?? '' ) !== 'aside' ) {
        return $block_content;
    }

    if ( ! is_string( $block_content ) || $block_content === '' ) {
        return $block_content;
    }

    if ( ! str_contains( $block_content, '<aside' ) ) {
        return $block_content;
    }

    if ( preg_match( '/<aside\b[^>]*\baria-label="/i', $block_content ) ) {
        return $block_content;
    }

    if ( ! empty( $block['attrs']['ariaLabel'] ) ) {
        $label = $block['attrs']['ariaLabel'];
    } else {
        $label = bitesmart_first_heading_text_from_html( $block_content );
        if ( $label === '' ) {
            static $complementary_index = 0;
            $complementary_index++;
            $label = sprintf( 'Supplementary content %d', $complementary_index );
        }
    }

    $updated = preg_replace(
        '/(<aside\b)/i',
        '$1 aria-label="' . esc_attr( $label ) . '"',
        $block_content,
        1
    );

    return is_string( $updated ) ? $updated : $block_content;
}

add_filter( 'render_block', 'bitesmart_complementary_landmark_labels', 10, 2 );

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
