# Server Scripts for DreamHost

This directory contains scripts that run on the DreamHost server to manage staging sync and post-sync cleanup.

## Quick Start: What You Actually Need to Know

**If you're inheriting this repo, read this section and skip the rest unless you hit a problem or want the full reasoning.**

### What's already set up (you shouldn't need to touch this)
- Three scripts live on the DreamHost server (`sync-staging-db.sh`, `sync-to-staging-post.sh`, `deploy-staging-branch.sh`), already deployed, `chmod 700`'d, with placeholders filled in
- Two separate, narrowly-scoped SSH keys already exist and are wired into `~/.ssh/authorized_keys` on the server:
  - `staging-deploy` — can only run `deploy-staging-branch.sh` (checks out and pulls the PR's specific branch)
  - `staging-sync-deploy` — can only run the sync script
- GitHub Actions (`deploy-staging` job in `playwright-tests.yml`) automatically syncs staging from production first, then deploys the PR's branch to staging, on every PR — this is the trigger for the Playwright test suite
- All staging-specific secrets (`DREAMHOST_STAGING_SSH_KEY`, `DREAMHOST_STAGING_SYNC_SSH_KEY`, `STAGING_AUTH_PASS`, `STAGING_AUTH_USER`) are scoped to GitHub's `staging` environment; production's key is scoped to `production`, which also requires manual approval before deploying
- **Both the `deploy-staging` job and the `test` job declare `environment: staging`** — this is required for secrets like `STAGING_AUTH_USER`/`STAGING_AUTH_PASS` to resolve in the test runner, not just the deploy step
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
This setup has been reviewed at the design level (see the Security Review section for the full back-and-forth) **and has had a live validation run** — the full sync path (SSH auth via both keys, DB export/import, media rsync, post-sync Wordfence handling, branch-aware deploy, and Playwright test suite auth) has been exercised end-to-end via the actual GitHub Actions trigger, including multiple real failure modes found and fixed. See Testing and Validation Status for what's been confirmed.

---

## Files

- `sync-staging-db.sh` - Main sync script that copies production database and media to staging, excluding Wordfence tables
- `sync-to-staging-post.sh` - Post-sync cleanup that deactivates Wordfence on staging only, if it's installed there
- `deploy-staging-branch.sh` - Checks out and pulls a specific branch on staging (used for PR deployments; validates branch name against strict allowlist before any git operations)
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

**Critical: line endings must be Unix (LF), not Windows (CRLF).** If you edit these scripts on Windows (including some SFTP clients, Notepad, or certain editors that auto-convert line endings), the scripts will fail with `bad interpreter: No such file or directory` when the server tries to run them — the `\r` in `#!/bin/bash\r` makes the shebang unreadable to the Linux kernel. If this happens, fix it on the server with:
```bash
sed -i 's/\r$//' /home/USER/scriptname.sh
```
Then verify with `cat -A /home/USER/scriptname.sh | head -3` — lines should end in `$`, not `^M$`.

### 2. Make scripts executable

SSH into DreamHost and run:
```bash
chmod 700 /home/USER/sync-staging-db.sh
chmod 700 /home/USER/sync-to-staging-post.sh
chmod 700 /home/USER/deploy-staging-branch.sh
```

`chmod 700` means owner read/write/execute only — no broader access needed, and narrower permissions reduce risk if the server is ever shared or misconfigured.

### 3. Configure placeholder values

Edit all three scripts on the server to replace placeholders:
- `USER` - Your DreamHost username
- `SITENAME.org` - Your actual domain name (e.g., `bebitesmart.org`)


### 4. Set up SSH keys

Two separate, narrowly-scoped SSH keys handle the two deploy steps. Each key's forced command restricts it to exactly one script — if a key leaks, the blast radius is limited to that one operation.

#### Step 4a: Generate keys

Generate each key pair locally (not on the server — private keys should never touch the server):

```bash
# Key for the sync script
ssh-keygen -t ed25519 -f ~/.ssh/staging-sync-deploy -C "staging-sync-deploy"

# Key for branch-aware deploy
ssh-keygen -t ed25519 -f ~/.ssh/staging-deploy -C "staging-deploy"
```

Leave passphrases empty (press Enter twice) — passphrase-protected keys can't be unlocked non-interactively by GitHub Actions.

Add both public keys to `~/.ssh/authorized_keys` on DreamHost with forced commands:

```
command="/home/USER/sync-staging-db.sh",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty ssh-ed25519 PUBLIC_KEY_HERE staging-sync-deploy
command="/home/USER/deploy-staging-branch.sh",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty ssh-ed25519 PUBLIC_KEY_HERE staging-deploy
```

**Careful when pasting public keys into `authorized_keys`:** each entry must be exactly one line — `options keytype key-blob comment` — with no duplicated key-type prefix, no stray spaces, and no line wrapping. A malformed line doesn't error loudly; SSH silently skips it, which is much harder to notice than an outright failure. Always verify the fingerprint count after editing:
```bash
ssh-keygen -lf ~/.ssh/authorized_keys
```
This should print one fingerprint per key line (4, in this setup: personal admin key, `staging-deploy`, `staging-sync-deploy`, `prod-deploy`). If the count is short, re-check the line you just edited — don't assume the rest of the file is fine.

**How the deploy key passes the branch name:** `deploy-staging-branch.sh` reads its target branch from `$SSH_ORIGINAL_COMMAND` — whatever the SSH client sends as its "script." The GitHub Actions workflow passes `${{ github.head_ref }}` (the PR's source branch) as that value. The script validates it against a strict allowlist (`^[a-zA-Z0-9_/-]+$`) before any git operation, so a leaked key can only trigger a checkout of a valid-looking branch name — not arbitrary shell commands.

#### Step 4b: Add private keys to GitHub Secrets

Add each private key as a secret scoped to the **staging environment** (Settings → Environments → staging → Environment secrets), not repository-level:

| Secret name | Value |
|---|---|
| `DREAMHOST_STAGING_SSH_KEY` | Contents of `~/.ssh/staging-deploy` (full output including `BEGIN`/`END` lines) |
| `DREAMHOST_STAGING_SYNC_SSH_KEY` | Contents of `~/.ssh/staging-sync-deploy` (full output including `BEGIN`/`END` lines) |
| `STAGING_AUTH_USER` | HTTP Basic Auth username for staging (check `staging.SITENAME.org/.htpasswd`) |
| `STAGING_AUTH_PASS` | HTTP Basic Auth password for staging |

**Repository-level vs. environment-level secrets of the same name don't merge — the environment-scoped one wins for any job declaring that environment, and silently shadows a same-named repo-level secret if one happens to exist.** If you're ever rotating a key and a job keeps authenticating with what looks like the old value even after updating "the secret," check whether you updated the copy in the right scope (Settings → Environments → staging, not the general Settings → Secrets and variables → Actions page) — these are two separate lists in the GitHub UI.

Once confirmed working end-to-end, delete the local copies of the private keys or restrict them to `chmod 600`.

#### Step 4c: Update GitHub Actions workflow

Both the `deploy-staging` job and the `test` job must declare `environment: staging`. This is what makes environment-scoped secrets resolve inside those jobs at all — without it, secrets like `STAGING_AUTH_USER` resolve to empty/null with no error, causing 401s in the test runner that look like a credential problem but are actually a scope problem.

The `deploy-staging` job runs sync first, then branch deploy:

```yaml
jobs:
  deploy-staging:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Sync production to staging
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DREAMHOST_HOST }}
          username: ${{ secrets.DREAMHOST_USER }}
          key: ${{ secrets.DREAMHOST_STAGING_SYNC_SSH_KEY }}
          # Forced command server-side runs sync-staging-db.sh — this echo is never executed.
          script: echo "Sync is enforced server-side via restricted SSH key"
      - name: Deploy PR branch to staging via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DREAMHOST_HOST }}
          username: ${{ secrets.DREAMHOST_USER }}
          key: ${{ secrets.DREAMHOST_STAGING_SSH_KEY }}
          # The branch name is passed as the SSH command value; deploy-staging-branch.sh
          # reads it via $SSH_ORIGINAL_COMMAND, validates it against a strict allowlist,
          # then checks it out and pulls it. Forced command means this key can ONLY ever
          # run that one script — even if this workflow file were compromised.
          script: ${{ github.head_ref }}

  test:
    if: github.event_name == 'pull_request'
    needs: deploy-staging
    name: Playwright Tests
    runs-on: ubuntu-latest
    environment: staging        # Required — makes STAGING_AUTH_USER/PASS resolve
    timeout-minutes: 30
    # ... rest of test job unchanged
```

**Step order matters:** sync runs before deploy so that if a PR's code depends on fresh production data (a new plugin, a schema change), that data is already in place before the new code runs against it.

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

**Note:** this manual sync uses the same script, same lock file, and same safety mechanisms as the CI-triggered path. If a CI sync happens to be running at the same time (e.g. someone just opened a PR), the lock file will cause your manual run to wait/fail rather than race against it; just re-run it once the CI sync finishes.

## How It Works

### sync-staging-db.sh

1. **Excludes Wordfence tables** from the production database export
2. **Imports** the sanitized database to staging
3. **Rewrites URLs** from production to staging using `wp search-replace`
4. **Syncs media files** via rsync (mirrors exactly, removes staging-only files)
5. **Runs post-sync cleanup** via `sync-to-staging-post.sh` (primary safety mechanism)

### sync-to-staging-post.sh

1. **Checks environment** by verifying the site URL contains "staging" — fail-closed: if the check fails for any reason, aborts immediately
2. **Checks whether Wordfence is installed** (`wp plugin is-installed wordfence`) — if absent (expected on staging), logs and exits cleanly; if present (e.g. temporarily installed for testing), proceeds to deactivate
3. **Deactivates Wordfence**, only if step 2 found it installed

### deploy-staging-branch.sh

1. **Reads the target branch** from `$SSH_ORIGINAL_COMMAND` (set by the SSH client — in CI, this is `github.head_ref`)
2. **Validates the branch name** against `^[a-zA-Z0-9_/-]+$` — rejects anything with shell metacharacters, path traversal, or injection vectors
3. **Fetches, checks out, and pulls** the validated branch in staging's wp-content directory

## Safety Features

- **Lock file** prevents overlapping sync runs
- **Cleanup trap** removes temporary SQL files even if script fails
- **Stale file cleanup** removes dump files older than 1 day
- **Environment check** in post-sync script prevents accidental production execution
- **Plugin-presence check** in post-sync script prevents a missing optional plugin from failing the entire sync
- **Branch name allowlist** in deploy script prevents injection attacks via SSH_ORIGINAL_COMMAND
- **SSH key restrictions** in `authorized_keys` limit what each key can do

## Troubleshooting

### Sync fails with "Sync already running"
A previous sync may have crashed without releasing the lock. First confirm no sync is actually in progress (`ps aux | grep sync-staging-db`, and check the lock file's age) before removing it:
```bash
rm /home/USER/sync-staging-db.lock
```

### SSH handshake fails (`no supported methods remain`)
The server rejected every key offered — connection never reached the forced command. In order of likelihood:

1. **Stale secret in the wrong scope.** Confirm you updated the secret in `Settings → Environments → staging → Environment secrets`, not the repository-level secrets page. These are two independent lists; the environment-scoped one always wins for a job declaring `environment: staging`. Updating the wrong one looks like it worked but leaves the job using the old value.
2. **Malformed line in `authorized_keys`.** Run `ssh-keygen -lf ~/.ssh/authorized_keys` and confirm it prints one fingerprint per key you expect (4, in this setup). If the count is short, a line exists in the file as text but isn't parsing as a valid key — usually from a paste error (e.g. the new key got appended after the old prefix instead of replacing it, leaving `ssh-ed25519 ssh-ed25519 <blob>`). Re-paste that line cleanly and re-check the fingerprint count.
3. **Corrupted paste into the GitHub secret.** Since secrets can't be read back once saved, the cheapest fix is to regenerate the keypair fresh and carefully re-paste both halves rather than trying to diagnose the exact corruption.

### Script fails with `bad interpreter: No such file or directory`
The script has Windows-style line endings (CRLF). Fix it on the server:
```bash
sed -i 's/\r$//' /home/USER/scriptname.sh
```
Verify with `cat -A /home/USER/scriptname.sh | head -3` — lines should end in `$`, not `^M$`. Then re-confirm the script is still executable (`ls -l /home/USER/scriptname.sh`).

### Deploy fails with `cd: /home/USER/deploy-staging-branch.sh: Not a directory`
The `authorized_keys` forced command for the `staging-deploy` key has a stray `cd` prefix — e.g. `command="cd /home/USER/deploy-staging-branch.sh"` instead of `command="/home/USER/deploy-staging-branch.sh"`. Edit the line to remove the leading `cd `, keeping only the absolute script path.

### Tests get 401 on staging even though secrets resolve as non-null
Two distinct causes, both found in real testing:

1. **Wrong secret scope.** The `test` job must declare `environment: staging` (same as `deploy-staging`) for `STAGING_AUTH_USER`/`STAGING_AUTH_PASS` to resolve. Without it, secrets resolve to null/empty with no visible error, and every request to staging gets 401. Add `environment: staging` to the `test` job.
2. **Malformed secret value.** A secret can resolve as non-null (non-empty string present) but still be wrong — e.g. the username or password was mistyped, truncated, or contains characters that got mangled in transit. To diagnose: SSH into the server, check `cat /home/USER/staging.SITENAME.org/.htpasswd` to confirm the exact username, then test the credentials directly: `curl -u 'username:password' -o /dev/null -s -w "%{http_code}\n" https://staging.SITENAME.org/`. If `curl` returns 200 but Playwright still gets 401, the issue is in how Playwright sends the credentials (check `httpCredentials` config); if `curl` also gets 401, the credentials are wrong server-side — reset with `htpasswd -b /home/USER/staging.SITENAME.org/.htpasswd username newpassword` and update the GitHub secret to match.

### Wordfence still active on staging after sync
Check that:
1. `sync-to-staging-post.sh` is executable (`ls -l ~/sync-to-staging-post.sh`)
2. The site URL check passes (contains "staging")
3. Wordfence is actually installed on staging (`wp plugin is-installed wordfence --path=<staging path>`) — if it's not installed, the "skipping deactivation" log line is the correct, expected outcome

### Tables not excluded
Verify the table prefix in `WORDFENCE_TABLES` matches your actual WordPress table prefix in `wp-config.php`.

## Security Review

### Problem Statement and Scope

This sync process moves production WordPress data (including the database and media files) to a staging environment for testing. The staging environment is publicly reachable and used by CI (Playwright tests). The security review focused on:

1. **Preventing security state inheritance:** Ensuring staging doesn't inherit production's Wordfence lockout state, blocklists, or enforcement settings in ways that block legitimate testing or CI access
2. **Credential scope containment:** Ensuring the credentials that perform this sync can't be abused beyond their intended scope if leaked

**Note on invocation paths:** the sync runs via two intentional triggers — the GitHub Actions `staging-sync-deploy` SSH key (on every PR) and manual SSH invocation by a developer (Step 6, for ad-hoc testing). A daily cron trigger was considered and rejected — see Step 6 for the rationale.

### Concerns and Resolutions

| Concern | Status | Resolution |
|---------|--------|------------|
| **Key privilege escalation** (git-pull → full sync) | Fixed | Split into two separate keys: `staging-deploy` (deploy-staging-branch.sh only) and `staging-sync-deploy` (sync script only). Limits blast radius if either key leaks. |
| **PR branch always deployed as `main`** | Fixed | Created `deploy-staging-branch.sh` to checkout and pull specific branches. Workflow passes `github.head_ref` as the SSH command value; script validates it against a strict allowlist before any git operation. |
| **wfConfig exclusion ambiguity** | Fixed | Table exclusion explicitly framed as secondary safety measure; post-sync deactivation is primary control. |
| **Fail-closed environment check** | Fixed | Script checks for empty string before regex match; any failure mode aborts rather than proceeding. |
| **Wrapper script permissions** | Resolved | Wrapper script deprecated; cleanup step added to remove it from server. |
| **CI no-op / observability** | Fixed | Forced command's exit status returned to GitHub Actions, ensuring proper failure detection. |
| **Sync key blast radius** | Fixed | Sync key forced command restricts to script-only execution, not arbitrary shell. |
| **Secret exposure scope** | Fixed | Staging secrets migrated to `staging` environment scope; production secrets to `production` environment scope. |
| **Post-sync step fails when Wordfence not installed** | Fixed | `sync-to-staging-post.sh` now checks `wp plugin is-installed` before attempting deactivation; absent plugin is the expected, healthy outcome. |
| **Test job couldn't resolve staging auth secrets** | Fixed | Added `environment: staging` to the `test` job — required for `STAGING_AUTH_USER`/`STAGING_AUTH_PASS` to resolve; without it they silently return null, causing 401 on every request. |
| **Security tests running against staging instead of production** | Fixed | `security.spec.js` uses `test.use({ baseURL: PRODUCTION_URL })` to pin all security checks to production, independent of whatever `baseURL` the rest of the suite resolves to for a given run. Security checks validate server/file-level hardening specific to production's actual configuration. |

### Reasoning for Key Design Decisions

**Why separate keys instead of expanding staging-deploy?**
Expanding the existing key would be a privilege escalation. Separate keys limit the blast radius: staging-deploy can only run deploy-staging-branch.sh, staging-sync-deploy can only run the sync.

**Why pass the branch name via SSH rather than hardcoding it?**
The forced command approach keeps the security boundary intact — a leaked key can only ever run `deploy-staging-branch.sh`, not arbitrary shell. The branch name comes in via `$SSH_ORIGINAL_COMMAND` (attacker-controlled input), so it's validated against `^[a-zA-Z0-9_/-]+$` before any git operation. This allowlist specifically rejects shell metacharacters (`;`, `&&`, backticks, `$()`) and path traversal (`..`). Worst case with a leaked key: an attacker can check out a valid-looking branch name from the repo — not arbitrary code execution.

**Why forced command for sync key instead of unrestricted access?**
Unrestricted SSH access would allow arbitrary command execution if the key leaked. A forced command restricts the key to only running the sync script while still returning the exit status to GitHub Actions for proper failure detection.

**Why table exclusion as secondary, not primary?**
Wordfence updates can add new tables that aren't in the exclusion list. The post-sync deactivation step is the reliable control; table exclusion is a secondary defense that requires manual review if Wordfence is updated.

**Why fail-closed environment check?**
If `wp option get siteurl` fails, returns empty, or errors out, the script must abort rather than proceed. An inverted check or unexpected failure could accidentally deactivate Wordfence on production.

**Why check plugin presence before deactivating, instead of installing Wordfence on staging?**
Wordfence's continuous background scanning is meaningful overhead on a shared-hosting plan. The presence check keeps staging lightweight by default while still correctly handling the case where Wordfence is temporarily installed for testing.

**Why migrate staging secrets to environment-level scoping?**
Repository-level secrets are visible to every workflow and job by default. Environment-level secrets are only injected into jobs that explicitly declare that environment, adding audit trail and access control. `DREAMHOST_HOST` and `DREAMHOST_USER` remain repository-level since both `deploy-staging` and `deploy-prod` reference the same values.

**Why pin security tests to production, not staging?**
Security checks validate server/file-level hardening (`.htaccess` rules, file presence, Wordfence-backed blocking) that's specific to production's actual configuration. Staging intentionally doesn't run Wordfence, so Wordfence-dependent checks would behave unpredictably against staging. A PR testing staging changes should not change what this suite monitors — production's security posture is the thing being checked, continuously.

### Residual Risks and Accepted Tradeoffs

**Wordfence table exclusion drift**
- **Risk:** Wordfence updates can add new tables not in the exclusion list
- **Mitigation:** Post-sync deactivation is the primary control; table exclusion is secondary
- **Owner/Trigger:** Revisit `WORDFENCE_TABLES` whenever Wordfence is updated or reinstalled

**SSH key leakage still allows script execution**
- **Risk:** A leaked key can still trigger its specific script on demand
- **Mitigation:** Blast radius is limited to one scoped operation; cannot modify production data
- **Acceptance:** Acceptable given keys are stored in GitHub Secrets with access logging and environment scoping

**No automated secret rotation**
- **Policy:** Rotate keys only if compromise is suspected or on manual audit

**Staging and production have asymmetric plugin sets (Wordfence specifically)**
- **Risk:** Staging cannot catch Wordfence-specific issues under normal testing
- **Mitigation:** Wordfence can be installed on staging on-demand; post-sync script handles either state
- **Acceptance:** Cost of running Wordfence on staging continuously outweighs the benefit

**(Resolved, not residual) Daily cron job removed**
A daily cron-triggered sync was implemented and then removed. Rejected because plugin-update testing is occasional rather than daily, making an unconditional nightly sync frequently stale while incurring full resource cost. Manual SSH invocation (Step 6) replaces it — fresher when it matters, no unconditional resource cost, no overlap risk. Listed here so a future reader doesn't reintroduce it without knowing it was already tried and deliberately reverted.

### GitHub Actions Secret Exposure Surface

**Environment secrets — `production` environment:**
- `DREAMHOST_PROD_SSH_KEY`

**Environment secrets — `staging` environment:**
- `DREAMHOST_STAGING_SSH_KEY`
- `DREAMHOST_STAGING_SYNC_SSH_KEY`
- `STAGING_AUTH_PASS`
- `STAGING_AUTH_USER`

**Repository secrets:**
- `DREAMHOST_HOST` — shared; referenced by both `deploy-staging` and `deploy-prod`
- `DREAMHOST_USER` — shared; referenced by both `deploy-staging` and `deploy-prod`

**Important:** Both the `deploy-staging` job and the `test` job declare `environment: staging`. This is required for staging-scoped secrets to resolve in both jobs — omitting it from either job silently breaks secret resolution with no obvious error message.

**Important distinction:** Branch protection and environment scoping protect the GitHub Actions workflow and secrets from unreviewed changes, but do NOT protect the server-side `authorized_keys` configuration. The forced-command binding is edited manually on the DreamHost server via SSH, outside of git. Someone with server SSH access could loosen or remove forced-command restrictions without any PR process.

### Testing and Validation Status

**Status:** Live-validated via real GitHub Actions runs, including multiple real failure modes found and fixed

- **Forced-command exit-status propagation:** confirmed — failing forced commands surface correctly as failed Actions steps with real output in the log
- **Wordfence table exclusion on production database:** confirmed working
- **Sync → deploy step order:** confirmed — sync runs first, branch deploy second; both complete correctly in sequence
- **Branch-aware deploy (deploy-staging-branch.sh):** confirmed — PR branch correctly checked out on staging; branch name passes allowlist validation and git operations succeed
- **`environment: staging` resolving all staging-scoped secrets in both `deploy-staging` and `test` jobs:** confirmed end-to-end after fixing the missing `environment: staging` on the `test` job
- **Playwright `httpCredentials` correctly authenticating against staging Basic Auth:** confirmed — centralized in `playwright.config.js` using `STAGING_AUTH_USER`/`STAGING_AUTH_PASS`; no per-request credential injection needed
- **Security tests correctly pinned to production:** confirmed — `test.use({ baseURL: PRODUCTION_URL })` in `security.spec.js` overrides the shared `baseURL` for that suite only
- **Fail-closed environment check:** confirmed in success path; abort path not yet deliberately tested against a forced failure
- **Lock file behavior under concurrent runs:** not yet stress-tested; design is reasoned through but unobserved under real concurrent conditions

**Found via live testing (not anticipated at design time):**
- Unguarded `wp plugin deactivate wordfence` failed the entire sync on first real run (Wordfence not installed on staging). Fixed: presence check added.
- Silently dropped `authorized_keys` line from paste error (duplicated `ssh-ed25519` prefix). `grep` showed the line present; `ssh-keygen -lf` showed fewer fingerprints. Now documented in Step 4a and Troubleshooting.
- CRLF line endings on `deploy-staging-branch.sh` uploaded from a Windows-adjacent environment caused `bad interpreter` failure. Fixed server-side with `sed -i 's/\r$//'`. Now documented in Step 1 and Troubleshooting.
- Stray `cd` prefix in `authorized_keys` forced command caused `cd: .../deploy-staging-branch.sh: Not a directory`. Fixed by removing `cd ` from the command string. Now documented in Troubleshooting.
- `STAGING_AUTH_USER` secret malformed on entry into GitHub. Secret resolved as non-null but value was wrong; all requests got 401. Diagnosed via `curl` against the server directly; fixed by re-entering the secret correctly. Now documented in Troubleshooting.
- `test` job missing `environment: staging` — `STAGING_AUTH_USER`/`STAGING_AUTH_PASS` resolved to null silently, causing 401 on every Playwright request. Fixed by adding `environment: staging` to the `test` job. Now documented in Step 4c and Troubleshooting.
- Security tests pulled onto staging by the `baseURL` fix (was accidentally hitting production before due to env var name mismatch). Fixed by pinning security spec to production explicitly via `test.use()`. Now documented in Security Review.