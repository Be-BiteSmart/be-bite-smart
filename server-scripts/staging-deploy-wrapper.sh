#!/bin/bash

# staging-deploy-wrapper.sh
# Wrapper script called by the staging-deploy SSH key via authorized_keys.
# This script runs both the git pull (code deploy) and the full DB/media sync.
#
# Location: /home/USER/ on DreamHost server
# Called from: authorized_keys command="... staging-deploy-wrapper.sh"
#
# SECURITY: This script takes no arguments from the SSH session. All paths are
# hardcoded. Ensure file permissions are chmod 700 (owner read/write/execute only)
# to prevent modification by other users on the server.

set -e

STAGING_PATH="/home/USER/staging.SITENAME.org"
SYNC_SCRIPT="/home/USER/SYNCTOSTAGING.sh"

echo "=== Starting staging deploy at $(date) ==="

# 1. Pull latest code from git
echo "Step 1: Pulling latest code from main..."
cd "$STAGING_PATH/wp-content"
git pull origin main

# 2. Run full production-to-staging sync (DB + media)
echo "Step 2: Running production-to-staging sync..."
"$SYNC_SCRIPT"

echo "=== Staging deploy completed at $(date) ==="
