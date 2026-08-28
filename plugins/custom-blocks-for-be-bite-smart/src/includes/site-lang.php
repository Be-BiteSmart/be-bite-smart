<?php

/**
 * Strip a full WP/TranslatePress locale (e.g. "es_ES", "hi_IN") down to its
 * short primary subtag (e.g. "es", "hi") — no validation against a known-
 * language list. Deliberately separate from bitesmart_normalize_lang_code(),
 * which validates against bitesmart_site_languages() and would recurse
 * infinitely if called from inside bitesmart_site_languages() itself.
 */
function bitesmart_short_lang_code( $full_code ) {
    $full_code = strtolower( str_replace( '_', '-', (string) $full_code ) );
    if ( $full_code === '' ) {
        return 'en';
    }
    return explode( '-', $full_code )[0];
}

/**
 * Site languages for episode videos, download cards, etc.
 *
 * Sourced from TranslatePress's published languages when TP is active
 * (see trp_get_languages() in translatepress-multilingual/includes/functions.php),
 * so a new site language automatically becomes available for video content —
 * no code change needed. The "bitesmart_video_languages" option (managed via
 * Settings > Video Languages) supplies an optional "label" override only
 * (the picker's short pill abbreviation) — it's never a gate; every
 * TP-published language is included regardless of whether it has an
 * override. Watch-button text is no longer per-language here — it's a
 * plain static string translated normally by TranslatePress, the same way
 * as any other on-page copy (see episode-card/index.js, video-quote.php).
 *
 * Falls back to a hardcoded en/es/hi set if TranslatePress isn't active, so
 * the plugin keeps working out of the box.
 *
 * @return array<int, array{code: string, label: string, name: string, analytics: string}>
 */
function bitesmart_site_languages() {
    if ( function_exists( 'trp_get_languages' ) ) {
        $overrides   = get_option( 'bitesmart_video_languages', array() );
        $languages   = array();
        $seen_codes  = array(); // guards against the dedup bug below

        foreach ( trp_get_languages() as $full_code => $name ) {
            $short_code = bitesmart_short_lang_code( $full_code );

            // trp_get_languages() returns one entry per full TranslatePress
            // locale (e.g. "en_US", "es_ES", "es_MX") — if a site has more
            // than one regional variant of the same language configured,
            // bitesmart_short_lang_code() collapses them to the SAME short
            // code, and without this guard every per-language field on the
            // site (Vimeo URL, Keywords/Synonyms, etc. — everything that
            // calls bitesmart_site_languages()/getSiteLanguages()) would
            // render one duplicate row per extra regional variant. First
            // configured locale for a given short code wins.
            if ( isset( $seen_codes[ $short_code ] ) ) {
                continue;
            }
            $seen_codes[ $short_code ] = true;

            $override = isset( $overrides[ $short_code ] ) ? $overrides[ $short_code ] : array();

            $languages[] = array(
                'code'       => $short_code,
                'label'      => ! empty( $override['label'] ) ? $override['label'] : strtoupper( $short_code ),
                'name'       => $name,
                'analytics'  => sanitize_title( $name ),
            );
        }

        if ( ! empty( $languages ) ) {
            return apply_filters( 'bitesmart_site_languages', $languages );
        }
    }

    // Fallback — TranslatePress inactive: keep the plugin fully functional
    // out of the box with a hardcoded set.
    $languages = array(
        array(
            'code'      => 'en',
            'label'     => 'EN',
            'name'      => 'English',
            'analytics' => 'english',
        ),
        array(
            'code'      => 'es',
            'label'     => 'ES',
            'name'      => 'Spanish',
            'analytics' => 'spanish',
        ),
        array(
            'code'      => 'hi',
            'label'     => 'HI',
            'name'      => 'Hindi',
            'analytics' => 'hindi',
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
 * Human-readable name for a language code (e.g. "Spanish"), in the site's
 * own base (non-translated) copy of bitesmart_site_languages(). Used only
 * for the very first, pre-JS render of the play-button label — see
 * bitesmart_play_button_label() below and setPlayButtonLabel() in
 * video-toggle.js, which takes over after that using the same wrapper
 * string with the same {language} placeholder, substituted with the
 * TranslatePress-translated langName() instead.
 */
function bitesmart_lang_name( $code ) {
    $code = bitesmart_normalize_lang_code( $code );

    foreach ( bitesmart_site_languages() as $lang ) {
        if ( $lang['code'] === $code ) {
            return $lang['name'];
        }
    }

    return $code;
}

/**
 * Initial play-button label, e.g. "Play (English)" — computed server-side so
 * it's correct on first paint, before video-toggle.js's setPlayButtonLabel()
 * takes over keeping it in sync with the picker. Deliberately uses the same
 * "Play ({language})" wrapper string (with the same {language} placeholder
 * syntax, substituted here via str_replace() instead of JS's
 * applyLanguagePlaceholder()) as bitesmart_render_play_button_label_templates()
 * — one translatable string shared by both the PHP and JS render paths,
 * rather than two independently-translated near-duplicates that could drift
 * out of sync with each other.
 *
 * @param string $active_code Currently-active language code.
 * @param bool   $has_picker  Whether this block actually renders a language
 *                            picker (2+ languages) — with only one language
 *                            there's nothing to disambiguate, so the label
 *                            stays a plain "Play".
 */
function bitesmart_play_button_label( $active_code, $has_picker ) {
    if ( ! $has_picker ) {
        return __( 'Play', 'custom-blocks' );
    }

    return str_replace(
        '{language}',
        bitesmart_lang_name( $active_code ),
        __( 'Play ({language})', 'custom-blocks' )
    );
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
 * Convert a lang code => Vimeo URL map into a lang code => Vimeo ID map,
 * dropping any entry whose URL doesn't resolve to a numeric Vimeo ID.
 *
 * Shared by the legacy episode-card render_block filter (via
 * bitesmart_episode_vimeo_ids_from_attrs() below) and the CPT-backed
 * `custom/episode` block's render_callback — both need the exact same
 * URL-to-ID resolution, just starting from a different source of the
 * lang-code => URL map.
 *
 * @param array<string, mixed> $videos_by_lang Lang code => Vimeo URL.
 * @return array<string, string> Lang code => Vimeo ID.
 */
function bitesmart_vimeo_ids_by_lang_map( array $videos_by_lang ) {
    $videos = array();

    foreach ( $videos_by_lang as $code => $url ) {
        $id = bitesmart_vimeo_id_from_url( $url );
        if ( $id ) {
            $videos[ (string) $code ] = $id;
        }
    }

    return $videos;
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
        $videos = bitesmart_vimeo_ids_by_lang_map( $attrs['videosByLang'] );
    }

    if ( empty( $videos ) ) {
        $legacy = array(
            'en' => $attrs['vimeoUrlEn'] ?? '',
            'es' => $attrs['vimeoUrlEs'] ?? '',
        );
        $videos = bitesmart_vimeo_ids_by_lang_map( $legacy );
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
 * Registers a wp_footer hook to print the shared, TranslatePress-
 * translatable language-name templates (.video-quote-lang-name[data-lang])
 * exactly once per page. Shared by video-quote's track-note messages and
 * episode-card's language-restart dialog — both need "what is language X
 * called" without hardcoding a per-language name dictionary.
 */
function bitesmart_needs_video_lang_name_templates() {
    static $needed = false;
    if ( $needed ) {
        return;
    }
    $needed = true;
    add_action( 'wp_footer', 'bitesmart_render_video_lang_name_templates' );
}

/**
 * display:none is inline (not a stylesheet class) on every template block
 * in this file so they're hidden from assistive tech and sighted users
 * from the very first byte of HTML, with no dependency on a separate CSS
 * file loading first.
 */
function bitesmart_render_video_lang_name_templates() {
    ?>
    <div class="video-lang-name-templates" aria-hidden="true" style="display:none;">
        <?php foreach ( bitesmart_site_languages() as $lang ) : ?>
            <span class="video-quote-lang-name" data-lang="<?php echo esc_attr( $lang['code'] ); ?>"><?php echo esc_html( $lang['name'] ); ?></span>
        <?php endforeach; ?>
    </div>
    <?php
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
    bitesmart_needs_video_lang_name_templates();
    add_action( 'wp_footer', 'bitesmart_render_video_quote_track_note_templates' );
}

/**
 * Visually hidden, TranslatePress-translatable source of truth for the
 * video-quote live-track-switch note (see switchLiveTrack()/showTrackNote()
 * in video-toggle.js). Real gettext calls (esc_html_e) so TranslatePress's
 * String Translation interface picks them up the same way it already
 * handles the rest of this block's static copy — dynamic JS-built strings
 * aren't reliably translatable by TranslatePress, but static HTML is.
 */
function bitesmart_render_video_quote_track_note_templates() {
    ?>
    <div class="video-quote-track-note-templates" aria-hidden="true" style="display:none;">
        <span class="video-quote-track-note-template" data-kind="total"><?php esc_html_e( '{language} isn\'t available for this video yet.', 'custom-blocks' ); ?></span>
        <span class="video-quote-track-note-template" data-kind="audio-missing"><?php esc_html_e( '{language} captions are on, but dubbed audio isn\'t available yet for this video.', 'custom-blocks' ); ?></span>
        <span class="video-quote-track-note-template" data-kind="captions-missing"><?php esc_html_e( '{language} audio is on, but captions aren\'t available yet for this video.', 'custom-blocks' ); ?></span>
    </div>
    <?php
}

/**
 * Registers a wp_footer hook to print the play-button label template,
 * exactly once, on any page that renders a multi-language episode or
 * video-quote block. Shared by both blocks' play buttons (see
 * setPlayButtonLabel() in video-toggle.js), which always name the
 * currently-selected language next to the "Play" verb — e.g. "Play
 * (Spanish)" — so the button itself confirms the picker's current state,
 * even before the visitor presses play.
 */
function bitesmart_needs_play_button_label_template() {
    static $needed = false;
    if ( $needed ) {
        return;
    }
    $needed = true;
    bitesmart_needs_video_lang_name_templates();
    add_action( 'wp_footer', 'bitesmart_render_play_button_label_templates' );
}

/**
 * Visually hidden, TranslatePress-translatable source of truth for the play
 * button's language-aware label (see setPlayButtonLabel() in
 * video-toggle.js). The {language} placeholder is substituted client-side
 * with langName() — never a hardcoded per-language string — so the
 * surrounding "Play (...)" phrase stays in the site's own displayed
 * language while only the language name changes. That's the deliberate
 * difference from the old per-language watch-button text this replaces
 * (see CHANGES.md, "Watch button text simplified"): that version translated
 * the whole button into the target language's own script, which didn't
 * help a visitor who clicked the wrong pill by accident; this version keeps
 * the button legible in the site's own language at all times.
 */
function bitesmart_render_play_button_label_templates() {
    ?>
    <div class="play-button-label-templates" aria-hidden="true" style="display:none;">
        <span class="play-button-label-template"><?php esc_html_e( 'Play ({language})', 'custom-blocks' ); ?></span>
    </div>
    <?php
}

/**
 * Registers a wp_footer hook to print the transient "language changed"
 * status template, exactly once, on any page that renders a multi-language
 * episode or video-quote block. Shared by both blocks' language pickers
 * (see showLangChangeStatus() in video-toggle.js) — a brief, accessible
 * confirmation next to the picker right after a genuinely successful
 * switch. Never shown alongside video-quote's existing
 * .video-quote-track-note (a failed/partial live track swap shows that
 * instead — see showLangChangeStatus()'s call sites in video-toggle.js).
 */
function bitesmart_needs_lang_change_status_template() {
    static $needed = false;
    if ( $needed ) {
        return;
    }
    $needed = true;
    bitesmart_needs_video_lang_name_templates();
    add_action( 'wp_footer', 'bitesmart_render_lang_change_status_templates' );
}

/**
 * Visually hidden, TranslatePress-translatable source of truth for the
 * transient language-change status line (see showLangChangeStatus() in
 * video-toggle.js).
 */
function bitesmart_render_lang_change_status_templates() {
    ?>
    <div class="lang-change-status-templates" aria-hidden="true" style="display:none;">
        <span class="lang-change-status-template"><?php esc_html_e( 'Switched to {language}.', 'custom-blocks' ); ?></span>
    </div>
    <?php
}

/**
 * Registers a wp_footer hook to print the episode-card language-restart
 * confirmation dialog's wording, exactly once, only on pages that render a
 * multi-language episode-card block.
 */
function bitesmart_episode_needs_lang_restart_templates() {
    static $needed = false;
    if ( $needed ) {
        return;
    }
    $needed = true;
    bitesmart_needs_video_lang_name_templates();
    add_action( 'wp_footer', 'bitesmart_render_lang_restart_dialog_templates' );
}

/**
 * The dialog's base English wording. Also what Settings > Video Languages
 * shows as each field's placeholder, so an admin editing there can see
 * exactly what they're overriding.
 *
 * @return array{title: string, message: string, confirm: string, cancel: string}
 */
function bitesmart_lang_restart_dialog_defaults() {
    return array(
        'title'   => __( 'Change language?', 'custom-blocks' ),
        'message' => __( 'The video will restart in {language}.', 'custom-blocks' ),
        'confirm' => __( 'Switch to {language}', 'custom-blocks' ),
        'cancel'  => __( 'Cancel', 'custom-blocks' ),
    );
}

/**
 * Merge the admin-entered overrides (Settings > Video Languages, option
 * bitesmart_lang_restart_dialog_text) over the defaults — any field left
 * blank on that page just keeps the default wording.
 *
 * @return array{title: string, message: string, confirm: string, cancel: string}
 */
function bitesmart_lang_restart_dialog_copy() {
    $defaults  = bitesmart_lang_restart_dialog_defaults();
    $overrides = get_option( 'bitesmart_lang_restart_dialog_text', array() );

    $copy = array();
    foreach ( $defaults as $key => $default ) {
        $copy[ $key ] = ! empty( $overrides[ $key ] ) ? $overrides[ $key ] : $default;
    }

    return $copy;
}

/**
 * Visually hidden, TranslatePress-translatable source of truth for the
 * episode-card language-restart confirmation dialog (see
 * video-lang-restart-modal.js). Always shows in the page's own site
 * language (translated normally by TranslatePress) rather than whichever
 * language happened to be playing — that's what makes this translatable at
 * all, since TranslatePress translates per the visitor's chosen site
 * language and has no way to show a fixed, language-locked variant
 * independent of that.
 *
 * Wording itself (not its translation) can be overridden on Settings >
 * Video Languages — the base text stays TranslatePress-translatable either
 * way, since TP just translates whatever ends up in this rendered HTML,
 * default or overridden. Changing the base text does mean any existing
 * translations of the OLD wording become orphaned and need redoing —
 * inherent to any editable-source-text setup, not specific to this one.
 */
function bitesmart_render_lang_restart_dialog_templates() {
    $copy = bitesmart_lang_restart_dialog_copy();
    ?>
    <div class="lang-restart-dialog-templates" aria-hidden="true" style="display:none;">
        <span class="lang-restart-dialog-title"><?php echo esc_html( $copy['title'] ); ?></span>
        <span class="lang-restart-dialog-message"><?php echo esc_html( $copy['message'] ); ?></span>
        <span class="lang-restart-dialog-confirm"><?php echo esc_html( $copy['confirm'] ); ?></span>
        <span class="lang-restart-dialog-cancel"><?php echo esc_html( $copy['cancel'] ); ?></span>
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
 * Inject runtime data on episode-card output (site lang, video map).
 */
function bitesmart_episode_card_render( $block_content, $block ) {
    if ( ( $block['blockName'] ?? '' ) !== 'custom/episode-card' ) {
        return $block_content;
    }

    if ( ! is_string( $block_content ) || $block_content === '' ) {
        return $block_content;
    }

    $attrs     = $block['attrs'] ?? array();
    $video_ids = bitesmart_episode_vimeo_ids_from_attrs( $attrs );
    $site_lang = bitesmart_site_lang_code();

    if ( count( $video_ids ) > 1 ) {
        bitesmart_episode_needs_lang_restart_templates();
    }

    $replacements = array(
        'data-site-lang' => esc_attr( $site_lang ),
        'data-videos'    => esc_attr( wp_json_encode( $video_ids ) ),
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
 * Editor: pass site language config into episode-card, video-quote,
 * episode-fields, resource-fields, AND qa-entry-fields scripts, so each
 * block's per-language UI (Available Languages checkboxes, the Vimeo URL
 * field per language, or the Keywords/Synonyms field per language)
 * reflects bitesmart_site_languages() (TranslatePress-derived) instead of
 * falling back to the hardcoded DEFAULT_SITE_LANGUAGES in shared/languages.js.
 */
function bitesmart_localize_video_language_editors() {
    if ( ! function_exists( 'generate_block_asset_handle' ) ) {
        return;
    }

    $languages = array();
    foreach ( bitesmart_site_languages() as $lang ) {
        $languages[] = array(
            'code'      => $lang['code'],
            'label'     => $lang['label'],
            'name'      => $lang['name'],
            'analytics' => $lang['analytics'],
        );
    }

    $block_names = array(
        'custom/episode-card',
        'custom/video-quote',
        'custom/episode-fields',
        'custom/resource-fields',
        'custom/qa-entry-fields',
        'custom/coloring-book-fields',
    );

    foreach ( $block_names as $block_name ) {
        $handle = generate_block_asset_handle( $block_name, 'editorScript' );

        if ( ! wp_script_is( $handle, 'registered' ) ) {
            continue;
        }

        wp_localize_script(
            $handle,
            'bitesmartLanguages',
            array(
                'languages' => $languages,
            )
        );
    }
}

add_action( 'enqueue_block_editor_assets', 'bitesmart_localize_video_language_editors', 20 );
