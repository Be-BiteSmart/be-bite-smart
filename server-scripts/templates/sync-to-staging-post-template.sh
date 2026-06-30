#!/bin/bash

# sync-to-staging-post.sh
# Post-sync cleanup script that deactivates Wordfence on staging only.
# This runs after every staging refresh to ensure Wordfence never interferes
# with staging operations or inherits production's security state.
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
