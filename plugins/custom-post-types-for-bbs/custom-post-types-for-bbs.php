<?php
/**
 * Plugin Name: Custom Post Types for BBS
 * Description: Content model for Be BiteSmart's custom content types — post types, taxonomies, and post meta only. No blocks or front-end JS live here; see the "Custom Blocks for Be BiteSmart" plugin for the blocks that read/write this content.
 * Version: 1.0
 * Author: Janet Spellman-Marsh
 */

// Taxonomies first, content types second: episode-cpt.php, resource-cpt.php,
// qa-entry-cpt.php, and guide-cpt.php all call
// register_taxonomy_for_object_type() against 'stage', 'topic', and/or
// 'series', which is a no-op if that taxonomy isn't registered yet. All of
// these hook onto 'init' at the default priority, so require-order is what
// decides execution order. guide-chapter-cpt.php DOES carry its own
// taxonomies — Stage + Topic, independently of its parent Guide, PLUS
// Guide Section as of 2026-08-16 (guide-section-taxonomy.php) — but loads
// after guide-cpt.php for readability, since it's conceptually the child.
// citation-cpt.php (also 2026-08-16) carries no taxonomy of its own, but
// loads last for the same "conceptually a child of Guide" readability
// reason — it's scoped/nested under Guide the same way guide-chapter-cpt.php
// is, just without any taxonomy attachment to worry about ordering.
// book-cpt.php (2026-08-16) only needs Stage/Topic, already loaded above —
// sits with the other flat/independent content types, before the
// Guide/Guide-Chapter/Citation "conceptually nested" group starts.
require_once __DIR__ . '/includes/stage-taxonomy.php';
require_once __DIR__ . '/includes/topic-taxonomy.php';
require_once __DIR__ . '/includes/series-taxonomy.php';
require_once __DIR__ . '/includes/guide-section-taxonomy.php';
require_once __DIR__ . '/includes/episode-cpt.php';
require_once __DIR__ . '/includes/resource-cpt.php';
require_once __DIR__ . '/includes/qa-entry-cpt.php';
require_once __DIR__ . '/includes/coloring-book-cpt.php';
require_once __DIR__ . '/includes/book-cpt.php';
require_once __DIR__ . '/includes/guide-cpt.php';
require_once __DIR__ . '/includes/guide-chapter-cpt.php';
require_once __DIR__ . '/includes/citation-seed-data.php';
require_once __DIR__ . '/includes/citation-cpt.php';

// Search Log has no taxonomy attachment and no load-order dependency on
// anything above — it just needs to register on 'init' like the rest.
require_once __DIR__ . '/includes/search-log-cpt.php';

// Registers the Stage/Series taxonomies and seeds their terms on fresh
// installs. wp_insert_term() requires the taxonomy to already be
// registered, so this calls the full registration functions (which seed
// terms at their end), not just the seeding helpers on their own. This
// plugin is already active in production, so this alone won't seed the
// existing install — the init-hooked calls in stage-taxonomy.php /
// series-taxonomy.php are what actually do that; this only covers future
// fresh installs. Topic has no terms to seed (free-tag, see
// topic-taxonomy.php), so it needs no equivalent activation call.
register_activation_hook( __FILE__, 'bitesmart_register_stage_taxonomy' );
register_activation_hook( __FILE__, 'bitesmart_register_series_taxonomy' );

// Search Log's own daily prune job schedules itself defensively on 'init'
// (see bitesmart_search_log_schedule_prune() in search-log-cpt.php — same
// "activation hook alone won't reach an already-active install" reasoning
// as above), so it needs no activation hook here. It DOES need this
// deactivation hook, though, so the scheduled WP-Cron event doesn't keep
// firing (harmlessly, but pointlessly) after the plugin's disabled.
register_deactivation_hook( __FILE__, 'bitesmart_search_log_clear_prune_schedule' );
