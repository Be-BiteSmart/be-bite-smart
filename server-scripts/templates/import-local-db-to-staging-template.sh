#!/bin/bash

# import-local-db-to-staging.sh
# Imports a developer's LOCAL database dump into staging, replacing whatever
# is currently there. Backs staging up first so the push is reversible.
#
# This is the local -> staging counterpart to sync-staging-db.sh (which does
# prod -> staging). It exists so a developer can push their local WordPress
# content/DB changes to staging for manual review, without ever touching
# production.
#
# Security note: this script is invoked via a forced `command=` in
# authorized_keys (see authorized_keys_template, "local-push-deploy" key),
# so a leaked key can ONLY ever run this script — never arbitrary shell, and
# never against anything but the hardcoded STAGING_PATH below. The dump
# itself arrives as raw stdin (piped by push-local-db-to-staging.sh) — it is
# DATA, not a command, so it can't expand the blast radius of the key beyond
# "whatever wp db import does with untrusted SQL," which is the same trust
# boundary sync-staging-db.sh already accepts for production's export.
#
# Usage: Called automatically via SSH forced command (stdin = the SQL dump).
#   Not meant to be run interactively without piping a dump in first.
# Location: /home/USER/ on DreamHost server
# Trigger: local-only-scripts/push-local-db-to-staging.sh via restricted SSH key

set -e

STAGING_PATH="/home/USER/staging.SITENAME.org"
LOCAL_URL_PATTERN='https?://bebitesmart\.local'
STAGING_URL="https://staging.SITENAME.org"
TMP_DIR="/home/USER/tmp"
DUMP_FILE="$TMP_DIR/local-push-$(date +%s).sql"
# Shares the SAME lock file as sync-staging-db.sh, deliberately: this script
# and the CI-triggered prod->staging sync both write to staging's DB, so they
# must never run concurrently. Whichever one wins the lock finishes cleanly;
# the other waits/fails and can just be re-run.
LOCK_FILE="/home/USER/sync-staging-db.lock"
BACKUP_DIR="/home/USER/staging-db-backups"

mkdir -p "$TMP_DIR" "$BACKUP_DIR"

# Fail-closed environment check FIRST, before touching anything. This must
# run before any import/backup step — the whole point is that a misconfigured
# STAGING_PATH (or a copy-paste of this template gone wrong) can never let a
# local dump land on production. Same pattern as sync-to-staging-post.sh.
HTTP_HOST=$(wp option get siteurl --path="$STAGING_PATH" 2>/dev/null || echo "")
if [[ -z "$HTTP_HOST" ]]; then
  echo "ERROR: Failed to retrieve siteurl (wp command returned empty). Aborting import." >&2
  exit 1
fi
if [[ ! "$HTTP_HOST" =~ staging\. ]]; then
  echo "ERROR: Not running on staging environment. Aborting import." >&2
  echo "Current siteurl: $HTTP_HOST" >&2
  exit 1
fi

# Prevent overlapping runs (with sync-staging-db.sh, and with itself)
exec 200>"$LOCK_FILE"
flock -n 200 || { echo "Sync already running, exiting." >&2; exit 1; }

# Clean up this run's dump file no matter how the script exits
trap 'rm -f "$DUMP_FILE"' EXIT

# Purge stale dump files left behind by previous failed runs (>1 day old)
find "$TMP_DIR" -name "local-push-*.sql" -mtime +1 -delete 2>/dev/null || true

# 1. Read the incoming dump from stdin (piped by push-local-db-to-staging.sh)
echo "Receiving local database dump..."
cat > "$DUMP_FILE"

if [[ ! -s "$DUMP_FILE" ]]; then
  echo "ERROR: Received empty dump — aborting before touching staging's DB." >&2
  exit 1
fi

# 2. Back up staging's CURRENT database before overwriting it, so this is
# reversible if the push turns out to be a mistake.
BACKUP_FILE="$BACKUP_DIR/staging-pre-local-push-$(date +%Y%m%d-%H%M%S).sql"
echo "Backing up staging's current database to $BACKUP_FILE ..."
wp db export "$BACKUP_FILE" --path="$STAGING_PATH"

# Keep a week of these backups, not just one day like the tmp dump cleanup —
# this is the actual rollback point for staging, worth more retention.
find "$BACKUP_DIR" -name "staging-pre-local-push-*.sql" -mtime +7 -delete 2>/dev/null || true

# 3. Import the pushed dump
echo "Importing local database into staging..."
wp db import "$DUMP_FILE" --path="$STAGING_PATH"

# 4. Rewrite URLs (local -> staging), same flags as sync-staging-db.sh
echo "Rewriting URLs from local to staging..."
wp search-replace "$LOCAL_URL_PATTERN" "$STAGING_URL" \
  --path="$STAGING_PATH" \
  --all-tables \
  --skip-columns=guid \
  --precise \
  --regex

# 5. Run the same post-sync cleanup as the prod->staging sync (Wordfence
# deactivation, only if present) — staging should never be left in a state
# where Wordfence is active, regardless of which sync path put it there.
echo "Running post-sync cleanup..."
/home/USER/sync-to-staging-post.sh

echo "Staging synced from local at $(date)"
echo "Restore point (staging's pre-push DB): $BACKUP_FILE"
echo "  To undo: wp db import \"$BACKUP_FILE\" --path=\"$STAGING_PATH\""
