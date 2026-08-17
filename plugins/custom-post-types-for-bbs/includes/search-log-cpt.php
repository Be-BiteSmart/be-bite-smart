<?php
/**
 * Search Log — internal record of zero-result searches from
 * custom/learning-search (the Fuse.js search box on /learning/stages/*
 * pages), so Janet can see what content visitors are looking for that the
 * library doesn't cover yet. See [[be-bitesmart-content-hub-plan]] /
 * [[be-bitesmart-search-status]] in memory for that block's own history.
 *
 * A real CPT, not a custom $wpdb table — this codebase has no custom-table
 * precedent anywhere, and every other kind of structured data here is a
 * CPT, giving a free native wp-admin list-table UI (sortable columns) with
 * zero migration/dbDelta/activation-hook machinery.
 *
 * Unlike every other CPT in this plugin, this one is genuinely internal —
 * nobody hand-creates or hand-edits a Search Log entry (they're written
 * only by bitesmart_search_log_record(), called from the Custom Blocks
 * plugin's REST endpoint, src/learning-search/zero-result-log.php), so it
 * intentionally skips both 'editor' and 'custom-fields' support: those are
 * only needed for the block editor to load at all and for registered meta
 * to appear in the REST posts controller's schema (see the CPT gotchas
 * documented on Episode/Coloring Book) — irrelevant here since meta is
 * written directly via update_post_meta() from trusted server-side PHP,
 * never through wp_insert_post()/wp_update_post() REST payloads.
 *
 * One post per unique (term, stage, lang) combo — repeats increment a
 * "times searched" count rather than creating duplicate rows.
 *
 * Abuse hardening (added after a shared-hosting DB-growth concern Janet
 * raised): a bot varying its search term on every request skips right
 * past the same-term dedup above and would otherwise create an unbounded
 * number of new rows. This file owns the SITEWIDE backstop against that —
 * a rolling cap on brand-new rows per hour (see
 * bitesmart_search_log_new_entry_cap_reached(), used inside
 * bitesmart_search_log_record() below) — which also covers a distributed
 * bot swarm across many IPs, on top of the per-IP request rate limit that
 * lives in the Custom Blocks plugin's zero-result-log.php (the primary
 * defense; this is the backstop). It also owns a daily prune of stale
 * one-off entries so the table stays bounded long-term regardless of
 * traffic source (bitesmart_search_log_prune_stale_entries()).
 */

define( 'BITESMART_SEARCH_LOG_MAX_NEW_PER_HOUR', 300 );
define( 'BITESMART_SEARCH_LOG_PRUNE_AFTER_DAYS', 30 );

function bitesmart_register_search_log_post_type() {
    register_post_type( 'search_log', array(
        'labels'              => array(
            'name'          => __( 'Search Logs', 'custom-post-types-for-bbs' ),
            'singular_name' => __( 'Search Log', 'custom-post-types-for-bbs' ),
            'search_items'  => __( 'Search Search Logs', 'custom-post-types-for-bbs' ),
            'not_found'     => __( 'No zero-result searches recorded yet', 'custom-post-types-for-bbs' ),
            'all_items'     => __( 'Search Logs', 'custom-post-types-for-bbs' ),
        ),
        // Title only — see the file header comment for why 'editor' and
        // 'custom-fields' are both deliberately omitted here, unlike every
        // other CPT in this plugin.
        'supports'            => array( 'title' ),
        'public'              => false,
        'publicly_queryable'  => false,
        // Unlike the other headless CPTs (which only surface via their
        // locked fields-editing block), Janet needs to actually browse
        // these in wp-admin — that's the whole point of this feature — so
        // show_ui/show_in_menu are true here even though nothing else about
        // this post type is public-facing.
        'show_ui'             => true,
        'show_in_menu'        => true,
        'show_in_admin_bar'   => false,
        'show_in_nav_menus'   => false,
        'exclude_from_search' => true,
        'has_archive'         => false,
        'rewrite'             => false,
        // No Gutenberg/REST-authoring need at all — written server-side by
        // our own REST endpoint's PHP, never through wp_insert_post() over
        // REST or the block editor.
        'show_in_rest'        => false,
        'menu_icon'           => 'dashicons-search',
        'menu_position'       => 24,
        'capability_type'     => 'post',
    ) );

    bitesmart_register_search_log_meta();
}
add_action( 'init', 'bitesmart_register_search_log_post_type' );

/**
 * Meta for a Search Log entry. show_in_rest is false throughout to match
 * the CPT's own show_in_rest => false — nothing here is ever read/written
 * over REST, only via direct update_post_meta()/get_post_meta() calls from
 * bitesmart_search_log_record() and the admin column rendering below.
 * Registering it anyway (rather than skipping straight to bare
 * update_post_meta() calls) is just documentation/consistency with every
 * other CPT file in this plugin, which centralizes its meta schema the
 * same way.
 */
function bitesmart_register_search_log_meta() {
    register_post_meta( 'search_log', '_search_log_stage', array(
        'type'         => 'string',
        'single'       => true,
        'default'      => '',
        'show_in_rest' => false,
    ) );

    register_post_meta( 'search_log', '_search_log_lang', array(
        'type'         => 'string',
        'single'       => true,
        'default'      => '',
        'show_in_rest' => false,
    ) );

    register_post_meta( 'search_log', '_search_log_count', array(
        'type'         => 'integer',
        'single'       => true,
        'default'      => 0,
        'show_in_rest' => false,
    ) );
}

/**
 * Records one occurrence of a zero-result search. A single search_log post
 * exists per unique (term, stage, lang) combo, keyed by a deterministic
 * post_name hash — repeats just bump the existing post's count and "last
 * searched" timestamp (post_modified) rather than creating duplicates.
 *
 * Looked up by post_name (WP_Query 'name') rather than a meta_query across
 * the three fields: post_name has a real index in wp_posts, so this
 * resolves to one indexed exact-match lookup instead of joining wp_postmeta
 * multiple times for a composite key that has no matching index there.
 *
 * The hash (rather than a truncated sanitize_title() of the concatenated
 * term) avoids two different long terms silently colliding into the same
 * post_name once WordPress truncates it to that column's 200-char limit.
 *
 * Called only from the Custom Blocks plugin's REST endpoint
 * (zero-result-log.php) after ITS args schema has already
 * validated/sanitized $term/$stage/$lang — this function trusts its inputs
 * and does no further validation of its own.
 *
 * @param string $term  Search term (already trimmed, length-capped).
 * @param string $stage Stage taxonomy slug.
 * @param string $lang  Short site language code (e.g. "en", "es").
 * @return int|WP_Error Post ID on success, WP_Error if the insert failed.
 */
function bitesmart_search_log_record( $term, $stage, $lang ) {
    $normalized = mb_strtolower( trim( $term ) );
    $slug       = md5( $lang . '|' . $stage . '|' . $normalized );

    $existing = get_posts( array(
        'name'           => $slug,
        'post_type'      => 'search_log',
        'post_status'    => 'publish',
        'posts_per_page' => 1,
        'no_found_rows'  => true,
    ) );

    if ( ! empty( $existing ) ) {
        $post_id = $existing[0]->ID;
        $count   = (int) get_post_meta( $post_id, '_search_log_count', true );
        update_post_meta( $post_id, '_search_log_count', $count + 1 );

        // Explicitly bumped rather than relied on implicitly, so "last
        // searched" is unambiguous regardless of what wp_update_post()
        // would or wouldn't touch on its own for an otherwise-unchanged post.
        $now = current_time( 'mysql' );
        wp_update_post( array(
            'ID'                => $post_id,
            'post_modified'     => $now,
            'post_modified_gmt' => get_gmt_from_date( $now ),
        ) );

        return $post_id;
    }

    // About to insert a brand-new row — this is the actual storage-growth
    // vector (see this file's header comment). Not a hard failure: once
    // the hourly cap is hit, brand-new terms are just silently skipped for
    // the rest of the window — the increment path above is unaffected and
    // stays cheap regardless of how many times it's hit.
    if ( bitesmart_search_log_new_entry_cap_reached() ) {
        return new WP_Error(
            'bitesmart_search_log_rate_limited',
            __( 'Sitewide new-entry cap reached for this hour.', 'custom-post-types-for-bbs' )
        );
    }

    $post_id = wp_insert_post( array(
        'post_type'   => 'search_log',
        'post_status' => 'publish',
        'post_title'  => $term,
        'post_name'   => $slug,
    ), true );

    if ( is_wp_error( $post_id ) ) {
        return $post_id;
    }

    update_post_meta( $post_id, '_search_log_stage', $stage );
    update_post_meta( $post_id, '_search_log_lang', $lang );
    update_post_meta( $post_id, '_search_log_count', 1 );

    return $post_id;
}

/**
 * Sitewide cap on brand-new search_log rows created per hour — a plain
 * transient counter, same rolling-window approach as the per-IP limit in
 * zero-result-log.php, incremented only when bitesmart_search_log_record()
 * is about to insert a genuinely new row (never on existing-term
 * increments, which stay cheap and unbounded by design). 300/hour is
 * deliberately generous — this is a backstop against a distributed/
 * many-IP bot swarm, not the primary defense (that's the per-IP limit);
 * real traffic should essentially never come close to it.
 */
function bitesmart_search_log_new_entry_cap_reached() {
    $key   = 'bitesmart_search_log_new_entries';
    $count = (int) get_transient( $key );

    if ( $count >= BITESMART_SEARCH_LOG_MAX_NEW_PER_HOUR ) {
        return true;
    }

    set_transient( $key, $count + 1, HOUR_IN_SECONDS );

    return false;
}

/**
 * Self-scheduling on every 'init' rather than relying only on plugin
 * activation — an activation hook alone wouldn't retroactively schedule
 * this for an already-active install (same caveat already documented for
 * the Stage/Series taxonomy term-seeding activation hooks in this plugin's
 * root file). wp_next_scheduled() keeps this cheap and idempotent: it only
 * actually calls wp_schedule_event() once, and self-heals if the event is
 * ever missing for any reason.
 */
function bitesmart_search_log_schedule_prune() {
    if ( ! wp_next_scheduled( 'bitesmart_search_log_prune_event' ) ) {
        wp_schedule_event( time(), 'daily', 'bitesmart_search_log_prune_event' );
    }
}
add_action( 'init', 'bitesmart_search_log_schedule_prune' );

/**
 * Daily housekeeping: a search_log entry searched exactly once and never
 * repeated is both the least actionable signal (repeated searches, count
 * >= 2, are what actually point at a real content gap) and the most
 * likely to be one-off bot noise that slipped past the rate limits in
 * zero-result-log.php. Deleting these once they're old enough keeps the
 * table bounded long-term no matter the traffic source, without losing
 * anything Janet would likely act on. One batch of up to 200/day keeps
 * each run cheap on shared hosting; if it's ever behind, it just catches
 * up over the next few days.
 */
function bitesmart_search_log_prune_stale_entries() {
    $stale = get_posts( array(
        'post_type'      => 'search_log',
        'post_status'    => 'publish',
        'posts_per_page' => 200,
        'no_found_rows'  => true,
        'fields'         => 'ids',
        'date_query'     => array(
            array(
                'column' => 'post_modified',
                'before' => BITESMART_SEARCH_LOG_PRUNE_AFTER_DAYS . ' days ago',
            ),
        ),
        'meta_query'     => array(
            array(
                'key'     => '_search_log_count',
                'value'   => 1,
                'compare' => '<=',
                'type'    => 'NUMERIC',
            ),
        ),
    ) );

    foreach ( $stale as $post_id ) {
        wp_delete_post( $post_id, true ); // true = skip Trash, no reason to keep these around either
    }
}
add_action( 'bitesmart_search_log_prune_event', 'bitesmart_search_log_prune_stale_entries' );

/**
 * Registered from the main plugin file (custom-post-types-for-bbs.php),
 * not here — register_deactivation_hook() only fires correctly when
 * called with the MAIN plugin file's own __FILE__ (WordPress keys the
 * deactivate_* action off THAT file's plugin_basename(), not whichever
 * included file happens to call it) — same reason the two existing
 * register_activation_hook() calls live there too, not in an includes/ file.
 */
function bitesmart_search_log_clear_prune_schedule() {
    wp_clear_scheduled_hook( 'bitesmart_search_log_prune_event' );
}

/**
 * Admin list-table columns: rename the native Title column to read as
 * "Search Term" (that's what it is here), add Stage/Language/Times
 * Searched after it, and rename the native Date column to "First Seen"
 * (post_date never changes after insert, so that's what it now means) with
 * a new "Last Searched" column (post_modified) after it.
 */
function bitesmart_search_log_admin_columns( $columns ) {
    $new = array();

    foreach ( $columns as $key => $label ) {
        if ( 'title' === $key ) {
            $new['title']           = __( 'Search Term', 'custom-post-types-for-bbs' );
            $new['stage']           = __( 'Stage', 'custom-post-types-for-bbs' );
            $new['lang']            = __( 'Language', 'custom-post-types-for-bbs' );
            $new['times_searched']  = __( 'Times Searched', 'custom-post-types-for-bbs' );
            continue;
        }

        if ( 'date' === $key ) {
            $new['date']          = __( 'First Seen', 'custom-post-types-for-bbs' );
            $new['last_searched'] = __( 'Last Searched', 'custom-post-types-for-bbs' );
            continue;
        }

        $new[ $key ] = $label;
    }

    return $new;
}
add_filter( 'manage_search_log_posts_columns', 'bitesmart_search_log_admin_columns' );

/**
 * Renders the four custom columns added above. Stage/Language look up the
 * human-readable name for the stored slug/code, falling back to the raw
 * stored value if the term/language has since been renamed or removed
 * (rare, but shouldn't make an old log entry disappear or error).
 */
function bitesmart_search_log_admin_column_content( $column, $post_id ) {
    switch ( $column ) {
        case 'stage':
            $slug = get_post_meta( $post_id, '_search_log_stage', true );
            $term = $slug ? get_term_by( 'slug', $slug, 'stage' ) : false;
            echo esc_html( $term ? $term->name : $slug );
            break;

        case 'lang':
            $code = get_post_meta( $post_id, '_search_log_lang', true );
            $name = $code;
            foreach ( bitesmart_site_languages() as $language ) {
                if ( $language['code'] === $code ) {
                    $name = $language['name'];
                    break;
                }
            }
            echo esc_html( $name );
            break;

        case 'times_searched':
            echo esc_html( (int) get_post_meta( $post_id, '_search_log_count', true ) );
            break;

        case 'last_searched':
            echo esc_html( get_the_modified_date( '', $post_id ) );
            break;
    }
}
add_action( 'manage_search_log_posts_custom_column', 'bitesmart_search_log_admin_column_content', 10, 2 );

/**
 * Times Searched and Last Searched are both sortable. Last Searched maps
 * straight onto WordPress's own built-in 'modified' orderby (no extra work
 * needed); Times Searched needs the pre_get_posts hook below since it's a
 * plain integer meta value, not one of core's built-in orderby keys.
 */
function bitesmart_search_log_sortable_columns( $columns ) {
    $columns['times_searched'] = 'times_searched';
    $columns['last_searched']  = 'modified';
    return $columns;
}
add_filter( 'manage_edit-search_log_sortable_columns', 'bitesmart_search_log_sortable_columns' );

function bitesmart_search_log_orderby( $query ) {
    if ( ! is_admin() || ! $query->is_main_query() ) {
        return;
    }

    if ( 'search_log' !== $query->get( 'post_type' ) ) {
        return;
    }

    if ( 'times_searched' === $query->get( 'orderby' ) ) {
        $query->set( 'meta_key', '_search_log_count' );
        $query->set( 'orderby', 'meta_value_num' );
    }
}
add_action( 'pre_get_posts', 'bitesmart_search_log_orderby' );
