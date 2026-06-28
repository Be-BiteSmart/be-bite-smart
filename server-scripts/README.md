# Server Scripts for DreamHost

This directory contains scripts that run on the DreamHost server to manage staging sync and post-sync cleanup.

## Files

- `SYNCTOSTAGING.sh` - Main sync script that copies production database and media to staging, excluding Wordfence tables
- `SYNCTOSTAGING-post.sh` - Post-sync cleanup that deactivates Wordfence on staging only
- `staging-deploy-wrapper.sh` - **Deprecated** - Wrapper script that combines git pull and sync. Not recommended due to privilege escalation risk. Use separate SSH keys instead (see Step 4).

## Deployment Instructions

These scripts live on the DreamHost server in `/home/USER/` (not in the git repo). Follow these steps to deploy or update them:

### 1. Upload scripts to DreamHost

Via SFTP or DreamHost File Manager, upload the sync scripts to:
```
/home/USER/SYNCTOSTAGING.sh
/home/USER/SYNCTOSTAGING-post.sh
```

Replace `USER` with your actual DreamHost username and `SITENAME.org` with your actual domain name in the scripts.

### 2. Make scripts executable

SSH into DreamHost and run:
```bash
chmod +x /home/USER/SYNCTOSTAGING.sh
chmod +x /home/USER/SYNCTOSTAGING-post.sh
```

### 3. Configure placeholder values

Edit both scripts on the server to replace placeholders:
- `USER` - Your DreamHost username
- `SITENAME.org` - Your actual domain name (e.g., `bebitesmart.org`)

**Cleanup:** If you previously uploaded `staging-deploy-wrapper.sh` to the server during an earlier deployment attempt, remove it:
```bash
rm /home/USER/staging-deploy-wrapper.sh
```

### 4. Create a separate SSH key for sync operations (recommended)

**Security note:** Modifying the existing `staging-deploy` key to run the full sync would be a privilege escalation. If that key leaks (compromised GitHub secret, leaked CI log), an attacker could trigger production DB exports and staging syncs. Instead, create a separate key with restricted scope.

#### Step 4a: Generate a new SSH key for sync operations

Generate a new SSH key pair locally:
```bash
ssh-keygen -t ed25519 -f ~/.ssh/staging-sync-deploy -C "staging-sync-deploy@bebitesmart.org"
```

Add the public key to `~/.ssh/authorized_keys` on DreamHost with a forced command:
```
command="/home/USER/SYNCTOSTAGING.sh",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty ssh-ed25519 PUBLIC_KEY_HERE staging-sync-deploy
```

Replace `USER` with your actual DreamHost username.

**Why forced command:** This restricts the key to only running the sync script. If the key leaks, an attacker cannot run arbitrary commands - they can only trigger the sync. The forced command's exit status is returned to the SSH client, so GitHub Actions will fail if the script fails.

#### Step 4b: Add the private key to GitHub Secrets

In GitHub repository settings, add the private key as a new secret:
- Name: `DREAMHOST_STAGING_SYNC_SSH_KEY`
- Value: Contents of the private key file (`~/.ssh/staging-sync-deploy`)

#### Step 4c: Update GitHub Actions workflow

Add a new step in the `deploy-staging` job to trigger the sync after the git pull:

```yaml
- name: Sync production to staging
  uses: appleboy/ssh-action@v1
  with:
    host: ${{ secrets.DREAMHOST_HOST }}
    username: ${{ secrets.DREAMHOST_USER }}
    key: ${{ secrets.DREAMHOST_STAGING_SYNC_SSH_KEY }}
    script: echo "Sync is enforced server-side via restricted SSH key"
```

**Note:** The script content is a no-op because the forced command in authorized_keys overrides any client-side command. The SSH connection itself triggers the sync script, and its exit status is returned to GitHub Actions.

**Why this approach:**
- The `staging-deploy` key remains restricted to git pull only (forced command)
- The new `staging-sync-deploy` key is restricted to only running the sync script (forced command)
- If either key leaks, the blast radius is limited to that specific operation
- The forced command's exit status is returned to the SSH client, so GitHub Actions fails if the script fails
- The sync script's fail-closed environment check protects the Wordfence deactivation step (not the DB export/import itself)

### 5. Verify Wordfence table prefix

The scripts exclude Wordfence tables with the default prefix. If your WordPress installation uses a custom table prefix (e.g., `bbs_ccbs_wp_` instead of `wp_`), update the `WORDFENCE_TABLES` array in `SYNCTOSTAGING.sh` to match:

```bash
WORDFENCE_TABLES=(
  "bbs_wp_wfBlockedIPLog"
  "bbs_wp_wfBlocks"
  # ... etc
)
```

You can check your table prefix in `wp-config.php` on the server.

## How It Works

### SYNCTOSTAGING.sh

1. **Excludes Wordfence tables** from the production database export:
   - `wfBlockedIPLog`, `wfBlocks`, `wfCrawlers`, `wfHits`, `wfHoover`
   - `wfIssues`, `wfLockedOut`, `wfLogins`, `wfReverseCache`
   - `wfStatus`, `wfNotifications`, `wfConfig`

   **Important:** This table exclusion is a **secondary safety measure only**. If Wordfence is updated or reinstalled, new tables may be added that aren't excluded. The post-sync deactivation step (SYNCTOSTAGING-post.sh) is the primary control that ensures Wordfence is neutralized on staging.

2. **Imports** the sanitized database to staging

3. **Rewrites URLs** from production to staging using `wp search-replace`

4. **Syncs media files** via rsync (mirrors exactly, removes staging-only files)

5. **Runs post-sync cleanup** via `SYNCTOSTAGING-post.sh` (primary safety mechanism)

### SYNCTOSTAGING-post.sh

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
./SYNCTOSTAGING.sh
```

Monitor the output to ensure:
- Wordfence tables are excluded from export
- Database imports successfully
- URL rewrites complete
- Media files sync
- Wordfence is deactivated on staging

## Troubleshooting

### Sync fails with "Sync already running"
A previous sync may have crashed without releasing the lock. Remove the lock file:
```bash
rm /home/USER/SYNCTOSTAGING.sh.lock
```

### Wordfence still active on staging after sync
Check that:
1. `SYNCTOSTAGING-post.sh` is executable
2. The site URL check passes (contains "staging")
3. Wordfence plugin slug is correct (`wordfence`)

### Tables not excluded
Verify the table prefix in `WORDFENCE_TABLES` matches your actual WordPress table prefix.

## Security Review

### Problem Statement and Scope

This sync process moves production WordPress data (including the database and media files) to a staging environment for testing. The staging environment is publicly reachable and used by CI (Playwright tests). The security review focused on:

1. **Preventing security state inheritance:** Ensuring staging doesn't inherit production's Wordfence lockout state, blocklists, or enforcement settings in ways that block legitimate testing or CI access
2. **Credential scope containment:** Ensuring the credentials that perform this sync can't be abused beyond their intended scope if leaked (compromised GitHub secret, leaked CI log, etc.)

**Scope:** This review covers the staging sync mechanism (Step 1). The production WAF bypass for CI (Step 2 - custom-header approach for Playwright security suite) is tracked separately and was not part of this review.

### Concerns and Resolutions

| Concern | Status | Resolution |
|---------|--------|------------|
| **Key privilege escalation** (git-pull → full sync) | Fixed | Split into two separate keys: `staging-deploy` (git pull only) and `staging-sync-deploy` (sync script only). This limits blast radius if either key leaks. |
| **wfConfig exclusion ambiguity** | Fixed | Explicitly framed table exclusion as secondary safety measure, with post-sync deactivation as primary control. Added warning comment that table list must be reviewed if Wordfence is updated. |
| **Fail-closed environment check** | Fixed | Documented explicitly that empty/error results from URL check default to aborting (not deactivating). Script checks for empty string before regex match. |
| **Wrapper script permissions** | Resolved | Wrapper script deprecated due to privilege escalation risk. Added cleanup step to remove it from server if previously uploaded. |
| **CI no-op / observability** | Fixed | Used forced command with no-op script content. The forced command's exit status is returned to GitHub Actions, ensuring proper failure detection. |
| **Sync key blast radius** | Fixed | Sync key uses forced command (`command="/home/USER/SYNCTOSTAGING.sh"`) to restrict to script-only execution, not arbitrary shell access. |

### Reasoning for Key Design Decisions

**Why separate keys instead of expanding staging-deploy?**
Expanding the existing key would be a privilege escalation. If that key leaked (compromised GitHub secret, leaked CI log), an attacker could trigger production DB exports and staging syncs. Separate keys limit the blast radius: staging-deploy can only pull code, staging-sync-deploy can only run the sync.

**Why forced command for sync key instead of unrestricted access?**
Unrestricted SSH access would allow arbitrary command execution if the key leaked. A forced command restricts the key to only running the sync script while still returning the script's exit status to GitHub Actions for proper failure detection. This maintains the security boundary without sacrificing observability.

**Why table exclusion as secondary, not primary?**
Wordfence updates can add new tables that aren't in the exclusion list, causing it to drift out of date. The post-sync deactivation step is the reliable control that ensures Wordfence is neutralized on staging. Table exclusion is a secondary defense that requires manual review if Wordfence is updated.

**Why fail-closed environment check?**
If the `wp option get siteurl` command fails, returns empty, or errors out, the script must abort rather than proceed. An inverted check or unexpected failure mode could accidentally deactivate Wordfence on production. The script explicitly checks for empty string before the regex match, ensuring it only proceeds when it can definitively confirm staging environment.

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
- **Acceptance:** This is an acceptable residual risk because the operations are scoped to staging as the destructive target and production as read-only source. Repeated triggering could DoS staging or interfere with concurrent use, but cannot modify production data. Keys are stored in GitHub Secrets with access logging.

**No automated secret rotation**
- **Risk:** SSH keys are not rotated on a scheduled cadence
- **Policy:** Rotate keys only if compromise is suspected or on manual audit
- **Acceptance:** This is the current operational policy; may be revisited if regulatory requirements change

### GitHub Actions Secret Exposure Surface

**Current Configuration (as of review):**

**Environment secrets:**
- `DREAMHOST_PROD_SSH_KEY` - Environment-level (better practice)
- `DREAMHOST_STAGING_SSH_KEY` - Environment-level (staging environment)
- `STAGING_AUTH_PASS` - Environment-level (staging environment)
- `STAGING_AUTH_USER` - Environment-level (staging environment)
- `DREAMHOST_STAGING_SYNC_SSH_KEY` - Environment-level (staging environment)

**Repository secrets:**
- `DREAMHOST_HOST` - Repository-level
- `DREAMHOST_USER` - Repository-level

**Observations:**
- Staging-related secrets (`DREAMHOST_STAGING_SSH_KEY`, `STAGING_AUTH_PASS`, `STAGING_AUTH_USER`, `DREAMHOST_STAGING_SYNC_SSH_KEY`) are now environment-level (staging environment) - better practice
- Non-staging secrets (`DREAMHOST_HOST`, `DREAMHOST_USER`) remain at repository level
- Branch protection rules ARE in place for `main`:
  - Pull request required before merging
  - Status checks must pass ("Playwright Tests")
  - Force pushes blocked
  - Deletions restricted to bypass permissions
- No explicit requirement for approval on workflow changes (only status checks)

**Important distinction:** Branch protection rules protect the GitHub Actions workflow YAML from unreviewed changes, but do NOT protect the server-side `authorized_keys` configuration. The forced-command binding is edited manually on the DreamHost server via SSH (Step 4b), outside of the git-tracked workflow file. Someone with server SSH access could loosen or remove the forced-command restriction without any PR process.

**Recommendation:** The environment-level secret configuration for staging-related secrets provides good defense-in-depth. The existing branch protection rules provide good mitigation against malicious workflow changes being merged (PR required + status checks). Server-side configuration changes should be audited separately.

### Testing and Validation Status

**Status:** Reviewed at the design level; pending live validation

The concerns and resolutions in this review were reasoned through and documented, but have not yet been validated with a live dry run. The following should be validated before first production use:

- Lock file behavior under real conditions (overlapping runs, crash scenarios)
- Stale cleanup timing and interaction with long-running syncs
- Forced-command exit-status propagation through appleboy/ssh-action
- Actual Wordfence table exclusion behavior on the production database
- Fail-closed environment check behavior with various failure modes

**Action:** Run a manual test sync via SSH (`/home/USER/SYNCTOSTAGING.sh`) and verify all expected behaviors before relying on the automated GitHub Actions trigger.
