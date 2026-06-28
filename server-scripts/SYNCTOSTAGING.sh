#!/bin/bash

# SYNCTOSTAGING.sh
# Syncs production database and media files to staging, excluding Wordfence security state.
# This ensures staging never inherits production's lockouts, blocklists, or enforcement settings.
#
# Usage: ./SYNCTOSTAGING.sh
# Location: /home/USER/ on DreamHost server
# Trigger: GitHub Actions workflow (pull_request to main) via restricted SSH key

set -e

PROD_PATH="/home/USER/SITENAME.org"
STAGING_PATH="/home/USER/staging.SITENAME.org"
PROD_URL_PATTERN='https?://(www\.)?SITENAME\.org'
STAGING_URL="https://staging.SITENAME.org"
TMP_DIR="/home/USER/tmp"
DUMP_FILE="$TMP_DIR/prod-dump-$(date +%s).sql"
LOCK_FILE="/home/USER/SYNCTOSTAGING.sh.lock"

# Wordfence tables to exclude (using prefix_wp_ prefix from wp-config.php)
# These tables contain lockout state, blocklists, enforcement settings, and plugin config
#
# IMPORTANT: This list must be reviewed and updated if Wordfence is ever updated or
# reinstalled. Plugin updates can add new tables or change the schema, which would
# cause this exclusion list to drift out of date. The post-sync deactivation step
# (SYNCTOSTAGING-post.sh) is the primary safety mechanism; this table exclusion
# is a secondary defense only.
WORDFENCE_TABLES=(
  "prefix_wp_wfBlockedIPLog"
  "prefix_wp_wfBlocks"
  "prefix_wp_wfCrawlers"
  "prefix_wp_wfHits"
  "prefix_wp_wfHoover"
  "prefix_wp_wfIssues"
  "prefix_wp_wfLockedOut"
  "prefix_wp_wfLogins"
  "prefix_wp_wfReverseCache"
  "prefix_wp_wfStatus"
  "prefix_wp_wfNotifications"
  "prefix_wp_wfConfig"
)

mkdir -p "$TMP_DIR"

# Prevent overlapping runs
exec 200>"$LOCK_FILE"
flock -n 200 || { echo "Sync already running, exiting."; exit 1; }

# Clean up this run's dump file no matter how the script exits (success or failure)
trap 'rm -f "$DUMP_FILE"' EXIT

# Purge any stale dump files left behind by previous failed runs
# NOTE: This uses -mtime +1 (files older than 1 day), so it cannot delete the
# current run's DUMP_FILE even if the sync runs for hours. The current file's
# mtime is set at creation time, and stale cleanup only touches files >24h old.
find "$TMP_DIR" -name "prod-dump-*.sql" -mtime +1 -delete

# Build exclude list for wp db export
EXCLUDE_ARGS=""
for table in "${WORDFENCE_TABLES[@]}"; do
  EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude_tables=$table"
done

# 1. Export prod DB (excluding Wordfence tables)
echo "Exporting production database (excluding Wordfence tables)..."
wp db export "$DUMP_FILE" --path="$PROD_PATH" $EXCLUDE_ARGS

# 2. Import into staging
echo "Importing database to staging..."
wp db import "$DUMP_FILE" --path="$STAGING_PATH"

# 3. Rewrite URLs (skip guid, force PHP-based replace for encoding safety)
echo "Rewriting URLs from production to staging..."
wp search-replace "$PROD_URL_PATTERN" "$STAGING_URL" \
  --path="$STAGING_PATH" \
  --all-tables \
  --skip-columns=guid \
  --precise \
  --regex

# 4. Sync media files from prod (mirrors exactly — removes staging-only files too)
echo "Syncing media files from production..."
rsync -a --delete "$PROD_PATH/wp-content/uploads/" "$STAGING_PATH/wp-content/uploads/"

# 5. Run post-sync cleanup (deactivate Wordfence on staging)
echo "Running post-sync cleanup..."
/home/USER/SYNCTOSTAGING-post.sh

echo "Staging synced from prod at $(date)"
