#!/bin/bash
# deploy-staging-branch.sh
# Checks out and pulls a specific branch on staging, instead of always
# pulling whatever branch staging happens to currently be on.
#
# This exists because the previous forced command (`cd ... && git pull`)
# always pulled the *current* branch — which is fine for prod (always main),
# but wrong for staging during a PR: a PR from `feature-x` into `main`
# needs staging to check out and pull `feature-x`, not just `git pull`
# whatever main last was.
#
# Security note: this script is invoked via a forced `command=` in
# authorized_keys, so a leaked key can ONLY ever run this script — never
# arbitrary shell. The branch name comes from $SSH_ORIGINAL_COMMAND, which
# is attacker/CI-controlled input, so it MUST be validated before use in
# any git command. The regex below is a strict allowlist (letters, digits,
# hyphens, underscores, forward slashes only) specifically chosen to reject
# shell metacharacters (;, &&, `, $(), etc.), path traversal (..), and
# anything else that isn't a normal git branch name. Do not loosen this
# regex without understanding why it's strict.
#
# Usage: Called automatically via SSH forced command — not meant to be run
# interactively with arguments. If run with no SSH_ORIGINAL_COMMAND set
# (e.g. testing manually), it defaults to "main".
# Location: /home/USER/ on DreamHost server
set -e

STAGING_PATH="/home/USER/staging.SITENAME.org/wp-content"

# SSH_ORIGINAL_COMMAND is whatever the client (GitHub Actions) sent as the
# `script:` value in the workflow — in our case, the PR's branch name.
# Default to "main" if unset, so manual/interactive testing doesn't break.
BRANCH="${SSH_ORIGINAL_COMMAND:-main}"

# Strict allowlist validation. This must run BEFORE the branch name touches
# any git command. If this regex ever fails to match a legitimate branch
# name you use (e.g. branches with dots, like "release.1.2"), extend the
# character class deliberately and narrowly — don't switch to a blocklist
# or a permissive pattern.
if [[ ! "$BRANCH" =~ ^[a-zA-Z0-9_/-]+$ ]]; then
  echo "ERROR: Invalid branch name format: $BRANCH" >&2
  echo "Branch names may only contain letters, digits, hyphens, underscores, and forward slashes." >&2
  exit 1
fi

echo "Deploying branch '$BRANCH' to staging..."

cd "$STAGING_PATH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "Staging now on branch '$BRANCH' at $(git rev-parse --short HEAD)"