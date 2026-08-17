<?php
/**
 * REST endpoint for logging zero-result searches from custom/learning-search.
 *
 * Kept as its own file rather than folded into learning-search.php — the
 * two have different lifecycles/hooks (rest_api_init here vs a block
 * render_callback there) and different reasons to change (request
 * validation/abuse-hardening here vs card-rendering/caching there).
 *
 * This is the ONLY REST route in either plugin — custom/learning-search's
 * own search is otherwise entirely client-side (see view.js's header
 * comment), so this route exists purely to let the front end tell the
 * server "this search came up empty," nothing else.
 *
 * Storage lives in the sibling content-model plugin: this file validates/
 * sanitizes the incoming request, then hands off to
 * bitesmart_search_log_record() (custom-post-types-for-bbs/includes/search-log-cpt.php),
 * which does the actual find-or-increment against the search_log CPT.
 *
 * Abuse hardening (added after a shared-hosting DB-growth concern Janet
 * raised): the nonce check alone stops a bot that never loads the page,
 * but a nonce isn't single-use or IP-bound, so a bot that HAS loaded the
 * page once can still replay it. The real growth risk is a bot that varies
 * the search term on every request — that skips right past
 * bitesmart_search_log_record()'s same-term dedup and creates a brand-new
 * row every time. Two layers here on top of the nonce: a per-IP request
 * rate limit (below), and a same-origin Referer check. A third layer — a
 * SITEWIDE cap on brand-new rows per hour, which also protects against a
 * distributed/many-IP bot swarm — lives in bitesmart_search_log_record()
 * itself (search-log-cpt.php), since that's where "is this actually a new
 * row" is already being decided. All of these fail closed but silently:
 * the only effect of any of them rejecting a request is "this one search
 * doesn't get logged," never a visible error (view.js never reads the
 * response either way).
 */

define( 'BITESMART_ZERO_RESULT_LOG_MAX_PER_IP_PER_HOUR', 20 );

function bitesmart_register_zero_result_log_route() {
    register_rest_route( 'bitesmart/v1', '/zero-result-search', array(
        'methods'             => 'POST',
        'callback'            => 'bitesmart_zero_result_log_handle_request',
        'permission_callback' => 'bitesmart_zero_result_log_permission_check',
        'args'                => array(
            'term'  => array(
                'required'          => true,
                'type'              => 'string',
                'validate_callback' => 'bitesmart_validate_zero_result_term',
                'sanitize_callback' => 'bitesmart_sanitize_zero_result_term',
            ),
            'stage' => array(
                'required'          => true,
                'type'              => 'string',
                'validate_callback' => 'bitesmart_validate_zero_result_stage',
                'sanitize_callback' => 'sanitize_title',
            ),
            'lang'  => array(
                'required'          => true,
                'type'              => 'string',
                // bitesmart_normalize_lang_code() (site-lang.php) already
                // validates against bitesmart_site_languages() and falls
                // back to 'en' for anything unrecognized — reused as-is
                // rather than duplicating that check here.
                'sanitize_callback' => 'bitesmart_normalize_lang_code',
            ),
        ),
    ) );
}
add_action( 'rest_api_init', 'bitesmart_register_zero_result_log_route' );

/**
 * Must allow anonymous/logged-out visitors — this fires from the public
 * search box, not wp-admin. WordPress's automatic cookie-based X-WP-Nonce
 * enforcement (rest_cookie_check_errors()) only activates when the request
 * carries a valid auth cookie, which a logged-out visitor never has, so
 * that automatic check is a silent no-op here and provides zero
 * protection by default. To get any nonce-based same-origin/replay
 * protection at all for an anonymous POST, it has to be checked manually.
 *
 * Three checks, cheapest/most-decisive first: nonce, then same-origin
 * Referer, then the per-IP rate limit (a transient read/write, so left
 * for last since it's the only one that costs a write on every request).
 * Any of them failing fails closed but silently — see the file header
 * comment for why that's the accepted tradeoff here.
 */
function bitesmart_zero_result_log_permission_check( $request ) {
    $nonce = $request->get_header( 'X-WP-Nonce' );

    if ( ! $nonce || ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
        return new WP_Error(
            'bitesmart_zero_result_log_invalid_nonce',
            __( 'Invalid or missing nonce.', 'custom-blocks' ),
            array( 'status' => 403 )
        );
    }

    if ( ! bitesmart_zero_result_log_same_origin() ) {
        return new WP_Error(
            'bitesmart_zero_result_log_bad_origin',
            __( 'Request rejected.', 'custom-blocks' ),
            array( 'status' => 403 )
        );
    }

    if ( bitesmart_zero_result_log_rate_limited( bitesmart_zero_result_log_client_ip() ) ) {
        return new WP_Error(
            'bitesmart_zero_result_log_rate_limited',
            __( 'Too many requests.', 'custom-blocks' ),
            array( 'status' => 429 )
        );
    }

    return true;
}

/**
 * Cheap bot friction, not a real security boundary (a determined bot can
 * forge a Referer header same as anything else) — only rejects a Referer
 * that's PRESENT and points somewhere else, never a MISSING one. Some
 * privacy-focused browsers/extensions strip Referer even on same-origin
 * requests, so treating "missing" as "reject" would silently lose real
 * visitor data for no real security gain; treating it as "no signal
 * either way, let the other checks decide" is the safer trade here.
 */
function bitesmart_zero_result_log_same_origin() {
    if ( empty( $_SERVER['HTTP_REFERER'] ) ) {
        return true;
    }

    $referer_host = wp_parse_url( esc_url_raw( wp_unslash( $_SERVER['HTTP_REFERER'] ) ), PHP_URL_HOST );
    $site_host    = wp_parse_url( home_url(), PHP_URL_HOST );

    return ! $referer_host || ! $site_host || strtolower( $referer_host ) === strtolower( $site_host );
}

/**
 * This site has no CDN/reverse proxy in front of it (confirmed with Janet,
 * 2026-08) — REMOTE_ADDR is the real visitor IP here. If a CDN/proxy is
 * ever added later, this needs to read ITS trusted forwarded-for header
 * instead (e.g. CF-Connecting-IP for Cloudflare) — a header the proxy
 * itself sets is safe to trust; a client-supplied X-Forwarded-For is NOT
 * (trivially spoofable), so don't just switch to reading that blindly.
 */
function bitesmart_zero_result_log_client_ip() {
    return isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
}

/**
 * A rolling per-IP request counter via a plain transient — no new table,
 * self-expiring, no cleanup needed. The window slides rather than resets
 * on a fixed clock hour (every counted request extends the expiry by
 * another hour), which is a deliberately simple/approximate throttle, not
 * a precise one — good enough for blunting a scripted burst.
 */
function bitesmart_zero_result_log_rate_limited( $ip ) {
    if ( ! $ip ) {
        // Can't identify a source to throttle — fail OPEN here specifically,
        // since the nonce + same-origin checks above already ran, and the
        // sitewide new-entry cap in bitesmart_search_log_record() is the
        // real backstop against unbounded growth regardless of source.
        return false;
    }

    $key   = 'bitesmart_zrl_ip_' . md5( $ip );
    $count = (int) get_transient( $key );

    if ( $count >= BITESMART_ZERO_RESULT_LOG_MAX_PER_IP_PER_HOUR ) {
        return true;
    }

    set_transient( $key, $count + 1, HOUR_IN_SECONDS );

    return false;
}

/**
 * Rejects empty/whitespace-only or too-short terms — mirrors the client's
 * own MIN_QUERY_LENGTH (view.js) so a term that would never even trigger a
 * Fuse search client-side can't be logged either.
 */
function bitesmart_validate_zero_result_term( $value, $request, $param ) {
    if ( ! is_string( $value ) ) {
        return new WP_Error( 'rest_invalid_param', __( 'term must be a string.', 'custom-blocks' ), array( 'status' => 400 ) );
    }

    $trimmed = trim( wp_strip_all_tags( $value ) );

    if ( mb_strlen( $trimmed ) < 2 ) {
        return new WP_Error( 'rest_invalid_param', __( 'term is too short to log.', 'custom-blocks' ), array( 'status' => 400 ) );
    }

    return true;
}

/**
 * Trims, strips tags, and hard-caps length — post_title/post_name storage
 * has no practical reason to hold more than a search box's worth of text,
 * and capping here keeps a malicious/broken client from writing arbitrarily
 * large log entries.
 */
function bitesmart_sanitize_zero_result_term( $value ) {
    $clean = trim( sanitize_text_field( (string) $value ) );

    if ( mb_strlen( $clean ) > 200 ) {
        $clean = mb_substr( $clean, 0, 200 );
    }

    return $clean;
}

/**
 * Must resolve to a real, currently-existing Stage term — rejects junk
 * stage values so the admin column lookup in search-log-cpt.php always has
 * a real term to display and the log can't be polluted with slugs that
 * were never a legitimate Stage.
 */
function bitesmart_validate_zero_result_stage( $value, $request, $param ) {
    $slug = sanitize_title( (string) $value );

    if ( ! $slug || ! get_term_by( 'slug', $slug, 'stage' ) ) {
        return new WP_Error( 'rest_invalid_param', __( 'stage must be a known Stage slug.', 'custom-blocks' ), array( 'status' => 400 ) );
    }

    return true;
}

function bitesmart_zero_result_log_handle_request( $request ) {
    $result = bitesmart_search_log_record(
        $request->get_param( 'term' ),
        $request->get_param( 'stage' ),
        $request->get_param( 'lang' )
    );

    if ( is_wp_error( $result ) ) {
        return new WP_Error( 'bitesmart_search_log_failed', __( 'Could not record search.', 'custom-blocks' ), array( 'status' => 500 ) );
    }

    return rest_ensure_response( array( 'logged' => true ) );
}
