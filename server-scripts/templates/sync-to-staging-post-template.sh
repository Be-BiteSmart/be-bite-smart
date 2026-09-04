#!/bin/bash

# sync-to-staging-post.sh
# Post-sync cleanup script that deactivates Wordfence and purges WP Super
# Cache on staging only. This runs after every staging refresh (both
# prod->staging and local->staging) to ensure Wordfence never interferes
# with staging operations or inherits production's security state, and that
# WP Super Cache's static HTML page cache never keeps serving pre-sync
# content after the underlying DB has changed underneath it.
#
# Usage: Called automatically by SYNCTOSTAGING.sh after sync completes
# Location: /home/USER/ on DreamHost server
# Safety: Gated by hostname/environment check to prevent accidental production execution

set -e

STAGING_PATH="/home/USER/staging.SITENAME.org"

# Environment check: only run on staging
# This prevents accidental execution against production
# FAIL-CLOSED: If check fails for any reason (empty string, error, unexpected value),
# abort immediately. Only proceed if we can definitively confirm staging environment.
HTTP_HOST=$(wp option get siteurl --path="$STAGING_PATH" 2>/dev/null || echo "")

# Explicitly check for empty string (wp command failed) first
if [[ -z "$HTTP_HOST" ]]; then
  echo "ERROR: Failed to retrieve siteurl (wp command returned empty). Aborting Wordfence deactivation."
  exit 1
fi

# Then check if it contains "staging"
if [[ ! "$HTTP_HOST" =~ staging\. ]]; then
  echo "ERROR: Not running on staging environment. Aborting Wordfence deactivation."
  echo "Current siteurl: $HTTP_HOST"
  exit 1
fi

echo "Confirmed staging environment. Checking for Wordfence..."
# Only deactivate Wordfence if it's actually installed on staging.
# Staging intentionally does not run Wordfence day-to-day (it's heavy on
# shared DreamHost hosting), so on a normal sync this is expected to be
# absent and the script should exit cleanly, not fail the whole sync job.
# If a future dev does install Wordfence on staging (e.g. to test plugin
# updates), this still correctly deactivates it post-sync, same as before.
if wp plugin is-installed wordfence --path="$STAGING_PATH"; then
  wp plugin deactivate wordfence --path="$STAGING_PATH"
  echo "Wordfence deactivated on staging at $(date)"
else
  echo "Wordfence not installed on staging — skipping deactivation (expected on shared hosting)."
fi

echo "Checking for WP Super Cache..."
# A DB import (from prod or from a developer's local push) changes content
# underneath WP Super Cache's static, file-based HTML page cache, which has
# no way to know the DB moved — it just keeps serving whatever it already
# had on disk. Without this step, staging can look "unfixed" for an
# arbitrary content/DB change even though the import itself succeeded, which
# is exactly what happened investigating a stale "Parents' Learning Center"
# fix that had already landed correctly in staging's DB.
# `wp cache flush` is core WP-CLI's object-cache flush and does NOT touch
# this — WP Super Cache ships no WP-CLI command of its own, so we call its
# own PHP flush function directly via `wp eval` (same function used to clear
# the equivalent local cache: wp_cache_clear_cache()). The function_exists
# guard makes this a safe no-op if the plugin is inactive or absent.
if wp plugin is-installed wp-super-cache --path="$STAGING_PATH"; then
  wp eval 'if (function_exists("wp_cache_clear_cache")) { wp_cache_clear_cache(); }' --path="$STAGING_PATH"
  echo "WP Super Cache purged on staging at $(date)"
else
  echo "WP Super Cache not installed on staging — skipping purge."
fi
