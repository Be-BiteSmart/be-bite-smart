# Server Scripts for DreamHost

This directory contains scripts that run on the DreamHost server to manage staging sync and post-sync cleanup.

## Files

- `sync-staging-db.sh` - Main sync script that copies production database and media to staging, excluding Wordfence tables
- `sync-to-staging-post.sh` - Post-sync cleanup that deactivates Wordfence on staging only
- `staging-deploy-wrapper.sh` - **Deprecated** - Wrapper script that combines git pull and sync. Not recommended due to privilege escalation risk. Use separate SSH keys instead (see Step 4).

## Deployment Instructions

These scripts live on the DreamHost server in `/home/USER/` (not in the git repo). Follow these steps to deploy or update them:

### 1. Upload scripts to DreamHost

Via SFTP or DreamHost File Manager, upload the sync scripts to:
```
/home/USER/sync-staging-db.sh
/home/USER/sync-to-staging-post.sh
```

Replace `USER` with your actual DreamHost username and `SITENAME.org` with your actual domain name in the scripts.

### 2. Make scripts executable

SSH into DreamHost and run:
```bash
chmod +x /home/USER/sync-staging-db.sh
chmod +x /home/USER/sync-to-staging-post.sh
```

**Permissions:** Both scripts should be `chmod 700` (owner read/write/execute only). Neither script needs to be readable, writable, or executable by any other user on the server — they handle production DB credentials and the Wordfence deactivation safety gate, so there's no reason for broader access.

```bash
chmod 700 /home/USER/sync-staging-db.sh
chmod 700 /home/USER/sync-to-staging-post.sh
```

### 3. Configure placeholder values

Edit both scripts on the server to replace placeholders:
- `USER` - Your DreamHost username
- `SITENAME.org` - Your actual domain name (e.g., `bebitesmart.org`)

**Cleanup:** If you previously uploaded `staging-deploy-wrapper.sh` to the server during an earlier deployment attempt, remove it (don't just lock down its permissions — delete it, so it can never be accidentally wired back into the forced-command path):
```bash
rm /home/USER/staging-deploy-wrapper.sh
```

### 4. Create a separate SSH key for sync operations (recommended)

**Security note:** Modifying the existing `staging-deploy` key to run the full sync would be a privilege escalation. If that key leaks (compromised GitHub secret, leaked CI log), an attacker could trigger production DB exports and staging syncs. Instead, create a separate key with restricted scope.

#### Step 4a: Generate a new SSH key for sync operations

Generate a new SSH key pair locally (not on the server — the private key should never touch the server):
```bash
ssh-keygen -t ed25519 -f ~/.ssh/staging-sync-deploy -C "staging-sync-deploy@bebitesmart.org"
```

Leave the passphrase empty (press Enter twice) — a passphrase-protected key can't be unlocked non-interactively by GitHub Actions.

Add the **public** key (`~/.ssh/staging-sync-deploy.pub`) to `~/.ssh/authorized_keys` on DreamHost with a forced command:
```
command="/home/USER/sync-staging-db.sh",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty ssh-ed25519 PUBLIC_KEY_HERE staging-sync-deploy
```

Replace `USER` with your actual DreamHost username.

**Why forced command:** This restricts the key to only running the sync script. If the key leaks, an attacker cannot run arbitrary commands - they can only trigger the sync. The forced command's exit status is returned to the SSH client, so GitHub Actions will fail if the script fails.

**No `cd` needed:** Unlike the `staging-deploy` key's command (which needs `cd /home/USER/staging.SITENAME.org/wp-content && git pull origin main`, since `git pull` is relative to the working directory), the sync key's command calls `sync-staging-db.sh` by absolute path. The script handles its own internal `cd`/absolute-pathing wherever it needs to operate (e.g. the WordPress root for `wp` CLI calls), so no `cd` belongs in the `authorized_keys` line itself.

#### Step 4b: Add the private key to GitHub Secrets

In GitHub repository settings, add the private key (`~/.ssh/staging-sync-deploy`, **not** the `.pub` file) as a new secret, scoped to the **staging environment** (Settings → Environments → staging → Environment secrets), not repository-level:
- Name: `DREAMHOST_STAGING_SYNC_SSH_KEY`
- Value: Contents of the private key file (`cat ~/.ssh/staging-sync-deploy`, full output including the `BEGIN`/`END` lines)

Once confirmed working end-to-end, delete the local copy of the private key or restrict it to `chmod 600`.

#### Step 4c: Update GitHub Actions workflow

The `deploy-staging` job must declare `environment: staging` — this is what makes any environment-scoped secret (including `DREAMHOST_STAGING_SYNC_SSH_KEY`, `DREAMHOST_STAGING_SSH_KEY`, `STAGING_AUTH_PASS`, `STAGING_AUTH_USER`) resolve inside that job at all. Without it, `secrets.DREAMHOST_STAGING_SYNC_SSH_KEY` resolves to empty and the SSH step fails.

Add a step in the `deploy-staging` job to trigger the sync after the git pull:

```yaml
jobs:
  deploy-staging:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Deploy to staging via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DREAMHOST_HOST }}
          username: ${{ secrets.DREAMHOST_USER }}
          key: ${{ secrets.DREAMHOST_STAGING_SSH_KEY }}
          script: echo "Deploy is enforced server-side via restricted SSH key"
      - name: Sync production to staging
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DREAMHOST_HOST }}
          username: ${{ secrets.DREAMHOST_USER }}
          key: ${{ secrets.DREAMHOST_STAGING_SYNC_SSH_KEY }}
          script: echo "Sync is enforced server-side via restricted SSH key"
```

**Note:** The script content (`echo "..."`) is a no-op because the forced command in `authorized_keys` overrides any client-side command. The SSH connection itself triggers the sync script, and its exit status is returned to GitHub Actions.

**Why this approach:**
- The `staging-deploy` key remains restricted to git pull only (forced command)
- The new `staging-sync-deploy` key is restricted to only running the sync script (forced command)
- If either key leaks, the blast radius is limited to that specific operation
- The forced command's exit status is returned to the SSH client, so GitHub Actions fails if the script fails
- The sync script's fail-closed environment check protects the Wordfence deactivation step (not the DB export/import itself)
- Both keys are scoped to the `staging` GitHub environment, alongside `STAGING_AUTH_PASS`/`STAGING_AUTH_USER`, for an additional layer of access control and audit logging beyond what the forced-command restriction already provides server-side

### 5. Verify Wordfence table prefix

The scripts exclude Wordfence tables with the default prefix. If your WordPress installation uses a custom table prefix (e.g., `prefix_wp_` instead of `wp_`), update the `WORDFENCE_TABLES` array in `sync-staging-db.sh` to match:

```bash
WORDFENCE_TABLES=(
  "prefix_wp_wfBlockedIPLog"
  "prefix_wp_wfBlocks"
  # ... etc
)
```

You can check your table prefix in `wp-config.php` on the server.

### 6. Daily cron job (independent of GitHub Actions)

In addition to the CI-triggered sync (Step 4), the sync also runs automatically once a day via a cron job on the DreamHost server. This is a second, independent invocation path — separate from the GitHub Actions `staging-sync-deploy` SSH key, and not gated by any PR or branch protection rule.

**Cron entry:**
```
# sync prod and staging - daily at midnight
0 0 * * * bash /home/USER/sync-staging-db.sh
```

Add this via `crontab -e` on the DreamHost server. Replace `USER` with your actual DreamHost username.

**Why this matters for the security model:** every safety mechanism documented in this README still applies regardless of *how* the sync is triggered, since they all live inside `sync-staging-db.sh` and `sync-to-staging-post.sh` themselves — the lock file, Wordfence table exclusion, and fail-closed environment check protect a cron-triggered run exactly the same way they protect a CI-triggered run. The one thing worth being aware of is **overlap risk**: if a CI-triggered sync (from a PR) happens to be running at the same moment the midnight cron fires, the lock file is what prevents both from running concurrently — the second invocation should see the lock and exit rather than race against the first. Worth confirming this behavior during the pending live-validation pass (see Testing and Validation Status), since it's now a real scenario rather than a theoretical one.

**Operational note:** because this path runs daily regardless of whether any code change occurred, the production database is being exported and imported into staging once a day even on days with zero deploys. Worth keeping in mind for anything sensitive to staging being freshly overwritten on a fixed schedule (e.g. if someone is mid-investigation on staging and the midnight sync wipes their in-progress state).

## How It Works

### sync-staging-db.sh

1. **Excludes Wordfence tables** from the production database export:
   - `wfBlockedIPLog`, `wfBlocks`, `wfCrawlers`, `wfHits`, `wfHoover`
   - `wfIssues`, `wfLockedOut`, `wfLogins`, `wfReverseCache`
   - `wfStatus`, `wfNotifications`, `wfConfig`

   **Important:** This table exclusion is a **secondary safety measure only**. If Wordfence is updated or reinstalled, new tables may be added that aren't excluded. The post-sync deactivation step (sync-to-staging-post.sh) is the primary control that ensures Wordfence is neutralized on staging.

2. **Imports** the sanitized database to staging

3. **Rewrites URLs** from production to staging using `wp search-replace`

4. **Syncs media files** via rsync (mirrors exactly, removes staging-only files)

5. **Runs post-sync cleanup** via `sync-to-staging-post.sh` (primary safety mechanism)

### sync-to-staging-post.sh

1. **Checks environment** by verifying the site URL contains "staging"
   - **Fail-closed behavior:** If the `wp option get siteurl` command fails, returns empty, or errors out, the script aborts immediately without deactivating Wordfence. This prevents accidental production deactivation if the environment check fails for any reason.
2. **Deactivates Wordfence** plugin on staging only
3. **Aborts** if run against production (safety gate)

## Safety Features

- **Lock file** prevents overlapping sync runs
- **Cleanup trap** removes temporary SQL files even if script fails
- **Stale file cleanup** removes dump files older than 1 day
- **Environment check** in post-sync script prevents accidental production execution
- **SSH key restrictions** in `authorized_keys` limit what each key can do

## Testing

To test the sync process manually without triggering via GitHub Actions:

```bash
ssh USER@bebitesmart.org
cd /home/USER
./sync-staging-db.sh
```

Monitor the output to ensure:
- Wordfence tables are excluded from export
- Database imports successfully
- URL rewrites complete
- Media files sync
- Wordfence is deactivated on staging

## Troubleshooting

### Sync fails with "Sync already running"
A previous sync may have crashed without releasing the lock. First confirm no sync is actually in progress (`ps aux | grep sync-staging-db`, and check the lock file's age against how long a sync normally takes) before removing it — deleting an active lock could let two syncs race and leave staging's DB half-imported:
```bash
rm /home/USER/sync-staging-db.sh.lock
```
If you find a differently-named lock file (e.g. from an earlier version of the script), confirm what lock filename the currently deployed script actually uses (`grep -r "lock" sync-staging-db.sh`) before assuming an orphaned one is safe to delete — it almost certainly is if the current script doesn't reference that filename, but worth the one check.

### Wordfence still active on staging after sync
Check that:
1. `sync-to-staging-post.sh` is executable
2. The site URL check passes (contains "staging")
3. Wordfence plugin slug is correct (`wordfence`)

### Tables not excluded
Verify the table prefix in `WORDFENCE_TABLES` matches your actual WordPress table prefix.

## Security Review

### Problem Statement and Scope

This sync process moves production WordPress data (including the database and media files) to a staging environment for testing. The staging environment is publicly reachable and used by CI (Playwright tests). The security review focused on:

1. **Preventing security state inheritance:** Ensuring staging doesn't inherit production's Wordfence lockout state, blocklists, or enforcement settings in ways that block legitimate testing or CI access
2. **Credential scope containment:** Ensuring the credentials that perform this sync can't be abused beyond their intended scope if leaked (compromised GitHub secret, leaked CI log, etc.)

**Note on invocation paths:** the sync runs via two independent triggers — the GitHub Actions `staging-sync-deploy` SSH key (Step 4) and a daily cron job on the server itself (Step 6). The credential-scope analysis below applies to the SSH-key path; the cron path has no equivalent credential exposure (it runs locally as the server's own user, not via a leakable secret) but introduces its own considerations — see the new residual risk entry below.

**Scope:** This review covers the staging sync mechanism (Step 1). The production WAF bypass for CI (Step 2 - custom-header approach for Playwright security suite) is tracked separately and was not part of this review.

### Concerns and Resolutions

| Concern | Status | Resolution |
|---------|--------|------------|
| **Key privilege escalation** (git-pull → full sync) | Fixed | Split into two separate keys: `staging-deploy` (git pull only) and `staging-sync-deploy` (sync script only). This limits blast radius if either key leaks. |
| **wfConfig exclusion ambiguity** | Fixed | Explicitly framed table exclusion as secondary safety measure, with post-sync deactivation as primary control. Added warning comment that table list must be reviewed if Wordfence is updated. |
| **Fail-closed environment check** | Fixed | Documented explicitly that empty/error results from URL check default to aborting (not deactivating). Script checks for empty string before regex match. |
| **Wrapper script permissions** | Resolved | Wrapper script deprecated due to privilege escalation risk. Added cleanup step to remove it from server if previously uploaded. |
| **CI no-op / observability** | Fixed | Used forced command with no-op script content. The forced command's exit status is returned to GitHub Actions, ensuring proper failure detection. |
| **Sync key blast radius** | Fixed | Sync key uses forced command (`command="/home/USER/sync-staging-db.sh"`) to restrict to script-only execution, not arbitrary shell access. |
| **Secret exposure scope** | Fixed | Staging-related secrets (`DREAMHOST_STAGING_SSH_KEY`, `DREAMHOST_STAGING_SYNC_SSH_KEY`, `STAGING_AUTH_PASS`, `STAGING_AUTH_USER`) migrated from repository-level to environment-level scoping (`staging` environment), confirmed live in the workflow file via `environment: staging` on the `deploy-staging` job. |

### Reasoning for Key Design Decisions

**Why separate keys instead of expanding staging-deploy?**
Expanding the existing key would be a privilege escalation. If that key leaked (compromised GitHub secret, leaked CI log), an attacker could trigger production DB exports and staging syncs. Separate keys limit the blast radius: staging-deploy can only pull code, staging-sync-deploy can only run the sync.

**Why forced command for sync key instead of unrestricted access?**
Unrestricted SSH access would allow arbitrary command execution if the key leaked. A forced command restricts the key to only running the sync script while still returning the script's exit status to GitHub Actions for proper failure detection. This maintains the security boundary without sacrificing observability.

**Why table exclusion as secondary, not primary?**
Wordfence updates can add new tables that aren't in the exclusion list, causing it to drift out of date. The post-sync deactivation step is the reliable control that ensures Wordfence is neutralized on staging. Table exclusion is a secondary defense that requires manual review if Wordfence is updated.

**Why fail-closed environment check?**
If the `wp option get siteurl` command fails, returns empty, or errors out, the script must abort rather than proceed. An inverted check or unexpected failure mode could accidentally deactivate Wordfence on production. The script explicitly checks for empty string before the regex match, ensuring it only proceeds when it can definitively confirm staging environment.

**Why migrate staging secrets to environment-level scoping?**
Repository-level secrets are visible to every workflow and job in the repo by default. Environment-level secrets are only injected into jobs that explicitly declare that environment, which adds an audit trail (which job accessed which secret, when) and the option to layer on protection rules later (e.g. deployment branch restrictions). `DREAMHOST_HOST` and `DREAMHOST_USER` remain repository-level by design, since both `deploy-staging` and `deploy-prod` reference the same values — confirmed directly in the workflow file, not assumed.

### Residual Risks and Accepted Tradeoffs

The following risks are knowingly accepted as part of this design:

**Wordfence table exclusion drift**
- **Risk:** Wordfence updates can add new tables that aren't in the exclusion list, causing it to drift out of date
- **Mitigation:** Post-sync deactivation is the primary control; table exclusion is secondary defense
- **Owner/Trigger:** Revisit the `WORDFENCE_TABLES` list whenever Wordfence is updated or reinstalled
- **Acceptance:** This is an acceptable gap because deactivation provides the primary safety net

**SSH key leakage still allows script execution**
- **Risk:** Both SSH keys, even with forced-command restrictions, still grant the ability to run their respective scripts on demand if leaked. The staging-sync-deploy key leaking means an attacker can trigger production DB exports and staging overwrites repeatedly.
- **Mitigation:** Blast radius is limited to the specific operation (git pull or sync), not arbitrary shell access
- **Acceptance:** This is an acceptable residual risk because the operations are scoped to staging as the destructive target and production as read-only source. Repeated triggering could DoS staging or interfere with concurrent use, but cannot modify production data. Keys are stored in GitHub Secrets with access logging, and the staging-environment keys are additionally scoped to the `staging` GitHub environment.

**No automated secret rotation**
- **Risk:** SSH keys are not rotated on a scheduled cadence
- **Policy:** Rotate keys only if compromise is suspected or on manual audit
- **Acceptance:** This is the current operational policy; may be revisited if regulatory requirements change

**Cron-triggered sync overlapping with CI-triggered sync**
- **Risk:** The daily cron job (Step 6) and the GitHub Actions-triggered sync are independent invocation paths with no coordination between them beyond the shared lock file. If a PR-triggered sync is in progress at exactly midnight, the cron-triggered run should be blocked by the lock — but this hasn't yet been validated under real concurrent conditions. There's also no GitHub-side audit trail for cron-triggered runs (no workflow log, no exit-status visibility in CI), unlike the SSH-key path.
- **Mitigation:** Shared lock file is intended to serialize both paths regardless of trigger source
- **Owner/Trigger:** Confirm lock-file behavior under actual overlapping conditions during live validation; if cron-triggered runs need their own visibility (e.g. logging to a file, alerting on failure), that's not currently implemented
- **Acceptance:** Acceptable for now given low overlap probability (a single midnight window vs. PR-triggered runs at arbitrary times), but worth monitoring once live

### GitHub Actions Secret Exposure Surface

**Current Configuration (confirmed live in `playwright-tests.yml` as of this review):**

**Environment secrets — `production` environment:**
- `DREAMHOST_PROD_SSH_KEY`

**Environment secrets — `staging` environment:**
- `DREAMHOST_STAGING_SSH_KEY`
- `DREAMHOST_STAGING_SYNC_SSH_KEY`
- `STAGING_AUTH_PASS`
- `STAGING_AUTH_USER`

**Repository secrets:**
- `DREAMHOST_HOST` — shared; referenced directly by both `deploy-staging` and `deploy-prod`
- `DREAMHOST_USER` — shared; referenced directly by both `deploy-staging` and `deploy-prod`

**Observations:**
- All staging-only and production-only secrets are now environment-scoped. Only the two values genuinely shared between staging and production (`DREAMHOST_HOST`, `DREAMHOST_USER`) remain repository-level, and that's confirmed by direct reference in both jobs rather than assumed.
- The `production` environment requires manual approval before `deploy-prod` runs (configured in Settings → Environments → production) — a human-in-the-loop gate on top of the SSH key restrictions.
- The `staging` environment currently has no equivalent approval requirement, which is intentional: `deploy-staging` needs to run automatically on every PR for CI to function. Adding a required-reviewer rule to the `staging` environment would block automated test runs and should be avoided.
- Branch protection rules are in place for `main`:
  - Pull request required before merging
  - Status checks must pass ("Playwright Tests")
  - Force pushes blocked
  - Deletions restricted to bypass permissions
- The workflow's trigger design (`push` scoped to `branches: [main]`) is the actual mechanism preventing `deploy-prod` from firing on arbitrary branches — the `if: github.event_name == 'push'` check inside the job only distinguishes event type, not branch, per the inline comments in the workflow file itself.

**Important distinction:** Branch protection rules and environment scoping protect the GitHub Actions workflow YAML and its secrets from unreviewed changes, but do NOT protect the server-side `authorized_keys` configuration. The forced-command binding is edited manually on the DreamHost server via SSH (Step 4b), outside of the git-tracked workflow file. Someone with server SSH access could loosen or remove the forced-command restriction without any PR process.

**Recommendation:** The current configuration — environment-scoped secrets for everything staging- and production-specific, repository-level only for genuinely shared values, manual approval gating production, and branch protection gating merges — is a reasonable, defense-in-depth posture for this setup. Server-side configuration changes (authorized_keys, file permissions, script contents on the server itself) fall outside what GitHub-side controls can audit, and should be reviewed separately/manually on a periodic basis.

### Testing and Validation Status

**Status:** Reviewed at the design level; pending live validation

The concerns and resolutions in this review were reasoned through and documented, but have not yet been validated with a live dry run. The following should be validated before first production use:

- Lock file behavior under real conditions (overlapping runs, crash scenarios)
- Stale cleanup timing and interaction with long-running syncs
- Forced-command exit-status propagation through appleboy/ssh-action
- Actual Wordfence table exclusion behavior on the production database
- Fail-closed environment check behavior with various failure modes
- End-to-end confirmation that `environment: staging` on the `deploy-staging` job correctly resolves all four staging-scoped secrets (this is now reflected in the workflow file, but hasn't yet been confirmed by an actual successful run)
- Lock-file behavior when the daily cron job (Step 6) and a CI-triggered sync genuinely overlap — not yet tested in practice

**Action:** Run a manual test sync via SSH (`/home/USER/sync-staging-db.sh`) and verify all expected behaviors before relying on the automated GitHub Actions trigger.