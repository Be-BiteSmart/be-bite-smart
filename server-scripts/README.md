# Server Scripts for DreamHost

This directory contains scripts that run on the DreamHost server to manage staging sync and post-sync cleanup.

## Quick Start: What You Actually Need to Know

**If you're inheriting this repo, read this section and skip the rest unless you hit a problem or want the full reasoning.**

### What's already set up (you shouldn't need to touch this)
- Two scripts live on the DreamHost server (`sync-staging-db.sh`, `sync-to-staging-post.sh`), already deployed, `chmod 700`'d, with placeholders filled in
- Two separate, narrowly-scoped SSH keys already exist and are wired into `~/.ssh/authorized_keys` on the server:
  - `staging-deploy` — can only run `git pull` on staging
  - `staging-sync-deploy` — can only run the sync script
- GitHub Actions (`deploy-staging` job in `playwright-tests.yml`) automatically syncs staging from production and deploys the latest code on every PR — this is the trigger for the Playwright test suite
- All staging-specific secrets (`DREAMHOST_STAGING_SSH_KEY`, `DREAMHOST_STAGING_SYNC_SSH_KEY`, `STAGING_AUTH_PASS`, `STAGING_AUTH_USER`) are scoped to GitHub's `staging` environment; production's key is scoped to `production`, which also requires manual approval before deploying
- Wordfence is configured to stay deactivated on staging after every sync (so CI and manual logins never get rate-limited or locked out), while staying fully active and untouched on production
- There is **no scheduled/cron sync** — this was tried and deliberately removed (see Step 6 and the Residual Risks section for why)

### What you'd need to do manually, and when
| Situation | What to do |
|---|---|
| You want to test a plugin update against real production data | SSH in and run `./sync-staging-db.sh` manually — see Step 6 below for the full walkthrough |
| Wordfence gets updated and adds new DB tables | Update the `WORDFENCE_TABLES` array in `sync-staging-db.sh` — see Step 5 and the "Wordfence table exclusion drift" risk below |
| You're setting this up fresh for a *different* repo/site (not just inheriting this one) | Follow Steps 1–4 in order — they cover initial deployment, key generation, and GitHub configuration from scratch |
| An SSH key is suspected to be compromised | Rotate it — there's no automatic rotation schedule, so this is a manual, on-demand action (see Residual Risks) |
| Something about the sync is failing silently or you're not sure why | Check the Troubleshooting section, then the Testing and Validation Status section — several things here were reasoned through but not yet exercised under real failure conditions as of the last review |

### What this is *not* yet
This setup has been reviewed at the design level (see the Security Review section for the full back-and-forth) but **has not had a live validation run** — lock file behavior under real concurrent conditions, the actual exit-status propagation through `appleboy/ssh-action`, and a few other things are still pending a real test. If you're the first person running this for real, do the manual test run described in Testing and Validation Status before trusting the automated path blindly.

---

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
ssh-keygen -t ed25519 -f ~/.ssh/staging-sync-deploy -C "staging-sync-deploy"
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

### 6. Manually triggering a sync (e.g. before testing plugin updates)

There's no scheduled/automatic sync outside of CI. A daily cron job was considered and rejected — see rationale below — in favor of running the sync on-demand whenever fresh staging data is actually needed.

**Why not a daily cron:**
- Plugin-update testing on staging is occasional, not daily. A nightly sync would frequently be stale by the time anyone actually used staging (e.g. testing at 2pm against a midnight snapshot), so it didn't actually serve the "fresh data right before I test" need it was meant for.
- Every sync run is a full production DB export + import + media rsync — real load on a shared-hosting box. Running that unconditionally every night, regardless of whether anyone used staging that day, wasn't worth the resource cost for an occasional use case.
- It introduced a lock-file overlap risk with the CI-triggered sync (a PR-triggered run and the midnight cron colliding) that didn't exist before, and added an invocation path with no audit trail — a 3am cron failure is invisible unless someone happens to check the server directly.
- Removing it simplifies the model back to two clear, visible triggers: CI-triggered (on every PR) and manually-triggered (on demand), both observable, neither silent.

**How to manually sync staging before testing plugin updates:**

If you want to test a plugin update (or any other change) against a fresh copy of production data:

```bash
ssh USER@DOMAIN.org
cd /home/USER
./sync-staging-db.sh
```

This runs the full sync — production DB export (Wordfence tables excluded), import to staging, URL rewrite, media rsync, and the post-sync Wordfence deactivation — exactly as it would run from CI, just invoked directly instead of through the `staging-sync-deploy` SSH key.

Once it completes, staging will reflect current production content with Wordfence deactivated, so you can:
1. Log into staging's `wp-admin` (no login lockout risk, since Wordfence is deactivated by the post-sync step)
2. Update the plugin(s) you want to test
3. Click around / run your usual manual checks (or trigger the Playwright suite against staging manually if you want automated coverage too)
4. If something breaks, staging is disposable — just re-run the sync above to reset it back to a clean copy of production, then try again

**Note:** this manual sync uses the same script, same lock file, and same safety mechanisms as the CI-triggered path — there's nothing different about doing it by hand. If a CI sync happens to be running at the same time (e.g. someone just opened a PR), the lock file will cause your manual run to wait/fail rather than race against it; just re-run it once the CI sync finishes.

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
ssh USER@DOMAIN.org
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

**Note on invocation paths:** the sync runs via two intentional triggers — the GitHub Actions `staging-sync-deploy` SSH key (Step 4, on every PR) and manual SSH invocation by a developer (Step 6, for ad-hoc testing such as plugin updates). A daily cron trigger was considered and rejected during this review — see Step 6 for the rationale — so there is no unattended/scheduled invocation path to account for in the credential-scope analysis below.

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

**(Resolved, not residual) Daily cron job removed**
A daily cron-triggered sync was implemented and then removed during this review. It was rejected because plugin-update testing on staging is occasional rather than daily, making an unconditional nightly sync frequently stale by the time it was actually used, while still incurring full DB export/import/rsync load every night on shared hosting. It also introduced a lock-file overlap risk with CI-triggered syncs and a third invocation path with no audit trail. Manual SSH invocation (Step 6) replaces it — fresher when it matters (run right before testing), no unconditional resource cost, and no overlap risk to reason about. This is listed here rather than removed entirely from the document, so a future reader doesn't reintroduce the same cron job without knowing it was already tried and deliberately reverted.

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

**Action:** Run a manual test sync via SSH (`/home/USER/sync-staging-db.sh`) and verify all expected behaviors before relying on the automated GitHub Actions trigger.