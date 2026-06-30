# Server Scripts for DreamHost

This directory contains scripts that run on the DreamHost server to manage staging sync and post-sync cleanup.

## Quick Start: What You Actually Need to Know

**If you're inheriting this repo, read this section and skip the rest unless you hit a problem or want the full reasoning.**

### What's already set up (you shouldn't need to touch this)
- Three scripts live on the DreamHost server (`sync-staging-db.sh`, `sync-to-staging-post.sh`, `deploy-staging-branch.sh`), already deployed, `chmod 700`'d, with placeholders filled in
- Two separate, narrowly-scoped SSH keys already exist and are wired into `~/.ssh/authorized_keys` on the server:
  - `staging-deploy` — can only run `deploy-staging-branch.sh` (checks out and pulls a specific branch)
  - `staging-sync-deploy` — can only run the sync script
- GitHub Actions (`deploy-staging` job in `playwright-tests.yml`) automatically syncs staging from production and deploys the PR's branch to staging on every PR — this is the trigger for the Playwright test suite
- All staging-specific secrets (`DREAMHOST_STAGING_SSH_KEY`, `DREAMHOST_STAGING_SYNC_SSH_KEY`, `STAGING_AUTH_PASS`, `STAGING_AUTH_USER`) are scoped to GitHub's `staging` environment; production's key is scoped to `production`, which also requires manual approval before deploying
- Wordfence is configured to stay deactivated on staging after every sync (so CI and manual logins never get rate-limited or locked out), while staying fully active and untouched on production
- **Wordfence is not installed on staging at all** (by design — see below), and the post-sync deactivation step checks for its presence before attempting to deactivate it, so a normal sync completes cleanly whether or not it's there
- There is **no scheduled/cron sync** — this was tried and deliberately removed (see Step 6 and the Residual Risks section for why)

### Why Wordfence isn't installed on staging
Wordfence runs continuous background scanning, live traffic monitoring, and firewall rule processing — meaningful, always-on resource overhead. On a shared DreamHost plan, that's not a great trade for a disposable staging box whose job is just testing. So staging intentionally never had it installed, only production.

This used to cause the post-sync cleanup step to **fail outright** (`wp plugin deactivate` errors out if the plugin isn't present, and with `set -e`, that aborts the whole sync with exit status 1 even though the actual DB/media sync had already succeeded). `sync-to-staging-post.sh` now checks for the plugin's presence first (`wp plugin is-installed`) and skips deactivation gracefully if it's absent, logging that it did so. If a future dev does install Wordfence on staging — e.g. specifically to test how a Wordfence update behaves before letting it anywhere near production — the same step still correctly deactivates it post-sync, with no further changes needed.

### What you'd need to do manually, and when
| Situation | What to do |
|---|---|
| You want to test a plugin update against real production data | SSH in and run `./sync-staging-db.sh` manually — see Step 6 below for the full walkthrough |
| Wordfence gets updated and adds new DB tables | Update the `WORDFENCE_TABLES` array in `sync-staging-db.sh` — see Step 5 and the "Wordfence table exclusion drift" risk below |
| You want to test a Wordfence update specifically | Install Wordfence on staging yourself first (it's not there by default — see above), test, then either leave it deactivated via the next sync or remove it again once done |
| You're setting this up fresh for a *different* repo/site (not just inheriting this one) | Follow Steps 1–4 in order — they cover initial deployment, key generation, and GitHub configuration from scratch |
| An SSH key is suspected to be compromised | Rotate it — there's no automatic rotation schedule, so this is a manual, on-demand action (see Residual Risks) |
| Something about the sync is failing silently or you're not sure why | Check the Troubleshooting section below |

### What this is now
This setup has been reviewed at the design level (see the Security Review section for the full back-and-forth) **and has had a live validation run** — the full sync path (SSH auth via both keys, DB export/import, media rsync, and post-sync Wordfence handling) has been exercised end-to-end via the actual GitHub Actions trigger, including the specific case of Wordfence being absent from staging. See Testing and Validation Status for what's been confirmed.

---

## Files

- `sync-staging-db.sh` - Main sync script that copies production database and media to staging, excluding Wordfence tables
- `sync-to-staging-post.sh` - Post-sync cleanup that deactivates Wordfence on staging only, if it's installed there
- `deploy-staging-branch.sh` - Script that checks out and pulls a specific branch on staging (used for PR deployments)
- `staging-deploy-wrapper.sh` - **Deprecated** - Wrapper script that combines git pull and sync. Not recommended due to privilege escalation risk. Use separate SSH keys instead (see Step 4).

## Deployment Instructions

These scripts live on the DreamHost server in `/home/USER/` (not in the git repo). Follow these steps to deploy or update them:

### 1. Upload scripts to DreamHost

Via SFTP or DreamHost File Manager, upload the scripts to:
```
/home/USER/sync-staging-db.sh
/home/USER/sync-to-staging-post.sh
/home/USER/deploy-staging-branch.sh
```

Replace `USER` with your actual DreamHost username and `SITENAME.org` with your actual domain name in the scripts.

### 2. Make scripts executable

SSH into DreamHost and run:
```bash
chmod +x /home/USER/sync-staging-db.sh
chmod +x /home/USER/sync-to-staging-post.sh
chmod +x /home/USER/deploy-staging-branch.sh
```

**Permissions:** All three scripts should be `chmod 700` (owner read/write/execute only). Neither script needs to be readable, writable, or executable by any other user on the server — they handle production DB credentials and the Wordfence deactivation safety gate, so there's no reason for broader access.

```bash
chmod 700 /home/USER/sync-staging-db.sh
chmod 700 /home/USER/sync-to-staging-post.sh
chmod 700 /home/USER/deploy-staging-branch.sh
```

### 3. Configure placeholder values

Edit all three scripts on the server to replace placeholders:
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

**No `cd` needed:** The `staging-deploy` key's command calls `deploy-staging-branch.sh` by absolute path, which handles its own internal `cd` to the staging directory. The sync key's command also calls `sync-staging-db.sh` by absolute path. Both scripts handle their own internal `cd`/absolute-pathing wherever they need to operate (e.g. the WordPress root for `wp` CLI calls), so no `cd` belongs in the `authorized_keys` line itself.

**Careful when pasting the public key into `authorized_keys`:** each line must be exactly one `options ssh-ed25519 <key-blob> comment` — no duplicated `ssh-ed25519` prefix, no stray spaces, no line wrapping. A malformed line doesn't error loudly; it just gets silently skipped by SSH's key parser, which is much harder to notice than an outright failure. After editing, always confirm the file still parses as many keys as you expect:
```bash
ssh-keygen -lf ~/.ssh/authorized_keys
```
This should print one fingerprint per key line (4, in this setup: personal admin key, `staging-deploy`, `staging-sync-deploy`, `prod-deploy`). If the count is short, re-check the line you just edited rather than assuming the rest of the file is fine.

#### Step 4b: Add the private key to GitHub Secrets

In GitHub repository settings, add the private key (`~/.ssh/staging-sync-deploy`, **not** the `.pub` file) as a new secret, scoped to the **staging environment** (Settings → Environments → staging → Environment secrets), not repository-level:
- Name: `DREAMHOST_STAGING_SYNC_SSH_KEY`
- Value: Contents of the private key file (`cat ~/.ssh/staging-sync-deploy`, full output including the `BEGIN`/`END` lines)

**Repository-level vs. environment-level secrets of the same name don't merge — the environment-scoped one wins for any job declaring that environment, and silently shadows a same-named repo-level secret if one happens to exist.** If you're ever rotating a key and a job keeps authenticating with what looks like the old value even after updating "the secret," check whether you updated the copy in the right scope (Settings → Environments → staging, not the general Settings → Secrets and variables → Actions page) — these are two separate lists in the GitHub UI.

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
- The `staging-deploy` key remains restricted to running deploy-staging-branch.sh (forced command)
- The new `staging-sync-deploy` key is restricted to only running the sync script (forced command)
- If either key leaks, the blast radius is limited to that specific operation
- The forced command's exit status is returned to the SSH client, so GitHub Actions fails if the script fails
- deploy-staging-branch.sh validates branch names against a strict allowlist before git operations to prevent injection attacks
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

This runs the full sync — production DB export (Wordfence tables excluded), import to staging, URL rewrite, media rsync, and the post-sync Wordfence deactivation (skipped automatically if Wordfence isn't installed on staging) — exactly as it would run from CI, just invoked directly instead of through the `staging-sync-deploy` SSH key.

Once it completes, staging will reflect current production content with Wordfence deactivated (or simply absent, on a normal sync), so you can:
1. Log into staging's `wp-admin` (no login lockout risk, since Wordfence is either deactivated or not installed)
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
2. **Checks whether Wordfence is installed** on staging (`wp plugin is-installed wordfence`) before attempting anything else with it
   - Staging does not run Wordfence under normal circumstances (see "Why Wordfence isn't installed on staging" above), so on a typical sync this check correctly finds it absent and the script logs that and exits cleanly — this is the expected, healthy outcome, not an error condition
   - If Wordfence *is* found (e.g. a dev installed it temporarily to test a Wordfence update), the script proceeds to deactivate it exactly as before
3. **Deactivates Wordfence**, only if step 2 found it installed
4. **Aborts** if run against production (safety gate, independent of the above)

## Safety Features

- **Lock file** prevents overlapping sync runs
- **Cleanup trap** removes temporary SQL files even if script fails
- **Stale file cleanup** removes dump files older than 1 day
- **Environment check** in post-sync script prevents accidental production execution
- **Plugin-presence check** in post-sync script prevents a missing optional plugin from failing the entire sync
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
- Wordfence is deactivated on staging if present, or skipped cleanly with a log message if not installed

## Troubleshooting

### Sync fails with "Sync already running"
A previous sync may have crashed without releasing the lock. First confirm no sync is actually in progress (`ps aux | grep sync-staging-db`, and check the lock file's age against how long a sync normally takes) before removing it — deleting an active lock could let two syncs race and leave staging's DB half-imported:
```bash
rm /home/USER/sync-staging-db.sh.lock
```
If you find a differently-named lock file (e.g. from an earlier version of the script), confirm what lock filename the currently deployed script actually uses (`grep -r "lock" sync-staging-db.sh`) before assuming an orphaned one is safe to delete — it almost certainly is if the current script doesn't reference that filename, but worth the one check.

### Sync (or the "Sync production to staging" GitHub Actions step) fails with an SSH handshake error
`ssh: handshake failed: ssh: unable to authenticate, attempted methods [none publickey], no supported methods remain` means the server rejected every key offered — i.e. the connection never even got far enough to hit the forced command. This is an `authorized_keys` / secret problem, not a script problem. In order of likelihood:

1. **Stale secret in the wrong scope.** Confirm you updated the secret in the scope the job actually reads from — `Settings → Environments → staging → Environment secrets`, not the repository-level secrets page. These are two independent lists; a same-named secret can exist in both, and the environment-scoped one always wins for a job declaring `environment: staging`. Updating the wrong one looks like it worked (no error on save) but leaves the job using the old value.
2. **Malformed line in `authorized_keys`.** Run `ssh-keygen -lf ~/.ssh/authorized_keys` and confirm it prints one fingerprint per key you expect (4, in this setup). If the count is short, a line exists in the file as text but isn't parsing as a valid key — usually from a paste error (e.g. the new key got appended after the old prefix instead of replacing it, leaving something like `ssh-ed25519 ssh-ed25519 <blob>`). Re-paste that line cleanly rather than patching around the error, and re-check the fingerprint count.
3. **Corrupted paste into the GitHub secret itself.** Since secrets can't be read back once saved, if 1 and 2 both check out, the next-most-likely cause is the private key text itself being truncated or malformed when pasted into the secret field (missing the `BEGIN`/`END` line, extra blank line, etc.). Cheapest fix is to just regenerate the keypair fresh and carefully re-paste both halves (public into `authorized_keys`, private into the environment secret) rather than trying to diagnose the exact corruption.

### Wordfence still active on staging after sync
Check that:
1. `sync-to-staging-post.sh` is executable
2. The site URL check passes (contains "staging")
3. Wordfence plugin slug is correct (`wordfence`)
4. Wordfence is actually installed on staging in the first place (`wp plugin is-installed wordfence --path=<staging path>`) — if it's not installed, there's nothing to deactivate, and the script's "skipping deactivation" log line is the correct, expected outcome rather than a problem to chase

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
| **Key privilege escalation** (git-pull → full sync) | Fixed | Split into two separate keys: `staging-deploy` (deploy-staging-branch.sh only) and `staging-sync-deploy` (sync script only). This limits blast radius if either key leaks. |
| **PR branch deployment not supported** | Fixed | Created deploy-staging-branch.sh to checkout and pull specific branches, updated workflow to pass branch name via SSH. Branch names validated against strict allowlist before git operations. |
| **wfConfig exclusion ambiguity** | Fixed | Explicitly framed table exclusion as secondary safety measure, with post-sync deactivation as primary control. Added warning comment that table list must be reviewed if Wordfence is updated. |
| **Fail-closed environment check** | Fixed | Documented explicitly that empty/error results from URL check default to aborting (not deactivating). Script checks for empty string before regex match. |
| **Wrapper script permissions** | Resolved | Wrapper script deprecated due to privilege escalation risk. Added cleanup step to remove it from server if previously uploaded. |
| **CI no-op / observability** | Fixed | Used forced command with no-op script content. The forced command's exit status is returned to GitHub Actions, ensuring proper failure detection. |
| **Sync key blast radius** | Fixed | Sync key uses forced command (`command="/home/USER/sync-staging-db.sh"`) to restrict to script-only execution, not arbitrary shell access. |
| **Secret exposure scope** | Fixed | Staging-related secrets (`DREAMHOST_STAGING_SSH_KEY`, `DREAMHOST_STAGING_SYNC_SSH_KEY`, `STAGING_AUTH_PASS`, `STAGING_AUTH_USER`) migrated from repository-level to environment-level scoping (`staging` environment), confirmed live in the workflow file via `environment: staging` on the `deploy-staging` job. |
| **Post-sync step fails entire sync when Wordfence isn't installed on staging** | Fixed | `sync-to-staging-post.sh` now checks `wp plugin is-installed wordfence` before attempting deactivation. Staging intentionally doesn't run Wordfence day-to-day (resource overhead on shared hosting); the script now treats "not installed" as the expected, successful case rather than an error, while still correctly deactivating it if a future dev installs it temporarily. |

### Reasoning for Key Design Decisions

**Why separate keys instead of expanding staging-deploy?**
Expanding the existing key would be a privilege escalation. If that key leaked (compromised GitHub secret, leaked CI log), an attacker could trigger production DB exports and staging syncs. Separate keys limit the blast radius: staging-deploy can only pull code, staging-sync-deploy can only run the sync.

**Why forced command for sync key instead of unrestricted access?**
Unrestricted SSH access would allow arbitrary command execution if the key leaked. A forced command restricts the key to only running the sync script while still returning the script's exit status to GitHub Actions for proper failure detection. This maintains the security boundary without sacrificing observability.

**Why table exclusion as secondary, not primary?**
Wordfence updates can add new tables that aren't in the exclusion list, causing it to drift out of date. The post-sync deactivation step is the reliable control that ensures Wordfence is neutralized on staging. Table exclusion is a secondary defense that requires manual review if Wordfence is updated.

**Why fail-closed environment check?**
If the `wp option get siteurl` command fails, returns empty, or errors out, the script must abort rather than proceed. An inverted check or unexpected failure mode could accidentally deactivate Wordfence on production. The script explicitly checks for empty string before the regex match, ensuring it only proceeds when it can definitively confirm staging environment.

**Why check plugin presence before deactivating, instead of just installing Wordfence on staging to match production?**
Both options were considered. Installing Wordfence on staging would make the two environments more symmetric, but Wordfence's continuous background scanning and traffic monitoring is meaningful overhead on a shared-hosting plan, for a box whose entire purpose is disposable testing. Adding a presence check keeps staging lightweight by default while still correctly handling the case where Wordfence *is* temporarily installed (e.g. specifically to test a Wordfence update before it reaches production) — the deactivation logic doesn't need to know which case it's in, it just checks and acts accordingly.

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

**Staging and production have asymmetric plugin sets (Wordfence specifically)**
- **Risk:** Because Wordfence is intentionally not installed on staging, staging cannot catch Wordfence-specific issues (e.g. a Wordfence update that conflicts with another plugin) under normal testing
- **Mitigation:** Wordfence can be installed on staging on-demand for the specific occasions where testing a Wordfence update matters; the post-sync script handles either state correctly
- **Acceptance:** This is an acceptable gap given shared-hosting resource constraints — the cost of running Wordfence on staging continuously outweighs the benefit for an occasional testing need

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

**Status:** Live-validated via real GitHub Actions runs

This setup has moved past design-only review — the full path has been exercised for real, including failure modes that weren't anticipated at design time, all subsequently fixed:

- **Lock file behavior:** not yet stress-tested under deliberately overlapping concurrent runs; existing design (flock-based, non-blocking) is reasoned through but still worth a dedicated concurrent-run test if that scenario becomes a real concern
- **Stale cleanup timing:** not yet specifically exercised against a long-running sync; current `-mtime +1` logic is reasoned through but unobserved under real long-duration conditions
- **Forced-command exit-status propagation through `appleboy/ssh-action`:** confirmed working — a failing forced command (the original unguarded `wp plugin deactivate` against a missing plugin) correctly surfaced as a failed GitHub Actions step with the script's real output visible in the log, not swallowed or misreported
- **Wordfence table exclusion behavior on the production database:** confirmed working — production export completed successfully excluding the configured tables
- **Fail-closed environment check behavior:** confirmed working in the success path (correctly identified staging and proceeded); not yet deliberately tested against a forced failure (e.g. temporarily breaking the siteurl lookup) to confirm the abort path itself
- **`environment: staging` resolving all four staging-scoped secrets end-to-end:** confirmed — after correcting a secret that had gone stale during key rotation (see below), a full run authenticated successfully with all four staging-scoped secrets
- **New, found via live testing rather than anticipated at design time:** the post-sync script's unguarded `wp plugin deactivate wordfence` failed the entire sync (exit 1) the first time it ran for real, because Wordfence has never actually been installed on staging — see "Why Wordfence isn't installed on staging" above. Fixed by adding a presence check before attempting deactivation.
- **New, found via live testing:** an `authorized_keys` line can be silently dropped by SSH's key parser (e.g. from a paste error introducing a duplicated `ssh-ed25519` prefix) without any error on the file itself — `grep`-based line counts will still show the line as present text, but `ssh-keygen -lf ~/.ssh/authorized_keys` will show fewer fingerprints than expected. This is now called out explicitly in Step 4a and the Troubleshooting section, since it's not an intuitive failure mode and cost significant debugging time to isolate.

**Remaining before considering this fully battle-tested:** the two not-yet-exercised items above (concurrent lock contention, stale-cleanup timing under a long sync) are lower-priority, since they're edge cases rather than the main path — revisit if either scenario actually comes up in practice rather than testing them speculatively.