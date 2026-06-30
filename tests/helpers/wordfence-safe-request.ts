/**
 * wordfence-safe-request.ts
 *
 * Helper for the security-hygiene Playwright suite's sensitive-path-leak
 * checks against PRODUCTION.
 *
 * WHY THIS EXISTS (read before deleting or "simplifying" this file):
 * ---------------------------------------------------------------------
 * Production runs Wordfence (free tier) on DreamHost shared hosting.
 * Wordfence's rate-limiting / crawler-detection can throttle or block
 * a Playwright suite that hits many paths in quick succession.
 *
 * We deliberately do NOT use a shared-secret bypass header, a custom
 * mu-plugin, or an IP allowlist to get around this. Reasons, briefly:
 *   - Free Wordfence has no documented hook to skip rate-limiting based
 *     on a request header. Patching Wordfence's WAF internals to add one
 *     would silently break on every Wordfence auto-update, with no CI
 *     warning, on a shared host we don't control at the server level.
 *   - GitHub-hosted runner IPs are dynamic, drawn from a huge published
 *     range that also has confirmed gaps (jobs have run from IPs outside
 *     the published list). Allowlisting them is both unmaintainable by
 *     hand and not fully reliable even if automated.
 *   - A standing bypass header/IP allowlist is a permanent hole in our
 *     own production WAF for a problem that's actually just "don't send
 *     bursts of requests fast enough to look like a bot."
 *
 * Instead, this suite is tuned to look like a slow, well-behaved client:
 * requests are paced, and any 429/403-style rate-limit response is
 * retried with exponential backoff + jitter rather than failing the test
 * outright. This requires zero changes to production, zero new secrets,
 * and survives Wordfence updates indefinitely.
 *
 * If you're tempted to add a bypass header back in: don't, unless you've
 * first confirmed (a) Wordfence now exposes a real extension point for
 * it, and (b) you have a process for rotating/monitoring that secret.
 * See the team discussion linked in the PR that introduced this file.
 */

import { APIRequestContext, APIResponse } from '@playwright/test';

export interface SafeRequestOptions {
  /** Max attempts including the first try. Default 5. */
  maxAttempts?: number;
  /** Base delay in ms before the first retry. Default 1000. */
  baseDelayMs?: number;
  /** Upper bound on any single backoff delay. Default 30_000. */
  maxDelayMs?: number;
  /** Minimum gap enforced between ANY two requests made via this helper,
   *  regardless of retries — keeps the whole suite under Wordfence's
   *  rate-limit threshold instead of just reacting after the fact.
   *  Default 750ms. */
  minSpacingMs?: number;
  /** Status codes treated as "rate limited, retry" rather than a real
   *  test failure. Wordfence typically returns 403 for blocked requests
   *  and sometimes 429; both are included by default. */
  retryStatusCodes?: number[];
}

const DEFAULTS: Required<SafeRequestOptions> = {
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  minSpacingMs: 750,
  retryStatusCodes: [403, 429],
};

// Shared across all calls in a worker so we pace the *whole* suite,
// not just retries of a single request.
let lastRequestAt = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(attempt: number, opts: Required<SafeRequestOptions>): number {
  // Exponential backoff with full jitter: random in [0, cap].
  const cap = Math.min(opts.maxDelayMs, opts.baseDelayMs * 2 ** (attempt - 1));
  return Math.random() * cap;
}

/**
 * Looks like a Wordfence block/rate-limit page rather than a genuine
 * 403 from the application itself (e.g. an auth check). Wordfence block
 * pages are HTML with a recognizable marker; application-level 403s on
 * a path-leak check are usually JSON or a plain WP "Forbidden" page
 * without this text. Adjust the marker if your Wordfence version differs.
 */
async function looksLikeWordfenceBlock(response: APIResponse): Promise<boolean> {
  if (response.status() !== 403) return false;
  try {
    const body = await response.text();
    return /wordfence|firewall|generated a lot of traffic/i.test(body);
  } catch {
    return false;
  }
}

/**
 * GET a path with Wordfence-aware pacing and retry.
 *
 * Use this in place of `request.get(...)` for every call in the
 * sensitive-path-leak suite. It does NOT send any bypass credentials —
 * it just behaves like a polite client so production's WAF has no
 * reason to flag it.
 */
export async function safeGet(
  request: APIRequestContext,
  path: string,
  options: Parameters<APIRequestContext['get']>[1] = {},
  retryOptions: SafeRequestOptions = {}
): Promise<APIResponse> {
  const opts = { ...DEFAULTS, ...retryOptions };

  let lastResponse: APIResponse | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    // Enforce minimum spacing since the last request this worker made,
    // so we proactively stay under Wordfence's threshold instead of
    // only reacting after getting blocked.
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < opts.minSpacingMs) {
      await sleep(opts.minSpacingMs - elapsed);
    }

    lastRequestAt = Date.now();
    lastResponse = await request.get(path, {
      maxRedirects: 0,
      failOnStatusCode: false,
      ...options,
    });

    const status = lastResponse.status();
    const isRetryableStatus = opts.retryStatusCodes.includes(status);
    const isWordfenceBlock = status === 403 && (await looksLikeWordfenceBlock(lastResponse));

    if (!isRetryableStatus && !isWordfenceBlock) {
      return lastResponse; // Genuine result — caller's assertions decide pass/fail.
    }

    if (attempt < opts.maxAttempts) {
      const delay = backoffDelay(attempt, opts);
      // eslint-disable-next-line no-console
      console.log(
        `[wordfence-safe-request] ${path} returned ${status} (attempt ${attempt}/${opts.maxAttempts}); ` +
          `backing off ${Math.round(delay)}ms before retry.` 
      );
      await sleep(delay);
    }
  }

  // Exhausted retries. Return the last response so the caller's existing
  // assertions produce a normal, readable test failure — we don't want
  // this helper to throw a different kind of error than the suite
  // already expects.
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return lastResponse!;
}
